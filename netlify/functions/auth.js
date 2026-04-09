// netlify/functions/auth.js
// POST /.netlify/functions/auth
// Body: { type: 'user_check' | 'admin_login' | 'admin_set_password', ...params }

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

/* ── Password helpers (PBKDF2-SHA512, no external deps) ── */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const idx = stored.indexOf(':');
  if (idx === -1) return false;
  const salt = stored.slice(0, idx);
  const hash = stored.slice(idx + 1);
  try {
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(verify, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method Not Allowed' };

  const sql = neon(process.env.DATABASE_URL);
  try {
    const body = JSON.parse(event.body);

    // ── Verifica email utente sulla whitelist ──
    if (body.type === 'user_check') {
      const { email } = body;
      const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
      if (!user)
        return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'not_whitelisted' }) };
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, user: { email: user.email, nome: user.nome, cognome: user.cognome, targa: user.targa, registrato: user.registrato, parked: user.parked } })
      };
    }

    // ── Login admin (FM o Super) ──
    if (body.type === 'admin_login') {
      const { email, password, ruolo } = body;
      const [admin] = await sql`SELECT * FROM admins WHERE email = ${email.toLowerCase()} AND ruolo = ${ruolo}`;
      if (!admin)
        return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'not_found' }) };
      if (admin.first_login)
        return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'first_login', nome: admin.nome, cognome: admin.cognome, azienda: admin.azienda }) };
      if (!verifyPassword(password, admin.password))
        return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'wrong_password' }) };
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, admin: { email: admin.email, nome: admin.nome, cognome: admin.cognome, azienda: admin.azienda, ruolo: admin.ruolo } })
      };
    }

    // ── FM: imposta password al primo accesso ──
    if (body.type === 'admin_set_password') {
      const { email, password } = body;
      if (!password || password.length < 8)
        return { statusCode: 400, body: JSON.stringify({ error: 'Password troppo corta' }) };
      const [admin] = await sql`SELECT * FROM admins WHERE email = ${email.toLowerCase()} AND first_login = true`;
      if (!admin)
        return { statusCode: 404, body: JSON.stringify({ error: 'Admin non trovato o già attivato' }) };
      const hashed = hashPassword(password);
      await sql`UPDATE admins SET password = ${hashed}, first_login = false WHERE email = ${email.toLowerCase()}`;
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, admin: { email: admin.email, nome: admin.nome, cognome: admin.cognome, azienda: admin.azienda, ruolo: admin.ruolo } })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Tipo richiesta non valido' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
