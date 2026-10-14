# Deployment and private data

This is a single-owner application. It has no built-in login and does not isolate
multiple users within a database. A source-code license grants permission to use
the code, not access to any person's private job search.

## Required boundary

Run locally on `127.0.0.1` or `localhost`, or place the entire app behind an
owner-only authentication service. Protect HTML pages, uploads, all `/api/*`
routes, worker endpoints, logs, and database access. Configure that boundary
before adding a resume or exposing a network URL. Same-origin, Origin, Fetch
Metadata, content-type checks, and unguessable URLs are not authentication.

If using a hosting platform's identity headers, trust them only when that
platform strips spoofed incoming headers and enforces the owner's access policy.
This starter does not independently verify such headers. The app does not
implement Sign in with ChatGPT, OAuth, or an MCP authentication flow.

## Data stored

The uploaded resume, extracted text, metadata, setup preferences and schedule are
stored in this private copy's D1 database. The dashboard data endpoint does not
return resume contents, but the worker needs access through protected worker APIs.
The ledger contains application facts and confirmation notes. Local worker runs
also save original resume data, text, plans, logs and proofs under `.private/runs/`.

Back up `.wrangler/state/` and `.private/` only to storage you control. Do not add
them, credentials, a real hosting identity, or `.env` files to a public release.
The source archive is built from an allowlist that excludes all runtime data.

## Credentials and worker authority

Use your own Codex login. Do not share login tokens or browser profiles between
people. Optional hosting access credentials belong in a process environment or a
suitable secret store, never the browser bundle, repository, prompt, or logs.

The worker operates on the owner's behalf. Review the preferences and explicit
application authorization before starting it. Do not bypass its normal browser,
filesystem, login, or approval controls. Stop at required facts the owner has not
provided, sensitive or binding actions needing confirmation, and human-only
challenges. Inspect uncertain submissions before retrying to prevent duplicates.

## Reporting issues

For a private copy, report issues to its maintainer through a private channel.
Include a minimal reproduction with fake applicant data. Do not post a resume,
access token, full database, private run logs, or sensitive screenshots publicly.
