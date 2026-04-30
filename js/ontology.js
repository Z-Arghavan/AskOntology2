/* ══════════════════════════════════════════
   js/ontology.js
   Loads N3.js, parses TTL, builds entity index
   and entity card text (mirrors the notebook).
   ══════════════════════════════════════════ */

const Ontology = (() => {

  /* ── RDF namespace constants ── */
  const NS = {
    rdfType   : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    rdfsLabel : 'http://www.w3.org/2000/01/rdf-schema#label',
    rdfsComment:'http://www.w3.org/2000/01/rdf-schema#comment',
    rdfsSub   : 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    rdfsDomain: 'http://www.w3.org/2000/01/rdf-schema#domain',
    rdfsRange : 'http://www.w3.org/2000/01/rdf-schema#range',
    owlClass  : 'http://www.w3.org/2002/07/owl#Class',
    owlObjProp: 'http://www.w3.org/2002/07/owl#ObjectProperty',
    owlDataProp:'http://www.w3.org/2002/07/owl#DatatypeProperty',
    owlAnnProp: 'http://www.w3.org/2002/07/owl#AnnotationProperty',
    owlInd    : 'http://www.w3.org/2002/07/owl#NamedIndividual',
    rdfProp   : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
    skosPref  : 'http://www.w3.org/2004/02/skos/core#prefLabel',
    skosAlt   : 'http://www.w3.org/2004/02/skos/core#altLabel',
    skosDef   : 'http://www.w3.org/2004/02/skos/core#definition',
    dcDesc    : 'http://purl.org/dc/terms/description',
    dcDescs   : 'http://purl.org/dc/terms/descriptions',
  };

  /* Maps OWL type IRIs → human-readable kind */
  const KIND_MAP = {
    [NS.owlClass]   : 'Class',
    [NS.owlObjProp] : 'ObjectProperty',
    [NS.owlDataProp]: 'DataProperty',
    [NS.owlAnnProp] : 'AnnotationProperty',
    [NS.owlInd]     : 'Individual',
    [NS.rdfProp]    : 'Property',
  };

  /* ── Load N3.js dynamically ── */
  function loadN3() {
    return new Promise((res, rej) => {
      if (window.N3) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/n3@1.17.3/browser/n3.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('Failed to load N3.js from unpkg.com'));
      document.head.appendChild(s);
    });
  }

  /* ── Parse Turtle text → quads array ── */
  function parseTTL(text) {
    return new Promise((res, rej) => {
      const parser = new N3.Parser({ blankNodePrefix: '' });
      const quads  = [];
      parser.parse(text, (err, quad) => {
        if (err)  rej(err);
        else if (quad) quads.push(quad);
        else res(quads);
      });
    });
  }

  /* ── Extract local name from IRI ── */
  function localName(iri) {
    return (iri || '').split('#').pop().split('/').pop();
  }

  /* ── Split CamelCase for text search ── */
  function camelSplit(s) {
    return s.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').toLowerCase().trim();
  }

  /* ── Normalise text for comparison ── */
  function normText(t) {
    return t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ── Build entity index from quads ──────────────────────────────────────
     Mirrors the notebook's extract_entity_info / make_entity_card steps.
     Returns an object with entity array + summary counts. */
  function buildIndex(quads) {
    const bySubj  = {};    // IRI → raw entity data
    const children = {};   // IRI → [child IRIs]

    function ent(iri) {
      if (!bySubj[iri]) {
        bySubj[iri] = {
          iri, types: new Set(),
          labels: [], comments: [],
          parents: [], subs: [], domain: [], range: [],
          outgoing: []   // raw (predicate, object) pairs for subgraph
        };
      }
      return bySubj[iri];
    }

    for (const q of quads) {
      // Only process named node subjects
      if (q.subject.termType !== 'NamedNode') continue;

      const s = q.subject.value;
      const p = q.predicate.value;
      const o = q.object.value;

      if (p === NS.rdfType) {
        ent(s).types.add(o);

      } else if ([NS.rdfsLabel, NS.skosPref, NS.skosAlt].includes(p)) {
        ent(s).labels.push(q.object.value);

      } else if ([NS.rdfsComment, NS.skosDef, NS.dcDesc, NS.dcDescs].includes(p)) {
        ent(s).comments.push(q.object.value);

      } else if (p === NS.rdfsSub && q.object.termType === 'NamedNode') {
        ent(s).parents.push(o);
        if (!children[o]) children[o] = [];
        children[o].push(s);

      } else if (p === NS.rdfsDomain) {
        ent(s).domain.push(o);

      } else if (p === NS.rdfsRange) {
        ent(s).range.push(o);
      }

      // Collect all outgoing triples for subgraph expansion
      ent(s).outgoing.push({ p, o: q.object.value, oType: q.object.termType });
    }

    // Attach children
    for (const [par, cs] of Object.entries(children)) {
      if (bySubj[par]) bySubj[par].subs = cs;
    }

    // Classify and enrich entities
    const entities = [];

    for (const e of Object.values(bySubj)) {
      let kind = null;
      for (const [typeIRI, k] of Object.entries(KIND_MAP)) {
        if (e.types.has(typeIRI)) { kind = k; break; }
      }
      if (!kind) continue;   // skip blank nodes, annotation properties with no type, etc.

      const name       = localName(e.iri);
      const label      = e.labels[0] || name;
      const comment    = e.comments[0] || '';
      const searchText = normText(
        [name, camelSplit(name), ...e.labels, ...e.comments].join(' ')
      );

      entities.push({
        iri:  e.iri,
        name, kind, label, comment, searchText,
        labels:   e.labels,
        comments: e.comments,
        parents:  e.parents,
        subs:     e.subs,
        domain:   e.domain,
        range:    e.range,
        outgoing: e.outgoing.slice(0, 50),  // cap for memory
      });
    }

    return {
      entities,
      classes:   entities.filter(e => e.kind === 'Class').length,
      objProps:  entities.filter(e => e.kind === 'ObjectProperty').length,
      dataProps: entities.filter(e => e.kind === 'DataProperty').length,
      individuals: entities.filter(e => e.kind === 'Individual').length,
      total: entities.length,
    };
  }

  /* ── Entity card text (mirrors notebook make_entity_card) ──────────────
     Each entity is converted to a rich text block that Gemini can embed
     and reason over. */
  function makeEntityCard(e) {
    const parentNames = e.parents.map(localName).filter(Boolean).join(', ') || 'none';
    const subNames    = e.subs.map(localName).filter(Boolean).join(', ') || 'none';
    const domNames    = e.domain.map(localName).filter(Boolean).join(', ') || 'none';
    const rngNames    = e.range.map(localName).filter(Boolean).join(', ') || 'none';

    const tripleLines = e.outgoing.slice(0, 15)
      .map(({ p, o }) => `  ${localName(p)}: ${localName(o)}`)
      .join('\n');

    const parts = [
      `Entity: ${e.name}`,
      `Label: ${e.label}`,
      `Type: ${e.kind}`,
      `Definition: ${e.comment || 'none'}`,
      `Parents: ${parentNames}`,
      e.kind === 'Class'
        ? `Subclasses: ${subNames}`
        : `Domain: ${domNames}`,
      e.kind !== 'Class'
        ? `Range: ${rngNames}`
        : '',
      `Triples:\n${tripleLines || '  (none)'}`,
    ];

    return parts.filter(Boolean).join('\n');
  }

  /* ── Public API ── */
  return {
    loadN3,
    parseTTL,
    buildIndex,
    makeEntityCard,
    localName,
    normText,
    camelSplit,
  };

})();
