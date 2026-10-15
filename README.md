# Open Job Tracker

A private job-application dashboard with resume onboarding, a Codex CLI worker,
and guided integrations for ChatGPT Dots and Claude Code. Each person runs their own copy with their own account, resume,
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

## Choose your agent

| Option | What is included | Where it runs |
| --- | --- | --- |
| ChatGPT / Codex | CLI worker, preflight and recovery | The machine running the worker |
| ChatGPT Dot | Private MCP server, plugin handoff and step-by-step guide | Dot cloud, after private access and tools are verified |
| Claude | Claude Code setup and shared API workflow | The authorized Claude/browser environment |

Open **Connect your agent** (`/connect`) to copy a setup message for your own
tracker URL. Dots require a privately hosted HTTPS copy. The local page explains
this instead of handing a Dot an unusable localhost URL. Copying a message does
not install tools, authenticate an agent, create a schedule or start a worker.

For an LLM installing this project, read [AGENTS.md](AGENTS.md) first. Claude also
has [CLAUDE.md](CLAUDE.md). Use the detailed, numbered guides:

- [ChatGPT / Codex installation and usage](docs/GPT-WORKFLOW.md)
- [Dot cloud installation, private hosting and scheduling](docs/DOTS-WORKFLOW.md)
- [Claude installation and usage](docs/CLAUDE-WORKFLOW.md)
- [Shared execution protocol for every LLM](docs/AGENT-PROTOCOL.md)

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

## ChatGPT / GPT step-by-step

1. Install this repository using **Local setup**, or use the Dot route below for
   cloud-only work. Keep existing private data when updating.
2. Complete **First run** with your own resume, locations, limits and facts.
3. Install the [official Codex CLI](https://learn.chatgpt.com/docs/codex/cli), sign
   in with `codex login`, and configure browser tools for that CLI environment.
4. Run `npm run worker:check`, then `npm run worker` in a second terminal.
5. Review verified results, blockers and the saved schedule. Keep the server and
   worker running for local recurring work; use Pause before switching providers.

A capable ChatGPT/Codex session can instead follow the shared API protocol. Open
**Connect your agent → ChatGPT / Codex** and send its message to that session.
Do not run that session and the CLI worker together. Plain GPT chat or an API key
alone does not supply browser automation, authenticated HTTP or file-upload tools.

Copy this instruction to your LLM:

> Install my own copy of this repository. Read AGENTS.md and
> docs/GPT-WORKFLOW.md. Confirm my local or cloud execution choice, preserve private
> state, and follow the numbered installation steps. Help me review my resume,
> roles, locations, frequency, limits and factual answers. Verify tools before
> claiming work. Use one worker and docs/AGENT-PROTOCOL.md for authorized batches.

## Private MCP integration

The project now declares MCP and serves `POST /mcp`. Publishing your own
owner-private Sites copy provisions its own personal dashboard plugin. It reads
the resume and preferences from that copy’s database at runtime. No applicant
profile or Site identity is bundled.

Install/connect your dashboard under **Plugins → Personal → Created by you** and
refresh the agent’s tools. Verify `get_handoff`, `get_tracker_state`, `get_resume`
and a harmless `record_activity` write before claiming any application batch.
Use `claim_batch`, `heartbeat`, `record_jobs` and `finish_batch` for execution;
these retain the existing database ownership, deduplication and cap rules.

Read [MCP connection, tool map and troubleshooting](docs/MCP-INTEGRATION.md). A
browser block on `/api/...` is a reason to use the supported plugin connection,
not to make the site public. MCP may require plugin authentication even when a
service token works on ordinary API routes. Claude users still need a verified
compatible connection or the documented direct API workflow.

## Add it to your Dot, step-by-step

1. Publish **your own** copy behind owner-only authentication with its own D1
   database and migrations. Follow **Private hosting and security** below and the
   [Sites publishing steps](docs/DOTS-WORKFLOW.md#publish-a-private-copy-with-sites).
   Never expose an unauthenticated development server to reach it from the cloud.
2. Complete the resume and preference setup on that hosted copy.
3. Install/connect this copy’s dashboard plugin, then open **Connect your agent
   → ChatGPT Dot** and copy the generated message.
4. Send it to your Dot. Require its own cloud computer/browser, with no use of your
   personal computer and no delegation to Codex or Work tasks.
5. Have it verify the plugin’s handoff, queue and resume tools, plus a harmless
   activity write. Complete any cloud browser sign-in and verify resume-file
   handling before claiming work.
6. If you want background checks, request one Dot cloud queue-check schedule every
   15 minutes in your timezone. Verify its real identifier and next run under
   **Scheduled**. If unsupported, leave it manual or blocked, not falsely connected.
7. Let it process only queued/due batches through MCP `claim_batch` and its
   heartbeat/result/finish tools. Saved manual,
   daily or weekly preferences still determine which batches are due.
8. Review confirmations; use **Apply for more** within your saved limits. To stop,
   pause the dashboard and disable the Dot schedule separately.

The generated prompt is the LLM handoff. It points to the installed copy’s
MCP `get_handoff`, with `/api/agent-guide` as a direct API alternative. Both
supply claim, heartbeat, cap, pause, evidence and recovery instructions. No applicant data or credential is embedded in it.

This is a guided integration; a real Dot submission run has not been validated by
this project. A 15-minute poll may show offline between checks because worker
heartbeats expire after 90 seconds. Do not confuse that indicator with a saved
schedule or verified browser connection. Dots have usage allowances, and delegated
Codex/Work tasks still consume those products' limits. See the official
[cloud browser](https://learn.chatgpt.com/docs/dots/computers-and-apps),
[schedules](https://learn.chatgpt.com/docs/dots/tasks-and-memory) and
[usage guidance](https://learn.chatgpt.com/docs/dots).

## Use it with Claude, step-by-step

1. Follow **Local setup** and **First run** above. Keep the dashboard server open.
2. Install Claude Code from its [official quickstart](https://code.claude.com/docs/en/quickstart)
   and complete the supported sign-in flow with your own account.
3. Configure authorized browser tools. For the supported local Chrome route,
   install the official Claude in Chrome extension, then run `claude --chrome`
   in this repository. Use `/chrome` to check the connection. Follow its
   [account and platform prerequisites](https://code.claude.com/docs/en/chrome).
4. Open **Connect your agent → Claude** and send its setup message to Claude Code.
   Do **not** run `npm run worker`, which starts Codex.
5. Have Claude read `CLAUDE.md`, verify API/browser/upload access and follow
   `docs/AGENT-PROTOCOL.md` to claim one batch, maintain heartbeats, record each
   confirmation and finish it truthfully.
6. Review the results and use **Apply for more** for another authorized batch.
   There is no bundled Claude daemon or scheduler; repeated background execution
   requires a separately configured, authorized runner with the same capabilities.

Copy this instruction to Claude:

> Install my private copy of this repository. Read CLAUDE.md and
> docs/CLAUDE-WORKFLOW.md and follow their numbered steps. Use Claude, not the Codex
> worker. Respect my selected execution environment. Help me save my resume,
> roles, locations, frequency, limits and verified facts. Check browser/API/upload
> access before claiming work, and follow docs/AGENT-PROTOCOL.md for each batch.

Local Claude Chrome access uses that computer. If you want your personal computer
untouched, provide a separate supported machine/environment and verify its browser
and private API access. Hosting only the dashboard does not relocate the browser.
A plain Claude chat is not an execution integration. Claude submissions have not
been end-to-end validated by this project; normal permissions and usage apply.

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
does not create an operating-system automation. For the local CLI path, the server, worker, and computer must remain running.
A configured Dot cloud schedule uses the hosted server and its own cloud environment. Pausing can stop future steps, but an
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

- `app/mcp/route.ts` and `lib/mcp-tools.ts`: private MCP transport and typed tools.
- `app/connect/page.tsx`: provider handoff; `app/api/agent-guide/`: read-only LLM protocol.
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

This is a single-owner starter, not a multi-user hosted product. Dot and Claude
paths use the private MCP server or documented HTTP protocol, with no bundled
provider daemon. Sites provisions a personal plugin per copy; this repository
does not implement OAuth or automatic access to an owner’s connected apps. Being signed into ChatGPT in a browser does not connect this
app to Codex. The CLI worker requires its own configured login and tools. Employer
websites vary, and successful automation is never guaranteed. Review blockers and
confirmation evidence rather than treating every attempted submission as success.
