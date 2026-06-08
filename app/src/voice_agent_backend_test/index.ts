export const VOICE_AGENT_BACKEND_TEST_MODULE = {
  module: "voice_agent_backend_test",
  role: "programmatic backend tests for voice_agent server endpoints and real provider flows",
  debugPages: [],
  testFiles: [
    "create_settings.test.ts",
    "five_turn_listen_speak_real.test.ts",
    "text_chat_missing_typed_text.test.ts",
    "text_chat_missing_openai_config.test.ts",
    "text_chat_real_answer.test.ts",
    "text_chat_real_grammar_correction.test.ts",
    "text_chat_real_latest_message.test.ts",
    "text_chat_real_keyword_off.test.ts",
    "stream_text_chat_missing_typed_text.test.ts",
    "stream_text_chat_missing_openai_config.test.ts",
    "stream_text_chat_real_answer.test.ts",
    "stream_voice_turn_missing_openai_config.test.ts",
    "stream_voice_turn_real.test.ts"
  ]
} as const;
