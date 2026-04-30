/* ══════════════════════════════════════════
   js/app.js  —  main orchestrator
   ══════════════════════════════════════════ */

const App = (() => {

  /* ── App state ── */
  const state = {
    quads          : [],
    onto           : null,
    entityCards    : [],
    embeddings     : [],
    useEmbeddings  : false,
    ontologyName   : '',

    // Conversation memory
    convHistory    : [],    // [{role:'user'|'model', text:'...'}] for Gemini
    sessionLog     : [],    // [{question, coverage, answer, missing_concepts, note, timestamp}]
    systemInstruction: '',  // built once when ontology is loaded
  };

  /* ── Navigation ── */
  function nav(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + name).classList.add('active');
    UI.setNavActive('nav-' + name);
    if (name === 'admin') Admin.render();
  }

  /* ── API key ── */
  function saveKey() {
    const k = UI.$('api-key').value.trim();
    if (!k) { alert('Please enter your Gemini API key.'); return; }
    localStorage.setItem(CFG.KEY_APIKEY, k);
    UI.setStatus('key-status', '<span style="color:var(--green)">✓ Key saved to localStorage</span>');
    setTimeout(() => UI.setStatus('key-status', ''), 3000);
  }

  /* ── File upload ── */
  async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.endsWith('.ttl')) { alert('Please upload a Turtle (.ttl) file.'); return; }

    state.ontologyName = file.name;
    UI.setStatus('parse-status', UI.spinner('Loading N3.js parser…'));

    try {
      await Ontology.loadN3();
      UI.setStatus('parse-status', UI.spinner('Parsing ' + file.name + '…'));

      const text     = await file.text();
      state.quads    = await Ontology.parseTTL(text);
      state.onto     = Ontology.buildIndex(state.quads);
      state.entityCards = state.onto.entities.map(Ontology.makeEntityCard);

      // Build system instruction once
      state.systemInstruction = GraphRAG.buildSystemInstruction(state.onto);

      UI.$('dropzone').innerHTML =
        '<div class="dz-icon">✅</div>' +
        '<p><strong>' + file.name + '</strong> parsed successfully</p>' +
        '<p class="dz-hint">' + state.onto.total + ' entities · ' + state.quads.length + ' triples</p>';

      UI.renderOntoStats(state.onto);
      UI.$('index-box').style.display = 'block';
      UI.showOntoBadge(file.name, state.onto.total);
      UI.setStatus('parse-status',
        '<span style="color:var(--green)">✓ ' + file.name + ' loaded — ' + state.quads.length + ' triples</span>');

    } catch (e) {
      UI.setStatus('parse-status', '<span style="color:var(--red)">⚠ Parse error: ' + e.message + '</span>');
    }
  }

  /* ── Build embedding index ── */
  async function buildIndex() {
    if (!state.onto) { alert('Upload an ontology file first.'); return; }
    const apiKey = localStorage.getItem(CFG.KEY_APIKEY) || '';
    if (!apiKey) { alert('Please save your Gemini API key first.'); return; }

    UI.$('index-btn').disabled = true;
    UI.setStatus('index-status', UI.spinner('Building semantic index…'));

    try {
      state.embeddings = await Embeddings.buildEmbeddingIndex(
        state.entityCards, apiKey,
        (done, total) => UI.setProgress(done, total)
      );
      state.useEmbeddings = true;
      UI.setProgressDone(state.onto.total);
      UI.setStatus('index-status', '<span style="color:var(--green)">✓ Semantic index ready</span>');
      UI.$('num-setup').textContent = '✓';
      UI.$('nav-setup').classList.add('done');
      UI.unlockNav('nav-ask');
      setTimeout(() => nav('ask'), 800);
    } catch (e) {
      UI.setStatus('index-status', '<span style="color:var(--red)">⚠ Error: ' + e.message + '</span>');
    }
    UI.$('index-btn').disabled = false;
  }

  function skipEmbeddings() {
    if (!state.onto) { alert('Upload an ontology file first.'); return; }
    state.useEmbeddings = false;
    UI.$('prog-fill').style.width = '100%';
    UI.$('prog-pct').textContent  = 'N/A';
    UI.$('prog-log').textContent  = 'String-match mode active (no embedding API calls)';
    UI.setStatus('index-status', '<span style="color:var(--amber)">String-match mode — lower accuracy</span>');
    UI.$('num-setup').textContent = '✓';
    UI.$('nav-setup').classList.add('done');
    UI.unlockNav('nav-ask');
    setTimeout(() => nav('ask'), 400);
  }

  /* ── Clear conversation memory ── */
  function newConversation() {
    state.convHistory = [];
    state.sessionLog  = [];
    UI.renderSessionLog([]);
    UI.setConvIndicator(0);
    UI.clearAskArea();
    UI.$('q-main').value = '';
    UI.$('q-main').focus();
  }

  /* ══════════════════════════════════════════
     MAIN ASK PIPELINE
     ══════════════════════════════════════════ */
  async function ask() {
    const question = UI.$('q-main').value.trim();
    if (!question) { UI.setStatus('ask-status', 'Please enter a question.'); return; }
    if (!state.onto) { UI.setStatus('ask-status', 'No ontology loaded. Go to Setup first.'); return; }

    const apiKey = localStorage.getItem(CFG.KEY_APIKEY) || '';
    UI.clearAskArea();
    UI.$('ask-btn').disabled = true;
    UI.$('q-main').value = '';

    // ── 1. Direct answer (no API) ──────────────
    const direct = GraphRAG.tryDirect(question, state.onto);
    if (direct) {
      const entry = _makeEntry(question, 'fully_covered', [], direct, 'direct');
      UI.renderCoverage('fully_covered', 'Direct schema answer');
      UI.renderAnswer(direct);
      _addToLog(entry);
      UI.$('ask-btn').disabled = false;
      Storage.log(question, 'fully_covered', [], direct, 'direct', state.ontologyName);
      return;
    }

    // ── 2. Retrieve top-k entities ─────────────
    let allHits;
    if (state.useEmbeddings && state.embeddings.length && apiKey) {
      try {
        UI.setStatus('ask-status', UI.spinner('Embedding query…'));
        allHits = await Embeddings.semanticSearch(question, state.onto.entities, state.embeddings, apiKey);
      } catch (e) {
        UI.setStatus('ask-status', '<span style="color:var(--amber)">Embedding failed (' + e.message + ') — string match fallback</span>');
        allHits = Embeddings.strSearch(question, state.onto.entities);
      }
    } else {
      allHits = Embeddings.strSearch(question, state.onto.entities);
    }

    const topK     = allHits.filter(e => e.score > CFG.THRESH_SIM).slice(0, CFG.TOP_K);
    const maxScore = allHits[0]?.score || 0;

    // ── 3. Render entity cards ─────────────────
    UI.renderEntityPanel(topK);
    UI.renderSimilar(allHits);

    // ── 4. Expand subgraph ─────────────────────
    UI.setStatus('ask-status', UI.spinner('Expanding subgraph…'));
    const tripleLines = GraphRAG.expandSubgraph(topK.map(e => e.iri), state.quads, state.onto.entities);

    // ── 5. Gemini with conversation memory ──────
    if (apiKey) {
      try {
        UI.setStatus('ask-status', UI.spinner('Asking Gemini…'));

        // Build the per-turn prompt (includes retrieved context for this question)
        const turnPrompt = GraphRAG.buildTurnPrompt(question, topK, tripleLines);

        // Call Gemini with full conversation history
        const raw = await GraphRAG.callGemini(
          turnPrompt,
          apiKey,
          state.convHistory,          // past turns
          state.systemInstruction     // ontology system context
        );

        const json   = GraphRAG.parseGeminiJSON(raw);
        const answer = GraphRAG.extractAnswer(raw);

        const cov = json?.coverage || (
          maxScore >= CFG.THRESH_FULL    ? 'fully_covered'    :
          maxScore >= CFG.THRESH_PARTIAL ? 'partially_covered': 'not_covered'
        );

        // ── Update conversation history ──
        state.convHistory.push({ role: 'user',  text: turnPrompt });
        state.convHistory.push({ role: 'model', text: raw });

        // Show current answer in the main result area
        UI.renderCoverage(cov, json?.coverage_explanation || '');
        UI.renderAnswer(answer);

        if (cov !== 'fully_covered') {
          UI.showProposeForm(json?.missing_concepts || [], json?.suggested_parent || '', question);
        }

        // ── Add to session log ──
        const entry = _makeEntry(question, cov, json?.missing_concepts || [], answer, 'gemini');
        _addToLog(entry);

        // Update memory indicator
        const turns = Math.floor(state.convHistory.length / 2);
        UI.setConvIndicator(turns);

        // Store
        Storage.log(question, cov, json?.missing_concepts || [], answer, 'gemini', state.ontologyName);

      } catch (e) {
        const cov = maxScore >= CFG.THRESH_FULL    ? 'fully_covered'    :
                    maxScore >= CFG.THRESH_PARTIAL  ? 'partially_covered': 'not_covered';
        const errMsg = 'Gemini unavailable: ' + e.message;
        UI.renderCoverage(cov, 'String-match result — ' + errMsg);
        const entry = _makeEntry(question, cov, [], '', 'string-only');
        _addToLog(entry);
        Storage.log(question, cov, [], '', 'string-only', state.ontologyName);
      }
    } else {
      const cov = maxScore >= CFG.THRESH_FULL    ? 'fully_covered'    :
                  maxScore >= CFG.THRESH_PARTIAL  ? 'partially_covered': 'not_covered';
      UI.renderCoverage(cov, 'String-match — no API key set');
      const entry = _makeEntry(question, cov, [], '', 'string-only');
      _addToLog(entry);
      Storage.log(question, cov, [], '', 'string-only', state.ontologyName);
    }

    UI.setStatus('ask-status', '');
    UI.$('ask-btn').disabled = false;
  }

  /* ── Note / suggestion submission ── */
  function submitNote(idx) {
    const textarea = UI.$('note-text-' + idx);
    if (!textarea) return;
    const note = textarea.value.trim();
    if (!note) { alert('Please write a note before saving.'); return; }

    // Update in-memory log
    if (state.sessionLog[idx]) {
      state.sessionLog[idx].note = note;
      UI.updateLogEntry(state.sessionLog[idx], idx);
      UI.toggleNoteForm(idx);

      // Persist note alongside the Q&A entry
      Storage.saveNote(idx, note, state.sessionLog[idx]);
    }
  }

  /* ── Proposal submission ── */
  async function submitProposal() {
    const name = UI.$('p-name').value.trim();
    if (!name) { alert('Please enter a concept name.'); return; }
    const proposal = {
      name:    name,
      type:    UI.$('p-type').value,
      parent:  UI.$('p-parent').value.trim(),
      desc:    UI.$('p-desc').value.trim(),
      example: UI.$('p-ex').value.trim(),
      notes:   UI.$('p-notes') ? UI.$('p-notes').value.trim() : '',
      ctx:     UI.$('p-ctx').value,
    };
    await Storage.saveProposal(proposal);
    // Clear form fields
    ['p-name','p-parent','p-desc','p-ex','p-notes'].forEach(id => {
      const el = UI.$(id); if (el) el.value = '';
    });
    document.querySelectorAll('.miss-chip').forEach(c => c.classList.remove('sel'));
    const ok = UI.$('p-ok');
    ok.textContent = '✓ Proposal saved! Thank you.';
    setTimeout(() => { ok.textContent = ''; }, 4000);
  }

  /* ── Helpers ── */
  function _makeEntry(question, coverage, missing, answer, source) {
    return {
      question, coverage, answer, source,
      missing_concepts: missing || [],
      note:       '',
      timestamp:  new Date().toISOString(),
    };
  }

  function _addToLog(entry) {
    const idx = state.sessionLog.length;
    state.sessionLog.push(entry);
    UI.appendLogEntry(entry, idx);
  }

  /* ── Drag-and-drop ── */
  function initDragDrop() {
    const dz = UI.$('dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', async e => {
      e.preventDefault(); dz.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const fi = UI.$('file-in');
      const dt = new DataTransfer(); dt.items.add(file); fi.files = dt.files;
      await handleFile(fi);
    });
  }

  /* ── Init ── */
  function init() {
    const saved = localStorage.getItem(CFG.KEY_APIKEY) || '';
    if (saved) {
      UI.$('api-key').value = saved;
      UI.setStatus('key-status', '<span style="color:var(--green)">✓ API key loaded</span>');
    }
    UI.showSession();
    initDragDrop();
    UI.$('q-main').addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') ask(); });
    UI.$('admin-pw').addEventListener('keydown', e => { if (e.key === 'Enter') Admin.login(); });
    UI.renderSessionLog([]);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { nav, saveKey, handleFile, buildIndex, skipEmbeddings, newConversation, ask, submitNote, submitProposal };

})();
