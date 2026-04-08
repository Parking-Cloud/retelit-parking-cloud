// netlify/functions/manage-admins.js
// GET    → lista tutti gli admin FM
// POST   → { email, nome, cognome, azienda }  crea nuovo FM
// DELETE → { email }  rimuove FM

const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const sql = neon(process.env.DATABASE_URL);
  try {

    if (event.httpMethod === 'GET') {
      const admins = await sql`SELECT id, email, nome, cognome, azienda, ruolo, first_login, created_at FROM admins ORDER BY ruolo DESC, created_at`;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admins }) };
    }

    if (event.httpMethod === 'POST') {
      const { email, nome, cognome, azienda } = JSON.parse(event.body);
      if (!email || !nome || !cognome) return { statusCode: 400, body: JSON.stringify({ error: 'Campi obbligatori mancanti' }) };
      const existing = await sql`SELECT id FROM admins WHERE email = ${email.toLowerCase()}`;
      if (existing.length) return { statusCode: 409, body: JSON.stringify({ error: 'Email già presente' }) };
      const [admin] = await sql`
        INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
        VALUES (${email.toLowerCase()}, null, 'fm', ${nome}, ${cognome}, ${azienda || '—'}, true)
        RETURNING id, email, nome, cognome, azienda, ruolo, first_login
      `;
      return { statusCode: 201, body: JSON.stringify({ ok: true, admin }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { email } = JSON.parse(event.body);
      await sql`DELETE FROM admins WHERE email = ${email.toLowerCase()} AND ruolo = 'fm'`;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
