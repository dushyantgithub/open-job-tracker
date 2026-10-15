# Connect the private dashboard through MCP

The project includes an MCP server at `POST /mcp`. It exposes typed operations
for the same database and worker protocol as the dashboard. It contains no
bundled resume, personal facts, application history, credentials or hosting ID.

## Publish and connect on Sites

1. Create your own copy and complete the owner-private hosting steps in
   [DOTS-WORKFLOW.md](DOTS-WORKFLOW.md#publish-a-private-copy-with-sites).
2. Keep `"capabilities": ["mcp"]` in `.openai/hosting.json`. Register a fresh Site
   for a new copy, preserve its returned identity and D1 binding, apply migrations,
   build and publish with the Sites workflow. Never copy the author's Site ID.
3. Verify successful publication and the owner's unchanged private audience.
   Publishing provisions a personal plugin for that specific copy. Republish
   existing copies after adding the capability so Sites refreshes their tool list.
4. In ChatGPT, find your dashboard under **Plugins → Personal → Created by you**,
   then install/connect it. Alternatively, ask Sites for the existing Site with
   `include_mcp_connection: true` and use its returned plugin, not a guessed ID.
5. Refresh the agent's tools. If an installed plugin's tools are missing, refresh
   its connection or begin a new request. Do not create another Site to fix this.
6. Call `get_handoff`, `get_tracker_state`, `list_jobs` and `get_resume`. These calls
   do not claim work. Verify a harmless write using `record_activity`.
7. Independently verify the selected browser and resume-file handling. The resume
   tool returns the original uploaded file, including its MIME type and base64
   resource. An agent needs authorized file tools to save/upload it. Successful
   text extraction alone does not prove that an employer upload will work.
8. Use `record_runner_setup` only after those checks. Choose manual mode or supply
   an actual saved schedule ID, IANA timezone and future next check. The tool
   records the agent's assertion and does not create or independently audit a
   provider schedule. No daily time or personal timezone is hardcoded.
9. Complete resume onboarding and explicitly queue a run. Stop other workers,
   then process it through the tools below. Keep your browser environment within
   the execution boundary you authorized.

## Tool map

| Tool | Purpose |
| --- | --- |
| `get_handoff` | Current saved preferences, applicant facts, extracted resume and protocol |
| `get_tracker_state` | Verified total, queue, run, activity and recorded runner setup |
| `list_jobs` | Paginated ledger; company, ID and canonical posting filters |
| `get_resume` | Original uploaded PDF/MD/TXT as private metadata/base64/resource |
| `claim_batch` | Atomic claim of a queued or due batch with a stable `workerId` |
| `heartbeat` | Ownership and pause check using `workerId` and `requestId` |
| `record_jobs` | Factual results under that exact active owner; DB caps and dedup apply |
| `finish_batch` | Honest completed/blocked outcome under the original owner |
| `pause_search` | Pause dashboard scheduling and request the active worker stop |
| `record_activity` | Harmless connection test or concise progress |
| `record_runner_setup` | Self-reported manual/scheduled setup, without starting work |

There is no arbitrary database, HTTP proxy, provider login or employer-submit tool.
The application browser remains a separately authorized capability. The tools do
not expose a way to queue extra batches during setup.

## LLM execution sequence

1. Read the handoff and [shared protocol](AGENT-PROTOCOL.md); never infer missing
   personal facts. Review the ledger before any employer action.
2. Call `claim_batch` with a persistent private-copy worker ID. Save the returned
   `request.id`, `target`, `baseTotal` and worker ID privately. A null request means
   no work. The claim response omits raw resume bytes and the entire ledger; read
   them explicitly with `get_resume` and paginated `list_jobs`.
3. Call `heartbeat` about every 15 seconds during active work and before final
   submission. Stop submitting if paused or ownership is lost.
4. Check duplicates and the remaining target before each form. Use only saved,
   verified applicant facts and respect browser confirmation requirements.
5. Call `record_jobs` after each factual result with the same `workerId` and
   `requestId`. Applied status needs the job URL, application time and observed
   confirmation. The database enforces deduplication and batch/total caps.
6. Call `finish_batch` completed only after `verifiedTotal` reaches the saved
   target. Otherwise finish blocked and explain the blocker. Do not clear an
   uncertain claim, change identities or automatically resubmit after a crash.
7. Keep external schedules separate from dashboard frequency. Daily/weekly
   eligibility starts after completion; an external runner merely checks for due
   work. Manual mode creates no recurring batch. Pause both systems when stopping.

The public starter uses these claim/heartbeat/finish tools. Private older copies
may expose different tool names; inspect the connected tool schemas rather than
substituting endpoints or copying another deployment's prompts.

## Connection failures

- **“Site does not declare an MCP server”:** update the source manifest, build and
  republish the same private Site. Merely connecting the general Sites plugin
  does not enable your dashboard's application tools.
- **Browser rejects `/api/...`:** use the dashboard's installed MCP plugin. Do not
  bypass the block, publish personal data to GitHub or make the Site public.
- **`/mcp` returns 401:** connect the dashboard plugin using the hosting platform's
  supported authentication. A service token that works on ordinary API routes
  may not be accepted by the MCP gateway. Do not invent an OAuth token or weaken
  the access boundary.
- **Read tools work, but browser/file tools are absent:** the connection is only
  partly ready. Report that missing capability before claiming a batch.
- **No resume or preferences:** finish onboarding in this private copy. The
  repository deliberately contains no applicant data.
- **CLI/another agent already owns a request:** do not reclaim it. Pause and review
  its saved evidence, then finish safely with the original owner before switching.

For non-Sites hosting, configure an authenticated MCP-compatible gateway yourself.
This project does not implement OAuth. A localhost endpoint is accessible only in
its own environment; it is not reachable from a Dot's cloud. Claude users should
follow their authorized API/browser workflow unless their selected environment
has a separately verified MCP connection. Sites' personal-plugin provisioning
must not be assumed to supply Claude-compatible account authentication.
