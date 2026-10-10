# Clario — Backlog of risks & design improvements

From the design review on 2026-10-10. **Decision: build v0 first, adopt these gradually.** When an item is adopted, move it into `PLAN.md` (decision log) and `IMPLEMENTATION.md`, then mark it here as ✅ with the version.

Priority: 🔴 critical · 🟠 important · 🟡 later

## Risks
| # | Pri | Risk | Mitigation idea | Status |
|---|---|---|---|---|
| R1 | 🔴 | Asking for the Kerberos password looks like phishing; students may not trust it, and CSC may warn students or block the site | Clear explanation on the connect page; show that the password goes straight to `*.iitd.ac.in` (DevTools-verifiable); talk to CSC before public launch | open |
| R2 | 🔴 | A `moodle_mobile_app` token gives full account access (submit, post, message), not just read access. Stored tokens are a high-value target, and the encryption key sits next to the DB | One-click revoke/delete; keep as little data as possible; ask CSC for a dedicated **read-only** web service; consider a KMS-held key | open |
| R3 | 🔴 | Unknown whether Vercel (outside campus) can reach IITD Moodle; heavy polling from cloud IPs may be flagged | `/api/health/moodle` in Stage 0; poll gently; respect limits; contact CSC | in v0.0 |
| R4 | 🔴 | A false "all clear": v0 only sees Moodle, but many courses use Gradescope, Piazza or course sites | Per-course **coverage indicator**; never say "nothing due" unless every source for that course is connected | open |
| R5 | 🟠 | Wrong or messy dates: "opens" events, quiz open/close, the same course on both Moodles, extensions announced in class or on Piazza | Filter by event type; keep **source + last-confirmed** on every deadline; show conflicts instead of silently choosing | partly v0.1 (event type) |
| R6 | 🟠 | Storing the Kerberos password for IMAP (Stage 2) means holding the institute-wide password | Opt-in only, encrypted, revocable; offer forwarding or manual paste as alternatives | decide at v0.2 gate |
| R7 | 🟠 | The AI invents deadlines or dates | Moodle deadlines are structured data; mail-extracted ones need **user approval**; the AI intro only describes items it's given | in v0.2 |
| R8 | 🟠 | Free-tier Gemini keys may let Google use the data to improve its models | Warning next to the "your own key" field | in v0.2 |
| R9 | 🟠 | Academic integrity: the doubt solver and quizzes could be used for graded work | "Hints, not answers" policy for anything that looks like a current assignment | before v0.4 |
| R10 | 🟠 | Differentiation: "Moodle already has a timeline" | Lead with combining sources + approval inbox; bring Gradescope in early | roadmap |
| R11 | 🟡 | Posting about this publicly before CSC knows may draw attention before the security story is solid | Share the security story first; launch to friends before going public | open |

## Design improvements
| # | Pri | Improvement | Why | Status |
|---|---|---|---|---|
| D1 | 🟠 | **Connector interface** for every source: `sync() → raw_items → normalize → deadlines/candidates` | Gradescope, Piazza, WhatsApp plug in the same way; reprocess after bug fixes | partly (MailSource interface in v0.2) |
| D2 | 🟠 | **Keep the raw payloads** (`raw_items(source, external_id, hash, payload, fetched_at)`) | Debugging + re-extraction without re-fetching | open |
| D3 | 🟠 | **Provenance & confidence** on every deadline (`sources[]`, `last_confirmed_at`) | Trust; conflict display (R5) | open |
| D4 | 🟡 | **Fetch shared course data once per course**: materials and announcements once per course, personal data per student | 50× less load on IITD; cheaper AI processing; cross-checking deadlines | open |
| D5 | 🟡 | **Universities as config, not code** (`institutions`, `connector_instances` tables) | Expand to other colleges without code changes | open |
| D6 | 🟡 | RLS-backed Supabase client for user queries (defence in depth) instead of only filtering in app code | A single missed `where user_id` can't leak data | open |
| D7 | 🟡 | Background job tools (Inngest/Trigger.dev) instead of a cron loop: one job per user per source | Timeouts, retries, isolation | open |
| D8 | 🟡 | **Source health monitoring**: last success per connector, error-rate alerts | Notice broken scrapers before users do | open |
| D9 | 🟡 | Mobile app (Expo) once the web app is stable; app notifications are the digest channel | The user's chosen direction: "the app shows everything" | roadmap |
| D10 | 🟡 | Security review of token/password handling before opening to people beyond friends. Includes **rotating `CRON_SECRET`** (it appeared in a chat log on 2026-10-10) | R1/R2/R6 | before public launch |
