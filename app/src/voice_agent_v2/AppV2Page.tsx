import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  VOICE_AGENT_V2_ANALYSE_AUDIO,
  VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT,
  VOICE_AGENT_V2_CREATE_PROMPTS,
  VOICE_AGENT_V2_CREATE_SETTINGS,
  VOICE_AGENT_V2_DEFAULT_SETTINGS,
  VOICE_AGENT_V2_OPEN_MICROPHONE,
  VOICE_AGENT_V2_SEND_TEXT,
  VOICE_AGENT_V2_TOPIC_PRESETS,
  VOICE_AGENT_V2_VISIBLE_HISTORY,
  type VoiceAgentV2Settings,
  type VoiceAgentV2Signal,
  type VoiceAgentV2TurnResult,
  type VoiceAgentV2VoiceSegment
} from ".";
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
  const [technical, setTechnical] = useState<VoiceAgentV2TurnResult | VoiceAgentV2VoiceSegment | { status: unknown } | null>(null);
  const [latestSegment, setLatestSegment] = useState<VoiceAgentV2VoiceSegment | null>(null);
  const messagesRef = useRef(messages);
  const settingsRef = useRef(settings);
  const speakOnRef = useRef(speakOn);
  const stopListenRef = useRef(false);
  const listenLoopRef = useRef(false);

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
      stopListenRef.current = true;
      messages.forEach((message) => {
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
      applyTurn(result);
    } finally {
      setRunning(false);
    }
  }

  async function startListen() {
    if (listenLoopRef.current) return;
    stopListenRef.current = false;
    listenLoopRef.current = true;
    setListenOn(true);
    const mic = await VOICE_AGENT_V2_OPEN_MICROPHONE();
    if (!mic.status.ok || !mic.stream) {
      setTechnical({ status: mic.status });
      listenLoopRef.current = false;
      setListenOn(false);
      return;
    }
    try {
      while (!stopListenRef.current) {
        setRunning(true);
        try {
          const segment = await VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT({
            stream: mic.stream,
            threshold: 0.025,
            silenceMs: 650,
            preBufferMs: 1000,
            recorderWhileListening: true,
            maxWaitMs: 8000,
            maxRecordMs: 6000,
            minVoiceMs: 180,
            shouldStop: () => stopListenRef.current
          });
          setTechnical(segment);
          setLatestSegment(segment);
          if (segment.decision === "send_voice_segment" && segment.audio) {
            const result = await VOICE_AGENT_V2_ANALYSE_AUDIO({
              settings: settingsRef.current,
              audio: segment.audio,
              visibleHistory: VOICE_AGENT_V2_VISIBLE_HISTORY(messagesRef.current),
              speakEnabled: speakOnRef.current
            });
            applyTurn(result);
          }
        } finally {
          setRunning(false);
        }
        await wait(150);
      }
    } finally {
      mic.stream.getTracks().forEach((track) => track.stop());
      listenLoopRef.current = false;
      setListenOn(false);
    }
  }

  function toggleListen() {
    if (listenOn) {
      stopListenRef.current = true;
      setListenOn(false);
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
              <h2>Latest Capture</h2>
              <pre>{JSON.stringify(latestSegment || { status: "not run" }, null, 2)}</pre>
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
