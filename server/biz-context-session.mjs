import { sessionFromClaims } from './demo-session.mjs';

const reply = (data, status = 200) => Response.json(data, {status, headers:{
  'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff', 'Vary':'Authorization'
}});
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

// Identity only. /ctx and each scoped read recheck the canonical server whitelist.
// No email, project or role from the browser is used to grant access.
export async function handleContextSession(request, env, fetcher = fetch, now = Date.now()) {
  if (request.method !== 'POST') return reply({error:'method-not-allowed'},405);
  const url = new URL(request.url), origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply({error:'origin-not-allowed'},403);
  const credential = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') || '')?.[1];
  if (!credential || credential.length > 8192) return reply({error:'session-required'},401);
  if (!env.PIXERIA_SIGNING_KEY) return reply({error:'context-session-unavailable'},503);
  let session;
  try {
    const verified = await fetcher('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), {signal:AbortSignal.timeout(8000)});
    if (!verified.ok) return reply({error:'invalid-session'},401);
    session = sessionFromClaims(await verified.json(), now);
  } catch { return reply({error:'verification-unavailable'},503); }
  if (!session) return reply({error:'invalid-session'},401);
  const iat = Math.floor(now / 1000), exp = Math.min(iat + 300, Math.floor(session.expiresAt / 1000));
  const payload = encode(new TextEncoder().encode(JSON.stringify({v:1,aud:'api.admira.store',email:session.email,iat,exp})));
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(env.PIXERIA_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature = encode(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('api:' + payload)));
  return reply({ok:true,token:payload + '.' + signature,exp});
}
