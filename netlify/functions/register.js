// netlify/functions/register.js
// POST /.netlify/functions/register
// Body: { nome, cognome, targa }
// Autenticato: ruolo 'user' (email estratta dal JWT)

const { getDb, requirePost, parseBody, jsonHeaders, errorResponse, requireRole } = require('./utils');

const TARGA_RE = /^[A-Z0-9]{5,10}$/;

exports.handler = async (event) => {
  const methodError = requirePost(event);
  if (methodError) return methodError;

  let jwt;
  try {
    jwt = requireRole(event, 'user');
  } catch (err) {
    return errorResponse(err);
  }

  const sql = getDb();
  try {
    const { nome, cognome, targa } = parseBody(event);

    if (!nome || !cognome || !targa)
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Tutti i campi sono obbligatori' }) };

    const normalizedTarga = targa.toUpperCase().trim();
    if (!TARGA_RE.test(normalizedTarga))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Targa non valida' }) };

    const [user] = await sql`SELECT id FROM users WHERE email = ${jwt.email}`;
    if (!user)
      return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Utente non trovato' }) };

    const [updated] = await sql`
      UPDATE users
      SET nome = ${nome.trim()}, cognome = ${cognome.trim()}, targa = ${normalizedTarga}, registrato = true
      WHERE email = ${jwt.email}
      RETURNING email, nome, cognome, targa, pin, registrato, parked
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
