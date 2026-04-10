// netlify/functions/manage-users.js
// GET    → lista tutti gli utenti           [fm, super]
// POST   → { email, nome, cognome, targa, pin }  crea utente  [fm, super]
// PATCH  → { email, pin }  aggiorna PIN          [fm, super]
// DELETE → { email }  rimuove utente              [fm, super]

const { getDb, jsonHeaders, errorResponse, requireRole, CLIENTE } = require('./utils');

exports.handler = async (event) => {
  try {
    requireRole(event, 'fm', 'super');
  } catch (err) {
    return errorResponse(err);
  }

  const sql = getDb();
  try {

    if (event.httpMethod === 'GET') {
      const users = await sql`
        SELECT id, email, nome, cognome, targa, pin, registrato, parked, created_at FROM users ORDER BY created_at
      `;
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ users }) };
    }

    if (event.httpMethod === 'POST') {
      const { email, nome = '', cognome = '', targa = '', pin = null } = JSON.parse(event.body);
      if (!email) return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email obbligatoria' }) };
      const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
      if (existing.length) return { statusCode: 409, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email già in whitelist' }) };
      const registrato = !!(nome && targa);
      const pinVal = pin ? String(pin).replace(/\D/g, '') || null : null;
      const [user] = await sql`
        INSERT INTO users (email, nome, cognome, targa, pin, registrato, parked)
        VALUES (${email.toLowerCase()}, ${nome}, ${cognome}, ${targa.toUpperCase()}, ${pinVal}, ${registrato}, false)
        RETURNING id, email, nome, cognome, targa, pin, registrato, parked, created_at
      `;
      return { statusCode: 201, headers: jsonHeaders(), body: JSON.stringify({ ok: true, user }) };
    }

    if (event.httpMethod === 'PATCH') {
      const { email, pin } = JSON.parse(event.body);
      if (!email) return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email obbligatoria' }) };
      const pinVal = pin ? String(pin).replace(/\D/g, '') || null : null;
      const [user] = await sql`
        UPDATE users SET pin = ${pinVal} WHERE email = ${email.toLowerCase()}
        RETURNING id, email, nome, cognome, targa, pin, registrato, parked
      `;
      if (!user) return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Utente non trovato' }) };
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: true, user }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { email } = JSON.parse(event.body);
      const [user] = await sql`SELECT parked FROM users WHERE email = ${email.toLowerCase()}`;
      if (user?.parked) {
        await sql`UPDATE parking_state SET occupied = GREATEST(occupied - 1, 0) WHERE cliente = ${CLIENTE}`;
      }
      await sql`DELETE FROM users WHERE email = ${email.toLowerCase()}`;
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: jsonHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return errorResponse(err);
  }
};
