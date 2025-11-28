export type IntentAnalysis = {
  type: "intent";
  action: "generate_code" | "modify_code" | "add_feature" | "explain" | "chat";
  target?: string;
  description: string;
};

export type GenerationEvent = {
  type: "thought" | "read" | "edit" | "create" | "analyze" | "plan" | "write" | "complete" | "error";
  message: string;
  duration?: number;
  file?: string;
  status?: "pending" | "in-progress" | "completed" | "error";
};

export type AIEvent =
  | { type: "status"; content: string }
  | { type: "message"; content: string }
  | { type: "log"; content: string }
  | IntentAnalysis
  | { type: "code_update"; path: string; code: string }
  | { type: "complete" }
  | { type: "tokens"; input_tokens: number; output_tokens: number; total_tokens: number }
  | GenerationEvent;
