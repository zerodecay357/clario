# Clario — Staged Build Plan + Target Architecture

## Context
Clario is an AI assistant for college students (first launch: IIT Delhi). It pulls a student's scattered academic data (Moodle, Gradescope, Piazza, mail, calendar, WhatsApp, grades, PYQs) into one per-course view and produces deadlines, analysis, study tools and a **daily digest (today + next 3 days)**.

Constraints: **solo builder**, YC perks available. Client choice: **Next.js web app/PWA** (browser extension later). Ingestion strategy: **hybrid, chosen per source** (server-side wherever an API exists; extension only for sites without one).

The product is built **in stages**, and each stage is **documented as a build-in-public post**. **Code is private; the posts are public.** **Today's target: Stages 0 + 1 + 2.**

> **Living document.** This file, `IMPLEMENTATION.md` and `BACKLOG.md` live in the repo and are updated whenever a decision changes. Decision log at the bottom.

## Stages
| Stage | Tag | Ships (definition of done) | Post |
|---|---|---|---|
| 0. Foundation | v0.0 | Private repo, Next.js app deployed on Vercel, landing page, Supabase auth working | "Why I'm building Clario" + architecture diagram |
| 1. Moodle deadlines | v0.1 | Connect moodle + moodlenew (student types their Kerberos username + password; it's sent from the browser straight to Moodle's `token.php`), sync, dashboard (Today / Next 3 days / Later) | "Connecting IITD Moodle without ever seeing your password" |
| 2. In-app digest + approval inbox | v0.2 | **Digest lives in the app** (today + next 3 days, AI intro via `lib/llm.ts`, Claude or Gemini + per-user Gemini key). **Approval inbox**: events extracted from webmail appear as *pending*; the student approves, edits or rejects them, and only approved ones become deadlines. ICS calendar feed | "Human-in-the-loop deadlines: AI proposes, you approve" |
| 3. Extension | v0.3 | MV3 extension → Gradescope + Piazza | "Session capture instead of password storage" |
| 4. Study tools | v0.4 | Material/PDF ingestion + RAG → recap, flashcards (FSRS spaced repetition), quizzes, doubt solver | "RAG over course material" |
| 5. Analysis | v0.5 | Tentative grade range, weakness analysis, revision plan, exam prep mode | "Predicting your grade honestly" |
| 6. More sources | v0.6 | Google Calendar/Notion sign-in, WhatsApp export (through the same approval inbox), PYQ engine | — |
| 7. Platform | v1.0 | Voice overviews, auto-scheduling, mobile app, further developments | — |

### Working mode
Push through as many stages as possible today. **After each stage there is a manual verification step:** I finish the stage, deploy it, and hand over a short "how to verify vX" checklist. I **stop and wait** until you confirm it works before starting the next stage. Bugs found during verification get fixed within that stage before it's tagged.

### Per-stage checklist
1. Build to the definition of done → deploy → **user manually verifies on the deployed URL with their own IITD account (gate)**.
2. `git tag v0.N` + `CHANGELOG.md` entry.
3. Capture screenshots or a short screen recording (blur names, course data and any tokens).
4. Draft the post in `devlog/stage-N.md` in the private repo: problem → what shipped → how it works (with a diagram, but no sensitive code) → decisions and trade-offs → what's next. Then adapt it into a LinkedIn/X thread.
5. Review before publishing: no secrets, tokens, internal URLs with tokens, or other students' data.

The Stage 0–2 details are in the "v0 scope" section below (it maps to Stages 1–2; Stage 0 is scaffolding, auth and deploy).

## Current status (end of session 2026-10-10)
- **Stage 0 ≈ 90 %, not tagged.** Live at https://clario-smoky.vercel.app (Vercel, region still `iad1`). Supabase project `tjvuoodrfgvcxxhotqrt` (email magic link on; Google off, see `NEXT_PUBLIC_GOOGLE_AUTH`).
- Live checks passed: landing 200, `/login` 200, health route returns 401 without the secret, no `.env.local` on GitHub, **moodlenew reachable from Vercel** ✅.
- **Open before tagging v0.0:**
  1. ❌ **GitHub repo is PUBLIC.** Switch it to Private (Settings → Change visibility).
  2. ❌ **Old Moodle is unreachable from Vercel (`ENOTFOUND`).** See the verified facts below. The user believes it works without IITD WiFi → **test on mobile data with no VPN**: open `https://moodle.iitd.ac.in` and note the final URL. Then decide how to sync old Moodle (options: browser-side sync on campus/VPN *(recommended if campus-only)*, campus relay, or moodlenew-only until the Stage 3 extension).
  3. Switch the Vercel Function Region to `bom1` (Mumbai) and redeploy.
  4. Add the Vercel URL to Supabase Auth → URL Configuration (Site URL + `https://clario-smoky.vercel.app/**`); test magic-link login live and on localhost.
- Then: tag `v0.0`, finalize `devlog/stage-0.md`, start Stage 1.

## Verified facts (checked 2026-10-10)
- **DNS:** `moodlenew.iitd.ac.in` is public (`103.27.8.65`). **`moodle.iitd.ac.in` is NXDOMAIN on public DNS** (Cloudflare DoH, SOA `dns8.iitd.ac.in`) and resolves to the private address `10.10.17.1` on the campus network. Vercel health check: moodle `ENOTFOUND`, moodlenew OK (~1.2 s from iad1). Not yet confirmed by an off-campus browser test (the user disputes it).
- `moodle.iitd.ac.in` ("2025-2026") and `moodlenew.iitd.ac.in` ("2025-2026 (NEW)") both report `enablewebservices=1`, `enablemobilewebservice=1`, `typeoflogin=1`. So `POST /login/token.php?service=moodle_mobile_app` (username, password) → `wstoken`. This API route doesn't hit the CAPTCHA on the website login form (to confirm with a real login).
- Both send `Access-Control-Allow-Origin: *` on `token.php` and `webservice/rest/server.php`, so **the browser does the token exchange directly; the password never reaches Clario's servers.**
- Both serve a GlobalSign cert **without the intermediate** (openssl verify code 21). Browsers cope, but Node `fetch` fails. Fix: bundle the "GlobalSign GCC R46 OV TLS CA 2025" intermediate PEM in the repo and pass it via an undici `Agent({ connect: { ca } })` for Moodle calls (or `NODE_EXTRA_CA_CERTS`). Never turn off certificate checking.

## v0 scope (today)
1. **Auth**: Supabase Auth (Google sign-in or email magic link).
2. **Connect Moodle page**: one card per instance (Moodle, Moodle New). The student types their Kerberos username + password. A browser-side form POSTs to `https://<host>/login/token.php?service=moodle_mobile_app` → receives the token → sends `{instance, token}` to `/api/connect/moodle`. The server encrypts it (AES-256-GCM, key in env `CLARIO_ENC_KEY`) and stores it.
3. **Sync** (`/api/sync`, run when a student connects + Vercel Cron hourly), per connected instance, via `webservice/rest/server.php?moodlewsrestformat=json&wstoken=…&wsfunction=…`:
   - `core_webservice_get_site_info` → moodle userid, fullname
   - `core_enrol_get_users_courses` → courses
   - `core_calendar_get_action_events_by_timesort` (timesortfrom=now, limit 50) → assignments, quizzes, any activity with a due date
   - `mod_assign_get_assignments` → descriptions + due dates (backup for the calendar call)
   - Upsert into `deadlines` keyed by `(user, instance, external_id)`. If both Moodles list the same course, merge them by course shortname.
4. **Dashboard** (`/`): "Today" and "Next 3 days" columns, then "Later", grouped by course, each with a link back to the Moodle page, plus overdue/done states and a manual "mark done" toggle.
5. **In-app digest** (`/digest`, also the top of the dashboard): today + next 3 days. The configured LLM (Claude Haiku 5.5 or Gemini, via `lib/llm.ts`) writes a 3–4 line "what to focus on" intro, cached per user per day (if it fails, fall back to a plain template). **No email or push in v0.**
5b. **Approval inbox** (`/inbox`): mail → LLM extracts candidate events `{title, course guess, due_at, confidence, excerpt}` → saved as `pending` → the student **Approves / Edits / Rejects** → approved ones become `deadlines` with `source='mail'`. Rejected ones are kept so the same event isn't proposed again.
   - **Open decision (decide at the Stage 2 gate):** how to read webmail. Reading needs **IMAP** (SMTP only sends), and IITD IMAP needs the Kerberos password stored on the server. Options: (a) **likely choice given the Kerberos decision**: IMAP with the Kerberos password stored encrypted, opt-in; (b) a forwarding rule from IITD mail to a per-user Clario inbound address; (c) for the demo, paste or upload an email (.eml) manually. The extraction + approval pipeline is the same whatever we choose.
6. **Stretch (if time)**: a per-user calendar feed `/api/ics/<secret>` that the student can subscribe to in Google Calendar. This puts deadlines in their calendar with no OAuth.

**Explicitly not today:** extension, Gradescope/Piazza, Google OAuth calendar read, RAG/flashcards/quizzes, grades analysis, WhatsApp, voice, email/push/Telegram notifications.

## Stack (lean on YC perks)
Single Next.js 16 app (App Router, TypeScript, Tailwind + shadcn/ui) on **Vercel** · **Supabase** (Postgres + Auth) · **Drizzle** ORM · **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/google`) · **PostHog** (optional). (Resend dropped: no email digest.) No monorepo yet; split into one when the extension arrives.

### LLM provider: Claude or Gemini
All LLM calls go through `lib/llm.ts` → `getModel(task)`. It returns an AI SDK model based on env vars, so the rest of the code never imports a provider directly:
- `LLM_PROVIDER=anthropic|gemini` (default: whichever key is set; Anthropic if both are)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-5-5`)
- `GEMINI_API_KEY` (Google AI Studio key), `GEMINI_MODEL` (configurable, e.g. a Gemini Flash model)
- If the main provider errors, `getModel` tries the other one if its key is set. If neither works, the digest uses the plain template and mail extraction is retried on the next sync.
- **Optional per-user key**: a Settings page field "Your Gemini API key", stored encrypted with the same `lib/crypto.ts`. When set, that user's AI calls use their own key, so they pay for their usage instead of Clario.

New repo: `~/Desktop/clario` (outside the COL334 repo).

### Files
- `app/page.tsx` — dashboard; `app/connect/page.tsx` — Moodle connect (client component doing the token exchange)
- `app/digest/page.tsx`, `app/inbox/page.tsx` (approval inbox)
- `app/api/connect/moodle/route.ts`, `app/api/sync/route.ts`, `app/api/candidates/[id]/route.ts` (approve/edit/reject), `app/api/ics/[secret]/route.ts`
- `lib/moodle.ts` — `wsCall(instance, token, fn, params)` with the GlobalSign CA agent; `syncUser(userId)`
- `lib/llm.ts` — provider switch (Anthropic/Gemini, env + optional per-user Gemini key); `app/settings/page.tsx` — digest toggle + own Gemini key
- `lib/crypto.ts` — encrypt/decrypt tokens; `lib/digest.ts` — build digest + cached intro; `lib/mail/` — mail source + `extractEvents()`; `lib/db/schema.ts`
- `certs/globalsign-gcc-r46-ov-2025.pem`; `vercel.json` — cron (`0 * * * *` sync)

### Schema (v0)
`profiles(id, email, tz, gemini_key_enc, ics_secret)` · `moodle_connections(user_id, instance, moodle_userid, token_enc, last_sync_at, status)` · `courses(id, user_id, instance, external_id, shortname, fullname)` · `deadlines(id, user_id, course_id, source /* moodle|mail */, instance, external_key, kind, title, due_at, url, done)` · `candidate_events(id, user_id, source, source_ref, title, course_guess, due_at, confidence, excerpt, status /* pending|approved|rejected */, deadline_id)` · `digests(user_id, date, intro)`

### Time-boxed order for today (~10 h)
- **Stage 0** (1 h): scaffold + Supabase + deploy an empty app to Vercel + landing page → tag v0.0, draft `devlog/stage-0.md`
- **Stage 1** (5 h): `lib/moodle.ts` + test with your own token on both instances (1.5 h) → connect flow + encrypted storage (1.5 h) → sync + schema + dashboard (2 h) → tag v0.1, draft `devlog/stage-1.md`
- **Stage 2** (3 h): `lib/llm.ts` (Claude/Gemini) + in-app digest (1 h) → mail extraction + approval inbox (1.5 h) → ICS feed + settings page (0.5 h) → tag v0.2, draft `devlog/stage-2.md`
- Buffer (1 h): polish, privacy note on the connect page, review posts before publishing

## Target architecture (after v0)
```
Clients: Web PWA · MV3 extension (captures Gradescope/Piazza sessions) · later Expo
API: Next.js on Vercel
Jobs: Inngest/Trigger.dev durable workflows — sync.<source> → extract (Haiku, structured)
      → merge duplicate deadlines → embed → digest/recap
Data: Postgres + pgvector (course material, PYQ, Piazza chunks) + object storage
Intelligence: orchestrator agent (Sonnet 5.5) with tools (deadlines, RAG search, grades,
      free slots, flashcards, quiz, memory); deterministic engines for grade estimate,
      FSRS spaced repetition, slot finding; TTS (ElevenLabs) for 3-min class overviews
Ingestion per source: Moodle WS token · Google/Notion OAuth · mail forwarding address ·
      Gradescope/Piazza via extension session · course sites crawled · WhatsApp export upload
Security: encrypted secrets, row-level security, DPDP Act consent + delete-my-data
```
Roadmap after v0: Gradescope + Piazza (extension) → RAG over materials → recap/flashcards/quizzes → weakness analysis + tentative grade → revision plan + exam prep mode → WhatsApp/mail/PYQ → voice overview → "further developments" list.

## Verification
- Run `lib/moodle.ts` locally with your own IITD login on both instances. Confirm that `token.php` returns a token (no CAPTCHA) and that the deadlines listed match the Moodle "Timeline" block.
- On the deployed Vercel URL: sign up → connect both Moodles → dashboard shows the correct today/next-3-days split in IST.
- `/digest` shows the right items and an AI intro. Repeat with `LLM_PROVIDER=gemini` and with a per-user Gemini key.
- Inbox: a test email with a deadline → appears as pending → approve → shows on the dashboard; reject → never proposed again.
- Check that the DB stores only encrypted tokens and no password appears in Vercel logs.

## Decision log
- **2026-10-10** Name: Clario. Hybrid ingestion per source. Web PWA first. Claude + Gemini (env switch + per-user Gemini key). Staged build, build-in-public posts, private code.
- **2026-10-10** Moodle tokens stored on the server, encrypted.
- **2026-10-10** No email/push digest: **the app is the digest**. Webmail-extracted events go through an **approval inbox** before becoming deadlines. Webmail access method (IMAP vs forwarding vs manual) decided at the Stage 2 gate.
- **2026-10-10** **Students type their Kerberos username + password** (no no-password flow). Moodle: password goes browser → `token.php`, only the token is stored.
- **2026-10-10** Build v0 first; design improvements are in `BACKLOG.md` and adopted gradually.
