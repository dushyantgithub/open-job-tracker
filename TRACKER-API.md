# Private-copy API

Every endpoint requires the deployment's owner-only authentication boundary.
Local development is loopback-only. The app's same-origin, Fetch Metadata, and
content-type checks are **not authentication**. This is a single-owner database;
there is no multi-tenant or public API mode. See [docs/SECURITY.md](docs/SECURITY.md).

Use JSON for mutations except the multipart resume upload. GET responses and
private data are not cacheable. Retain stable job IDs and verify actual receipts.
Do not import untrusted records blindly or write credentials to job notes.

## Onboarding

- `GET /api/onboarding` returns `configured`, resume metadata, local keyword
  analysis, saved preferences, worker status/lastSeenAt, schedule, and run state.
  It omits resume bytes and full text.
- `POST /api/onboarding/resume` accepts multipart field `resume`, a PDF/MD/TXT
  file no larger than 1 MiB. It stores the original and extracted text privately
  and returns the updated setup object with suggested roles and supporting evidence.
- `POST /api/onboarding` saves preferences. Complete resume setup first. Active
  requests must be paused and fully stopped before replacing preferences.
- `POST /api/onboarding/start` queues the initial batch within saved limits and
  enables the saved schedule. It reports `awaiting_worker`, not a submission.

Preferences:

```json
{
  "selectedRoles": ["Software Engineer"],
  "searchPortals": ["Company careers", "LinkedIn", "Naukri", "Instahyre", "Wellfound", "Cutshort", "Indeed"],
  "locations": ["US"],
  "indiaCities": [],
  "frequency": "manual",
  "batchLimit": 5,
  "totalLimit": 20,
  "salaryRules": {"US": {"minimum": null, "currency": "USD", "basis": "base"}},
  "applyWithoutSalary": true,
  "applicantFacts": ""
}
```

This is only a schema example, not a seeded profile. Locations accept EU/US/IN/AU/CA.
`searchPortals` accepts the labels in `lib/job-sources.ts`, requires at least one
selection when supplied, and preserves saved selections if omitted by an older
client. New copies default to the original company/YC/ATS sources; the owner can
add the general job portals in setup.

India requires one or more of Bengaluru/Pune/Mumbai; the UI labels Bengaluru as
Bangalore / Bengaluru. Frequency accepts manual/daily/weekly. Batch limits are
1-100; total limits are 1-1,000 and must cover the batch size and existing verified
submissions. No citizenship, language, salary, or work-authorization facts are
implied by these settings. Optional `applicantFacts` is a plain-text field up to
8,000 characters. It is passed to the worker with the search plan; keep it factual
and do not assume the worker can access unrelated chat history.

`salaryRules` maps EU/US/IN/AU/CA to `{minimum, currency, basis}`. Amounts are
annual currency units, not lakh units: the UI converts INR lakh to rupees. A null
minimum means no numerical floor. Supported currencies are EUR/USD/INR/AUD/CAD;
basis is `base` or `total` (annual total compensation/CTC). Structured salary
rules override older salary text in applicantFacts. `applyWithoutSalary` is a
boolean, default true for compatibility; false tells the agent to skip listings
without salary figures. Listed ranges wholly below the minimum remain excluded.
Unclear currencies/bases require review, not guessed comparisons. Omitting these
fields when an older client saves preferences preserves existing saved settings.
Salary instructions are returned in MCP handoff and worker claims. They guide the
external agent; the tracker does not independently read employer salary pages.

## Ledger and queue

- `GET /api/data`: jobs, activity, requests, run, verifiedTotal, serverTime. The UI
  polls every five seconds. Verified submissions include later rejected/withdrawn
  records that retain their original confirmation.
- `POST /api/jobs`: one job, an array, or `{ "jobs": [...] }`, up to 200 records.
  New jobs need stable `id`, company and title. Updates merge existing fields.
  Confirmed submissions need `appliedAt` and `confirmation`. The server checks
  duplicate posting identities and preserves existing confirmation evidence.
- `POST /api/activity`: `{ "message": "...", "type": "info", "jobId": "..." }`.
- `POST /api/run`: merges run display state. Follow the queue/worker protocol for
  execution; a display status alone does not submit an application.
- `POST /api/more`: queues a batch within saved per-run and total limits. Existing
  active work is returned without creating another concurrent request.
- `GET /api/requests`: queue history, newest first.
- `POST /api/requests`: legacy request updates; prefer the worker protocol so run
  ownership, completion checks, and scheduling stay consistent.

Discovery fields: `discoverySource` is the first observed source label (up to 100
characters), `discoveryUrl` is its HTTP(S) listing/search URL without embedded
credentials, and `discoveredAt` is the observed ISO date/time. Existing first
discovery values cannot be replaced by following an application link. Missing
history may be backfilled only from evidence, never inferred from `portal` or
`jobUrl`. Discovery fields are optional for historical/partial records and never
block saving a genuine receipt just because the original source is unknown.

Job fields are defined in `lib/tracker.ts`. Core fields include posting/company
URLs, title, location, region, portal, status, resume version, salary information,
sponsorship evidence, notes, reason, timestamps and confirmation evidence. `region`
accepts EU/US/IN/AU/CA/Other. Visa support accepts confirmed/not stated/unavailable.
Allowed job statuses are discovered, shortlisted, preparing, applied, blocked,
skipped, rejected, withdrawn. `skipped` means excluded during eligibility review;
`rejected` means a rejection received from an employer.

## Worker protocol

`POST /api/worker` accepts one action at a time:

- `pause`: immediately disables scheduling, sets the run to `paused`, cancels
  queued work, and asks a claimed worker to stop. Its response includes `run`,
  `acknowledgementPending` and the settling `request`. A claimed request retains
  `pausing` until the worker acknowledges; this does not delay the visible pause.
  Existing checkpoint notes and submission proof are preserved.
- `confirm_stopped` with `requestId`: owner-only recovery after the owner has
  stopped the external agent and reviewed recent submissions. Requires scheduling
  paused and that exact current request in `pausing`; releases it as cancelled
  without changing its saved target, baseline or ledger. Never infer this action
  from a stale heartbeat. This does not stop an external browser or schedule.
- `tick` with `workerId`: records a heartbeat and atomically claims an eligible
  queued batch. A claimed response includes the request, preferences, private
  resume, source-search instructions and ledger. A null request means no work is available.
- `heartbeat` with `workerId` and `requestId`: reports whether the worker should
  pause. Only the worker owning the request should execute it.
- `finish` with `workerId`, `requestId`, `status` (completed/blocked), and `message`:
  records the outcome. Completion requires the target number of verified
  submissions. Recurring schedules continue only after a completed batch.

Use one worker: the included Codex worker or an agent following the shared protocol. A second
worker must not reclaim an uncertain submission automatically. Pause, review
proofs, recover saved progress, then resume deliberately. Application caps are
checked against verified history, not just the current Applied tab.

The HTTP API also has an MCP tool facade at `POST /mcp`. It does not implement OAuth or
provide access to a user's connected ChatGPT apps. A compatible private hosting
access token may be supplied to the included worker as documented in the README;
those tokens are infrastructure access credentials, not applicant data.

## Agent handoff

`GET /api/agent-guide` returns the provider-neutral worker protocol without resume
bytes, personal facts or ledger data. It is read-only and does not claim work.
`/connect` generates origin-specific MCP-first setup messages for Dots, ChatGPT/Codex and
Claude. It does not install an integration or verify that a schedule exists.
See [docs/AGENT-PROTOCOL.md](docs/AGENT-PROTOCOL.md).

## MCP tools

The manifest declares the `mcp` capability. `POST /mcp` implements stateless
JSON-RPC discovery and tools for protocol 2026-07-28. Protect this endpoint with
the same owner-private boundary as every other route. Sites provisions a separate
personal plugin for each published copy. See [MCP integration](docs/MCP-INTEGRATION.md).

Read: `get_handoff`, `get_tracker_state`, `list_jobs`, `get_resume`.
Write: `claim_batch`, `heartbeat`, `record_jobs`, `finish_batch`, `pause_search`,
`record_activity`, `record_runner_setup`. Claims, heartbeats and finishes reuse
`/api/worker`; job writes additionally require its exact workerId/requestId owner.
Confirmed records retain database deduplication and cap checks.

MCP claim responses omit raw resume/ledger payloads; use get_resume and list_jobs.
get_handoff reads only the current private database, including supplied applicant
facts. No personal data is compiled into source. record_runner_setup stores a
self-reported connection and optional schedule, never a created/verified schedule.
The existing CLI worker and HTTP API continue to work without MCP.
