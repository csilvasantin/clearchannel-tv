# Admira.biz native player documentation overlay

This Worker owns only the exact documentation routes listed in wrangler.toml,
on admira.biz and www.admira.biz. It does not deploy or edit yokup-site-gate,
Yokup, ClearChannel, Pixeria, XpaceOS, or native physical applications.

GET/HEAD serves the versioned public guide, discovery manifest, existing MCP hub
with its player documentation section, and public measurement evidence.
RPC/SSE traffic arriving at /mcp/ is forwarded unchanged through the GATE service
binding. Authorization, cookies, body and original URL remain server-owned.
No MCP execution tool or anonymous write capability is added.

The original /mcp endpoint without trailing slash remains directly assigned to
yokup-site-gate. All unrelated /mcp/* paths retain their existing gate route.

Deploy this directory only after cross-review, tests and public asset checks:
`npx wrangler@4.119.0 deploy --config tools/biz-player-mcp/wrangler.toml`
Use a concrete signed RELEASE value before deploying; assets/ contains the
reviewed public snapshot. Verify both hostnames, documentation links, the
existing RPC authentication response, and the frozen domains afterwards.

Rollback: remove only the twelve admira-biz-player-docs route entries from the
admira.biz zone. The pre-existing wider yokup-site-gate /mcp/* routes then serve
these paths again. Keep the source/asset snapshot and the deployment ID for
recovery. Never deploy the shared Yokup gate as part of this documentation task.
