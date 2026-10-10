# Stage 0 — Why I'm building Clario (draft)

> Draft for a build-in-public post. Review before publishing: no secrets, tokens, or other students' data.

## The problem
An IIT Delhi student's semester is spread across two Moodle instances, Gradescope, Piazza, webmail, WhatsApp groups and course websites. Deadlines hide in all of them.

## What Clario will do
- One list of every deadline: today, the next 3 days, later.
- An approval inbox: AI finds deadlines in your email, and you approve them before they count.
- Later: study tools (recaps, flashcards, quizzes), grade estimates and exam prep mode.

## How it's built (diagram to add)
Web app (Next.js) → Supabase (auth + Postgres) → connectors per source → AI layer (Claude or Gemini).

## Stage 0: shipped
- Sign-in, landing page, deployed.
- First surprise: IITD's Moodle servers don't send their full TLS certificate chain. Browsers fix this quietly; Node doesn't. Fix: bundle the missing GlobalSign intermediate. Never just turn off verification.

## Next
Stage 1: connect Moodle and see your deadlines.
