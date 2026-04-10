// netlify/functions/auth.js
// POST /.netlify/functions/auth
// Body: { type: 'user_check' | 'admin_login' | 'admin_set_password', ...params }

const crypto = require('crypto');
const { getDb, requirePost, parseBody, jsonHeaders, errorResponse, signJwt } = require('./utils');

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
  const methodError = requirePost(event);
  if (methodError) return methodError;

  const sql = getDb();
  try {
    const body = parseBody(event);

    // ── Verifica email utente sulla whitelist ──
    if (body.type === 'user_check') {
      const { email } = body;
      if (!email) return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Email obbligatoria' }) };
      const [user] = await sql`
        SELECT email, nome, cognome, targa, pin, registrato, parked
        FROM users WHERE email = ${email.toLowerCase().trim()}
      `;
      if (!user)
        return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: false, reason: 'not_whitelisted' }) };
      const token = signJwt({ email: user.email, ruolo: 'user' }, 'user');
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ ok: true, user, token }),
      };
    }

    // ── Login admin (FM o Super) ──
    if (body.type === 'admin_login') {
      const { email, password, ruolo } = body;
      if (!email || !ruolo) return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Parametri mancanti' }) };
      const [admin] = await sql`
        SELECT email, password, nome, cognome, azienda, ruolo, first_login
        FROM admins WHERE email = ${email.toLowerCase().trim()} AND ruolo = ${ruolo}
      `;
      if (!admin)
        return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: false, reason: 'not_found' }) };
      if (admin.first_login)
        return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: false, reason: 'first_login', nome: admin.nome, cognome: admin.cognome, azienda: admin.azienda }) };
      if (!verifyPassword(password, admin.password))
        return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: false, reason: 'wrong_password' }) };
      const { password: _, ...adminPublic } = admin;
      const token = signJwt({ email: admin.email, ruolo: admin.ruolo }, 'admin');
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ ok: true, admin: adminPublic, token }),
      };
    }

    // ── FM: imposta password al primo accesso ──
    if (body.type === 'admin_set_password') {
      const { email, password } = body;
      if (!password || password.length < 8)
        return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Password troppo corta' }) };
      const [admin] = await sql`
        SELECT email, nome, cognome, azienda, ruolo
        FROM admins WHERE email = ${email.toLowerCase().trim()} AND first_login = true
      `;
      if (!admin)
        return { statusCode: 404, headers: jsonHeaders(), body: JSON.stringify({ error: 'Admin non trovato o già attivato' }) };
      const hashed = hashPassword(password);
      await sql`UPDATE admins SET password = ${hashed}, first_login = false WHERE email = ${admin.email}`;
      const token = signJwt({ email: admin.email, ruolo: admin.ruolo }, 'admin');
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ ok: true, admin, token }),
      };
    }

    return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ error: 'Tipo richiesta non valido' }) };
  } catch (err) {
    return errorResponse(err);
  }
};
