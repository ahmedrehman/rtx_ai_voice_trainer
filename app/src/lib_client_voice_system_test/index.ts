import { AUDIO_MICRO_START_DEBUG_PAGE } from "./audio_micro_start.debug";
import { MICROPHONE_AUDIO_REQUIREMENTS_DEBUG_PAGE } from "./microphone_audio_requirements.debug";
import { SYSTEM_AUDIO_ENERGY_CHECK_DEBUG_PAGE } from "./system_audio_energy_check.debug";
import { SYSTEM_AUDIO_TO_SPEAKER_DEBUG_PAGE } from "./system_audio_to_speaker.debug";
import { SYSTEM_AUDIO_TO_TEXT_DEBUG_PAGE } from "./system_audio_to_text.debug";
import { SYSTEM_MEANINGFUL_AUDIO_CHUNK_DEBUG_PAGE } from "./system_meaningful_audio_chunk.debug";
import { SYSTEM_MICRO_TO_AUDIO_DEBUG_PAGE } from "./system_micro_to_audio.debug";
import { SYSTEM_TEXT_TO_AUDIO_DEBUG_PAGE } from "./system_text_to_audio.debug";

export const CLIENT_VOICE_SYSTEM_DEBUG_PAGES = [
  AUDIO_MICRO_START_DEBUG_PAGE,
  MICROPHONE_AUDIO_REQUIREMENTS_DEBUG_PAGE,
  SYSTEM_MEANINGFUL_AUDIO_CHUNK_DEBUG_PAGE,
  SYSTEM_AUDIO_ENERGY_CHECK_DEBUG_PAGE,
  SYSTEM_MICRO_TO_AUDIO_DEBUG_PAGE,
  SYSTEM_AUDIO_TO_TEXT_DEBUG_PAGE,
  SYSTEM_TEXT_TO_AUDIO_DEBUG_PAGE,
  SYSTEM_AUDIO_TO_SPEAKER_DEBUG_PAGE
];
