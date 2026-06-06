import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Archive, BookOpen, Database, FileAudio, Home, Menu, Mic, Server, Volume2, X } from "lucide-react";
import type { DebugPageDefinition } from "./debug_page_types";
import { SYSTEM_MEANINGFUL_AUDIO_CHUNK } from "./lib_client_voice_system";
import { CLIENT_VOICE_SYSTEM_DEBUG_PAGES } from "./lib_client_voice_system/_test";
import { DATA_STORE_DEBUG_PAGES } from "./lib_data_store/_test";
import { SERVER_AI_VOICE_DEBUG_PAGES } from "./lib_server_ai_voice/_test";
import "./styles.css";

type Page = DebugPageDefinition & {
  icon: React.ComponentType<{ size?: number }>;
};

type StackItem = {
  id: string;
  type: string;
  status: "running" | "ok" | "error";
  createdAt: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
};

const pages: Page[] = [
  { id: "start", title: "Start", module: "Client Voice", role: "start page", ready: true, inputs: [], actions: [], output: [], icon: Home },
  { id: "debug", title: "Debug", module: "Client Voice", role: "debug item array display", ready: false, notReadyReason: "Global debug store is not wired yet.", inputs: [], actions: [], output: [], icon: Activity },
  ...CLIENT_VOICE_SYSTEM_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) })),
  ...SERVER_AI_VOICE_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) })),
  ...DATA_STORE_DEBUG_PAGES.map((page) => ({ ...page, icon: iconForPage(page) }))
];

function iconForPage(page: DebugPageDefinition) {
  if (page.id === "MICROPHONE_AUDIO_REQUIREMENTS") return BookOpen;
  if (page.module === "Server AI Voice") return Server;
  if (page.module === "Data Store") return page.id.includes("CLEAR") || page.id.includes("RESET") ? Archive : Database;
  if (page.id.includes("TEXT")) return FileAudio;
  if (page.id.includes("SPEAKER") || page.id.includes("AUDIO")) return Volume2;
  return Mic;
}

function App() {
  const [activePageId, setActivePageId] = useState("start");
  const [menuOpen, setMenuOpen] = useState(false);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];
  const groups = useMemo(() => {
    return pages.reduce<Record<string, Page[]>>((result, page) => {
      result[page.module] = [...(result[page.module] || []), page];
      return result;
    }, {});
  }, []);

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
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <h2>{group}</h2>
              {items.map((page) => {
                const Icon = page.icon;
                return (
                  <button key={page.id} className={page.id === activePage.id ? "active" : ""} onClick={() => selectPage(page.id)}>
                    <Icon size={17} />
                    <span>{page.title}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <PageView page={activePage} />
      </section>
    </main>
  );
}

function PageView({ page }: { page: Page }) {
  const Icon = page.icon;
  return (
    <article className="page">
      <div className="page-kicker">
        <Icon size={18} />
        <span>{page.module}</span>
        <strong className={page.ready ? "ready" : "not-ready"}>{page.ready ? "ready" : "not ready"}</strong>
      </div>
      <h1>{page.title}</h1>
      <p>{page.role}</p>
      {page.id === "MICROPHONE_AUDIO_REQUIREMENTS" && <MicrophoneDocs />}
      {page.id === "SYSTEM_MEANINGFUL_AUDIO_CHUNK" && <MeaningfulAudioChunkDebug />}
      {page.id !== "MICROPHONE_AUDIO_REQUIREMENTS" && page.id !== "SYSTEM_MEANINGFUL_AUDIO_CHUNK" && <StaticPage page={page} />}
    </article>
  );
}

function MeaningfulAudioChunkDebug() {
  const [maxDurationMs, setMaxDurationMs] = useState(5000);
  const [silenceMs, setSilenceMs] = useState(900);
  const [speechCheckLang, setSpeechCheckLang] = useState("fr-FR");
  const [mimeType, setMimeType] = useState("");
  const [running, setRunning] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [stack, setStack] = useState<StackItem[]>([]);

  function pushStack(item: Omit<StackItem, "id" | "createdAt">) {
    const next = { id: createId(), createdAt: new Date().toISOString(), ...item };
    setStack((current) => [next, ...current].slice(0, 30));
    return next.id;
  }

  function updateStack(id: string, patch: Partial<StackItem>) {
    setStack((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function runAudioChunk() {
    const input = {
      maxDurationMs,
      silenceMs,
      speechCheckLang,
      mimeType: mimeType || undefined,
      browserNeeds: {
        secureContext: window.isSecureContext,
        getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        speechRecognitionChecker: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
        directUserClick: true,
        requestedMedia: { audio: true, video: false }
      }
    };
    const id = pushStack({
      type: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
      status: "running",
      input
    });

    setRunning(true);
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
          silenceMs,
          speechCheckLang,
          mimeType: mimeType || undefined
        }
      );

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = result.audio ? URL.createObjectURL(result.audio) : "";
      setAudioUrl(nextUrl);
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
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
      updateStack(id, {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="debug-method">
      <div className="explain">
        <h2>What this function does</h2>
        <ul>
          <li>Calls browser microphone permission from a direct button click.</li>
          <li>Requests microphone only: `audio: true`, `video: false`.</li>
          <li>Records audio with `MediaRecorder`.</li>
          <li>If browser SpeechRecognition exists, it uses it only as a speech boundary checker.</li>
          <li>If browser SpeechRecognition is missing, it records until max duration.</li>
          <li>Returns a standard `status` object and audio chunk metadata.</li>
        </ul>
      </div>

      <div className="debug-grid">
        <section className="method-panel">
          <h2>Inputs</h2>
          <label className="field">
            <span>maxDurationMs</span>
            <input type="number" value={maxDurationMs} min={500} step={100} onChange={(event) => setMaxDurationMs(Number(event.target.value))} />
            <small>Maximum recording time. Used when no final speech boundary is detected.</small>
          </label>
          <label className="field">
            <span>silenceMs</span>
            <input type="number" value={silenceMs} min={200} step={100} onChange={(event) => setSilenceMs(Number(event.target.value))} />
            <small>After detected speech activity, this much silence stops the chunk.</small>
          </label>
          <label className="field">
            <span>speechCheckLang</span>
            <input value={speechCheckLang} onChange={(event) => setSpeechCheckLang(event.target.value)} />
            <small>Browser speech checker locale. Example: `fr-FR`, `en-US`, `de-DE`.</small>
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
            speechRecognitionChecker: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
          }, null, 2)}</pre>

          <button className="run-button" type="button" onClick={() => void runAudioChunk()} disabled={running}>
            {running ? "Recording..." : "Run microphone chunk"}
          </button>
        </section>

        <section className="method-panel">
          <h2>Output audio</h2>
          {audioUrl ? (
            <audio controls src={audioUrl} />
          ) : (
            <p>No audio recorded yet.</p>
          )}

          <h2>Whole stack</h2>
          {stack.length === 0 ? (
            <p>No method call yet.</p>
          ) : (
            stack.map((item) => (
              <article className={`stack-item ${item.status}`} key={item.id}>
                <div>
                  <strong>{item.type}</strong>
                  <span>{item.status}</span>
                  <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
                </div>
                <pre>{JSON.stringify({
                  input: item.input,
                  output: item.output,
                  error: item.error
                }, null, 2)}</pre>
              </article>
            ))
          )}
        </section>
      </div>
    </section>
  );
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
