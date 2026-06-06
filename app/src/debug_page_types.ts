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
  module: "Client Voice" | "Server AI Voice" | "Data Store";
  role: string;
  ready: boolean;
  notReadyReason?: string;
  inputs: DebugInputDefinition[];
  actions: DebugActionDefinition[];
  output: string[];
};
