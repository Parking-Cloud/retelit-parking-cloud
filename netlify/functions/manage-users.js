// netlify/functions/manage-users.js
// GET    → lista tutti gli utenti
// POST   → { action: 'add', email, nome, cognome, targa }
// DELETE → { email }

const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const sql = neon(process.env.DATABASE_URL);
  try {

    // ── Lista utenti ──
    if (event.httpMethod === 'GET') {
      const users = await sql`SELECT id, email, nome, cognome, targa, registrato, parked, created_at FROM users ORDER BY created_at`;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users }) };
    }

    // ── Aggiungi utente ──
    if (event.httpMethod === 'POST') {
      const { email, nome = '', cognome = '', targa = '' } = JSON.parse(event.body);
      if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email obbligatoria' }) };
      const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
      if (existing.length) return { statusCode: 409, body: JSON.stringify({ error: 'Email già in whitelist' }) };
      const registrato = !!(nome && targa);
      const [user] = await sql`
        INSERT INTO users (email, nome, cognome, targa, registrato, parked)
        VALUES (${email.toLowerCase()}, ${nome}, ${cognome}, ${targa.toUpperCase()}, ${registrato}, false)
        RETURNING *
      `;
      return { statusCode: 201, body: JSON.stringify({ ok: true, user }) };
    }

    // ── Rimuovi utente ──
    if (event.httpMethod === 'DELETE') {
      const { email } = JSON.parse(event.body);
      const [user] = await sql`SELECT parked FROM users WHERE email = ${email.toLowerCase()}`;
      if (user?.parked) {
        await sql`UPDATE parking_state SET occupied = GREATEST(occupied - 1, 0) WHERE cliente = 'retelit'`;
      }
      await sql`DELETE FROM users WHERE email = ${email.toLowerCase()}`;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
