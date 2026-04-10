// netlify/functions/get-state.js
// GET /.netlify/functions/get-state
// Autenticato: qualsiasi ruolo (user, fm, super)
// - user: restituisce occupied/total + solo il proprio record
// - fm/super: restituisce occupied/total + tutti gli utenti

const { getDb, jsonHeaders, errorResponse, requireRole, CLIENTE } = require('./utils');

exports.handler = async (event) => {
  let jwt;
  try {
    jwt = requireRole(event); // qualsiasi ruolo autenticato
  } catch (err) {
    return errorResponse(err);
  }

  const sql = getDb();
  try {
    const [state] = await sql`SELECT occupied, total FROM parking_state WHERE cliente = ${CLIENTE}`;

    if (jwt.ruolo === 'user') {
      const [me] = await sql`
        SELECT id, email, nome, cognome, targa, pin, registrato, parked
        FROM users WHERE email = ${jwt.email}
      `;
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          occupied: state?.occupied ?? 0,
          total: state?.total ?? 15,
          users: me ? [me] : [],
        }),
      };
    }

    // fm / super: lista completa
    const users = await sql`
      SELECT id, email, nome, cognome, targa, pin, registrato, parked FROM users ORDER BY created_at
    `;
    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({ occupied: state?.occupied ?? 0, total: state?.total ?? 15, users }),
    };
  } catch (err) {
    return errorResponse(err);
  }
};
