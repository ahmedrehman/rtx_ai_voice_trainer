import React, { useEffect, useRef, useState } from "react";
import type { VoiceAgentSettings } from "../voice_agent";
import {
  VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC,
  VOICE_AGENT_REALTIME_BROWSER_MONITOR_MIC_LEVEL,
  VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE,
  VOICE_AGENT_REALTIME_DECIDE_EVENT_STATE,
  VOICE_AGENT_REALTIME_READ_CLIENT_SECRET,
  VOICE_AGENT_REALTIME_REDACT_SECRETS,
  VOICE_AGENT_REALTIME_SUMMARIZE_EVENT
} from "./client";
import { VOICE_AGENT_REALTIME_CREATE_INSTRUCTIONS, VOICE_AGENT_REALTIME_NORMALIZE_VOICE } from "./prompts";
import type { RealtimeWebrtcConnection, RealtimeWebrtcMicMonitor } from "./types";

type RealtimeEventLog = {
  id: string;
  createdAt: string;
  type: string;
  event: unknown;
};

type RealtimeConnectionState = "idle" | "starting" | "connected" | "stopping" | "error";

export function VoiceAgentRealtimeWebrtcDebugPage({ settings }: { settings: VoiceAgentSettings }) {
  const [endpoint, setEndpoint] = useState("/api/voice-agent/realtime-client-secret");
  const [sendToAi, setSendToAi] = useState(false);
  const [suppressSpeakerFeedback, setSuppressSpeakerFeedback] = useState(true);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("idle");
  const [peerState, setPeerState] = useState("none");
  const [dataChannelState, setDataChannelState] = useState("none");
  const [micLevel, setMicLevel] = useState(0);
  const [localVoiceDetected, setLocalVoiceDetected] = useState(false);
  const [realtimeSpeechDetected, setRealtimeSpeechDetected] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micSentToAi, setMicSentToAi] = useState(false);
  const [micSendReason, setMicSendReason] = useState("send_to_ai_off");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<RealtimeEventLog[]>([]);
  const [clientSecretDebug, setClientSecretDebug] = useState<unknown>(null);

  const connectionRef = useRef<RealtimeWebrtcConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micMonitorRef = useRef<RealtimeWebrtcMicMonitor | null>(null);

  useEffect(() => {
    connectionRef.current?.setSendToAi(sendToAi);
  }, [sendToAi]);

  useEffect(() => {
    connectionRef.current?.setAiSpeaking(aiSpeaking);
  }, [aiSpeaking]);

  useEffect(() => {
    connectionRef.current?.setSuppressSpeakerFeedback(suppressSpeakerFeedback);
  }, [suppressSpeakerFeedback]);

  useEffect(() => {
    return () => {
      void stopRealtime();
    };
  }, []);

  async function startRealtime() {
    setError("");
    setEvents([]);
    setClientSecretDebug(null);
    setConnectionState("starting");
    try {
      const micSession = await VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE({}, {});
      if (!micSession.status.ok || !micSession.stream) throw new Error(micSession.status.error || "Microphone did not open.");
      const localStream = micSession.stream;
      localStreamRef.current = localStream;
      micMonitorRef.current = VOICE_AGENT_REALTIME_BROWSER_MONITOR_MIC_LEVEL({}, {
        stream: localStream,
        onSample: (sample) => {
          setMicLevel(sample.rms);
          setLocalVoiceDetected(sample.voiceDetected);
          connectionRef.current?.setLocalVoiceDetected(sample.voiceDetected);
        }
      });

      const secretResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-realtime",
          voice: VOICE_AGENT_REALTIME_NORMALIZE_VOICE(settings.voice),
          instructions: VOICE_AGENT_REALTIME_CREATE_INSTRUCTIONS(settings)
        })
      });
      const secretData = await secretResponse.json().catch(() => ({ error: "Client secret response was not JSON." }));
      setClientSecretDebug(VOICE_AGENT_REALTIME_REDACT_SECRETS(secretData));
      if (!secretResponse.ok) throw new Error(JSON.stringify(secretData));
      const clientSecret = VOICE_AGENT_REALTIME_READ_CLIENT_SECRET(secretData);
      if (!clientSecret) throw new Error("Realtime client secret response did not include a usable secret value.");

      const connection = await VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC({}, {
        stream: localStream,
        clientSecret,
        sendToAi,
        localVoiceDetected: false,
        requireLocalVoice: true,
        suppressSpeakerFeedback,
        onRemoteStream: (stream) => {
        if (remoteAudioRef.current && stream) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
        }
        },
        onEvent: handleRealtimeEvent,
        onState: (state) => {
          setPeerState(state.peerState);
          setDataChannelState(state.dataChannelState);
          setMicSentToAi(state.outgoingMicEnabled);
          setMicSendReason(state.outgoingMicReason);
          if (state.peerState === "connected") setConnectionState("connected");
          if (state.peerState === "failed") setConnectionState("error");
          if (state.peerState === "closed") setConnectionState("idle");
        }
      });
      if (!connection.status.ok) throw new Error(connection.status.error || "WebRTC connection failed.");
      connectionRef.current = connection;
    } catch (caught) {
      setConnectionState("error");
      setError(caught instanceof Error ? caught.message : String(caught));
      await stopRealtime();
    }
  }

  async function stopRealtime() {
    setConnectionState((current) => current === "idle" ? "idle" : "stopping");
    micMonitorRef.current?.stop();
    micMonitorRef.current = null;
    connectionRef.current?.stop();
    connectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    setMicSentToAi(false);
    setMicSendReason("send_to_ai_off");
    setRealtimeSpeechDetected(false);
    setAiSpeaking(false);
    setPeerState("none");
    setDataChannelState("none");
    setConnectionState("idle");
  }

  function handleRealtimeEvent(event: unknown) {
    const decision = VOICE_AGENT_REALTIME_DECIDE_EVENT_STATE(event);
    addEvent(decision.eventType, event);
    if (decision.realtimeSpeechDetected !== undefined) setRealtimeSpeechDetected(decision.realtimeSpeechDetected);
    if (decision.aiSpeaking !== undefined) setAiSpeaking(decision.aiSpeaking);
    if (decision.error) setError(decision.error);
  }

  function addEvent(type: string, event: unknown) {
    setEvents((current) => [{
      id: createId(),
      createdAt: new Date().toISOString(),
      type,
      event: summarizeRealtimeEvent(event)
    }, ...current].slice(0, 40));
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Realtime Controls</h2>
          <label className="field"><span>client secret endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} /><small>Must be wired to call VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET on the server.</small></label>
          <label className="check-row"><input type="checkbox" checked={sendToAi} onChange={(event) => setSendToAi(event.target.checked)} /> <span>Send microphone audio to AI</span></label>
          <label className="check-row"><input type="checkbox" checked={suppressSpeakerFeedback} onChange={(event) => setSuppressSpeakerFeedback(event.target.checked)} /> <span>Disable mic track while AI audio is playing</span></label>
          <div className="button-row">
            <button className="run-button" type="button" onClick={() => void startRealtime()} disabled={connectionState === "starting" || connectionState === "connected"}>{connectionState === "starting" ? "Starting..." : "Start WebRTC"}</button>
            <button className="secondary-button" type="button" onClick={() => void stopRealtime()} disabled={connectionState === "idle"}>Stop</button>
          </div>
        </section>
        <section className="method-panel">
          <h2>Live State</h2>
          <SignalLine label="connection" active={connectionState === "connected"} value={connectionState} />
          <SignalLine label="peer" active={peerState === "connected"} value={peerState} />
          <SignalLine label="data channel" active={dataChannelState === "open"} value={dataChannelState} />
          <SignalLine label="local mic voice" active={localVoiceDetected} value={`${localVoiceDetected ? "voice/sound" : "no voice"} rms=${micLevel}`} />
          <SignalLine label="sent to AI" active={micSentToAi} value={`${micSentToAi ? "YES" : "NO"} reason=${micSendReason}`} />
          <SignalLine label="AI heard speech" active={realtimeSpeechDetected} value={realtimeSpeechDetected ? "YES" : "NO"} />
          <SignalLine label="AI speaking" active={aiSpeaking} value={aiSpeaking ? "YES - mic gate active" : "NO"} />
          <audio ref={remoteAudioRef} autoPlay controls />
        </section>
      </div>

      {error && <section className="warning">ERROR: {error}</section>}

      <section className="method-panel">
        <h2>Client Secret Result</h2>
        <pre>{JSON.stringify(clientSecretDebug || { status: "not requested" }, null, 2)}</pre>
      </section>

      <section className="method-panel">
        <h2>Realtime Events</h2>
        {events.length === 0 ? <p>No realtime data channel events yet.</p> : events.map((item) => (
          <article className="stack-item ok" key={item.id}>
            <div>
              <strong>{item.type}</strong>
              <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
            </div>
            <details>
              <summary>Raw event</summary>
              <pre>{JSON.stringify(item.event, null, 2)}</pre>
            </details>
          </article>
        ))}
      </section>
    </section>
  );
}

function SignalLine({ label, active, value }: { label: string; active: boolean; value: string }) {
  return (
    <div className="step done">
      <strong>{label}</strong>
      <span>{active ? "active" : "idle"}</span>
      <p>{value}</p>
    </div>
  );
}

function summarizeRealtimeEvent(value: unknown) {
  return VOICE_AGENT_REALTIME_SUMMARIZE_EVENT(value);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
