export type QAResult =
  | "SALE"
  | "CALLBACK"
  | "NOT INTERESTED"
  | "WRONG INTENT"
  | "CUSTOMER MISBEHAVE"
  | "AGENT MISTAKE"
  | "SHORT CALL"
  | "PENDING";

export interface CallRecord {
  id: string;
  callDate: string;
  hasRecording: string;
  campaign: string;
  publisher: string; // Publisher ID e.g. EINT1031P
  callerId: string;
  timeToCall: string;
  isDuplicate: string;
  endCallSource: string;
  timeToConnect: string;
  target: string; // Buyer ID
  payout: number;
  duration: string;
  recording: string; // URL to recording audio — Gemini transcribes this directly
  qaResult: QAResult;
  qaReason: string;
  qaScore: number | null;
  qaTranscript: string; // transcript Gemini produced while listening to `recording`
}

export type Role = "admin" | "publisher" | "buyer";

export interface SessionData {
  role: Role;
  id: string; // "admin", or Publisher ID, or Target/Buyer ID
}
