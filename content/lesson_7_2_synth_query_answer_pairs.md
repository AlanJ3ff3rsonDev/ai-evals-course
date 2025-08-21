# Lesson 7.2 — Synthesizing Query–Answer Pairs (for RAG Evaluation)

> **Chapter 7 context:** 7.1 gave you the map of RAG evaluation. Now we build the *dataset* you’ll use to measure it. We’ll synthesize realistic **query–answer items** with **gold evidence** so retrieval and generation metrics become straightforward, repeatable, and cheap to refresh as your corpus changes.

---

## Learning objectives

By the end of this lesson you will be able to:

1. Define a **clean data schema** for RAG items (queries, gold evidence, ideal answer, negatives, metadata).  
2. Generate high‑quality **synthetic** Q/A that looks like your users (languages, tone, noise) while staying strictly grounded in the corpus.  
3. Create **hard negatives**, **no‑answer** items, and **multi‑hop** questions to probe weaknesses.  
4. De‑duplicate, **decontaminate**, and split the dataset to avoid leakage and temporal drift.  
5. Validate with automated checks and **short LLM‑as‑judge prompts** + light human audit to reach decision‑grade quality.

---

## 0) Why synth at all? And what not to trust

- **Why:** Real logs are noisy, private, and sparse in edge cases. Synthetic lets you **cover the space** (topics × intents × languages) and **control difficulty**.  
- **What not to trust:** Purely synthetic accuracy is **not** the goal; it’s to **exercise the pipeline**. Always validate on a **recent real split** (monitoring set) and tune gates against *both*. Use synthetic for: probing failure modes, regression testing, and driving balanced metrics.

---

## 1) Data schema (decision‑friendly)

Put one JSON object per line (JSONL). Keep **stable IDs** and **as_of** timestamps.

```json
{
  "query_id": "q_000042",
  "question": "Posso obter reembolso após 30 dias?",
  "language": "pt-BR",
  "intent": "policy_lookup",
  "answer_type": "short_fact",              // short_fact | multi_step | instruction | definition
  "as_of": "2025-06-01",                    // doc version date used as truth
  "gold_evidence": ["doc_123#p5", "doc_123#p6"],   // chunk IDs
  "ideal_answer": "Não. Reembolsos são permitidos até 30 dias...",
  "citations": ["doc_123#p5","doc_123#p6"],        // optional prefilled citations for baselines
  "negatives": ["doc_777#p2", "doc_888#p9"],       // hard negatives (distractors)
  "multi_hop": {
    "requires": 2,
    "hops": [
      {"why": "política de elegibilidade", "evidence": "doc_123#p5"},
      {"why": "exceções de defeito", "evidence": "doc_123#p6"}
    ]
  },
  "no_answer": false,                       // queries that should return "not found / not applicable"
  "tags": ["refunds","policy","BR"]
}
```

**Why this works:**  
- `gold_evidence` enables **retrieval** metrics (Recall@k, nDCG) and **attribution** checks for generation.  
- `as_of` lets you perform **time‑aware splits** and handle policy drift.  
- `answer_type` helps choose judge rubrics later (7.4).  
- `negatives` stress‑test the reranker/generator.  
- `no_answer` lets you test “abstain” behavior.

---

## 2) The three sources of truth (and how to blend them)

1. **Documents‑only synthesis** (cold start)  
   - Generate Q/A directly from the corpus chunks. Great for initial coverage and change‑tracking.  
   - Risk: over‑templated phrasing; fight it with *paraphrase noise* and *style variation* (below).

2. **Log‑seeded synthesis** (once you have traffic)  
   - Mine frequent intents and tricky patterns from real queries; rewrite for privacy and clarity; attach gold evidence.  
   - Best for realism. Keep PII out and store **template families** to group near‑duplicates in splits.

3. **Human‑curated anchors**  
   - 5–10% of items crafted or reviewed by SMEs; use these as **honeypots** across releases.  
   - Calibrate your judges on this subset (for `(sensitivity, specificity)`; see 5.6–5.7 of the course).

A **healthy dataset**: ~60–70% documents‑only, ~20–30% log‑seeded, 5–10% human‑anchored.

---

## 3) A repeatable synthesis workflow

### Step 1 — Inventory & chunk

- Ingest docs with **stable `doc_id`** and **`version`/`as_of`**.  
- Chunk by **headings + sentences**, target 400–800 tokens per chunk, with **overlap** for boundary facts.  
- Save `{chunk_id, doc_id, start, end, text, section, lang}`.

### Step 2 — Coverage matrix (what to ask)

Create a grid of **topic × intent × language × difficulty**. Example intents:

- `policy_lookup` (short fact)  
- `procedure` (instructional steps)  
- `definition/comparison`  
- `eligibility/exception`  
- `multi_hop_combine` (requires two or more sections)

Aim for **balanced counts** per cell; decide per‑segment **weights** now (drive sampling and gates later).

### Step 3 — Generate candidate questions

**Prompt (documents‑only):**

> From the chunk below, write **3 user‑style questions** a real customer might ask.  
> - Language: `<pt-BR | es-AR | en>`; style: colloquial but respectful.  
> - Vary phrasing and include **noise**: abbreviations, misspellings, synonyms.  
> - Each question must be **answerable using only this chunk** or with a clearly named sibling section (state which).  
> - Output JSON: `[{"question": "...", "needs_extra": false|true, "extra_section_hint": "..."}, ...]`  
>  
> CHUNK(`chunk_id=doc_123#p5`): `"Pedidos de reembolso são aceitos até 30 dias..."`

**Noise recipe:** randomly apply 0–2 edits:  
- Synonym swap (e.g., “reembolso” ↔ “devolução do valor”)  
- Misspellings (“reemboso”), punctuation drop, uppercase/lowercase variation  
- Code‑switch insertions (“posso fazer refund?”)

### Step 4 — Draft ideal answers and gold evidence

For each candidate question:

- Select **gold chunks** explicitly: the source chunk plus any **sibling** the generator will need (multi‑hop).  
- Draft the **ideal answer** in **≤6 sentences**. Include **all exceptions** found in the gold chunks.  
- Keep **language** consistent with the question.  
- For instruction‑type items, produce a **bulletized** answer (steps) with boundaries like `1)`, `2)`.

**Prompt (answer drafting):**

> Using only the **gold evidence** snippets below, write a **concise, complete answer** to the question. Include exceptions. **Do not invent facts.**  
> Output JSON: `{"ideal_answer": "...", "citations": ["chunk_id1","chunk_id2"]}`

### Step 5 — Create **hard negatives**

Hard negatives simulate confusing but wrong evidence:

- From BM25/dense search on the question, keep top results **not in `gold_evidence`** but **lexically close** (same keywords).  
- Add **near‑miss sections** (e.g., refunds for *digital* vs *physical* products).  
- Include **obsolete** versions of the same doc if you support historical data; mark with `version` for later drift tests.

### Step 6 — Add **no‑answer** and **abstain** probes

- Generate questions whose answer is **not present** in the corpus (e.g., “30‑day refund on subscription plan” when only one‑time purchases are documented).  
- Label with `"no_answer": true` and an **ideal abstain message** template (e.g., “Não encontrei essa informação na nossa política atual…”).

### Step 7 — Multi‑hop items (chain evidence)

- Combine two related sections into a **requires=2** item (e.g., eligibility + exception).  
- Ensure each hop is **individually necessary**; avoid “bag of facts”.  
- Keep `multi_hop.hops` documenting why each chunk is needed.

### Step 8 — Automated validation

Run cheap checks before any human touches it:

- **Schema validation** (required keys present).  
- **Citation coverage**: every **entity/fact** in `ideal_answer` appears in at least one **gold** chunk (string/number/keyword match).  
- **Language check**: question ↔ answer language match.  
- **Toxicity/PII**: reject items with personal data.  
- **Length & style**: answers ≤ 120 words (configurable).

### Step 9 — LLM‑as‑judge acceptance (short & anchored)

Use a tiny judge to accept/reject items before human audit:

- **Groundedness:** “Every claim in the ideal answer is supported by the gold evidence.”  
- **Completeness:** “Mentions the relevant exceptions from the evidence.”  
- **Directness:** “Answers the question directly (no irrelevant info).”  
- **Style/Safety:** language correct; tone neutral; no policy violations.

Accept only if **all must‑pass** checks succeed and scalar scores ≥ thresholds (e.g., ≥4/5).

### Step 10 — Human spot‑check & calibration

- Randomly sample 5–10% per segment for **SME review**.  
- Compute **IAA** (agreement) and capture calibration data for the judge `(sensitivity, specificity)` (used later to bias‑correct true success).

### Step 11 — Deduplication & decontamination

- **Near‑dup detection:** MinHash/SimHash on normalized questions; drop clones or assign a **template_family_id**.  
- **Doc‑family groups:** questions derived from the **same section** share `group_id` so your **splits** don’t leak.  
- **Model decontamination (optional):** if you’ll train a retriever on this data, ensure the **generator**’s training data didn’t include the exact ideal answers; otherwise, prefer **document‑derived** answers not public Q/A dumps.

### Step 12 — Splits & versioning

- **Time‑aware:** Use `as_of` to separate *design/validation/test* by time windows (e.g., train ≤ 2025‑05‑01; val ≤ 2025‑06‑01; test > 2025‑06‑01).  
- **Group‑aware:** Split by `group_id` (doc/section family) and `template_family_id` (question family).  
- **Datasheet:** produce a `DATA_CARD.md` with corpus sources, topics, languages, counts, and known limitations.

---

## 4) Prompts you can copy/paste

### 4.1 Question generator (documents‑only)

```
You are generating user‑style questions grounded in the provided documentation chunk.

Constraints:
- Language = {{lang}} (e.g., pt-BR).
- Write 3 distinct questions with realistic noise (misspellings, abbreviations, synonyms).
- Each question must be answerable using this chunk alone OR this chunk plus at most ONE sibling section (state the hint).
- Do NOT invent facts.

Output (JSON array of objects): 
[{"question": "...", "needs_extra": false|true, "extra_section_hint": "..."}, ...]

CHUNK ({{chunk_id}}):
{{chunk_text}}
```

### 4.2 Answer drafter

```
Write a concise, complete answer using ONLY the evidence below. Include exceptions and keep the language {{lang}}.
Cite the evidence by its chunk IDs.

Output JSON:
{"ideal_answer":"...", "citations":["{{chunk_id1}}","{{chunk_id2}}"]}

EVIDENCE:
[{{chunk_id1}}] {{snippet1}}
[{{chunk_id2}}] {{snippet2}}
```

### 4.3 Acceptance judge (LLM‑as‑judge)

Short rubric → JSON (**must‑pass** + 1–5 scores). Keep deterministic (temperature=0).

- Must‑pass: *Groundedness=true*, *Schema=true*, *LanguageMatch=true*  
- Scores: *Completeness, Directness, Style/Safety* (1–5)

---

## 5) Building **hard negatives** systematically

Combine three strategies:

1. **Retrieval‑top distractors:** Take BM25/dense top‑50 for the question and keep the top 3–5 that **don’t** intersect `gold_evidence`.  
2. **Sibling confounders:** Different section of the same doc that **looks** similar (e.g., “refund for digital items”).  
3. **Temporal traps:** Prior versions of the same section where the rule was different (requires `version`).

Store them in `negatives`. In 7.3 we’ll show how to use them for **precision/nDCG** and **reranker** evaluation.

---

## 6) Multi‑lingual realism (pt‑BR, es‑AR, en)

For each query, optionally produce **paraphrases** in other supported languages **from the same evidence**. Track `language` and `origin_language` if you translate. To mimic reality:

- **Code‑switch** occasionally: “¿Puedo hacer refund después de 30 días?”  
- Normalize punctuation, dates, and currency in the **ideal_answer** to the target locale.  
- Ensure **gold evidence** is language‑appropriate; if docs are monolingual, translation is fine as long as facts match.

---

## 7) Safety & compliance

- No PII in questions or answers.  
- Use **red‑team prompts** to create **adversarial** but safe questions (e.g., legal threats, “what if I…”) grounded in policy docs; label them as `tags:["adversarial"]`.  
- For “no‑answer” items, include a **policy‑compliant refusal template** for your generator to emulate in 7.4.

---

## 8) Quality bar and acceptance checklist (print this)

- [ ] Schema passes; required fields present.  
- [ ] Evidence IDs are **valid**; every claim in `ideal_answer` appears in evidence.  
- [ ] Answer is **concise** (≤ 120 words or ≤ 8 bullets).  
- [ ] Language and locale are correct (dates, currency).  
- [ ] Contains **exceptions** if present in evidence.  
- [ ] Has **hard negatives** (≥2) for retrieval tests.  
- [ ] Not a near‑duplicate (template family unique within split).  
- [ ] Judge **must‑pass** checks succeed; scalar scores ≥ thresholds.  
- [ ] Human spot‑check passed (sampled).

---

## 9) Minimal code sketch (pseudocode / structure)

```python
# load chunks from your corpus
chunks = load_chunks()

# 1) generate question candidates per chunk
for ch in chunks:
    qs = question_generator(ch, lang="pt-BR")
    for q in qs:
        item = {
          "query_id": new_id(),
          "question": q["question"],
          "language": "pt-BR",
          "intent": infer_intent(ch, q),
          "as_of": ch.meta["version"],
          "gold_evidence": [ch.chunk_id] + sibling_hint_to_ids(q["extra_section_hint"]),
        }
        # 2) draft ideal answer from evidence
        item.update(draft_answer(item["gold_evidence"], item["language"]))
        # 3) mine hard negatives
        item["negatives"] = mine_negatives(item["question"], item["gold_evidence"])
        # 4) automated + judge checks
        if accept(item):
            write_jsonl(item, "dataset.jsonl")
```

Wire this into the evaluation repo you built in **6.3**.

---

## 10) Common pitfalls (and quick fixes)

- **Leakage via templates:** similar paraphrases in train/test. **Fix:** group by `template_family_id` and split by group.  
- **Gold evidence too narrow:** answer actually needs two chunks. **Fix:** encode multi‑hop explicitly and test both retriever and judge on it.  
- **Over‑optimistic answers:** drafter adds friendly fluff. **Fix:** acceptance judge penalizes non‑evidence claims; add a **strict JSON** rule.  
- **Outdated gold due to doc updates:** **Fix:** time‑aware splits using `as_of`; regenerate items from changed docs nightly.  
- **All easy queries:** great numbers, no insight. **Fix:** mix **hard negatives**, multi‑hop, and **no‑answer** probes; enforce distribution by `difficulty` in sampling.  
- **Language drift:** questions in pt‑BR, answers in en. **Fix:** automated language check + judge must‑pass.

---

## 11) Exercises

1. **Seed a mini‑dataset:** Produce 150 items from your help center (pt‑BR + es‑AR), with at least 30 multi‑hop and 20 no‑answer. Include 2+ hard negatives per item.  
2. **Quality gate:** Implement automated validation + acceptance judge. Sample 20 items for human review; compute agreement and note the most common rejections.  
3. **Drift test:** Update 10 docs (edit the “as_of” version). Regenerate affected items and observe how retrieval/generation metrics shift between versions.  
4. **Difficulty balancing:** Create an item bank with `easy/medium/hard`. Plot end‑to‑end true success by difficulty with CIs.  
5. **Segment robustness:** Duplicate 50 items in another language (es‑AR). Compare retrieval and groundedness gaps; write 3 hypotheses.

---

## Summary

A strong RAG evaluation starts with **good items**: realistic **questions**, **ideal answers** grounded in **gold evidence**, **hard negatives** to stress the system, and **metadata** to avoid leakage and handle drift. You now have a concrete schema, prompts, and a step‑by‑step workflow to synthesize, validate, and package such data. In **7.3** we’ll use this dataset to compute **retrieval metrics**, debug with **k‑sweep curves**, and expose the index/reranker/route quality as decision‑grade numbers.
