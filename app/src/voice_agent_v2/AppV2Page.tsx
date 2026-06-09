import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  VOICE_AGENT_V2_CREATE_PROMPTS,
  VOICE_AGENT_V2_CREATE_SETTINGS,
  VOICE_AGENT_V2_DEFAULT_SETTINGS,
  VOICE_AGENT_V2_SEND_TEXT,
  VOICE_AGENT_V2_TOPIC_PRESETS,
  VOICE_AGENT_V2_VISIBLE_HISTORY,
  type VoiceAgentV2Settings,
  type VoiceAgentV2Signal,
  type VoiceAgentV2TurnResult
} from ".";
import {
  VOICE_AGENT_V2_REALTIME_CONNECT,
  VOICE_AGENT_V2_REALTIME_CREATE_CLIENT_SECRET,
  VOICE_AGENT_V2_REALTIME_EVENT_RESULT,
  VOICE_AGENT_V2_REALTIME_MONITOR_MIC,
  VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE,
  type VoiceAgentV2RealtimeConnection,
  type VoiceAgentV2RealtimeState
} from "./realtime";
import type { VoiceAgentChatMessage, VoiceAgentPromptConfig, VoiceAgentTopicId } from "../voice_agent";

export function VoiceAgentV2AppPage({
  debug = false,
  settings: externalSettings,
  setSettings: externalSetSettings
}: {
  debug?: boolean;
  settings?: VoiceAgentV2Settings;
  setSettings?: React.Dispatch<React.SetStateAction<VoiceAgentV2Settings>>;
}) {
  const [internalSettings, setInternalSettings] = useState<VoiceAgentV2Settings>(VOICE_AGENT_V2_DEFAULT_SETTINGS);
  const settings = externalSettings || internalSettings;
  const setSettings = externalSetSettings || setInternalSettings;
  const [messages, setMessages] = useState<Array<VoiceAgentChatMessage & { audioUrl?: string; correctionLevel?: number }>>([]);
  const [text, setText] = useState("");
  const [listenOn, setListenOn] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [signal, setSignal] = useState<VoiceAgentV2Signal>("green");
  const [technical, setTechnical] = useState<VoiceAgentV2TurnResult | { status?: unknown; realtime?: unknown; event?: unknown } | null>(null);
  const [realtimeState, setRealtimeState] = useState<VoiceAgentV2RealtimeState>({ peerState: "none", dataChannelState: "none", outgoingMicEnabled: false, outgoingMicReason: "listen_off" });
  const [micLevel, setMicLevel] = useState(0);
  const [micVoiceDetected, setMicVoiceDetected] = useState(false);
  const [realtimeTextDraft, setRealtimeTextDraft] = useState("");
  const messagesRef = useRef(messages);
  const settingsRef = useRef(settings);
  const speakOnRef = useRef(speakOn);
  const realtimeConnectionRef = useRef<VoiceAgentV2RealtimeConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const micMonitorRef = useRef<{ stop: () => void } | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const responseTextRef = useRef("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    speakOnRef.current = speakOn;
  }, [speakOn]);

  useEffect(() => {
    return () => {
      stopRealtime();
      messages.forEach((message) => {
        if (message.audioUrl) URL.revokeObjectURL(message.audioUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !speakOn;
  }, [speakOn]);

  async function sendText() {
    const value = text.trim();
    if (!value || running) return;
    const userMessage: VoiceAgentChatMessage = { id: createId(), role: "user", text: value, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setText("");
    setRunning(true);
    try {
      const result = await VOICE_AGENT_V2_SEND_TEXT({
        settings,
        text: value,
        visibleHistory: VOICE_AGENT_V2_VISIBLE_HISTORY(nextMessages),
        speakEnabled: speakOn
      });
      applyTurn(result);
    } finally {
      setRunning(false);
    }
  }

  async function startListen() {
    if (realtimeConnectionRef.current) return;
    setRunning(true);
    setListenOn(true);
    try {
      const mic = await VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE();
      if (!mic.status.ok || !mic.stream) throw new Error(mic.status.error || "Microphone did not open.");
      localStreamRef.current = mic.stream;
      micMonitorRef.current = VOICE_AGENT_V2_REALTIME_MONITOR_MIC({
        stream: mic.stream,
        threshold: 0.025,
        onSample: (sample) => {
          setMicLevel(sample.rms);
          setMicVoiceDetected(sample.voiceDetected);
        }
      });
      const secret = await VOICE_AGENT_V2_REALTIME_CREATE_CLIENT_SECRET({
        settings: settingsRef.current,
        visibleHistory: VOICE_AGENT_V2_VISIBLE_HISTORY(messagesRef.current)
      });
      setTechnical({ status: "client_secret_created", realtime: redactRealtimeSecret(secret.data) });
      const connection = await VOICE_AGENT_V2_REALTIME_CONNECT({
        stream: mic.stream,
        clientSecret: secret.clientSecret,
        listenEnabled: true,
        suppressSpeakerFeedback: true,
        onRemoteStream: (stream) => {
          if (!remoteAudioRef.current) return;
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = !speakOnRef.current;
          void remoteAudioRef.current.play().catch((error) => setTechnical({ status: "remote_audio_play_error", realtime: error instanceof Error ? error.message : String(error) }));
        },
        onEvent: handleRealtimeEvent,
        onState: setRealtimeState
      });
      if (!connection.status.ok) throw new Error(connection.status.error || "Realtime connection failed.");
      realtimeConnectionRef.current = connection;
      setTechnical({ status: connection.status, realtime: "streaming_webrtc_connected" });
    } catch (error) {
      setTechnical({ status: "realtime_error", realtime: error instanceof Error ? error.message : String(error) });
      stopRealtime();
    } finally {
      setRunning(false);
    }
  }

  function stopRealtime() {
    micMonitorRef.current?.stop();
    micMonitorRef.current = null;
    realtimeConnectionRef.current?.stop();
    realtimeConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    setRealtimeState({ peerState: "none", dataChannelState: "none", outgoingMicEnabled: false, outgoingMicReason: "listen_off" });
    setMicVoiceDetected(false);
    setListenOn(false);
  }

  function handleRealtimeEvent(event: unknown) {
    const result = VOICE_AGENT_V2_REALTIME_EVENT_RESULT(event);
    setTechnical({ status: "realtime_event", event });
    if (result.aiSpeaking !== undefined) realtimeConnectionRef.current?.setAiSpeaking(result.aiSpeaking);
    if (result.error) setTechnical({ status: "realtime_error", realtime: result.error, event });
    if (result.textDelta) {
      responseTextRef.current = `${responseTextRef.current}${result.textDelta}`;
      setRealtimeTextDraft(responseTextRef.current);
    }
    if (result.textDone) {
      responseTextRef.current = result.textDone || responseTextRef.current;
      const text = responseTextRef.current.trim();
      if (text) {
        const assistantMessage: VoiceAgentChatMessage = {
          id: createId(),
          role: "assistant",
          text,
          createdAt: new Date().toISOString()
        };
        setMessages((current) => [...current, assistantMessage].slice(-40));
      }
      responseTextRef.current = "";
      setRealtimeTextDraft("");
    }
  }

  function toggleListen() {
    if (listenOn) {
      stopRealtime();
      return;
    }
    void startListen();
  }

  function applyTurn(result: VoiceAgentV2TurnResult) {
    setSignal(result.signal);
    setTechnical(result);
    if (!result.chatMessage) return;
    const assistantMessage = result.chatMessage;
    setMessages((current) => [...current, {
      ...assistantMessage,
      audioUrl: result.audio?.url,
      correctionLevel: result.correctionLevel
    }].slice(-40));
    if (speakOnRef.current && result.audio) void new Audio(result.audio.url).play().catch(() => undefined);
  }

  function changeTopic(topicId: VoiceAgentTopicId) {
    setSettings((current) => VOICE_AGENT_V2_CREATE_SETTINGS(topicId, current));
    setMessages([]);
    setSignal("green");
  }

  return (
    <section className={debug ? "voice-app debug-version" : "voice-app"}>
      <div className="chat-shell">
        <div className="chat-toolbar">
          <label className="topic-select">
            <span>Topic</span>
            <select value={settings.topicId} onChange={(event) => changeTopic(event.target.value as VoiceAgentTopicId)}>
              {VOICE_AGENT_V2_TOPIC_PRESETS.map((topic) => <option value={topic.id} key={topic.id}>{topic.label}</option>)}
            </select>
          </label>
          <button className={listenOn ? "toggle active" : "toggle"} type="button" onClick={toggleListen}>{listenOn ? "Listen on" : "Listen off"}</button>
          <button className={speakOn ? "toggle active" : "toggle"} type="button" onClick={() => setSpeakOn((current) => !current)}>{speakOn ? "Speak on" : "Speak off"}</button>
          {speakOn && (
            <label className="topic-select">
              <span>Level</span>
              <select value={settings.speakLevel} onChange={(event) => setSettings((current) => ({ ...current, speakLevel: Number(event.target.value) as 1 | 2 | 3 }))}>
                <option value={1}>1+</option>
                <option value={2}>2+</option>
                <option value={3}>3</option>
              </select>
            </label>
          )}
          <button className="toggle" type="button" onClick={() => setSettings((current) => ({ ...current, allowFreeChat: !current.allowFreeChat }))}>{settings.allowFreeChat ? "Free chat on" : "Free chat off"}</button>
          <span className="signal-lamp-wrap" aria-live="polite">
            <span className={`signal-lamp ${signalClass(signal)}`} title={signal} />
          </span>
        </div>

        <section className="chat-window">
          {messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <span>{message.role}</span>
              <p>{message.text}</p>
              {message.audioUrl && <button className="secondary-button" type="button" onClick={() => void new Audio(message.audioUrl).play()}>Play</button>}
            </article>
          ))}
          {realtimeTextDraft && (
            <article className="chat-message assistant">
              <span>assistant</span>
              <p>{realtimeTextDraft}</p>
            </article>
          )}
        </section>

        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="chat-composer">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendText();
              }
            }}
            rows={2}
            placeholder="Type a message..."
          />
          <button className="run-button" type="button" onClick={() => void sendText()} disabled={running || !text.trim()}>
            <Send size={17} />
            <span>{running ? "Sending..." : "Send"}</span>
          </button>
        </div>
      </div>

      {debug && (
        <section className="debug-method">
          <div className="debug-grid">
            <section className="method-panel">
              <h2>Technical Prompts</h2>
              <pre>{JSON.stringify(VOICE_AGENT_V2_CREATE_PROMPTS(settings), null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Realtime Stream</h2>
              <pre>{JSON.stringify({
                mode: "browser microphone -> WebRTC realtime AI -> remote audio stream",
                mic: { rms: micLevel, voiceDetected: micVoiceDetected },
                state: realtimeState,
                speakOn,
                textDraft: realtimeTextDraft
              }, null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Latest V2 Result</h2>
              <pre>{JSON.stringify(technical || { status: "not run" }, null, 2)}</pre>
            </section>
          </div>
        </section>
      )}
    </section>
  );
}

export function VoiceAgentV2ConfigPage({
  settings,
  setSettings
}: {
  settings: VoiceAgentV2Settings;
  setSettings: React.Dispatch<React.SetStateAction<VoiceAgentV2Settings>>;
}) {
  const prompts = VOICE_AGENT_V2_CREATE_PROMPTS(settings);

  function updatePrompts(patch: Partial<VoiceAgentPromptConfig>) {
    setSettings((current) => ({ ...current, prompts: { ...VOICE_AGENT_V2_CREATE_PROMPTS(current), ...current.prompts, ...patch } }));
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>V2 Topic</h2>
          <label className="field">
            <span>topic</span>
            <select value={settings.topicId} onChange={(event) => setSettings((current) => VOICE_AGENT_V2_CREATE_SETTINGS(event.target.value as VoiceAgentTopicId, current))}>
              {VOICE_AGENT_V2_TOPIC_PRESETS.map((topic) => <option value={topic.id} key={topic.id}>{topic.label}</option>)}
            </select>
          </label>
          <label className="field"><span>topic text</span><input value={settings.topic} onChange={(event) => setSettings((current) => ({ ...current, topic: event.target.value, topicId: "custom" }))} /></label>
          <label className="field"><span>languageName</span><input value={settings.languageName} onChange={(event) => setSettings((current) => ({ ...current, languageName: event.target.value }))} /></label>
          <label className="field"><span>voice</span><input value={settings.voice} onChange={(event) => setSettings((current) => ({ ...current, voice: event.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={settings.allowFreeChat} onChange={(event) => setSettings((current) => ({ ...current, allowFreeChat: event.target.checked }))} /> <span>free chat default</span></label>
          <label className="field"><span>speak level</span><select value={settings.speakLevel} onChange={(event) => setSettings((current) => ({ ...current, speakLevel: Number(event.target.value) as 1 | 2 | 3 }))}><option value={1}>1+</option><option value={2}>2+</option><option value={3}>3</option></select></label>
        </section>
        <section className="method-panel">
          <h2>V2 Prompts</h2>
          <label className="field"><span>systemPrompt</span><textarea value={prompts.systemPrompt} onChange={(event) => updatePrompts({ systemPrompt: event.target.value })} rows={5} /></label>
          <label className="field"><span>task</span><textarea value={prompts.task} onChange={(event) => updatePrompts({ task: event.target.value })} rows={8} /></label>
          <label className="field"><span>howToRespond</span><textarea value={prompts.howToRespond} onChange={(event) => updatePrompts({ howToRespond: event.target.value })} rows={5} /></label>
          <label className="field"><span>responseJsonFormat</span><textarea value={prompts.responseJsonFormat} onChange={(event) => updatePrompts({ responseJsonFormat: event.target.value })} rows={8} /></label>
          <button className="secondary-button" type="button" onClick={() => setSettings((current) => ({ ...current, prompts: undefined }))}>Reset V2 prompts</button>
        </section>
      </div>
    </section>
  );
}

function signalClass(signal: VoiceAgentV2Signal) {
  if (signal === "yellow") return "improvement";
  if (signal === "orange") return "orange";
  if (signal === "red") return "mistake";
  return "idle";
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function redactRealtimeSecret(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if ((key === "value" || key === "secret") && typeof item === "string") return `[secret length=${item.length}]`;
    return item;
  }));
}
