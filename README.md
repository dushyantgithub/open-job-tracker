# Open Job Tracker

A private job-application dashboard with resume onboarding and an optional Codex
CLI worker. Each person runs their own copy with their own account, resume,
preferences, database, and application history.

The source archive contains no applicant data, accounts, credentials, application
history, or database. No public service or shared account is created by installing
it. The original application code is MIT licensed; retained third-party notices
are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## What it does

- Reads a text-based PDF, Markdown, or TXT resume (up to 1 MiB).
- Suggests role types using local keyword matching and shows supporting evidence.
  You review the suggestions and can add or remove roles. This is not an AI resume
  evaluation, a hiring decision, or a guarantee that every suggested role fits.
- Saves location selections, manual/daily/weekly frequency, a per-run limit, and a
  total cap. Available locations are EU, US, India, Australia, and Canada. India
  currently offers Bangalore/Bengaluru, Pune, and Mumbai city selections.
- Queues a run through **Save and start**. **Apply for more** queues another batch
  within the saved limits. A configured worker is required to execute either.
- Tracks verified applications, research, exclusions, blockers, salary details,
  sponsorship information, resume versions, and confirmation evidence.
- Supports search, sorting, filters, detail drawers, live updates, and CSV export.

## Local setup

Requirements: Node.js **22.13 or newer**, npm, and an environment that can run the
included Cloudflare Worker development runtime. A Codex account and CLI are only
needed for the optional worker; the dashboard works without them.

Clone the repository, or extract the source archive and open a terminal in its folder:

```sh
git clone https://github.com/dushyantgithub/open-job-tracker.git
cd open-job-tracker
```

Then install and start the dashboard:

```sh
npm ci
npm run build
npm run db:migrate
npm start -- --port 8787
```

Open **http://127.0.0.1:8787**. Keep this terminal running. The migration command
applies pending SQL files and records them so subsequent runs do not replay them.
The database is local under `.wrangler/state/`. Build before migrating because the
migration tool uses the generated `dist/server/wrangler.json` binding configuration.

For development, after installing and migrating:

```sh
npm run dev -- --hostname 127.0.0.1
```

The development server normally uses port 5173. Set the worker's `TRACKER_URL` to
that address if using it with the development server. The production-build local
preview and development server share this copy's `.wrangler/state/` database.

To update a copy, preserve its private state, install the new locked dependencies,
run the build, apply pending migrations, and restart the server. Do not replace a
working database with another user's data or a demo seed.

## First run

1. Upload your own resume. Scanned image PDFs may need a Markdown or TXT version.
2. Review the suggested role types. Remove weak matches and add suitable roles.
3. Choose locations and, if India is selected, at least one supported city.
4. Set a frequency and application caps. The total cap must be at least the per-run
   limit. Defaults are examples for a new private setup, not an instruction to apply.
5. Choose **Save and start**. The dashboard shows the request as queued until an
   authorized worker picks it up.

Use the optional **Application facts** field in the final setup step for your
verified work authorization, citizenship, sponsorship needs, languages, notice
period, salary preferences, portfolio links and other essential application facts.
These saved facts are passed to each worker session. A fresh worker cannot see
your other Codex chats. Location selection does not establish any of these facts.
Unknown required answers must block an application rather than be guessed.

## Connect your Codex worker

Install and sign in to the official Codex CLI using your own account. Configure
the browser tools you want that CLI session to use. In a second terminal, with the
dashboard server still running:

```sh
codex login status
npm run worker:check
npm run worker
```

`worker:check` verifies the CLI login and tracker connection. Browser capabilities
are checked by the agent when a run begins. `npm run worker` keeps checking the
queue while the process runs. For one check, use:

```sh
node scripts/codex-worker.mjs --once
```

The default `TRACKER_URL` is `http://127.0.0.1:8787`. `CODEX_BIN` optionally selects
your Codex CLI executable. You do not need to add an API key to this app when the
CLI is already signed in with a supported account. Account availability, usage
limits, and pricing remain those of your own Codex service.

The worker runs the CLI with workspace-write access and normal approval behavior.
It does not bypass CAPTCHAs, browser permissions, logins, or confirmation rules.
Missing tools or applicant facts can leave a run blocked. Read
[docs/CODEX-WORKFLOW.md](docs/CODEX-WORKFLOW.md) before enabling submissions.

## Use the dashboard

- Choose a status tab, search a company/role/location, or use filters to narrow the
  table. These controls change the view, not saved search preferences.
- Click a column heading to sort, or a role to open the complete application record.
- **Export** downloads the currently filtered records as CSV.
- **Activity log** shows progress and queue events. Only confirmed submissions count
  toward applications sent. Excluded roles and unresolved attempts are separate.
- **Pause** stops future scheduling and asks active work to stop. Wait until it is
  paused, then use **Edit setup** to change the search. **Resume search** queues a
  fresh batch after you review any uncertain submissions.
- **Apply for more** queues up to the saved per-run limit without exceeding the
  remaining total cap. It does not run a browser inside this website.

A running worker consumes daily/weekly schedule preferences. The next recurring
batch is scheduled after the previous batch completes. Saving a preference
does not create an operating-system automation. The server, worker, and computer
must remain running for scheduled checks. Pausing can stop future steps, but an
already transmitted application cannot be recalled by this dashboard.

## Private hosting and security

**This app has no built-in user authentication or tenant isolation.** Local use
must stay bound to loopback. Any hosted copy must sit behind an authentication
boundary that permits only its owner and trusted service worker on **every** page
and API route. Each person needs a separate database and deployment.

Same-origin and content-type checks are request protections, **not authentication**.
A public deployment would expose the resume, ledger, queue, and mutation APIs.
Do not expose a development server or use a public hosting URL without a real
owner-only access gate. See [docs/SECURITY.md](docs/SECURITY.md).

`.openai/hosting.json` contains only generic D1/R2 binding declarations. It has no
Site/project identity. If using the Sites plugin, register a fresh private Site
for this copy, retain its owner-only audience, and follow the plugin's publishing
workflow. Other Worker hosting needs equivalent private access, D1 binding, and
migration configuration. No deployment or authentication service is provisioned
by these local setup commands.

## Recover an interrupted worker

After a crash, the worker preserves `.private/active-request.json` and refuses to
start a new batch until you review its private run logs and submission proofs.
Check whether any application may already have been sent, then run:

```sh
npm run worker -- --recover
```

Recovery imports saved updates and marks the interrupted batch blocked. Resume
explicitly from the dashboard after reviewing its ledger. It does not resubmit
uncertain applications automatically.

## Source and customization

- `app/page.tsx`: dashboard; `components/onboarding.tsx`: guided setup.
- `lib/profile.ts`: generic display name, initials, export prefix, locale, timezone.
- `lib/tracker.ts`: job and run shapes; `lib/onboarding-core.ts`: setup validation.
- `app/api/`: private-copy API; `db/` and `drizzle/`: schema and migrations.
- `scripts/codex-worker.mjs`: optional local worker; `scripts/worker-core.mjs`: checks.
- [TRACKER-API.md](TRACKER-API.md): endpoint contract for your own integrations.

Keep private inputs out of tracked source. `.private/`, `.wrangler/`, `.env*`,
build outputs, dependencies, and generated runtime state are excluded from the
source package. The optional worker stores private resumes, plans, logs, and proof
images in `.private/runs/`. Do not upload that directory to a public repository.

## Validation

```sh
npx tsc --noEmit --incremental false
npm run build
node --test tests/*.test.mjs
```

The app uses Vinext, React, Cloudflare Workers/D1, and Drizzle. Existing third-party
licenses remain applicable. Build and dependency logs may include upstream warnings.

## Integration limits

This is a single-owner starter, not a multi-user hosted product. There is no
ChatGPT plugin, OAuth provider, remote MCP server, or automatic access to an
owner's ChatGPT apps. Being signed into ChatGPT in a browser does not connect this
app to Codex. The CLI worker requires its own configured login and tools. Employer
websites vary, and successful automation is never guaranteed. Review blockers and
confirmation evidence rather than treating every attempted submission as success.
