// netlify/functions/db-init.js
// Chiama questa function UNA VOLTA dopo il deploy per creare le tabelle
// GET /.netlify/functions/db-init

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

exports.handler = async () => {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Tabella admins (facility manager + super admin Parking Cloud)
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id          SERIAL PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT,           -- null finché FM non imposta la prima volta
        ruolo       TEXT NOT NULL,  -- 'super' | 'fm'
        nome        TEXT,
        cognome     TEXT,
        azienda     TEXT,
        first_login BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Tabella utenti (whitelist dipendenti)
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

    // Tabella stato parcheggio (un solo record per cliente)
    await sql`
      CREATE TABLE IF NOT EXISTS parking_state (
        id       SERIAL PRIMARY KEY,
        cliente  TEXT UNIQUE NOT NULL,
        occupied INTEGER DEFAULT 0,
        total    INTEGER DEFAULT 15
      )
    `;

    // Inserisce stato iniziale Retelit se non esiste
    await sql`
      INSERT INTO parking_state (cliente, occupied, total)
      VALUES ('retelit', 0, 15)
      ON CONFLICT (cliente) DO NOTHING
    `;

    // Inserisce super admin Parking Cloud se non esistono (password hashate)
    const hash1 = await bcrypt.hash('pc-admin-2025', 10);
    const hash2 = await bcrypt.hash('pc-team-2025', 10);
    await sql`
      INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
      VALUES ('fede@parkingcloud.eu', ${hash1}, 'super', 'Federico', 'Parking Cloud', 'Parking Cloud Srl', false)
      ON CONFLICT (email) DO NOTHING
    `;
    await sql`
      INSERT INTO admins (email, password, ruolo, nome, cognome, azienda, first_login)
      VALUES ('team@parkingcloud.eu', ${hash2}, 'super', 'Team', 'Parking Cloud', 'Parking Cloud Srl', false)
      ON CONFLICT (email) DO NOTHING
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Tabelle create con successo' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
