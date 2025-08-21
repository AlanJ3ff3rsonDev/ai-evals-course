# Lesson 8.5 — **Common Pitfalls** in Evaluating Specific Architectures & Data Modalities

> **Continuity:**  
> - **8.1** — you learned how to evaluate *tool calling*.  
> - **8.2** — you scaled to *agentic systems* and subgoals.  
> - **8.3** — you built a *debugging playbook*.  
> - **8.4** — you added *modality‑aware* metrics for images, tables, and audio.  
> - **8.5** — this class ties it all together by showing the **most frequent ways evaluations mislead teams** and how to **detect & fix** them before they hurt real users.

Our goal is a *practical radar*: spot red flags early, prove the root cause fast, and ship narrow fixes with strong gates.

---

## Learning Objectives

After this class you will be able to:
1. Recognize **measurement traps** (automation bias, leaky splits, noisy labels, Simpson’s paradox, premature aggregation).  
2. Avoid **dataset pitfalls** (non‑representative items, stale data, missing locale coverage, contamination with train corpora).  
3. Prevent **pipeline‑specific pitfalls** in **RAG**, **tool calling**, and **agents** (looping, over‑calling, grounding drift).  
4. Add **early‑warning signals** and **CI gates** that catch regressions reliably.  
5. Use **anti‑patterns → countermeasures** checklists to harden practice across your team.

---

## 1) Measurement Traps (how good teams fool themselves)

### 1.1 Automation bias with LLM‑as‑judge
**Symptom:** candidate looks great on automated scores, but user complaints increase.  
**Root cause:** judge prompt allows *style* to mask *substance*, or judge is too lenient on hallucinations.

**Countermeasures**
- **Calibration** (Lesson 5.6): estimate judge *sensitivity/specificity* on a stratified human set; publish **true success** with CIs.  
- Add **adversarial items** (honeypots) that tempt stylish wrong answers.  
- Make judges **short & JSON‑only**; forbid quoting long rationales (they hide inconsistency).

### 1.2 Weak inter‑annotator agreement (IAA)
**Symptom:** human labels disagree often; improvements are statistically meaningless.  
**Fix:** run **adjudication sessions** (Lesson 4) and publish **Cohen’s/Fleiss’ κ**; freeze a **labeling guide** with examples and non‑examples; **relabel** ambiguous items or mark as “unscorable”.

### 1.3 Simpson’s paradox & premature aggregation
**Symptom:** overall success ↑, but **pt‑BR** or **es‑AR** users suffer.  
**Fix:** always slice by **task type × locale × difficulty**; report **per‑slice CIs**; add release gates on **worst slice** not just overall.

### 1.4 POI metrics (Pretty On the Internet)
**Symptom:** dashboards show decimals with 0.1% swings; leadership overfits to noise.  
**Fix:** show **CIs**; use **min detectable effect** and **power** calculations; freeze reporting cadence (e.g., weekly), not minute‑by‑minute.

### 1.5 Invalid “ground truth”
**Symptom:** model “fails” because the gold label is wrong or incomplete (common in business docs & ASR).  
**Fix:** maintain a **gold‑error queue**; when model output is plausible but graded wrong, send to **gold‑fix workflow**; track **gold‑error rate** and show guardrails on metrics (“observed success may be understated by X%”).

### 1.6 Contamination
**Symptom:** surprisingly high scores on a subset (e.g., public benchmarks).  
**Fix:** rotate **private, purpose‑built** sets; enforce **domain splits by entity/time** (customer, merchant, date); check for n‑gram overlaps (see code below).

```python
# Quick overlap check (n-grams) to flag potential contamination
def overlap_score(corpus_a, corpus_b, n=13):
    from collections import Counter
    def ngrams(s):
        toks = s.split()
        return Counter([" ".join(toks[i:i+n]) for i in range(len(toks)-n+1)])
    A = Counter()
    for t in corpus_a: A += ngrams(t)
    B = Counter()
    for t in corpus_b: B += ngrams(t)
    shared = sum((A & B).values())
    total = max(1, sum(A.values()))
    return shared / total
```

---

## 2) Dataset Pitfalls (garbage in → confident garbage out)

### 2.1 Non‑representative sampling
- **Anti‑pattern:** only “clean” invoices or short audios; ignores low‑end phones or long‑form calls.  
- **Countermeasure:** build a **coverage grid** (device, scan quality, doc layout, accent, table width, language) and **quota sample** each cell.

### 2.2 Locale & currency mismatch
- **Anti‑pattern:** evaluating BR tasks with US number/date rules.  
- **Countermeasure:** normalize numbers/dates (Lesson 8.4), and **tag every item** with `locale` and `currency`. Add a **decimal‑comma** slice gate.

### 2.3 Staleness & concept drift
- **Anti‑pattern:** using 2023 policy docs to grade 2025 answers.  
- **Countermeasure:** add `as_of` to every task; rerun evals with **time windows**; create **freshness suites**.

### 2.4 Leakage across splits
- **Anti‑pattern:** splitting rows randomly when multiple rows refer to the **same entity** (merchant, patient, contract).  
- **Countermeasure:** **Group‑by‑entity** splits; for RAG, **document family splits** (same policy version family).

### 2.5 Insufficient long‑tail
- **Anti‑pattern:** 90% of items are common templates; rare templates fail in prod.  
- **Countermeasure:** maintain a **long‑tail catalog**; oversample rare types in test sets; report **per‑template** metrics.

---

## 3) RAG‑Specific Pitfalls

### 3.1 Retrieval feels “okay” but is actually leaky
- **Symptom:** answers are correct but **unsupported**; citations drift to irrelevant chunks.  
- **Diagnosis:** **Grounding precision** low; **rank@k** looks fine only because gold chunk overlaps many irrelevant tokens.  
- **Fix:** use **nuggetized** relevance or **atomic facts** as gold; measure **support precision/recall**; penalize **uncited claims**.

### 3.2 Reranker masked by over‑broad chunks
- **Symptom:** reranker shows high gains offline; end‑to‑end quality unchanged.  
- **Fix:** reduce chunk sizes; increase overlap only if necessary; evaluate **answer‑bearing token recall**, not just chunk recall.

### 3.3 Freshness & version skew
- **Symptom:** model quotes a future policy version.  
- **Fix:** enforce `doc.version ≤ task.as_of`; add a **freshness gate** and **time‑boxed indexes**.

### 3.4 Query drift and prompt injection via docs
- **Symptom:** doc text contains adversarial instructions; agent executes unintended action.  
- **Fix:** **sanitize** retrieval results (strip instructions), use **content‑only** channels, and **grounding judges** that forbid following doc‑embedded commands.

---

## 4) Tool‑Calling Pitfalls (Lesson 8.1, extended)

### 4.1 Opportunistic tool calls
- **Symptom:** model calls tools “just in case” → latency & cost bloat.  
- **Fix:** add a **necessity judge** + training examples *not* calling tools when the answer is directly available; gate on **over‑call rate**.

### 4.2 Silent tool failures
- **Symptom:** API returns partial JSON; model proceeds as if success.  
- **Fix:** strict **schema validation**; **status propagation** (a failed step blocks final success); retry/backoff policies.

### 4.3 Non‑idempotent or unsafe tools
- **Symptom:** evaluations mutate prod resources.  
- **Fix:** sandbox **fixtures**; dry‑run mode; allowlist tools in eval; policy judge on **intended side‑effects**.

### 4.4 Argument drift
- **Symptom:** correct tool, wrong field names/casing.  
- **Fix:** **arg canonicalization**; publish a **tool schema card**; add a judge for **argument fidelity** with explicit error messages.

---

## 5) Agentic Pitfalls (Lesson 8.2, extended)

### 5.1 Looping without progress
- **Signal:** high **cycle rate**, repeated actions.  
- **Fix:** **progress functions**, loop breakers, and **reflection cadence** (every N steps).

### 5.2 Over‑planning vs under‑acting
- **Signal:** high plan score, low subgoal completion.  
- **Fix:** smaller subgoals, act‑then‑check, cap planning tokens.

### 5.3 Coordination overhead (multi‑agent chatter)
- **Signal:** many messages with low **information gain**.  
- **Fix:** appoint a **moderator**; rule “call only when adding new evidence”; track **info‑gain per message**.

### 5.4 Stale state & memory leaks
- **Signal:** agent reuses old context or overwrites variables.  
- **Fix:** versioned state; explicit **state snapshots**; checksum comparisons between steps.

---

## 6) Modality‑Specific Pitfalls (from 8.4)

### Images/Docs
- **Wrong region, right value** → add **IoU≥0.5** requirement, penalize uncited answers.  
- **Two currencies on page** → detect currency near the field; enforce **locale‑aware parsing**.  
- **OCR drift** after engine upgrade → keep an **OCR subset** with WER/CER gates.

### Tables
- **Decimal‑comma confusion** → normalize + unit tests; add **locale slice gate**.  
- **Order‑dependent results** → enforce explicit ordering in SQL; test shuffle invariance.  
- **Weighted vs unweighted averages** → plan judge with operator templates.

### Audio
- **Code‑switching drop** → ASR lexicon/biasing; add a **code‑switching slice**.  
- **Hallucinated summaries** → **fidelity judge** with calibration; require **quote+timestamp** for critical facts.

---

## 7) Early‑Warning Signals (cheap, fast, predictive)

- **Loop episodes/task** (agents)  
- **Over‑call rate** and **necessity precision** (tools)  
- **Grounding precision** and **hallucination rate** (RAG)  
- **OCR WER / ASR WER** on dedicated subsets  
- **Worst‑slice success (CI lower)** across locale × task type  
- **Cost & latency budgets** vs **caps**

Add these to a small **“pre‑merge” test** so you fail fast before long runs.

---

## 8) Pitfall Radar — Symptom → Likely Root Cause → Quick Test → Fix

| Symptom | Likely root cause | Quick test | Fix pattern |
|---|---|---|---|
| Overall ↑, pt‑BR ↓ | Simpson’s paradox | Slice report with CIs | Per‑slice gates, targeted data |
| Great judge score, bad prod | Judge bias | Calibrate vs human; adversarial set | Use **true success**, refine judge |
| Correct value, wrong cite | Grounding drift | IoU check; support judge | Require cites; penalize uncited |
| Latency ↑  | Over‑calling | Necessity judge; count calls | Prompt rule; gate over‑call rate |
| Loops | No progress test | Graph metrics: cycle rate | Progress function; loop breaker |
| Table math wrong | Operator mismatch | Reasoning judge | Operator templates; plan‑then‑code |
| Future policy cited | Freshness leak | Check `doc.version > as_of` | Time‑boxed index; freshness gate |
| ASR good, summary wrong | Hallucination | Fidelity judge | Require quotes & timestamps |

---

## 9) CI Gates (sample; tune to your risk)

```
Global:
- Worst-slice true success (CI lower) ≥ 0.78
- Hallucination incidents = 0 (hard gate)

RAG:
- Grounded true success ≥ 0.85
- Freshness violations = 0
- Uncited-claim rate ≤ 0.03

Tool Calling:
- Action correctness ≥ 0.92 ; over-call rate ≤ 0.08
- Execution success ≥ 0.97 ; unsafe tool calls = 0

Agents:
- Loop episodes (median) ≤ 0 ; steps_used ≤ 0.8 * max_steps
- Subgoal completion ≥ 0.90

Modality subsets:
- OCR WER ≤ 0.08 ; ASR WER ≤ 0.12 telephone-band
- Locale (decimal comma) success ≥ 0.95
```

Add a **canary** plan: ship behind a flag to 5–10% traffic, monitor **early‑warnings**, and roll back on breach.

---

## 10) Minimal Code: Determinism & Slice Guard

```python
import random, numpy as np

def set_seed(seed=7):
    random.seed(seed); np.random.seed(seed)

def worst_slice_ci_lower(results_by_slice):
    # results_by_slice: {slice_name: [0/1 outcomes]}
    import math
    def ci_lower(p, n):
        # Wilson lower bound 95%
        if n==0: return 0.0
        z=1.96; denom=1+z*z/n
        center=p + z*z/(2*n)
        margin=z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))
        return (center - margin)/denom
    lows={}
    for s, xs in results_by_slice.items():
        p=sum(xs)/max(1,len(xs)); lows[s]=ci_lower(p,len(xs))
    worst=min(lows, key=lows.get)
    return worst, lows[worst], lows

# Example usage:
# worst, lb, all_bounds = worst_slice_ci_lower({"pt-BR":[1,1,0,1], "es-AR":[1,0,0,1]})
```

---

## 11) Exercises

1. **Pitfall Triage:** Take your current evals and tag the last 100 failures with the taxonomy from 8.3. Produce a **Pareto** chart of top causes.  
2. **Judge Calibration:** Build a 300‑item human set (balanced by locale and task type). Compute **sensitivity/specificity** for your end‑to‑end judge and report **true success** with CIs.  
3. **Leakage Audit:** Implement the **n‑gram overlap** check between your train corpus and test items; propose group splits to eliminate leakage.  
4. **Early‑Warning Dashboard:** Implement 5 signals (loops, over‑calls, grounding precision, WER, worst‑slice CI). Add **pre‑merge** thresholds.  
5. **Canary Plan:** Define a flag rollout and rollback policy for your next agent release; list **stop conditions** and success metrics.

---

## Summary

Most evaluation failures are **predictable**: biased judges, leaky datasets, missing slices, and agent/tool quirks. The cure is **discipline**: calibrated judges, stratified sets, leakage‑proof splits, modality‑aware metrics, early‑warning signals, and CI gates centered on **true success** and **worst slices**. With this radar and the countermeasures above, your team can move fast **without** breaking users.

> Next: **8.6 — Summary** of the chapter, where we condense tool‑calling, agentic, debugging, modality metrics, and pitfalls into a one‑page operating procedure you can adopt in your org.
