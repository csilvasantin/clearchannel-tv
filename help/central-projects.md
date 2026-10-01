# API común de proyectos y locales / Common project and venue API

AdmiraNext owns identity, users, commercial project ACLs and explicit venue/twin associations in AUTH_DB D1. It imports the 20 canonical backoffice project/circuit IDs once, without overwriting later admin edits. Commercial ACLs (`commercial:starbucks`, root `commercial-projects`) are separate from software-project permissions. Only the previously verified Starbucks venue alsea-sbux-021 is seeded as a real association. Xtanco and Cafebrería are public demos.

AdmiraNext centraliza identidad, usuarios, permisos de proyectos comerciales y asociaciones explícitas local/gemelo en AUTH_DB D1. Migra una sola vez los 20 IDs del backoffice, sin sobrescribir ediciones posteriores. Los permisos commercial:ID están separados de proyectos de software. Sólo se migra como local real Starbucks alsea-sbux-021. Xtanco y Cafebrería siguen como demos.

- GET /api/xpace/demos: public, only three sample scenes; no customer directory.
- GET /api/xpace/context: current central cookie or limited bearer, returns {ok,source,user:{display_name},projects:[{id,name,circuit}],venues:[{id,project_id,name,xpace_url}]}. No full user directory. Every request rechecks status, account expiry, session_version, project ACL. Third parties also require the contracted xpaceos app.
- GET /api/xpace/registry: central admin cookie; projects, all venues including disabled and dedicated audit.
- POST /api/xpace/registry: same-origin admin cookie + X-Admira-CSRF; kind project with {id,name,circuit}, or kind venue with {id,project_id,name,xpace_url,enabled:boolean}. Stable IDs cannot move between projects; existing circuits cannot change. Valid HTTPS renderer URLs only. Disabled venues disappear from context. Audit persists independently in admiranext_xpace_audit.
- /xpace/manage: central management UI. /usuarios: grant commercial:ID or parent commercial-projects; guest/partner must select XpaceOS app, explicit commercial project and expiry.
- POST /api/xpace/link: allowlisted client Origin; begin {action:'begin',state:64hex,challenge:SHA256(verifier)}; claim {action:'claim',state,verifier:64hex}. 202 while login pending; single-use claim after authorization; expires after 5 min. Random verifier kept in client memory, never URL. Browser redirects can lose opener without breaking completion.
- GET /xpace/connect?origin=<allowlisted origin>&state=<64hex>: central popup reads its own existing cookie; Google login uses the existing challenge-bound /webmaster callback and a validated local return. Never changes cookie security.
- POST /api/xpace/connect: central cookie + Origin + CSRF; {origin,state} authorizes the pending exchange. Without state, issues a direct short-lived read token to same-origin authenticated callers.
- DELETE /api/xpace/connect: revoke only the presented origin-bound read token.

CORS origins: HTTPS www/non-www admira.store, xpaceos.com and admira.app. No wildcard credentials; scoped opaque tokens are stored hashed server-side, expire after 10 min, are sent only in Authorization, and cannot authorize registry/users/MCP writes. Client retains read access in this tab's sessionStorage, never URL or localStorage. Suspend/revoke/change ACL using the existing user directory. Reconnect after expiry; no silent downgrade to demos.

ES: En Opciones conecta con AdmiraNext, escoge tu proyecto y uno de sus locales. Si no hay local asociado, el administrador debe registrarlo; no se deduce por marca. Demos públicas es una opción separada. El backoffice consulta el mismo contexto y enlaza la gestión central. El editor del catálogo/mapa heredado conserva su login y publicación existentes; no se migran aquí pedidos, listas blancas, MCP ni controles físicos.

EN: In Options connect with AdmiraNext, choose your project and one of its venues. An admin must register missing associations; they are never inferred by brand. Public demos are separate. The backoffice reads the same context and links central management. Legacy map/catalog editing keeps its existing login and publication; orders, whitelists, MCP and physical controls are not migrated here.

Public simulator assets remain public. This API restricts registry/context data and does not transform previously published rendering assets into private resources. Quality/language/browser layout remain local. Routes use canonical project/circuit IDs and explicit venue URLs; the extra venue query parameter identifies the selected registry entry; loc remains the renderer location ID.

Clients: https://www.admira.store/admira-xp/ · https://www.xpaceos.com/admira-xp/ · https://www.admira.app/backoffice.html
