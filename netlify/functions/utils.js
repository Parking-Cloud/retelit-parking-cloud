// netlify/functions/utils.js
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const CLIENTE = process.env.PARKING_CLIENTE || 'retelit';

function getDb() {
  return neon(process.env.DATABASE_URL);
}

function requirePost(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  return null;
}

function parseBody(event) {
  if (!event.body) throw Object.assign(new Error('Body mancante'), { statusCode: 400 });
  try {
    return JSON.parse(event.body);
  } catch {
    throw Object.assign(new Error('JSON non valido'), { statusCode: 400 });
  }
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

function errorResponse(err) {
  const status = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Errore interno del server';
  return { statusCode: status, headers: jsonHeaders(), body: JSON.stringify({ error: message }) };
}

/* ── JWT (HMAC-SHA256, no external deps) ── */
const JWT_EXPIRY = { user: 4 * 60 * 60, admin: 8 * 60 * 60 }; // seconds

function signJwt(payload, type = 'admin') {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET non configurato');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY[type],
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET non configurato');
  if (!token) throw Object.assign(new Error('Token mancante'), { statusCode: 401 });
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Token non valido'), { statusCode: 401 });
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const bA = Buffer.from(sig), bB = Buffer.from(expected);
  if (bA.length !== bB.length || !crypto.timingSafeEqual(bA, bB))
    throw Object.assign(new Error('Token non valido'), { statusCode: 401 });
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { throw Object.assign(new Error('Token non valido'), { statusCode: 401 }); }
  if (payload.exp < Math.floor(Date.now() / 1000))
    throw Object.assign(new Error('Sessione scaduta — effettua nuovamente il login'), { statusCode: 401 });
  return payload;
}

// Verifica il token e controlla il ruolo. Lancia errore se non autorizzato.
function requireRole(event, ...roles) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer '))
    throw Object.assign(new Error('Autenticazione richiesta'), { statusCode: 401 });
  const payload = verifyJwt(auth.slice(7));
  if (roles.length && !roles.includes(payload.ruolo))
    throw Object.assign(new Error('Accesso non autorizzato'), { statusCode: 403 });
  return payload;
}

module.exports = { getDb, requirePost, parseBody, jsonHeaders, errorResponse, signJwt, verifyJwt, requireRole, CLIENTE };
