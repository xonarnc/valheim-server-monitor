#!/usr/bin/env node
const dgram = require('dgram');

const HOST = process.env.SERVER_HOST;
const PORT = Number(process.env.SERVER_PORT || 27015);
// 10s : le protocole demande parfois 2 allers-retours (challenge anti-spoof
// puis vraie reponse info), un delai trop court coupe la seconde etape avant
// qu'elle n'arrive et fait passer un serveur bien en ligne pour hors ligne.
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000);
const WORKER_URL = process.env.WORKER_URL;
const STATUS_TOKEN = process.env.SERVER_STATUS_TOKEN;

function a2sInfoQuery(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;

    function finish(online) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(online);
    }

    const timer = setTimeout(() => finish(false), timeoutMs);

    function buildQuery(challenge) {
      const base = Buffer.concat([
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54]),
        Buffer.from('Source Engine Query\0', 'ascii')
      ]);
      return challenge ? Buffer.concat([base, challenge]) : base;
    }

    socket.on('error', () => finish(false));

    socket.on('message', (msg) => {
      if (msg.length < 5) return;
      const type = msg[4];
      if (type === 0x49) {
        finish(true);
      } else if (type === 0x41 && msg.length >= 9) {
        // Reponse "challenge" anti-spoof : on renvoie la requete avec le
        // challenge fourni, comme l'exige le protocole Source Engine Query.
        const challenge = msg.subarray(5, 9);
        socket.send(buildQuery(challenge), port, host);
      }
    });

    socket.send(buildQuery(null), port, host, (err) => {
      if (err) finish(false);
    });
  });
}

(async () => {
  if (!HOST || !WORKER_URL || !STATUS_TOKEN) {
    console.error('Variables manquantes : SERVER_HOST, WORKER_URL et SERVER_STATUS_TOKEN sont requis.');
    process.exit(1);
  }

  const online = await a2sInfoQuery(HOST, PORT, TIMEOUT_MS);
  console.log(`Serveur ${HOST}:${PORT} -> ${online ? 'EN LIGNE' : 'HORS LIGNE'}`);

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: STATUS_TOKEN, online })
  });

  const text = await res.text();
  if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
    console.error(`Reponse inattendue du Worker (statut ${res.status}, content-type "${res.headers.get('content-type')}") :`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  console.log('Rapport envoye :', JSON.parse(text));
})();
