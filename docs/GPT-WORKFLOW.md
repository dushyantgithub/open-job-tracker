# Install and use with ChatGPT or Codex

The included automatic runner is the Codex CLI worker. A normal ChatGPT chat
without execution, browser and private API tools cannot run this repository or
submit applications. A GPT API key alone does not provide those capabilities.
For execution without your personal computer, use the separate
[Dot cloud guide](DOTS-WORKFLOW.md), or provision an authorized isolated environment.

## Owner setup, step by step

1. Install Git, Node.js 22.13+ and npm on the machine that will run this copy.
2. Clone and install:

   ```sh
   git clone https://github.com/dushyantgithub/open-job-tracker.git
   cd open-job-tracker
   npm ci
   npm run build
   npm run db:migrate
   npm start -- --port 8787
   ```

3. Keep the server terminal running. Open `http://127.0.0.1:8787` on that machine.
   Upload your resume, review roles, select locations, set frequency and caps, and
   enter verified application facts. **Save and start** queues the first batch.
4. Install the official Codex CLI using its current installation guide. Complete
   `codex login` with your own supported account, then `codex login status`.
   Configure browser tools in the CLI environment before enabling submissions.
5. In a second terminal in the repository, run:

   ```sh
   npm run worker:check
   npm run worker
   ```

6. Review the first run in the dashboard. Preflight checks CLI login and API access;
   the agent verifies browser tools at the start of the batch. Missing browser
   capability or a required personal answer produces a blocker, not a submission.
7. Keep server, runner and its machine awake for recurring work. To perform just
   one queue check, use `node scripts/codex-worker.mjs --once` instead.
8. Pause in the dashboard before shutting down or switching providers. Follow
   [CODEX-WORKFLOW.md](CODEX-WORKFLOW.md) for interrupted-run recovery.

`TRACKER_URL` selects your own tracker origin. `CODEX_BIN` optionally selects the
CLI executable. A compatible private Sites host can use `TRACKER_ACCESS_TOKEN`
in the worker environment; never put credentials in the prompt or Git. A hosted
tracker does not by itself move a local CLI worker to the cloud.

## Instructions for the GPT / LLM installing this project

1. Read `README.md`, `AGENTS.md`, `docs/SECURITY.md` and the provider guide before
   changing files. Inspect the selected environment and existing installation.
2. Determine whether the owner wants local execution or cloud-only execution.
   For cloud-only, follow the Dot guide; do not silently launch a local worker.
3. For a fresh local copy, run the installation commands above. For an existing
   copy, preserve `.private/` and `.wrangler/state/`, install locked dependencies,
   build, migrate pending changes and restart. Never seed a real user's ledger.
4. Have the owner complete sign-in and approvals through supported interfaces.
   Check actual tools rather than asserting that a ChatGPT subscription connects
   browser automation or private API access automatically.
5. Read the resume as evidence. Help choose suitable roles, then have the owner
   select locations, frequency and limits. Save verified application facts.
6. Use exactly one execution path: the included worker, or this capable session
   following [AGENT-PROTOCOL.md](AGENT-PROTOCOL.md). Do not run both concurrently.
7. For a session-driven integration, open **Connect your agent**, select
   **ChatGPT / Codex**, and follow its generated message plus `/api/agent-guide`.
8. Verify a real confirmation before reporting any submission. Respect the saved
   request target, deduplicate, honor pause, and record each result immediately.
9. Report installation, API access, browser access, queue processing and schedule
   creation separately. Do not label untested steps as working.

## Copyable installation request

> Install my private copy of Open Job Tracker from
> https://github.com/dushyantgithub/open-job-tracker. Read README.md, AGENTS.md and
> docs/GPT-WORKFLOW.md. Establish whether my selected environment is local or
> cloud-only, preserve existing private data, and follow the documented setup.
> Help me review my resume, roles, locations, frequency, limits and factual answers.
> Verify the tools before claiming work. Run only authorized queued batches with
> one worker, observe confirmations, and tell me precisely what is blocked.

Official reference: [Codex CLI installation and account setup](https://learn.chatgpt.com/docs/codex/cli).
Your own account's usage and tool permissions apply. No API key is required by this
project when Codex is already signed in using a supported account.

## Choose who clicks Submit

Under **Edit setup → Schedule & limits**, select **Fully automated** or
**Manual review**. In manual review the agent fills fields, uploads documents and
hands off the actual prepared form; you review it and click Submit on the employer
page. New users default to manual review; existing searches keep their mode.
See [submission modes and browser handoff requirements](SUBMISSION-MODES.md).


## Blocked forms and source coverage

Follow the [human takeover and source coverage guide](HUMAN-TAKEOVER.md). Read the latest handoff instructions before working. `request_takeover` stops the batch at a human-only step; wait for the owner and resume through `claim_batch` with the same worker ID. Do not finish or abandon the request while takeover is pending. Respect source diversity as a coverage preference, never as a way to evade ATS screening.
