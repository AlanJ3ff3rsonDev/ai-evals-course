# Lesson 7.5 — Common Pitfalls (RAG Evaluation)

> **Continuity:** You now know how to build a RAG dataset (7.2), measure retrieval (7.3), and evaluate generation (7.4). This lesson turns battle scars into a checklist: the mistakes teams repeatedly make, how to *spot* them in the numbers, and how to *fix* them quickly. Keep this file open when you’re about to ship.

---

## Learning objectives

You will be able to:
- Recognize **data**, **retrieval**, **chunking**, **generation**, **judge**, and **CI** pitfalls specific to RAG.  
- Run **quick tests** that expose each pitfall in minutes.  
- Apply **concrete fixes** (prompts, metrics, and code patterns) and choose **long‑term safeguards**.

---

## 0) A mental model for pitfalls

Most failures trace back to mixing two things that should be **separate**:

1. **Selection vs. Evaluation** — you changed prompts/models **using** the same items/judges you later **report** with (double‑dipping).  
2. **Process vs. Outcome** — you optimized end‑to‑end answers without component diagnostics, so you can’t tell whether **retrieval** or **generation** is the bottleneck.

Everything below helps you separate those concerns.

---

## 1) Dataset & labeling pitfalls

### P1 — **Gold evidence is incomplete** (evaluation looks worse than users feel)
- **Symptom:** `Recall@5` seems low, but manual inspection shows useful evidence at rank 1–3.  
- **Why:** Your `gold_evidence` missed valid chunks (paraphrased or in sibling sections).  
- **Quick test:** Pool the top‑10 from **BM25 + dense**, judge 2/1/0 relevance; recompute **nDCG@5** vs. gold‑only Recall@5. If nDCG rises a lot, gold is incomplete.  
- **Fix fast:** Use **pooling** + relevance judge for precision/nDCG; keep Recall against gold as a **lower bound**.  
- **Long‑term:** Periodically expand gold via **active sampling** (focus on hardest misses).

### P2 — **Template leakage** (numbers great, generalization poor)
- **Symptom:** Test scores are high; real traffic regressions appear immediately.  
- **Why:** Train/val/test share the same **query template family** (“Can I get a refund…” paraphrases).  
- **Quick test:** Cluster questions by MinHash; compute metrics **by cluster**. If performance collapses for unseen clusters, you leaked.  
- **Fix fast:** Split by **template_family_id** and **doc/section group** (7.2).  
- **Long‑term:** Add **adversarial paraphrases** (code‑switching, typos) in the test set.

### P3 — **Time leakage** (cheating with future docs)
- **Symptom:** Offline metrics exceed production; **freshness** errors in logs.  
- **Why:** You computed metrics using docs **newer** than the label’s `as_of`.  
- **Quick test:** Filter retrieved chunks where `doc.version > query.as_of`; recompute.  
- **Fix fast:** Enforce time filter in retrieval; add **freshness metric** (§7.3).  
- **Long‑term:** Maintain time‑based splits and regenerate items when docs update.

### P4 — **Over‑synthetic dataset** (off‑distribution)
- **Symptom:** Great offline numbers; users ask different questions (tone/noise).  
- **Why:** All items are clean, templated, or single‑hop.  
- **Quick test:** Run on a **monitoring split** from real logs; compare segments.  
- **Fix fast:** Mix **log‑seeded** and **no‑answer**/multi‑hop items (7.2).  
- **Long‑term:** Keep a **weekly refresh** from production with PII‑safe redaction.

---

## 2) Retrieval & ranking pitfalls

### R1 — **Chasing Recall without Precision** (generator drowns in clutter)
- **Symptom:** `Recall@5` high but **groundedness** low; answers cite wrong chunks.  
- **Quick test:** Check `Precision@5` and `Distinct‑docs@5`.  
- **Fix fast:** Add a **cross‑encoder reranker**; bonus for **distinct docs**.  
- **Long‑term:** Tune `k_raw`→rerank→`k` and monitor **k‑sweep** curves.

### R2 — **Low MRR/nDCG with decent Recall@50** (evidence is buried)
- **Symptom:** Correct chunk appears at rank 12; generator ignores it.  
- **Quick test:** Compute **MRR@50**; inspect top‑10 vs. positions of gold.  
- **Fix fast:** Strengthen reranker; add **query expansion**; promote section headers in chunk text.  
- **Long‑term:** Learn a domain‑specific reranker on **graded relevance** labels.

### R3 — **Chunking splits key facts** (no single chunk is sufficient)
- **Symptom:** `Recall@5` low; Recall@doc is high; answers miss exceptions.  
- **Quick test:** Recompute with **doc‑level** gold. If doc‑level recall is fine, your chunker is at fault.  
- **Fix fast:** Increase chunk size or **overlap**; chunk by **headings + sentences**.  
- **Long‑term:** Maintain a **chunk‑ablation** suite; prefer **semantic** chunking around rule boundaries.

### R4 — **Router misroutes** (wrong corpus)
- **Symptom:** Topic‑specific queries fail (e.g., “boleto” routed to AR).  
- **Quick test:** Per‑source **coverage** and per‑source **Recall@5**.  
- **Fix fast:** Add high‑precision source keywords and a **fallback** to hybrid retrieval.  
- **Long‑term:** Train a lightweight **intent‑to‑source** classifier; keep **honeypots**.

### R5 — **Latency budgets ignored**
- **Symptom:** Great metrics; users wait.  
- **Quick test:** Report **median + p90 latency** with CIs; break down retrieve vs. rerank.  
- **Fix fast:** Cache; cap `k_raw`; prune heavy rerankers.  
- **Long‑term:** Establish **latency gates** next to quality gates.

---

## 3) Generation pitfalls

### G1 — **Answer without evidence** (hallucination despite good retrieval)
- **Symptom:** Fluent answers with **zero citations** or citations to wrong IDs.  
- **Quick test:** `citation_correctness` and `supported_claims_rate` (§7.4).  
- **Fix fast:** System rule: *“Every factual sentence must include a citation [id].”* Post‑process to enforce ID format.  
- **Long‑term:** Use a **citation tool** that inserts IDs from selected snippets.

### G2 — **Under‑answering (missing exceptions)**
- **Symptom:** High groundedness, low completeness.  
- **Quick test:** Compare completeness by `answer_type`.  
- **Fix fast:** Add an **“include exceptions if present”** anchor; show **ideal‑answer exemplars** per intent.  
- **Long‑term:** Keep exceptions **in the same chunk** via chunking policy; tune reranker for exception cues.

### G3 — **Over‑talking (verbosity bias)**
- **Symptom:** Longer answers score higher with some judges; users dislike it.  
- **Quick test:** Minimal‑pair probe (short vs. long).  
- **Fix fast:** Add **length budget**; judge penalizes non‑essential text.  
- **Long‑term:** Temperature=0; structured formats (bullets/JSON) for procedures.

### G4 — **Abstain failures on no‑answer items**
- **Symptom:** Confident but wrong claims where corpus lacks answers.  
- **Quick test:** Measure **false‑answer rate** on `no_answer=true`.  
- **Fix fast:** Add **evidence sufficiency** check and refusal template.  
- **Long‑term:** Teach “**search again or escalate**” behavior with a tool gate.

### G5 — **Locale & tone drift**
- **Symptom:** Correct facts, wrong language/tone.  
- **Quick test:** Judge **language_match** and style score per segment.  
- **Fix fast:** Pass `language/locale` explicitly; add a one‑liner brand tone.  
- **Long‑term:** Per‑locale exemplars and QA.

---

## 4) Judge & metric pitfalls

### J1 — **Evaluator coupling / double‑dipping**
- **Symptom:** You pick prompts/models using the same judge and items that give you the final number.  
- **Quick test:** Evaluate on a **judge‑disjoint** split (or use a different judge). Numbers often fall.  
- **Fix fast:** Keep **selection** and **evaluation** disjoint (different splits and/or judges).  
- **Long‑term:** Version your judges; run **A/B judge checks** monthly.

### J2 — **Non‑deterministic judges**
- **Symptom:** Re‑running evaluation changes scores.  
- **Quick test:** Repeat 5 times; compute variance.  
- **Fix fast:** Set **temperature=0**; cap max tokens; provide **digest** not full docs.  
- **Long‑term:** Snapshot judge prompts & model IDs; monitor **honeypots** for drift.

### J3 — **Uncalibrated pass rates (optimistic or pessimistic)**
- **Symptom:** Offline pass ≠ human perception.  
- **Quick test:** Label 200 queries; compute judge `(sensitivity, specificity)`.  
- **Fix fast:** Report **bias‑corrected true success** with CIs (§5.6–5.7).  
- **Long‑term:** Keep a small **human audit** each release.

### J4 — **Unit mismatch in CIs**
- **Symptom:** CIs look incredibly tight for thousands of items.  
- **Why:** You bootstrapped at **chunk/claim level** instead of **query** (or conversation).  
- **Fix fast:** Resample at the **correct unit** (query/conversation).

### J5 — **Single metric myopia**
- **Symptom:** Optimizing Recall@5 hides rising latency and falling precision.  
- **Fix:** Track **panels** (retrieval + generation + end‑to‑end) and **k‑sweep**; gate on **multiple** CI‑lower thresholds.

---

## 5) Security & safety pitfalls

### S1 — **Prompt‑injection via documents**
- **Symptom:** Evidence contains “ignore previous instructions” style text; model complies.  
- **Quick test:** Red‑team: add such strings to a few chunks; watch groundedness vs. safety.  
- **Fix fast:** Pre‑filter or neutralize instruction‑like phrases; add a **“evidence is not instructions”** guard in the system prompt.  
- **Long‑term:** Separate **instruction** vs **content** channels in the prompt.

### S2 — **PII leakage through citations**
- **Symptom:** Answer reproduces names/emails from evidence where it shouldn’t.  
- **Quick test:** PII detector on answers and evidence; judge **safety_pass**.  
- **Fix fast:** Mask PII in indexes; add rules for **PII‑redacted citations**.  
- **Long‑term:** Per‑field **allowlists/denylists** and audits.

### S3 — **Out‑of‑date or deprecated docs**
- **Symptom:** Correct per evidence but **wrong in the real world**.  
- **Quick test:** Track `doc.version`; alert when top‑k evidence is older than a threshold.  
- **Fix:** Weight retrieval by **recency** or enforce **version filters**.

---

## 6) Quick tests (15‑minute diagnostics)

1. **k‑sweep** for Recall/nDCG; look for knees and gaps.  
2. **Doc‑vs‑chunk recall** to spot chunking problems.  
3. **Hard‑negative drop**: insert distractors at ranks 1–3; measure nDCG drop.  
4. **Minimal‑pair verbosity** to test judge bias.  
5. **No‑answer pack**: false‑answer rate with CI.  
6. **Freshness filter** on `as_of`.  
7. **Judge stability**: run 5× at temperature=0; variance should be ≈0.  
8. **Segment heatmap**: topic × language; check CI‑lower bounds.

---

## 7) Fix patterns you can copy

- **Retrieval→Rerank→Diversity**: hybrid retriever; cross‑encoder rerank; distinct‑doc bonus.  
- **Chunking around rules**: headings + sentence windows; overlap 60–120 tokens; keep *rule + exceptions* together.  
- **Citation discipline**: square‑bracket IDs; post‑processor to **validate/normalize** IDs.  
- **Digest‑first judging**: compact evidence; JSON‑only outputs; versioned judges.  
- **True success**: bias‑correct observed pass; bootstrap by query; gate per **critical segments**.  
- **CI hooks**: one command runs retrieval/generation panels, outputs CIs and gates.

---

## 8) “Pitfall bingo” (print this)

- [ ] Gold evidence misses valid chunks (pooling not used).  
- [ ] Splits leak via template or doc family.  
- [ ] No `as_of` freshness filter.  
- [ ] Precision ignored; generator drowns.  
- [ ] Chunking separates rule & exceptions.  
- [ ] Router misroutes; no fallback.  
- [ ] Answers lack citations or IDs invalid.  
- [ ] Judges not pinned or uncalibrated.  
- [ ] CIs computed at wrong unit.  
- [ ] No no‑answer/abstain evaluation.  
- [ ] Latency/cost missing from the report.  
- [ ] No segment gates (Simpson’s paradox risk).

---

## 9) Minimal code guards

### 9.1 Freshness guard (Python)

```python
def fresh(retrieved, as_of):
    return [x for x in retrieved if x.doc_version <= as_of]
```

### 9.2 Distinct‑doc bonus (rerank post‑processing)

```python
def promote_diversity(ranked):
    seen = set()
    out = []
    for item in ranked:
        bonus = 0.2 if item.doc_id not in seen else 0.0
        out.append((item.score + bonus, item))
        seen.add(item.doc_id)
    return [i for _, i in sorted(out, key=lambda t: -t[0])]
```

### 9.3 Citation normalizer

```python
import re
def normalize_citations(text, valid_ids):
    ids = re.findall(r'\[([^\]]+)\]', text)
    fixed = [i for i in ids if i in valid_ids]
    # optionally replace bad IDs or append correct ones by alignment
    return text, len(fixed)/max(1,len(ids))
```

---

## 10) Exercises

1. **Pitfall hunt:** Run the **8 quick tests** above on your current system; list which pitfalls you see and rank them by impact.  
2. **Chunking repair:** For a weak topic (e.g., refunds), change chunk size/overlap; re‑index and show improvements in Recall@5 and Completeness with CIs.  
3. **Judge calibration:** Build a 200‑item human set; estimate `(s,t)` and recompute **true success**. Quantify the delta from raw pass rates.  
4. **Router audit:** For 100 queries, log chosen source vs. the source that contains gold. Compute **coverage** and **misroute rate**; fix with 3 features.  
5. **Abstain hardening:** Create a 50‑item no‑answer pack; reduce false‑answer rate to ≤2% by tuning prompts and evidence sufficiency heuristics.

---

## Summary

RAG failures cluster into six areas: **data**, **retrieval**, **chunking**, **generation**, **judges**, and **CI**. Each has fast **symptoms → tests → fixes** you can run today. Combine **pooling**, **k‑sweeps**, **doc‑vs‑chunk checks**, **citation discipline**, and **bias‑corrected true success** with **segment gates** and **freshness filters**. Do this, and your evaluation becomes a *safety net*—it tells you exactly where to improve and prevents silent regressions from reaching users.
