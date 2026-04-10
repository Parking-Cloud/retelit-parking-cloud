// netlify/functions/utils.js
const { neon } = require('@neondatabase/serverless');

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

module.exports = { getDb, requirePost, parseBody, jsonHeaders, errorResponse, CLIENTE };
