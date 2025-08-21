# Lesson 7.6 — Chapter Summary: Evaluating Retrieval‑Augmented Generation (RAG)

> **Where we are:** In 7.1–7.5 you learned how to *design*, *build*, and *operate* evaluation for RAG systems. This summary is your **one‑pager + playbook**. It compresses the chapter into checklists, diagrams-in-text, prompts, gates, and a minimal pipeline you can reuse in CI. Keep this file next to your repo.

---

## Big picture in one diagram (ASCII)

```
User Query
   │
   ▼
[Retriever] ──► top‑k chunks ─► [Reranker/Router] ─► Digest
                                             │
                                             ▼
                                         [Generator]
                                             │
                                             ▼
                                      Answer + [IDs]
                                             │
                                             ▼
                                 [Judges + Metrics]
        ┌──────────────────────────────────────────────────────────────┐
        │  Retrieval panel: Recall@k, nDCG@k, Precision@k, Latency     │
        │  Generation panel: Groundedness, Completeness, Directness    │
        │                         Style/Safety, Citation correctness   │
        │  End‑to‑end: Bias‑corrected True Success + Budget adherence  │
        └──────────────────────────────────────────────────────────────┘
```

**Core principle:** Evaluate **components separately** *and* **end‑to‑end** with **confidence intervals** by **query** (or conversation).

---

## The data model you need (repeatable & drift‑aware)

### Documents & chunks
- **Document**: `doc_id`, `title/url`, `text`, `metadata.version (as_of)`  
- **Chunk**: `chunk_id = doc_id#anchor`, `start/end`, `text`, `section`, `lang`  
Keep **stable IDs**—attribution depends on them.

### Query items
Each JSON record includes:
- `query_id`, `question`, `language`, `intent`, `answer_type`, `difficulty`  
- `as_of` (time of truth)  
- `gold_evidence` (chunk IDs; doc‑level allowed but chunk‑level preferred)  
- `ideal_answer` (concise, includes exceptions)  
- `negatives` (hard distractors), `multi_hop`, `no_answer`, `tags`

Why this matters: it unlocks **retrieval metrics** (Recall@k/nDCG), **generation checks** (groundedness, completeness), **citations**, **time‑aware** experimentation, and **segment analysis**.

---

## Metric panels (what to watch)

### Retrieval
- **Hit/Recall@k**: presence of gold evidence; **Weighted Recall** for graded labels.  
- **MRR / nDCG@k**: *how early* the right chunks appear.  
- **Precision@k, Distinct‑docs@k**: clutter vs. diversity.  
- **Latency/Cost/Freshness**: ms, tokens, index storage; enforce `doc.version ≤ as_of`.  
- **k‑sweep**: plot Recall/nDCG over `k ∈ {1,3,5,10,20}` to find the knee.

### Generation
- **Must‑pass**: schema, language match, safety, **citations_present & _valid_**.  
- **Scores (1–5)**: **Groundedness**, **Completeness**, **Directness**, **Style**.  
- **Deterministic**: **Citation correctness** (IDs ∈ digest), **Supported‑claims rate**.  
- **Abstention**: false‑answer rate on `no_answer=true` items; **abstain_quality**.

### End‑to‑end outcome
- **True success**: judge‑pass corrected by calibration `(sensitivity, specificity)` with **95% CIs** (bootstrap by **query**).  
- **Budget adherence**: token + latency thresholds.  
- **Segments**: language, topic, doc version, difficulty, answer type.

---

## Judges (short, anchored, versioned)

- **Relevance judge** (optional): labels pool items 2/1/0 for precision/nDCG.  
- **Generation judge**: emits **must‑pass** + scores + supported claims (JSON only).  
- **End‑to‑end judge**: overall “correct & grounded” decision from digest + citations.

**Prompt tips**
- Keep ≤12 lines; temperature=0; no chain‑of‑thought; **digest‑only**, not full docs.  
- Version everything: `JUDGE_NAME@model@prompt_version`.

**Calibration**
- 200 human items → estimate `(s, t)` → compute **bias‑corrected true success**.  
- Track **honeypots** to detect judge drift.

---

## Synthesis & splits (how to build the dataset quickly)

- Mix **documents‑only** (coverage), **log‑seeded** (realism), and **SME anchors** (quality).  
- Add **hard negatives**, **multi‑hop**, and **no‑answer** items deliberately.  
- De‑duplicate with **template families**; group by **doc/section family**.  
- Use **time‑aware** splits based on `as_of` to avoid leakage and track drift.

---

## Release gates (sample numbers; tune to your product)

```
Ship if (CI lower bounds):
Retrieval: Recall@5 ≥ 0.90 and nDCG@5 ≥ 0.80; Precision@5 ≥ 0.60; p50 latency ≤ 60ms
Generation: True success ≥ 0.80 overall and ≥ 0.75 in critical segments
Attribution: Citation correctness ≥ 0.95; Supported‑claims ≥ 0.90
No‑answer: False‑answer rate ≤ 0.02
Ops: Token budget unchanged; rerank latency ≤ 50ms
```

Why CI‑**lower**? Because you’re guarding against **optimistic noise**.

---

## Debugging cheat‑sheet (symptom → first move)

| Symptom | Likely cause | First move |
|---|---|---|
| High Recall@5, low groundedness | Generator ignoring evidence | Enforce citations per sentence; boost reranker precision |
| Low Recall@50 | Indexing/embedding or chunking | Try doc‑level retrieval; if good, fix chunker |
| Good groundedness, low completeness | Missing exceptions | Prompt anchor + chunk “rule + exceptions” together |
| nDCG low, Recall@50 ok | Good chunks buried | Strengthen cross‑encoder reranker; query expansion |
| No‑answer false claims | Insufficient evidence handling | Add abstain exemplars + sufficiency check |
| Segment drop (es‑AR) | Locale or router issue | Check retrieval slices and locale terms |

---

## Minimal end‑to‑end evaluation loop (pseudocode)

```python
# inputs: dataset.jsonl (7.2), retrieval_run.jsonl, answers.jsonl
items = load_dataset()
retrieval = load_retrieval_run()  # top-k per query + latency + versions
answers = load_answers()          # model output with [doc#chunk] citations

# 1) Retrieval metrics
ret_panel = compute_retrieval_panel(items, retrieval)   # Recall@k, nDCG@k, Precision@k, k-sweep, latency

# 2) Generation metrics
for q in items:
    digest = make_digest(q, retrieval[q.id])            # evidence snippets + IDs
    det = deterministic_checks(answers[q.id], digest)   # citation_correctness, supported_claims_rate
    judg[q.id] = judge_generation(q, answers[q.id], digest)  # must_pass + scores JSON

gen_panel = aggregate_generation(judg, det, segments=items.tags)

# 3) True success + CIs
pi_hat, ci = bias_correct_with_calibration(gen_panel.pass_rate, s, t)
e2e = assemble_report(ret_panel, gen_panel, pi_hat, ci, budgets, segments)

# 4) Gates
exit_code = pass_or_fail(e2e, GATES)
save_report(e2e)  # HTML or MD with tables and examples
```

**Decision‑readiness:** Attach **dataset version**, **index version**, **judge versions**, and **code SHA** so results are reproducible.

---

## Prompts you can copy (final versions)

### System prompt for the generator (RAG mode)
```
Use ONLY the EVIDENCE provided. Every factual sentence must include a citation [id].
Answer in {{lang}}. Start with the direct answer in ≤3 sentences; then add brief context.
If evidence is insufficient or conflicting, say you cannot find the answer and suggest the next step.
For answer_type={{answer_type}}:
- short_fact: include any exceptions found.
- instruction: numbered steps.
- multi_step: address each required part before the final summary.
```

### Generation judge (JSON, deterministic)
```
You evaluate an answer for a Retrieval-Augmented QA system. Use ONLY the EVIDENCE.
Return JSON only with fields: must_pass{schema_valid,language_match,safety_pass,citations_present,citations_valid,no_hallucinated_entities}, scores{groundedness,completeness,directness,style} (1-5), supported_claims[], abstain{should_have_abstained,abstain_quality}.
```

### Relevance judge (graded 2/1/0)
```
Decide if a retrieved chunk is Relevant(2), Partial(1), or Irrelevant(0) to the question. Use the snippet and heading. JSON only: {"relevance":0|1|2,"rationale":"..."}
```

---

## Common pitfalls to keep in mind (from 7.5)

- **Gold incomplete** → combine **pooling** + relevance judge; treat Recall as **lower bound**.  
- **Template/time leakage** → split by **families** and **as_of**.  
- **Chunking splits facts** → chunk by **headings + sentences** with overlap; keep *rule + exceptions* together.  
- **Answer w/o evidence** → citation discipline + strict judge.  
- **Judge instability** → temperature=0, digest‑only, versioned; calibrate to get **true success**.  
- **Single‑metric myopia** → always read **panels** + **k‑sweep** + **segments** together.

---

## What to automate in CI/CD

1. **Nightly dataset refresh** for docs changed since last run (`as_of` bump).  
2. **Index build & smoke test** (doc‑vs‑chunk recall).  
3. **Retrieval panel + k‑sweep** with artifact versions.  
4. **Generation panel** with **citation checks** and **true success** (bias‑corrected).  
5. **Segment report** (BR‑pt, es‑AR, topic buckets, versions).  
6. **Gates** that fail the build when CI‑lower bounds slip.  
7. **Navigable examples**: top misses and typical successes (copyable digests).

---

## A simple decision tree for triage

1. **End‑to‑end true success** below gate?  
   - **Yes** → Check **Retrieval Recall@5**.  
     - Low → fix retriever/chunker/reranker.  
     - High → check **Groundedness/Completeness** and **Citation correctness**.  
       - Low groundedness → prompt discipline + reranker precision.  
       - Low completeness → chunk/exception handling + prompt anchor.  
   - **No** → Check **latency/cost**; consider shrinking `k` at small quality loss (read **k‑sweep**).

---

## Final checklist (print and stick on your monitor)

- [ ] Stable **IDs** for docs/chunks; dataset has `as_of`.  
- [ ] Items include **gold_evidence**, **ideal_answer**, **negatives**, **no_answer**, **multi_hop**.  
- [ ] Retrieval panel with **Recall/nDCG/Precision**, **k‑sweep**, and **latency**.  
- [ ] Generator enforces **citations**; judge returns **JSON** (must‑pass + scores).  
- [ ] **Citation correctness** and **supported‑claims** computed deterministically.  
- [ ] **True success** bias‑corrected with **CIs**; **segment slices** reported.  
- [ ] Gates defined on **CI‑lower bounds**; failures block release.  
- [ ] Pitfall quick tests runnable in <15 minutes.  
- [ ] Reports include **artifact versions** (dataset, index, judges, code SHA).

---

## Suggested mini‑project (capstone for Chapter 7)

Take a live help‑center RAG and:
1. Build a **300‑item** evaluation set across BR‑pt and es‑AR (≥50 multi‑hop; ≥30 no‑answer).  
2. Produce a **retrieval report** (Recall/nDCG, k‑sweep, latency) and a **generation report** (groundedness/completeness/directness/style, citations).  
3. Calibrate judges on 200 items; report **true success** with CIs and **segment** tables.  
4. Ship one improvement (retriever or prompt). Re‑run CI; show before/after with **Δ** and explain *why* it worked using diagnostics.

---

## Closing note

RAG eval is not about finding a perfect number. It’s about creating a **trusted feedback loop**: clear data contracts → meaningful panels → calibrated judges → CI gates. When this loop is healthy, teams move fast *and* safely—changes become measurable bets instead of guesswork.
