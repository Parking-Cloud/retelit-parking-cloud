// netlify/functions/update-parking.js
// POST /.netlify/functions/update-parking
// Body: { email, action: 'enter' | 'exit' }

const { getDb, requirePost, parseBody, jsonHeaders, errorResponse, CLIENTE } = require('./utils');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  const methodError = requirePost(event);
  if (methodError) return methodError;

  const sql = getDb();
  try {
    const { email, action } = parseBody(event);

    if (!email || !['enter', 'exit'].includes(action))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Parametri non validi' }) };

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normalizedEmail))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email non valida' }) };

    const [user] = await sql`SELECT id, parked FROM users WHERE email = ${normalizedEmail}`;
    if (!user)
      return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Utente non trovato' }) };

    let newState;

    if (action === 'enter') {
      if (user.parked)
        return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Già parcheggiato' }) };

      // Atomic: increment only if there's space, returns null if parking is full
      const [result] = await sql`
        UPDATE parking_state
        SET occupied = occupied + 1
        WHERE cliente = ${CLIENTE} AND occupied < total
        RETURNING occupied, total
      `;
      if (!result)
        return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Parcheggio pieno' }) };

      await sql`UPDATE users SET parked = true WHERE id = ${user.id}`;
      newState = result;
    } else {
      if (!user.parked)
        return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Non sei parcheggiato' }) };

      await sql`UPDATE users SET parked = false WHERE id = ${user.id}`;
      const [result] = await sql`
        UPDATE parking_state
        SET occupied = GREATEST(occupied - 1, 0)
        WHERE cliente = ${CLIENTE}
        RETURNING occupied, total
      `;
      newState = result;
    }

    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: true, occupied: newState.occupied, total: newState.total }),
    };
  } catch (err) {
    return errorResponse(err);
  }
};
