// netlify/functions/db-init.js
// Chiama questa function UNA VOLTA dopo il deploy per creare le tabelle
// GET /.netlify/functions/db-init?secret=<INIT_SECRET>

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

exports.handler = async (event) => {
  const initSecret = process.env.INIT_SECRET;
  if (!initSecret || event.queryStringParameters?.secret !== initSecret)
    return { statusCode: 403, body: JSON.stringify({ error: 'Accesso negato' }) };

  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id          SERIAL PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT,
        ruolo       TEXT NOT NULL,
        nome        TEXT,
        cognome     TEXT,
        azienda     TEXT,
        first_login BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        nome        TEXT DEFAULT '',
        cognome     TEXT DEFAULT '',
        targa       TEXT DEFAULT '',
        registrato  BOOLEAN DEFAULT false,
        parked      BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS parking_state (
        id       SERIAL PRIMARY KEY,
        cliente  TEXT UNIQUE NOT NULL,
        occupied INTEGER DEFAULT 0,
        total    INTEGER DEFAULT 15
      )
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT`;

    await sql`
      INSERT INTO parking_state (cliente, occupied, total)
      VALUES ('retelit', 0, 15)
      ON CONFLICT (cliente) DO NOTHING
    `;

    // Le password degli admin super vengono impostate via env vars, non hardcoded
    const superPass1 = process.env.SUPER_ADMIN_PASS_1;
    const superPass2 = process.env.SUPER_ADMIN_PASS_2;

    if (superPass1) {
      const hash1 = hashPassword(superPass1);
      await sql`
        INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
        VALUES ('fede@parkingcloud.eu', ${hash1}, 'super', 'Federico', 'Parking Cloud', 'Parking Cloud Srl', false)
        ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, first_login = false
      `;
    }
    if (superPass2) {
      const hash2 = hashPassword(superPass2);
      await sql`
        INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
        VALUES ('team@parkingcloud.eu', ${hash2}, 'super', 'Team', 'Parking Cloud', 'Parking Cloud Srl', false)
        ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, first_login = false
      `;
    }

    await sql`
      INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
      VALUES ('facility@retelit.it', null, 'fm', 'Facility', 'Manager', 'Retelit Spa', true)
      ON CONFLICT (email) DO NOTHING
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Tabelle create con successo' }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
