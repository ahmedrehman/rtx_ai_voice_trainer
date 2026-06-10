import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  VOICE_AGENT_V2_CREATE_PROMPTS,
  VOICE_AGENT_V2_CREATE_SETTINGS,
  VOICE_AGENT_V2_DEFAULT_SETTINGS,
  VOICE_AGENT_V2_SEND_TEXT,
  VOICE_AGENT_V2_SIGNAL,
  VOICE_AGENT_V2_TOPIC_PRESETS,
  VOICE_AGENT_V2_VISIBLE_HISTORY,
  type VoiceAgentV2Settings,
  type VoiceAgentV2Signal,
  type VoiceAgentV2CorrectionLevel,
  type VoiceAgentV2TurnResult
} from "../voice_agent_v2";
import {
  VOICE_AGENT_V2_DECIDE_APP_TURN,
  VOICE_AGENT_V2_SHOULD_SPEAK_LEVEL,
  VOICE_AGENT_V2_STRIP_SIGNAL_CODEWORD
} from "../voice_agent_v2/app_logic";
import type { VoiceAgentChatMessage, VoiceAgentTopicId } from "../voice_agent";
import {
  VOICE_AGENT_V3_REALTIME_CAPTURE_VOICE_PACK,
  VOICE_AGENT_V3_REALTIME_CONNECT,
  VOICE_AGENT_V3_REALTIME_CREATE_CLIENT_SECRET,
  VOICE_AGENT_V3_REALTIME_EVENT_RESULT,
  VOICE_AGENT_V3_REALTIME_MONITOR_MIC,
  VOICE_AGENT_V3_REALTIME_OPEN_MICROPHONE,
  VOICE_AGENT_V3_REALTIME_SERVER_AUDIO_ROUNDTRIP,
  type VoiceAgentV3RealtimeAudioRoundtrip,
  type VoiceAgentV3RealtimeConnection,
  type VoiceAgentV3RealtimeState,
  type VoiceAgentV3RealtimeVoicePack
} from "./realtime";

type VoiceAgentV3Destination = "ai_webrtc" | "server_roundtrip";
type VoiceAgentV3SessionState = "idle" | "starting" | "connected" | "listening" | "sending" | "playing" | "error";
type VoiceAgentV3Message = VoiceAgentChatMessage & { correctionLevel?: number };
type VoiceAgentV3Event = { id: string; createdAt: string; type: string; event: unknown };
type VoiceAgentV3Technical =
  | VoiceAgentV2TurnResult
  | VoiceAgentV3RealtimeVoicePack
  | VoiceAgentV3RealtimeAudioRoundtrip
  | { status?: unknown; realtime?: unknown; event?: unknown; webRtc?: unknown; clientSecret?: unknown }
  | null;

const EMPTY_WEBRTC_STATE: VoiceAgentV3RealtimeState = {
  peerState: "none",
  dataChannelState: "none",
  outgoingMicEnabled: false,
  outgoingMicReason: "listen_off"
};

export function VoiceAgentV3AppPage({
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
  const [messages, setMessages] = useState<VoiceAgentV3Message[]>([]);
  const [text, setText] = useState("");
  const [listenOn, setListenOn] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [signal, setSignal] = useState<VoiceAgentV2Signal>("green");
  const [sessionState, setSessionState] = useState<VoiceAgentV3SessionState>("idle");
  const [destination, setDestination] = useState<VoiceAgentV3Destination>("ai_webrtc");
  const [webRtcState, setWebRtcState] = useState<VoiceAgentV3RealtimeState>(EMPTY_WEBRTC_STATE);
  const [micLevel, setMicLevel] = useState(0);
  const [micVoiceDetected, setMicVoiceDetected] = useState(false);
  const [sendActive, setSendActive] = useState(false);
  const [sendStatusText, setSendStatusText] = useState("NOT SEND - idle");
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(true);
  const [remoteAudioGateText, setRemoteAudioGateText] = useState("muted - idle");
  const [realtimeTextDraft, setRealtimeTextDraft] = useState("");
  const [events, setEvents] = useState<VoiceAgentV3Event[]>([]);
  const [technical, setTechnical] = useState<VoiceAgentV3Technical>(null);
  const [clientSecretDebug, setClientSecretDebug] = useState<unknown>(null);
  const [latestPack, setLatestPack] = useState<VoiceAgentV3RealtimeVoicePack | null>(null);
  const [latestRoundtrip, setLatestRoundtrip] = useState<VoiceAgentV3RealtimeAudioRoundtrip | null>(null);
  const [roundtripEndpoint, setRoundtripEndpoint] = useState("/api/voice-agent/audio-roundtrip");
  const [voiceThreshold, setVoiceThreshold] = useState(0.025);
  const [silenceMs, setSilenceMs] = useState(650);
  const [maxSegmentMs, setMaxSegmentMs] = useState(6000);
  const [recordWhileListening, setRecordWhileListening] = useState(true);

  const messagesRef = useRef(messages);
  const settingsRef = useRef(settings);
  const listenOnRef = useRef(listenOn);
  const speakOnRef = useRef(speakOn);
  const sessionActiveRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionRef = useRef<VoiceAgentV3RealtimeConnection | null>(null);
  const micMonitorRef = useRef<{ stop: () => void } | null>(null);
  const responseTextRef = useRef("");
  const responseCommittedRef = useRef(false);
  const correctionLevelRef = useRef<VoiceAgentV2CorrectionLevel | null>(null);
  const correctionTextRef = useRef("");
  const lastUserTranscriptRef = useRef("");
  const aiSpeakingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    settingsRef.current = settings;
    applyRemoteAudioGate("settings changed");
  }, [settings]);

  useEffect(() => {
    listenOnRef.current = listenOn;
  }, [listenOn]);

  useEffect(() => {
    speakOnRef.current = speakOn;
    applyRemoteAudioGate("speak changed");
  }, [speakOn]);

  useEffect(() => {
    return () => stopSession();
  }, []);

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
      applyTextTurn(result, value);
    } finally {
      setRunning(false);
    }
  }

  async function startAiWebRtc() {
    if (sessionActiveRef.current) {
      setRealtimeListenEnabled(true);
      return;
    }
    sessionActiveRef.current = true;
    stopRequestedRef.current = false;
    listenOnRef.current = true;
    resetRealtimeTurn(true);
    setDestination("ai_webrtc");
    setListenOn(true);
    setRunning(true);
    setSessionState("starting");
    setSendActive(false);
    setSendStatusText("NOT SEND - opening microphone");
    setEvents([]);
    setTechnical(null);
    setLatestPack(null);
    setLatestRoundtrip(null);
    setClientSecretDebug(null);
    setWebRtcState(EMPTY_WEBRTC_STATE);
    try {
      const mic = await VOICE_AGENT_V3_REALTIME_OPEN_MICROPHONE();
      if (!mic.status.ok || !mic.stream) throw new Error(mic.status.error || "Microphone did not open.");
      localStreamRef.current = mic.stream;
      micMonitorRef.current = VOICE_AGENT_V3_REALTIME_MONITOR_MIC({
        stream: mic.stream,
        threshold: voiceThreshold,
        onSample: (sample) => {
          setMicLevel(sample.rms);
          setMicVoiceDetected(sample.voiceDetected);
        }
      });
      setSendStatusText("NOT SEND - creating realtime client secret");
      const secret = await VOICE_AGENT_V3_REALTIME_CREATE_CLIENT_SECRET({
        settings: settingsRef.current,
        visibleHistory: VOICE_AGENT_V2_VISIBLE_HISTORY(messagesRef.current)
      });
      setClientSecretDebug(redactSecrets(secret.data));
      setSendStatusText("NOT SEND - connecting WebRTC");
      applyRemoteAudioGate("connecting");
      const connection = await VOICE_AGENT_V3_REALTIME_CONNECT({
        stream: mic.stream,
        clientSecret: secret.clientSecret,
        listenEnabled: true,
        suppressSpeakerFeedback: true,
        onRemoteStream: attachRemoteStream,
        onEvent: handleRealtimeEvent,
        onState: handleWebRtcState
      });
      if (!connection.status.ok) throw new Error(connection.status.error || "WebRTC connection failed.");
      connectionRef.current = connection;
      setSessionState("connected");
      setTechnical({
        status: connection.status,
        webRtc: "browser microphone -> persistent RTCPeerConnection -> OpenAI Realtime remote audio"
      });
    } catch (error) {
      setTechnical({ status: "app_v3_webrtc_error", realtime: errorMessage(error) });
      stopSession();
      setSessionState("error");
    } finally {
      setRunning(false);
    }
  }

  async function startServerRoundtrip() {
    if (sessionActiveRef.current) return;
    sessionActiveRef.current = true;
    stopRequestedRef.current = false;
    listenOnRef.current = true;
    setDestination("server_roundtrip");
    setListenOn(true);
    setSessionState("starting");
    setSendActive(false);
    setSendStatusText("NOT SEND - opening microphone");
    setEvents([]);
    setLatestPack(null);
    setLatestRoundtrip(null);
    try {
      const mic = await VOICE_AGENT_V3_REALTIME_OPEN_MICROPHONE();
      if (!mic.status.ok || !mic.stream) throw new Error(mic.status.error || "Microphone did not open.");
      localStreamRef.current = mic.stream;
      setSessionState("listening");
      setSendStatusText("NOT SEND - listening for voice");
      addEvent("server_roundtrip_started", {
        endpoint: roundtripEndpoint,
        behavior: "debug only: local voice pack -> server audio roundtrip -> autoplay returned audio"
      });
      while (!stopRequestedRef.current) {
        const pack = await VOICE_AGENT_V3_REALTIME_CAPTURE_VOICE_PACK({
          stream: mic.stream,
          threshold: voiceThreshold,
          silenceMs,
          preBufferMs: 1000,
          recorderWhileListening: recordWhileListening,
          maxWaitMs: 8000,
          maxRecordMs: maxSegmentMs,
          minVoiceMs: 180,
          onSample: (sample) => {
            setMicLevel(sample.rms);
            setMicVoiceDetected(sample.voiceDetected);
          },
          shouldStop: () => stopRequestedRef.current,
          shouldSkipSend: () => aiSpeakingRef.current
        });
        setLatestPack(pack);
        setTechnical(pack);
        addEvent(pack.decision, { status: pack.status, debug: pack.debug });
        if (stopRequestedRef.current) break;
        if (pack.decision !== "send_voice_segment" || !pack.audio) {
          setSendActive(false);
          setSendStatusText(pack.debug.reason);
          await wait(100);
          continue;
        }
        setSessionState("sending");
        setSendActive(true);
        setSendStatusText(`SEND - server echo ${pack.audio.size} bytes`);
        const returned = await VOICE_AGENT_V3_REALTIME_SERVER_AUDIO_ROUNDTRIP({
          endpoint: roundtripEndpoint,
          audio: pack.audio
        });
        setLatestRoundtrip(returned);
        setTechnical(returned);
        addEvent(returned.status.ok ? "server_returned_audio_autoplay" : "server_roundtrip_error", {
          status: returned.status,
          debug: returned.debug
        });
        if (!returned.status.ok || !returned.audio) {
          setSendActive(false);
          setSendStatusText(`NOT SEND - ${returned.status.error || "server roundtrip failed"}`);
          await wait(250);
          continue;
        }
        await playReturnedAudio(returned.audio);
        setSessionState("listening");
        setSendActive(false);
        setSendStatusText("NOT SEND - listening for voice");
      }
    } catch (error) {
      setTechnical({ status: "app_v3_roundtrip_error", realtime: errorMessage(error) });
      setSessionState("error");
    } finally {
      stopSession();
    }
  }

  function stopSession() {
    stopRequestedRef.current = true;
    connectionRef.current?.stop();
    connectionRef.current = null;
    micMonitorRef.current?.stop();
    micMonitorRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.muted = true;
    }
    sessionActiveRef.current = false;
    listenOnRef.current = false;
    aiSpeakingRef.current = false;
    setListenOn(false);
    setRunning(false);
    setSendActive(false);
    setSendStatusText("NOT SEND - idle");
    setSessionState("idle");
    setWebRtcState(EMPTY_WEBRTC_STATE);
    setRemoteAudioMuted(true);
    setRemoteAudioGateText("muted - idle");
    setMicVoiceDetected(false);
  }

  function toggleListen() {
    if (!sessionActiveRef.current) {
      void startAiWebRtc();
      return;
    }
    setRealtimeListenEnabled(!listenOnRef.current);
  }

  function setRealtimeListenEnabled(enabled: boolean) {
    listenOnRef.current = enabled;
    setListenOn(enabled);
    connectionRef.current?.setListenEnabled(enabled);
    setSendActive(enabled && !aiSpeakingRef.current);
    setSendStatusText(enabled ? "SEND - WebRTC mic track enabled" : "NOT SEND - listen off (WebRTC track muted)");
  }

  function attachRemoteStream(stream: MediaStream) {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = stream;
    applyRemoteAudioGate("remote stream");
    void remoteAudioRef.current.play().catch((error) => {
      setTechnical({ status: "app_v3_remote_audio_error", realtime: errorMessage(error) });
    });
  }

  function handleWebRtcState(state: VoiceAgentV3RealtimeState) {
    setWebRtcState(state);
    if (state.peerState === "failed" || state.peerState === "disconnected") setSessionState("error");
    if (state.peerState === "connected" || state.dataChannelState === "open") setSessionState(aiSpeakingRef.current ? "playing" : "listening");
    setSendActive(state.outgoingMicEnabled);
    if (state.outgoingMicReason === "enabled") setSendStatusText("SEND - WebRTC mic track enabled");
    if (state.outgoingMicReason === "listen_off") setSendStatusText("NOT SEND - listen off (WebRTC track muted)");
    if (state.outgoingMicReason === "speak_feedback") setSendStatusText("NOT SEND - AI speaking (WebRTC track muted)");
  }

  function handleRealtimeEvent(event: unknown) {
    const result = VOICE_AGENT_V3_REALTIME_EVENT_RESULT(event);
    addEvent(result.type, event);
    if (result.type === "input_audio_buffer.speech_started") {
      resetRealtimeTurn(true);
    }
    const transcript = readRealtimeInputTranscript(event);
    if (transcript) lastUserTranscriptRef.current = transcript;
    if (result.aiSpeaking !== undefined) {
      aiSpeakingRef.current = result.aiSpeaking;
      connectionRef.current?.setAiSpeaking(result.aiSpeaking);
      setSessionState(result.aiSpeaking ? "playing" : "listening");
      if (!result.aiSpeaking && isResponseFinishedEnough(result.type)) commitRealtimeTurn(event);
    }
    if (result.correctionEvent && (!settingsRef.current.allowFreeChat || hasStandardLevelWord(result.correctionEvent.raw))) {
      correctionLevelRef.current = result.correctionEvent.correction;
      correctionTextRef.current = result.correctionEvent.text || correctionTextRef.current;
      setSignal(VOICE_AGENT_V2_SIGNAL(result.correctionEvent.correction));
      applyRemoteAudioGate("correction level");
    }
    if (result.error) setTechnical({ status: "app_v3_realtime_event_error", realtime: result.error, event });
    if (!isInputTranscriptEvent(result.type) && result.textDelta) {
      responseTextRef.current = `${responseTextRef.current}${result.textDelta}`;
      setRealtimeTextDraft(visibleAssistantText(responseTextRef.current));
    }
    if (!isInputTranscriptEvent(result.type) && result.textDone) {
      responseTextRef.current = result.textDone || responseTextRef.current;
      setRealtimeTextDraft(visibleAssistantText(responseTextRef.current));
    }
    if (isResponseDoneEvent(result.type)) {
      commitRealtimeTurn(event);
    }
  }

  function commitRealtimeTurn(event: unknown) {
    if (responseCommittedRef.current) return;
    const level = settingsRef.current.allowFreeChat ? null : correctionLevelRef.current ?? 0;
    const assistantText = visibleAssistantText(correctionTextRef.current || responseTextRef.current);
    const userText = lastUserTranscriptRef.current.trim();
    if (!assistantText && !userText && level !== 0) return;
    const decision = VOICE_AGENT_V2_DECIDE_APP_TURN({
      source: "voice",
      listenOn: true,
      speakOn: speakOnRef.current,
      freeChatOn: settingsRef.current.allowFreeChat,
      speakLevel: settingsRef.current.speakLevel,
      userText,
      aiText: assistantText,
      correctedText: correctionTextRef.current || assistantText,
      correctionLevel: level,
      audioAvailable: false
    });
    setSignal(decision.signal);
    const createdAt = new Date().toISOString();
    const chatMessages: VoiceAgentV3Message[] = decision.chatMessages.map((message) => ({
      id: createId(),
      role: message.role,
      text: message.text,
      createdAt,
      correctionLevel: message.role === "assistant" && typeof level === "number" ? level : undefined
    }));
    if (chatMessages.length) setMessages((current) => [...current, ...chatMessages].slice(-40));
    setTechnical({
      status: "app_v3_webrtc_response_done",
      event: summarizeEvent(event),
      webRtc: webRtcState,
      realtime: { correctionLevel: level, remoteAudioGate: remoteAudioGateText }
    });
    responseCommittedRef.current = true;
    setRealtimeTextDraft("");
  }

  function resetRealtimeTurn(clearTranscript: boolean) {
    responseTextRef.current = "";
    responseCommittedRef.current = false;
    correctionLevelRef.current = null;
    correctionTextRef.current = "";
    setRealtimeTextDraft("");
    if (clearTranscript) lastUserTranscriptRef.current = "";
    applyRemoteAudioGate("new turn");
  }

  function applyRemoteAudioGate(reason: string) {
    const allowed = shouldAllowRemoteAudio();
    const textValue = allowed ? `playing - ${reason}` : remoteMuteReason(reason);
    setRemoteAudioMuted(!allowed);
    setRemoteAudioGateText(textValue);
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.muted = !allowed;
    if (allowed) {
      void remoteAudioRef.current.play().catch((error) => {
        setTechnical({ status: "app_v3_remote_audio_error", realtime: errorMessage(error) });
      });
    }
  }

  function shouldAllowRemoteAudio() {
    if (!speakOnRef.current) return false;
    if (settingsRef.current.allowFreeChat) return true;
    if (correctionLevelRef.current === null) return false;
    return VOICE_AGENT_V2_SHOULD_SPEAK_LEVEL({
      correctionLevel: correctionLevelRef.current,
      speakOn: speakOnRef.current,
      speakLevel: settingsRef.current.speakLevel
    });
  }

  function remoteMuteReason(reason: string) {
    if (!speakOnRef.current) return `muted - speak off (${reason})`;
    if (!settingsRef.current.allowFreeChat && correctionLevelRef.current === null) return `muted - waiting for level (${reason})`;
    return `muted - green or below selected level (${reason})`;
  }

  function applyTextTurn(result: VoiceAgentV2TurnResult, userText: string) {
    const decision = VOICE_AGENT_V2_DECIDE_APP_TURN({
      source: "text",
      listenOn: false,
      speakOn: speakOnRef.current,
      freeChatOn: settingsRef.current.allowFreeChat,
      speakLevel: settingsRef.current.speakLevel,
      userText,
      aiText: result.chatMessage?.text || "",
      correctedText: result.chatMessage?.text || "",
      correctionLevel: result.correctionLevel,
      audioAvailable: Boolean(result.audio)
    });
    setSignal(decision.signal);
    setTechnical(result);
    if (!decision.assistantText && !result.chatMessage) return;
    const assistantMessage = result.chatMessage || {
      id: createId(),
      role: "assistant" as const,
      text: decision.assistantText,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, {
      ...assistantMessage,
      text: decision.assistantText,
      correctionLevel: result.correctionLevel
    }].slice(-40));
  }

  async function playReturnedAudio(audio: Blob) {
    aiSpeakingRef.current = true;
    setSessionState("playing");
    const url = URL.createObjectURL(audio);
    try {
      const player = new Audio(url);
      const done = new Promise<void>((resolve) => {
        player.onended = () => resolve();
        player.onerror = () => resolve();
        player.onpause = () => resolve();
      });
      const played = await player.play().then(() => true).catch((error) => {
        setTechnical({ status: "app_v3_roundtrip_play_error", realtime: errorMessage(error) });
        return false;
      });
      if (played) await done;
    } finally {
      URL.revokeObjectURL(url);
      aiSpeakingRef.current = false;
    }
  }

  function addEvent(type: string, event: unknown) {
    setEvents((current) => [{ id: createId(), createdAt: new Date().toISOString(), type, event: summarizeEvent(event) }, ...current].slice(0, 60));
  }

  function changeTopic(topicId: VoiceAgentTopicId) {
    setSettings((current) => VOICE_AGENT_V2_CREATE_SETTINGS(topicId, current));
    setMessages([]);
    setSignal("green");
    resetRealtimeTurn(true);
  }

  const active = sessionState !== "idle" && sessionState !== "error";

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
          <button className={listenOn ? "toggle active" : "toggle"} type="button" onClick={toggleListen} disabled={running || destination === "server_roundtrip"}>
            {active ? (listenOn ? "Listen on" : "Listen off") : "Start WebRTC"}
          </button>
          {active && <button className="toggle" type="button" onClick={stopSession}>Stop</button>}
          <button className={speakOn ? "toggle active" : "toggle"} type="button" onClick={() => setSpeakOn((current) => !current)}>
            {speakOn ? "Speak on" : "Speak off"}
          </button>
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
          <button className="toggle" type="button" onClick={() => setSettings((current) => ({ ...current, allowFreeChat: !current.allowFreeChat }))}>
            {settings.allowFreeChat ? "Free chat on" : "Free chat off"}
          </button>
          {!settings.allowFreeChat && (
            <span className="signal-lamp-wrap" aria-live="polite">
              <span className={`signal-lamp ${signalClass(signal)}`} title={signal} />
            </span>
          )}
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline muted={remoteAudioMuted} controls={debug} aria-label="App V3 realtime audio" />

        <section className="chat-window">
          {messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <span>{message.role}</span>
              <p>{message.text}</p>
            </article>
          ))}
          {realtimeTextDraft && (
            <article className="chat-message assistant">
              <span>assistant</span>
              <p>{realtimeTextDraft}</p>
            </article>
          )}
        </section>

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
              <h2>V3 WebRTC Strategy</h2>
              <SignalLine label="session" active={active} value={`${destination} / ${sessionState}`} />
              <SignalLine label="webRTC peer" active={webRtcState.peerState === "connected"} value={`${webRtcState.peerState} / ${webRtcState.dataChannelState}`} />
              <SignalLine label="microphone track" active={webRtcState.outgoingMicEnabled} value={webRtcState.outgoingMicReason} />
              <SignalLine label="local mic voice" active={micVoiceDetected} value={`${micVoiceDetected ? "voice/sound" : "no voice"} rms=${micLevel}`} />
              <ServerSendLamp active={sendActive} value={sendStatusText} />
              <SignalLine label="remote audio gate" active={!remoteAudioMuted} value={remoteAudioGateText} />
              <pre>{JSON.stringify({
                mode: destination === "server_roundtrip"
                  ? "debug only: voice pack -> server audio roundtrip"
                  : "live: one microphone stream -> persistent RTCPeerConnection -> remote AI audio",
                webRtc: webRtcState,
                mic: { rms: micLevel, voiceDetected: micVoiceDetected },
                speakOn,
                speakLevel: settings.speakLevel,
                freeChatOn: settings.allowFreeChat,
                remoteAudio: { muted: remoteAudioMuted, gate: remoteAudioGateText },
                textDraft: realtimeTextDraft,
                clientSecret: clientSecretDebug,
                latestPack: latestPack ? { decision: latestPack.decision, debug: latestPack.debug } : null,
                latestRoundtrip: latestRoundtrip ? { status: latestRoundtrip.status, debug: latestRoundtrip.debug } : null
              }, null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Audio Roundtrip Diagnostic</h2>
              <label className="field">
                <span>server roundtrip endpoint</span>
                <input value={roundtripEndpoint} onChange={(event) => setRoundtripEndpoint(event.target.value)} disabled={active} />
              </label>
              <label className="field">
                <span>voice threshold</span>
                <input type="number" value={voiceThreshold} min={0.001} max={0.2} step={0.001} onChange={(event) => setVoiceThreshold(Number(event.target.value))} disabled={active} />
              </label>
              <label className="field">
                <span>silence ms</span>
                <input type="number" value={silenceMs} min={200} step={50} onChange={(event) => setSilenceMs(Number(event.target.value))} disabled={active} />
              </label>
              <label className="field">
                <span>max pack ms</span>
                <input type="number" value={maxSegmentMs} min={1000} step={500} onChange={(event) => setMaxSegmentMs(Number(event.target.value))} disabled={active} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={recordWhileListening} onChange={(event) => setRecordWhileListening(event.target.checked)} disabled={active} />
                <span>record while listening</span>
              </label>
              <button className="secondary-button" type="button" onClick={() => void startServerRoundtrip()} disabled={active}>Start roundtrip</button>
            </section>
            <section className="method-panel">
              <h2>Technical Prompts</h2>
              <pre>{JSON.stringify(VOICE_AGENT_V2_CREATE_PROMPTS(settings), null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Latest V3 Result</h2>
              <pre>{JSON.stringify(technical || { status: "not run" }, null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Realtime Events</h2>
              <pre>{JSON.stringify(events, null, 2)}</pre>
            </section>
          </div>
        </section>
      )}
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

function ServerSendLamp({ active, value }: { active: boolean; value: string }) {
  return (
    <div className={`step ${active ? "done" : "error"}`}>
      <strong>send lamp</strong>
      <span>{active ? "SEND" : "NOT SEND"}</span>
      <p>{value}</p>
    </div>
  );
}

function signalClass(signal: VoiceAgentV2Signal) {
  if (signal === "yellow") return "improvement";
  if (signal === "orange") return "orange";
  if (signal === "red") return "mistake";
  return "idle";
}

function hasStandardLevelWord(value: unknown): boolean {
  if (typeof value === "string") return /^\s*(signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge))\b/i.test(value);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return hasStandardLevelWord(record.text) || hasStandardLevelWord(record.chat_text_to_user) || hasStandardLevelWord(record.message);
}

function visibleAssistantText(text: string) {
  return VOICE_AGENT_V2_STRIP_SIGNAL_CODEWORD(text).trim();
}

function isInputTranscriptEvent(type: string) {
  return type.includes("input_audio") && type.includes("transcription");
}

function isResponseDoneEvent(type: string) {
  return type === "response.done" || type === "done";
}

function isResponseFinishedEnough(type: string) {
  return type === "response.audio.done" || type === "response.done" || type === "output_audio_buffer.stopped";
}

function readRealtimeInputTranscript(event: unknown) {
  if (!event || typeof event !== "object") return "";
  const record = event as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (!isInputTranscriptEvent(type) || !type.endsWith(".completed")) return "";
  return firstNestedString(record, ["transcript", "text"]);
}

function firstNestedString(value: unknown, keys: string[]): string {
  const seen = new Set<unknown>();
  const walk = (item: unknown): string => {
    if (!item || typeof item !== "object" || seen.has(item)) return "";
    seen.add(item);
    if (Array.isArray(item)) {
      for (const child of item) {
        const found = walk(child);
        if (found) return found;
      }
      return "";
    }
    const record = item as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return "";
  };
  return walk(value);
}

function redactSecrets(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (typeof item === "string" && (key.toLowerCase().includes("secret") || item.startsWith("ek_"))) return "[redacted]";
    return item;
  }));
}

function summarizeEvent(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    const lower = key.toLowerCase();
    if (typeof item === "string" && (lower.includes("audio") || lower.includes("secret") || item.length > 500)) return `[string length=${item.length}]`;
    return item;
  }));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
