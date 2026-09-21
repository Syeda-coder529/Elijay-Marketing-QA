# Elijay Marketing Solutions — Pay-Per-Call QA CRM

Next.js 14 (App Router) + Tailwind CSS + Framer Motion. Dark glassmorphism UI,
3 role-based portals (Admin / Publisher / Buyer), CSV ingestion, Gemini 1.5
Flash AI call-QA classification, and optional Google Sheets sync.

## ⚠️ Security note (read this first)

The key and password you shared in chat are **not** hardcoded anywhere in
this codebase — they're wired through environment variables instead. Please:

1. **Rotate the Gemini key** you pasted earlier at https://aistudio.google.com/apikey
   (treat any key that's been shared in a chat as compromised) and put the
   new one only in Vercel's Environment Variables UI / your local `.env.local`.
2. Pick a new admin password and put it in `ADMIN_PASSWORD`, not in code.
3. Never commit `.env.local` — it's already in `.gitignore`.

## 1. Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local with real values
npm run dev
```

Visit:
- `/` — landing page with Publisher / Buyer portal links
- `/publisher/login`
- `/buyer/login`
- `/admin-secret-1045-login` (intentionally not linked anywhere in the UI)

## 2. Required environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_USERNAME` | Admin login username (defaults to `admin`) |
| `ADMIN_PASSWORD` | Admin login password — **required**, no default |
| `SESSION_SECRET` | Random 32+ char string used to sign session cookies |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **Required on Vercel** — persistent storage (see section 6). Not needed for local dev. |
| `GEMINI_API_KEY` | Gemini API key for AI call QA (see section 5) |
| `GOOGLE_SHEET_ID` | Target spreadsheet ID — optional, sync is skipped if unset (see section 7 for full setup) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | Base64-encoded service-account JSON — optional (see section 7 for full setup) |

## 3. How auth works

- **Admin**: single account from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- **Publisher**: username = password = their Publisher ID (e.g. `EINT1031P`).
  The ID must already exist in an uploaded CSV — publishers can't log in until
  admin has uploaded at least one call row for their ID.
- **Buyer**: same pattern, keyed off the `Target` column.

## 4. CSV format

```
Call Date, Has Recording, Campaign, Publisher, Caller ID, Time To Call,
Is Duplicate, End Call Source, Time To Connect, Target, Payout, Duration,
Recording
```

- `Publisher` → Publisher ID
- `Target` → Buyer ID
- `Recording` → a URL to the audio file. It's used both by the in-dashboard
  audio player AND as the input to AI QA — there's no separate transcript
  column; Gemini transcribes the recording itself (see section 5).

Upload from `/admin/dashboard` → "Upload Call CSV". Rows are appended, not
replaced, so you can upload incrementally.

## 5. AI QA

From the admin dashboard, clicking **"Run AI QA" processes every `PENDING`
call** — you don't need to click it more than once. For each call, Gemini
downloads the audio from its `Recording` URL and transcribes + classifies it
in a single request (there's no separate transcript column to prepare).
Under the hood, `/api/classify` only handles a bounded batch (8 calls) per
request to stay inside Vercel's serverless function time limit and Gemini's
rate limits — audio requests take longer than plain text ones did; the
dashboard automatically keeps calling it in a loop, showing live progress,
until nothing is left pending. Each call is classified into: `SALE`,
`CALLBACK`, `NOT INTERESTED`, `WRONG INTENT`, `CUSTOMER MISBEHAVE`,
`AGENT MISTAKE`, or `SHORT CALL`, with a reason, a 0–100 score, and the
transcript Gemini produced (visible by hovering a row in the table, and
synced to Sheets as its own column).

`app/api/classify/route.ts` sets `export const maxDuration = 60` so each
batch gets up to 60 seconds. Vercel's Hobby plan supports this, but if you
still see timeouts on very long recordings, lower `MAX_PER_RUN` in that file
from 8 to something smaller so each batch finishes well within the limit —
the loop just runs more times. Recordings over roughly 19MB (very long
calls) can't be sent inline to Gemini and will be marked `SHORT CALL` with
an explanatory reason; `lib/gemini.ts` has a comment on switching to
Gemini's Files API if you need to support longer recordings.

## 6. Persistent storage (required on Vercel)

Vercel's serverless functions have a **read-only filesystem** except `/tmp`,
and `/tmp` is **not shared** across function instances or redeploys — a
different request can land on a completely different instance. This is why
a naive JSON-file store causes symptoms like "AI QA complete — 0 calls
classified" right after a successful upload: the classify request literally
can't see the file the upload request wrote.

**This project now uses Upstash Redis** for real, shared persistence, with
a local JSON file as a fallback *only* for `npm run dev` without Redis
configured. To enable it on Vercel (takes ~2 minutes, no code changes):

1. In your Vercel project → **Storage** tab → **Create Database** →
   choose **Redis** (powered by Upstash) from the Marketplace.
2. Connect it to this project. Vercel automatically injects
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into your
   project's environment variables.
3. Redeploy (Vercel usually does this automatically after connecting a new
   integration; if not, trigger a redeploy manually).

That's it — `lib/store.ts` detects those variables automatically. If they're
missing, the admin dashboard shows a yellow warning banner reminding you
this step still needs to be done, instead of silently losing data.

If you'd rather use a different backing store (Postgres, Supabase, etc.)
instead of Redis, only `lib/store.ts` needs to change — everything else
(auth, UI, AI QA, API routes) is written against its small function
interface (`readAllCalls`, `writeAllCalls`, `appendCalls`, `updateCall`,
`getCallsForRole`, `listPublisherIds`, `listTargetIds`).

## 7. Connecting Google Sheets (no Apps Script needed)

Sheets sync is handled entirely by this app calling Google's official
Sheets API directly from the server (`lib/sheets.ts`), using a **service
account** — a machine identity Google Cloud issues you, separate from your
personal Gmail login. **You do not need Google Apps Script** — that's for
logic that lives inside a spreadsheet, and isn't involved here at all.

Once connected, every "Run AI QA" batch pushes results into four kinds of
sheets in your spreadsheet: `ALL_CALLS` (everything), one `PUB_<PublisherID>`
sheet per publisher, one `BUYER_<TargetID>` sheet per buyer, and a
`DASHBOARD` summary sheet with result counts. Rows are color-coded by QA
result automatically.

**Setup (~5 minutes, one-time):**

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a project (or use an existing one).
2. In that project, enable the **Google Sheets API**: search "Google Sheets
   API" in the top search bar → click it → **Enable**.
3. Create a service account: **IAM & Admin → Service Accounts → Create
   Service Account**. Give it any name (e.g. `elijay-sheets-sync`). You can
   skip granting it project-level roles — it only needs access to the one
   sheet you share with it in step 6.
4. Open the service account you just created → **Keys** tab → **Add Key →
   Create new key → JSON**. This downloads a `.json` file — keep it private,
   it's a credential.
5. Base64-encode that file so it can go in an environment variable:
   - Mac/Linux: `base64 -i service-account.json | tr -d '\n'`
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`
   Copy the resulting single-line string.
6. Open your Google Sheet (the one at
   `docs.google.com/spreadsheets/d/1jwAXhwds1aVZl_9JrKSnHWCbJwKOz1e97Py-cvtMOyw`)
   → **Share** → paste in the service account's email address (it looks like
   `elijay-sheets-sync@your-project.iam.gserviceaccount.com`, found on the
   service account's details page) → give it **Editor** access.
7. Set these two environment variables (in `.env.local` for local dev, and
   in Vercel → Project Settings → Environment Variables for production):
   - `GOOGLE_SHEET_ID` = `1jwAXhwds1aVZl_9JrKSnHWCbJwKOz1e97Py-cvtMOyw`
   - `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` = the base64 string from step 5
8. Redeploy (or restart `npm run dev` locally).

That's it — the app creates the `ALL_CALLS`, `PUB_*`, `BUYER_*`, and
`DASHBOARD` sheets automatically the first time it syncs, so you don't need
to pre-create any tabs. If these two env vars aren't set, sync is silently
skipped and the app still works fully off its own data store — Sheets is
optional, not required for the CRM to function.

## 8. Deploying to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel
```

Then add all the environment variables from step 2 (and the Redis ones from
step 6) in the Vercel project's Settings → Environment Variables, and
redeploy.

## 9. Project structure

```
app/
  api/            → auth, calls, upload, classify route handlers
  admin/dashboard  publisher/dashboard  buyer/dashboard
  publisher/login  buyer/login  admin-secret-1045-login
components/        → all UI (glass cards, animated bg, audio player, table...)
lib/
  auth.ts          → login checks for the 3 roles
  session.ts       → signed cookie session
  store.ts         → data read/write (see persistence note above)
  csv.ts           → CSV → CallRecord parsing
  gemini.ts        → Gemini 1.5 Flash QA classification
  sheets.ts        → optional Google Sheets sync (ALL_CALLS, PUB_x, BUYER_x, DASHBOARD)
middleware.ts      → protects the 3 dashboard routes by role
```
