import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  Check,
  ClipboardList,
  Mic,
  MicOff,
  MessageSquareText,
  Settings2,
} from "lucide-react";
import { defaultLedger, providerSummaries } from "./clientConfig";
import { clearLedger, loadLedger, loadSettings, saveLedger, saveSettings } from "./storage";
import type { AppSettings, ChatMessage, CorrectionInput, CorrectionResult, CostBucket, CostLedger, DebugEvent, ProviderId, SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, Tab } from "./types";
import "./styles.css";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [listenEnabled, setListenEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [latestSignal, setLatestSignal] = useState<"none" | "improvement" | "error">("none");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ledger, setLedger] = useState<CostLedger>(() => loadLedger());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listenEnabledRef = useRef(false);
  const correctNextRef = useRef(false);

  const provider = providerSummaries.find((item) => item.id === providerId) ?? providerSummaries[0];
  const speechSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recentContext = useMemo(() => messages.slice(-8), [messages]);

  useEffect(() => {
    saveLedger(ledger);
  }, [ledger]);

  useEffect(() => {
    void refreshCosts();
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    listenEnabledRef.current = listenEnabled;
    if (listenEnabled) {
      startListening();
    } else {
      stopListening();
    }
  }, [listenEnabled]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);
    setInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function updateSettings(next: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  async function installApp() {
    if (!installPrompt) {
      setStatus("Use browser menu to install app");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallPrompt(null);
  }

  function recordCost(bucket: CostBucket) {
    setLedger((current) => ({
      ...current,
      [providerId]: {
        turns: current[providerId].turns + bucket.turns,
        estimatedCost: current[providerId].estimatedCost + bucket.estimatedCost,
        sttCost: current[providerId].sttCost + bucket.sttCost,
        correctionCost: current[providerId].correctionCost + bucket.correctionCost,
        ttsCost: current[providerId].ttsCost + bucket.ttsCost
      }
    }));
  }

  async function refreshCosts() {
    const response = await fetch(apiUrl("/api/costs"));
    if (!response.ok) return;
    setLedger(await response.json() as CostLedger);
  }

  async function resetCosts() {
    const response = await fetch(apiUrl("/api/costs"), { method: "DELETE" });
    setLedger(response.ok ? await response.json() as CostLedger : defaultLedger);
    clearLedger();
  }

  async function submitUtterance(rawText: string, options: { forced?: boolean; manualText?: boolean; speechInput?: boolean } = {}) {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const learnerMessage: ChatMessage = {
      id: crypto.randomUUID(),
      speaker: "learner",
      text: trimmed,
      spoken: false,
      createdAt: new Date().toISOString()
    };

    const request: CorrectionInput = {
      providerId,
      text: trimmed,
      forced: Boolean(options.forced),
      manualText: Boolean(options.manualText),
      speechInput: Boolean(options.speechInput),
      voiceOutput: false,
      history: recentContext,
      settings
    };

    const response = await fetch(apiUrl("/api/correct"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      setStatus("Server correction failed");
      return;
    }

    const result = await response.json() as CorrectionResult;
    const correction = result.correction;
    setLatestSignal(correction.visualFeedback);

    const nextMessages: ChatMessage[] = [learnerMessage];
    const debugEvent: DebugEvent = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      providerId,
      systemPrompt: result.debug.systemPrompt,
      request,
      decision: result.debug.decision,
      response: correction
    };

    if (correction.shouldRespond) {
      nextMessages.push({
        id: crypto.randomUUID(),
        speaker: "trainer",
        text: result.trainerText,
        correction,
        spoken: false,
        createdAt: new Date().toISOString()
      });
      recordCost(result.cost);
      setStatus(correction.trigger === "keyword" ? "Answered by keyword" : "Answered by request");
    } else {
      nextMessages.push({
        id: crypto.randomUUID(),
        speaker: "system",
        text: correction.visualFeedback === "none"
          ? "Captured. No correction signal."
          : "Captured. Correction signal available.",
        correction,
        spoken: false,
        createdAt: new Date().toISOString()
      });
      setStatus(correction.visualFeedback === "none" ? "Captured" : "Correction signal");
    }

    setMessages((current) => [...current, ...nextMessages].slice(-40));
    setDebugEvents((current) => [debugEvent, ...current].slice(0, 50));
    setDraft("");
  }

  function correctNow() {
    if (draft.trim()) {
      void submitUtterance(draft, { forced: true, manualText: true });
      return;
    }

    correctNextRef.current = true;
    setStatus("Correct now armed: speak");
    if (!listenEnabledRef.current) {
      setListenEnabled(true);
    }
  }

  function startListening() {
    if (!speechSupported) {
      setStatus("Speech recognition is not available in this browser");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = settings.recognitionLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const forced = correctNextRef.current;
      correctNextRef.current = false;
      void submitUtterance(transcript, { forced, speechInput: true });
    };

    recognition.onerror = (event) => {
      setStatus(event.error === "no-speech" ? "No speech heard" : `Voice error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (listenEnabledRef.current) {
        window.setTimeout(() => startListening(), 500);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setStatus("Listening");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Listening stopped");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <Bot aria-hidden="true" />
            <div>
              <h1>AI Trainer</h1>
              <p>{provider.name}</p>
            </div>
          </div>

          <nav className="tabs" aria-label="Views">
            <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
              <MessageSquareText size={18} />
              Chat
            </button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
              <Settings2 size={18} />
              Configuration
            </button>
            <button className={tab === "debug" ? "active" : ""} onClick={() => setTab("debug")}>
              <ClipboardList size={18} />
              Debug
            </button>
          </nav>
        </div>

        <section className="control-panel" aria-label="Voice controls">
          <Toggle label="Listen" enabled={listenEnabled} onChange={setListenEnabled} />

          <div className="button-row">
            <button className="text-action primary" onClick={correctNow}>
              <Check size={18} />
              Correct now
            </button>
          </div>
          <p className="status">{status}</p>
        </section>
      </aside>

      <section className="workspace">
        {tab === "chat" && (
          <ChatTab
            draft={draft}
            keyword={settings.keyword}
            latestSignal={latestSignal}
            listening={listening}
            messages={messages}
            setDraft={setDraft}
            settings={settings}
            correctNow={correctNow}
            submitUtterance={submitUtterance}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            providerId={providerId}
            setProviderId={setProviderId}
            settings={settings}
            updateSettings={updateSettings}
            speechSupported={speechSupported}
            installApp={installApp}
            installReady={Boolean(installPrompt)}
            installed={installed}
          />
        )}

        {tab === "debug" && (
          <DebugTab
            events={debugEvents}
            clearEvents={() => setDebugEvents([])}
            ledger={ledger}
            providerId={providerId}
            recentContext={recentContext}
            resetCosts={resetCosts}
          />
        )}
      </section>
    </main>
  );
}

function ChatTab({
  draft,
  keyword,
  latestSignal,
  listening,
  messages,
  setDraft,
  settings,
  correctNow,
  submitUtterance
}: {
  draft: string;
  keyword: string;
  latestSignal: "none" | "improvement" | "error";
  listening: boolean;
  messages: ChatMessage[];
  setDraft: (value: string) => void;
  settings: AppSettings;
  correctNow: () => void;
  submitUtterance: (text: string, options?: { forced?: boolean; manualText?: boolean; speechInput?: boolean }) => Promise<void>;
}) {
  return (
    <>
      <div className="chat-header">
        <div>
          <h2>Chat</h2>
          <p>Listen captures speech. Correct now asks the AI for a correction.</p>
        </div>
        <div className={`listen-indicator ${listening ? "on" : ""}`}>
          {listening ? <Mic size={16} /> : <MicOff size={16} />}
          {listening ? "Listening" : "Idle"}
        </div>
      </div>

      <div className={`signal-banner ${latestSignal}`}>
        <span>correctionSignal={latestSignal}</span>
        <strong>
          {latestSignal === "none"
            ? "No correction needed"
            : latestSignal === "improvement"
              ? "Improvement available"
              : "Important correction"}
        </strong>
      </div>

      <div className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <Mic size={34} />
            <p>Turn on Listen, speak a sentence, then use Correct now when you want the AI to correct it.</p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} settings={settings} />)
        )}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submitUtterance(draft, { manualText: true });
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Type ${settings.languageName}, or say "${keyword}" while listening`}
        />
        <button type="button" onClick={correctNow}>
          <Check size={17} />
          Correct now
        </button>
      </form>
    </>
  );
}

function Toggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <button type="button" className={enabled ? "switch on" : "switch"} onClick={() => onChange(!enabled)} aria-pressed={enabled}>
        <span />
      </button>
    </label>
  );
}

function MessageBubble({ message, settings }: { message: ChatMessage; settings: AppSettings }) {
  const signal = message.correction?.visualFeedback;

  return (
    <article className={`message ${message.speaker}`}>
      <div className="message-meta">
        <span>{message.speaker === "learner" ? "You" : message.speaker === "trainer" ? "Trainer" : "System"}</span>
        <span className="meta-icons">
          {signal && (
            <span className={`feedback ${signal}`}>
              {signal !== "none" && <AlertTriangle size={14} />}
              correctionSignal={signal}
            </span>
          )}
        </span>
      </div>
      <p>{message.text}</p>
    </article>
  );
}

function SettingsTab({
  providerId,
  setProviderId,
  settings,
  updateSettings,
  speechSupported,
  installApp,
  installReady,
  installed
}: {
  providerId: ProviderId;
  setProviderId: (providerId: ProviderId) => void;
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  speechSupported: boolean;
  installApp: () => void;
  installReady: boolean;
  installed: boolean;
}) {
  return (
    <div className="settings-grid">
      <section className="info-section">
        <h2>Configuration</h2>
        <label className="field">
          <span>Provider</span>
          <select value={providerId} onChange={(event) => setProviderId(event.target.value as ProviderId)}>
            {providerSummaries.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </label>
        <p className="provider-note">
          {providerSummaries.find((provider) => provider.id === providerId)?.quality}
        </p>
        <label className="field">
          <span>Language or subject</span>
          <input value={settings.languageName} onChange={(event) => updateSettings({ languageName: event.target.value })} />
        </label>
        <label className="field">
          <span>Speech locale</span>
          <input value={settings.recognitionLang} onChange={(event) => updateSettings({ recognitionLang: event.target.value })} />
        </label>
        <label className="field">
          <span>Topic</span>
          <input value={settings.topic} onChange={(event) => updateSettings({ topic: event.target.value })} />
        </label>
        <label className="field">
          <span>Answer keyword</span>
          <input value={settings.keyword} onChange={(event) => updateSettings({ keyword: event.target.value })} />
        </label>
      </section>

      <section className="info-section">
        <h2>App</h2>
        <button className="secondary-action" onClick={installApp} disabled={installed}>
          {installed ? "Installed" : "Install app"}
        </button>
        <p className="browser-support">
          {installed
            ? "AI Trainer is installed on this device."
            : installReady
              ? "Install is ready for this browser."
              : "On iPhone, use Share, then Add to Home Screen. On Android, use the browser menu if the button is not active."}
        </p>
      </section>

      <section className="info-section">
        <h2>Microphone</h2>
        <p className="browser-support">{speechSupported ? "Browser speech recognition is available." : "Browser speech recognition is not available here."}</p>
      </section>
    </div>
  );
}

function DebugTab({
  events,
  clearEvents,
  ledger,
  providerId,
  recentContext,
  resetCosts
}: {
  events: DebugEvent[];
  clearEvents: () => void;
  ledger: CostLedger;
  providerId: ProviderId;
  recentContext: ChatMessage[];
  resetCosts: () => void;
}) {
  return (
    <div className="debug-view">
      <div className="chat-header">
        <div>
          <h2>Debug Console</h2>
          <p>Inspect system prompts, requests, answers, and app decisions.</p>
        </div>
        <button className="secondary-action" onClick={clearEvents}>Clear</button>
      </div>

      <section className="info-section">
        <h2>Current Signal</h2>
        <div className="decision-grid">
          <span>provider: {providerId}</span>
          <span>correctionSignal: {events[0]?.response.visualFeedback || "none"}</span>
          <span>hasCorrection: {String(Boolean(events[0] && events[0].response.visualFeedback !== "none"))}</span>
          <span>importantError: {String(events[0]?.response.visualFeedback === "error")}</span>
        </div>
      </section>

      <section className="info-section">
        <h2>Costs</h2>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Turns</th>
              <th>STT</th>
              <th>AI</th>
              <th>TTS</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {providerSummaries.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.name}</td>
                <td>{ledger[provider.id].turns}</td>
                <td>${ledger[provider.id].sttCost.toFixed(4)}</td>
                <td>${ledger[provider.id].correctionCost.toFixed(4)}</td>
                <td>${ledger[provider.id].ttsCost.toFixed(4)}</td>
                <td>${ledger[provider.id].estimatedCost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="secondary-action" onClick={resetCosts}>Reset costs</button>
      </section>

      <section className="info-section">
        <h2>Context</h2>
        <pre>{JSON.stringify(recentContext, null, 2)}</pre>
      </section>

      <div className="debug-events">
        {events.length === 0 ? (
          <section className="info-section">
            <p>No debug events yet. Send or speak a sentence to inspect the flow.</p>
          </section>
        ) : (
          events.map((event) => (
            <section className="info-section debug-event" key={event.id}>
              <div className="debug-event-header">
                <h2>{event.decision.trigger}</h2>
                <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="decision-grid">
                <span>keyword: {String(event.decision.keywordSent)}</span>
                <span>respond: {String(event.decision.shouldRespond)}</span>
                <span>speak: {String(event.decision.shouldSpeak)}</span>
                <span>provider: {event.providerId}</span>
                <span>correctionSignal: {event.response.visualFeedback}</span>
                <span>hasCorrection: {String(event.response.visualFeedback !== "none")}</span>
                <span>importantError: {String(event.response.visualFeedback === "error")}</span>
              </div>
              <details open>
                <summary>Request</summary>
                <pre>{JSON.stringify(event.request, null, 2)}</pre>
              </details>
              <details open>
                <summary>Response</summary>
                <pre>{JSON.stringify(event.response, null, 2)}</pre>
              </details>
              <details>
                <summary>System Prompt</summary>
                <pre>{event.systemPrompt}</pre>
              </details>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
