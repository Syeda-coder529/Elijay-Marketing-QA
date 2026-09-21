import { GoogleGenAI, createUserContent, createPartFromBase64 } from "@google/genai";
import { CallRecord, QAResult } from "./types";

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

// Gemini can listen to audio directly, so QA doesn't need a pre-made text
// transcript column — it downloads the call recording from `Recording` and
// transcribes + classifies it in one request. Inline audio like this is
// capped by Gemini's request size limit; a very long recording (roughly a
// 30+ minute call at typical compressed bitrates) may exceed it. If you
// start hitting size errors on longer calls, switch to the Gemini Files API
// (ai.files.upload) instead of inline data.
const MAX_INLINE_BYTES = 19 * 1024 * 1024; // stay under Gemini's ~20MB request cap

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

async function fetchAudioAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download recording (HTTP ${res.status}).`);

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_INLINE_BYTES) {
    throw new Error("Recording file is too large for inline AI review (over ~19MB).");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_INLINE_BYTES) {
    throw new Error("Recording file is too large for inline AI review (over ~19MB).");
  }

  return {
    data: buffer.toString("base64"),
    mimeType: guessMimeType(url, res.headers.get("content-type"))
  };
}

// gemini-2.5-flash was retired for new users in 2026 — gemini-3.6-flash is
// the current stable Flash-tier model as of this writing. Google's model
// lineup changes often; if this ever starts returning a "model not found"
// error, check https://ai.google.dev/gemini-api/docs/models for the current
// recommended replacement and swap the string below.
const MODEL_NAME = "gemini-2.5-flash-lite";

/**
 * Classifies a single call by having Gemini listen to its recording
 * directly (transcription + classification in one pass).
 * Requires GEMINI_API_KEY to be set in the environment.
 */
export async function classifyCallWithGemini(call: CallRecord): Promise<QAClassification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to your environment variables.");
  }

  const hasRecording =
    call.recording && call.recording.trim().length > 0 && call.hasRecording?.toLowerCase() !== "no";

  if (!hasRecording) {
    return { result: "SHORT CALL", reason: "No recording available to review.", score: 0, transcript: "" };
  }

  let audio: { data: string; mimeType: string };
  try {
    audio = await fetchAudioAsBase64(call.recording);
  } catch (e: any) {
    return { result: "SHORT CALL", reason: e.message || "Could not load recording.", score: 0, transcript: "" };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a strict call-center QA analyst for a pay-per-call marketing company.
Listen to the attached call recording. First transcribe it (best effort — it's fine to note
[inaudible] for unclear parts), then classify the call into EXACTLY ONE of these categories:
SALE, CALLBACK, NOT INTERESTED, WRONG INTENT, CUSTOMER MISBEHAVE, AGENT MISTAKE, SHORT CALL

Definitions:
- SALE: the customer agreed to purchase / convert.
- CALLBACK: the agent needs to call the customer back later.
- NOT INTERESTED: the customer explicitly declined.
- WRONG INTENT: the caller wanted something unrelated to the campaign.
- CUSTOMER MISBEHAVE: the customer was abusive, hostile, or the call was a prank.
- AGENT MISTAKE: the agent mishandled the call, gave wrong info, or broke script/compliance.
- SHORT CALL: the call was too short/silent to determine an outcome.

Campaign: ${call.campaign || "unknown"}
Duration: ${call.duration || "unknown"}

Respond with ONLY minified JSON, no markdown, no code fences, in exactly this shape:
{"transcript":"<the transcript you produced>","result":"<one of the categories above>","reason":"<one sentence reason>","score":<integer 0-100 call quality score>}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: createUserContent([
      createPartFromBase64(audio.data, audio.mimeType),
      prompt
    ])
  });

  const text = (response.text || "").trim();
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const result: QAResult = VALID_RESULTS.includes(parsed.result) ? parsed.result : "SHORT CALL";
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    return {
      result,
      reason: String(parsed.reason || "").slice(0, 500),
      score,
      transcript: String(parsed.transcript || "").slice(0, 8000)
    };
  } catch {
    return { result: "SHORT CALL", reason: "Could not parse AI response.", score: 0, transcript: "" };
  }
}
