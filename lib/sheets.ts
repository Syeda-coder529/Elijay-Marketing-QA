import { google } from "googleapis";
import { CallRecord } from "./types";

// Optional Google Sheets sync. Requires:
//  - GOOGLE_SHEET_ID
//  - GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (a base64-encoded service-account JSON key,
//    with that service account's email shared as an Editor on the target sheet)
//
// If these aren't set, sync is silently skipped — the app still works fully
// off the local/DB store. This keeps the app usable in demo/dev without
// requiring Google Cloud setup.

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) return null;
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

const RESULT_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  SALE: { red: 0.7, green: 1, blue: 0.75 },
  CALLBACK: { red: 0.75, green: 0.85, blue: 1 },
  "NOT INTERESTED": { red: 1, green: 0.95, blue: 0.7 },
  "WRONG INTENT": { red: 1, green: 0.9, blue: 0.75 },
  "CUSTOMER MISBEHAVE": { red: 1, green: 0.75, blue: 0.75 },
  "AGENT MISTAKE": { red: 1, green: 0.8, blue: 0.8 },
  "SHORT CALL": { red: 0.9, green: 0.9, blue: 0.9 },
  PENDING: { red: 0.95, green: 0.95, blue: 0.95 }
};

const HEADER_ROW = [
  "Call Date","Has Recording","Campaign","Publisher","Caller ID",
  "Time To Call","Is Duplicate","End Call Source","Time To Connect","Target",
  "Payout","Duration","Recording","QA Result","QA Reason","QA Score","QA Transcript"
];

const QA_RESULT_COL_INDEX = HEADER_ROW.indexOf("QA Result"); // 0-based

function toRow(c: CallRecord): (string | number)[] {
  return [
    c.callDate, c.hasRecording, c.campaign, c.publisher, c.callerId,
    c.timeToCall, c.isDuplicate, c.endCallSource, c.timeToConnect, c.target,
    c.payout, c.duration, c.recording,
    c.qaResult, c.qaReason, c.qaScore ?? "", c.qaTranscript
  ];
}

async function applyResultColorFormatting(sheets: any, spreadsheetId: string, sheetId: number) {
  // Color-codes each row by its QA Result value. Applied once when the sheet
  // is first created — conditional format rules persist automatically as
  // new rows are written, satisfying the "color coding" requirement without
  // needing to re-color cells on every sync.
  const requests = Object.entries(RESULT_COLORS).map(([result, color], i) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADER_ROW.length }],
        booleanRule: {
          condition: {
            type: "CUSTOM_FORMULA",
            values: [{ userEnteredValue: `=$${colLetter(QA_RESULT_COL_INDEX)}2="${result}"` }]
          },
          format: { backgroundColor: color }
        }
      },
      index: i
    }
  }));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

function colLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s: any) => s.properties.title === title);
  if (!exists) {
    const addResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    });
    const sheetId = addResult.data.replies?.[0]?.addSheet?.properties?.sheetId;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] }
    });

    if (typeof sheetId === "number") {
      await applyResultColorFormatting(sheets, spreadsheetId, sheetId).catch(() => {
        // Non-fatal — sync still works without color coding if this fails.
      });
    }
  }
}

/**
 * Syncs the full call set to: ALL_CALLS, one PUB_<id> sheet per publisher,
 * one BUYER_<id> sheet per target, and a summary DASHBOARD sheet.
 * No-op if Google Sheets credentials aren't configured.
 */
export async function syncCallsToSheets(calls: CallRecord[]) {
  const auth = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!auth || !spreadsheetId) return { synced: false, reason: "Sheets not configured" };

  const sheets = google.sheets({ version: "v4", auth });

  await ensureSheetExists(sheets, spreadsheetId, "ALL_CALLS");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "ALL_CALLS!A1",
    valueInputOption: "RAW",
    requestBody: { values: [HEADER_ROW, ...calls.map(toRow)] }
  });

  const publishers = Array.from(new Set(calls.map((c) => c.publisher).filter(Boolean)));
  for (const pub of publishers) {
    const title = `PUB_${pub}`;
    await ensureSheetExists(sheets, spreadsheetId, title);
    const rows = calls.filter((c) => c.publisher === pub).map(toRow);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW, ...rows] }
    });
  }

  const targets = Array.from(new Set(calls.map((c) => c.target).filter(Boolean)));
  for (const t of targets) {
    const title = `BUYER_${t}`;
    await ensureSheetExists(sheets, spreadsheetId, title);
    const rows = calls.filter((c) => c.target === t).map(toRow);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW, ...rows] }
    });
  }

  await ensureSheetExists(sheets, spreadsheetId, "DASHBOARD");
  const totals: Record<string, number> = {};
  for (const c of calls) totals[c.qaResult] = (totals[c.qaResult] || 0) + 1;
  const summaryRows = Object.entries(totals).map(([k, v]) => [k, v]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "DASHBOARD!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["Result", "Count"], ...summaryRows] }
  });

  return { synced: true };
}
