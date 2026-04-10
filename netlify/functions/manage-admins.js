// netlify/functions/manage-admins.js
// GET    → lista tutti gli admin FM           [super]
// POST   → { email, nome, cognome, azienda }  crea nuovo FM  [super]
// DELETE → { email }  rimuove FM              [super]
// PATCH  → { email, action: 'reset_password' }               [super]

const { getDb, jsonHeaders, errorResponse, requireRole } = require('./utils');

exports.handler = async (event) => {
  try {
    requireRole(event, 'super');
  } catch (err) {
    return errorResponse(err);
  }

  const sql = getDb();
  try {

    if (event.httpMethod === 'GET') {
      const admins = await sql`
        SELECT id, email, nome, cognome, azienda, ruolo, first_login, created_at FROM admins ORDER BY ruolo DESC, created_at
      `;
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ admins }) };
    }

    if (event.httpMethod === 'POST') {
      const { email, nome, cognome, azienda } = JSON.parse(event.body);
      if (!email || !nome || !cognome) return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Campi obbligatori mancanti' }) };
      const existing = await sql`SELECT id FROM admins WHERE email = ${email.toLowerCase()}`;
      if (existing.length) return { statusCode: 409, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email già presente' }) };
      const [admin] = await sql`
        INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
        VALUES (${email.toLowerCase()}, null, 'fm', ${nome}, ${cognome}, ${azienda || '—'}, true)
        RETURNING id, email, nome, cognome, azienda, ruolo, first_login
      `;
      return { statusCode: 201, headers: jsonHeaders(), body: JSON.stringify({ ok: true, admin }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { email } = JSON.parse(event.body);
      await sql`DELETE FROM admins WHERE email = ${email.toLowerCase()} AND ruolo = 'fm'`;
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'PATCH') {
      const { email, action } = JSON.parse(event.body);
      if (action !== 'reset_password') return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Azione non valida' }) };
      const existing = await sql`SELECT id FROM admins WHERE email = ${email.toLowerCase()} AND ruolo = 'fm'`;
      if (!existing.length) return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'FM non trovato' }) };
      await sql`UPDATE admins SET password = null, first_login = true WHERE email = ${email.toLowerCase()}`;
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: jsonHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return errorResponse(err);
  }
};
