export type DebugInputKind = "text" | "textarea" | "number" | "json" | "audio" | "select";

export type DebugInputDefinition = {
  key: string;
  label: string;
  kind: DebugInputKind;
  required?: boolean;
  defaultValue?: string | number;
  options?: string[];
  note?: string;
};

export type DebugActionDefinition = {
  id: "text" | "audio" | "both";
  label: string;
  requiresAudio?: boolean;
};

export type DebugPageDefinition = {
  id: string;
  title: string;
  module: "app_v2_test" | "lib_client_voice_system_test" | "lib_server_ai_voice_test" | "lib_data_store_test" | "voice_agent_frontend_test" | "voice_agent_realtime_webrtc_test";
  role: string;
  ready: boolean;
  notReadyReason?: string;
  inputs: DebugInputDefinition[];
  actions: DebugActionDefinition[];
  output: string[];
};
