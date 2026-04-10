# Parking Cloud · Retelit Spa

Tool di gestione posti parcheggio aziendale.

---

## Deploy su Netlify (passo per passo)

### 1. Carica su GitHub

1. Vai su [github.com](https://github.com) → **New repository**
2. Nome: `parking-cloud-retelit` → **Create repository**
3. Carica tutti i file di questa cartella (drag & drop nella pagina del repo)

### 2. Deploy su Netlify

1. Vai su [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
2. Collega GitHub e seleziona `parking-cloud-retelit`
3. Build settings: lascia tutto vuoto (è un sito statico + functions)
4. Clicca **Deploy site**

### 3. Configura le variabili d'ambiente

Nel pannello Netlify → **Site settings → Environment variables**, aggiungi:

| Variabile | Valore |
|-----------|--------|
| `DATABASE_URL` | aggiunta automaticamente da Netlify DB |
| `JWT_SECRET` | stringa random (genera con `openssl rand -base64 32`) |
| `INIT_SECRET` | stringa a scelta — serve solo per il passo successivo |
| `SUPER_ADMIN_PASS_1` | password iniziale per fede@parkingcloud.eu |
| `SUPER_ADMIN_PASS_2` | password iniziale per team@parkingcloud.eu |

Rideploya il sito dopo aver aggiunto le variabili.

### 4. Abilita Netlify DB

1. Dal pannello del sito → **Integrations → Netlify DB**
2. Clicca **Enable** → crea il database
3. Netlify aggiunge automaticamente la variabile `DATABASE_URL` all'ambiente

### 5. Inizializza le tabelle

Dopo il deploy, apri nel browser (una sola volta):

```
https://tuo-sito.netlify.app/.netlify/functions/db-init?secret=<INIT_SECRET>
```

Dovresti vedere: `{"ok":true,"message":"Tabelle create con successo"}`

> Una volta completata l'inizializzazione puoi rimuovere `INIT_SECRET`, `SUPER_ADMIN_PASS_1` e `SUPER_ADMIN_PASS_2` dalle env var.

### 6. Dominio personalizzato

1. Nel pannello Netlify → **Domain settings → Add custom domain**
2. Inserisci il dominio (es. `parkingcloud-retelit.it`)
3. Segui le istruzioni per configurare i DNS
4. HTTPS è automatico (Let's Encrypt)

---

## Credenziali iniziali

| Ruolo | Email | Password |
|-------|-------|----------|
| Super Admin | fede@parkingcloud.eu | impostata via `SUPER_ADMIN_PASS_1` in db-init |
| Super Admin | team@parkingcloud.eu | impostata via `SUPER_ADMIN_PASS_2` in db-init |
| Facility Manager | facility@retelit.it | *(imposta al primo accesso)* |

---

## Struttura progetto

```
parking-retelit/
├── index.html                    ← Frontend completo
├── netlify.toml                  ← Configurazione Netlify
├── package.json                  ← Dipendenze (Neon DB)
├── README.md
└── netlify/
    └── functions/
        ├── utils.js              ← Helpers condivisi (DB, JWT, error handling)
        ├── db-init.js            ← Crea tabelle (usa 1 volta)
        ├── auth.js               ← Login utenti e admin, emette JWT
        ├── get-state.js          ← Stato parcheggio (autenticato)
        ├── update-parking.js     ← Entrata/uscita (autenticato)
        ├── register.js           ← Prima registrazione utente (autenticato)
        ├── manage-users.js       ← CRUD whitelist utenti (fm/super)
        └── manage-admins.js      ← CRUD facility manager (super)
```

---

## Tabelle database

| Tabella | Descrizione |
|---------|-------------|
| `users` | Whitelist dipendenti Retelit |
| `admins` | Facility manager + Super admin Parking Cloud |
| `parking_state` | Contatore posti occupati (1 record per cliente) |
