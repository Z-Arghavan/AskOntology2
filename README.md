# MOAF-DiT Ontology Explorer

Neuro-symbolic ontology Q&A tool. Upload any OWL Turtle ontology, ask natural-language questions, get semantic answers powered by Gemini GraphRAG.

**Live demo:** `https://YOUR-USERNAME.github.io/MOAF-DiT/`

---

## File structure

```
moafdito-explorer/
├── index.html          ← main page
├── css/
│   └── styles.css      ← all styles
├── js/
│   ├── config.js       ← ★ edit this first
│   ├── ontology.js     ← N3 parsing + entity index
│   ├── embeddings.js   ← Gemini embeddings + cosine similarity
│   ├── graphrag.js     ← subgraph expansion + Gemini LLM
│   ├── storage.js      ← Supabase + Sheets + localStorage
│   ├── ui.js           ← all DOM rendering
│   ├── admin.js        ← admin dashboard
│   └── app.js          ← main orchestrator
└── README.md
```

---

## Step 1 — Edit `js/config.js`

Before deploying, open `js/config.js` and set:

```javascript
ADMIN_PASS : 'your-secret-password',   // change this!
SUPABASE_URL      : '',                // paste after Step 3
SUPABASE_ANON_KEY : '',                // paste after Step 3
```

---

## Step 2 — Deploy to GitHub Pages

1. Push these files to your GitHub repo (e.g. inside a `/explorer` folder or at the root).
2. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**.
3. Your site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

---

## Step 3 — Set up Supabase (cross-user storage)

This stores Q&A from ALL visitors in one database you can see.

### 3a. Create project
1. Go to [supabase.com](https://supabase.com) → New project (free).
2. Choose a region close to your users.

### 3b. Create tables
In **SQL Editor**, run this once:

```sql
-- Q&A log table
CREATE TABLE qa_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  session_id       TEXT,
  question         TEXT,
  coverage         TEXT,
  missing_concepts TEXT[],
  answer           TEXT,
  source           TEXT,
  ontology_name    TEXT
);

-- Proposals table
CREATE TABLE proposals (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  session_id       TEXT,
  concept_name     TEXT,
  concept_type     TEXT,
  parent_class     TEXT,
  description      TEXT,
  example          TEXT,
  context_question TEXT
);

-- Row Level Security: anyone can insert, anyone can read
-- (admin password in the app protects the dashboard)
ALTER TABLE qa_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_insert_qa"        ON qa_log    FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_read_qa"          ON qa_log    FOR SELECT TO anon USING (true);
CREATE POLICY "allow_insert_proposals" ON proposals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_read_proposals"   ON proposals FOR SELECT TO anon USING (true);
```

### 3c. Get your keys
Go to **Settings → API**:
- Copy **Project URL** → paste as `SUPABASE_URL` in `js/config.js`
- Copy **anon/public key** → paste as `SUPABASE_ANON_KEY` in `js/config.js`

The anon key is safe to expose in client-side code as long as RLS is enabled (which the SQL above does).

---

## Step 4 (Optional) — Google Sheets as backup

If you also want a spreadsheet copy:

### 4a. Create the sheet
Go to [sheets.new](https://sheets.new), name it `MOAF-DiT Questions`.

Add headers in row 1:
```
Timestamp | Session | Question | Coverage | Missing | Answer | Ontology
```

### 4b. Create Apps Script
In the sheet: **Extensions → Apps Script** → paste:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date().toISOString(),
    data.session_id       || '',
    data.question         || '',
    data.coverage         || '',
    (data.missing_concepts || []).join(', '),
    (data.answer          || '').substring(0, 500),
    data.ontology_name    || '',
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Deploy → New deployment → Web app → Execute as: Me → Access: Anyone → Deploy.**

Copy the URL → paste as `SHEET_URL` in `js/config.js`.

---

## How to use

| Step | Action |
|------|--------|
| 1 | Enter your Gemini API key and click **Save** |
| 2 | Upload your `.ttl` ontology file |
| 3 | Click **Build index** (uses Gemini embeddings) or **String-match only** (no API) |
| 4 | Ask questions in the **Ask the Schema** panel |
| 5 | View analytics in the **Admin** panel (password from `config.js`) |

### Keyboard shortcut
`Ctrl + Enter` sends the question.

---

## Pipeline (mirrors the Jupyter notebook)

```
Upload .ttl
    │
    ▼
N3.js parse → entity index
    │
    ▼
Gemini text-embedding-004
batchEmbedContents (RETRIEVAL_DOCUMENT)
    │  [once, at index build time]
    ▼
Float32 vector per entity card
    │
    ▼  [per question]
Embed query (RETRIEVAL_QUERY)
    │
    ▼
Cosine similarity → top-k entities
    │
    ▼
Subgraph expansion (incoming + outgoing triples)
    │
    ▼
Gemini gemini-2.0-flash (GraphRAG prompt)
    │
    ▼
Coverage: ✅ / ⚠️ / ❌
Answer + missing concepts + entity cards
    │
    ▼
Storage: localStorage + Supabase + Google Sheets
```

---

## Admin dashboard

Go to **Admin** tab → enter your password from `config.js`.

Shows:
- Total questions, sessions, coverage breakdown
- **Missing concept frequency chart** ← your ontology validation signal
- Full Q&A log with session IDs and timestamps
- User proposals
- Export as JSON or CSV

---

## Gemini API key

Get a free key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

Each visitor enters their own key — it is saved only in their browser's `localStorage` and sent directly to Google's API. It never touches your server or repo.

If you want to provide a shared key, hardcode it in `js/config.js`:

```javascript
// Add this property:
SHARED_GEMINI_KEY : 'AIzaSy...',
```

Then in `js/app.js`, change the `apiKey` variable in `buildIndex()` and `ask()`:

```javascript
const apiKey = localStorage.getItem(CFG.KEY_APIKEY) || CFG.SHARED_GEMINI_KEY || '';
```

Set a billing limit in Google AI Studio to protect against unexpected usage.

---

## Rate limits (429 errors)

The app retries automatically (up to 2 times, with 20s and 40s delays).

If you hit limits frequently:
- Switch to `gemini-2.0-flash-lite` in `config.js` (higher free quotas)
- Enable billing on your Google Cloud account
- Use **String-match only** mode for the index, which makes zero embedding API calls
