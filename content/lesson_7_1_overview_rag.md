# Lesson 7.1 — Evaluating Retrieval‑Augmented Generation (RAG): Overview

> **Chapter 7 context:** In Chapter 6 you learned to evaluate multi‑turn conversations as *processes*. Chapter 7 narrows the focus to **RAG systems**—pipelines that answer with the help of an external knowledge base. In RAG, quality hinges on two engines working together: a **retriever** that brings the right evidence and a **generator** that says the right thing, grounded in that evidence.  
> **This lesson (7.1):** the *map* of RAG evaluation—what to measure, how to structure your data, and how this chapter fits into your CI. Detailed how‑tos for data creation and metrics arrive in **7.2–7.4**, followed by pitfalls (7.5), summary (7.6), and exercises (7.7).

---

## Learning objectives

By the end of this lesson, you can:

1. Explain the **RAG pipeline** and identify the evaluation **units** (retriever, reranker/router, chunker, generator).  
2. Define a **data model** for RAG evaluation: documents → chunks, queries with **gold evidence** and **ideal answers**, and metadata needed for clean splits.  
3. Choose the **evaluation axes** that matter for decisions: retrieval quality, generation groundedness/attribution, completeness, utility, safety, latency, and cost.  
4. Plan **leakage‑safe splits** and **drift‑aware** monitoring for knowledge bases that change over time.  
5. Prepare to implement short, anchored **judges** and automated reports with **CI‑ready gates**.

---

## 1) What is RAG and why it needs its own evaluation

A RAG system pairs an LLM with a search/index so the model can *read before it answers*. Done right, RAG lowers hallucination, keeps content fresh, and makes answers **auditable** through citations. Done wrong, it creates *confidently wrong* answers that look authoritative because they cite *something*.

The pipeline (common variants) looks like this:

```
User Query ──► Retriever ─► top‑k chunks ─► (Reranker/Router) ─► Generator ─► Answer (+ citations)
                   ▲                            ▲                   ▲
               Corpus/Index               Chunking/route        System prompt
```

- **Retriever** decides *what to read*. Your primary concern is **recall** of relevant chunks under a small `k` (often 3–10) and **coverage** across topics.  
- **Glue** (chunker, reranker, router) shapes the set the generator sees; it can rescue a weak retriever or paper over bad chunking.  
- **Generator** decides *what to say*. Main concerns: **groundedness/attribution** (claims trace to evidence), **completeness**, **directness/utility**, **style & safety**.  
- **End‑to‑end** metrics combine both: *grounded, correct, complete answers within budget*.

**Key idea:** Evaluate **components separately** *and* **end‑to‑end**. Without this, you can’t diagnose whether regressions come from search, chunking, or the model.

---

## 2) The data model that makes RAG evaluation easy

Design your contracts once; everything else becomes straightforward.

### 2.1 Documents and chunks

- **Document**  
  ```json
  { "doc_id": "doc_123", "title": "Refund Policy", "url": "...", "text": "...", "metadata": {"lang":"pt-BR","version":"2025-04-01"} }
  ```
- **Chunk** (derived by your chunker)  
  ```json
  { "chunk_id": "doc_123#p5", "doc_id": "doc_123", "start": 4200, "end": 4980, "text": "Para solicitação de reembolso...", "meta": {"section":"Eligibility"} }
  ```

Store **stable IDs** for documents and chunks; evaluation depends on attribution by ID, not fuzzy text matching.

### 2.2 Queries with gold evidence and ideal answers

Each evaluation item (query) should have:

```json
{
  "query_id": "q_00042",
  "question": "Posso obter reembolso após 30 dias?",
  "language": "pt-BR",
  "intent": "policy_lookup",
  "difficulty": "hard",
  "as_of": "2025-06-01",
  "gold_evidence": ["doc_123#p5", "doc_123#p6"],  // chunk IDs or doc IDs
  "ideal_answer": "Não. O reembolso só é permitido até 30 dias se o produto não foi usado...",
  "answer_type": "short_fact | multi-step | instruction",
  "negatives": ["doc_777#p2"],                     // optional hard negatives for diagnostics
  "tags": ["refunds", "policy", "BR"]
}
```

- **`gold_evidence`** is crucial. It lets you compute retrieval metrics (Recall@k, nDCG) and judge **attribution** for generation.  
- **`as_of`** captures knowledge **time**. If the policy changes, you can run time‑based splits and avoid blaming the system for “mistakes” against outdated labels.  
- **`answer_type`** helps choose the right rubric (short fact vs. procedural instructions vs. multi‑hop).

### 2.3 Digests for generation judges

To keep judges cheap and robust, prepare a **digest** per query:

```
QUERY: "Posso obter reembolso após 30 dias?"
TOP-K EVIDENCE:
[doc_123#p5] "Pedidos de reembolso são aceitos até 30 dias..." (link_id: 123)
[doc_123#p6] "Exceções: defeito de fabricação..." (link_id: 124)
SYSTEM NOTES: language=pt-BR; policy_version=2025-04-01.
```

The generator’s answer should cite **evidence IDs**; your judge can then verify attribution.

---

## 3) Evaluation axes (what to measure and why)

You will report three **panels** with confidence intervals (bootstrap by **query** or by **conversation** if multi‑turn):

### A. Retrieval quality (component)

- **Recall@k**: fraction of queries where at least one gold chunk is in top‑k.  
- **Precision@k**: fraction of retrieved chunks that are relevant (requires graded labels or LLM‑judged relevance).  
- **MRR / nDCG**: rewards ranking the right chunk near the top.  
- **Coverage & headroom**: how much of your corpus receives traffic and how much recall improves if k increases (k‑sweep curve).  
- **Latency & cost**: ms per query, embedding cost per million tokens.  
- **Robustness**: paraphrase resistance, misspellings, non‑Latin text, code‑switching.

### B. Generation quality (component)

- **Groundedness / Attribution**: each **claim** in the answer is supported by one of the **provided evidence** chunks (IDs match).  
- **Completeness**: the answer covers the required aspects (e.g., exceptions) for the **answer_type**.  
- **Directness & Utility**: concise, actionable, answers the question asked.  
- **Style & Safety**: correct language/brand tone; safe content; no PII leakage.

### C. End‑to‑end outcome

- **Correct, grounded answer rate** (bias‑corrected **true success**, with CIs).  
- **Citations correctness**: evidence IDs used are valid and sufficient.  
- **Budget adherence**: tokens, latency, and `k` within limits.  
- **Segment robustness**: language, topic, document version, and channel slices.

> You’ll get recipes and code to compute these in **7.3 (retrieval)** and **7.4 (generation)**.

---

## 4) Splits, drift, and leakage (what can go wrong)

RAG has two failure sources that single‑turn QA doesn’t: **knowledge drift** and **contamination**.

- **Time‑based splits**: Use `as_of` to create **train/design ≤ t0**, **validation (t0,t1]**, **test > t1**. This catches policy changes and link rot.  
- **Group keys**: To avoid leakage, split by **document family** and **query template**. If queries paraphrase the same doc section, keep them in the same group for splitting.  
- **Contamination checks**: if your *generator* has memorized parts of the corpus (common with public docs), design **no‑evidence** probes to detect “answers without retrieval”.  
- **Honeypots & invariants**: frozen items that should not change across releases—used to detect judge or index drift.

---

## 5) Judges (short, anchored, JSON‑only)

As in Chapter 5, keep prompts short and versioned. You’ll typically use three judges:

1. **Relevance judge** (optional): labels retrieved chunks as *relevant* (2), *partially relevant* (1), *irrelevant* (0). Used to compute precision/nDCG when gold evidence is incomplete.  
2. **Generation judge**: scores **Groundedness**, **Completeness**, **Directness/Utility**, **Style/Safety**; verifies **citation IDs** appear and support claims.  
3. **End‑to‑end judge**: decides if the **final answer** is *correct & grounded* for the user, using the query + top‑k digest + citations.

**Calibration:** Collect human labels on ~200 items, estimate judge `(sensitivity, specificity)`, and convert observed pass rates to **true success** with CIs (Chapter 5.6–5.7).

---

## 6) Reporting & release gates (decision‑grade outputs)

Your RAG report should include:

1. **Retrieval panel**: Recall@k (k=1,3,5), nDCG@k, latency, and a **k‑sweep curve**.  
2. **Generation panel**: groundedness, completeness, directness, style/safety—with CIs and examples.  
3. **End‑to‑end**: **true success** (CI), citation correctness, token/latency budgets, and **segment tables** (language, topic, doc version).  
4. **Diagnostics**: top missed docs/sections, hard negatives that fooled the generator, and “answers without evidence” flags.  
5. **Artifacts**: judge versions, dataset snapshot, index version, chunker settings.

**Example gate** (adapt to your domain):

```
Ship if:
- Retrieval Recall@5 ≥ 0.90 and nDCG@5 ≥ 0.80 (CI lower bounds)
- End‑to‑end true_success (CI lower) ≥ 0.80 overall and ≥ 0.75 per critical segment
- Citation correctness ≥ 0.95; global safety ≥ 0.99
- Median latency ≤ 1.2× previous release; token budget unchanged
```

---

## 7) Worked example (help‑center RAG)

**Task:** Answer customer policy questions from a help center (pt‑BR and es‑AR).  
**Corpus:** ~1,200 docs (policies, how‑tos); chunked by headings and sentences.  
**Queries:** 500 items with `gold_evidence` at chunk level; `as_of` set to doc version date.  
**Retriever:** hybrid dense + BM25; `k_raw=50`, reranker to `k=5`.  
**Generator:** instruction‑tuned LLM; answer must include **citations** like `[doc_id#pX]`.

**Evaluation plan:**  
- **Retrieval:** Recall@5 (CI), nDCG@5, latency; per‑topic slices (refunds, shipping, billing).  
- **Generation:** Groundedness (each claim has citation), Completeness (mentions exceptions), Directness (answers in 3–6 sentences), Style/Safety (brand tone + language).  
- **End‑to‑end:** True success (CI), citation correctness, budget adherence.  
- **Diagnostics:** top missed sections; queries that succeed only when raising `k` to 10 (indicates chunking/reranking issues).

**Typical insights:**  
- If **Recall@5** is high but **Groundedness** is low, the generator may be over‑summarizing or ignoring citations → tighten the prompt and judge anchors.  
- If **Recall@5** is low for *refunds* but high elsewhere, investigate **chunking** of policy pages or the index freshness for that folder.  
- If **True success** drops only in es‑AR, check localization drift in docs (`as_of` dates) and ensure retrieval supports Spanish variants.

---

## 8) How this chapter connects to your existing evaluator

Reuse Chapter 6’s automation with small RAG‑specific additions:

- Replace the **conversation digest** with a **RAG digest**: query + top‑k evidence snippets + metadata + citations.  
- Add **retrieval metrics** and a **k‑sweep** function.  
- Extend the **generation judge** to check **attribution** strictly (IDs must be present and support every claim).  
- Keep the same **bootstrap & segment logic**, judge calibration, and CI gates.

---

## 9) What comes next

- **7.2 — Synthesizing Query–Answer Pairs:** how to create balanced, realistic datasets (and hard negatives) safely; deduplication; drift awareness.  
- **7.3 — Metrics for Retrieval Quality:** implement Recall/Precision@k, nDCG, coverage curves, latency and cost accounting, plus debugging tools.  
- **7.4 — Evaluating Generation Quality:** prompts for groundedness/completeness/utility, strict citation checking, and bias‑corrected true success.  
- **7.5 — Common Pitfalls:** leakage via doc IDs, “answering without evidence,” chunk poisoning, multilingual failure modes.

---

## Exercises

1. **Inventory your corpus.** List document sources, update cadence, languages, and access rules. Identify a *stable ID* and a *version/as_of* field.  
2. **Draft your query schema.** Pick fields for `intent`, `answer_type`, `difficulty`, `as_of`, `gold_evidence`, and `ideal_answer`.  
3. **Define segments.** Choose the slices that matter (topic, language, doc version, channel).  
4. **Sketch a digest.** Write a 10–15 line digest template with space for `TOP‑K EVIDENCE` and evidence IDs.  
5. **Choose gates.** Propose CI thresholds for Retrieval Recall@5 and End‑to‑end true success that would block a risky release in your product.

---

## Summary

RAG evaluation splits cleanly into **retrieval** and **generation**, with **end‑to‑end** outcome on top. Structure your data around **stable document/chunk IDs**, **queries with gold evidence and ideal answers**, and **time awareness** (`as_of`). Report **retrieval metrics** (Recall/nDCG/latency), **generation metrics** (groundedness, completeness, utility, safety), and **true success** with CIs and segment slices. In the next lessons you’ll build the dataset (7.2) and the metric machinery (7.3–7.4) to make these numbers decision‑grade.
