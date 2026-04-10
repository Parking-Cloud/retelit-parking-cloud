// netlify/functions/update-parking.js
// POST /.netlify/functions/update-parking
// Body: { action: 'enter' | 'exit' }
// Autenticato: ruolo 'user' (email estratta dal JWT)

const { getDb, requirePost, parseBody, jsonHeaders, errorResponse, requireRole, CLIENTE } = require('./utils');

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
    const { action } = parseBody(event);

    if (!['enter', 'exit'].includes(action))
      return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Azione non valida' }) };

    const [user] = await sql`SELECT id, parked FROM users WHERE email = ${jwt.email}`;
    if (!user)
      return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Utente non trovato' }) };

    let newState;

    if (action === 'enter') {
      if (user.parked)
        return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Già parcheggiato' }) };

      // Atomic: incrementa solo se c'è posto, altrimenti torna null
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
