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
  type VoiceAgentV2TurnResult
} from ".";
import {
  VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK,
  VOICE_AGENT_V2_REALTIME_EVENT_RESULT,
  VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE,
  VOICE_AGENT_V2_REALTIME_SERVER_AUDIO_ROUNDTRIP,
  VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK,
  type VoiceAgentV2RealtimeAudioRoundtrip,
  type VoiceAgentV2RealtimeVoicePack,
  type VoiceAgentV2RealtimeVoicePackTurn
} from "./realtime";
import {
  VOICE_AGENT_V2_DECIDE_APP_TURN,
  VOICE_AGENT_V2_SHOULD_SPEAK_LEVEL,
  VOICE_AGENT_V2_SHOULD_STREAM_AUDIO_IMMEDIATELY
} from "./app_logic";
import type { VoiceAgentChatMessage, VoiceAgentPromptConfig, VoiceAgentStreamVoiceTurnEvent, VoiceAgentTopicId } from "../voice_agent";

type VoiceAgentV2VoiceDestination = "ai" | "server_roundtrip";

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
  const [technical, setTechnical] = useState<VoiceAgentV2TurnResult | VoiceAgentV2RealtimeVoicePack | VoiceAgentV2RealtimeVoicePackTurn | VoiceAgentV2RealtimeAudioRoundtrip | { status?: unknown; realtime?: unknown; event?: unknown } | null>(null);
  const [packConnectionState, setPackConnectionState] = useState<"idle" | "starting" | "listening" | "sending" | "playing" | "error">("idle");
  const [sendActive, setSendActive] = useState(false);
  const [sendStatusText, setSendStatusText] = useState("NOT SEND - listen off");
  const [activeVoiceDestination, setActiveVoiceDestination] = useState<VoiceAgentV2VoiceDestination>("ai");
  const [roundtripEndpoint, setRoundtripEndpoint] = useState("/api/voice-agent/audio-roundtrip");
  const [voiceThreshold, setVoiceThreshold] = useState(0.025);
  const [silenceMs, setSilenceMs] = useState(650);
  const [maxSegmentMs, setMaxSegmentMs] = useState(6000);
  const [recorderWhileListening, setRecorderWhileListening] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [micVoiceDetected, setMicVoiceDetected] = useState(false);
  const [realtimeTextDraft, setRealtimeTextDraft] = useState("");
  const [latestPack, setLatestPack] = useState<VoiceAgentV2RealtimeVoicePack | null>(null);
  const [latestTurn, setLatestTurn] = useState<VoiceAgentV2RealtimeVoicePackTurn | null>(null);
  const [latestRoundtrip, setLatestRoundtrip] = useState<VoiceAgentV2RealtimeAudioRoundtrip | null>(null);
  const [voiceEvents, setVoiceEvents] = useState<Array<{ id: string; createdAt: string; type: string; event: unknown }>>([]);
  const messagesRef = useRef(messages);
  const settingsRef = useRef(settings);
  const speakOnRef = useRef(speakOn);
  const localStreamRef = useRef<MediaStream | null>(null);
  const responseTextRef = useRef("");
  const stopListenRef = useRef(false);
  const listenLoopRef = useRef(false);
  const appSpeakingRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamAudioPlayerRef = useRef<{ stop: () => void } | null>(null);

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
      messagesRef.current.forEach((message) => {
        if (message.audioUrl) URL.revokeObjectURL(message.audioUrl);
      });
    };
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
      applyTurn(result, value);
    } finally {
      setRunning(false);
    }
  }

  async function startListen(voiceDestination: VoiceAgentV2VoiceDestination = "ai") {
    if (listenLoopRef.current) return;
    const useDiagnosticCaptureSettings = debug && voiceDestination === "server_roundtrip";
    const captureThreshold = useDiagnosticCaptureSettings ? voiceThreshold : 0.025;
    const captureSilenceMs = useDiagnosticCaptureSettings ? silenceMs : 650;
    const captureMaxSegmentMs = useDiagnosticCaptureSettings ? maxSegmentMs : 6000;
    const captureRecorderWhileListening = useDiagnosticCaptureSettings ? recorderWhileListening : true;
    stopListenRef.current = false;
    listenLoopRef.current = true;
    setActiveVoiceDestination(voiceDestination);
    setListenOn(true);
    setPackConnectionState("starting");
    setSendStatusText("NOT SEND - opening microphone");
    setLatestPack(null);
    setLatestTurn(null);
    setLatestRoundtrip(null);
    setVoiceEvents([]);
    try {
      const mic = await VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE();
      if (!mic.status.ok || !mic.stream) throw new Error(mic.status.error || "Microphone did not open.");
      localStreamRef.current = mic.stream;
      setPackConnectionState("listening");
      setSendStatusText("NOT SEND - listening for voice");
      if (voiceDestination === "server_roundtrip") {
        addVoiceEvent("server_roundtrip_started", {
          endpoint: roundtripEndpoint,
          behavior: "listen, decide SEND or SKIP, echo sent voice packs, autoplay returned audio"
        });
      }

      while (!stopListenRef.current) {
        const pack = await VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK({
          stream: mic.stream,
          threshold: captureThreshold,
          silenceMs: captureSilenceMs,
          preBufferMs: 1000,
          recorderWhileListening: captureRecorderWhileListening,
          maxWaitMs: 8000,
          maxRecordMs: captureMaxSegmentMs,
          minVoiceMs: 180,
          onSample: (sample) => {
            setMicLevel(sample.rms);
            setMicVoiceDetected(sample.voiceDetected);
          },
          shouldStop: () => stopListenRef.current,
          shouldSkipSend: () => appSpeakingRef.current
        });
        setLatestPack(pack);
        setTechnical(pack);
        addVoiceEvent(pack.decision, {
          destination: voiceDestination,
          status: pack.status,
          debug: pack.debug
        });

        if (stopListenRef.current) break;
        if (pack.decision !== "send_voice_segment" || !pack.audio) {
          setSendActive(false);
          setSendStatusText(pack.debug.reason);
          await wait(100);
          continue;
        }

        setSendActive(true);
        setSendStatusText(voiceDestination === "server_roundtrip" ? `SEND - server echo ${pack.audio.size} bytes` : `SEND - voice pack ${pack.audio.size} bytes`);
        setRunning(true);
        setPackConnectionState("sending");
        setRealtimeTextDraft("");
        responseTextRef.current = "";

        if (voiceDestination === "server_roundtrip") {
          const returned = await VOICE_AGENT_V2_REALTIME_SERVER_AUDIO_ROUNDTRIP({
            endpoint: roundtripEndpoint,
            audio: pack.audio
          });
          setLatestRoundtrip(returned);
          setTechnical(returned);
          setRunning(false);
          addVoiceEvent(returned.status.ok ? "server_returned_audio_autoplay" : "server_roundtrip_error", {
            status: returned.status,
            debug: returned.debug
          });
          if (!returned.status.ok || !returned.audio) {
            setSendActive(false);
            setSendStatusText(`NOT SEND - ${returned.status.error || "server roundtrip failed"}`);
            await wait(250);
            continue;
          }
          const returnedAudioUrl = URL.createObjectURL(returned.audio);
          try {
            await playAssistantAudio(returnedAudioUrl, "NOT SEND - server echo playing");
          } finally {
            URL.revokeObjectURL(returnedAudioUrl);
          }
          setPackConnectionState("listening");
          setSendActive(false);
          setSendStatusText("NOT SEND - listening for voice");
          continue;
        }

        const streamPlayback = createVoiceStreamPlayback();
        const turn = await VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK({
          settings: settingsRef.current,
          audio: pack.audio,
          visibleHistory: VOICE_AGENT_V2_VISIBLE_HISTORY(messagesRef.current),
          onEvent: (event) => {
            handleVoicePackEvent(event);
            streamPlayback.handleEvent(event);
          }
        });
        setLatestTurn(turn);
        setTechnical(turn);
        setRunning(false);

        const correctionLevel = turn.correctionEvent?.correction ?? 0;
        streamPlayback.setCorrectionLevel(correctionLevel);
        const streamingVoiceStarted = streamPlayback.started();
        const audioUrl = turn.audio ? URL.createObjectURL(turn.audio.blob) : undefined;
        const appDecision = VOICE_AGENT_V2_DECIDE_APP_TURN({
          source: "voice",
          listenOn: true,
          speakOn: speakOnRef.current,
          freeChatOn: settingsRef.current.allowFreeChat,
          speakLevel: settingsRef.current.speakLevel,
          userText: "",
          aiText: turn.text,
          correctedText: turn.correctionEvent?.text || turn.text,
          correctionLevel,
          audioAvailable: Boolean(audioUrl)
        });
        setSignal(appDecision.signal);
        setRealtimeTextDraft("");
        responseTextRef.current = "";

        let playbackStarted: Promise<void> | null = null;
        let playbackDone: Promise<void> | null = null;
        if (!streamingVoiceStarted && appDecision.shouldAutoPlayAudio && audioUrl) {
          const playback = startAssistantAudioPlayback(audioUrl);
          playbackStarted = playback.started;
          playbackDone = playback.done;
        }
        if (playbackStarted) await playbackStarted;

        if (appDecision.assistantText || appDecision.shouldKeepAudioLink) {
          const assistantMessage: VoiceAgentChatMessage & { audioUrl?: string; correctionLevel?: number } = {
            id: createId(),
            role: "assistant",
            text: appDecision.assistantText || "Audio response",
            createdAt: new Date().toISOString(),
            audioUrl: appDecision.shouldKeepAudioLink ? audioUrl : undefined,
            correctionLevel
          };
          setMessages((current) => [...current, assistantMessage].slice(-40));
        }

        if (streamingVoiceStarted) {
          await streamPlayback.finish();
        } else if (playbackDone) {
          await playbackDone;
        }

        if (audioUrl && !appDecision.shouldKeepAudioLink) {
          URL.revokeObjectURL(audioUrl);
        }
        setPackConnectionState("listening");
        setSendActive(false);
        setSendStatusText("NOT SEND - listening for voice");
      }
    } catch (error) {
      setPackConnectionState("error");
      setTechnical({ status: "voice_pack_error", realtime: error instanceof Error ? error.message : String(error) });
      stopRealtime();
    } finally {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      listenLoopRef.current = false;
      setRunning(false);
      setListenOn(false);
      if (!stopListenRef.current) setPackConnectionState("idle");
      setSendActive(false);
      setSendStatusText("NOT SEND - listen off");
    }
  }

  function stopRealtime() {
    stopListenRef.current = true;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    audioPlayerRef.current?.pause();
    audioPlayerRef.current = null;
    streamAudioPlayerRef.current?.stop();
    streamAudioPlayerRef.current = null;
    appSpeakingRef.current = false;
    setPackConnectionState("idle");
    setSendActive(false);
    setSendStatusText("NOT SEND - listen off");
    setMicVoiceDetected(false);
    setRealtimeTextDraft("");
    responseTextRef.current = "";
    setListenOn(false);
  }

  function addVoiceEvent(type: string, event: unknown) {
    setVoiceEvents((current) => [{
      id: createId(),
      createdAt: new Date().toISOString(),
      type,
      event: summarizeVoicePackEvent(event)
    }, ...current].slice(0, 40));
  }

  function createVoiceStreamPlayback() {
    let context: AudioContext | null = null;
    let scheduledAt = 0;
    let decision: "waiting" | "play" | "drop" = VOICE_AGENT_V2_SHOULD_STREAM_AUDIO_IMMEDIATELY({
      freeChatOn: settingsRef.current.allowFreeChat,
      speakOn: speakOnRef.current
    }) ? "play" : "waiting";
    let didStart = false;
    let finished = false;
    let stopped = false;
    let finishTimer = 0;
    const pendingAudio: string[] = [];
    let resolveDone: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const controller = {
      handleEvent(event: VoiceAgentStreamVoiceTurnEvent) {
        if (stopped) return;
        const result = VOICE_AGENT_V2_REALTIME_EVENT_RESULT(event);
        if (result.correctionEvent && (!settingsRef.current.allowFreeChat || hasStandardLevelWord(result.correctionEvent.raw))) {
          controller.setCorrectionLevel(result.correctionEvent.correction);
        }
        if (event.type !== "audio_delta" || !event.audioBase64) return;
        if (decision === "play") {
          schedulePcm16Chunk(event.audioBase64);
          return;
        }
        if (decision === "waiting") pendingAudio.push(event.audioBase64);
      },
      setCorrectionLevel(level: number) {
        if (decision !== "waiting") return;
        if (!VOICE_AGENT_V2_SHOULD_SPEAK_LEVEL({
          correctionLevel: level,
          speakOn: speakOnRef.current,
          speakLevel: settingsRef.current.speakLevel
        })) {
          decision = "drop";
          pendingAudio.length = 0;
          if (finished) complete();
          return;
        }
        decision = "play";
        startPlaybackState();
        pendingAudio.splice(0).forEach(schedulePcm16Chunk);
      },
      started() {
        return didStart;
      },
      finish() {
        finished = true;
        if (decision === "waiting") {
          decision = "drop";
          pendingAudio.length = 0;
        }
        if (decision !== "play" || !didStart) {
          complete();
          return Promise.resolve();
        }
        scheduleCompleteWhenAudioEnds();
        return done;
      },
      stop() {
        stopped = true;
        pendingAudio.length = 0;
        window.clearTimeout(finishTimer);
        complete();
      }
    };

    streamAudioPlayerRef.current = controller;
    return controller;

    function startPlaybackState() {
      if (didStart) return;
      didStart = true;
      appSpeakingRef.current = true;
      setPackConnectionState("playing");
      setSendActive(false);
      setSendStatusText("NOT SEND - AI speaking");
    }

    function ensureContext() {
      if (context) return context;
      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Browser AudioContext is unavailable.");
      context = new AudioContextConstructor();
      scheduledAt = context.currentTime + 0.02;
      return context;
    }

    function schedulePcm16Chunk(audioBase64: string) {
      if (stopped) return;
      try {
        startPlaybackState();
        const audioContext = ensureContext();
        const samples = pcm16Base64ToFloat32(audioBase64);
        if (!samples.length) return;
        const buffer = audioContext.createBuffer(1, samples.length, 24000);
        buffer.copyToChannel(samples, 0);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        scheduledAt = Math.max(scheduledAt, audioContext.currentTime + 0.01);
        source.start(scheduledAt);
        scheduledAt += buffer.duration;
        if (finished) scheduleCompleteWhenAudioEnds();
      } catch (error) {
        setTechnical({ status: "audio_play_error", realtime: error instanceof Error ? error.message : String(error) });
        complete();
      }
    }

    function scheduleCompleteWhenAudioEnds() {
      if (!context) {
        complete();
        return;
      }
      window.clearTimeout(finishTimer);
      const remainingMs = Math.max(0, (scheduledAt - context.currentTime) * 1000) + 120;
      finishTimer = window.setTimeout(complete, remainingMs);
    }

    function complete() {
      if (streamAudioPlayerRef.current === controller) streamAudioPlayerRef.current = null;
      window.clearTimeout(finishTimer);
      appSpeakingRef.current = false;
      const audioContext = context;
      context = null;
      if (audioContext?.state !== "closed") void audioContext?.close().catch(() => undefined);
      resolveDone();
    }
  }

  function handleVoicePackEvent(event: unknown) {
    const result = VOICE_AGENT_V2_REALTIME_EVENT_RESULT(event);
    addVoiceEvent(result.type, event);
    if (result.correctionEvent && (!settingsRef.current.allowFreeChat || hasStandardLevelWord(result.correctionEvent.raw))) {
      setSignal(VOICE_AGENT_V2_SIGNAL(result.correctionEvent.correction));
    }
    if (result.error) setTechnical({ status: "voice_pack_error", realtime: result.error, event });
    if (result.textDelta) {
      responseTextRef.current = `${responseTextRef.current}${result.textDelta}`;
      if (!speakOnRef.current) setRealtimeTextDraft(responseTextRef.current);
    }
    if (result.textDone) {
      responseTextRef.current = result.textDone || responseTextRef.current;
      if (!speakOnRef.current) setRealtimeTextDraft(responseTextRef.current);
    }
  }

  async function playAssistantAudio(url: string, statusText = "NOT SEND - AI speaking") {
    const playback = startAssistantAudioPlayback(url, statusText);
    await playback.done;
  }

  function startAssistantAudioPlayback(url: string, statusText = "NOT SEND - AI speaking") {
    appSpeakingRef.current = true;
    setPackConnectionState("playing");
    setSendActive(false);
    setSendStatusText(statusText);
    const player = new Audio(url);
    audioPlayerRef.current = player;
    let startedResolved = false;
    let doneResolved = false;
    let resolveStarted: () => void = () => undefined;
    let resolveDone: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const markStarted = () => {
      if (startedResolved) return;
      startedResolved = true;
      resolveStarted();
    };
    const finish = () => {
      if (doneResolved) return;
      doneResolved = true;
      markStarted();
      if (audioPlayerRef.current === player) audioPlayerRef.current = null;
      appSpeakingRef.current = false;
      resolveDone();
    };
    player.onplaying = markStarted;
    player.onended = finish;
    player.onerror = finish;
    player.onpause = finish;
    void player.play()
      .then(markStarted)
      .catch((error) => {
        setTechnical({ status: "audio_play_error", realtime: error instanceof Error ? error.message : String(error) });
        finish();
      });
    return { started, done };
  }

  function toggleListen() {
    if (listenOn) {
      stopRealtime();
      return;
    }
    void startListen("ai");
  }

  function applyTurn(result: VoiceAgentV2TurnResult, userText: string) {
    const appDecision = VOICE_AGENT_V2_DECIDE_APP_TURN({
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
    setSignal(appDecision.signal);
    setTechnical(result);
    if (!result.chatMessage && !appDecision.assistantText) return;
    const assistantMessage = result.chatMessage || {
      id: createId(),
      role: "assistant" as const,
      text: appDecision.assistantText,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, {
      ...assistantMessage,
      text: appDecision.assistantText,
      audioUrl: appDecision.shouldKeepAudioLink ? result.audio?.url : undefined,
      correctionLevel: result.correctionLevel
    }].slice(-40));
    if (appDecision.shouldAutoPlayAudio && result.audio) void new Audio(result.audio.url).play().catch(() => undefined);
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
          {!settings.allowFreeChat && (
            <span className="signal-lamp-wrap" aria-live="polite">
              <span className={`signal-lamp ${signalClass(signal)}`} title={signal} />
            </span>
          )}
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
              <h2>Voice Pack Loop</h2>
              <SignalLine label="connection" active={packConnectionState === "listening" || packConnectionState === "sending" || packConnectionState === "playing"} value={packConnectionState} />
              <SignalLine label="local mic voice" active={micVoiceDetected} value={`${micVoiceDetected ? "voice/sound" : "no voice"} rms=${micLevel}`} />
              <ServerSendLamp active={sendActive} value={sendStatusText} />
              <SignalLine label="playback block" active={packConnectionState === "playing"} value={packConnectionState === "playing" ? "YES - pack capture blocked" : "NO"} />
              <pre>{JSON.stringify({
                mode: activeVoiceDestination === "server_roundtrip"
                  ? "browser microphone -> local VAD/prebuffer -> SEND only voice pack -> server audio roundtrip -> autoplay returned audio"
                  : "browser microphone -> local VAD/prebuffer -> SEND only voice pack -> AI voice turn stream",
                destination: activeVoiceDestination,
                roundtripEndpoint,
                connection: packConnectionState,
                mic: { rms: micLevel, voiceDetected: micVoiceDetected },
                send: { active: sendActive, text: sendStatusText },
                speakOn,
                textDraft: realtimeTextDraft,
                latestPack: latestPack ? { decision: latestPack.decision, debug: latestPack.debug } : null,
                latestTurn: latestTurn ? { status: latestTurn.status, text: latestTurn.text, correctionEvent: latestTurn.correctionEvent } : null,
                latestRoundtrip: latestRoundtrip ? { status: latestRoundtrip.status, debug: latestRoundtrip.debug } : null
              }, null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Audio Roundtrip Diagnostic</h2>
              <label className="field">
                <span>server roundtrip endpoint</span>
                <input value={roundtripEndpoint} onChange={(event) => setRoundtripEndpoint(event.target.value)} disabled={listenOn} />
              </label>
              <label className="field">
                <span>voice threshold</span>
                <input type="number" value={voiceThreshold} min={0.001} max={0.2} step={0.001} onChange={(event) => setVoiceThreshold(Number(event.target.value))} disabled={listenOn} />
              </label>
              <label className="field">
                <span>silence ms</span>
                <input type="number" value={silenceMs} min={200} step={50} onChange={(event) => setSilenceMs(Number(event.target.value))} disabled={listenOn} />
              </label>
              <label className="field">
                <span>max pack ms</span>
                <input type="number" value={maxSegmentMs} min={1000} step={500} onChange={(event) => setMaxSegmentMs(Number(event.target.value))} disabled={listenOn} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={recorderWhileListening} onChange={(event) => setRecorderWhileListening(event.target.checked)} disabled={listenOn} />
                <span>record while listening</span>
              </label>
              <button className="secondary-button" type="button" onClick={() => void startListen("server_roundtrip")} disabled={listenOn}>Start roundtrip</button>
            </section>
            <section className="method-panel">
              <h2>Latest V2 Result</h2>
              <pre>{JSON.stringify(technical || { status: "not run" }, null, 2)}</pre>
            </section>
            <section className="method-panel">
              <h2>Voice Pack Events</h2>
              <pre>{JSON.stringify(voiceEvents, null, 2)}</pre>
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

function hasStandardLevelWord(value: unknown): boolean {
  if (typeof value === "string") return /^\s*(signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge))\b/i.test(value);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return hasStandardLevelWord(record.text) || hasStandardLevelWord(record.chat_text_to_user) || hasStandardLevelWord(record.message);
}

function pcm16Base64ToFloat32(audioBase64: string) {
  const binary = atob(audioBase64);
  const sampleCount = Math.floor(binary.length / 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const value = (high << 8) | low;
    const signed = value >= 0x8000 ? value - 0x10000 : value;
    samples[index] = Math.max(-1, Math.min(1, signed / 0x8000));
  }
  return samples;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeVoicePackEvent(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (typeof item === "string" && (key.toLowerCase().includes("audio") || item.length > 500)) return `[string length=${item.length}]`;
    return item;
  }));
}
