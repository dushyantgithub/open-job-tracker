# Claude instructions

Read AGENTS.md, README.md and docs/CLAUDE-WORKFLOW.md first. Installation and
application steps are in that guide; docs/AGENT-PROTOCOL.md defines queue ownership,
heartbeat, pause, evidence and recovery. TRACKER-API.md is the API reference.

Use Claude's configured tools directly. Do not start the Codex worker or claim
that this repository installs a Claude daemon, scheduler or MCP server. Verify
browser/API/upload access and the owner's execution boundary before claiming a
batch. Preserve private data and use only synthetic inputs for development tests.
