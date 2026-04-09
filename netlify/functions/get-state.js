// netlify/functions/get-state.js
// GET /.netlify/functions/get-state

const { neon } = require('@neondatabase/serverless');

exports.handler = async () => {
  const sql = neon(process.env.DATABASE_URL);
  try {
    const [state] = await sql`
      SELECT occupied, total FROM parking_state WHERE cliente = 'retelit'
    `;
    const users = await sql`
      SELECT id, email, nome, cognome, targa, pin, registrato, parked FROM users ORDER BY created_at
    `;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occupied: state?.occupied ?? 0, total: state?.total ?? 15, users })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
