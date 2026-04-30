/* ══════════════════════════════════════════
   js/embeddings.js
   Gemini embedding API (batchEmbedContents)
   + cosine similarity + string-match fallback.
   Mirrors the notebook embedding pipeline.
   ══════════════════════════════════════════ */

const Embeddings = (() => {

  /* ── Cosine similarity ── */
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }

  /* ── Batch embed multiple texts (documents) ────────────────────────────
     Uses batchEmbedContents endpoint — up to CFG.BATCH_SIZE per call.
     Returns array of float32 vectors in same order as input texts. */
  async function batchEmbed(texts, apiKey) {
    const requests = texts.map(t => ({
      model: 'models/text-embedding-004',
      content: { parts: [{ text: t.substring(0, 8000) }] },  // API char limit
      taskType: 'RETRIEVAL_DOCUMENT',
    }));

    const r = await fetch(
      `${CFG.GEMINI_EMB}:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(
        `Embedding API error ${r.status}: ${(d?.error?.message || '').substring(0, 120)}`
      );
    }

    const d = await r.json();
    return (d.embeddings || []).map(e => e.values || []);
  }

  /* ── Embed a single query ──────────────────────────────────────────────
     Uses RETRIEVAL_QUERY task type (gives better retrieval results vs
     RETRIEVAL_DOCUMENT used for corpus). */
  async function embedQuery(text, apiKey) {
    const r = await fetch(
      `${CFG.GEMINI_EMB}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.substring(0, 8000) }] },
          taskType: 'RETRIEVAL_QUERY',
        }),
      }
    );

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(`Query embedding error ${r.status}: ${(d?.error?.message || '').substring(0, 80)}`);
    }

    const d = await r.json();
    return d.embedding?.values || [];
  }

  /* ── Build full embedding index ────────────────────────────────────────
     Embeds all entity cards in batches. Calls onProgress(done, total)
     after each batch.
     Returns Float32Array[] — one vector per entity. */
  async function buildEmbeddingIndex(entityCards, apiKey, onProgress) {
    const n     = entityCards.length;
    const vecs  = new Array(n).fill(null);
    const bsize = CFG.BATCH_SIZE;

    for (let i = 0; i < n; i += bsize) {
      const batch = entityCards.slice(i, i + bsize);
      const embeddings = await batchEmbed(batch, apiKey);
      embeddings.forEach((v, j) => { vecs[i + j] = v; });
      if (onProgress) onProgress(Math.min(i + bsize, n), n);

      // Polite delay between batches to avoid rate limits
      if (i + bsize < n) await sleep(600);
    }

    return vecs;
  }

  /* ── Semantic search ───────────────────────────────────────────────────
     Embed the query, compute cosine similarity against all entity vectors,
     return entities sorted by score. */
  async function semanticSearch(question, entities, embeddings, apiKey) {
    const qVec = await embedQuery(question, apiKey);

    return entities
      .map((e, i) => ({
        ...e,
        score: embeddings[i] ? cosine(qVec, embeddings[i]) : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /* ── String-match fallback ─────────────────────────────────────────────
     Used when embeddings are not built or Gemini is unavailable.
     Combines Jaccard token overlap + substring containment. */
  function strSearch(question, entities) {
    const q = Ontology.normText(question);

    return entities
      .map(e => {
        const txt = e.searchText || '';
        if (!txt) return { ...e, score: 0 };

        // Exact local name match
        if (Ontology.normText(e.name) === q) return { ...e, score: 1.0 };

        // Substring containment
        if (txt.includes(q) || q.includes(txt)) return { ...e, score: 0.85 };

        // Token Jaccard
        const qt = new Set(q.split(' ').filter(t => t.length > 2));
        const et = new Set(txt.split(' ').filter(t => t.length > 2));
        if (!qt.size) return { ...e, score: 0 };

        const inter  = [...qt].filter(t => et.has(t)).length;
        const union  = new Set([...qt, ...et]).size;
        const jaccard = inter / union;

        // Partial token hit (query token appears anywhere in entity text)
        const partial = [...qt].filter(t => txt.includes(t)).length / qt.size;

        return { ...e, score: Math.max(jaccard, partial * 0.7) };
      })
      .sort((a, b) => b.score - a.score);
  }

  /* ── Helper ── */
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return {
    cosine,
    batchEmbed,
    embedQuery,
    buildEmbeddingIndex,
    semanticSearch,
    strSearch,
  };

})();
