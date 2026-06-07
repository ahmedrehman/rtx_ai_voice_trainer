import React, { useState } from "react";
import {
  VOICE_AGENT_CREATE_PROMPTS,
  VOICE_AGENT_SEND_TEXT_CHAT,
  VOICE_AGENT_STREAM_TEXT_CHAT,
  type VoiceAgentSettings
} from "../voice_agent";

type StepState = "pending" | "running" | "done" | "error" | "not_implemented";

type StackItem = {
  id: string;
  type: string;
  status: "running" | "ok" | "error";
  createdAt: string;
  steps?: Array<{ label: string; state: StepState; detail: string }>;
  input?: unknown;
  output?: unknown;
  error?: unknown;
};

export function VoiceAgentFrontendTestPage({
  pageId,
  settings,
  renderFullAppTest
}: {
  pageId: string;
  settings: VoiceAgentSettings;
  renderFullAppTest?: () => React.ReactNode;
}) {
  if (pageId === "APP_FULL_TEST") return renderFullAppTest ? <>{renderFullAppTest()}</> : null;
  if (pageId === "VOICE_AGENT_TEXT_CHAT_TEST") return <VoiceAgentTextChatTestPage settings={settings} />;
  if (pageId === "VOICE_AGENT_STREAM_TEXT_CHAT_TEST") return <VoiceAgentStreamTextChatTestPage settings={settings} />;
  return null;
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
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runStreamTextChatTest() {
    const history = safeJsonArray(historyText);
    const input = {
      endpoint: "/api/voice-agent/text-chat-stream",
      methodId: "VOICE_AGENT_STREAM_TEXT_CHAT",
      settings,
      textUserChat,
      history5LastTextChats: history
    };
    setStreamText("");
    const id = pushStack({
      type: "VOICE_AGENT_STREAM_TEXT_CHAT",
      status: "running",
      input,
      steps: [
        { label: "Build request", state: "done", detail: "Text, topic settings, history, and stream response rule are visible on this page." },
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
          { label: "Build request", state: "done", detail: "Text, topic settings, history, and stream response rule are visible on this page." },
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
        steps: [{ label: "Run streaming text-only test", state: "error", detail: error instanceof Error ? error.message : String(error) }],
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
          <button className="run-button" type="button" onClick={() => void runStreamTextChatTest()} disabled={running || !textUserChat.trim()}>{running ? "Streaming..." : "Run streaming text only"}</button>
        </section>
        <section className="method-panel">
          <h2>Prompt Inputs</h2>
          <label className="field"><span>topic</span><input value={settings.topic} readOnly /></label>
          <label className="field"><span>languageName</span><input value={settings.languageName} readOnly /></label>
          <label className="field"><span>stream response rule</span><textarea value={"Answer in plain text only. Do not return JSON, markdown, field names, flags, debug text, or audio instructions."} readOnly rows={4} /></label>
          <small>The exact stream prompt sent by the server is shown in the start event under Real output / response.</small>
        </section>
      </div>
      <section className="method-panel">
        <h2>Streamed answer</h2>
        <div className="chat-window compact">{streamText || "No stream text yet."}</div>
      </section>
      {stack.length === 0 ? <p>No streaming text-only test run yet.</p> : stack.map((item) => <StackArticle item={item} key={item.id} />)}
    </section>
  );
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

function StackArticle({ item }: { item: StackItem }) {
  return (
    <article className={`stack-item ${item.status}`} key={item.id}>
      <div>
        <strong>{item.type}</strong>
        <span>{item.status}</span>
        <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
      </div>
      {item.steps && (
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

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
