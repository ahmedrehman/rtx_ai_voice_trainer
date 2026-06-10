import { useEffect, useRef, useState } from "react";
import type { DebugPageDefinition } from "../debug_page_types";

export const AUDIO_MICRO_START_DEBUG_PAGE: DebugPageDefinition = {
  id: "AUDIO_MICRO_START_TEST",
  title: "Audio and microphone start test",
  module: "lib_client_voice_system_test",
  role: "isolated iOS audio output, microphone, recorder, and server roundtrip start test",
  ready: true,
  inputs: [],
  actions: [],
  output: [
    "browser audio capability report",
    "speaker unlock result",
    "microphone permission and track settings",
    "local recording playback result",
    "server audio roundtrip result"
  ]
};

type BrowserAudioContextConstructor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: BrowserAudioContextConstructor;
  }
}

type AudioDebugLog = {
  id: string;
  createdAt: string;
  status: "running" | "ok" | "error";
  step: string;
  detail: string;
  data?: unknown;
};

export function AudioMicroStartDebugPage() {
  const [logs, setLogs] = useState<AudioDebugLog[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [roundtripAudioUrl, setRoundtripAudioUrl] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const localAudioUrlRef = useRef("");
  const roundtripAudioUrlRef = useRef("");
  const meterFrameRef = useRef(0);

  useEffect(() => {
    addLog("ok", "Page loaded", "Audio/microphone debug page is isolated from the app turn logic.", browserReport());
    return () => {
      stopMicrophone();
      closeAudioContext(audioContextRef.current);
      if (localAudioUrlRef.current) URL.revokeObjectURL(localAudioUrlRef.current);
      if (roundtripAudioUrlRef.current) URL.revokeObjectURL(roundtripAudioUrlRef.current);
    };
  }, []);

  async function testSoundOutput() {
    setRunning("sound");
    addLog("running", "Sound output", "Trying to resume AudioContext and play a short beep from this user click.", browserReport());
    try {
      const context = await getOutputAudioContext();
      const startedState = context.state;
      await context.resume();
      playBeep(context);
      addLog("ok", "Sound output", "AudioContext resumed and beep was scheduled.", {
        stateBeforeResume: startedState,
        stateAfterResume: context.state,
        sampleRate: context.sampleRate,
        baseLatency: readNumber(context, "baseLatency"),
        outputLatency: readNumber(context, "outputLatency")
      });
    } catch (error) {
      addLog("error", "Sound output", "Audio output did not start.", errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  async function startMicrophone() {
    setRunning("microphone");
    addLog("running", "Microphone", "Requesting microphone stream with getUserMedia({ audio: true }).", browserReport());
    try {
      const stream = await openMicrophoneStream();
      startMicMeter(stream);
      const track = stream.getAudioTracks()[0];
      addLog("ok", "Microphone", "Microphone stream is active.", {
        trackLabel: track?.label,
        trackState: track?.readyState,
        trackEnabled: track?.enabled,
        settings: track?.getSettings?.(),
        constraints: track?.getConstraints?.()
      });
    } catch (error) {
      addLog("error", "Microphone", "Microphone did not start.", errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  async function recordLocalPlayback() {
    setRunning("local_record");
    addLog("running", "Local record", "Recording microphone audio for local playback.", { durationMs: 1600 });
    try {
      const stream = micStreamRef.current || await openMicrophoneStream();
      startMicMeter(stream);
      const blob = await recordOnce(stream, 1600);
      const audioUrl = replaceAudioUrl(localAudioUrlRef, blob, setLocalAudioUrl);
      addLog("ok", "Local record", "Local recording is ready. Use the audio control or Play local recording.", {
        size: blob.size,
        type: blob.type,
        urlCreated: Boolean(audioUrl)
      });
    } catch (error) {
      addLog("error", "Local record", "Local microphone recording failed.", errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  async function serverRoundtrip() {
    setRunning("roundtrip");
    addLog("running", "Server roundtrip", "Recording one microphone pack, sending it to the echo endpoint, then preparing returned audio.", {
      endpoint: "/api/voice-agent/audio-roundtrip",
      durationMs: 1600
    });
    try {
      const stream = micStreamRef.current || await openMicrophoneStream();
      startMicMeter(stream);
      const blob = await recordOnce(stream, 1600);
      const response = await fetch("/api/voice-agent/audio-roundtrip", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob
      });
      if (!response.ok) throw new Error(await response.text().catch(() => `HTTP ${response.status}`));
      const returned = await response.blob();
      const audioUrl = replaceAudioUrl(roundtripAudioUrlRef, returned, setRoundtripAudioUrl);
      addLog("ok", "Server roundtrip", "Server returned audio. Use the audio control or Play server audio.", {
        sent: { size: blob.size, type: blob.type },
        returned: { size: returned.size, type: returned.type },
        urlCreated: Boolean(audioUrl)
      });
    } catch (error) {
      addLog("error", "Server roundtrip", "Server roundtrip failed.", errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  async function playAudioUrl(label: string, url: string) {
    if (!url) {
      addLog("error", label, "No audio URL is available yet.", {});
      return;
    }
    setRunning(label);
    addLog("running", label, "Calling HTMLAudioElement.play() from this button click.", {});
    try {
      const audio = new Audio(url);
      await audio.play();
      addLog("ok", label, "HTML audio playback started.", { paused: audio.paused, readyState: audio.readyState });
    } catch (error) {
      addLog("error", label, "HTML audio playback was blocked or failed.", errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  function stopMicrophone() {
    window.cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = 0;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    closeAudioContext(micContextRef.current);
    micContextRef.current = null;
    setMicActive(false);
    setMicLevel(0);
  }

  async function openMicrophoneStream() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("navigator.mediaDevices.getUserMedia is unavailable.");
    stopMicrophone();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    micStreamRef.current = stream;
    setMicActive(true);
    return stream;
  }

  function startMicMeter(stream: MediaStream) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    closeAudioContext(micContextRef.current);
    const context = new AudioContextConstructor();
    micContextRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      setMicLevel(audioRms(samples));
      meterFrameRef.current = window.requestAnimationFrame(tick);
    };
    void context.resume().catch(() => undefined);
    tick();
  }

  async function getOutputAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("AudioContext is unavailable.");
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextConstructor();
    }
    return audioContextRef.current;
  }

  function addLog(status: AudioDebugLog["status"], step: string, detail: string, data?: unknown) {
    setLogs((current) => [{
      id: createId(),
      createdAt: new Date().toISOString(),
      status,
      step,
      detail,
      data
    }, ...current].slice(0, 30));
  }

  return (
    <section className="debug-method">
      <div className="debug-grid">
        <section className="method-panel">
          <h2>Test buttons</h2>
          <button className="run-button" type="button" onClick={() => void testSoundOutput()} disabled={running !== null}>
            {running === "sound" ? "Testing sound..." : "Test tone / audio output"}
          </button>
          <button className="run-button" type="button" onClick={() => void startMicrophone()} disabled={running !== null}>
            {running === "microphone" ? "Starting microphone..." : "Start microphone"}
          </button>
          <button className="secondary-button" type="button" onClick={stopMicrophone} disabled={!micActive}>
            Stop microphone
          </button>
          <button className="run-button" type="button" onClick={() => void recordLocalPlayback()} disabled={running !== null}>
            {running === "local_record" ? "Recording..." : "Record mic and create local playback"}
          </button>
          <button className="run-button" type="button" onClick={() => void serverRoundtrip()} disabled={running !== null}>
            {running === "roundtrip" ? "Roundtrip running..." : "Record mic and server roundtrip"}
          </button>
        </section>

        <section className="method-panel">
          <h2>Live state</h2>
          <pre>{JSON.stringify({
            running,
            micActive,
            micLevel,
            localAudioReady: Boolean(localAudioUrl),
            serverRoundtripAudioReady: Boolean(roundtripAudioUrl),
            browser: browserReport()
          }, null, 2)}</pre>
          <progress value={Math.min(micLevel, 0.25)} max={0.25} />
        </section>

        <section className="method-panel">
          <h2>Local recording output</h2>
          {localAudioUrl ? <audio controls src={localAudioUrl} /> : <p>No local recording yet.</p>}
          <button className="secondary-button" type="button" onClick={() => void playAudioUrl("Play local recording", localAudioUrl)} disabled={!localAudioUrl || running !== null}>
            Play local recording
          </button>
        </section>

        <section className="method-panel">
          <h2>Server roundtrip output</h2>
          {roundtripAudioUrl ? <audio controls src={roundtripAudioUrl} /> : <p>No server roundtrip audio yet.</p>}
          <button className="secondary-button" type="button" onClick={() => void playAudioUrl("Play server audio", roundtripAudioUrl)} disabled={!roundtripAudioUrl || running !== null}>
            Play server audio
          </button>
        </section>

        <section className="method-panel">
          <h2>Log</h2>
          {logs.length === 0 ? <p>No log entries yet.</p> : logs.map((item) => (
            <article className={`stack-item ${item.status}`} key={item.id}>
              <div>
                <strong>{item.step}</strong>
                <span>{item.status}</span>
                <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
              </div>
              <p>{item.detail}</p>
              {item.data !== undefined && <pre>{JSON.stringify(item.data, null, 2)}</pre>}
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function playBeep(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.38);
}

function recordOnce(stream: MediaStream, durationMs: number) {
  return new Promise<Blob>((resolve, reject) => {
    if (typeof MediaRecorder === "undefined") {
      reject(new Error("MediaRecorder is unavailable."));
      return;
    }
    const chunks: Blob[] = [];
    const mimeType = chooseMediaRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const timeout = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationMs);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("MediaRecorder failed."));
    };
    recorder.onstop = () => {
      window.clearTimeout(timeout);
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size <= 0) {
        reject(new Error("Recorder produced an empty audio blob."));
        return;
      }
      resolve(blob);
    };
    recorder.start(250);
  });
}

function chooseMediaRecorderMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function replaceAudioUrl(currentUrlRef: { current: string }, blob: Blob, setUrl: (value: string) => void) {
  if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
  const nextUrl = URL.createObjectURL(blob);
  currentUrlRef.current = nextUrl;
  setUrl(nextUrl);
  return nextUrl;
}

function closeAudioContext(context: AudioContext | null) {
  if (context && context.state !== "closed") void context.close().catch(() => undefined);
}

function browserReport() {
  return {
    secureContext: window.isSecureContext,
    protocol: window.location.protocol,
    standalone: Boolean((navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia?.("(display-mode: standalone)").matches),
    userAgent: navigator.userAgent,
    audioContext: typeof window.AudioContext !== "undefined",
    webkitAudioContext: typeof window.webkitAudioContext !== "undefined",
    mediaDevices: Boolean(navigator.mediaDevices),
    getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    permissionsApi: Boolean(navigator.permissions),
    visibilityState: document.visibilityState
  };
}

function audioRms(samples: Uint8Array<ArrayBuffer>) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  return Number(Math.sqrt(sum / samples.length).toFixed(4));
}

function readNumber(context: AudioContext, key: "baseLatency" | "outputLatency") {
  const value = (context as unknown as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
