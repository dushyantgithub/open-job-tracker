# Use a ChatGPT Dot in the cloud

This release includes a private MCP server. Sites can provision a personal
dashboard plugin for each published copy; there is no bundled Dot runner. No personal computer is needed for execution
once a working private cloud deployment and Dot schedule are actually configured.
The full employer-submission workflow has not been tested with a Dot account.

## For the owner

1. Create your own copy of this repository. Do not use the author's private site,
   resume, application history or credentials.
2. Publish it behind owner-only authentication using the hosting steps below.
   A Dot's `localhost` is its own machine, not your laptop. Do not tunnel an
   unprotected local server to solve access problems.
3. Open your hosted copy. Upload your resume, review suggested roles, choose
   locations, frequency and caps, and supply verified **Application facts**.
   **Save and start** queues a batch; it does not connect your Dot.
4. Install/connect this copy’s dashboard plugin under **Plugins → Personal →
   Created by you**. Follow [MCP-INTEGRATION.md](MCP-INTEGRATION.md), then open
   **Connect your agent**, choose **ChatGPT Dot**, and copy the setup message.
5. Send it to your Dot. Require its own cloud computer and browser, with no local
   fallback and no delegation to Codex or Work tasks. This is an instruction to
   the Dot, not a technical restriction imposed on your whole ChatGPT account.
6. Let the Dot verify MCP handoff/queue reads, a harmless activity write, browser tools and resume upload
   capability before claiming the queue. A login may require your intervention
   in its cloud browser. Your local browser's login is not shared automatically.
7. For recurring checks, tell the Dot your timezone and request one cloud-only
   queue check every 15 minutes. Ask it to confirm the saved identifier and next
   run time. Inspect **Scheduled** in the Dot profile. If it cannot save that
   schedule without delegating to Codex/Work, keep the setup manual or blocked.
8. Review the first batch's actual confirmations. **Apply for more** queues the
   next batch within your saved limits. The Dot must not manufacture extra work.

The 15-minute check is a queue poll, not a request for 15-minute application
batches. The dashboard's manual/daily/weekly preference controls batch eligibility.
No recurring batch is created for manual mode. A Dot that checks only every 15
minutes can show offline between checks because the dashboard heartbeat expires
after 90 seconds. That indicator is not a schedule audit.

## Publish a private copy with Sites

Perform this in an environment with the Sites plugin and repository access:

1. Read the installed Sites skill and this repository's `docs/SECURITY.md`.
2. Use this generic source tree, not another person's deployed site. The supplied
   `.openai/hosting.json` has storage bindings but no Site identity.
3. Register a fresh owner-private Site and persist its returned project ID using
   the plugin workflow. Retain the D1 binding and all `drizzle/` migrations.
4. Install locked dependencies, build, and use the Sites source/publishing helper
   to push and publish the exact source. Follow the plugin's current deployment
   instructions; do not guess project IDs or edit access to public.
5. Verify every UI/API route is private. An unauthenticated request must not
   return resume data or permit mutations. Verify the deployed database has the
   onboarding and queue migrations, then complete onboarding in that deployment.
6. Give the Dot the deployed HTTPS URL through **Connect your agent**. Do not
   paste access tokens into its prompt. Use Sites `get_site` with `include_mcp_connection: true` for the existing
   project, then install/connect its returned personal plugin. Read its tool
   schemas. Do not assume a service token accepted by ordinary API routes can
   authenticate the MCP gateway; use the supported plugin connection.

Other hosting is possible, but you must configure D1, migrations and an owner-only
HTTP access boundary yourself. This repository does not provide that gateway.
A browser session and a shell HTTP request do not automatically share credentials.

## Instructions for the Dot / LLM

1. Read MCP `get_handoff` at the owner’s connected dashboard plugin, then
   [AGENT-PROTOCOL.md](AGENT-PROTOCOL.md) and [TRACKER-API.md](../TRACKER-API.md).
2. State whether you can execute entirely inside your Dot cloud environment.
   If you cannot browse, upload resumes and authenticate API calls there, stop
   before claiming work and identify the missing capability.
3. Read setup and the ledger. Never assume the author’s facts or any sample values
   describe this owner. Resolve essential missing facts with the owner.
4. Stop any previous worker/schedule, preserve its checkpoint and resolve uncertain
   submissions before claiming with one stable Dot worker identity.
5. Use MCP `claim_batch`, `heartbeat`, `record_jobs` and `finish_batch` exactly as the
   shared protocol specifies. A queued or due batch is the unit of authorization.
6. Save a schedule only when requested, keep its ID privately, and verify it exists.
   Do not report a copied message or successful API read as a completed integration.
7. On a closed/blocked cloud website, ask for the supported cloud handoff. Never
   fall back to the owner's local computer or create Codex/Work tasks.
8. To stop, pause the dashboard and disable the Dot schedule separately. Confirm
   an active batch has stopped before switching providers.

## Usage and official references

Cloud execution does not mean unlimited or free use. Dots have their own
allowances; delegated Work/Codex tasks use those products' limits. Review your
account before recurring work. Official documentation checked 14 October 2026:

- [Dot computers and sign-in](https://learn.chatgpt.com/docs/dots/computers-and-apps)
- [Dot schedules and context](https://learn.chatgpt.com/docs/dots/tasks-and-memory)
- [Dot access and usage](https://learn.chatgpt.com/docs/dots)

## Choose who clicks Submit

Under **Edit setup → Schedule & limits**, select **Fully automated** or
**Manual review**. In manual review the agent fills fields, uploads documents and
hands off the actual prepared form; you review it and click Submit on the employer
page. New users default to manual review; existing searches keep their mode.
See [submission modes and browser handoff requirements](SUBMISSION-MODES.md).


## Blocked forms and source coverage

Follow the [human takeover and source coverage guide](HUMAN-TAKEOVER.md). Read the latest handoff instructions before working. `request_takeover` stops the batch at a human-only step; wait for the owner and resume through `claim_batch` with the same worker ID. Do not finish or abandon the request while takeover is pending. Respect source diversity as a coverage preference, never as a way to evade ATS screening.
