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

### 3. Abilita Netlify DB

1. Dal pannello del sito → **Integrations → Netlify DB**
2. Clicca **Enable** → crea il database
3. Netlify aggiunge automaticamente la variabile `DATABASE_URL` all'ambiente

### 4. Inizializza le tabelle

Dopo il primo deploy, apri nel browser:

```
https://tuo-sito.netlify.app/.netlify/functions/db-init
```

Dovresti vedere: `{"ok":true,"message":"Tabelle create con successo"}`

### 5. Dominio personalizzato

1. Nel pannello Netlify → **Domain settings → Add custom domain**
2. Inserisci il dominio (es. `parkingcloud-retelit.it`)
3. Segui le istruzioni per configurare i DNS
4. HTTPS è automatico (Let's Encrypt)

---

## Credenziali iniziali

| Ruolo | Email | Password |
|-------|-------|----------|
| Super Admin | fede@parkingcloud.eu | pc-admin-2025 |
| Super Admin | team@parkingcloud.eu | pc-team-2025 |
| Facility Manager | facility@retelit.it | *(imposta al primo accesso)* |

> ⚠️ Cambia le password dei Super Admin dopo il primo accesso!

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
        ├── db-init.js            ← Crea tabelle (usa 1 volta)
        ├── auth.js               ← Login utenti e admin
        ├── get-state.js          ← Stato parcheggio live
        ├── update-parking.js     ← Entrata/uscita
        ├── register.js           ← Prima registrazione utente
        ├── manage-users.js       ← CRUD whitelist utenti
        └── manage-admins.js      ← CRUD facility manager
```

---

## Tabelle database

| Tabella | Descrizione |
|---------|-------------|
| `users` | Whitelist dipendenti Retelit |
| `admins` | Facility manager + Super admin Parking Cloud |
| `parking_state` | Contatore posti occupati (1 record per cliente) |
