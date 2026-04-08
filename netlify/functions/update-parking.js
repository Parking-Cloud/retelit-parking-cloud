// netlify/functions/update-parking.js
// POST /.netlify/functions/update-parking
// Body: { email, action: 'enter' | 'exit' }

const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method Not Allowed' };

  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  try {
    const { email, action } = JSON.parse(event.body);
    if (!email || !['enter','exit'].includes(action))
      return { statusCode: 400, body: JSON.stringify({ error: 'Parametri non validi' }) };

    const [user] = await sql`SELECT id, parked FROM users WHERE email = ${email}`;
    if (!user)
      return { statusCode: 404, body: JSON.stringify({ error: 'Utente non trovato' }) };

    const [state] = await sql`SELECT occupied, total FROM parking_state WHERE cliente = 'retelit'`;

    if (action === 'enter') {
      if (user.parked)
        return { statusCode: 400, body: JSON.stringify({ error: 'Già parcheggiato' }) };
      if (state.occupied >= state.total)
        return { statusCode: 400, body: JSON.stringify({ error: 'Parcheggio pieno' }) };

      await sql`UPDATE users SET parked = true WHERE email = ${email}`;
      await sql`UPDATE parking_state SET occupied = occupied + 1 WHERE cliente = 'retelit'`;
    } else {
      if (!user.parked)
        return { statusCode: 400, body: JSON.stringify({ error: 'Non sei parcheggiato' }) };

      await sql`UPDATE users SET parked = false WHERE email = ${email}`;
      await sql`UPDATE parking_state SET occupied = GREATEST(occupied - 1, 0) WHERE cliente = 'retelit'`;
    }

    const [newState] = await sql`SELECT occupied, total FROM parking_state WHERE cliente = 'retelit'`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, occupied: newState.occupied, total: newState.total })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
