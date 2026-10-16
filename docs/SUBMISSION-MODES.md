# Application submission modes

Choose **Edit setup → Schedule & limits → How applications are submitted**.
**Save changes** updates preferences without starting a batch. New copies default
to **Manual review**. Existing copies without this setting retain **Fully automated**.
An active batch must finish or pause and release its checkpoint before changing modes.
Application frequency (manual/daily/weekly) is separate from submission mode.

## Fully automated

The agent checks fit, supplied facts, salary, sponsorship, duplicates and the
employer's stated application rules before filling and submitting. It records
policy sources or uncertainty and actual receipts. It honors published limits and
Retry-After, stops a site's work on blocks, verification challenges or repeated
errors, and investigates uncertain submissions before retrying. There is no
undetectable mode, proxy rotation, fingerprint masking or fabricated human activity.
An explicit manual-only restriction becomes a blocker rather than an automated submission.

These browser precautions are instructions to the external agent. The tracker
cannot intercept arbitrary actions inside Dot, Claude or Codex's browser. It does
not independently certify an employer's policy, ATS classification or browser IP
reputation. Confirmed submission means a receipt was recorded, not that a recruiter
read the application or fraud screening accepted it.

## Manual review: fill, upload, hand off

1. The agent verifies a handoff **before** preparing the application. Supported
   options are the same browser tab the owner can control, an employer-persisted
   draft, or a provider-supported cloud browser takeover.
2. It fills required fields and uploads the approved resume and other requested
   documents, verifying visible filenames. Missing facts, mandatory legal consent
   or verification that it cannot complete are blockers, not completed drafts.
3. It records **Ready for review**, a concise preparation summary, filenames,
   private handoff instructions and a review deadline. Preserve the original tab
   using the browser provider's supported handoff controls. Do not let temporary
   browser cleanup close it. A screenshot or posting link does not preserve forms.
4. It finishes the batch as `awaiting_review`. No new batch starts while the owner
   reviews the reserved drafts. A partial preparation batch may be handed off when
   the environment cannot preserve all forms. Prepared drafts never count as sent.
5. The owner opens **Ready for review**, selects a role, and follows the handoff.
   Review all answers and attachments on the employer page. The owner clicks that
   page's **Submit** button. Opening the dashboard link does not submit anything.
6. After receiving confirmation, enter its message/reference and actual submission
   time, check the owner attestation and select **Record my submission**. This is
   an owner-recorded receipt, not independent employer verification. Alternatively,
   **Discard prepared application** releases the draft without counting a submission.
7. The request completes only when its verified target is reached. If all prepared
   drafts are resolved below target, it stops for attention and does not silently
   launch more applications. Expired forms must be rechecked or discarded. Receipts
   for already-submitted applications can still be recorded after the review deadline.

### Dot cloud limitation

An open form in a cloud browser is not automatically accessible on the owner's
computer. The dashboard cannot export cookies, upload inputs or live DOM state
into another browser. Verify an actual provider-supported takeover or an employer
saved draft. If none exists, report the missing handoff and do not label the role
Ready for review. The integration must not silently control the owner's computer.
Local Codex/Claude users likewise need an authorized browser session the owner can
actually reopen. This release implements the handoff protocol and UI, not a new
remote-browser product or a guarantee that every provider exposes takeover.

## Data and safeguards

Review metadata contains filenames, a non-sensitive summary and navigation
instructions. Never include access tokens, government identifiers, sensitive
answers or full files. Handoff links must be HTTPS without credentials, query
parameters or fragments; use the authenticated provider landing page and written
navigation instructions when a token-bearing URL would otherwise be needed.

The API validates readiness metadata, reserves draft capacity, prevents prepared
posting duplicates, blocks worker-recorded submissions in manual mode and holds
recurrence during review. `/api/review` is an owner UI action, not an MCP tool.
The app is single-owner: an agent deliberately reusing the owner's full HTTP
credentials is not a separate security principal. Its protocol prohibits calling
that endpoint; the UI attestation is not cryptographic proof of a human action.

When pausing during review, resolve ready drafts before confirming the worker is
stopped. This preserves late receipts and prevents orphaned review reservations.

## Why these precautions exist

Greenhouse documents device/contact fraud-risk signals and separate employer
blocklists. Ashby documents device, IP, email and phone checks. Neither source
establishes a universal safe application rate or guarantees cloud/local automation
will escape flags. The project makes no such promise.

- [Greenhouse fraud and blocklist FAQ](https://support.greenhouse.io/hc/en-us/articles/45397232315035-Fraud-Detection-and-Spam-Blocklist-Security-Privacy-FAQ)
- [Ashby candidate fraud detection](https://docs.ashbyhq.com/candidate-fraud-detection-overview-and-admin-settings)
