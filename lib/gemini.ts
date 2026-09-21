import { CallRecord, QAResult } from "./types";

// ---------------------------------------------------------------------------
// Uses Hugging Face Serverless Inference API instead of Groq.
// Requires HF_TOKEN in the environment variables.
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

const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Hugging Face / Serverless size limit
const WHISPER_MODEL = "openai/whisper-large-v3-turbo";
const LLAMA_MODEL = "meta-llama/Llama-3.3-70B-Instruct";

const SUPPORTED_EXTENSIONS = new Set([
  "flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"
]);

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const type = contentType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/webm": "webm",
    "audio/flac": "flac",
    "audio/x-flac": "flac"
  };
  return map[type] || null;
}

function guessFileExtension(url: string, contentType: string | null): string {
  const fromHeader = extensionFromContentType(contentType);
  if (fromHeader) return fromHeader;

  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUrl && SUPPORTED_EXTENSIONS.has(fromUrl)) return fromUrl;

  return "mp3";
}

function mimeTypeForExtension(ext: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    opus: "audio/opus",
    m4a: "audio/mp4",
    webm: "audio/webm",
    flac: "audio/flac",
    mp4: "audio/mp4",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg"
  };
  return map[ext] || "audio/mpeg";
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

  const ext = guessFileExtension(url, res.headers.get("content-type"));
  const mimeType = mimeTypeForExtension(ext);
  return { buffer, mimeType, ext };
}

async function transcribeWithHuggingFace(buffer: Buffer, mimeType: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${WHISPER_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": mimeType
    },
    body: buffer
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Hugging Face transcription failed: ${errText}`);
  }

  const data = await res.json();
  return data.text || (typeof data === "string" ? data : "") || "";
}

async function classifyTranscriptWithHuggingFace(
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

  const res = await fetch("https://api-inference.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Hugging Face classification failed: ${errText}`);
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
 * Classifies a single call using Hugging Face (Whisper for audio + Llama for text classification).
 * Requires HF_TOKEN in your environment variables.
 */
export async function classifyCallWithGemini(call: CallRecord): Promise<QAClassification> {
  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    throw new Error("HF_TOKEN is not set. Add your Hugging Face access token to your environment variables.");
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
    transcript = await transcribeWithHuggingFace(audio.buffer, audio.mimeType, apiKey);
  } catch (e: any) {
    return { result: "SHORT CALL", reason: e.message || "Transcription failed.", score: 0, transcript: "" };
  }

  const classification = await classifyTranscriptWithHuggingFace(transcript, call, apiKey);

  return {
    ...classification,
    transcript: transcript.slice(0, 8000)
  };
}
