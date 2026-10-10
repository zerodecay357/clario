# Changelog

## v0.0 — Foundation (unreleased)
- Next.js 16 app with Supabase auth: Google sign-in and email magic link.
- Landing page and signed-in placeholder.
- `/api/health/moodle`: checks that the deployment can reach both IITD Moodle instances, with full TLS verification (bundled GlobalSign intermediate, because IITD's servers don't send it).
- Docs: plan, implementation guide, risk/design backlog.
- Google sign-in button hidden until the provider is enabled (`NEXT_PUBLIC_GOOGLE_AUTH=1`).
- Health check reports the underlying network error (`cause`), which surfaced old Moodle's `ENOTFOUND` from Vercel.
