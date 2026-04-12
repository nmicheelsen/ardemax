const https = require('https');
const crypto = require('crypto');
const url = require('url');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SHEETS_URL = process.env.SHEETS_URL;

function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  return Buffer.from(padded, 'base64');
}

function bufferToBase64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createVapidToken(endpoint, privateKeyBase64, publicKeyBase64, email) {
  const parsedUrl = new url.URL(endpoint);
  const audience = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const now = Math.floor(Date.now() / 1000);
  const header = bufferToBase64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bufferToBase64url(Buffer.from(JSON.stringify({ aud: audience, exp: now + 3600, sub: `mailto:${email}` })));
  const signingInput = `${header}.${payload}`;
  const privateKeyDer = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420', 'hex'),
      base64urlToBuffer(privateKeyBase64)
    ]),
    format: 'der', type: 'pkcs8'
  });
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKeyDer, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${bufferToBase64url(signature)}`;
}

async function sendPush(subscription, payload) {
  const subData = JSON.parse(subscription);
  const endpoint = subData.endpoint;
  const parsedUrl = new url.URL(endpoint);
  const token = await createVapidToken(endpoint, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, 'admin@ardemax.cl');
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
        'TTL': '86400'
      }
    };
    const req = https.request(options, res => resolve({ status: res.statusCode }));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { id, descripcion, area, supervisores, disciplina } = JSON.parse(event.body);

    // Get subscriptions for assigned supervisors
    const res = await fetch(`${SHEETS_URL}?accion=leer_suscripciones_supervisores&supervisores=${encodeURIComponent(supervisores)}`);
    const data = await res.json();
    const suscripciones = data.suscripciones || [];

    const payload = {
      title: `Nueva tarea asignada`,
      body: `${descripcion} — ${area}`,
      icon: '/icon-192.png'
    };

    const resultados = await Promise.allSettled(
      suscripciones.map(s => sendPush(s.subscription, payload))
    );

    const enviadas = resultados.filter(r => r.status === 'fulfilled').length;
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, enviadas }) };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
