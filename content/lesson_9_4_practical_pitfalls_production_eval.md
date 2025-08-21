# Lesson 9.4 — **Practical Considerations & Common Pitfalls for Production LLM Evaluation**

> **Continuity with the course:**  
> - In **9.1**, we built CI gates to prevent regressions.  
> - In **9.2**, we shipped safely with CD and online monitoring.  
> - In **9.3**, we turned signal → fixes with a weekly **improvement flywheel**.  
> - **9.4** is about the *messy reality*: what tends to break in production LLM evaluation and how to design your system and habits so problems are caught early and cheaply.

This lesson is intentionally pragmatic: examples, checklists, and “gotchas” that senior teams learn the hard way—so you don’t have to.

---

## Learning Objectives

By the end, you will be able to:
1. Recognize **failure patterns** that create false confidence or slow teams down.  
2. Design **defenses**: dataset governance, metric calibration, slice analysis, and reproducibility.  
3. Keep your CI/CD and monitoring **stable** (low flake rate) while still catching real issues.  
4. Avoid **overfitting to evals** and keep a healthy **offline ⇄ online** link.  
5. Run **safe experiments** under budget, latency, and compliance constraints.

---

## 1) First Principles for Production Eval

1. **Version everything.** Model, prompt, retrieval index, tools, judges, datasets, and metric code must be addressable by version or hash. If you can’t recreate a number, it’s not real.  
2. **Prefer execution‑based truth** when available (e.g., code tests, math answers, database constraints). Use judges for semantics and nuance, but *calibrate* them.  
3. **Slicing beats averaging.** Always view metrics by locale, persona, difficulty, and input modality. Averages hide harm.  
4. **Determinism where it matters.** Seed sampling, fixed test sets, pinned dependencies; accept *bounded* nondeterminism only where the signal gain is worth it.  
5. **Small batches ship faster.** Big quarterly evals create drift; frequent CI and tiny canaries keep the system warm.  
6. **Cost/latency are product features.** Track them with the same seriousness as correctness.

---

## 2) Dataset Pitfalls (and Defenses)

### Pitfall A — **Label Leakage & Memorization**
- **What happens:** Your eval data appears in pretraining or your own knowledge base, inflating scores.  
- **Defenses:**  
  - Deduplicate against the index and training corpora (e.g., MinHash or SimHash).  
  - Avoid public benchmarks as your sole CI gates; synthesize **application‑specific** sets.  
  - Rotate **debug sets**: add failing traces every week; retire stale ones.

### Pitfall B — **Non‑stationarity**
- **What happens:** The task distribution shifts (e.g., a new policy or market). Offline scores look fine; online tanks.  
- **Defenses:**  
  - Track **input drift** (e.g., PSI/KL) on tokens, entities, and intents.  
  - Maintain **freshness‑sensitive suites** (e.g., “as‑of” questions).  
  - Re‑sample quarterly using *recent* production traces (with PII scrubbing).

### Pitfall C — **Sampling Bias**
- **What happens:** Eval set over‑represents easy questions or a single country; metrics mislead.  
- **Defenses:**  
  - Stratify by **slice keys** and enforce quotas.  
  - Publish the **sampling recipe** next to the dataset (so it can be re‑run).  
  - Track **worst‑slice** score; make it a gate, not just the average.

### Pitfall D — **Inconsistent Labels**
- **What happens:** Labelers disagree; your CI flakes.  
- **Defenses:**  
  - Measure **IAA (Inter‑Annotator Agreement)** and use **adjudication**.  
  - Give labelers **rubrics** with positive *and* negative examples.  
  - Periodically **relabel** a 5–10% sample to detect guideline drift.

> **Tip:** Keep a `DATASET_CARD.md` with: purpose, sampling recipe, slices, labeling rubric, IAA, known limitations, and change log.

---

## 3) Metric & Judge Pitfalls

### Pitfall E — **Uncalibrated LLM‑as‑Judge**
- **Symptom:** The judge likes certain phrasings; a harmless prompt change swings CI.  
- **Defenses:**  
  - Calibrate against **human gold** (e.g., 300 items). Record **sensitivity/specificity**.  
  - Use **paired, blinded prompts** (hide model identity).  
  - Bound judge influence: final score = `α * execution_metric + (1-α) * judge_score` where possible.  
  - Re‑estimate judge accuracy **after major model upgrades**.

### Pitfall F — **Threshold Gaming**
- **Symptom:** Teams optimize to a numeric threshold rather than user value.  
- **Defenses:**  
  - Monitor multiple metrics: **true success**, **grounding**, **safety**, **latency**, **cost**.  
  - Use **confidence intervals** (CI lower bounds) rather than raw means.  
  - Require **no‑harm guardrails**: *“Lift ≥ +1.0, with ≤ 2% degradation on any safety slice.”*

### Pitfall G — **Mismatch of Metric to Task**
- **Symptom:** BLEU/ROUGE on tasks where semantics matter; or only judge scores for verifiable answers.  
- **Defenses:** Prefer **task‑appropriate** metrics (exact‑match, programmatic checks, citation coverage).

---

## 4) CI/CD Pitfalls

### Pitfall H — **Flaky Gates**
- **Causes:** Small test sets, random sampling, nondeterministic judges.  
- **Defenses:**  
  - Fix the set size (e.g., n≥400 per gate) and seed the sampler.  
  - Use **Wilson** or **Jeffreys** intervals; gate on **lower bound**.  
  - Run judges with **temperature=0** and retry-on-timeout.

### Pitfall I — **Overfitting to the Eval**
- **Causes:** Prompt tweaks learned from the CI set permeate the model; generalization stalls.  
- **Defenses:**  
  - Maintain **holdout suites** that the team cannot see; rotate ownership.  
  - Track **gap**: CI vs. canary. If widening, your eval is stale.  
  - Keep **red‑team suites** that evolve monthly.

### Pitfall J — **Ratchet Too Fast**
- **Symptom:** Gates block development; people bypass the process.  
- **Defenses:**  
  - Raise one gate at a time; prove **two weeks of stability** (9.3).  
  - Publish a **back‑off policy**.

---

## 5) Monitoring Pitfalls

### Pitfall K — **Proxy Drift**
- **Symptom:** Online **proxy** (thumbs up rate) moves while true success does not—or vice versa.  
- **Defenses:**  
  - Maintain **calibration curves** mapping proxy → true success; refresh monthly.  
  - Audit proxy spam/selection bias (bots, new traffic mix).

### Pitfall L — **Blind Spots**
- **Symptom:** Incidents not predicted by any tracked metric (e.g., tool abuse or data exfiltration).  
- **Defenses:**  
  - Add **event logs** for tool calls and citations; build **rule alerts** (regex/heuristics).  
  - Quarterly **threat modeling** and **red‑team** exercises.

### Pitfall M — **Silent Cost/Latency Regressions**
- **Defenses:**  
  - Per‑stage timers and **p50/p95/p99** with budgets; alert on ratio to baseline.  
  - Tag costs by **workflow/slice**; watch **cost per solved case**.

---

## 6) RAG‑Specific Pitfalls

1. **Stale Index** → stale answers. *Defense:* TTL + nightly recrawl + **as‑of** prompts; track **index_age_p95**.  
2. **Citation Mismatch**: citations exist but don’t support the claim. *Defense:* **evidence verification** (judge checks if quoted span includes answer).  
3. **Distractor Chunks**: top‑k retrieval returns off‑topic pages. *Defense:* **reranking** + nuggetization; increase chunk overlap; penalize non‑supported spans.  
4. **Query Drift**: user slang/locale not captured. *Defense:* **query rewrite** with locale hints; add synonyms from search logs.  
5. **Over‑grounding**: model refuses to answer when docs are missing but the answer is generic/harm‑free. *Defense:* bend the **abstain** rule for whitelisted FAQ templates.

---

## 7) Agent & Tool‑Calling Pitfalls

- **Looping/Thrashing**: set **step caps**, penalize repeated tool use, and add a **stop‑when‑AC‑met** check.  
- **Schema Mismatches**: ensure **JSON schema** with examples; add **contract tests** for tool arguments.  
- **Partial Failures**: tool returns partial data → wrong answer. Validate **post‑conditions** (e.g., totals sum to 100%).  
- **External limits**: rate limits/timeouts. Add **circuit breakers**, **backoff**, and **safe fallback** responses.  
- **Clock/Locale bugs**: dates, decimal commas, time zones. Add **locale‑aware format tests** to CI.

---

## 8) Reproducibility & Governance

- **Run manifests**: Store `manifest.json` per eval run with versions of model, prompt hash, judge, dataset, metric commit, and seed.  
- **Immutable artifacts**: Save traces (inputs + outputs + evidences) for every failed case; they feed the **debug set**.  
- **Access control**: PII and regulated data masked or synthetic; eval workers only access **de‑identified** traces.  
- **Auditability**: Keep a **decision log**: what shipped, why, and the observed deltas (CI→canary).

**Example `manifest.json`**

```json
{
  "workflow": "policy_qa_ptbr",
  "model": "gpt-x-2025-07-01",
  "prompt_sha": "b9a3…",
  "retriever_index_id": "fees_policy_br@2025-07-14",
  "judge": "qa_grounding_v3",
  "dataset_id": "br-policy-2025Q3-holdout",
  "metric_commit": "3f24a1c",
  "seed": 42,
  "run_time_utc": "2025-08-04T12:02:10Z"
}
```

---

## 9) Minimal Production Eval Architecture (Blueprint)

1. **Repo**: `/evals` monorepo with `datasets/`, `metrics/`, `judges/`, `suites/`, `configs/`.  
2. **Storage**: object store for datasets & traces; relational DB for run metadata and slice stats.  
3. **Orchestrator**: nightly CI (L1/L3) + weekly big suite; **PR bot** posts deltas.  
4. **Annotation loop**: in‑house or vendor with rubric, IAA tracking, and adjudication queue.  
5. **Dashboards**: CI trend, worst‑slice, cost/latency, drift, incidents.  
6. **Runbooks**: rollback, judge failure, proxy drift, and data breach procedures.

---

## 10) Code Patterns & Snippets

### 10.1 Wilson lower bound for a proportion (robust gating)
```python
import math

def wilson_lower_bound(successes: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    phat = successes / n
    denom = 1 + z**2 / n
    center = phat + z**2 / (2*n)
    margin = z * math.sqrt((phat*(1-phat) + z**2 / (4*n)) / n)
    return (center - margin) / denom

# Example: gate requires lower bound >= 0.85
lb = wilson_lower_bound(362, 400)
print(lb)
```

### 10.2 Slice‑aware scoring (pseudo‑code)

```python
def score_by_slice(rows, slice_keys=("locale","policy_type")):
    by = defaultdict(list)
    for r in rows:
        key = tuple(r[k] for k in slice_keys)
        by[key].append(r["true_success"])
    return {k: sum(v)/len(v) for k,v in by.items()}
```

### 10.3 SQL: Canary vs. Control Delta

```sql
SELECT
  slice_key,
  AVG(CASE WHEN variant='canary' THEN true_success ELSE NULL END) AS canary,
  AVG(CASE WHEN variant='control' THEN true_success ELSE NULL END) AS control,
  AVG(CASE WHEN variant='canary' THEN true_success ELSE NULL END) -
  AVG(CASE WHEN variant='control' THEN true_success ELSE NULL END) AS delta
FROM online_eval_daily
WHERE date BETWEEN CURRENT_DATE - INTERVAL '7 day' AND CURRENT_DATE
GROUP BY slice_key
ORDER BY delta ASC;
```

### 10.4 YAML: Eval Suite Config

```yaml
suite: policy_qa_weekly
datasets:
  - id: br-policy-2025Q3-holdout
  - id: ar-policy-2025Q3-holdout
metrics:
  true_success: grounded_success_v2
  guardrails:
    hallucination_proxy_max: 0.02
    p90_latency_ms_max: 2500
gates:
  ci_lower_min: 0.86
  worst_slice_min: 0.82
judges:
  - qa_grounding_v3
```

---

## 11) Worked Micro‑Examples

### A) **Fintech Policy RAG** (BR)
- **Symptom:** answers cite wrong fee table page.  
- **Fixes:** reranker + evidence verification; gate on **evidence‑supports‑claim** ≥ 0.95.  
- **Monitoring:** `index_age_p95`, `citation_missing_rate`, `freshness_violations`.

### B) **Code Generation**
- **Symptom:** judge says “looks correct,” tests fail.  
- **Fixes:** execution‑based unit tests as primary metric; judge only for style.  
- **Gate:** `tests_passed_lower ≥ 0.94`; cost/latency ceilings for long files.

### C) **Multi‑Turn Support Agent**
- **Symptom:** loops with the refund tool.  
- **Fixes:** step cap=6; self‑critique after step 4; negative examples for “when *not* to call tool”.  
- **Monitoring:** `tool_call_repeat_rate`, `convo_length_p95`, `handoff_to_human_rate`.

---

## 12) Checklists

### Pre‑merge Eval Gate (CI)
- [ ] Dataset version & manifest attached  
- [ ] Wilson **lower bound** meets thresholds (avg & worst‑slice)  
- [ ] Safety/guardrail metrics pass (0 hallucination regressions)  
- [ ] Cost + latency budgets respected  
- [ ] Debug traces saved; failing items appended to debug set

### Monitoring Runbook
- [ ] Alerts for proxy drift and cost/latency ratios  
- [ ] Daily canary vs. control deltas by slice  
- [ ] Freshness & tool‑success counters  
- [ ] Incident labels and links to traces

### Data Governance
- [ ] PII scrubbed; row‑level access controls  
- [ ] Dataset card + change log; sampling recipe reproducible  
- [ ] IAA monitored; adjudication queue cleared weekly

---

## 13) Exercises

1. **Audit Your Evals:** Pick one CI suite. Produce a one‑page audit: dataset card summary, judge calibration, slice coverage, and known blind spots.  
2. **Stability Hardening:** Convert one flaky metric to Wilson lower‑bound gating. Show the before/after flake rate.  
3. **RAG Freshness:** Add `index_age_p95` to your dashboard and define an alert threshold. Simulate an incident and write the rollback steps.  
4. **Judge Recalibration:** Sample 300 items from production, label with two humans + adjudication, recalibrate your judge, and update thresholds.  
5. **Cost Budgeting:** Instrument your CI to output cost per resolved case by slice. Propose a cost SLO and a plan for violations.  
6. **Red‑Team Rotation:** Design a small adversarial suite (10–20 items) targeting one pitfall in your app; publish the rubric and expected failures.

---

## Summary

Production LLM evaluation succeeds when **datasets are governed**, **metrics are calibrated**, and **slices are first‑class**. Most pain comes from **leaky datasets**, **flaky gates**, **judge bias**, **proxy drift**, and **stale RAG indexes**. The cure is systematic: version everything, prefer **execution‑based truth**, gate on **CI lower bounds**, watch **worst‑slice**, and connect offline suites to online canaries. Pair this lesson with your **9.3 flywheel** so every pitfall you encounter becomes another **countermeasure card**—and your quality keeps ratcheting up week after week.
