/* ══════════════════════════════════════════
   js/ui.js  —  all DOM rendering
   ══════════════════════════════════════════ */

const UI = (() => {

  const $   = id => document.getElementById(id);
  const esc = s  => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function setStatus(id, html) { const e=$(id); if(e) e.innerHTML = html; }
  function spinner(msg) { return '<span class="spinner"></span> ' + msg; }

  function clearAskArea() {
    $('cov-banner').style.display = 'none';
    $('ent-panel').innerHTML = '';
    $('sim-panel').innerHTML = '';
    $('ans-panel').innerHTML = '';
    $('propose-wrap').style.display = 'none';
    setStatus('ask-status', '');
  }

  /* --- Coverage banner --- */
  function renderCoverage(coverage, explanation) {
    const map = {
      fully_covered:    { cls:'full',    icon:'✅', label:'Fully covered' },
      partially_covered:{ cls:'partial', icon:'⚠️', label:'Partially covered' },
      not_covered:      { cls:'missing', icon:'❌', label:'Not covered' },
    };
    const cfg = map[coverage] || { cls:'partial', icon:'⚠️', label:'Assessed' };
    const el = $('cov-banner');
    el.className = 'banner ' + cfg.cls;
    el.style.display = 'flex';
    $('ban-icon').textContent  = cfg.icon;
    $('ban-title').textContent = cfg.label;
    $('ban-exp').textContent   = explanation || '';
  }

  function kindBadge(kind) {
    return '<span class="kind-badge kind-' + kind + '">' + kind + '</span>';
  }

  /* --- Entity card --- */
  function renderEntityCard(e, idx) {
    const pn = e.parents.map(Ontology.localName).filter(Boolean).join(', ') || '—';
    const sn = e.subs.map(Ontology.localName).filter(Boolean).join(', ')    || '—';
    const dn = e.domain.map(Ontology.localName).filter(Boolean).join(', ')  || '—';
    const rn = e.range.map(Ontology.localName).filter(Boolean).join(', ')   || '—';
    var triple = ':someInstance rdf:type :' + e.name;
    if (e.kind === 'ObjectProperty' && e.domain[0] && e.range[0])
      triple = '<' + Ontology.localName(e.domain[0]) + '> :' + e.name + ' <' + Ontology.localName(e.range[0]) + '>';
    else if (e.kind === 'DataProperty' && e.domain[0])
      triple = '<' + Ontology.localName(e.domain[0]) + '> :' + e.name + ' "value"';
    else if (e.kind === 'Class' && e.subs[0])
      triple = '<' + Ontology.localName(e.subs[0]) + '> rdf:type :' + e.name;

    var bid = 'ec-body-' + idx;
    return '<div class="ent-card">' +
      '<div class="ent-head" onclick="UI.toggleCard(\'' + bid + '\',this)" aria-expanded="false">' +
        kindBadge(e.kind) +
        '<span class="ent-name">:' + esc(e.name) + '</span>' +
        (e.label !== e.name ? '<span class="ent-label-alt">' + esc(e.label) + '</span>' : '') +
        '<span class="ent-score">' + (e.score*100).toFixed(0) + '% match</span>' +
        '<span class="ent-arrow">▼</span>' +
      '</div>' +
      '<div class="ent-body" id="' + bid + '">' +
        '<div class="ent-row"><span class="ent-k">Definition</span><span class="ent-v">' + (e.comment ? esc(e.comment) : '<em style="color:var(--dim)">No definition</em>') + '</span></div>' +
        '<div class="ent-row"><span class="ent-k">Type</span><span class="ent-v">' + esc(e.kind) + '</span></div>' +
        '<div class="ent-row"><span class="ent-k">Parents</span><span class="ent-v">' + esc(pn) + '</span></div>' +
        (e.kind==='Class' ? '<div class="ent-row"><span class="ent-k">Subclasses</span><span class="ent-v">' + esc(sn) + '</span></div>' : '') +
        (e.kind!=='Class' ? '<div class="ent-row"><span class="ent-k">Domain</span><span class="ent-v">' + esc(dn) + '</span></div><div class="ent-row"><span class="ent-k">Range</span><span class="ent-v">' + esc(rn) + '</span></div>' : '') +
        '<div class="ent-row"><span class="ent-k">IRI</span><span class="ent-v iri-text">' + esc(e.iri) + '</span></div>' +
        '<div class="ent-row"><span class="ent-k">Example triple</span><span class="ent-v"><span class="triple-chip">' + esc(triple) + '</span></span></div>' +
      '</div></div>';
  }

  function toggleCard(bodyId, head) {
    var b = $(bodyId);
    b.classList.toggle('open');
    head.classList.toggle('open');
    head.setAttribute('aria-expanded', b.classList.contains('open'));
  }

  function renderEntityPanel(hits) {
    if (!hits.length) { $('ent-panel').innerHTML = ''; return; }
    $('ent-panel').innerHTML =
      '<div class="section-label">' + hits.length + ' matching entit' + (hits.length>1?'ies':'y') + '</div>' +
      hits.map(function(e,i){ return renderEntityCard(e,i); }).join('');
  }

  function renderSimilar(allHits) {
    var low = allHits.filter(function(e){ return e.score > 0.08 && e.score < CFG.THRESH_PARTIAL; }).slice(0,8);
    if (!low.length) { $('sim-panel').innerHTML = ''; return; }
    var chips = low.map(function(e){
      return '<span class="sim-chip" onclick="UI.fillQuestion(\''+esc(e.name)+'\')" title="'+esc(e.comment)+'">:'+esc(e.name)+'</span>';
    }).join('');
    $('sim-panel').innerHTML = '<div class="sim-bar">💡 <strong>Similar concepts in ontology:</strong> ' + chips + '</div>';
  }

  function fillQuestion(text) {
    var el = $('q-main');
    el.value = ':' + text;
    el.focus();
    App.ask();
  }

  function renderAnswer(text) {
    if (!text) { $('ans-panel').innerHTML = ''; return; }
    var html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    $('ans-panel').innerHTML = '<div class="ans-block">' + html + '</div>';
  }

  function showProposeForm(missingConcepts, suggestedParent, question) {
    $('propose-wrap').style.display = 'block';
    $('p-ctx').value    = question;
    $('p-parent').value = suggestedParent || '';
    $('miss-chips-row').innerHTML = (missingConcepts || []).map(function(m){
      return '<span class="miss-chip" onclick="UI.selectMissChip(this,\''+esc(m)+'\')">'+esc(m)+'</span>';
    }).join('');
    if (missingConcepts && missingConcepts[0]) $('p-name').value = missingConcepts[0];
  }

  function selectMissChip(el, name) {
    document.querySelectorAll('.miss-chip').forEach(function(c){ c.classList.remove('sel'); });
    el.classList.add('sel');
    $('p-name').value = name;
  }

  function renderOntoStats(onto) {
    $('onto-stats').innerHTML = [
      {v:onto.total, l:'Entities'},{v:onto.classes, l:'Classes'},
      {v:onto.objProps, l:'Object props'},{v:onto.dataProps, l:'Data props'},
    ].map(function(c){ return '<div class="stat-card"><div class="val">'+c.v+'</div><div class="lbl">'+c.l+'</div></div>'; }).join('');
  }

  function setProgress(done, total) {
    var pct = total ? Math.round((done/total)*100) : 0;
    $('prog-fill').style.width = pct + '%';
    $('prog-pct').textContent  = pct + '%';
    $('prog-log').textContent  = 'Embedded ' + done + '/' + total + ' entities…';
  }
  function setProgressDone(total) {
    $('prog-fill').style.width = '100%';
    $('prog-pct').textContent  = '100%';
    $('prog-log').textContent  = '✓ All ' + total + ' entities indexed with Gemini embeddings';
  }

  function showOntoBadge(filename, total) {
    var b = $('onto-badge'); b.style.display = 'block';
    b.textContent = filename + ' · ' + total + ' entities';
  }
  function showSession() {
    var el = $('session-id-display');
    if (el) el.textContent = 'Session: ' + Storage.SESSION_ID.substring(0,18) + '…';
  }
  function unlockNav(id) { var b=$(id); if(b) b.classList.remove('disabled'); }
  function setNavActive(id) {
    document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
    var b=$(id); if(b) b.classList.add('active');
  }

  /* ══ SESSION LOG ══ */

  function _covCfg(cov) {
    var map = {
      fully_covered:    {cls:'full',    icon:'✅', label:'Covered'},
      partially_covered:{cls:'partial', icon:'⚠️', label:'Partial'},
      not_covered:      {cls:'missing', icon:'❌', label:'Missing'},
    };
    return map[cov] || {cls:'partial', icon:'⚠️', label:'?'};
  }

  function renderLogEntry(entry, idx) {
    var c   = _covCfg(entry.coverage);
    var ans = (entry.answer || '').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    var ts  = (entry.timestamp || '').substring(11,19);

    var missHtml = '';
    if ((entry.missing_concepts || []).length) {
      missHtml = '<div class="log-missing">Missing: ' +
        entry.missing_concepts.map(function(m){ return '<span class="mono-tag">:'+esc(m)+'</span>'; }).join(' ') +
        '</div>';
    }

    var noteHtml = entry.note
      ? '<div class="log-note">💬 <em>' + esc(entry.note) + '</em></div>'
      : '';

    var noteBtn = entry.note
      ? '<button class="log-action-btn" onclick="UI.toggleNoteForm(' + idx + ')">✏️ Edit note</button>'
      : '<button class="log-action-btn" onclick="UI.toggleNoteForm(' + idx + ')">💬 Add suggestion / opinion</button>';

    var nfId = 'note-form-' + idx;
    var existNote = entry.note || '';

    return '<div class="log-entry" id="log-entry-' + idx + '">' +
        '<div class="log-q">' +
          '<div class="log-q-bubble"><span class="log-q-icon">🙋</span><span>' + esc(entry.question) + '</span></div>' +
          '<span class="log-ts">' + ts + '</span>' +
        '</div>' +
        '<div class="log-a">' +
          '<div class="log-cov-badge badge-' + c.cls + '">' + c.icon + ' ' + c.label + '</div>' +
          (ans ? '<div class="log-ans-text">' + ans + '</div>' : '') +
          missHtml + noteHtml +
          '<div class="log-actions">' + noteBtn +
            '<button class="log-action-btn" onclick="UI.reuseQuestion(' + idx + ')">↩ Follow-up</button>' +
          '</div>' +
          '<div class="note-form" id="' + nfId + '" style="display:none">' +
            '<textarea id="note-text-' + idx + '" rows="2" placeholder="Write your suggestion, opinion, or note about this answer…">' + esc(existNote) + '</textarea>' +
            '<div style="display:flex;gap:8px;margin-top:6px">' +
              '<button class="btn btn-primary" style="font-size:12px;padding:5px 12px" onclick="App.submitNote(' + idx + ')">Save note</button>' +
              '<button class="btn btn-secondary" style="font-size:12px;padding:5px 12px" onclick="UI.toggleNoteForm(' + idx + ')">Cancel</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderSessionLog(entries) {
    var c = $('session-log');
    if (!c) return;
    if (!entries.length) {
      c.innerHTML = '<p class="log-empty">Your conversation will appear here.</p>';
      return;
    }
    c.innerHTML = entries.map(function(e,i){ return renderLogEntry(e,i); }).join('');
    c.scrollTop = c.scrollHeight;
  }

  function appendLogEntry(entry, idx) {
    var c = $('session-log');
    if (!c) return;
    var emp = c.querySelector('.log-empty');
    if (emp) emp.remove();
    var div = document.createElement('div');
    div.innerHTML = renderLogEntry(entry, idx);
    c.appendChild(div.firstElementChild);
    c.scrollTop = c.scrollHeight;
  }

  function updateLogEntry(entry, idx) {
    var old = $('log-entry-' + idx);
    if (!old) return;
    var div = document.createElement('div');
    div.innerHTML = renderLogEntry(entry, idx);
    old.replaceWith(div.firstElementChild);
  }

  function toggleNoteForm(idx) {
    var f = $('note-form-' + idx);
    if (!f) return;
    var open = f.style.display !== 'none';
    f.style.display = open ? 'none' : 'block';
    if (!open) { var t = $('note-text-' + idx); if(t) t.focus(); }
  }

  function reuseQuestion(idx) {
    $('q-main').focus();
    $('q-main').scrollIntoView({ behavior:'smooth' });
  }

  function setConvIndicator(turnCount) {
    var el = $('conv-indicator');
    if (!el) return;
    if (turnCount > 0) {
      el.style.display = 'flex';
      el.textContent   = '🧠 Memory active · ' + turnCount + ' turn' + (turnCount > 1 ? 's' : '') + ' in context';
    } else {
      el.style.display = 'none';
    }
  }

  return {
    $, esc, setStatus, spinner,
    clearAskArea, renderCoverage,
    renderEntityPanel, renderSimilar, fillQuestion,
    renderAnswer, showProposeForm, selectMissChip,
    renderOntoStats, setProgress, setProgressDone,
    showOntoBadge, showSession, unlockNav, setNavActive,
    toggleCard,
    renderSessionLog, appendLogEntry, updateLogEntry,
    toggleNoteForm, reuseQuestion, setConvIndicator,
  };

})();
