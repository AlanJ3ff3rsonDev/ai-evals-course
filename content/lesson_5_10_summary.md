# Lesson 5.10 — Chapter 5 Summary & One‑Page Playbook (Implementing Automated Evaluators)

> **Where we are:** You just finished Chapter 5, the heart of this course: turning “we should evaluate” into a **repeatable system** that engineers and PMs can trust for decisions.  
> **Previously (5.1 → 5.9):** You learned how to define metrics, implement them, design and validate **LLM‑as‑judge**, correct for **imperfect judges**, evaluate **groups** of outputs, and avoid the most common pitfalls.  
> **This lesson:** A concise but **extremely didactic** synthesis. You’ll get a **one‑page playbook**, concrete **templates**, a **runbook** you can paste into your repo, and a short **practice plan** to cement the habits.

---

## A. The mental model (zoomed‑out)

Automated evaluation is a **product**. It has users (engineers, PMs, reviewers), a tight feedback loop, and versioned artifacts. Treat it like shipping a feature:

1. **Define success (5.1).** Start with the user outcome: safety, faithfulness, helpfulness, task success. Turn each into a crisp metric (pass/fail or 1–5 with anchors).  
2. **Implement metrics (5.2).** Build a harness that loads traces, runs metrics/judges, aggregates, and exports artifacts (JSON/CSV/plots). Keep metrics **pure** and deterministic where possible.  
3. **Design the judge (5.3).** When metrics are subjective, use **LLM‑as‑judge** with a short, anchored rubric and strict JSON output.  
4. **Protect with data splits (5.4).** Use **group‑aware, stratified** splits for design, calibration, validation, test, and monitoring. Freeze validation/test.  
5. **Iterate scientifically (5.5).** Small edits tied to hypotheses; pick winners on **frozen** validation with CIs; confirm once on test; version everything.  
6. **Correct the measurement (5.6–5.7).** Calibrate judge **sensitivity**/**specificity**; compute **bias‑corrected true success** with CIs; segment‑aware and weighted.  
7. **Evaluate sets, not just items (5.8).** For sampling/beam/RAG, compute **Any‑pass**, **Best‑score**, **nDCG**, and **diversity**; bootstrap **by group**. Separate selector vs evaluator.  
8. **Avoid traps (5.9).** Kill leakage, double‑dipping, verbosity bias, missing CIs, and drift with honeypots, probes, and versioning.  
9. **Ship with gates (Chapter 9 preview).** Add CI checks and online monitors so regressions can’t sneak in.

The theme: **Measurement you can stake a release on.**

---

## B. One‑page playbook

> Print this. Put it at the top of your repo.

### 1) Inputs

- **Traces** (`input`, `context/evidence`, `output`, `meta`)
- **Gold labels or references** (where available)
- **Segments** (country, language, channel, difficulty, customer type)
- **Group id** (thread/doc/user) for leakage protection

### 2) Metrics & judges

- **Must‑pass checklists** (schemas, safety, policy) → binary
- **Scalar rubrics** (faithfulness, helpfulness, tone) → 1–5 anchored
- **LLM‑as‑judge** (short prompt + JSON schema + 1 example)

### 3) Datasets (roles)

- **Design** (read freely; never report)  
- **Calibration** (estimate `(s,t)`; set thresholds; honeypots)  
- **Validation** (select among judge prompts)  
- **Test** (single use before adoption)  
- **Monitoring** (sample from prod weekly)

### 4) Decisions

- **Adopt a judge** if it beats baseline on validation with **CI separation**; confirm once on test.  
- **Ship a model** only if **CI‑lower(true success) ≥ target** across **critical segments**.

### 5) Outputs you must persist (versioned)

- `judge_prompt_id`, `judge_model_id`, `params` (temp, top‑p, max tokens)  
- Dataset snapshot id + split seed + group key + strat axes  
- Calibration matrix `(tp, fp, fn, tn)` per segment  
- Report tables with **means + CIs**, **segment heatmap**, **cost/latency**, and **raw trace links**

---

## C. The lifecycle (as a checklist)

1. **Write the rubric** (5.1, 5.3)  
   - One JSON schema + 4–8 short criteria with anchors.  
   - Include **positive refusal** and **conciseness** anchors.  
   - Add a minimal positive and negative example.  
2. **Implement harness** (5.2)  
   - Pure functions; deterministic seeds; isolate external calls.  
   - From a single CLI: `python eval.py --split validation --judge v1`  
3. **Split the data** (5.4)  
   - `group_id` chosen; **no leakage**; **stratified** by key segments.  
   - Report per‑split distributions.  
4. **Iterate the judge** (5.5)  
   - Hypothesis → small edit → 2–5 variants → validate with CIs → pick one.  
   - Bias probes: verbosity, position, style, refusal, language.  
5. **Calibrate & correct** (5.6–5.7)  
   - Estimate `(s,t)` on calibration; compute **true success** with bootstrap CI.  
   - Report **segment‑weighted** overall.  
6. **Evaluate groups** (5.8)  
   - Any‑pass, Best‑score, nDCG, diversity; bootstrap by **group**.  
   - Separate **selector** and **evaluator**.  
7. **Pitfall audit** (5.9)  
   - Run the pre‑flight list (honeypots, swap tests, drift).  
8. **Decide & ship**  
   - Gate on **CI‑lower ≥ target** per critical segment.  
   - Freeze versions; create monitoring canaries.

---

## D. Templates (copy/paste)

### D1. Judge skeleton (prompt)

```
You are an impartial evaluator. Read the INPUT and CANDIDATE. 
Follow the rubric and output ONLY valid JSON.

RUBRIC (score each 1–5; use anchors):
- Faithfulness: 1=contradicts evidence or fabricates; 3=mostly grounded with minor unsupported claims; 5=all claims traceable to evidence IDs.
- Helpfulness: 1=does not address task; 3=partially helpful; 5=fully addresses task with next steps.
- Tone & Professionalism: 1=inappropriate; 3=neutral; 5=clear, respectful, on-brand.
- Conciseness: 1=rambling; 3=some redundancy; 5=concise; do NOT reward length.
MUST-PASS CHECKS (true/false): safety_policy, schema_valid, positive_refusal_if_applicable.

JSON SCHEMA:
{ "scores": {"faithfulness": int, "helpfulness": int, "tone": int, "conciseness": int},
  "checks": {"safety_policy": bool, "schema_valid": bool, "positive_refusal": bool},
  "overall_pass": bool,
  "notes": "one or two short sentences" }

Return only JSON.
```

### D2. Judge JSON example

```json
{
  "scores": {"faithfulness": 5, "helpfulness": 4, "tone": 5, "conciseness": 4},
  "checks": {"safety_policy": true, "schema_valid": true, "positive_refusal": false},
  "overall_pass": true,
  "notes": "Grounded in evidence 12, 14; concise; polite."
}
```

### D3. Split recipe (YAML sketch)

```yaml
split:
  group_key: thread_id
  stratify_by: [country, channel, language]
  ratios: {design: 0.5, calibration: 0.2, validation: 0.2, test: 0.1}
  seed: 7
  constraints:
    min_per_cell_validation: 20
```

### D4. Release gate (pseudocode)

```python
mean, lo, hi = true_success(K,N,calib)   # from 5.7 module
ok_segments = all(lo_g >= target_g for g,(m,lo,hi) in segments.items())
ship = (lo >= TARGET_OVERALL) and ok_segments
```

### D5. Group‑wise report table (columns)

```
metric | mean | 95% CI lo | 95% CI hi | BR mean | AR mean | WhatsApp mean | Email mean | cost/tokens | latency_ms
```

---

## E. “Why each piece exists” (mini‑rationale)

- **Anchored rubrics** keep subjective judgments stable across time and people.  
- **Group‑aware splits** break real‑world correlation (same thread/doc) so your numbers generalize.  
- **Calibration and correction** convert “judge said pass” into an estimate of what **humans would say**.  
- **Group metrics** mirror real UX: users (or selectors) see **options**.  
- **Bias probes** are smoke alarms; they fail fast and cheaply.  
- **CIs and gates** prevent chasing noise and shipping regressions.  
- **Versioning** is the black box recorder—you can always reconstruct “what changed.”

---

## F. Worked micro‑example (end‑to‑end in 10 bullets)

1. Sample 2,000 traces; tag `thread_id`, `country`, `channel`.  
2. Split with `group_key=thread_id`, stratify by `{country, channel}` into design/val/test/calib.  
3. Write a judge with the skeleton above; produce JSON; add 1 positive, 1 negative exemplar.  
4. Iterate v1→v2 on **validation**; choose a winner with **CI separation**; confirm on **test** once.  
5. On calibration (n≈500), compute `(tp,fp,fn,tn)`; estimate `(s,t)`.  
6. On evaluation (n≈1,000), measure observed pass `q`.  
7. Correct to **true success** with bootstrap CI; compute per‑segment numbers and a weighted overall.  
8. For n‑sampling=3, compute **Any‑pass** and **Best‑score** with group bootstrap; add **distinct‑2**.  
9. Run **bias probes**; pass swap tests; confirm honeypots stable.  
10. Ship if **CI‑lower ≥ target** overall **and** in BR, AR, WhatsApp, Email; version everything; start monitoring.

---

## G. What to automate next (roadmap toward Chapter 9)

- **CLI + Makefile** so `make eval` runs the whole pipeline locally and in CI.  
- **Artifacts** pushed to a **metrics registry** (S3 + static HTML) with a stable URL.  
- **Weekly canaries**: sample prod traces; compute judge‑vs‑human agreement on 100 items; alert on drift.  
- **Cost dashboard** to track tokens and latency alongside quality.  
- **Ablation notebook** template (model, prompt, retrieval, judge) to explain which component moved the number.

---

## H. Practice plan (45–90 minutes, repeat weekly)

1. Pick one task (e.g., “first message in collections”).  
2. Create or refresh your **calibration set** (200–500 items).  
3. Run the judge once per week on a **fresh monitoring sample**; compare to 30 human labels; track agreement and drift.  
4. Do **one** targeted judge edit tied to a named hypothesis; validate on the **same** frozen validation set.  
5. If accepted, update the version and re‑baseline monitoring thresholds.

---

## I. Chapter 5 → Chapter 6 (what changes for multi‑turn)

- **Unit of evaluation** becomes a **conversation**, not a single message; the **group id is the thread**.  
- New metrics add **turn‑taking**, **constraint tracking**, and **long‑horizon coherence**.  
- Judges must parse **multiple turns** and **state**; you’ll often mix **tool traces** with text.  
- But the core scaffolding **doesn’t change**: splits, iteration, calibration, CIs, group bootstrap, and drift monitors still apply.

---

## Exercises

1. **Paste the playbook** into your repo’s `README_eval.md`. Replace placeholders with your project names.  
2. **Create your v1 judge** by instantiating D1 and D2 for one task. Keep it under 12 rubric lines.  
3. **Run an end‑to‑end dry run** on a small sample (N=200): splitting → judge run → correction → group metrics → report.  
4. **Hold a 30‑minute pitfall audit** (5.9). Use the pre‑flight checklist and fix anything red.  
5. **Design your CI gate** (thresholds & segments). Write the pseudocode from D4 into your harness and test a failing and passing case.

---

## Final takeaway (sticky message)

> **Treat evaluation like a product.** Give it customers, versioning, a roadmap, and guardrails.  
> When your **judges** are clear and calibrated, your **splits** block leakage, your **CIs** gate releases, and your **group metrics** mirror real UX, you get a reliable truth meter for LLM development. Build it once—then trust it every week.

---

### Appendix — Minimal file tree for your eval repo

```
/eval/
  README_eval.md                 # paste this playbook
  data/                          # frozen snapshots
  splits/                        # split manifests with seed & strata
  judges/
    judge_v1.txt                 # prompt text
    judge_v1.schema.json         # JSON schema
  harness/
    eval.py                      # CLI: run metrics/judges and aggregate
    true_success.py              # from Lesson 5.7
    groupwise_eval.py            # from Lesson 5.8
  reports/
    2025-08-09_modelA_v12.html   # date-stamped artifacts
```

---

That’s Chapter 5 in your toolkit. Next up we’ll start **Chapter 6 — Evaluating Multi‑Turn Conversations**, where we extend everything you’ve built to dialogues and long‑horizon tasks.
