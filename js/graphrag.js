/* ══════════════════════════════════════════
   js/graphrag.js
   Subgraph expansion + Gemini GraphRAG.
   Supports multi-turn conversation memory.
   ══════════════════════════════════════════ */

const GraphRAG = (() => {

  /* ── Subgraph expansion ── */
  function expandSubgraph(seedIRIs, quads, entities) {
    const seen   = new Set();
    const lines  = [];
    const limit  = CFG.MAX_TRIPLES;
    const lblMap = {};
    for (const e of entities) lblMap[e.iri] = e.label;

    const label = iri => lblMap[iri] || Ontology.localName(iri);

    for (const iri of seedIRIs) {
      for (const q of quads) {
        const s = q.subject.value, p = q.predicate.value, o = q.object.value;
        if (s !== iri && o !== iri) continue;
        const key = `${s}|${p}|${o}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const oLabel = q.object.termType === 'Literal' ? `"${o}"` : label(o);
        lines.push(`${label(s)} ${Ontology.localName(p)} ${oLabel}`);
        if (lines.length >= limit) return lines;
      }
    }
    return lines;
  }

  /* ── Direct answers (no API) ── */
  function tryDirect(question, onto) {
    const lq = question.toLowerCase();
    const o  = onto;
    const m  = ps => ps.some(p => lq.includes(p));

    if (m(['how many class']))
      return `This ontology contains **${o.classes} classes** (owl:Class).`;
    if (m(['how many object prop']))
      return `The ontology has **${o.objProps} object properties**.`;
    if (m(['how many data prop']))
      return `The ontology has **${o.dataProps} data properties**.`;
    if (m(['how many prop']) && !m(['object', 'data']))
      return `**${o.objProps + o.dataProps} properties** total — ${o.objProps} object + ${o.dataProps} data.`;
    if (m(['how many individual']))
      return `The ontology has **${o.individuals} named individuals**.`;
    if (m(['how many entit', 'total entit', 'how many concept']))
      return `**${o.total} entities**: ${o.classes} classes · ${o.objProps} object props · ${o.dataProps} data props · ${o.individuals} individuals.`;
    if (m(['list all class', 'show all class'])) {
      const names = o.entities.filter(e => e.kind === 'Class').map(e => `:${e.name}`).join('  ');
      return `**All ${o.classes} classes:**\n${names}`;
    }
    if (m(['list all object'])) {
      const names = o.entities.filter(e => e.kind === 'ObjectProperty').map(e => `:${e.name}`).join('  ');
      return `**All ${o.objProps} object properties:**\n${names}`;
    }
    if (m(['list all data'])) {
      const names = o.entities.filter(e => e.kind === 'DataProperty').map(e => `:${e.name}`).join('  ');
      return `**All ${o.dataProps} data properties:**\n${names}`;
    }
    return null;
  }

  /* ── System instruction (sent once, not repeated) ────────────────────
     Gives Gemini the full ontology context as a persistent background. */
  function buildSystemInstruction(onto) {
    const allNames = onto.entities
      .map(e => `${e.kind}:${e.name}`)
      .join(', ');

    return `You are an expert in the MOAF-DiT manufacturing ontology for PCB production at Karel Electronics.

ONTOLOGY SUMMARY — ${onto.total} entities:
${allNames}

Rules:
- Answer ONLY based on the ontology context provided per turn.
- If a concept does not exist, say so clearly and suggest a suitable OWL class or property name.
- If asked for suggestions (e.g. "what do you suggest?"), propose missing concepts with CamelCase names, a parent class, and a brief description.
- Be concise and precise.
- When you respond, always end with a JSON block on its own line:
  {"coverage":"fully_covered|partially_covered|not_covered","missing_concepts":[],"suggested_parent":""}`;
  }

  /* ── Per-turn user prompt (appended to conversation) ─────────────────
     Includes retrieved entities + subgraph for this specific question. */
  function buildTurnPrompt(question, topHits, tripleLines) {
    const entityContext = topHits.length
      ? topHits.map(h =>
          `- ${h.name} [${h.kind}] score=${h.score.toFixed(2)}: ${h.comment.substring(0, 90)}`
        ).join('\n')
      : '(no entities matched above threshold)';

    const kgEvidence = tripleLines.length
      ? tripleLines.join('\n')
      : '(no subgraph triples)';

    return `RETRIEVED ENTITIES for this question:
${entityContext}

SUBGRAPH EVIDENCE:
${kgEvidence}

QUESTION: ${question}`;
  }

  /* ── Call Gemini with full conversation history ───────────────────────
     history = [{role:'user'|'model', text:'...'}]
     systemInstruction = string (ontology context, sent once)           */
  async function callGemini(userPrompt, apiKey, history = [], systemInstruction = '') {
    // Build contents array: past turns + current user message
    const contents = [];

    // Add conversation history (capped to MAX_HISTORY_TURNS pairs)
    const maxTurns = (CFG.MAX_HISTORY_TURNS || 6) * 2;
    const recentHistory = history.slice(-maxTurns);

    for (const turn of recentHistory) {
      contents.push({
        role  : turn.role,
        parts : [{ text: turn.text }],
      });
    }

    // Add the current user message
    contents.push({ role: 'user', parts: [{ text: userPrompt }] });

    const body = {
      contents,
      generationConfig: { temperature: 0.15, maxOutputTokens: 1400 },
    };

    // Add system instruction if provided and it's the first turn
    if (systemInstruction && history.length === 0) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    } else if (systemInstruction && history.length > 0) {
      // Re-inject system context as part of body for models that support it
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    // Retry on 429
    for (let attempt = 0; attempt <= 2; attempt++) {
      const r = await fetch(`${CFG.GEMINI_GEN}?key=${apiKey}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(body),
      });

      if (r.status === 429) {
        if (attempt < 2) {
          const wait = (attempt + 1) * 20;
          UI.setStatus('ask-status', `<span class="spinner"></span> Rate limited — retrying in ${wait}s…`);
          await sleep(wait * 1000);
          continue;
        }
        throw new Error('Rate limit (429). Please wait a minute and try again.');
      }

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(`Gemini ${r.status}: ${(d?.error?.message || '').substring(0, 120)}`);
      }

      const d   = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return txt;
    }
  }

  /* ── Parse structured JSON from model response ── */
  function parseGeminiJSON(raw) {
    // Look for JSON block at end of response
    const m = raw.match(/\{[\s\S]*?\}/g);
    if (!m) return null;
    // Try last JSON block first (model puts it at end per instructions)
    for (let i = m.length - 1; i >= 0; i--) {
      try { return JSON.parse(m[i]); } catch { continue; }
    }
    return null;
  }

  /* ── Extract clean answer text (without the trailing JSON block) ── */
  function extractAnswer(raw) {
    // Remove the trailing JSON block from display text
    return raw.replace(/\{[\s\S]*?"coverage"[\s\S]*?\}\s*$/, '').trim();
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return {
    expandSubgraph,
    tryDirect,
    buildSystemInstruction,
    buildTurnPrompt,
    callGemini,
    parseGeminiJSON,
    extractAnswer,
  };

})();
