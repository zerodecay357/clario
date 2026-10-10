# Clario

Every deadline from every course, in one place. An AI assistant for IIT Delhi students.

**Private repository.** Product docs: [`docs/PLAN.md`](docs/PLAN.md) (plan + decision log), [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) (how), [`docs/BACKLOG.md`](docs/BACKLOG.md) (risks & deferred design work). Build-in-public drafts live in [`devlog/`](devlog/).

## Develop

```bash
cp .env.example .env.local   # fill in Supabase keys; generate CLARIO_ENC_KEY and CRON_SECRET
npm install                  # on the IITD network: NODE_OPTIONS=--dns-result-order=ipv4first npm install
npm run dev
```

Requires Node 22+ (Supabase libraries). Node 20 works with deprecation warnings.

Health check (proves the server can reach IITD Moodle with full TLS verification):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/health/moodle
```
