// netlify/functions/register.js
// POST /.netlify/functions/register
// Body: { email, nome, cognome, targa }

const { getDb, requirePost, parseBody, jsonHeaders, errorResponse } = require('./utils');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TARGA_RE = /^[A-Z0-9]{5,10}$/;

exports.handler = async (event) => {
  const methodError = requirePost(event);
  if (methodError) return methodError;

  const sql = getDb();
  try {
    const { email, nome, cognome, targa } = parseBody(event);

    if (!email || !nome || !cognome || !targa)
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Tutti i campi sono obbligatori' }) };

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normalizedEmail))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email non valida' }) };

    const normalizedTarga = targa.toUpperCase().trim();
    if (!TARGA_RE.test(normalizedTarga))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Targa non valida' }) };

    const [user] = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (!user)
      return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email non in whitelist' }) };

    const [updated] = await sql`
      UPDATE users
      SET nome = ${nome.trim()}, cognome = ${cognome.trim()}, targa = ${normalizedTarga}, registrato = true
      WHERE email = ${normalizedEmail}
      RETURNING email, nome, cognome, targa, registrato
    `;
    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: true, user: updated }),
    };
  } catch (err) {
    return errorResponse(err);
  }
};
