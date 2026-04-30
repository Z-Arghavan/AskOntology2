/* ══════════════════════════════════════════
   js/admin.js
   Admin dashboard: stats, missing-concept
   frequency, proposals, Q&A log, export.
   ══════════════════════════════════════════ */

const Admin = (() => {

  const $ = id => document.getElementById(id);

  /* ── Login / logout ── */
  function login() {
    const pw = $('admin-pw').value;
    if (pw === CFG.ADMIN_PASS) {
      $('admin-gate').style.display = 'none';
      $('admin-dash').style.display = 'block';
      render();
    } else {
      const err = $('admin-err');
      err.style.display = 'block';
      err.textContent   = 'Incorrect password.';
    }
  }

  function logout() {
    $('admin-gate').style.display = 'block';
    $('admin-dash').style.display = 'none';
    $('admin-pw').value = '';
    $('admin-err').style.display = 'none';
  }

  /* ── Main render ── */
  async function render() {
    UI.setStatus('ask-status', '');

    // Show loading state
    $('a-stats').innerHTML   = '<p style="color:var(--muted);font-size:13px">Loading…</p>';
    $('log-tbody').innerHTML = '';

    const [log, proposals] = await Promise.all([
      Storage.readLog(),
      Storage.readProposals(),
    ]);

    renderStats(log);
    renderMissingFreq(log);
    renderLog(log);
    renderProposals(proposals);
  }

  /* ── Stats cards ── */
  function renderStats(log) {
    const full = log.filter(l => l.coverage === 'fully_covered').length;
    const part = log.filter(l => l.coverage === 'partially_covered').length;
    const miss = log.filter(l => l.coverage === 'not_covered').length;

    // Unique sessions
    const sessions = new Set(log.map(l => l.session_id)).size;

    $('a-stats').innerHTML = [
      { v: log.length,                        l: 'Total questions', c: 'var(--accent)' },
      { v: sessions,                          l: 'Sessions',        c: 'var(--purple)' },
      { v: full,                              l: '✅ Fully covered', c: 'var(--green)'  },
      { v: part,                              l: '⚠️ Partial',       c: 'var(--amber)'  },
      { v: miss,                              l: '❌ Not covered',   c: 'var(--red)'    },
      { v: countMissing(log),                 l: 'Unique missing',  c: 'var(--red)'    },
    ].map(s => `
      <div class="a-stat">
        <div class="v" style="color:${s.c}">${s.v}</div>
        <div class="l">${s.l}</div>
      </div>
    `).join('');
  }

  function countMissing(log) {
    const freq = buildMissingFreq(log);
    return Object.keys(freq).length;
  }

  /* ── Missing concept frequency ── */
  function buildMissingFreq(log) {
    const freq = {};
    for (const l of log) {
      for (const m of (l.missing_concepts || [])) {
        if (m) freq[m] = (freq[m] || 0) + 1;
      }
    }
    return freq;
  }

  function renderMissingFreq(log) {
    const freq   = buildMissingFreq(log);
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const maxF   = sorted[0] ? sorted[0][1] : 1;

    if (!sorted.length) {
      $('miss-freq-list').innerHTML = '<p style="color:var(--muted);font-size:13px">No missing concepts recorded yet. Ask some questions first.</p>';
      return;
    }

    $('miss-freq-list').innerHTML = sorted.map(([name, cnt], i) => {
      const barW  = (cnt / maxF * 260).toFixed(0);
      const color = i === 0 ? 'var(--red)' : i < 3 ? 'var(--amber)' : 'var(--accent)';
      return `
        <div class="miss-bar-item">
          <div class="miss-bar-fill" style="width:${barW}px;background:${color}"></div>
          <strong style="font-family:var(--mono)">:${UI.esc(name)}</strong>
          <span style="color:var(--muted);font-size:12px">${cnt}×</span>
        </div>`;
    }).join('');
  }

  /* ── Q&A log table ── */
  function renderLog(log) {
    if (!log.length) {
      $('log-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No questions logged yet.</td></tr>`;
      return;
    }

    $('log-tbody').innerHTML = log
      .slice()
      .reverse()           // newest first
      .map(l => {
        const badge = l.coverage === 'fully_covered'    ? 'f'
                    : l.coverage === 'not_covered'      ? 'm'
                    : 'p';
        const ts    = (l.timestamp || l.ts || '').substring(0, 19).replace('T', ' ');
        const sess  = (l.session_id || '').substring(0, 14) + '…';
        const miss  = (l.missing_concepts || []).join(', ') || '—';
        const ans   = (l.answer || '').substring(0, 60);

        return `
          <tr>
            <td style="white-space:nowrap;font-family:var(--mono)">${UI.esc(ts)}</td>
            <td style="font-family:var(--mono);font-size:11px" title="${UI.esc(l.session_id)}">${UI.esc(sess)}</td>
            <td title="${UI.esc(l.question)}">${UI.esc((l.question || '').substring(0, 55))}</td>
            <td><span class="cbadge ${badge}">${l.coverage || '?'}</span></td>
            <td style="color:var(--red);font-family:var(--mono);font-size:11px" title="${UI.esc(miss)}">${UI.esc(miss.substring(0, 40))}</td>
            <td title="${UI.esc(l.answer)}">${UI.esc(ans)}</td>
          </tr>`;
      }).join('');
  }

  /* ── Proposals ── */
  function renderProposals(proposals) {
    if (!proposals.length) {
      $('proposals-out').innerHTML = '<p style="color:var(--muted);font-size:13px">No proposals submitted yet.</p>';
      return;
    }

    $('proposals-out').innerHTML = proposals.map(p => {
      const name = p.concept_name || p.name || '?';
      const type = p.concept_type || p.type || '?';
      const par  = p.parent_class || p.parent || '—';
      const desc = p.description  || p.desc  || '—';
      const ctx  = p.context_question || p.ctx || '';
      const sess = (p.session_id || '').substring(0, 14) + '…';
      const ts   = (p.created_at || p.ts || '').substring(0, 19).replace('T', ' ');

      return `
        <div class="prop-card">
          <div style="margin-bottom:5px">
            <strong>:${UI.esc(name)}</strong>
            <span style="color:var(--muted);font-size:12px;margin-left:8px">[${UI.esc(type)}]</span>
            ${par !== '—' ? `<span style="color:var(--muted);font-size:12px"> → parent: ${UI.esc(par)}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--text);margin-bottom:4px">${UI.esc(desc)}</div>
          <div style="font-size:11px;color:var(--dim)">
            ${ts} · session: ${sess}
            ${ctx ? ` · question: "${UI.esc(ctx.substring(0, 60))}"` : ''}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Export ── */
  async function exportLog(fmt) {
    const log = await Storage.readLog();
    if (!log.length) { alert('No log data to export yet.'); return; }

    if (fmt === 'csv') {
      Storage.downloadFile(Storage.toCSV(log), 'moafdito_qa_log.csv', 'text/csv');
    } else {
      Storage.downloadFile(Storage.toJSON(log), 'moafdito_qa_log.json', 'application/json');
    }
  }

  /* ── Clear ── */
  function clearLog() {
    if (!confirm('Delete all local log data? (Supabase data is not affected.)')) return;
    Storage.clearLocal();
    render();
  }

  return { login, logout, render, exportLog, clearLog };

})();
