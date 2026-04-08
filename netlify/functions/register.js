// netlify/functions/register.js
// POST /.netlify/functions/register
// Body: { email, nome, cognome, targa }

const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method Not Allowed' };

  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  try {
    const { email, nome, cognome, targa } = JSON.parse(event.body);
    if (!email || !nome || !cognome || !targa)
      return { statusCode: 400, body: JSON.stringify({ error: 'Tutti i campi sono obbligatori' }) };

    const [user] = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (!user)
      return { statusCode: 404, body: JSON.stringify({ error: 'Email non in whitelist' }) };

    const [updated] = await sql`
      UPDATE users
      SET nome = ${nome}, cognome = ${cognome}, targa = ${targa.toUpperCase()}, registrato = true
      WHERE email = ${email.toLowerCase()}
      RETURNING *
    `;
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user: updated })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
