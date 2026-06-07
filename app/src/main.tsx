import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Archive, BookOpen, Database, FileAudio, Home, Menu, Mic, Server, Volume2, X } from "lucide-react";
import type { DebugPageDefinition } from "./debug_page_types";
import {
  SYSTEM_AUDIO_ENERGY_CHECK,
  SYSTEM_AUDIO_TO_SPEAKER,
  SYSTEM_AUDIO_TO_TEXT,
  SYSTEM_MEANINGFUL_AUDIO_CHUNK,
  SYSTEM_MICRO_TO_AUDIO,
  SYSTEM_TEXT_TO_AUDIO
} from "./lib_client_voice_system";
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
  business?: unknown;
  steps?: Array<{ label: string; state: "pending" | "running" | "done" | "error" | "not_implemented"; detail: string }>;
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
  const debugGroups = useMemo(() => {
    return pages.filter((page) => page.id !== "start").reduce<Record<string, Page[]>>((result, page) => {
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
          <section>
            <h2>App</h2>
            <button className={activePage.id === "start" ? "active" : ""} onClick={() => selectPage("start")}>
              <Home size={17} />
              <span>Start</span>
            </button>
          </section>
          <section>
            <h2>Debug</h2>
            {Object.entries(debugGroups).map(([group, items]) => (
              <details className="nav-submenu" open key={group}>
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
      {page.id === "SYSTEM_AUDIO_ENERGY_CHECK" && <AudioEnergyCheckDebug />}
      {page.id === "SYSTEM_MICRO_TO_AUDIO" && <MicroToAudioDebug />}
      {page.id === "SYSTEM_AUDIO_TO_TEXT" && <AudioToTextDebug />}
      {page.id === "SYSTEM_TEXT_TO_AUDIO" && <TextToAudioDebug />}
      {page.id === "SYSTEM_AUDIO_TO_SPEAKER" && <AudioToSpeakerDebug />}
      {![
        "MICROPHONE_AUDIO_REQUIREMENTS",
        "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
        "SYSTEM_AUDIO_ENERGY_CHECK",
        "SYSTEM_MICRO_TO_AUDIO",
        "SYSTEM_AUDIO_TO_TEXT",
        "SYSTEM_TEXT_TO_AUDIO",
        "SYSTEM_AUDIO_TO_SPEAKER"
      ].includes(page.id) && <StaticPage page={page} />}
    </article>
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
        { label: "Start recorder", state: audioRecorded ? "done" : "error", detail: audioRecorded ? "MediaRecorder produced an audio blob." : "No audio blob was produced." },
        {
          label: "Speech helper",
          state: speechCheckerAvailable ? (speechFound ? "done" : "error") : "not_implemented",
          detail: speechCheckerAvailable
            ? speechFound
              ? "Browser SpeechRecognition produced helper text."
              : "Browser SpeechRecognition was available but produced no helper text."
            : "Browser SpeechRecognition was unavailable."
        },
        {
          label: "Audio energy check",
          state: result.energyCheck.available ? (energyFound ? "done" : "error") : "not_implemented",
          detail: result.energyCheck.available
            ? `SYSTEM_AUDIO_ENERGY_CHECK: maxRms ${result.energyCheck.maxRms}, active ${result.energyCheck.activeMs}ms, threshold ${result.energyCheck.threshold}, required ${result.energyCheck.minActiveMs}ms.`
            : `SYSTEM_AUDIO_ENERGY_CHECK unavailable. ${result.energyCheck.error || ""}`
        },
        { label: "Real VAD", state: "not_implemented", detail: "Not implemented. WebRTC VAD / ML VAD is not wired yet." },
        { label: "Stop recording", state: "done", detail: humanChunkReason(result.chunkReason) },
        {
          label: "Business decision: useful chunk?",
          state: usefulChunk ? "done" : "error",
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
          { label: "Decide sound", state: hasSound ? "done" : "error", detail: String(business.business_reason) }
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
          { label: "Record audio", state: recorded ? "done" : "error", detail: recorded ? "Audio blob exists." : "No audio blob exists." },
          { label: "Business decision", state: recorded ? "done" : "error", detail: String(business.business_reason) }
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
  const [running, setRunning] = useState(false);
  const { stack, pushStack, updateStack } = useDebugStack();

  async function runListen() {
    const input = {
      lang,
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
      const result = await SYSTEM_AUDIO_TO_TEXT({ logger: loggerFor(pushStack) }, { lang });
      const hasText = Boolean(result.text.trim());
      const business = {
        BUSINESS_DECISION: `TEXT_DETECTED=${hasText ? "YES" : "NO"}`,
        decision_ok: hasText,
        business_decision: hasText ? "TEXT_DETECTED" : "NO_TEXT",
        business_reason: hasText ? "Browser SpeechRecognition returned text." : "Browser SpeechRecognition returned no text or failed.",
        send_to_ai: "NO_NOT_THIS_FUNCTION",
        method: "SYSTEM_AUDIO_TO_TEXT",
        note: "Browser helper only. Not AI transcription and not pronunciation analysis."
      };
      updateStack(id, {
        status: result.status.ok ? "ok" : "error",
        business,
        output: result,
        steps: [
          { label: "Start browser speech recognition", state: result.status.ok ? "done" : "error", detail: result.status.ok ? "Browser returned a result." : String(result.status.error || "Browser speech recognition failed.") },
          { label: "Business decision", state: hasText ? "done" : "error", detail: String(business.business_reason) }
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
          { label: "Business decision", state: result.spoken ? "done" : "error", detail: String(business.business_reason) }
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
          { label: "Business decision", state: result.played ? "done" : "error", detail: String(business.business_reason) }
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

function StackArticle({ item, compact = false }: { item: StackItem; compact?: boolean }) {
  const business = item.business as Record<string, unknown> | undefined;
  const businessDecision = business?.BUSINESS_DECISION_USEFUL_CHUNK !== undefined
    ? `USEFUL CHUNK = ${String(business.BUSINESS_DECISION_USEFUL_CHUNK)}`
    : String(business?.BUSINESS_DECISION || "");
  const decisionOk = business?.decision_ok === true || business?.BUSINESS_DECISION_USEFUL_CHUNK === "YES";

  return (
    <article className={`stack-item ${item.status}`} key={item.id}>
      <div>
        <strong>{item.type}</strong>
        <span>{item.status}</span>
        <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
      </div>
      {business !== undefined && (
        <section className={`decision-result ${decisionOk ? "yes" : "no"}`}>
          <strong>BUSINESS DECISION: {businessDecision}</strong>
          <span>SEND TO AI: {String(business.send_to_ai)}</span>
          <p>{String(business.business_reason)}</p>
        </section>
      )}
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
      {business !== undefined && (
        <section className="business-result">
          <h3>Business object</h3>
          <pre>{JSON.stringify(business, null, 2)}</pre>
        </section>
      )}
      <details>
        <summary>Raw item JSON</summary>
        <pre>{JSON.stringify({
          business: item.business,
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
