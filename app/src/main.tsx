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
  Play,
  Settings2,
  Volume2,
  Square,
} from "lucide-react";
import { defaultLedger, providerSummaries } from "./clientConfig";
import { clearLedger, loadLedger, loadSettings, saveLedger, saveSettings } from "./storage";
import type { AppSettings, ChatMessage, CorrectionInput, CorrectionResult, CostBucket, CostLedger, DebugEvent, ProviderId, SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, StructuredCorrection, Tab } from "./types";
import type { VoiceImplementation } from "./types";
import { base64ToAudioBlob, blobToBase64, voiceImplementationLabel, voiceImplementationOptions } from "./voiceTrainer";
import "./styles.css";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
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

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const data = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, data.length * 2, true);

  let dataOffset = 44;
  for (const sample of data) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(dataOffset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    dataOffset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [activityEvents, setActivityEvents] = useState<Array<{ id: string; createdAt: string; label: string; detail: string }>>([]);
  const [draft, setDraft] = useState("");
  const [listenEnabled, setListenEnabled] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [latestSignal, setLatestSignal] = useState<"none" | "improvement" | "error">("none");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ledger, setLedger] = useState<CostLedger>(() => loadLedger());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const wavForcedRef = useRef(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const listenEnabledRef = useRef(false);
  const speakEnabledRef = useRef(false);
  const correctNextRef = useRef(false);

  const provider = providerSummaries.find((item) => item.id === providerId) ?? providerSummaries[0];
  const speechSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const browserSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const microphoneSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const recordingSupported = microphoneSupported && typeof MediaRecorder !== "undefined";
  const recentContext = useMemo(() => messages.slice(-5), [messages]);

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
    const onError = (event: ErrorEvent) => {
      logActivity("Browser error", event.message || "Unknown browser error");
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "Unknown promise rejection");
      logActivity("Promise error", reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    logActivity("Browser capabilities", browserCapabilitySummary());
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

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

  function logActivity(label: string, detail: string) {
    setActivityEvents((current) => [
      { id: createId(), createdAt: new Date().toISOString(), label, detail },
      ...current
    ].slice(0, 30));
  }

  function browserCapabilitySummary() {
    return [
      `SpeechRecognition=${speechSupported ? "yes" : "no"}`,
      `BrowserDummySpeech=${browserSpeechSupported ? "yes" : "no"}`,
      `getUserMedia=${microphoneSupported ? "yes" : "no"}`,
      `MediaRecorder=${recordingSupported ? "yes" : "no"}`,
      `secureContext=${window.isSecureContext ? "yes" : "no"}`
    ].join(", ");
  }

  function toggleSpeak(enabled: boolean) {
    speakEnabledRef.current = enabled;
    setSpeakEnabled(enabled);
    logActivity(enabled ? "Speak enabled" : "Speak disabled", enabled ? "AI voice may play for explicit answers" : "AI voice output disabled");
    if (!enabled) {
      stopPlayback();
    }
  }

  async function speakWithProvider(text: string, reason: string, force = false) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!force && !speakEnabledRef.current) {
      logActivity("Speech skipped", "SPEAK is off");
      return;
    }

    try {
      stopPlayback();
      setSpeaking(true);
      setStatus("Generating voice");
      logActivity("AI voice request", reason);

      const response = await fetch(apiUrl("/api/speak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          text: trimmed,
          voice: "coral",
          languageName: settings.languageName,
          style: "short correction, calm teacher"
        })
      });

      if (!response.ok) {
        const detail = await responseErrorMessage(response);
        throw new Error(detail || `AI voice failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("AI voice returned empty audio");
      }

      const url = URL.createObjectURL(blob);
      playbackUrlRef.current = url;
      const audio = new Audio(url);
      playbackRef.current = audio;
      audio.onplay = () => {
        setStatus("Playing AI voice");
        logActivity("AI voice playing", `${Math.round(blob.size / 1024)} KB audio`);
      };
      audio.onended = () => {
        setSpeaking(false);
        setStatus("Ready");
        logActivity("AI voice ended", reason);
        cleanupPlaybackUrl();
      };
      audio.onerror = () => {
        setSpeaking(false);
        const message = "Audio playback failed";
        setStatus(message);
        logActivity("Audio playback error", message);
        cleanupPlaybackUrl();
      };
      await audio.play();
    } catch (error) {
      setSpeaking(false);
      const message = error instanceof Error ? error.message : "AI voice failed";
      setStatus(message);
      logActivity("AI voice error", message);
    }
  }

  async function responseErrorMessage(response: Response) {
    const text = await response.text().catch(() => "");
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string") return parsed.error;
      if (parsed.error && typeof parsed.error === "object" && "message" in parsed.error) {
        return String((parsed.error as { message?: unknown }).message || text);
      }
    } catch {
      return text;
    }
    return text;
  }

  function dummySpeak(text: string) {
    const trimmed = text.trim() || "Bonjour. Ceci est un test de voix.";
    if (!browserSpeechSupported) {
      const message = "Dummy speak is not supported in this browser";
      setStatus(message);
      logActivity("Dummy speak error", message);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = settings.recognitionLang || "fr-FR";
    utterance.rate = 0.95;
    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("Dummy speaking");
      logActivity("Dummy speak started", "Browser speech synthesis");
    };
    utterance.onend = () => {
      setSpeaking(false);
      setStatus("Ready");
      logActivity("Dummy speak ended", "Browser speech synthesis");
    };
    utterance.onerror = (event) => {
      setSpeaking(false);
      const message = `Dummy speak failed: ${event.error}`;
      setStatus(message);
      logActivity("Dummy speak error", message);
    };
    window.speechSynthesis.speak(utterance);
  }

  function testSpeak() {
    if (settings.voiceImplementation === "dummy") {
      dummySpeak("Bonjour. Ceci est un test de voix.");
      return;
    }
    if (settings.voiceImplementation === "audio-ai") {
      void testAudioAiTurn();
      return;
    }
    void speakWithProvider("Bonjour. Ceci est un test de voix IA.", "Manual AI voice test", true);
  }

  async function testAudioAiTurn() {
    if (!microphoneSupported) {
      const message = "Microphone API is not available";
      setStatus(message);
      logActivity("Audio AI error", message);
      return;
    }

    try {
      stopPlayback();
      setStatus("Recording audio AI test");
      logActivity("Audio AI record", "Recording 4 seconds of raw audio");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        const message = "AudioContext is not available";
        setStatus(message);
        logActivity("Audio AI error", message);
        return;
      }

      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];

      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(context.destination);
      setListening(true);

      window.setTimeout(() => {
        processor.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        const sampleRate = context.sampleRate || 44100;
        void context.close();
        setListening(false);

        if (!chunks.length) {
          const message = "No audio was recorded for audio AI test";
          setStatus(message);
          logActivity("Audio AI error", message);
          return;
        }

        const wav = encodeWav(chunks, sampleRate);
        void runAudioAiTurn(wav);
      }, 4000);
    } catch (error) {
      setListening(false);
      const message = error instanceof Error ? error.message : "Audio AI recording failed";
      setStatus(message);
      logActivity("Audio AI error", message);
    }
  }

  async function runAudioAiTurn(blob: Blob) {
    try {
      setStatus("Sending audio to AI");
      logActivity("Audio AI request", `${Math.round(blob.size / 1024)} KB wav`);
      const audioBase64 = await blobToBase64(blob);
      const response = await fetch(apiUrl("/api/audio-turn"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          audioBase64,
          audioFormat: "wav",
          voice: "coral",
          settings
        })
      });

      if (!response.ok) {
        const detail = await responseErrorMessage(response);
        throw new Error(detail || `Audio AI failed with HTTP ${response.status}`);
      }

      const result = await response.json() as {
        text?: string;
        audioBase64?: string;
        audioFormat?: string;
        model?: string;
      };
      logActivity("Audio AI text", result.text || "No text returned");
      if (result.audioBase64) {
        await playBase64Audio(result.audioBase64, result.audioFormat || "wav", `audio-ai ${result.model || ""}`.trim());
      } else {
        setStatus("Audio AI returned no audio");
        logActivity("Audio AI error", "No audio returned by model");
      }
    } catch (error) {
      setSpeaking(false);
      const message = error instanceof Error ? error.message : "Audio AI failed";
      setStatus(message);
      logActivity("Audio AI error", message);
    }
  }

  async function playBase64Audio(audioBase64: string, format: string, reason: string) {
    stopPlayback();
    setSpeaking(true);
    const blob = base64ToAudioBlob(audioBase64, format);
    const url = URL.createObjectURL(blob);
    playbackUrlRef.current = url;
    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.onplay = () => {
      setStatus("Playing AI audio turn");
      logActivity("Audio AI playing", `${Math.round(blob.size / 1024)} KB ${format}`);
    };
    audio.onended = () => {
      setSpeaking(false);
      setStatus("Ready");
      logActivity("Audio AI ended", reason);
      cleanupPlaybackUrl();
    };
    audio.onerror = () => {
      setSpeaking(false);
      const message = "Audio AI playback failed";
      setStatus(message);
      logActivity("Audio AI playback error", message);
      cleanupPlaybackUrl();
    };
    await audio.play();
  }

  function testListen() {
    logActivity("Test listen", "Starting listen test");
    correctNextRef.current = true;
    enableListening();
    window.setTimeout(() => {
      if (listenEnabledRef.current || mediaRecorderRef.current?.state === "recording" || audioContextRef.current) {
        logActivity("Test listen", "Auto-stopping listen test");
        disableListening();
      }
    }, 5000);
  }

  function stopPlayback() {
    playbackRef.current?.pause();
    playbackRef.current = null;
    cleanupPlaybackUrl();
    if (browserSpeechSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function cleanupPlaybackUrl() {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }

  function stopAll() {
    listenEnabledRef.current = false;
    setListenEnabled(false);
    stopListening();
    stopPlayback();
    setStatus("Stopped");
    logActivity("Stop", "Stopped listening and audio playback");
  }

  async function installApp() {
    if (!installPrompt) {
      setStatus("Use the install option in this device menu");
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

  async function transcribeAudio(blob: Blob) {
    const formData = new FormData();
    const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") ? "mp4" : "webm";
    formData.append("file", blob, `speech.${extension}`);
    formData.append("model", "gpt-4o-mini-transcribe");

    const response = await fetch(apiUrl("/api/transcribe"), {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `Audio transcription failed with HTTP ${response.status}`);
    }

    const data = await response.json() as { text?: string; error?: string };
    if (data.error) throw new Error(data.error);
    return (data.text || "").trim();
  }

  async function transcribeAndSubmit(blob: Blob, forced: boolean) {
    try {
      setStatus("Transcribing");
      logActivity("Transcribing", `${Math.round(blob.size / 1024)} KB audio`);
      const transcript = await transcribeAudio(blob);
      if (!transcript) {
        setStatus("No speech heard");
        logActivity("No speech heard", "Transcription returned empty text");
        return;
      }
      logActivity("Transcript", transcript);
      await submitUtterance(transcript, { forced, speechInput: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audio transcription failed";
      setStatus(message);
      logActivity("Transcription error", message);
    }
  }

  async function submitUtterance(rawText: string, options: { forced?: boolean; manualText?: boolean; speechInput?: boolean } = {}) {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    logActivity("Correction request", trimmed);

    const learnerMessage: ChatMessage = {
      id: createId(),
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
      voiceOutput: speakEnabledRef.current,
      history: recentContext,
      settings
    };

    let result: CorrectionResult;
    try {
      setStatus("Correcting");
      const response = await fetch(apiUrl("/api/correct"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Server correction failed with HTTP ${response.status}`);
      }

      result = await response.json() as CorrectionResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server correction failed";
      const correction = technicalCorrection(request, message);
      const debugEvent: DebugEvent = {
        id: createId(),
        createdAt: new Date().toISOString(),
        providerId,
        systemPrompt: "Request failed before server returned debug prompt.",
        request,
        decision: {
          keywordSent: false,
          shouldRespond: true,
          shouldSpeak: false,
          trigger: request.forced ? "button" : request.manualText ? "manual-text" : "silent"
        },
        response: correction
      };
      setStatus(message);
      logActivity("Correction error", message);
      setLatestSignal("error");
      setMessages((current) => [
        ...current,
        learnerMessage,
        {
          id: createId(),
          speaker: "system",
          text: `Technical error: ${message}`,
          correction,
          spoken: false,
          createdAt: new Date().toISOString()
        } satisfies ChatMessage
      ].slice(-40));
      setDebugEvents((current) => [debugEvent, ...current].slice(0, 50));
      return;
    }

    const correction = result.correction;
    setLatestSignal(correction.visualFeedback);
    logActivity("Correction result", `correctionSignal=${correction.visualFeedback}`);

    const nextMessages: ChatMessage[] = [learnerMessage];
    const debugEvent: DebugEvent = {
      id: createId(),
      createdAt: new Date().toISOString(),
      providerId,
      systemPrompt: result.debug.systemPrompt,
      request,
      decision: result.debug.decision,
      response: correction
    };

    if (correction.shouldRespond) {
      const willSpeak = speakEnabledRef.current && Boolean(result.spokenText || result.trainerText);
      nextMessages.push({
        id: createId(),
        speaker: "trainer",
        text: result.trainerText,
        correction,
        spoken: willSpeak,
        createdAt: new Date().toISOString()
      });
      recordCost(result.cost);
      setStatus(correction.trigger === "keyword" ? "Answered by keyword" : "Answered by request");
      if (willSpeak) {
        if (settings.voiceImplementation === "dummy") {
          dummySpeak(result.spokenText || result.trainerText);
        } else {
          void speakWithProvider(result.spokenText || result.trainerText, `${voiceImplementationLabel(settings.voiceImplementation)} trigger=${correction.trigger}`);
        }
      }
    } else {
      nextMessages.push({
        id: createId(),
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

  function technicalCorrection(request: CorrectionInput, message: string): StructuredCorrection {
    return {
      text: request.text,
      corrected: request.text,
      keywordSent: false,
      shouldRespond: true,
      trigger: request.forced ? "button" : request.manualText ? "manual-text" : "silent",
      notes: [message],
      visualFeedback: "error",
      topic: request.settings.topic,
      languageName: request.settings.languageName
    };
  }

  function correctNow() {
    logActivity("Correct now", draft.trim() ? "Correcting typed text" : "Waiting for speech");
    if (draft.trim()) {
      void submitUtterance(draft, { forced: true, manualText: true });
      return;
    }

    correctNextRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      setStatus("Correcting recorded speech");
      mediaRecorderRef.current.stop();
      return;
    }

    if (audioContextRef.current) {
      setStatus("Correcting recorded speech");
      stopWavRecording();
      return;
    }

    setStatus("Correct now armed: speak");
    if (!listenEnabledRef.current) {
      enableListening();
    }
  }

  function toggleListening(enabled: boolean) {
    if (enabled) {
      enableListening();
    } else {
      disableListening();
    }
  }

  function enableListening() {
    listenEnabledRef.current = true;
    setListenEnabled(true);
    startListening();
  }

  function disableListening() {
    listenEnabledRef.current = false;
    setListenEnabled(false);
    stopListening();
  }

  function handleAudioFile(file: File | undefined) {
    if (!file) {
      setListenEnabled(false);
      listenEnabledRef.current = false;
      setStatus("No audio selected");
      logActivity("Audio input cancelled", "No audio file was selected");
      return;
    }

    const forced = correctNextRef.current;
    correctNextRef.current = false;
    setListenEnabled(false);
    listenEnabledRef.current = false;
    void transcribeAndSubmit(file, forced);
  }

  function startListening() {
    logActivity("Listen enabled", speechSupported ? "Using live speech capture" : "Using audio capture fallback");
    if (!speechSupported) {
      void startAudioRecording();
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
      logActivity("Speech captured", transcript || "Empty transcript");
      void submitUtterance(transcript, { forced, speechInput: true });
    };

    recognition.onerror = (event) => {
      const message = event.error === "no-speech" ? "No speech heard" : `Voice error: ${event.error}`;
      setStatus(message);
      logActivity("Speech recognition error", message);
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

  async function startAudioRecording() {
    if (!microphoneSupported) {
      setStatus("Open audio recorder");
      logActivity("Audio recorder fallback", "This device requires native audio capture");
      audioInputRef.current?.click();
      return;
    }

    if (!recordingSupported) {
      await startWavRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setListenEnabled(false);
        const forced = correctNextRef.current;
        correctNextRef.current = false;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (blob.size > 0) {
          void transcribeAndSubmit(blob, forced);
        } else {
          setStatus("No speech heard");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
      setStatus("Recording");
      logActivity("Recording started", "Microphone permission granted");
    } catch (error) {
      setListenEnabled(false);
      setListening(false);
      const message = error instanceof Error ? error.message : "Microphone permission failed";
      setStatus(message);
      logActivity("Microphone error", message);
    }
  }

  async function startWavRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        setStatus("Open audio recorder");
        logActivity("Audio recorder fallback", "This device requires native audio capture");
        audioInputRef.current?.click();
        return;
      }

      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      pcmChunksRef.current = [];
      wavForcedRef.current = correctNextRef.current;

      processor.onaudioprocess = (event) => {
        pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(context.destination);
      audioContextRef.current = context;
      audioStreamRef.current = stream;
      audioProcessorRef.current = processor;
      setListening(true);
      setStatus("Recording");
      logActivity("Recording started", "Microphone permission granted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Microphone permission failed";
      setListenEnabled(false);
      setListening(false);
      setStatus(message);
      logActivity("Microphone error", message);
    }
  }

  function stopWavRecording() {
    const context = audioContextRef.current;
    const processor = audioProcessorRef.current;
    const stream = audioStreamRef.current;
    const chunks = pcmChunksRef.current;
    const forced = wavForcedRef.current || correctNextRef.current;

    processor?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close();

    audioContextRef.current = null;
    audioProcessorRef.current = null;
    audioStreamRef.current = null;
    pcmChunksRef.current = [];
    wavForcedRef.current = false;
    correctNextRef.current = false;
    setListening(false);
    setListenEnabled(false);

    if (!chunks.length) {
      setStatus("No speech heard");
      logActivity("No speech heard", "No audio was recorded");
      return;
    }

    const sampleRate = context?.sampleRate || 44100;
    const wav = encodeWav(chunks, sampleRate);
    void transcribeAndSubmit(wav, forced);
  }

  function stopListening() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    if (audioContextRef.current) {
      stopWavRecording();
      return;
    }
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Listening stopped");
    logActivity("Listen disabled", "Stopped listening");
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
          <Toggle label="Listen" enabled={listenEnabled} onChange={toggleListening} />
          <Toggle label="Speak" enabled={speakEnabled} onChange={toggleSpeak} />

          <div className="button-row">
            <button className="text-action primary" onClick={correctNow}>
              <Check size={18} />
              Correct now
            </button>
            <button className="text-action" onClick={testSpeak}>
              <Play size={18} />
              Test voice
            </button>
          </div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            capture
            className="hidden-file-input"
            onChange={(event) => {
              handleAudioFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
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
            speaking={speaking}
            messages={messages}
            setDraft={setDraft}
            settings={settings}
            correctNow={correctNow}
            submitUtterance={submitUtterance}
            speakEnabled={speakEnabled}
            toggleListening={toggleListening}
            toggleSpeak={toggleSpeak}
            testSpeak={testSpeak}
            stopAll={stopAll}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            providerId={providerId}
            setProviderId={setProviderId}
            settings={settings}
            updateSettings={updateSettings}
            speechSupported={speechSupported}
            browserSpeechSupported={browserSpeechSupported}
            microphoneSupported={microphoneSupported}
            recordingSupported={recordingSupported}
            installApp={installApp}
            installReady={Boolean(installPrompt)}
            installed={installed}
          />
        )}

        {tab === "debug" && (
          <DebugTab
            events={debugEvents}
            activityEvents={activityEvents}
            listenEnabled={listenEnabled}
            listening={listening}
            speakEnabled={speakEnabled}
            speaking={speaking}
            status={status}
            voiceImplementation={settings.voiceImplementation}
            draft={draft}
            setDraft={setDraft}
            correctNow={correctNow}
            submitUtterance={submitUtterance}
            toggleListening={toggleListening}
            toggleSpeak={toggleSpeak}
            testSpeak={testSpeak}
            testAudioAiTurn={testAudioAiTurn}
            testListen={testListen}
            dummySpeak={() => dummySpeak(draft)}
            stopAll={stopAll}
            capabilitySummary={browserCapabilitySummary()}
            clearEvents={() => {
              setDebugEvents([]);
              setActivityEvents([]);
            }}
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
  speaking,
  messages,
  setDraft,
  settings,
  correctNow,
  submitUtterance,
  speakEnabled,
  stopAll
}: {
  draft: string;
  keyword: string;
  latestSignal: "none" | "improvement" | "error";
  listening: boolean;
  speaking: boolean;
  messages: ChatMessage[];
  setDraft: (value: string) => void;
  settings: AppSettings;
  correctNow: () => void;
  submitUtterance: (text: string, options?: { forced?: boolean; manualText?: boolean; speechInput?: boolean }) => Promise<void>;
  speakEnabled: boolean;
  toggleListening: (enabled: boolean) => void;
  toggleSpeak: (enabled: boolean) => void;
  testSpeak: () => void;
  stopAll: () => void;
}) {
  return (
    <>
      <div className="chat-header">
        <div>
          <h2>Chat</h2>
          <p>Listen captures speech. Correct now asks the AI for a correction.</p>
        </div>
        <div className="header-status">
          <div className={`listen-indicator ${listening ? "on" : ""}`}>
            {listening ? <Mic size={16} /> : <MicOff size={16} />}
            {listening ? "Listening" : "Idle"}
          </div>
          <div className={`listen-indicator ${speaking ? "on" : ""}`}>
            <Volume2 size={16} />
            {speaking ? "AI voice" : speakEnabled ? "Speak on" : "Speak off"}
          </div>
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
        <button type="button" onClick={stopAll}>
          <Square size={17} />
          Stop
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
  browserSpeechSupported,
  microphoneSupported,
  recordingSupported,
  installApp,
  installReady,
  installed
}: {
  providerId: ProviderId;
  setProviderId: (providerId: ProviderId) => void;
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  speechSupported: boolean;
  browserSpeechSupported: boolean;
  microphoneSupported: boolean;
  recordingSupported: boolean;
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
        <label className="field">
          <span>Voice implementation</span>
          <select value={settings.voiceImplementation} onChange={(event) => updateSettings({ voiceImplementation: event.target.value as VoiceImplementation })}>
            {voiceImplementationOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <p className="provider-note">
          {voiceImplementationOptions.find((option) => option.id === settings.voiceImplementation)?.description}
        </p>
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
              ? "Install is ready on this device."
              : "On iPhone, use Share, then Add to Home Screen. On Android, use the menu if the button is not active."}
        </p>
      </section>

      <section className="info-section">
        <h2>Microphone</h2>
        <p className="browser-support">{speechSupported ? "Live speech capture is available." : "Live speech capture is not available; audio capture fallback will be used."}</p>
        <div className="decision-grid">
          <span>microphone: {microphoneSupported ? "yes" : "no"}</span>
          <span>media recorder: {recordingSupported ? "yes" : "no"}</span>
          <span>dummy speak: {browserSpeechSupported ? "yes" : "no"}</span>
        </div>
      </section>
    </div>
  );
}

function DebugTab({
  events,
  activityEvents,
  listenEnabled,
  listening,
  speakEnabled,
  speaking,
  status,
  voiceImplementation,
  draft,
  setDraft,
  correctNow,
  submitUtterance,
  toggleListening,
  toggleSpeak,
  testSpeak,
  testAudioAiTurn,
  testListen,
  dummySpeak,
  stopAll,
  capabilitySummary,
  clearEvents,
  ledger,
  providerId,
  recentContext,
  resetCosts
}: {
  events: DebugEvent[];
  activityEvents: Array<{ id: string; createdAt: string; label: string; detail: string }>;
  listenEnabled: boolean;
  listening: boolean;
  speakEnabled: boolean;
  speaking: boolean;
  status: string;
  voiceImplementation: VoiceImplementation;
  draft: string;
  setDraft: (value: string) => void;
  correctNow: () => void;
  submitUtterance: (text: string, options?: { forced?: boolean; manualText?: boolean; speechInput?: boolean }) => Promise<void>;
  toggleListening: (enabled: boolean) => void;
  toggleSpeak: (enabled: boolean) => void;
  testSpeak: () => void;
  testAudioAiTurn: () => void;
  testListen: () => void;
  dummySpeak: () => void;
  stopAll: () => void;
  capabilitySummary: string;
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
        <h2>Test Controls</h2>
        <div className="debug-control-grid">
          <Toggle label="LISTEN" enabled={listenEnabled} onChange={toggleListening} />
          <Toggle label="SPEAK" enabled={speakEnabled} onChange={toggleSpeak} />
          <button className="text-action primary" onClick={correctNow}>
            <Check size={18} />
            SEND
          </button>
          <button className="text-action" onClick={testListen}>
            <Mic size={18} />
            TEST LISTEN
          </button>
          <button className="text-action" onClick={testSpeak}>
            <Volume2 size={18} />
            TEST CHAINED VOICE
          </button>
          <button className="text-action" onClick={testAudioAiTurn}>
            <Volume2 size={18} />
            TEST AUDIO AI
          </button>
          <button className="text-action" onClick={dummySpeak}>
            <Play size={18} />
            DUMMY SPEAK
          </button>
          <button className="text-action" onClick={stopAll}>
            <Square size={18} />
            STOP
          </button>
        </div>
        <form
          className="debug-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitUtterance(draft, { forced: true, manualText: true });
          }}
        >
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a test sentence" />
          <button className="text-action primary" type="submit">SEND TEXT</button>
        </form>
      </section>

      <section className="info-section">
        <h2>Status</h2>
        <div className="decision-grid">
          <span>status: {status}</span>
          <span>provider: {providerId}</span>
          <span>voice_mode: {voiceImplementationLabel(voiceImplementation)}</span>
          <span>listen_enabled: {String(listenEnabled)}</span>
          <span>speak_enabled: {String(speakEnabled)}</span>
          <span>is_listening: {String(listening)}</span>
          <span>is_playing_voice: {String(speaking)}</span>
          <span>correctionSignal: {events[0]?.response.visualFeedback || "none"}</span>
          <span>hasCorrection: {String(Boolean(events[0] && events[0].response.visualFeedback !== "none"))}</span>
          <span>importantError: {String(events[0]?.response.visualFeedback === "error")}</span>
        </div>
      </section>

      <section className="info-section">
        <h2>Browser</h2>
        <pre>{capabilitySummary}</pre>
      </section>

      <section className="info-section">
        <h2>Activity Log</h2>
        {activityEvents.length === 0 ? (
          <p>No activity yet. Tap Listen or Correct now.</p>
        ) : (
          <div className="debug-events">
            {activityEvents.slice(0, 20).map((event) => (
              <div className="activity-event" key={event.id}>
                <strong>{event.label}</strong>
                <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                <p>{event.detail}</p>
              </div>
            ))}
          </div>
        )}
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
                <summary>Full request JSON</summary>
                <pre>{JSON.stringify(event.request, null, 2)}</pre>
              </details>
              <details open>
                <summary>Full response JSON or technical error</summary>
                <pre>{JSON.stringify(event.response, null, 2)}</pre>
              </details>
              <details open>
                <summary>System prompt</summary>
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
