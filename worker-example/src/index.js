// Exemple minimal de recepteur pour Valheim Server Monitor.
// Recoit {token, online} en POST, compare a l'etat precedent stocke en KV,
// et envoie une alerte Discord uniquement lors d'un vrai changement d'etat.
//
// Secrets a definir (wrangler secret put) :
//   STATUS_TOKEN         jeton partage avec check-server.js (SERVER_STATUS_TOKEN cote GitHub)
//   DISCORD_WEBHOOK_URL  URL du webhook Discord a notifier

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function notifyDiscord(env, online) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  const payload = {
    embeds: [{
      title: online ? 'Serveur en ligne' : 'Serveur hors ligne',
      color: online ? 0x2dd4a7 : 0xf47272
    }]
  };
  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      const raw = await env.STATUS_KV.get('status');
      return new Response(raw || JSON.stringify({ online: null, lastChecked: 0 }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), { status: 400 });
    }

    if (!env.STATUS_TOKEN || !timingSafeEqual(String(body.token || ''), env.STATUS_TOKEN)) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
    }

    const online = !!body.online;
    const raw = await env.STATUS_KV.get('status');
    const prev = raw ? JSON.parse(raw) : { online: null, lastChecked: 0 };
    const changed = prev.online !== online;

    if (changed) ctx.waitUntil(notifyDiscord(env, online));
    await env.STATUS_KV.put('status', JSON.stringify({ online, lastChecked: Date.now() }));

    return new Response(JSON.stringify({ ok: true, online, changed }), {
      headers: { 'content-type': 'application/json' }
    });
  }
};
