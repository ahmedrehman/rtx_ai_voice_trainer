import type { ClientVoiceLogEvent } from "../lib_client_voice_system";

export function createClientVoiceLogger() {
  const events: ClientVoiceLogEvent[] = [];
  return {
    events,
    logger(event: ClientVoiceLogEvent) {
      events.push(event);
    }
  };
}
