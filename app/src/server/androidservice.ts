import type { Env } from "./bindings";
import { json, methodNotAllowed, notFound } from "./responses";
import { VOICE_AGENT_BACKEND, type VoiceAgentTextChatRequest } from "../voice_agent";
import { VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET, type RealtimeClientSecretInput } from "../voice_agent_realtime_webrtc_test/server";

const SERVICE_PREFIX = "/api/androidservice";

export async function handleAndroidServiceRequest(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith(SERVICE_PREFIX)) return undefined;

  if (pathname === `${SERVICE_PREFIX}/health`) {
    if (request.method !== "GET") return methodNotAllowed();
    return json({
      ok: true,
      service: "androidservice",
      endpoints: {
        textChat: `${SERVICE_PREFIX}/text-chat`,
        realtimeClientSecret: `${SERVICE_PREFIX}/realtime-client-secret`,
        audioRoundtrip: `${SERVICE_PREFIX}/audio-roundtrip`
      }
    });
  }

  if (pathname === `${SERVICE_PREFIX}/text-chat`) {
    if (request.method !== "POST") return methodNotAllowed();
    return json(await androidTextChat(request, env));
  }

  if (pathname === `${SERVICE_PREFIX}/realtime-client-secret`) {
    if (request.method !== "POST") return methodNotAllowed();
    return androidRealtimeClientSecret(request, env);
  }

  if (pathname === `${SERVICE_PREFIX}/audio-roundtrip`) {
    if (request.method !== "POST") return methodNotAllowed();
    return androidAudioRoundtrip(request);
  }

  return notFound();
}

async function androidTextChat(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return { error: "ANDROID_TEXT_CHAT is not connected." };
  }

  const body = await request.json() as VoiceAgentTextChatRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  return VOICE_AGENT_BACKEND.TEXT_CHAT(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      textModel: "gpt-4.1-mini",
      ttsModel: "gpt-4o-mini-tts",
      voice: settings.voice
    },
    body
  );
}

async function androidRealtimeClientSecret(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "ANDROID_REALTIME_WEBRTC is not connected." }, 503);
  }

  const body = await request.json() as RealtimeClientSecretInput;
  const result = await VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET({
    ...body,
    openAiApiKey: env.OPENAI_API_KEY
  });
  return json(result.status.ok ? result.response : result, result.status.ok ? 200 : 500);
}

async function androidAudioRoundtrip(request: Request) {
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  const body = await request.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Audio-Roundtrip-Bytes": String(body.byteLength)
    }
  });
}
