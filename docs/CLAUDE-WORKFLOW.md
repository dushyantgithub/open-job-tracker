# Install and use with Claude

Claude uses the same private queue API. This release provides a guided Claude
Code workflow plus an MCP server, not a Claude daemon or automatic Claude login.
The [MCP guide](MCP-INTEGRATION.md) explains its tool mapping and authentication
limits. Sites’ personal-plugin authentication is not assumed to work in Claude.
The end-to-end employer workflow has not been tested with a Claude account.
Do not rename or start `scripts/codex-worker.mjs` to run Claude: it invokes Codex.

## Owner setup, step by step

1. Install Git, Node.js 22.13+ and npm, then create your private copy:

   ```sh
   git clone https://github.com/dushyantgithub/open-job-tracker.git
   cd open-job-tracker
   npm ci
   npm run build
   npm run db:migrate
   npm start -- --port 8787
   ```

2. Open `http://127.0.0.1:8787`. Upload your resume, review roles, choose locations,
   frequency and caps, and provide verified **Application facts**. Save and start
   queues a run. Keep the server terminal open.
3. Install Claude Code from the [official quickstart](https://code.claude.com/docs/en/quickstart).
   Check `claude --version`, run `claude`, and complete its supported sign-in flow.
4. For a supported local browser setup, install the official Claude in Chrome
   extension and sign in with an eligible direct Anthropic account. In another
   terminal in this repository, start:

   ```sh
   claude --chrome
   ```

   Run `/chrome` inside the session to inspect the actual browser connection.
   Follow the [official browser prerequisites](https://code.claude.com/docs/en/chrome),
   including account eligibility and platform restrictions. API-key-only or
   third-party-provider sign-in does not enable this Chrome integration.
5. Open **Connect your agent**, choose **Claude**, and send its generated message
   to that Claude Code session. `CLAUDE.md` also points it to the shared protocol.
6. Ask Claude to verify the dashboard API, browser and file upload capabilities
   before it claims the queued run. Approve only the access needed for your search.
7. Let this one session process the authorized batch using `tick`, heartbeats,
   ledger updates and `finish`. Inspect confirmations and blockers in the dashboard.
8. For another batch, use **Apply for more** within your caps and ask the same
   configured session to check again. No Claude scheduler is installed here.

A plain Claude chat without browser automation and authenticated HTTP tools can
help with setup and answers, but cannot execute this workflow. Do not interpret a
pasted URL or prompt as a working connection.

## Keep your personal computer untouched

The Chrome integration above controls the machine where that browser runs. It
is not equivalent to a Dot cloud browser. To isolate execution, provision a
separate machine or supported remote environment with its own authorized browser,
Claude session, private tracker access and secure resume storage. Verify those
capabilities there before claiming any work. Merely hosting the dashboard remotely
or using Claude Code on the web does not prove employer browser/upload support.
If you cannot provide an isolated environment, keep Claude execution manual and
local or use the Dot route. Do not promise cloud-only operation without testing it.

## Instructions for the Claude / LLM installing and running this project

1. Read `CLAUDE.md`, `README.md`, `docs/SECURITY.md`, this guide and
   [AGENT-PROTOCOL.md](AGENT-PROTOCOL.md).
2. Check the owner's execution boundary. Never start Codex, copy another person's
   facts, or use the owner's personal browser when cloud-only was requested.
3. Install the project using the commands above, or update an existing copy while
   preserving its database and private checkpoints. Do not publish a local server.
4. Ask the owner to complete any account, browser or permission setup. Verify tools
   and authenticated GET access to `/api/onboarding` and `/api/data`. Keep API
   credentials in memory or the supported secure environment, never in chat/Git.
5. Review resume evidence and saved preferences. Missing personal facts are unknown,
   not values to infer. Follow the saved limits and the exact queued scope.
6. Choose a stable worker ID, such as `claude-owner-01`, and follow the shared API
   protocol. `tick` claims work and is not a harmless test. Save its response and
   decoded resume privately. Maintain heartbeats during active applications.
7. Before each final submit, check ownership/pause, remaining cap and the ledger.
   Record actual confirmation immediately. On an uncertain response, investigate
   before retrying. Never create successful evidence from a Submit click alone.
8. Use `finish completed` only when verifiedTotal reaches the saved target.
   Otherwise `finish blocked` with an honest reason. Preserve recovery evidence.
9. For recurring execution, the owner must separately authorize and configure a
   persistent runner or scheduler with supported browser tools. This guide does
   not install one. Normal account limits and approvals still apply.

## Copyable installation request

> Install my private copy of https://github.com/dushyantgithub/open-job-tracker.
> Read CLAUDE.md and docs/CLAUDE-WORKFLOW.md. Use Claude, not the included Codex
> worker. Confirm where execution happens and respect my local/cloud boundary.
> Help me complete resume, roles, locations, frequency, limits and application
> facts. Check actual API, browser and upload access before claiming a batch.
> Follow docs/AGENT-PROTOCOL.md, maintain one request owner, and save only observed
> submission confirmations. Stop for required user action or uncertain results.

Provider documentation checked 14 October 2026. Installation, eligible accounts
and browser features may change; the linked official documentation takes priority.

## Choose who clicks Submit

Under **Edit setup → Schedule & limits**, select **Fully automated** or
**Manual review**. In manual review the agent fills fields, uploads documents and
hands off the actual prepared form; you review it and click Submit on the employer
page. New users default to manual review; existing searches keep their mode.
See [submission modes and browser handoff requirements](SUBMISSION-MODES.md).


## Blocked forms and source coverage

Follow the [human takeover and source coverage guide](HUMAN-TAKEOVER.md). Read the latest handoff instructions before working. `request_takeover` stops the batch at a human-only step; wait for the owner and resume through `claim_batch` with the same worker ID. Do not finish or abandon the request while takeover is pending. Respect source diversity as a coverage preference, never as a way to evade ATS screening.
