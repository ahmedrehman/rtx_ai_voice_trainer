import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, BookOpen, Bug, Database, FileAudio, Menu, MessageSquare, Mic, Server, Volume2, X } from "lucide-react";
import type { DebugPageDefinition } from "./debug_page_types";
import {
  SYSTEM_AUDIO_ENERGY_CHECK,
  SYSTEM_AUDIO_TO_SPEAKER,
  SYSTEM_AUDIO_TO_TEXT,
  SYSTEM_MEANINGFUL_AUDIO_CHUNK,
  SYSTEM_MICRO_TO_AUDIO,
  SYSTEM_TEXT_TO_AUDIO
} from "./lib_client_voice_system";
import { createLocalMemoryDataStore } from "./lib_data_store";
import type { DataStoreRecordType } from "./lib_data_store";
import { CLIENT_VOICE_SYSTEM_DEBUG_PAGES } from "./lib_client_voice_system_test";
import { DATA_STORE_DEBUG_PAGES } from "./lib_data_store_test";
import { SERVER_AI_VOICE_DEBUG_PAGES } from "./lib_server_ai_voice_test";
import { VOICE_AGENT_DEBUG_PAGES } from "./voice_agent_test";
import { AUDIO_ANALYSER_DEFAULT_PROMPTS, createAudioAnalyserDefaultPrompts } from "./lib_server_ai_voice/audioAnalyserPrompts";
import { AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS, createAudioTurnDefaultPrompts } from "./lib_server_ai_voice/audioTurnPrompts";
import {
  VOICE_AGENT_ANALYSE_AUDIO,
  VOICE_AGENT_DEFAULT_SETTINGS,
  VOICE_AGENT_CREATE_PROMPTS,
  VOICE_AGENT_CREATE_SETTINGS,
  VOICE_AGENT_PLAY_AUDIO,
  VOICE_AGENT_RECORD_CHUNK,
  VOICE_AGENT_SAMPLE_AUDIO_URL,
  VOICE_AGENT_SEND_TEXT_CHAT,
  VOICE_AGENT_STREAM_TEXT_CHAT,
  VOICE_AGENT_TOPIC_PRESETS,
  type VoiceAgentChatMessage,
  type VoiceAgentPromptConfig,
  type VoiceAgentSettings
} from "./voice_agent";
import "./styles.css";

type Page = Omit<DebugPageDefinition, "module"> & {
  module: DebugPageDefinition["module"] | "App" | "Debug";
  icon: React.ComponentType<{ size?: number }>;
};

type StackItem = {
  id: string;
  type: string;
  status: "running" | "ok" | "error";
  createdAt: string;
  business?: unknown;
  steps?: Array<{ label: string; state: "pending" | "running" | "done" | "error" | "not_implemented"; detail: string }>;
  input?: unknown;
  output?: unknown;
  error?: unknown;
};

const localDebugDataStore = createLocalMemoryDataStore();
const DEFAULT_TEST_AUDIO_URL = "/test-audio/sample-voice-test.wav";

const pages: Page[] = [
  { id: "APP_CHAT", title: "App", module: "App", role: "voice trainer chat with listen and speak controls", ready: true, inputs: [], actions: [], output: [], icon: MessageSquare },
  { id: "VOICE_AGENT_CONFIG", title: "Voice agent config", module: "App", role: "client topic and prompt configuration", ready: true, inputs: [], actions: [], output: [], icon: Server },
  { id: "APP_FULL_TEST", title: "Full app test", module: "Debug", role: "same app flow with full business/debug details", ready: true, inputs: [], actions: [], output: [], icon: Bug },
  ...VOICE_AGENT_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) })),
  ...CLIENT_VOICE_SYSTEM_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) })),
  ...SERVER_AI_VOICE_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) })),
  ...DATA_STORE_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) }))
];

function iconForPage(page: DebugPageDefinition) {
  if (page.id === "MICROPHONE_AUDIO_REQUIREMENTS") return BookOpen;
  if (page.module === "voice_agent_test") return MessageSquare;
  if (page.module === "lib_server_ai_voice_test") return Server;
  if (page.module === "lib_data_store_test") return page.id.includes("CLEAR") || page.id.includes("RESET") ? Archive : Database;
  if (page.id.includes("TEXT")) return FileAudio;
  if (page.id.includes("SPEAKER") || page.id.includes("AUDIO")) return Volume2;
  return Mic;
}

function App() {
  const [activePageId, setActivePageId] = useState("APP_CHAT");
  const [menuOpen, setMenuOpen] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [voiceAgentSettings, setVoiceAgentSettings] = useState<VoiceAgentSettings>(VOICE_AGENT_DEFAULT_SETTINGS);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];
  const debugGroups = useMemo(() => {
    return pages.filter((page) => page.module !== "App").reduce<Record<string, Page[]>>((result, page) => {
      result[page.module] = [...(result[page.module] || []), page];
      return result;
    }, {});
  }, []);
  const appPages = pages.filter((page) => page.module === "App");

  function selectPage(pageId: string) {
    setActivePageId(pageId);
    setMenuOpen(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="brand-mark">
          <span className="brand-dot" />
          <div>
            <strong>AI Voice Trainer</strong>
            <small>{activePage.module}</small>
          </div>
        </div>
      </header>

      <div className={menuOpen ? "scrim open" : "scrim"} onClick={() => setMenuOpen(false)} />

      <aside className={menuOpen ? "nav-panel open" : "nav-panel"} aria-label="Page navigation">
        <div className="nav-head">
          <div>
            <strong>Modules</strong>
            <small>Function pages</small>
          </div>
          <button className="close-button" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          <section>
            <h2>App</h2>
            {appPages.map((page) => {
              const Icon = page.icon;
              return (
                <button key={page.id} className={page.id === activePage.id ? "active" : ""} onClick={() => selectPage(page.id)}>
                  <Icon size={17} />
                  <span>{page.title}</span>
                </button>
              );
            })}
          </section>
          <section>
            <button className="nav-toggle" type="button" onClick={() => setDebugMenuOpen((current) => !current)}>
              <Bug size={17} />
              <span>Debug</span>
              <strong>{debugMenuOpen ? "hide" : "show"}</strong>
            </button>
            {debugMenuOpen && Object.entries(debugGroups).map(([group, items]) => (
                <details className="nav-submenu" key={group}>
                  <summary>{group}</summary>
                  {items.map((page) => {
                    const Icon = page.icon;
                    return (
                      <button key={page.id} className={page.id === activePage.id ? "active" : ""} onClick={() => selectPage(page.id)}>
                        <Icon size={17} />
                        <span>{page.title}</span>
                      </button>
                    );
                  })}
                </details>
              ))}
          </section>
        </nav>
      </aside>

      <section className="workspace">
        <PageView page={activePage} voiceAgentSettings={voiceAgentSettings} setVoiceAgentSettings={setVoiceAgentSettings} />
      </section>
    </main>
  );
}

function PageView({
  page,
  voiceAgentSettings,
  setVoiceAgentSettings
}: {
  page: Page;
  voiceAgentSettings: VoiceAgentSettings;
  setVoiceAgentSettings: React.Dispatch<React.SetStateAction<VoiceAgentSettings>>;
}) {
  const Icon = page.icon;
  if (page.id === "APP_CHAT") {
    return (
      <article className="page app-page">
        <AppVoiceExperience debug={false} settings={voiceAgentSettings} setSettings={setVoiceAgentSettings} />
      </article>
    );
  }
  return (
    <article className="page">
      <div className="page-kicker">
        <Icon size={18} />
        <span>{page.module}</span>
        <strong className={page.ready ? "ready" : "not-ready"}>{page.ready ? "ready" : "not ready"}</strong>
      </div>
      <h1>{page.title}</h1>
      <p>{page.role}</p>
      {page.id === "APP_FULL_TEST" && <AppVoiceExperience debug settings={voiceAgentSettings} setSettings={setVoiceAgentSettings} />}
      {page.id === "VOICE_AGENT_TEXT_CHAT_TEST" && <VoiceAgentTextChatTestPage settings={voiceAgentSettings} />}
      {page.id === "VOICE_AGENT_STREAM_TEXT_CHAT_TEST" && <VoiceAgentStreamTextChatTestPage settings={voiceAgentSettings} />}
      {page.id === "VOICE_AGENT_CONFIG" && <VoiceAgentConfigPage settings={voiceAgentSettings} setSettings={setVoiceAgentSettings} />}
      {page.id === "MICROPHONE_AUDIO_REQUIREMENTS" && <MicrophoneDocs />}
      {page.id === "SYSTEM_MEANINGFUL_AUDIO_CHUNK" && <MeaningfulAudioChunkDebug />}
      {page.id === "SYSTEM_AUDIO_ENERGY_CHECK" && <AudioEnergyCheckDebug />}
      {page.id === "SYSTEM_MICRO_TO_AUDIO" && <MicroToAudioDebug />}
      {page.id === "SYSTEM_AUDIO_TO_TEXT" && <AudioToTextDebug />}
      {page.id === "SYSTEM_TEXT_TO_AUDIO" && <TextToAudioDebug />}
      {page.id === "SYSTEM_AUDIO_TO_SPEAKER" && <AudioToSpeakerDebug />}
      {["PRIMITIVE_TEXT_TO_AUDIO", "PRIMITIVE_AUDIO_TO_TEXT", "AUDIO_TO_AI_TEXT_AND_AUDIO", "AUDIO_ANALYSER"].includes(page.id) && <ServerAiEndpointDebug key={page.id} methodId={page.id} />}
      {page.module === "lib_data_store_test" && <DataStoreMethodDebug key={page.id} methodId={page.id} />}
      {![
        "MICROPHONE_AUDIO_REQUIREMENTS",
        "APP_CHAT",
        "APP_FULL_TEST",
        "VOICE_AGENT_CONFIG",
        "VOICE_AGENT_TEXT_CHAT_TEST",
        "VOICE_AGENT_STREAM_TEXT_CHAT_TEST",
        "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
        "SYSTEM_AUDIO_ENERGY_CHECK",
        "SYSTEM_MICRO_TO_AUDIO",
        "SYSTEM_AUDIO_TO_TEXT",
        "SYSTEM_TEXT_TO_AUDIO",
        "SYSTEM_AUDIO_TO_SPEAKER",
        "PRIMITIVE_TEXT_TO_AUDIO",
        "PRIMITIVE_AUDIO_TO_TEXT",
        "AUDIO_TO_AI_TEXT_AND_AUDIO",
        "AUDIO_ANALYSER",
        "DATA_STORE_SAVE_EVENT",
        "DATA_STORE_LIST_EVENTS",
        "DATA_STORE_CLEAR_EVENTS",
        "DATA_STORE_SAVE_COST",
        "DATA_STORE_LIST_COSTS",
        "DATA_STORE_RESET_COSTS"
      ].includes(page.id) && <StaticPage page={page} />}
    </article>
  );
}

function AppVoiceExperience({
  debug,
  settings,
  setSettings
}: {
  debug: boolean;
  settings: VoiceAgentSettings;
  setSettings: React.Dispatch<React.SetStateAction<VoiceAgentSettings>>;
}) {
  const [messages, setMessages] = useState<VoiceAgentChatMessage[]>([
    { id: createId(), role: "assistant", text: `${settings.languageName} practice is ready.`, createdAt: new Date().toISOString() }
  ]);
  const [textUserChat, setTextUserChat] = useState("");
  const [listenEnabled, setListenEnabled] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastSignal, setLastSignal] = useState<{ type: "idle" | "improvement" | "error"; text: string }>({ type: "idle", text: "" });
  const [lastAudioUrl, setLastAudioUrl] = useState("");
  const stopListenRef = useRef(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  useEffect(() => {
    const message: VoiceAgentChatMessage = {
      id: createId(),
      role: "assistant",
      text: `${settings.languageName} practice is ready.`,
      createdAt: new Date().toISOString()
    };
    setMessages([message]);
    setLastSignal({ type: "idle", text: "" });
  }, [settings.topic, settings.languageName]);

  async function runWithSampleAudio() {
    const response = await fetch(VOICE_AGENT_SAMPLE_AUDIO_URL);
    const audio = await response.blob();
    await analyseAudio(audio, "sample audio file");
  }

  async function sendTextChat() {
    const userText = textUserChat.trim();
    if (!userText || running) return;
    const userMessage: VoiceAgentChatMessage = { id: createId(), role: "user", text: userText, createdAt: new Date().toISOString() };
    const history = [...messages, userMessage].slice(-5).map((message) => `${message.role}: ${message.text}`);
    setMessages((current) => [...current, userMessage].slice(-30));
    setTextUserChat("");
    setRunning(true);
    setLastSignal({ type: "idle", text: "" });
    const id = debug ? pushStack({
      type: "VOICE_AGENT_TEXT_CHAT",
      status: "running",
      input: { settings, textUserChat: userText, history5LastTextChats: history, speakEnabled },
      steps: [
        { label: "Build text request", state: "done", detail: "Typed chat text, topic, prompts, history, and speak toggle are captured." },
        { label: "Call VOICE_AGENT_TEXT_CHAT", state: "running", detail: "POST /api/voice-agent/text-chat is in progress." },
        { label: "Evaluate answer", state: "pending", detail: "Waiting for JSON chat result." }
      ]
    }) : "";

    try {
      const result = await VOICE_AGENT_SEND_TEXT_CHAT({
        settings,
        textUserChat: userText,
        history5LastTextChats: history,
        speakEnabled
      });
      const assistantMessage = result.chatMessage;
      if (assistantMessage) setMessages((current) => [...current, assistantMessage].slice(-30));
      const resultJson = isVoiceAgentTextChatResponse(result.response) ? result.response.json : null;
      if (result.status.ok && resultJson?.flags.has_corrections) {
        setLastSignal({ type: "improvement", text: `Improvement: ${resultJson.flags.correction_type}` });
      } else if (result.status.ok) {
        setLastSignal({ type: "idle", text: "" });
      } else {
        setLastSignal({ type: "error", text: result.status.error || "Text chat failed" });
      }
      if (speakEnabled && result.audio) {
        const playResult = await VOICE_AGENT_PLAY_AUDIO({}, result.audio);
        if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
        setLastAudioUrl(URL.createObjectURL(base64ToBlob(result.audio.audioBase64, result.audio.audioFormat)));
        if (!playResult.played) setLastSignal({ type: "error", text: "Audio returned, but browser playback failed" });
      }
      if (debug && id) {
        updateStack(id, {
          status: result.status.ok ? "ok" : "error",
          steps: [
            { label: "Build text request", state: "done", detail: "Typed chat text, topic, prompts, history, and speak toggle are captured." },
            { label: "Call VOICE_AGENT_TEXT_CHAT", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Server returned a text-chat result." : String(result.status.error || "Text chat failed.") },
            { label: `Business result: ${result.status.ok ? resultJson?.flags.has_corrections ? "IMPROVEMENT" : "ANSWER" : "ERROR"}`, state: result.status.ok ? "done" : "error", detail: result.status.ok ? (resultJson?.chat_text_to_user || "Answer returned.") : String(result.status.error || "Text chat failed.") }
          ],
          output: result,
          error: result.status.error
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastSignal({ type: "error", text: message });
      if (debug && id) updateStack(id, { status: "error", steps: [{ label: "Run text chat", state: "error", detail: message }], error: message });
    } finally {
      setRunning(false);
    }
  }

  async function analyseAudio(audio: Blob, source: string) {
    const userText = textUserChat.trim();
    if (userText) {
      const message: VoiceAgentChatMessage = { id: createId(), role: "user", text: userText, createdAt: new Date().toISOString() };
      setMessages((current) => [...current, message].slice(-30));
      setTextUserChat("");
    }

    const input = {
      settings,
      audio: { size: audio.size, type: audio.type, source },
      textUserChat: userText,
      history5LastTextChats: messages.slice(-5).map((message) => `${message.role}: ${message.text}`),
      speakEnabled,
      keywordOn: settings.keywordOn,
      keywordOff: settings.keywordOff
    };
    const id = pushStack({
      type: "VOICE_AGENT_APP_FLOW",
      status: "running",
      input,
      steps: [
        { label: "Capture app input", state: "done", detail: "Chat text, audio, topic, and keywords captured from client state." },
        { label: "Call voice_agent frontend", state: "running", detail: "VOICE_AGENT_ANALYSE_AUDIO will call /api/audio-analyser." },
        { label: "Evaluate method status", state: "pending", detail: "Waiting for AUDIO_ANALYSER response." },
        { label: "Speak response", state: speakEnabled ? "pending" : "done", detail: speakEnabled ? "Waiting for AI audio." : "Speak toggle is off." }
      ]
    });

    setRunning(true);
    try {
      const result = await VOICE_AGENT_ANALYSE_AUDIO({
        settings,
        audio,
        textUserChat: userText,
        history5LastTextChats: messages.slice(-5).map((message) => `${message.role}: ${message.text}`)
      });
      if (result.chatMessage) setMessages((current) => [...current, result.chatMessage as VoiceAgentChatMessage].slice(-30));
      const resultJson = isAudioAnalyserResponse(result.response) ? result.response.json : null;
      if (result.status.ok && resultJson?.flags.has_corrections) {
        setLastSignal({ type: "improvement", text: `Improvement: ${resultJson.flags.correction_type}` });
      } else if (result.status.ok) {
        setLastSignal({ type: "idle", text: "" });
      } else {
        setLastSignal({ type: "error", text: result.status.error || "Audio analysis failed" });
      }
      let played = false;
      if (speakEnabled && result.audio) {
        const playResult = await VOICE_AGENT_PLAY_AUDIO({}, result.audio);
        played = playResult.played;
        if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
        const nextAudioUrl = URL.createObjectURL(base64ToBlob(result.audio.audioBase64, result.audio.audioFormat));
        setLastAudioUrl(nextAudioUrl);
      }
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        steps: [
          { label: "Capture app input", state: "done", detail: "Chat text, audio, topic, and keywords captured from client state." },
          { label: "Call voice_agent frontend", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "AUDIO_ANALYSER returned ok." : String(result.status.error || "AUDIO_ANALYSER failed.") },
          { label: `Business decision: response usable? ${result.status.ok ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Chat response can be shown." : String(result.status.error || "No usable response.") },
          { label: "Speak response", state: speakEnabled ? played ? "done" : result.audio ? "error" : "not_implemented" : "done", detail: speakEnabled ? played ? "AI audio played." : result.audio ? "AI audio existed but playback failed." : "No AI audio returned." : "Speak toggle is off." }
        ],
        output: result,
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        steps: [{ label: "Run app flow", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  async function startListenLoop() {
    stopListenRef.current = false;
    setListenEnabled(true);
    while (!stopListenRef.current) {
      const id = pushStack({
        type: "VOICE_AGENT_LISTEN_LOOP",
        status: "running",
        input: { settings, chunkMs: 5000, keywordOn: settings.keywordOn, keywordOff: settings.keywordOff },
        steps: [
          { label: "Listen toggle", state: "done", detail: "Listen is on." },
          { label: "Record chunk", state: "running", detail: "VOICE_AGENT_RECORD_CHUNK is recording microphone audio." },
          { label: "Decide useful chunk", state: "pending", detail: "Waiting for chunk result." },
          { label: "Send to AUDIO_ANALYSER", state: "pending", detail: "Only useful chunks are sent." }
        ]
      });
      const chunkResult = await VOICE_AGENT_RECORD_CHUNK({}, {
        maxDurationMs: 5000,
        silenceMs: 900,
        speechCheckLang: settings.languageName === "French" ? "fr-FR" : "en-US",
        chunkDecisionMode: "auto",
        energyThreshold: 0.035,
        minEnergyActiveMs: 250
      });
      updateStack(id, {
        status: chunkResult.chunk.status.ok ? "ok" : "error",
        steps: [
          { label: "Listen toggle", state: "done", detail: stopListenRef.current ? "Listen is stopping." : "Listen is on." },
          { label: "Record chunk", state: chunkResult.chunk.status.ok ? "done" : "error", detail: chunkResult.chunk.status.ok ? "Audio chunk recorded." : String(chunkResult.chunk.status.error || "Chunk failed.") },
          { label: `Decide useful chunk: ${chunkResult.useful ? "YES" : "NO"}`, state: chunkResult.chunk.status.ok ? "done" : "error", detail: chunkResult.reason },
          { label: "Send to AUDIO_ANALYSER", state: chunkResult.useful ? "done" : "done", detail: chunkResult.useful ? "Chunk will be sent." : "Chunk skipped." }
        ],
        output: {
          status: chunkResult.chunk.status,
          useful: chunkResult.useful,
          reason: chunkResult.reason,
          audio: chunkResult.chunk.audio ? { size: chunkResult.chunk.audio.size, type: chunkResult.chunk.audio.type } : null,
          browserSpeechText: chunkResult.chunk.browserSpeechText || "",
          energyCheck: chunkResult.chunk.energyCheck
        },
        error: chunkResult.chunk.status.error
      });
      if (chunkResult.useful && chunkResult.chunk.audio) await analyseAudio(chunkResult.chunk.audio, "microphone chunk");
      await wait(150);
    }
    setListenEnabled(false);
  }

  function toggleListen() {
    if (listenEnabled) {
      stopListenRef.current = true;
      setListenEnabled(false);
      return;
    }
    void startListenLoop();
  }

  return (
    <section className={debug ? "voice-app debug-version" : "voice-app"}>
      <div className="chat-shell">
        <div className="chat-toolbar">
          <label className="topic-select">
            <span>Topic</span>
            <select value={settings.topicId} onChange={(event) => setSettings((current) => VOICE_AGENT_CREATE_SETTINGS(event.target.value as VoiceAgentSettings["topicId"], current))}>
              {VOICE_AGENT_TOPIC_PRESETS.map((topic) => <option value={topic.id} key={topic.id}>{topic.label}</option>)}
            </select>
          </label>
          <button className={listenEnabled ? "toggle active" : "toggle"} type="button" onClick={toggleListen}>
            <Mic size={17} />
            <span>{listenEnabled ? "Listening" : "Listen"}</span>
          </button>
          <button className={speakEnabled ? "toggle active" : "toggle"} type="button" onClick={() => setSpeakEnabled((current) => !current)}>
            <Volume2 size={17} />
            <span>{speakEnabled ? "Speak on" : "Speak off"}</span>
          </button>
          {debug && <span className="topic-pill">{settings.topic}</span>}
          {debug && <span className="topic-pill">on: {settings.keywordOn}</span>}
          {debug && <span className="topic-pill">off: {settings.keywordOff}</span>}
          <span className="signal-lamp-wrap" aria-live="polite">
            <span className={`signal-lamp ${lastSignal.type}`} title={lastSignal.text || "No issue"} />
          </span>
        </div>

        <div className="chat-window">
          {messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <span>{message.role}</span>
              <p>{message.text}</p>
            </article>
          ))}
        </div>

        {lastAudioUrl && <audio controls src={lastAudioUrl} />}

        <div className="chat-composer">
          <textarea value={textUserChat} onChange={(event) => setTextUserChat(event.target.value)} rows={2} placeholder="Type a message..." />
          <button className="run-button" type="button" onClick={() => void sendTextChat()} disabled={running || !textUserChat.trim()}>
            {running ? "Sending..." : "Send"}
          </button>
          {debug && (
            <button className="secondary-button" type="button" onClick={() => void runWithSampleAudio()} disabled={running}>
              Test with sample audio
            </button>
          )}
        </div>
      </div>

      {debug && (
        <section className="debug-method">
          <div className="explain">
            <h2>Full App Test</h2>
            <ul>
              <li>Same voice_agent methods as the app page.</li>
              <li>Listen toggle records microphone chunks and sends useful chunks to AUDIO_ANALYSER.</li>
              <li>Sample audio button uses the bundled audio file instead of microphone.</li>
              <li>Speak toggle plays returned AI audio when available.</li>
            </ul>
          </div>
          {stack.length === 0 ? <p>No app flow run yet.</p> : stack.map((item) => <StackArticle item={item} key={item.id} />)}
        </section>
      )}
    </section>
  );
}

function isAudioAnalyserResponse(value: unknown): value is { json: { flags: { has_corrections: boolean; correction_type: string }; chat_text_to_user: string } } {
  return Boolean(value && typeof value === "object" && "json" in value);
}

function isVoiceAgentTextChatResponse(value: unknown): value is { json: { flags: { has_corrections: boolean; correction_type: string }; chat_text_to_user: string } } {
  return Boolean(value && typeof value === "object" && "json" in value);
}

function safeJsonArray(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((item) => typeof item === "string" ? item : JSON.stringify(item)).slice(-5) : [];
  } catch {
    return [];
  }
}

function VoiceAgentTextChatTestPage({ settings }: { settings: VoiceAgentSettings }) {
  const [textUserChat, setTextUserChat] = useState("Bonjour, je veux pratiquer le francais.");
  const [historyText, setHistoryText] = useState("[]");
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const prompts = VOICE_AGENT_CREATE_PROMPTS(settings);
  const { stack, pushStack, updateStack } = useDebugStack();
  const [running, setRunning] = useState(false);

  async function runTextChatTest() {
    const history = safeJsonArray(historyText);
    const input = {
      settings,
      textUserChat,
      history5LastTextChats: history,
      speakEnabled,
      promptConfig: prompts
    };
    const id = pushStack({
      type: "VOICE_AGENT_TEXT_CHAT",
      status: "running",
      input,
      steps: [
        { label: "Build request", state: "done", detail: "Text, topic settings, history, prompts, and speak toggle are visible on this page." },
        { label: "Call server endpoint", state: "running", detail: "POST /api/voice-agent/text-chat." },
        { label: "Read output JSON", state: "pending", detail: "Waiting for flags, chat_text_to_user, text_corrected, and hint." }
      ]
    });
    setRunning(true);
    try {
      const result = await VOICE_AGENT_SEND_TEXT_CHAT({
        settings,
        textUserChat,
        history5LastTextChats: history,
        speakEnabled
      });
      const responseJson = isVoiceAgentTextChatResponse(result.response) ? result.response.json : null;
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        steps: [
          { label: "Build request", state: "done", detail: "Text, topic settings, history, prompts, and speak toggle are visible on this page." },
          { label: "Call server endpoint", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Server returned status ok." : String(result.status.error || "Request failed.") },
          { label: `Business result: ${result.status.ok ? responseJson?.flags.has_corrections ? "HAS IMPROVEMENT" : "ANSWER ONLY" : "ERROR"}`, state: result.status.ok ? "done" : "error", detail: result.status.ok ? (responseJson?.chat_text_to_user || "No chat text returned.") : String(result.status.error || "Text chat failed.") }
        ],
        output: result,
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        steps: [{ label: "Run text-chat test", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Inputs</h2>
          <label className="field"><span>textUserChat</span><textarea value={textUserChat} onChange={(event) => setTextUserChat(event.target.value)} rows={4} /><small>Typed user message. No microphone audio is used in this method.</small></label>
          <label className="field"><span>history5LastTextChats</span><textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} rows={4} /><small>JSON array of previous text chat messages.</small></label>
          <label className="check-row"><input type="checkbox" checked={speakEnabled} onChange={(event) => setSpeakEnabled(event.target.checked)} /> <span>also return spoken audio from chat_text_to_user</span></label>
          <button className="run-button" type="button" onClick={() => void runTextChatTest()} disabled={running || !textUserChat.trim()}>{running ? "Running..." : "Run text chat"}</button>
        </section>
        <section className="method-panel">
          <h2>Prompts Sent</h2>
          <label className="field"><span>systemPrompt</span><textarea value={prompts.systemPrompt} readOnly rows={5} /></label>
          <label className="field"><span>task</span><textarea value={prompts.task} readOnly rows={8} /></label>
          <label className="field"><span>howToRespond</span><textarea value={prompts.howToRespond} readOnly rows={4} /></label>
          <label className="field"><span>responseJsonFormat</span><textarea value={prompts.responseJsonFormat} readOnly rows={8} /></label>
        </section>
      </div>
      {stack.length === 0 ? <p>No text-chat test run yet.</p> : stack.map((item) => <StackArticle item={item} key={item.id} />)}
    </section>
  );
}

function VoiceAgentStreamTextChatTestPage({ settings }: { settings: VoiceAgentSettings }) {
  const [textUserChat, setTextUserChat] = useState("Bonjour, je veux pratiquer le francais.");
  const [historyText, setHistoryText] = useState("[]");
  const [streamText, setStreamText] = useState("");
  const [running, setRunning] = useState(false);
  const prompts = VOICE_AGENT_CREATE_PROMPTS(settings);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runStreamTextChatTest() {
    const history = safeJsonArray(historyText);
    const input = {
      endpoint: "/api/voice-agent/text-chat-stream",
      methodId: "VOICE_AGENT_STREAM_TEXT_CHAT",
      settings,
      textUserChat,
      history5LastTextChats: history,
      promptConfig: prompts
    };
    setStreamText("");
    const id = pushStack({
      type: "VOICE_AGENT_STREAM_TEXT_CHAT",
      status: "running",
      input,
      steps: [
        { label: "Build request", state: "done", detail: "Text, topic settings, history, and prompt config are visible on this page." },
        { label: "Call stream endpoint", state: "running", detail: "POST /api/voice-agent/text-chat-stream." },
        { label: "Read stream events", state: "pending", detail: "Waiting for start, delta, and done/error events." }
      ]
    });
    setRunning(true);
    try {
      const result = await VOICE_AGENT_STREAM_TEXT_CHAT({
        settings,
        textUserChat,
        history5LastTextChats: history,
        onEvent: (event) => {
          if (event.type === "delta") setStreamText((current) => `${current}${event.text}`);
        }
      });
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        steps: [
          { label: "Build request", state: "done", detail: "Text, topic settings, history, and prompt config are visible on this page." },
          { label: "Call stream endpoint", state: result.events.some((event) => event.type === "start") ? "done" : "error", detail: result.events.some((event) => event.type === "start") ? "Server started streaming." : "No stream start event received." },
          { label: "Read delta events", state: result.text ? "done" : result.status.ok ? "done" : "error", detail: result.text ? `Received ${result.text.length} characters.` : "No text delta received." },
          { label: "Business result: streamed answer", state: result.status.ok ? "done" : "error", detail: result.status.ok ? result.text : String(result.status.error || "Stream failed.") }
        ],
        output: result,
        error: result.status.error
      });
      setStreamText(result.text);
    } catch (error) {
      updateStack(id, {
        status: "error",
        steps: [{ label: "Run streaming text-chat test", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Inputs</h2>
          <label className="field"><span>textUserChat</span><textarea value={textUserChat} onChange={(event) => setTextUserChat(event.target.value)} rows={4} /><small>Latest typed user message. This method streams plain text only.</small></label>
          <label className="field"><span>history5LastTextChats</span><textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} rows={4} /><small>JSON array of previous text chat messages. Context only.</small></label>
          <button className="run-button" type="button" onClick={() => void runStreamTextChatTest()} disabled={running || !textUserChat.trim()}>{running ? "Streaming..." : "Run streaming text chat"}</button>
        </section>
        <section className="method-panel">
          <h2>Prompt Inputs</h2>
          <label className="field"><span>topic</span><input value={settings.topic} readOnly /></label>
          <label className="field"><span>languageName</span><input value={settings.languageName} readOnly /></label>
          <label className="field"><span>howToRespond</span><textarea value={prompts.howToRespond} readOnly rows={4} /></label>
          <small>The exact stream prompt sent by the server is shown in the start event under Real output / response.</small>
        </section>
      </div>
      <section className="method-panel">
        <h2>Streamed answer</h2>
        <div className="chat-window compact">{streamText || "No stream text yet."}</div>
      </section>
      {stack.length === 0 ? <p>No streaming text-chat test run yet.</p> : stack.map((item) => <StackArticle item={item} key={item.id} />)}
    </section>
  );
}

function VoiceAgentConfigPage({
  settings,
  setSettings
}: {
  settings: VoiceAgentSettings;
  setSettings: React.Dispatch<React.SetStateAction<VoiceAgentSettings>>;
}) {
  const prompts = settings.prompts || VOICE_AGENT_CREATE_PROMPTS(settings);

  function updatePrompts(patch: Partial<VoiceAgentPromptConfig>) {
    setSettings((current) => ({ ...current, prompts: { ...VOICE_AGENT_CREATE_PROMPTS(current), ...current.prompts, ...patch } }));
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Client Config</h2>
          <label className="field">
            <span>topic</span>
            <select value={settings.topicId} onChange={(event) => setSettings((current) => VOICE_AGENT_CREATE_SETTINGS(event.target.value as VoiceAgentSettings["topicId"], current))}>
              {VOICE_AGENT_TOPIC_PRESETS.map((topic) => <option value={topic.id} key={topic.id}>{topic.label}</option>)}
            </select>
            <small>Client chooses the topic. Topic changes default prompts.</small>
          </label>
          <label className="field"><span>languageName</span><input value={settings.languageName} onChange={(event) => setSettings((current) => ({ ...current, languageName: event.target.value }))} /><small>Language/topic hint sent with voice_agent settings.</small></label>
          <label className="field"><span>keywordOn</span><input value={settings.keywordOn} onChange={(event) => setSettings((current) => ({ ...current, keywordOn: event.target.value, prompts: undefined }))} /><small>Exact keyword to start/respond.</small></label>
          <label className="field"><span>keywordOff</span><input value={settings.keywordOff} onChange={(event) => setSettings((current) => ({ ...current, keywordOff: event.target.value, prompts: undefined }))} /><small>Exact keyword to stop/silence.</small></label>
          <label className="field"><span>voice</span><input value={settings.voice} onChange={(event) => setSettings((current) => ({ ...current, voice: event.target.value }))} /><small>AI voice name.</small></label>
          <button className="secondary-button" type="button" onClick={() => setSettings((current) => ({ ...current, prompts: undefined }))}>Reset prompts from topic</button>
        </section>
        <section className="method-panel">
          <h2>Prompt Editors</h2>
          <label className="field"><span>systemPrompt</span><textarea value={prompts.systemPrompt} onChange={(event) => updatePrompts({ systemPrompt: event.target.value })} rows={5} /><small>Core role prompt sent through voice_agent.</small></label>
          <label className="field"><span>task</span><textarea value={prompts.task} onChange={(event) => updatePrompts({ task: event.target.value })} rows={8} /><small>Topic/business task prompt.</small></label>
          <label className="field"><span>howToRespond</span><textarea value={prompts.howToRespond} onChange={(event) => updatePrompts({ howToRespond: event.target.value })} rows={4} /><small>Response behavior prompt.</small></label>
          <label className="field"><span>responseJsonFormat</span><textarea value={prompts.responseJsonFormat} onChange={(event) => updatePrompts({ responseJsonFormat: event.target.value })} rows={8} /><small>Required JSON shape.</small></label>
        </section>
      </div>
    </section>
  );
}

function MeaningfulAudioChunkDebug() {
  const [maxDurationMs, setMaxDurationMs] = useState(5000);
  const [speechResultIdleMs, setSpeechResultIdleMs] = useState(900);
  const [speechCheckLang, setSpeechCheckLang] = useState("fr-FR");
  const [chunkDecisionMode, setChunkDecisionMode] = useState<"auto" | "browser_speech_text" | "audio_energy">("auto");
  const [energyThreshold, setEnergyThreshold] = useState(0.035);
  const [minEnergyActiveMs, setMinEnergyActiveMs] = useState(250);
  const [mimeType, setMimeType] = useState("");
  const [running, setRunning] = useState(false);
  const [listenerState, setListenerState] = useState<"idle" | "listening" | "ended" | "error">("idle");
  const stopRequestedRef = useRef(false);
  const [session, setSession] = useState({ active: false, chunks: 0, endedReason: "not started" });
  const [audioUrl, setAudioUrl] = useState("");
  const [stack, setStack] = useState<StackItem[]>([]);
  const latestBusiness = [...stack].reverse().find((item) => item.business)?.business as Record<string, unknown> | undefined;
  const methodRuns = stack.filter((item) => item.type === "SYSTEM_MEANINGFUL_AUDIO_CHUNK");
  const technicalLogs = stack.filter((item) => item.type !== "SYSTEM_MEANINGFUL_AUDIO_CHUNK");

  function pushStack(item: Omit<StackItem, "id" | "createdAt">) {
    const next = { id: createId(), createdAt: new Date().toISOString(), ...item };
    setStack((current) => [...current, next].slice(-30));
    return next.id;
  }

  function updateStack(id: string, patch: Partial<StackItem>) {
    setStack((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function runAudioChunk(runMode: "single" | "loop" = "single") {
    const input = {
      maxDurationMs,
      speechResultIdleMs,
      speechCheckLang,
      chunkDecisionMode,
      energyThreshold,
      minEnergyActiveMs,
      mimeType: mimeType || undefined,
      runMode,
      browserNeeds: {
        secureContext: window.isSecureContext,
        getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        speechRecognitionChecker: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
        audioEnergyCheckImplemented: true,
        realAudioSilenceDetectionImplemented: false,
        microphoneVolumeDetectionImplemented: false,
        voiceActivityDetectionImplemented: false,
        directUserClick: true,
        requestedMedia: { audio: true, video: false }
      }
    };
    const steps: StackItem["steps"] = [
      { label: "Create input object", state: "done", detail: "Input values captured from page." },
      { label: "Request microphone", state: "running", detail: "Browser will ask/allow microphone. Request is audio only, video false." },
      { label: "Start recorder", state: "pending", detail: "MediaRecorder has not started yet." },
      { label: "Speech helper", state: "pending", detail: "Browser SpeechRecognition may start if available." },
      { label: "Audio energy check", state: "pending", detail: "SYSTEM_AUDIO_ENERGY_CHECK will measure RMS energy during recording." },
      { label: "Real VAD", state: "not_implemented", detail: "Not implemented. No WebRTC VAD or ML VAD exists yet." },
      { label: "Stop recording", state: "pending", detail: "Not stopped yet." },
      { label: "Decide chunk", state: "pending", detail: "No chunk decision yet." }
    ];
    const id = pushStack({
      type: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
      status: "running",
      steps,
      input
    });

    setRunning(true);
    setListenerState("listening");
    try {
      const result = await SYSTEM_MEANINGFUL_AUDIO_CHUNK(
        {
          logger: (event) => {
            pushStack({
              type: "library-log",
              status: event.level === "error" ? "error" : "ok",
              output: event
            });
          }
        },
        {
          maxDurationMs,
          silenceMs: speechResultIdleMs,
          speechCheckLang,
          chunkDecisionMode,
          energyThreshold,
          minEnergyActiveMs,
          mimeType: mimeType || undefined
        }
      );

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = result.audio ? URL.createObjectURL(result.audio) : "";
      const speechCheckerAvailable = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
      const speechFound = Boolean(result.browserSpeechText?.trim());
      const energyFound = Boolean(result.energyCheck.hasSound);
      const actualDecisionMode = chunkDecisionMode === "auto"
        ? (speechCheckerAvailable ? "browser_speech_text" : "audio_energy")
        : chunkDecisionMode;
      const speechConfirmedForDecision = actualDecisionMode === "browser_speech_text" ? speechFound : energyFound;
      const audioRecorded = Boolean(result.audio && result.audio.size > 0);
      const stoppedBecauseMaxDuration = result.chunkReason === "max_duration" || result.chunkReason === "no_speech_checker";
      const usefulChunk = audioRecorded && speechConfirmedForDecision;
      const usefulChunkReason = usefulChunk
        ? `USEFUL: audio was recorded and ${actualDecisionMode === "browser_speech_text" ? "the browser speech helper returned text" : "the audio energy check crossed the threshold"}.`
        : audioRecorded
          ? `NOT USEFUL: audio was recorded, but the selected decision method (${actualDecisionMode}) did not confirm speech/sound. This chunk is skipped for AI.`
          : "NOT USEFUL: no audio chunk was produced.";
      const business = {
        method: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
        business_target: "LISTENING TO VOICE",
        BUSINESS_DECISION_USEFUL_CHUNK: usefulChunk ? "YES" : "NO",
        business_decision: usefulChunk ? "USEFUL_CHUNK" : "NOT_USEFUL_CHUNK",
        business_reason: usefulChunkReason,
        send_to_ai: usefulChunk ? "NO_NOT_IMPLEMENTED_ON_THIS_PAGE" : "NO_SKIP_NOT_USEFUL",
        configured_decision_mode: chunkDecisionMode,
        actual_decision_mode_used: actualDecisionMode,
        this_function_role: "browser microphone chunk recorder plus optional browser speech helper",
        recording_active: runMode === "loop" && !stopRequestedRef.current,
        chunk_duration_target_ms: maxDurationMs,
        repeating_chunks_until_stop: runMode === "loop",
        did_check_for_speech: speechCheckerAvailable,
        how_speech_was_checked: speechCheckerAvailable ? "browser SpeechRecognition helper" : "not checked; browser helper unavailable",
        did_find_speech: speechFound,
        found_text: result.browserSpeechText || "",
        did_check_audio_energy: result.energyCheck.available,
        audio_energy_found_sound: energyFound,
        audio_energy_check: result.energyCheck,
        speech_check_language_requested: speechCheckLang,
        speech_language_warning: speechFound ? "Browser helper text depends on speechCheckLang. If you spoke another language, this text can be wrong." : "",
        did_record_audio_chunk: audioRecorded,
        did_skip_chunk: !usefulChunk,
        chunk_accepted_for_next_step: usefulChunk,
        chunk_sent_to_ai: false,
        ai_function_name: "AUDIO_ANALYSER",
        ai_send_status: usefulChunk ? "SKIPPED_NOT_IMPLEMENTED_ON_THIS_PAGE" : "SKIPPED_NOT_USEFUL_CHUNK",
        why_stopped: humanChunkReason(result.chunkReason),
        what_this_means: usefulChunk
          ? `Selected decision mode (${actualDecisionMode}) confirmed the chunk is useful.`
          : speechFound
            ? "Browser helper returned text, but the selected decision mode did not accept the chunk."
          : stoppedBecauseMaxDuration
            ? "No speech text was detected by the browser helper. Recording stopped by time limit. This is NOT a useful chunk for AI."
            : "Audio chunk was recorded, but usefulness depends on confirmed speech.",
        next_step_allowed: usefulChunk,
        next_step_warning: usefulChunk ? "Next method could send this audio chunk to AI, but that is NOT done by this function." : "Do not send to AI by default. Speech was not confirmed."
      };
      const outputSteps: StackItem["steps"] = [
        { label: "Create input object", state: "done", detail: "Input values captured from page." },
        { label: "Request microphone", state: result.status.ok ? "done" : "error", detail: "Requested audio only. No camera requested." },
        { label: `Record audio blob: ${audioRecorded ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: audioRecorded ? "MediaRecorder produced an audio blob." : "No audio blob was produced." },
        {
          label: "Speech helper",
          state: speechCheckerAvailable ? "done" : "not_implemented",
          detail: speechCheckerAvailable
            ? speechFound
              ? "Browser SpeechRecognition produced helper text."
              : "Browser SpeechRecognition was available but produced no helper text."
            : "Browser SpeechRecognition was unavailable."
        },
        {
          label: "Audio energy check",
          state: result.energyCheck.available ? "done" : "not_implemented",
          detail: result.energyCheck.available
            ? `SYSTEM_AUDIO_ENERGY_CHECK: maxRms ${result.energyCheck.maxRms}, active ${result.energyCheck.activeMs}ms, threshold ${result.energyCheck.threshold}, required ${result.energyCheck.minActiveMs}ms.`
            : `SYSTEM_AUDIO_ENERGY_CHECK unavailable. ${result.energyCheck.error || ""}`
        },
        { label: "Real VAD", state: "not_implemented", detail: "Not implemented. WebRTC VAD / ML VAD is not wired yet." },
        { label: "Stop recording", state: "done", detail: humanChunkReason(result.chunkReason) },
        {
          label: `Business decision: useful chunk? ${usefulChunk ? "YES" : "NO"}`,
          state: result.status.ok ? "done" : "error",
          detail: usefulChunk ? `YES. Decision method ${actualDecisionMode} confirmed the chunk.` : usefulChunkReason
        }
      ];
      setAudioUrl(nextUrl);
      setListenerState("ended");
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        steps: outputSteps,
        output: {
          status: result.status,
          audio: result.audio ? {
            size: result.audio.size,
            type: result.audio.type
          } : null,
          mimeType: result.mimeType,
          durationMs: result.durationMs,
          chunkReason: result.chunkReason,
          browserSpeechText: result.browserSpeechText || ""
        },
        error: result.status.error
      });
    } catch (error) {
      setListenerState("error");
      updateStack(id, {
        status: "error",
        steps: [
          { label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }
        ],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  async function startListeningLoop() {
    stopRequestedRef.current = false;
    setSession({ active: true, chunks: 0, endedReason: "" });
    setListenerState("listening");

    while (!stopRequestedRef.current) {
      await runAudioChunk("loop");
      setSession((current) => ({ ...current, chunks: current.chunks + 1 }));
      await wait(120);
    }

    setSession((current) => ({ ...current, active: false, endedReason: "USER CLICKED STOP" }));
    setListenerState("ended");
  }

  function stopListeningLoop() {
    stopRequestedRef.current = true;
    setSession((current) => ({ ...current, endedReason: "USER CLICKED STOP" }));
  }

  return (
    <section className="debug-method">
      <div className="explain">
        <BusinessTree
          latestBusiness={latestBusiness}
          listenerState={listenerState}
          session={session}
          speechCheckLang={speechCheckLang}
          maxDurationMs={maxDurationMs}
          chunkDecisionMode={chunkDecisionMode}
        />
      </div>

      <div className="debug-grid">
        <section className="method-panel">
          <h2>Inputs</h2>
          <div className={`listener-state ${listenerState}`}>
            <strong>LISTENER STATE</strong>
            <span>{listenerState}</span>
          </div>
          <label className="field">
            <span>maxDurationMs</span>
            <input type="number" value={maxDurationMs} min={500} step={100} onChange={(event) => setMaxDurationMs(Number(event.target.value))} />
            <small>Maximum recording time. Used when no final speech boundary is detected.</small>
          </label>
          <label className="field">
            <span>speechResultIdleMs</span>
            <input type="number" value={speechResultIdleMs} min={200} step={100} onChange={(event) => setSpeechResultIdleMs(Number(event.target.value))} />
            <small>NOT real silence detection. This waits after the browser SpeechRecognition helper reports a text result.</small>
          </label>
          <label className="field">
            <span>speechCheckLang</span>
            <input value={speechCheckLang} onChange={(event) => setSpeechCheckLang(event.target.value)} />
            <small>Only for browser SpeechRecognition helper. It tells the browser what language to expect when trying to produce helper text. It is NOT AI analysis and NOT required if SpeechRecognition is unavailable.</small>
          </label>
          <label className="field">
            <span>chunkDecisionMode</span>
            <select value={chunkDecisionMode} onChange={(event) => setChunkDecisionMode(event.target.value as "auto" | "browser_speech_text" | "audio_energy")}>
              <option value="auto">auto: speech helper, else audio energy</option>
              <option value="browser_speech_text">browser speech text only</option>
              <option value="audio_energy">audio energy only</option>
            </select>
            <small>Business rule for USEFUL_CHUNK. Auto uses browser speech text when available; if not available, it uses SYSTEM_AUDIO_ENERGY_CHECK.</small>
          </label>
          <label className="field">
            <span>energyThreshold</span>
            <input type="number" value={energyThreshold} min={0.001} max={0.5} step={0.001} onChange={(event) => setEnergyThreshold(Number(event.target.value))} />
            <small>RMS threshold for SYSTEM_AUDIO_ENERGY_CHECK. Lower is more sensitive and may accept noise.</small>
          </label>
          <label className="field">
            <span>minEnergyActiveMs</span>
            <input type="number" value={minEnergyActiveMs} min={50} step={50} onChange={(event) => setMinEnergyActiveMs(Number(event.target.value))} />
            <small>Milliseconds above threshold required before audio energy mode marks the chunk useful.</small>
          </label>
          <label className="field">
            <span>mimeType</span>
            <input value={mimeType} onChange={(event) => setMimeType(event.target.value)} placeholder="empty = browser default" />
            <small>Optional MediaRecorder MIME type. Leave empty unless you know the browser supports it.</small>
          </label>

          <h2>Browser requirements</h2>
          <pre>{JSON.stringify({
            secureContext: window.isSecureContext,
            getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
            mediaRecorder: typeof MediaRecorder !== "undefined",
            speechRecognitionChecker: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
            systemAudioEnergyCheckImplemented: true,
            realAudioSilenceDetectionImplemented: false,
            microphoneVolumeDetectionImplemented: false,
            voiceActivityDetectionImplemented: false
          }, null, 2)}</pre>

          <button className="run-button" type="button" onClick={() => void runAudioChunk()} disabled={running}>
            {running ? "Recording..." : "Record one chunk"}
          </button>
          <button className="run-button" type="button" onClick={() => void startListeningLoop()} disabled={session.active || running}>
            Start listening loop
          </button>
          <button className="stop-button" type="button" onClick={stopListeningLoop} disabled={!session.active}>
            Stop listening
          </button>
        </section>

        <section className="method-panel">
          <h2>Output audio</h2>
          {audioUrl ? (
            <audio controls src={audioUrl} />
          ) : (
            <p>No audio recorded yet.</p>
          )}

          <h2>Business flow</h2>
          {methodRuns.length === 0 ? (
            <p>No method call yet.</p>
          ) : (
            methodRuns.map((item) => (
              <StackArticle item={item} key={item.id} />
            ))
          )}

          <h2>Technical log items</h2>
          {technicalLogs.length === 0 ? (
            <p>No logs yet.</p>
          ) : (
            technicalLogs.map((item) => (
              <StackArticle item={item} key={item.id} compact />
            ))
          )}
        </section>
      </div>
    </section>
  );
}

function AudioEnergyCheckDebug() {
  const [durationMs, setDurationMs] = useState(2000);
  const [threshold, setThreshold] = useState(0.035);
  const [minActiveMs, setMinActiveMs] = useState(250);
  const [sampleEveryMs, setSampleEveryMs] = useState(50);
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runCheck() {
    const input = {
      durationMs,
      threshold,
      minActiveMs,
      sampleEveryMs,
      browserNeeds: {
        secureContext: window.isSecureContext,
        getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        audioContext: Boolean(window.AudioContext || window.webkitAudioContext),
        requestedMedia: { audio: true, video: false }
      }
    };
    const id = pushStack({
      type: "SYSTEM_AUDIO_ENERGY_CHECK",
      status: "running",
      input,
      steps: [
        { label: "Request microphone", state: "running", detail: "Browser requests microphone audio only." },
        { label: "Start energy check", state: "pending", detail: "Public library method will sample RMS energy." },
        { label: "Decide sound", state: "pending", detail: "No decision yet." }
      ]
    });
    setRunning(true);
    let stream: MediaStream | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("client microphone API not available");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const controller = SYSTEM_AUDIO_ENERGY_CHECK({ logger: loggerFor(pushStack) }, { stream, threshold, minActiveMs, sampleEveryMs });
      controller.start();
      await wait(durationMs);
      controller.stop();
      stream.getTracks().forEach((track) => track.stop());
      const summary = controller.summary();
      const hasSound = summary.hasSound;
      const business = {
        BUSINESS_DECISION: `HAS_SOUND=${hasSound ? "YES" : "NO"}`,
        decision_ok: hasSound,
        business_decision: hasSound ? "SOUND_DETECTED" : "SILENCE_OR_TOO_LOW",
        business_reason: hasSound
          ? "Audio energy crossed the configured RMS threshold long enough."
          : "Audio energy did not cross the configured RMS threshold long enough. This can skip silent chunks before AI.",
        send_to_ai: hasSound ? "NO_NOT_THIS_FUNCTION" : "NO_SKIP_SILENCE",
        method: "SYSTEM_AUDIO_ENERGY_CHECK",
        public_library_method: true,
        vad: "NOT IMPLEMENTED",
        warning: "Energy check is not real VAD. Loud noise can count as sound."
      };
      updateStack(id, {
        status: "ok",
        business,
        output: summary,
        steps: [
          { label: "Request microphone", state: "done", detail: "Microphone stream opened with audio only." },
          { label: "Start energy check", state: summary.available ? "done" : "error", detail: summary.available ? "RMS energy samples collected." : String(summary.error || "AudioContext unavailable.") },
          { label: `Decide sound: ${hasSound ? "YES" : "NO"}`, state: summary.available ? "done" : "error", detail: String(business.business_reason) }
        ]
      });
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      updateStack(id, {
        status: "error",
        business: {
          BUSINESS_DECISION: "HAS_SOUND=NO",
          decision_ok: false,
          business_reason: "Energy check could not run.",
          send_to_ai: "NO_ERROR"
        },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      inputs={(
        <>
          <NumberField label="durationMs" value={durationMs} min={200} step={100} onChange={setDurationMs} note="How long to sample microphone energy." />
          <NumberField label="threshold" value={threshold} min={0.001} max={0.5} step={0.001} onChange={setThreshold} note="RMS threshold. Lower is more sensitive." />
          <NumberField label="minActiveMs" value={minActiveMs} min={50} step={50} onChange={setMinActiveMs} note="Required time above threshold." />
          <NumberField label="sampleEveryMs" value={sampleEveryMs} min={20} step={10} onChange={setSampleEveryMs} note="How often RMS is sampled." />
          <button className="run-button" type="button" onClick={() => void runCheck()} disabled={running}>{running ? "Checking..." : "Run energy check"}</button>
        </>
      )}
    />
  );
}

function MicroToAudioDebug() {
  const [durationMs, setDurationMs] = useState(3000);
  const [mimeType, setMimeType] = useState("");
  const [running, setRunning] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runRecord() {
    const input = {
      durationMs,
      mimeType: mimeType || undefined,
      browserNeeds: {
        secureContext: window.isSecureContext,
        getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        mediaRecorder: typeof MediaRecorder !== "undefined",
        requestedMedia: { audio: true, video: false }
      }
    };
    const id = pushStack({
      type: "SYSTEM_MICRO_TO_AUDIO",
      status: "running",
      input,
      steps: [
        { label: "Request microphone", state: "running", detail: "Browser requests microphone audio only." },
        { label: "Record audio", state: "pending", detail: "MediaRecorder has not finished yet." },
        { label: "Business decision", state: "pending", detail: "No audio decision yet." }
      ]
    });
    setRunning(true);
    try {
      const result = await SYSTEM_MICRO_TO_AUDIO({ logger: loggerFor(pushStack) }, { durationMs, mimeType: mimeType || undefined });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = result.audio ? URL.createObjectURL(result.audio) : "";
      setAudioUrl(nextUrl);
      const recorded = Boolean(result.audio && result.audio.size > 0);
      const business = {
        BUSINESS_DECISION: `AUDIO_RECORDED=${recorded ? "YES" : "NO"}`,
        decision_ok: recorded,
        business_decision: recorded ? "AUDIO_RECORDED" : "NO_AUDIO",
        business_reason: recorded ? "Browser MediaRecorder produced an audio blob." : "No audio blob was produced.",
        send_to_ai: "NO_NOT_THIS_FUNCTION",
        method: "SYSTEM_MICRO_TO_AUDIO",
        note: "This function records raw audio only. It does not decide speech and does not call AI."
      };
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        output: {
          status: result.status,
          audio: result.audio ? { size: result.audio.size, type: result.audio.type } : null,
          mimeType: result.mimeType,
          durationMs: result.durationMs
        },
        steps: [
          { label: "Request microphone", state: result.status.ok ? "done" : "error", detail: "Requested audio only. No camera requested." },
          { label: `Record audio: ${recorded ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: recorded ? "Audio blob exists." : "No audio blob exists." },
          { label: `Business decision: audio recorded? ${recorded ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: { BUSINESS_DECISION: "AUDIO_RECORDED=NO", decision_ok: false, business_reason: "Recording failed.", send_to_ai: "NO_ERROR" },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      outputAudioUrl={audioUrl}
      inputs={(
        <>
          <NumberField label="durationMs" value={durationMs} min={500} step={100} onChange={setDurationMs} note="How long to record raw microphone audio." />
          <label className="field">
            <span>mimeType</span>
            <input value={mimeType} onChange={(event) => setMimeType(event.target.value)} placeholder="empty = browser default" />
            <small>Optional MediaRecorder MIME type.</small>
          </label>
          <button className="run-button" type="button" onClick={() => void runRecord()} disabled={running}>{running ? "Recording..." : "Record raw audio"}</button>
        </>
      )}
    />
  );
}

function AudioToTextDebug() {
  const [lang, setLang] = useState("fr-FR");
  const [timeoutMs, setTimeoutMs] = useState(6000);
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runListen() {
    const input = {
      lang,
      timeoutMs,
      browserNeeds: {
        secureContext: window.isSecureContext,
        speechRecognitionChecker: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
        requestedMedia: { audio: true, video: false }
      }
    };
    const id = pushStack({
      type: "SYSTEM_AUDIO_TO_TEXT",
      status: "running",
      input,
      steps: [
        { label: "Start browser speech recognition", state: "running", detail: "Browser helper listens for speech text." },
        { label: "Business decision", state: "pending", detail: "No text decision yet." }
      ]
    });
    setRunning(true);
    try {
      const result = await SYSTEM_AUDIO_TO_TEXT({ logger: loggerFor(pushStack) }, { lang, timeoutMs });
      const hasText = Boolean(result.text.trim());
      const business = {
        BUSINESS_DECISION: `TEXT_DETECTED=${hasText ? "YES" : "NO"}`,
        decision_ok: hasText,
        business_decision: hasText ? "TEXT_DETECTED" : "NO_TEXT",
        business_reason: hasText ? "Browser SpeechRecognition returned text." : "Browser SpeechRecognition returned no text.",
        send_to_ai: "NO_NOT_THIS_FUNCTION",
        method: "SYSTEM_AUDIO_TO_TEXT",
        note: "DEBUG PAGE BUSINESS OBJECT. Real method output is output.status + output.text + output.note. Browser helper only. Not AI transcription and not pronunciation analysis."
      };
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        output: result,
        steps: [
          { label: "Start browser speech recognition", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Browser returned a result." : String(result.status.error || "Browser speech recognition failed.") },
          { label: `Business decision: text detected? ${hasText ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: { BUSINESS_DECISION: "TEXT_DETECTED=NO", decision_ok: false, business_reason: "Browser speech recognition could not run.", send_to_ai: "NO_ERROR" },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      inputs={(
        <>
          <label className="field">
            <span>lang</span>
            <input value={lang} onChange={(event) => setLang(event.target.value)} />
            <small>Browser SpeechRecognition language hint. It is not AI language detection.</small>
          </label>
          <NumberField label="timeoutMs" value={timeoutMs} min={1000} step={500} onChange={setTimeoutMs} note="Maximum wait. Without this, some browsers can keep listening forever." />
          <button className="run-button" type="button" onClick={() => void runListen()} disabled={running}>{running ? "Listening..." : "Listen for browser text"}</button>
        </>
      )}
    />
  );
}

function TextToAudioDebug() {
  const [text, setText] = useState("Bonjour. Ceci est un test.");
  const [lang, setLang] = useState("fr-FR");
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runSpeak() {
    const input = {
      text,
      lang,
      browserNeeds: {
        speechSynthesis: "speechSynthesis" in window,
        speechSynthesisUtterance: typeof SpeechSynthesisUtterance !== "undefined",
        userClickRequired: true
      }
    };
    const id = pushStack({
      type: "SYSTEM_TEXT_TO_AUDIO",
      status: "running",
      input,
      steps: [
        { label: "Create browser utterance", state: "running", detail: "Browser dummy text-to-speech starts from the text input." },
        { label: "Business decision", state: "pending", detail: "No playback decision yet." }
      ]
    });
    setRunning(true);
    try {
      const result = await SYSTEM_TEXT_TO_AUDIO({ logger: loggerFor(pushStack) }, { text, lang });
      const business = {
        BUSINESS_DECISION: `SPOKEN=${result.spoken ? "YES" : "NO"}`,
        decision_ok: result.spoken,
        business_decision: result.spoken ? "BROWSER_SPOKE_TEXT" : "BROWSER_DID_NOT_SPEAK",
        business_reason: result.spoken ? "Browser speech synthesis played the text." : "Browser speech synthesis failed or is unavailable.",
        send_to_ai: "NO_NOT_THIS_FUNCTION",
        method: "SYSTEM_TEXT_TO_AUDIO",
        note: "DUMB_BROWSER_TEXT_TO_SPEECH. This is not AI voice audio."
      };
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        output: result,
        steps: [
          { label: "Create browser utterance", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Browser accepted and played the utterance." : String(result.status.error || "Browser TTS failed.") },
          { label: `Business decision: spoken? ${result.spoken ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: { BUSINESS_DECISION: "SPOKEN=NO", decision_ok: false, business_reason: "Browser dummy TTS could not run.", send_to_ai: "NO_ERROR" },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      inputs={(
        <>
          <label className="field">
            <span>text</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} />
            <small>Text for browser dummy TTS. No AI prompt.</small>
          </label>
          <label className="field">
            <span>lang</span>
            <input value={lang} onChange={(event) => setLang(event.target.value)} />
            <small>Browser speech synthesis language hint.</small>
          </label>
          <button className="run-button" type="button" onClick={() => void runSpeak()} disabled={running}>{running ? "Speaking..." : "Speak browser dummy TTS"}</button>
        </>
      )}
    />
  );
}

function AudioToSpeakerDebug() {
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  function selectAudio(file: File | null) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudio(file);
    setAudioUrl(file ? URL.createObjectURL(file) : "");
  }

  async function runPlayback() {
    const input = {
      audio: audio ? { size: audio.size, type: audio.type } : null,
      browserNeeds: { audioElementPlayback: true, userClickRequired: true }
    };
    const id = pushStack({
      type: "SYSTEM_AUDIO_TO_SPEAKER",
      status: "running",
      input,
      steps: [
        { label: "Check audio input", state: audio ? "done" : "error", detail: audio ? "Audio file is selected." : "No audio selected." },
        { label: "Play audio", state: "pending", detail: "No playback result yet." },
        { label: "Business decision", state: "pending", detail: "No playback decision yet." }
      ]
    });
    if (!audio) {
      updateStack(id, {
        status: "error",
        business: { BUSINESS_DECISION: "PLAYED=NO", decision_ok: false, business_reason: "No audio file selected.", send_to_ai: "NO_ERROR" },
        error: "No audio file selected."
      });
      return;
    }
    setRunning(true);
    try {
      const result = await SYSTEM_AUDIO_TO_SPEAKER({ logger: loggerFor(pushStack) }, { audio });
      const business = {
        BUSINESS_DECISION: `PLAYED=${result.played ? "YES" : "NO"}`,
        decision_ok: result.played,
        business_decision: result.played ? "AUDIO_PLAYED" : "AUDIO_NOT_PLAYED",
        business_reason: result.played ? "Browser audio playback ended successfully." : "Browser audio playback failed.",
        send_to_ai: "NO_NOT_THIS_FUNCTION",
        method: "SYSTEM_AUDIO_TO_SPEAKER",
        note: "This only plays an existing audio blob through the browser speaker."
      };
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        output: result,
        steps: [
          { label: "Check audio input", state: "done", detail: "Audio file was selected." },
          { label: "Play audio", state: result.played ? "done" : "error", detail: result.played ? "Browser reported playback ended." : String(result.status.error || "Playback failed.") },
          { label: `Business decision: played? ${result.played ? "YES" : "NO"}`, state: result.status.ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: result.status.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: { BUSINESS_DECISION: "PLAYED=NO", decision_ok: false, business_reason: "Speaker playback could not run.", send_to_ai: "NO_ERROR" },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      outputAudioUrl={audioUrl}
      inputs={(
        <>
          <label className="field">
            <span>audio file</span>
            <input type="file" accept="audio/*" onChange={(event) => selectAudio(event.target.files?.[0] || null)} />
            <small>Select an audio file/blob to play through SYSTEM_AUDIO_TO_SPEAKER.</small>
          </label>
          <button className="run-button" type="button" onClick={() => void runPlayback()} disabled={running}>{running ? "Playing..." : "Play selected audio"}</button>
        </>
      )}
    />
  );
}

function SimpleDebugPage({ inputs, stack, outputAudioUrl }: { inputs: React.ReactNode; stack: StackItem[]; outputAudioUrl?: string }) {
  const methodRuns = stack.filter((item) => item.type !== "library-log");
  const technicalLogs = stack.filter((item) => item.type === "library-log");

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Inputs</h2>
          {inputs}
        </section>
        <section className="method-panel">
          {outputAudioUrl !== undefined && (
            <>
              <h2>Output audio</h2>
              {outputAudioUrl ? <audio controls src={outputAudioUrl} /> : <p>No audio selected or recorded yet.</p>}
            </>
          )}
          <h2>Business flow</h2>
          {methodRuns.length === 0 ? <p>No method call yet.</p> : methodRuns.map((item) => <StackArticle item={item} key={item.id} />)}
          <h2>Technical log items</h2>
          {technicalLogs.length === 0 ? <p>No logs yet.</p> : technicalLogs.map((item) => <StackArticle item={item} key={item.id} compact />)}
        </section>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  note,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  note: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{note}</small>
    </label>
  );
}

function useDebugStack() {
  const [stack, setStack] = useState<StackItem[]>([]);

  function pushStack(item: Omit<StackItem, "id" | "createdAt">) {
    const next = { id: createId(), createdAt: new Date().toISOString(), ...item };
    setStack((current) => [...current, next].slice(-30));
    return next.id;
  }

  function updateStack(id: string, patch: Partial<StackItem>) {
    setStack((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  return { stack, pushStack, updateStack };
}

function loggerFor(pushStack: (item: Omit<StackItem, "id" | "createdAt">) => string) {
  return (event: { level: "info" | "error"; method: string; message: string; data?: unknown; createdAt: string }) => {
    pushStack({
      type: "library-log",
      status: event.level === "error" ? "error" : "ok",
      output: event
    });
  };
}

function ServerAiEndpointDebug({ methodId }: { methodId: string }) {
  const [provider, setProvider] = useState("openai");
  const [text, setText] = useState("Bonjour. Ceci est un test.");
  const [voice, setVoice] = useState("coral");
  const [languageName, setLanguageName] = useState("French");
  const [keywordOn, setKeywordOn] = useState("on");
  const [keywordOff, setKeywordOff] = useState("off");
  const [style, setStyle] = useState("Speak as a calm trainer. Keep it short.");
  const [systemPrompt, setSystemPrompt] = useState(
    methodId === "AUDIO_ANALYSER"
      ? AUDIO_ANALYSER_DEFAULT_PROMPTS.systemPrompt
      : methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO"
        ? AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.systemPrompt
        : "You are a short voice trainer."
  );
  const [additionalInstructions, setAdditionalInstructions] = useState(methodId === "AUDIO_ANALYSER" || methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO" ? "" : "Keep it short.");
  const [audio, setAudio] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioSourceLabel, setAudioSourceLabel] = useState("No audio selected.");
  const [textUserChat, setTextUserChat] = useState("Bonjour, je veux tester ma voix.");
  const [textChat, setTextChat] = useState("");
  const [historyText, setHistoryText] = useState("[]");
  const [systemTask, setSystemTask] = useState(
    methodId === "AUDIO_ANALYSER"
      ? AUDIO_ANALYSER_DEFAULT_PROMPTS.task
      : methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO"
        ? AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.taskPrompt
        : "You are a French voice trainer. Judge pronunciation from original audio."
  );
  const [howToRespond, setHowToRespond] = useState(methodId === "AUDIO_ANALYSER" ? AUDIO_ANALYSER_DEFAULT_PROMPTS.howToRespond : methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO" ? AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.howToRespond : "Return JSON text and short spoken audio. Keep it short.");
  const [responseJsonFormat, setResponseJsonFormat] = useState(methodId === "AUDIO_ANALYSER" ? AUDIO_ANALYSER_DEFAULT_PROMPTS.responseJsonFormat : methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO" ? AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.responseJsonFormat : "{\n  \"flags\": {},\n  \"chat_text_to_user\": \"\",\n  \"text_corrected\": \"\",\n  \"hint\": \"\"\n}");
  const [running, setRunning] = useState(false);
  const [outputAudioUrl, setOutputAudioUrl] = useState("");
  const { stack, pushStack, updateStack } = useDebugStack();
  const endpoint = serverEndpointFor(methodId);
  const needsAudio = methodId !== "PRIMITIVE_TEXT_TO_AUDIO";
  const needsPrompts = methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO" || methodId === "AUDIO_ANALYSER";

  function selectAudio(file: File | null, label = "User selected audio.") {
    setAudio(file);
    setAudioSourceLabel(file ? label : "No audio selected.");
    setAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return file ? URL.createObjectURL(file) : "";
    });
  }

  useEffect(() => {
    if (!needsAudio) return;
    let cancelled = false;

    async function loadDefaultTestAudio() {
      try {
        const response = await fetch(DEFAULT_TEST_AUDIO_URL);
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        selectAudio(new File([blob], "sample-voice-test.wav", { type: blob.type || "audio/wav" }), "Default example audio.");
      } catch {
        if (!cancelled) selectAudio(null);
      }
    }

    void loadDefaultTestAudio();
    return () => {
      cancelled = true;
    };
  }, [methodId, needsAudio]);

  function resetAudioAnalyserPrompts() {
    const defaults = createAudioAnalyserDefaultPrompts({ languageName, keywordOn, keywordOff });
    setSystemPrompt(defaults.systemPrompt);
    setSystemTask(defaults.task);
    setHowToRespond(defaults.howToRespond);
    setResponseJsonFormat(defaults.responseJsonFormat);
  }

  function resetAudioTurnPrompts() {
    const defaults = createAudioTurnDefaultPrompts(languageName);
    setSystemPrompt(defaults.systemPrompt);
    setSystemTask(defaults.taskPrompt);
    setHowToRespond(defaults.howToRespond);
    setResponseJsonFormat(defaults.responseJsonFormat);
  }

  async function runServerMethod() {
    const audioInput = audio ? { size: audio.size, type: audio.type, name: audio.name } : null;
    const parsedHistory = parseJsonInput(historyText, []);
    const promptConfig = { systemTask, howToRespond, responseJsonFormat };
    const input =
      methodId === "PRIMITIVE_TEXT_TO_AUDIO"
        ? {
            endpoint,
            methodId,
            provider,
            systemPrompt,
            additionalInstructions,
            text,
            voice,
            languageName,
            style,
            history: parsedHistory
          }
        : methodId === "PRIMITIVE_AUDIO_TO_TEXT"
          ? {
              endpoint,
              methodId,
              provider,
              systemPrompt,
              additionalInstructions,
              textChat,
              audio: audioInput,
              history: parsedHistory
            }
          : methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO"
            ? {
                endpoint,
                methodId,
                provider,
                systemPrompt,
                additionalInstructions,
                audio: audioInput,
                voice,
                languageName,
                promptConfig
              }
            : {
                endpoint,
                methodId,
                provider,
                systemPrompt,
                additionalInstructions,
                textUserChat,
                audio: audioInput,
                voice,
                languageName,
                keywordOn,
                keywordOff,
                history5LastTextChats: parsedHistory,
                promptConfig
              };
    const id = pushStack({
      type: methodId,
      status: "running",
      input,
      steps: [
        { label: "Build request", state: "done", detail: `Browser prepares request for ${endpoint}.` },
        { label: "Check required audio", state: needsAudio ? "pending" : "done", detail: needsAudio ? "Audio file must be selected before endpoint call." : "No audio input required." },
        { label: "Call server endpoint", state: "pending", detail: "Endpoint not called yet." },
        { label: "Business decision", state: "pending", detail: "No server result yet." }
      ]
    });

    if (needsAudio && !audio) {
      updateStack(id, {
        status: "error",
        output: {
          status: {
            ok: false,
            phase: "error",
            error: "Audio input is required.",
            endpointCalled: false
          }
        },
        steps: [
          { label: "Build request", state: "done", detail: `Browser prepared request for ${endpoint}.` },
          { label: "Check required audio", state: "error", detail: "Audio file is required but none is selected." },
          { label: "Call server endpoint", state: "done", detail: "Not called because required audio is missing." },
          { label: "Result", state: "error", detail: "Missing required input: audio." }
        ],
        error: "Audio input is required."
      });
      return;
    }

    setRunning(true);
    try {
      let response: Response;
      if (methodId === "PRIMITIVE_TEXT_TO_AUDIO") {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, text, voice, languageName, style, systemPrompt, additionalInstructions, history: parsedHistory })
        });
      } else if (methodId === "PRIMITIVE_AUDIO_TO_TEXT") {
        const form = new FormData();
        form.set("file", audio as File);
        form.set("systemPrompt", systemPrompt);
        form.set("additionalInstructions", additionalInstructions);
        form.set("textChat", textChat);
        form.set("history", historyText);
        form.set("prompt", [systemPrompt, additionalInstructions, textChat, historyText].filter(Boolean).join("\n"));
        response = await fetch(endpoint, { method: "POST", body: form });
      } else {
        const audioBase64 = await blobToBase64(audio as File);
        const history5LastTextChats = parsedHistory;
        const body = methodId === "AUDIO_ANALYSER"
          ? {
              audioBase64,
              audioFormat: audio?.type || "webm",
              textUserChat,
              history5LastTextChats,
              provider,
              voice,
              settings: { languageName, keywordOn, keywordOff },
              systemPrompt,
              additionalInstructions,
              promptConfig: { systemTask, howToRespond, responseJsonFormat }
            }
          : {
              audioBase64,
              audioFormat: audio?.type || "webm",
              provider,
              voice,
              settings: { languageName },
              systemPrompt,
              additionalInstructions,
              promptConfig: { systemTask, howToRespond, responseJsonFormat }
            };
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      const contentType = response.headers.get("content-type") || "";
      let output: unknown;
      let nextAudioUrl = "";
      if (contentType.includes("audio/")) {
        const blob = await response.blob();
        nextAudioUrl = URL.createObjectURL(blob);
        output = { contentType, audio: { size: blob.size, type: blob.type } };
      } else {
        output = await response.json().catch(() => ({ error: "Response was not JSON." }));
        const audioBase64 = typeof output === "object" && output && "audioBase64" in output ? String((output as { audioBase64?: unknown }).audioBase64 || "") : "";
        if (!audioBase64 && typeof output === "object" && output && "audio" in output) {
          const audioValue = (output as { audio?: { audioBase64?: string; audioFormat?: string } }).audio;
          if (audioValue?.audioBase64) nextAudioUrl = URL.createObjectURL(base64ToBlob(audioValue.audioBase64, audioValue.audioFormat || "wav"));
        } else if (audioBase64) {
          nextAudioUrl = URL.createObjectURL(base64ToBlob(audioBase64, "wav"));
        }
      }
      if (outputAudioUrl) URL.revokeObjectURL(outputAudioUrl);
      setOutputAudioUrl(nextAudioUrl);

      const errorText = typeof output === "object" && output && "error" in output ? String((output as { error?: unknown }).error || "") : "";
      const ok = response.ok && !errorText;
      const business = {
        BUSINESS_DECISION: `SERVER_CALL=${ok ? "YES" : "NO"}`,
        decision_ok: ok,
        business_decision: ok ? "SERVER_RETURNED_RESULT" : "SERVER_ERROR_OR_NOT_CONNECTED",
        business_reason: ok ? `Server endpoint ${endpoint} returned a result.` : errorText || `Server endpoint ${endpoint} failed.`,
        send_to_ai: ok ? "YES_SERVER_ENDPOINT_CALLED_AI_IF_CONFIGURED" : "NO_SERVER_ERROR",
        method: methodId,
        endpoint,
        note: "This debug page calls the app server endpoint. The server decides whether OpenAI is configured."
      };
      updateStack(id, {
        status: ok ? "ok" : "error",
        business,
        output,
        steps: [
          { label: "Build request", state: "done", detail: `Request prepared for ${endpoint}.` },
          { label: "Check required audio", state: needsAudio ? "done" : "done", detail: needsAudio ? "Audio file selected." : "No audio input required." },
          { label: "Call server endpoint", state: ok ? "done" : "error", detail: ok ? "Endpoint returned without error." : String(business.business_reason) },
          { label: `Result: server call ${ok ? "OK" : "ERROR"}`, state: ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: errorText || undefined
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: {
          BUSINESS_DECISION: "SERVER_CALL=NO",
          decision_ok: false,
          business_reason: error instanceof Error ? error.message : String(error),
          send_to_ai: "NO_ERROR"
        },
        steps: [{ label: "Run endpoint", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <SimpleDebugPage
      stack={stack}
      outputAudioUrl={outputAudioUrl || undefined}
      inputs={(
        <>
          <section className="not-implemented">SERVER METHOD VIA ENDPOINT: {endpoint}</section>
          <label className="field">
            <span>provider</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="openai">openai</option>
            </select>
            <small>Provider choice. Only OpenAI is implemented right now.</small>
          </label>
          {methodId === "PRIMITIVE_TEXT_TO_AUDIO" && (
            <>
              <label className="field"><span>text</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} /><small>Text sent to server TTS endpoint.</small></label>
              <label className="field"><span>history</span><textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} rows={3} /><small>JSON history sent to server TTS endpoint.</small></label>
            </>
          )}
          {(methodId === "PRIMITIVE_TEXT_TO_AUDIO" || methodId === "PRIMITIVE_AUDIO_TO_TEXT") && (
            <>
              <label className="field"><span>systemPrompt</span><textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={4} /><small>Editable instruction input sent to endpoint.</small></label>
              <label className="field"><span>additionalInstructions</span><textarea value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} rows={3} /><small>Editable additional instruction input sent to endpoint.</small></label>
            </>
          )}
          {methodId === "PRIMITIVE_TEXT_TO_AUDIO" && (
            <label className="field"><span>style</span><textarea value={style} onChange={(event) => setStyle(event.target.value)} rows={3} /><small>TTS style/instructions sent to server.</small></label>
          )}
          {needsAudio && (
            <>
              <label className="field">
                <span>audio file</span>
                <input type="file" accept="audio/*" onChange={(event) => selectAudio(event.target.files?.[0] || null, "User selected audio.")} />
                <small>Required input audio sent to the server endpoint. Default sample: /test-audio/sample-voice-test.wav.</small>
              </label>
              {audioUrl ? (
                <section className="input-audio-preview">
                  <h2>Selected input audio</h2>
                  <p>{audioSourceLabel}</p>
                  <audio controls src={audioUrl} />
                  <button className="secondary-button" type="button" onClick={() => selectAudio(null)}>Remove selected audio</button>
                </section>
              ) : (
                <section className="not-implemented">REQUIRED INPUT AUDIO: NOT SELECTED</section>
              )}
            </>
          )}
          {methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO" && (
            <section className="prompt-source">
              <h2>RAW PRIMITIVE - NOT AUDIO_ANALYSER</h2>
              <p>This page only tests audio to provider text plus provider audio. It does not parse keyword flags or correction flags.</p>
              <button className="secondary-button" type="button" onClick={resetAudioTurnPrompts}>Reset raw primitive prompts</button>
            </section>
          )}
          {methodId === "AUDIO_ANALYSER" && (
            <>
              <section className="prompt-source">
                <h2>AUDIO_ANALYSER core prompts</h2>
                <p>Default prompts come from lib_server_ai_voice/audioAnalyserPrompts.ts.</p>
                <button className="secondary-button" type="button" onClick={resetAudioAnalyserPrompts}>Reset prompts from module defaults</button>
              </section>
              <label className="field"><span>keywordOn</span><input value={keywordOn} onChange={(event) => setKeywordOn(event.target.value)} /><small>Exact ON keyword used when resetting module default prompts and sent in settings.</small></label>
              <label className="field"><span>keywordOff</span><input value={keywordOff} onChange={(event) => setKeywordOff(event.target.value)} /><small>Exact OFF keyword used when resetting module default prompts and sent in settings.</small></label>
              <label className="field"><span>textUserChat</span><textarea value={textUserChat} onChange={(event) => setTextUserChat(event.target.value)} rows={3} /><small>Optional user chat text sent together with original audio.</small></label>
              <label className="field"><span>history5LastTextChats</span><textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} rows={3} /><small>JSON array. Sent to server as history.</small></label>
            </>
          )}
          {methodId === "PRIMITIVE_AUDIO_TO_TEXT" && (
            <>
              <label className="field"><span>textChat</span><textarea value={textChat} onChange={(event) => setTextChat(event.target.value)} rows={3} /><small>Text chat context sent with primitive transcription request.</small></label>
              <label className="field"><span>history</span><textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} rows={3} /><small>JSON history sent with primitive transcription request.</small></label>
            </>
          )}
          {needsPrompts && (
            <>
              <label className="field"><span>systemPrompt</span><textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={3} /><small>Editable top-level system prompt sent to endpoint.</small></label>
              <label className="field"><span>additionalInstructions</span><textarea value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} rows={3} /><small>Editable extra instruction sent to endpoint.</small></label>
              <label className="field"><span>systemTask</span><textarea value={systemTask} onChange={(event) => setSystemTask(event.target.value)} rows={4} /><small>Prompt task sent to server.</small></label>
              <label className="field"><span>howToRespond</span><textarea value={howToRespond} onChange={(event) => setHowToRespond(event.target.value)} rows={3} /><small>Prompt response instructions sent to server.</small></label>
              <label className="field"><span>responseJsonFormat</span><textarea value={responseJsonFormat} onChange={(event) => setResponseJsonFormat(event.target.value)} rows={5} /><small>Requested JSON shape.</small></label>
            </>
          )}
          <label className="field"><span>voice</span><input value={voice} onChange={(event) => setVoice(event.target.value)} /><small>Server voice setting.</small></label>
          <label className="field"><span>languageName</span><input value={languageName} onChange={(event) => setLanguageName(event.target.value)} /><small>Language setting for endpoint prompt.</small></label>
          <button className="run-button" type="button" onClick={() => void runServerMethod()} disabled={running}>{running ? "Calling server..." : "Call server endpoint"}</button>
        </>
      )}
    />
  );
}

function DataStoreMethodDebug({ methodId }: { methodId: string }) {
  const [type, setType] = useState<DataStoreRecordType | "">("debug");
  const [scope, setScope] = useState("manual");
  const [payloadText, setPayloadText] = useState("{\n  \"note\": \"manual debug event\"\n}");
  const [provider, setProvider] = useState("openai");
  const [feature, setFeature] = useState("manual-test");
  const [amountUsd, setAmountUsd] = useState(0);
  const [units, setUnits] = useState(1);
  const [limit, setLimit] = useState(20);
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runDataStore() {
    const input = { implementation: localDebugDataStore.implementation, methodId, type, scope, payloadText, provider, feature, amountUsd, units, limit };
    const id = pushStack({
      type: methodId,
      status: "running",
      input,
      steps: [
        { label: "Use data-store implementation", state: "done", detail: `Implementation: ${localDebugDataStore.implementation}.` },
        { label: "Run method", state: "running", detail: "Data-store method is running." },
        { label: "Business decision", state: "pending", detail: "No data-store result yet." }
      ]
    });
    setRunning(true);

    try {
      let result: unknown;
      if (methodId === "DATA_STORE_SAVE_EVENT") {
        result = await localDebugDataStore.DATA_STORE_SAVE_EVENT({ type: (type || "debug") as DataStoreRecordType, scope, payload: parseJsonInput(payloadText, {}) });
      } else if (methodId === "DATA_STORE_LIST_EVENTS") {
        result = await localDebugDataStore.DATA_STORE_LIST_EVENTS({ type: type || undefined, limit });
      } else if (methodId === "DATA_STORE_CLEAR_EVENTS") {
        result = await localDebugDataStore.DATA_STORE_CLEAR_EVENTS({ type: type || undefined });
      } else if (methodId === "DATA_STORE_SAVE_COST") {
        result = await localDebugDataStore.DATA_STORE_SAVE_COST({ provider, feature, amountUsd, units, payload: parseJsonInput(payloadText, {}) });
      } else if (methodId === "DATA_STORE_LIST_COSTS") {
        result = await localDebugDataStore.DATA_STORE_LIST_COSTS({ provider: provider || undefined, limit });
      } else {
        result = await localDebugDataStore.DATA_STORE_RESET_COSTS({ provider: provider || undefined });
      }

      const status = (result as { status?: { ok?: boolean; error?: string } }).status;
      const ok = Boolean(status?.ok);
      const business = {
        BUSINESS_DECISION: `DATA_STORE_RESULT=${ok ? "OK" : "ERROR"}`,
        decision_ok: ok,
        business_decision: ok ? "DATA_STORE_METHOD_DONE" : "DATA_STORE_METHOD_ERROR",
        business_reason: ok ? `${methodId} completed in local-memory store.` : status?.error || `${methodId} failed.`,
        send_to_ai: "NO_DATA_STORE_ONLY",
        method: methodId,
        implementation: localDebugDataStore.implementation,
        note: "This page uses local-memory store. Cloudflare D1 needs server binding and is not called from this browser page."
      };
      updateStack(id, {
        status: ok ? "ok" : "error",
        business,
        output: result,
        steps: [
          { label: "Use data-store implementation", state: "done", detail: `Implementation: ${localDebugDataStore.implementation}.` },
          { label: "Run method", state: ok ? "done" : "error", detail: String(business.business_reason) },
          { label: "Business decision", state: ok ? "done" : "error", detail: String(business.business_reason) }
        ],
        error: status?.error
      });
    } catch (error) {
      updateStack(id, {
        status: "error",
        business: {
          BUSINESS_DECISION: "DATA_STORE_RESULT=ERROR",
          decision_ok: false,
          business_reason: error instanceof Error ? error.message : String(error),
          send_to_ai: "NO_ERROR"
        },
        steps: [{ label: "Run method", state: "error", detail: error instanceof Error ? error.message : String(error) }],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  const isEventMethod = methodId.includes("EVENT");
  const isCostMethod = methodId.includes("COST");
  const isSave = methodId.includes("SAVE");
  const isList = methodId.includes("LIST");

  return (
    <SimpleDebugPage
      stack={stack}
      inputs={(
        <>
          <section className="not-implemented">DATA STORE IMPLEMENTATION: {localDebugDataStore.implementation}</section>
          {isEventMethod && (
            <>
              <label className="field"><span>type</span><select value={type} onChange={(event) => setType(event.target.value as DataStoreRecordType | "")}><option value="">all</option><option value="debug">debug</option><option value="error">error</option><option value="history">history</option><option value="payment">payment</option><option value="cost">cost</option></select><small>Event type filter or save type.</small></label>
              {methodId === "DATA_STORE_SAVE_EVENT" && <label className="field"><span>scope</span><input value={scope} onChange={(event) => setScope(event.target.value)} /><small>Scope label for saved event.</small></label>}
            </>
          )}
          {isCostMethod && (
            <>
              <label className="field"><span>provider</span><input value={provider} onChange={(event) => setProvider(event.target.value)} /><small>Provider filter or cost provider.</small></label>
              {methodId === "DATA_STORE_SAVE_COST" && (
                <>
                  <label className="field"><span>feature</span><input value={feature} onChange={(event) => setFeature(event.target.value)} /><small>Feature/cost label.</small></label>
                  <NumberField label="amountUsd" value={amountUsd} min={0} step={0.0001} onChange={setAmountUsd} note="Cost amount in USD." />
                  <NumberField label="units" value={units} min={0} step={1} onChange={setUnits} note="Usage units." />
                </>
              )}
            </>
          )}
          {isSave && <label className="field"><span>payload</span><textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={5} /><small>JSON payload saved with event/cost.</small></label>}
          {isList && <NumberField label="limit" value={limit} min={1} step={1} onChange={setLimit} note="Maximum records returned." />}
          <button className="run-button" type="button" onClick={() => void runDataStore()} disabled={running}>{running ? "Running..." : "Run data-store method"}</button>
        </>
      )}
    />
  );
}

function StackArticle({ item, compact = false }: { item: StackItem; compact?: boolean }) {
  return (
    <article className={`stack-item ${item.status}`} key={item.id}>
      <div>
        <strong>{item.type}</strong>
        <span>{item.status}</span>
        <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
      </div>
      {!compact && item.steps && (
        <section className="step-list">
          <h3>Business sequence</h3>
          {item.steps.map((step) => (
            <div className={`step ${step.state}`} key={`${item.id}-${step.label}`}>
              <strong>{step.label}</strong>
              <span>{step.state}</span>
              <p>{step.detail}</p>
            </div>
          ))}
        </section>
      )}
      {item.input !== undefined && (
        <details open>
          <summary>Real input / request</summary>
          <pre>{JSON.stringify(item.input, null, 2)}</pre>
        </details>
      )}
      {item.output !== undefined && (
        <details open>
          <summary>Real output / response</summary>
          <pre>{JSON.stringify(item.output, null, 2)}</pre>
        </details>
      )}
      <details>
        <summary>Raw item JSON</summary>
        <pre>{JSON.stringify({
          steps: item.steps,
          input: item.input,
          output: item.output,
          error: item.error
        }, null, 2)}</pre>
      </details>
    </article>
  );
}

function humanChunkReason(reason: string) {
  if (reason === "browser_speech_final") return "browser speech helper reported final text";
  if (reason === "silence_after_sound") return "NOT real silence; timer after browser speech helper result";
  if (reason === "max_duration") return "time limit reached; no final browser speech result stopped it";
  if (reason === "no_speech_checker") return "browser speech helper unavailable; time limit reached";
  return reason;
}

function BusinessTree({
  latestBusiness,
  listenerState,
  session,
  speechCheckLang,
  maxDurationMs,
  chunkDecisionMode
}: {
  latestBusiness?: Record<string, unknown>;
  listenerState: "idle" | "listening" | "ended" | "error";
  session: { active: boolean; chunks: number; endedReason: string };
  speechCheckLang: string;
  maxDurationMs: number;
  chunkDecisionMode: "auto" | "browser_speech_text" | "audio_energy";
}) {
  const hasText = Boolean(latestBusiness?.did_find_speech);
  const usefulChunk = latestBusiness?.BUSINESS_DECISION_USEFUL_CHUNK === "YES";
  const audioRecorded = Boolean(latestBusiness?.did_record_audio_chunk);
  const sendToAi = String(latestBusiness?.send_to_ai || "NO_NOT_RUN_YET");
  const energyFound = Boolean(latestBusiness?.audio_energy_found_sound);

  return (
    <section className="business-tree">
      <h2>BUSINESS TARGET: LISTENING TO VOICE</h2>
      <details open className={usefulChunk ? "decision-node yes" : "decision-node no"}>
        <summary>
          <span>BUSINESS DECISION: USEFUL CHUNK?</span>
          <strong className={usefulChunk ? "state-done" : "state-not-useful"}>{usefulChunk ? "YES" : "NO"}</strong>
        </summary>
        <div className="tree-children">
          <p>{String(latestBusiness?.business_reason || "No chunk has been recorded yet.")}</p>
          <p>SEND TO AI: {sendToAi}</p>
        </div>
      </details>
      <details open>
        <summary>
          <span>RECORDING</span>
          <strong className={session.active ? "state-running" : "state-ended"}>{session.active ? "ACTIVE" : listenerState.toUpperCase()}</strong>
        </summary>
        <div className="tree-children">
          <p>MEANS RECORDING {maxDurationMs}ms chunks repeating until user clicks Stop.</p>
          <p>chunks recorded this session: {session.chunks}</p>
        </div>
      </details>

      <details open>
        <summary>
          <span>CHECKING SILENCE / SOUND ENERGY</span>
          <strong className={energyFound ? "state-done" : "state-not-useful"}>{energyFound ? "HAS SOUND" : "NO SOUND - SKIP IN ENERGY MODE"}</strong>
        </summary>
        <div className="tree-children">
          <p>SYSTEM_AUDIO_ENERGY_CHECK is implemented. It measures microphone RMS energy. It is useful for skipping silence, but it is not real VAD.</p>
          <details>
            <summary>ENERGY RESULT JSON</summary>
            <pre>{JSON.stringify(latestBusiness?.audio_energy_check || {
              note: "No chunk has been recorded yet."
            }, null, 2)}</pre>
          </details>
        </div>
      </details>

      <details open>
        <summary>
          <span>CHECKING VOICE ACTIVITY / VAD</span>
          <strong className="state-not-implemented">NOT IMPLEMENTED - SKIP</strong>
        </summary>
        <div className="tree-children">
          <p>No WebRTC VAD or ML VAD exists yet. Audio energy is only a cheaper fallback, not human-speech proof.</p>
        </div>
      </details>

      <details open>
        <summary>
          <span>CHECKING BROWSER VOICE TO SPEECH</span>
          <strong className={hasText ? "state-done" : "state-not-useful"}>{hasText ? "HAS TEXT" : "NO TEXT - SKIP CHUNK"}</strong>
        </summary>
        <div className="tree-children">
          <details>
            <summary>REQUEST</summary>
            <pre>{JSON.stringify({
              speechCheckLang,
              note: "This is browser SpeechRecognition helper only. It may misunderstand other languages."
            }, null, 2)}</pre>
          </details>
          <details>
            <summary>RESULT JSON</summary>
            <pre>{JSON.stringify({
              has_text: hasText,
              text: latestBusiness?.found_text || "",
              language_warning: latestBusiness?.speech_language_warning || ""
            }, null, 2)}</pre>
          </details>
        </div>
      </details>

      <details open>
        <summary>
          <span>CHUNK SENT TO AI FUNCTION AUDIO_ANALYSER</span>
          <strong className={usefulChunk ? "state-not-implemented" : "state-not-useful"}>{usefulChunk ? "SKIPPED - AI NOT IMPLEMENTED HERE" : "SKIPPED - NOT USEFUL"}</strong>
        </summary>
        <div className="tree-children">
          <details>
            <summary>REQUEST FULL</summary>
            <pre>{JSON.stringify({
              would_send_to: "AUDIO_ANALYSER",
              useful_chunk: usefulChunk,
              chunk_accepted_for_next_step: usefulChunk,
              audio_chunk_exists: audioRecorded,
              speech_text_exists: hasText,
              audio_energy_has_sound: energyFound,
              decision_mode: latestBusiness?.actual_decision_mode_used || chunkDecisionMode,
              note: usefulChunk ? "This page does not call AI yet." : "Skipped because business decision is NOT USEFUL CHUNK."
            }, null, 2)}</pre>
          </details>
          <details>
            <summary>RESPONSE FULL</summary>
            <pre>{JSON.stringify({
              ai_called: false,
              has_correction: false,
              reason: "AI send is not implemented on this page."
            }, null, 2)}</pre>
          </details>
        </div>
      </details>

      <details open>
        <summary>
          <span>RECORDING ENDED</span>
          <strong className={listenerState === "listening" ? "state-running" : "state-ended"}>{listenerState === "listening" ? "LISTENING ON" : "ENDED"}</strong>
        </summary>
        <div className="tree-children">
          <p>reason: {session.endedReason || String(latestBusiness?.why_stopped || "not ended yet")}</p>
        </div>
      </details>
    </section>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function serverEndpointFor(methodId: string) {
  if (methodId === "PRIMITIVE_TEXT_TO_AUDIO") return "/api/speak";
  if (methodId === "PRIMITIVE_AUDIO_TO_TEXT") return "/api/transcribe";
  if (methodId === "AUDIO_TO_AI_TEXT_AND_AUDIO") return "/api/audio-turn";
  return "/api/audio-analyser";
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

function base64ToBlob(base64: string, format: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const mimeType = format.includes("/") ? format : `audio/${format || "wav"}`;
  return new Blob([bytes], { type: mimeType });
}

function parseJsonInput<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function StaticPage({ page }: { page: Page }) {
  return (
    <section className="doc">
      {!page.ready && page.notReadyReason && <p className="warning">{page.notReadyReason}</p>}
      <h2>Page status</h2>
      <ul>
        <li>This page is documentation only.</li>
        <li>No inputs are editable here.</li>
        <li>No method is executed here.</li>
        <li>No output is claimed here.</li>
      </ul>
      <h2>Declared method shape</h2>
      <pre>{JSON.stringify({
        method: page.id,
        module: page.module,
        ready: page.ready,
        inputs: page.inputs,
        output: page.output
      }, null, 2)}</pre>
    </section>
  );
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function MicrophoneDocs() {
  return (
    <section className="doc">
      <h2>How microphone/audio is activated</h2>
      <ul>
        <li>User clicks a button on a method page.</li>
        <li>Browser asks for microphone permission.</li>
        <li>App requests audio only: no camera.</li>
        <li>Browser records a short chunk or listens with SpeechRecognition if available.</li>
      </ul>

      <h2>Required browser rights</h2>
      <ul>
        <li>Microphone permission must be allowed.</li>
        <li>HTTPS or localhost is required.</li>
        <li>Audio playback may require a user click before sound can play.</li>
      </ul>

      <h2>If browser speech checker exists</h2>
      <ul>
        <li>It is used only to detect speech boundaries or produce a primitive transcript.</li>
        <li>It is not the real AI pronunciation analysis.</li>
        <li>It helps stop a chunk after final speech or silence.</li>
      </ul>

      <h2>If browser speech checker is missing</h2>
      <ul>
        <li>The app records until max duration.</li>
        <li>The debug output shows `chunkReason: no_speech_checker`.</li>
        <li>The server audio AI can still receive original microphone audio.</li>
      </ul>

      <h2>iOS notes</h2>
      <ul>
        <li>Chrome on iOS uses Apple WebKit rules.</li>
        <li>SpeechRecognition may be missing or unreliable.</li>
        <li>Microphone access must be triggered by a direct user action.</li>
        <li>Speaker playback may also need a user action.</li>
      </ul>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
