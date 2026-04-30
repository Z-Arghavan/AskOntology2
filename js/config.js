/* ══════════════════════════════════════════
   js/config.js  —  edit before deploying
   ══════════════════════════════════════════ */

const CFG = {

  /* ── Gemini models ───────────────────────
     gemini-2.0-flash is deprecated for new users.
     Use gemini-2.0-flash-lite instead.       */
  GEMINI_GEN : 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent',
  // Alternatives if above gives 404:
  // 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
  // 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent'

  GEMINI_EMB : 'https://generativelanguage.googleapis.com/v1/models/text-embedding-004',

  /* ── Admin password — change this ──────── */
  ADMIN_PASS : 'moaf2025',

  /* ── Supabase (cross-user persistent storage)
     Leave empty strings to use localStorage only. */
  SUPABASE_URL      : '',
  SUPABASE_ANON_KEY : '',

  /* ── Google Sheets (optional backup) ──── */
  SHEET_URL : '',

  /* ── Coverage thresholds ──────────────── */
  THRESH_FULL    : 0.85,
  THRESH_PARTIAL : 0.55,
  THRESH_SIM     : 0.20,

  /* ── Pipeline settings ────────────────── */
  BATCH_SIZE  : 20,
  TOP_K       : 8,
  MAX_TRIPLES : 40,

  /* ── Conversation memory ──────────────── */
  MAX_HISTORY_TURNS : 6,   // past Q&A turns to include in each Gemini call

  /* ── localStorage keys ────────────────── */
  KEY_APIKEY    : 'moaf_gkey',
  KEY_LOG       : 'moaf_qa_log_v1',
  KEY_PROPOSALS : 'moaf_proposals_v1',
};
