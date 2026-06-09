import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_V2_REALTIME_EVENT_RESULT } from "./realtime";

test("VOICE_AGENT_V2_REALTIME_EVENT_RESULT reads realtime text transcript events", () => {
  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_audio_transcript.delta",
      delta: "J'ai "
    }),
    {
      type: "response.output_audio_transcript.delta",
      textDelta: "J'ai"
    }
  );

  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_audio_transcript.done",
      transcript: "J'ai mal a la tete."
    }),
    {
      type: "response.output_audio_transcript.done",
      textDone: "J'ai mal a la tete."
    }
  );

  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.done",
      response: {
        output: [
          {
            content: [
              { transcript: "J'ai mal a la tete." }
            ]
          }
        ]
      }
    }),
    {
      type: "response.done",
      aiSpeaking: false,
      textDone: "J'ai mal a la tete."
    }
  );
});

test("VOICE_AGENT_V2_REALTIME_EVENT_RESULT reads structured correction event payloads", () => {
  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.function_call_arguments.done",
      name: "report_correction",
      arguments: JSON.stringify({
        correction: 2,
        text: "J'ai mal a la tete.",
        hint: "Use avoir mal a."
      })
    }),
    {
      type: "response.function_call_arguments.done",
      correctionEvent: {
        correction: 2,
        text: "J'ai mal a la tete.",
        hint: "Use avoir mal a.",
        raw: {
          correction: 2,
          text: "J'ai mal a la tete.",
          hint: "Use avoir mal a."
        }
      },
      textDone: "J'ai mal a la tete."
    }
  );

  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_text.done",
      text: "{\"correction\":3,\"text\":\"Je suis malade.\",\"hint\":\"Use etre.\"}"
    }),
    {
      type: "response.output_text.done",
      correctionEvent: {
        correction: 3,
        text: "Je suis malade.",
        hint: "Use etre.",
        raw: {
          correction: 3,
          text: "Je suis malade.",
          hint: "Use etre."
        }
      },
      textDone: "Je suis malade."
    }
  );
});

test("VOICE_AGENT_V2_REALTIME_EVENT_RESULT reads prompt fields from plain realtime text", () => {
  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_text.done",
      text: "correction 2: J'ai mal a la tete. hint: Use avoir mal a."
    }),
    {
      type: "response.output_text.done",
      correctionEvent: {
        correction: 2,
        text: "J'ai mal a la tete.",
        hint: "Use avoir mal a.",
        raw: "correction 2: J'ai mal a la tete. hint: Use avoir mal a."
      },
      textDone: "J'ai mal a la tete."
    }
  );

  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_audio_transcript.done",
      transcript: "grammar: Je suis malade. hint: Use etre."
    }),
    {
      type: "response.output_audio_transcript.done",
      correctionEvent: {
        correction: 3,
        text: "Je suis malade.",
        hint: "Use etre.",
        raw: "grammar: Je suis malade. hint: Use etre."
      },
      textDone: "Je suis malade."
    }
  );

  assert.deepEqual(
    VOICE_AGENT_V2_REALTIME_EVENT_RESULT({
      type: "response.output_text.done",
      text: "pronunciation: liaison plus claire."
    }),
    {
      type: "response.output_text.done",
      correctionEvent: {
        correction: 1,
        text: "liaison plus claire.",
        hint: undefined,
        raw: "pronunciation: liaison plus claire."
      },
      textDone: "liaison plus claire."
    }
  );
});
