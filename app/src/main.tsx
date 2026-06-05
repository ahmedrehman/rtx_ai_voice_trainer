import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardList,
  Info,
  Mic,
  MicOff,
  MessageSquareText,
  Play,
  Settings2,
  Square,
  Volume2,
  VolumeX
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
}

function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [providerId, setProviderId] = useState<ProviderId>("browser-demo");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [voiceTalk, setVoiceTalk] = useState(true);
  const [alwaysListen, setAlwaysListen] = useState(false);
  const [answerNow, setAnswerNow] = useState(false);
  const [optionalVoice, setOptionalVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [ledger, setLedger] = useState<CostLedger>(() => loadLedger());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartRef = useRef(false);

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
    shouldRestartRef.current = alwaysListen && voiceTalk;
  }, [alwaysListen, voiceTalk]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL
      }).catch(() => undefined);
    }
  }, []);

  function updateSettings(next: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function speak(text: string) {
    if (!optionalVoice) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.recognitionLang;
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    window.speechSynthesis.cancel();
    setStatus("Speech stopped");
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
      forced: Boolean(options.forced || answerNow),
      manualText: Boolean(options.manualText),
      speechInput: Boolean(options.speechInput),
      voiceOutput: optionalVoice,
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
        spoken: optionalVoice,
        createdAt: new Date().toISOString()
      });
      speak(result.spokenText);
      recordCost(result.cost);
      setStatus(correction.trigger === "keyword" ? "Answered by keyword" : "Answered by request");
    } else {
      nextMessages.push({
        id: crypto.randomUUID(),
        speaker: "system",
        text: "Captured silently. No response because no keyword or Answer Now trigger was active.",
        correction,
        spoken: false,
        createdAt: new Date().toISOString()
      });
      setStatus("Captured silently");
    }

    setMessages((current) => [...current, ...nextMessages].slice(-40));
    setDebugEvents((current) => [debugEvent, ...current].slice(0, 50));
    setDraft("");
    setAnswerNow(false);
  }

  function startListening(forceAnswer = false) {
    if (!voiceTalk) {
      setStatus("Voice talk is off");
      return;
    }

    if (!speechSupported) {
      setStatus("Speech recognition is not available in this browser");
      return;
    }

    if (forceAnswer) setAnswerNow(true);
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
      void submitUtterance(transcript, { forced: forceAnswer, speechInput: true });
    };

    recognition.onerror = (event) => {
      setStatus(`Voice error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldRestartRef.current) {
        window.setTimeout(() => startListening(false), 500);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setStatus(forceAnswer ? "Listening for Answer Now" : "Listening");
  }

  function stopListening() {
    shouldRestartRef.current = false;
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
              <h1>{settings.languageName} Trainer</h1>
              <p>{provider.name}</p>
            </div>
          </div>

          <nav className="tabs" aria-label="Views">
            <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
              <MessageSquareText size={18} />
              Chat
            </button>
            <button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>
              <Info size={18} />
              Info
            </button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
              <Settings2 size={18} />
              Settings
            </button>
            <button className={tab === "debug" ? "active" : ""} onClick={() => setTab("debug")}>
              <ClipboardList size={18} />
              Debug
            </button>
          </nav>
        </div>

        <section className="control-panel" aria-label="Voice controls">
          <Toggle label="Voice talk" enabled={voiceTalk} onChange={setVoiceTalk} />
          <Toggle label="Always listen" enabled={alwaysListen} onChange={setAlwaysListen} />
          <Toggle label="Optional voice" enabled={optionalVoice} onChange={setOptionalVoice} />

          <div className="button-row">
            <button className="icon-button primary" onClick={() => startListening(true)} title="Answer now">
              <Play size={18} />
            </button>
            <button className="icon-button" onClick={listening ? stopListening : () => startListening(false)} title={listening ? "Stop listening" : "Listen"}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button className="icon-button" onClick={stopSpeech} title="Stop voice response">
              <Square size={18} />
            </button>
          </div>
          <p className="status">{status}</p>
        </section>
      </aside>

      <section className="workspace">
        {tab === "chat" && (
          <ChatTab
            answerNow={answerNow}
            draft={draft}
            keyword={settings.keyword}
            listening={listening}
            messages={messages}
            setAnswerNow={setAnswerNow}
            setDraft={setDraft}
            settings={settings}
            submitUtterance={submitUtterance}
          />
        )}

        {tab === "info" && (
          <InfoTab
            providerId={providerId}
            setProviderId={setProviderId}
            ledger={ledger}
            recentContext={recentContext}
            resetCosts={resetCosts}
          />
        )}

        {tab === "settings" && (
          <SettingsTab settings={settings} updateSettings={updateSettings} speechSupported={speechSupported} />
        )}

        {tab === "debug" && (
          <DebugTab events={debugEvents} clearEvents={() => setDebugEvents([])} settings={settings} providerId={providerId} />
        )}
      </section>
    </main>
  );
}

function ChatTab({
  answerNow,
  draft,
  keyword,
  listening,
  messages,
  setAnswerNow,
  setDraft,
  settings,
  submitUtterance
}: {
  answerNow: boolean;
  draft: string;
  keyword: string;
  listening: boolean;
  messages: ChatMessage[];
  setAnswerNow: (value: boolean | ((value: boolean) => boolean)) => void;
  setDraft: (value: string) => void;
  settings: AppSettings;
  submitUtterance: (text: string, options?: { forced?: boolean; manualText?: boolean; speechInput?: boolean }) => Promise<void>;
}) {
  return (
    <>
      <div className="chat-header">
        <div>
          <h2>Chat</h2>
          <p>Silent by default. Voice answers only for "{keyword}" or Answer Now.</p>
        </div>
        <div className={`listen-indicator ${listening ? "on" : ""}`}>
          {listening ? <Mic size={16} /> : <MicOff size={16} />}
          {listening ? "Listening" : "Idle"}
        </div>
      </div>

      <div className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <Mic size={34} />
            <p>Speak or type a {settings.languageName} sentence. The trainer captures first and answers only when invited.</p>
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
          placeholder={`Type ${settings.languageName}, or start with "${keyword}"`}
        />
        <button type="button" className={answerNow ? "answer-active" : ""} onClick={() => setAnswerNow((value) => !value)}>
          <Check size={17} />
          Answer Now
        </button>
        <button type="submit">
          <MessageSquareText size={17} />
          Send
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
  return (
    <article className={`message ${message.speaker}`}>
      <div className="message-meta">
        <span>{message.speaker === "learner" ? "You" : message.speaker === "trainer" ? "Trainer" : "System"}</span>
        <span className="meta-icons">
          {settings.showVisualFeedback && message.correction?.visualFeedback === "improvement" && (
            <span className="feedback improvement"><AlertTriangle size={14} /> Improvement</span>
          )}
          {message.spoken ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </span>
      </div>
      <p>{message.text}</p>
      {settings.showStructured && message.correction && <pre>{JSON.stringify(message.correction, null, 2)}</pre>}
    </article>
  );
}

function InfoTab({
  providerId,
  setProviderId,
  ledger,
  recentContext,
  resetCosts
}: {
  providerId: ProviderId;
  setProviderId: (providerId: ProviderId) => void;
  ledger: CostLedger;
  recentContext: ChatMessage[];
  resetCosts: () => void;
}) {
  return (
    <div className="info-grid">
      <section className="info-section">
        <div className="section-title">
          <Settings2 size={19} />
          <h2>Providers</h2>
        </div>
        <div className="provider-list">
          {providerSummaries.map((provider) => (
            <button
              key={provider.id}
              className={providerId === provider.id ? "provider selected" : "provider"}
              onClick={() => setProviderId(provider.id)}
            >
              <span>{provider.name}</span>
              <small>{provider.role}</small>
              <em>{provider.quality}</em>
              <strong>{provider.productionPath}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="info-section">
        <div className="section-title">
          <CircleDollarSign size={19} />
          <h2>Costs</h2>
        </div>
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

      <section className="info-section wide">
        <h2>Structured Context</h2>
        <p>The app keeps recent turns ready for a real provider call.</p>
        <pre>{JSON.stringify(recentContext, null, 2)}</pre>
      </section>
    </div>
  );
}

function SettingsTab({
  settings,
  updateSettings,
  speechSupported
}: {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  speechSupported: boolean;
}) {
  return (
    <div className="settings-grid">
      <section className="info-section">
        <h2>Training</h2>
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
        <h2>Feedback</h2>
        <Toggle label="Show structured JSON" enabled={settings.showStructured} onChange={(value) => updateSettings({ showStructured: value })} />
        <Toggle label="Show visual feedback" enabled={settings.showVisualFeedback} onChange={(value) => updateSettings({ showVisualFeedback: value })} />
        <Toggle label="Short voice hints" enabled={settings.shortVoiceHints} onChange={(value) => updateSettings({ shortVoiceHints: value })} />
        <p className="browser-support">{speechSupported ? "Browser speech recognition is available." : "Browser speech recognition is not available here."}</p>
      </section>
    </div>
  );
}

function DebugTab({
  events,
  clearEvents,
  settings,
  providerId
}: {
  events: DebugEvent[];
  clearEvents: () => void;
  settings: AppSettings;
  providerId: ProviderId;
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
        <h2>Current System Prompt</h2>
        <pre>{events[0]?.systemPrompt || "Server prompt appears after the first correction request."}</pre>
        <p>Provider: {providerId}</p>
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
