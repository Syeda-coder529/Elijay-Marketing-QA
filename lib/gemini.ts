import { CallRecord, QAResult } from "./types";

// ---------------------------------------------------------------------------
// Switched from Gemini to Groq (free tier) — Gemini's free daily quota for
// gemini-3.6-flash was only 20 requests/day, nowhere near enough for a batch
// of 90+ calls. Groq's free tier gives ~2,000 audio transcriptions/day
// (Whisper) and ~14,400 text requests/day (Llama), with no credit card
// required. This does the job in two steps instead of Gemini's one:
//   1. Whisper transcribes the recording audio -> text
//   2. Llama reads the transcript and classifies it -> QA result
// Requires GROQ_API_KEY in the environment.
// ---------------------------------------------------------------------------

const VALID_RESULTS: QAResult[] = [
  "SALE",
  "CALLBACK",
  "NOT INTERESTED",
  "WRONG INTENT",
  "CUSTOMER MISBEHAVE",
  "AGENT MISTAKE",
  "SHORT CALL"
];

export interface QAClassification {
  result: QAResult;
  reason: string;
  score: number;
  transcript: string;
}

const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Groq's free-tier upload cap is 25MB
const WHISPER_MODEL = "whisper-large-v3-turbo"; // fast + free; use "whisper-large-v3" for max accuracy
const LLAMA_MODEL = "llama-3.3-70b-versatile";

function guessMimeType(url: string, contentType: string | null): string {
  if (contentType && contentType.startsWith("audio/")) return contentType;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3":
      return "audio/mp3";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    default:
      return "audio/mpeg";
  }
}

async function fetchAudioBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download recording (HTTP ${res.status}).`);

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) {
    throw new Error("Recording file is too large for AI review (over ~24MB).");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Recording file is too large for AI review (over ~24MB).");
  }

  const mimeType = guessMimeType(url, res.headers.get("content-type"));
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "mp3";
  return { buffer, mimeType, ext };
}

async function transcribeWithGroq(buffer: Buffer, mimeType: string, ext: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `recording.${ext}`);
  form.append("model", WHISPER_MODEL);
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq transcription failed: ${errText}`);
  }

  const data = await res.json();
  return data.text || "";
}

async function classifyTranscriptWithGroq(
  transcript: string,
  call: CallRecord,
  apiKey: string
): Promise<Omit<QAClassification, "transcript">> {
  const prompt = `You are a strict call-center QA analyst for a pay-per-call marketing company.
Read the call transcript below and classify the call into EXACTLY ONE of these categories:
SALE, CALLBACK, NOT INTERESTED, WRONG INTENT, CUSTOMER MISBEHAVE, AGENT MISTAKE, SHORT CALL

Definitions:
- SALE: the customer agreed to purchase / convert.
- CALLBACK: the agent needs to call the customer back later.
- NOT INTERESTED: the customer explicitly declined.
- WRONG INTENT: the caller wanted something unrelated to the campaign.
- CUSTOMER MISBEHAVE: the customer was abusive, hostile, or the call was a prank.
- AGENT MISTAKE: the agent mishandled the call, gave wrong info, or broke script/compliance.
- SHORT CALL: the call was too short/silent/empty to determine an outcome.

Campaign: ${call.campaign || "unknown"}
Duration: ${call.duration || "unknown"}

Transcript:
"""
${transcript || "(empty or inaudible)"}
"""

Respond with ONLY minified JSON, no markdown, no code fences, in exactly this shape:
{"result":"<one of the categories above>","reason":"<one sentence reason>","score":<integer 0-100 call quality score>}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq classification failed: ${errText}`);
  }

  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "").trim();
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const result: QAResult = VALID_RESULTS.includes(parsed.result) ? parsed.result : "SHORT CALL";
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    return { result, reason: String(parsed.reason || "").slice(0, 500), score };
  } catch {
    return { result: "SHORT CALL", reason: "Could not parse AI response.", score: 0 };
  }
}

/**
 * Classifies a single call: Whisper transcribes the recording, then Llama
 * reads the transcript and classifies it. Requires GROQ_API_KEY.
 */
export async function classifyCallWithGemini(call: CallRecord): Promise<QAClassification> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set. Add it to your environment variables.");
  }

  const hasRecording =
    call.recording && call.recording.trim().length > 0 && call.hasRecording?.toLowerCase() !== "no";

  if (!hasRecording) {
    return { result: "SHORT CALL", reason: "No recording available to review.", score: 0, transcript: "" };
  }

  let audio: { buffer: Buffer; mimeType: string; ext: string };
  try {
    audio = await fetchAudioBuffer(call.recording);
  } catch (e: any) {
    return { result: "SHORT CALL", reason: e.message || "Could not load recording.", score: 0, transcript: "" };
  }

  let transcript = "";
  try {
    transcript = await transcribeWithGroq(audio.buffer, audio.mimeType, audio.ext, apiKey);
  } catch (e: any) {
    return { result: "SHORT CALL", reason: e.message || "Transcription failed.", score: 0, transcript: "" };
  }

  const classification = await classifyTranscriptWithGroq(transcript, call, apiKey);

  return {
    ...classification,
    transcript: transcript.slice(0, 8000)
  };
}
