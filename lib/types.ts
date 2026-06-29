// UI message — what the thread renders
export type Message = {
  id: string;
  role: "me" | "them";
  text: string;
  isError?: boolean; // error bubbles are shown in UI but never sent to the API
};

// Wire format — what /api/chat expects
export type ApiMessage = {
  role: "user" | "assistant";
  content: string;
};

// Server-sent events streamed from /api/chat
export type StreamEvent =
  | { type: "status"; label: string }   // tool is running — show inline status
  | { type: "text"; content: string }   // final answer from model
  | { type: "error"; message: string }; // graceful failure
