import type { AppSettings, CorrectionInput, StructuredCorrection } from "../types";

export function buildSystemPrompt(settings: AppSettings) {
  return [
    `You are a silent-first ${settings.languageName} voice trainer.`,
    `Training topic: ${settings.topic}.`,
    "Stay out of the user's way.",
    "Return JSON only. No markdown, no prose, no code fence.",
    "Do not speak or invite conversation unless the app trigger allows it.",
    "Prefer short corrections and minimal hints.",
    `Answer keyword: ${settings.keyword}.`,
    "",
    "Return a JSON object with these fields:",
    '- text: original user sentence without the answer keyword',
    '- corrected: corrected sentence',
    '- keywordSent: boolean, true only when the user actually said the answer keyword',
    '- shouldRespond: boolean',
    '- trigger: one of "keyword", "button", "manual-text", "silent"',
    '- notes: array of short correction reasons',
    '- visualFeedback: exactly one of "none", "improvement", "error"',
    `- topic: "${settings.topic}"`,
    `- languageName: "${settings.languageName}"`,
    "",
    "Allowed values:",
    '- keywordSent: boolean true or false',
    '- shouldRespond: boolean true or false',
    '- trigger: one of "keyword", "button", "manual-text", "silent"',
    '- visualFeedback: "none" when there is nothing to improve, "improvement" for useful correction, "error" for important correction',
    "- notes: array of short strings, empty array if no useful note",
    "",
    "Decision rules:",
    "- shouldRespond is true only when trigger is keyword, button, or manual-text.",
    "- shouldRespond is false when trigger is silent.",
    "- Even when shouldRespond is false, still fill corrected, notes, and visualFeedback.",
    "- Use visualFeedback improvement for small correction, error for important correction, none if no correction.",
    "- Use visualFeedback error only for corrections the learner should not miss."
  ].join("\n");
}

export function demoCorrect(input: CorrectionInput): StructuredCorrection {
  const normalized = input.text.trim();
  const lowered = normalized.toLowerCase();
  const keyword = input.settings.keyword.trim().toLowerCase() || "computer";
  const keywordSent = lowered.includes(keyword);
  const shouldRespond = input.forced || input.manualText || keywordSent;
  const cleaned = cleanKeyword(normalized, keyword);
  let corrected = cleaned || normalized;
  const notes: string[] = [];

  const replacements: Array<[RegExp, string, string]> = [
    [/\bje suis aller\b/gi, "je suis alle", "Use the past participle after etre."],
    [/\bje vais au bibliotheque\b/gi, "je vais a la bibliotheque", "Bibliotheque is feminine."],
    [/\bje mange une pomme hier\b/gi, "j'ai mange une pomme hier", "Use passe compose for finished past action."],
    [/\bmon mere\b/gi, "ma mere", "Mere is feminine."],
    [/\bun voiture\b/gi, "une voiture", "Voiture is feminine."]
  ];

  for (const [pattern, replacement, note] of replacements) {
    if (pattern.test(corrected)) {
      corrected = corrected.replace(pattern, replacement);
      notes.push(note);
    }
  }

  if (!notes.length && shouldRespond) {
    notes.push(`No obvious ${input.settings.languageName} correction found in server demo mode.`);
  }

  return {
    text: cleaned || normalized,
    corrected,
    keywordSent,
    shouldRespond,
    trigger: input.forced ? "button" : input.manualText ? "manual-text" : keywordSent ? "keyword" : "silent",
    notes,
    visualFeedback: notes.length ? "improvement" : "none",
    topic: input.settings.topic,
    languageName: input.settings.languageName
  };
}

export function parseCorrection(raw: string, input: CorrectionInput): StructuredCorrection {
  const parsed = JSON.parse(raw) as Partial<StructuredCorrection>;
  return {
    text: String(parsed.text || input.text),
    corrected: String(parsed.corrected || input.text),
    keywordSent: Boolean(parsed.keywordSent),
    shouldRespond: Boolean(parsed.shouldRespond),
    trigger: parsed.trigger === "keyword" || parsed.trigger === "button" || parsed.trigger === "manual-text" || parsed.trigger === "silent"
      ? parsed.trigger
      : "silent",
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    visualFeedback: parsed.visualFeedback === "improvement" || parsed.visualFeedback === "error" ? parsed.visualFeedback : "none",
    topic: String(parsed.topic || input.settings.topic),
    languageName: String(parsed.languageName || input.settings.languageName)
  };
}

function cleanKeyword(text: string, keyword: string) {
  return text.replace(new RegExp(`\\b${escapeRegExp(keyword)}\\b[:,]?\\s*`, "i"), "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
