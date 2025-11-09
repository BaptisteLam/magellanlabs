export type IntentAnalysis = {
  type: "intent";
  action: "generate_code" | "modify_code" | "add_feature" | "explain" | "chat";
  target?: string;
  description: string;
};

export type AIEvent =
  | { type: "status"; content: string }
  | { type: "message"; content: string }
  | IntentAnalysis
  | { type: "code_update"; path: string; code: string }
  | { type: "complete" };
