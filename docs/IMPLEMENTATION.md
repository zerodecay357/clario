# Clario — Implementation Guide (Stages 0–2)

Companion to `docs/PLAN.md`; open items are in `docs/BACKLOG.md`. The plan says *what/why*; this says *how*, step by step.
Rule: **each stage ends at a VERIFY gate. Nothing in the next stage starts until the user confirms.**

---

## 0. Prerequisites (one-time, done by you)

| Account | What to get | Env var |
|---|---|---|
| GitHub | private repo `clario` | — |
| Vercel (YC perk → Pro if possible) | project linked to the repo | — |
| Supabase | new project (region: Mumbai `ap-south-1`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (Transaction pooler, port 6543) |
| Anthropic | API key | `ANTHROPIC_API_KEY` |
| Google AI Studio | Gemini API key | `GEMINI_API_KEY`, `GEMINI_MODEL` (current Flash model ID from AI Studio) |
| — | generate locally | `CLARIO_ENC_KEY` = `openssl rand -base64 32`, `CRON_SECRET` = `openssl rand -hex 32` |

Other env: `LLM_PROVIDER` (`anthropic`/`gemini`, optional), `ANTHROPIC_MODEL` (default `claude-haiku-5-5`), `NEXT_PUBLIC_APP_URL`.

CLIs: `npm i -g vercel` then `! vercel login`.

> ⚠️ **Vercel Hobby crons run at most once a day.** The hourly sync needs Pro. On Hobby: use a daily sync cron and also **sync when the dashboard loads if `last_sync_at` is more than 30 min old** (this is built in either way).
>
> ⚠️ **Stage 0 must prove that Vercel can reach IITD Moodle** (`/api/health/moodle`). So far this has only been tested from campus.

---

## 1. Repo layout

```
clario/
  app/
    page.tsx                    # landing (signed out) / dashboard (signed in)
    login/page.tsx              # magic link + Google
    auth/callback/route.ts      # Supabase OAuth/magic-link exchange
    connect/page.tsx            # Moodle connect cards (client component)
    digest/page.tsx             # in-app digest (today + next 3 days + AI intro)
    inbox/page.tsx              # approval inbox for mail-extracted events
    settings/page.tsx           # Gemini key, ICS link, delete my data
    api/
      connect/moodle/route.ts   # POST {instance, token}
      sync/route.ts             # POST (user) | GET (cron, CRON_SECRET)
      deadlines/[id]/route.ts   # PATCH {done}
      candidates/[id]/route.ts  # POST approve | edit | reject
      settings/route.ts         # POST settings
      health/moodle/route.ts    # Stage 0 reachability check from Vercel
      ics/[secret]/route.ts     # GET → text/calendar
  lib/
    db/schema.ts, db/index.ts   # Drizzle
    supabase/server.ts, client.ts
    moodle.ts                   # wsCall, getToken (client), syncUser
    crypto.ts                   # AES-256-GCM
    time.ts                     # IST bucketing
    llm.ts                      # Claude/Gemini switch
    digest.ts                   # build digest + cached AI intro
    mail/source.ts, mail/extract.ts  # mail ingestion (method TBD) + LLM event extraction
    ics.ts
  certs/globalsign-gcc-r46-ov-tls-ca-2025.pem
  drizzle/                      # migrations
  devlog/stage-0.md …           # build-in-public drafts
  CHANGELOG.md  vercel.json  .env.local (gitignored)
```

Packages: `@supabase/ssr @supabase/supabase-js drizzle-orm postgres undici ai @ai-sdk/anthropic @ai-sdk/google @date-fns/tz date-fns zod` · dev: `drizzle-kit` · UI: `npx shadcn@latest init` + `button card input badge tabs switch sonner`.

---

## STAGE 0 — Foundation (v0.0)

1. `npx create-next-app@latest clario …` (done: Next.js 16.4, React 19.3, Tailwind 4). On campus, `npm install` needs `NODE_OPTIONS=--dns-result-order=ipv4first`, otherwise it hangs.
2. `git init`, push to the **private** GitHub repo; make sure `.gitignore` covers `.env*`.
3. Install the packages above, then shadcn init.
4. Supabase auth:
   - `lib/supabase/server.ts` (`createServerClient` with the `cookies()` adapter), `client.ts` (`createBrowserClient`).
   - `middleware.ts` refreshes the session (standard `@supabase/ssr` pattern).
   - `/login`: email magic link (`signInWithOtp`) + "Continue with Google" (`signInWithOAuth`, enable the Google provider in Supabase).
   - `/auth/callback`: `exchangeCodeForSession` → redirect `/`.
   - In Supabase → Auth → URL config: add the Vercel URL + `http://localhost:3000`.
5. Landing page (signed out): one-line pitch, "what it does", sign-in button, privacy note ("we never see your Moodle password").
6. Signed-in placeholder: "Hi <email>, connect Moodle →".
6b. `GET /api/health/moodle` (protected by CRON_SECRET): calls `tool_mobile_get_public_config` on both instances **from Vercel** with the bundled CA → returns sitename + latency. Proves the cloud can reach IITD Moodle.
7. Deploy: `vercel link` → add env vars in the dashboard → `vercel --prod`.
8. `CHANGELOG.md` → `## v0.0 — Foundation`; `git tag v0.0`; draft `devlog/stage-0.md`.

### ✅ VERIFY v0.0 (you)
- [ ] The prod URL loads the landing page on laptop and phone
- [ ] Magic-link sign-in works; Google sign-in works
- [ ] Sign out → back to landing
- [ ] `/api/health/moodle` on prod returns both sitenames (Vercel can reach IITD Moodle)
- [ ] Repo is private; no `.env` committed (`git log --all -- .env*` is empty)

---

## STAGE 1 — Moodle deadlines (v0.1)

### 1.1 Database (`lib/db/schema.ts`) → `npx drizzle-kit generate && npx drizzle-kit migrate`

```ts
profiles(id uuid pk = auth.users.id, email text, tz text default 'Asia/Kolkata',
         gemini_key_enc text null,
         ics_secret text unique default encode(gen_random_bytes(24),'hex'), created_at)
moodle_connections(id, user_id → profiles, instance text check in ('moodle','moodlenew'),
         moodle_userid int, moodle_fullname text, token_enc text,
         status text default 'ok' /* ok | expired | error */, last_error text,
         last_sync_at timestamptz, unique(user_id, instance))
courses(id, user_id, instance, external_id int, shortname, fullname,
         unique(user_id, instance, external_id))
deadlines(id, user_id, course_id → courses null, source text /* moodle | mail */,
         instance text null, external_key text /* `${modulename}:${instance_id}` | `mail:${candidate_id}` */,
         kind text /* assign | quiz | other */, title, due_at timestamptz, url text,
         done bool default false, last_seen_at timestamptz,
         unique(user_id, source, instance, external_key))
candidate_events(id, user_id, source text /* mail */, source_ref text /* Message-ID */,
         title, course_guess text, due_at timestamptz, confidence real, excerpt text,
         status text default 'pending' /* pending | approved | rejected */, deadline_id null,
         created_at, unique(user_id, source, source_ref, title))
digests(user_id, date, intro text, provider text, primary key(user_id, date))
```
- Create the `profiles` row on first sign-in (upsert in `/auth/callback`).
- The server uses Drizzle over `DATABASE_URL`, which **bypasses Supabase's row-level security**. Every query must filter by `user_id` from `supabase.auth.getUser()`. Still enable RLS with no policies, so the anon key can't read the tables.
- `postgres(DATABASE_URL, { prepare: false })` (required for the pooler).

### 1.2 TLS fix (`certs/` + `lib/moodle.ts`)
Get the missing intermediate certificate from the leaf cert's AIA "CA Issuers" URL:
```bash
echo | openssl s_client -connect moodle.iitd.ac.in:443 -servername moodle.iitd.ac.in 2>/dev/null \
  | openssl x509 -noout -text | grep -A1 "CA Issuers"          # → URL of the intermediate (.crt)
curl -s <that-url> | openssl x509 -inform DER -out certs/globalsign-gcc-r46-ov-tls-ca-2025.pem
# test: curl --cacert <(cat /etc/ssl/certs/ca-certificates.crt certs/*.pem) https://moodle.iitd.ac.in/ -o /dev/null -w "%{http_code}\n"
```
```ts
import tls from "node:tls"; import { Agent, fetch } from "undici";
const ca = [...tls.rootCertificates, readFileSync(path.join(process.cwd(), "certs/globalsign-gcc-r46-ov-tls-ca-2025.pem"), "utf8")];
const moodleAgent = new Agent({ connect: { ca } });   // `ca` REPLACES the defaults → include rootCertificates
```
(Make sure `certs/` is bundled: `outputFileTracingIncludes` in `next.config.ts` for the API routes.)

### 1.3 Moodle client (`lib/moodle.ts`)
```ts
export const INSTANCES = { moodle: "https://moodle.iitd.ac.in", moodlenew: "https://moodlenew.iitd.ac.in" } as const;
export type Instance = keyof typeof INSTANCES;

// Moodle REST: POST form body; array params as courseids[0]=1; errors come back as HTTP 200 + {exception, errorcode, message}
export async function wsCall<T>(inst: Instance, token: string, fn: string, params: Record<string, string|number> = {}): Promise<T> {
  const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${INSTANCES[inst]}/webservice/rest/server.php`, { method: "POST", body, dispatcher: moodleAgent });
  const json: any = await res.json();
  if (json?.exception) throw new MoodleError(json.errorcode, json.message);   // invalidtoken → status 'expired'
  return json as T;
}
```
Sync per connection (`syncConnection(conn)`):
1. `core_webservice_get_site_info` → `userid`, `fullname` (and this also validates the token).
2. `core_enrol_get_users_courses {userid}` → upsert `courses`.
3. `core_calendar_get_action_events_by_timesort {timesortfrom: now-1d, limitnum: 50}` (page with `aftereventid` while 50 come back) → each event: `external_key = ${modulename}:${instance}`, `due_at = timesort`, `title = name`, `url`, `course.id`.
4. `mod_assign_get_assignments {courseids[i]}` → each assignment with `duedate > now-1d`: `external_key = assign:${id}`, `url = /mod/assign/view.php?id=${cmid}`. Fills gaps the calendar call missed.
5. Upsert deadlines with `ON CONFLICT (user_id, instance, external_key) DO UPDATE SET title, due_at, url, last_seen_at` — **never overwrite `done`**.
6. Set `last_sync_at`, `status='ok'`. On `invalidtoken`, set `status='expired'` (the UI shows "Reconnect").

`syncUser(userId)` = all connections in parallel (`Promise.allSettled`).

### 1.4 Connect flow (`app/connect/page.tsx`, client component)
- Two cards: **Moodle** / **Moodle New**, each with a Kerberos ID + password form and a connected/expired badge.
- On submit (in the **browser**):
  ```ts
  const r = await fetch(`${INSTANCES[inst]}/login/token.php`, { method: "POST",
    body: new URLSearchParams({ username, password, service: "moodle_mobile_app" }) });
  const j = await r.json();            // { token, privatetoken } | { error, errorcode }
  // ONLY the token leaves the browser:
  await fetch("/api/connect/moodle", { method: "POST", body: JSON.stringify({ instance: inst, token: j.token }) });
  ```
  Clear the password field right away; never log it.
- `/api/connect/moodle`: zod-validate → `wsCall(site_info)` to check the token → `encrypt(token)` → upsert connection → `syncUser` → `{ ok, fullname }`.
- A note on the page: "Your password goes straight from your browser to IITD Moodle. Clario only stores an encrypted access token, which you can revoke anytime."

### 1.5 Crypto (`lib/crypto.ts`)
AES-256-GCM, key = `Buffer.from(CLARIO_ENC_KEY, "base64")` (32 bytes), random 12-byte IV, output `v1.<iv>.<tag>.<ciphertext>` (base64url). `decrypt` checks the `v1` prefix (lets the key be rotated later).

### 1.6 Dashboard (`app/page.tsx`, server component)
- If `last_sync_at` is more than 30 min old → `await syncUser` (with a 10 s timeout; otherwise show the stale data + "syncing…").
- `lib/time.ts`: `bucket(due_at)` → `overdue | today | next3 | later`, using `TZDate(…, "Asia/Kolkata")`. "Today" = before 23:59:59 IST today; "next3" = the following 3 calendar days.
- Layout: three columns (stacked on mobile): **Today · Next 3 days · Later**, plus a red **Overdue (not done)** strip at the top. Card = course shortname badge, title, due time ("Fri 23:59"), relative time ("in 2 d"), instance tag, link to Moodle, "done" checkbox (`PATCH /api/deadlines/[id]`, optimistic update).
- Group or colour by course shortname (shared across both Moodles).
- Empty state: "No deadlines 🎉" / "Connect Moodle".
- Header: last synced time + "Sync now" button (`POST /api/sync`).

### 1.7 Ship
`CHANGELOG ## v0.1`, `git tag v0.1`, deploy, draft `devlog/stage-1.md` (TLS/CORS/token story + diagram; no tokens or other students' data in screenshots).

### ✅ VERIFY v0.1 (you)
- [ ] Connect **moodle** with your Kerberos login → succeeds, with no CAPTCHA
- [ ] Connect **moodlenew** → succeeds
- [ ] DevTools → Network: the password is only sent to `*.iitd.ac.in`, **never** to the Clario domain
- [ ] Supabase table editor: `token_enc` looks like `v1.…` (no plain token); no password anywhere
- [ ] Dashboard deadlines match Moodle's **Timeline** block on both sites (count + due times in IST)
- [ ] Today / Next 3 days / Later split is correct around midnight
- [ ] "Done" survives a refresh and a re-sync
- [ ] Wrong password → clear error; revoke the token in Moodle (Preferences → Security keys) → "Reconnect" appears

---

## STAGE 2 — In-app digest + approval inbox (v0.2)

### 2.1 LLM layer (`lib/llm.ts`)
```ts
import { createAnthropic } from "@ai-sdk/anthropic"; import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, generateObject, type LanguageModel } from "ai";

type Opts = { userGeminiKey?: string | null };
function candidates({ userGeminiKey }: Opts): LanguageModel[] {
  const gem = (key: string) => createGoogleGenerativeAI({ apiKey: key })(process.env.GEMINI_MODEL!);
  const cla = () => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5");
  if (userGeminiKey) return [gem(userGeminiKey)];                      // user's key → only their key
  const primary = process.env.LLM_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "gemini");
  const order = primary === "gemini" ? ["gemini", "anthropic"] : ["anthropic", "gemini"];
  return order.flatMap(p =>
    p === "anthropic" && process.env.ANTHROPIC_API_KEY ? [cla()] :
    p === "gemini" && process.env.GEMINI_API_KEY ? [gem(process.env.GEMINI_API_KEY)] : []);
}
export async function complete(system: string, prompt: string, opts: Opts = {}) { /* try each model in order with generateText; null if all fail */ }
export async function extract<T>(schema: z.ZodType<T>, system: string, prompt: string, opts: Opts = {}) { /* same, with generateObject */ }
```

### 2.2 In-app digest (`lib/digest.ts`, `app/digest/page.tsx`, top of the dashboard)
- `buildDigest(userId)` → `{ overdue, today, next3 }` (not done), using the same `bucket()` as the dashboard.
- Intro: look up `digests(user_id, today_IST)`. If it's missing, call `complete("You are Clario… 3–4 short lines, what to focus on today. Use ONLY the items given; never invent dates.", JSON(items))` and save it. If that returns null → template "You have N due today, M in the next 3 days." Recompute if the item set changes (hash the item IDs).
- Render: intro card → Overdue → Today → Next 3 days, plus a "N events waiting for approval →" banner if the inbox isn't empty.
- **No email, push or Telegram in v0.**

### 2.3 Mail → approval inbox
**Ingestion method is decided at the gate** (see PLAN.md). Build the pipeline against an interface so the method can be swapped:
```ts
interface MailSource { fetchNew(userId: string, since: Date): Promise<RawMail[]> }   // { messageId, from, subject, date, text }
```
- v0 implementation (always available): **manual** — `/inbox` has "Paste email" (textarea) and ".eml upload".
- Then one of: `ImapSource` (imapflow, encrypted Kerberos password, opt-in), or `ForwardSource` (inbound webhook from an email provider).
- `extractEvents(mail)` → `extract(z.array(z.object({ title, course_guess, due_at /* ISO, IST if no tz */, confidence, excerpt })))`, with system prompt: "Extract only real deadlines/exams/quizzes/submissions; due_at must appear in the text; otherwise return nothing." Prefilter: skip mails without date-like tokens, to save tokens.
- Insert as `candidate_events(status='pending')` and skip duplicates (`unique(user, source, source_ref, title)`).
- `/inbox`: card per candidate = title, course guess (dropdown of the user's courses), due time (editable), confidence badge, excerpt with the date highlighted, **Approve / Edit / Reject**.
- `POST /api/candidates/[id]` `{action:'approve', edits?}` → creates `deadlines(source='mail', external_key='mail:<id>')`, sets `status='approved'`, `deadline_id`. Reject → `status='rejected'` (kept, so it's never proposed again).
- Dashboard cards show a source badge (Moodle / Moodle New / Mail).

### 2.4 Settings (`app/settings/page.tsx` + `POST /api/settings`)
- "Your Gemini API key (optional)": save → test call → `encrypt` → `gemini_key_enc`; "Remove". Show `••••last4`. ⚠️ Note: free-tier Gemini keys may let Google use the data to improve its models.
- Calendar feed: `${APP_URL}/api/ics/${ics_secret}` + copy button + "Google Calendar → Other calendars → From URL"; "Regenerate link".
- "Disconnect Moodle" (deletes the token) and "Delete all my data".

### 2.5 ICS (`lib/ics.ts`, `app/api/ics/[secret]/route.ts`)
- Profile by `ics_secret` (unknown → 404). Not-done deadlines from the last 7 days onwards (all sources, approved only).
- `VEVENT` per deadline: `UID:<id>@clario`, `DTSTART`/`DTEND` (15 min ending at the deadline, UTC), `SUMMARY:[COL334] A3 due`, `URL`, `DESCRIPTION`. Escape `,;\` and newlines, fold at 75 octets, CRLF.
- `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: max-age=900`.

### 2.6 Ship
`CHANGELOG ## v0.2`, `git tag v0.2`, deploy, draft `devlog/stage-2.md`.

### ✅ VERIFY v0.2 (you)
- [ ] `/digest` shows overdue / today / next 3 days correctly, with an AI intro; refresh → same intro (cached)
- [ ] `LLM_PROVIDER=anthropic` and `=gemini` both work; break both keys → template intro, page still loads
- [ ] Your own Gemini key in Settings → used (check AI Studio usage); remove → falls back
- [ ] Paste a real course email with a deadline → appears in `/inbox` as pending with the correct date/course
- [ ] Paste an email *without* a deadline → nothing proposed
- [ ] Approve → shows on dashboard with a "Mail" badge; edit the date before approving works; reject → pasting the same email again proposes nothing
- [ ] ICS link in Google Calendar shows Moodle + approved mail deadlines
- [ ] Decide the mail ingestion method (IMAP vs forwarding) → record it in the PLAN decision log

---

## Gotchas checklist
- Moodle returns errors as **HTTP 200** with an `exception` field. Always check it.
- Moodle arrays: `courseids[0]=…`, not JSON.
- `timesort` / `duedate` are **Unix seconds**.
- Never call Moodle with certificate checking turned off; use the bundled intermediate.
- The password is only ever handled in the browser. Nothing on the server logs request bodies on `/api/connect`.
- The Drizzle connection bypasses RLS, so **every query filters by user_id**.
- Hobby cron limits (see §0).
- `.gitignore` ignores `*.pem` → `!certs/*.pem` exception added.
- LLM output is never the source of a deadline without user approval (mail) or a structured source (Moodle).
- Build-in-public screenshots: blur names, course codes of others, tokens, ICS secret URLs.
