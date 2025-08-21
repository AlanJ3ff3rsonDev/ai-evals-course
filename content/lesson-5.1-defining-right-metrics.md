
# AI Evals for Engineers & PMs  
## Lesson 5.1 — Defining the Right Metrics (What to Measure)

> **Where we are:** We just completed Chapter 4 (collaborative evaluation practices) and built the human labeling backbone: rubrics, seeds, IAA, and alignment sessions. In Chapter 5 we turn that qualitative backbone into **automated evaluators**. This first lesson answers one question only: **What exactly should we measure?** (Implementation comes next in 5.2.)

---

## 1) Why “what to measure” is the hardest decision

Picking the wrong metric is the fastest route to shipping the wrong model. Three forces create pressure here:

- **Goodhart’s Law:** “When a measure becomes a target, it ceases to be a good measure.” If you target “overall pass‑rate,” your system may learn to refuse tough queries or over‑hedge.  
- **Three Gulfs revisited:**
  1. **Product ←→ Technical**: Users want “trustworthy, fast answers,” engineers see latency tokens, retrieval hit‑rate, judge pass‑rate.
  2. **Spec ←→ Data**: Rubrics must be reflected in labels and seeds. If your taxonomy misses **AUTH.BYPASS**, your metrics will never see it.  
  3. **Offline ←→ Online**: Your offline pass‑rate can be green while production users churn because your metric ignores **worst slices** (e.g., PT‑BR on WhatsApp at 1 a.m.).
- **Optimization dynamics:** Metrics shape training (RLHF, preference data), guardrail thresholds, and CI gates. Choose them with surgical intent.

**Definition:** A good metric is **valid** (correlates with the user outcome), **sensitive** (moves when quality changes), **directional** (we agree which way is “better”), **robust** (not gameable by trivial strategies), **cost‑aware**, **sliceable**, and **actionable** by engineers.

---

## 2) The Metric Tree: from business outcome to evidence

Use this mental model to avoid vanity metrics. Work top‑down, then back‑up to validate.

```
Business Outcome (North Star)
    └─ User-Centered Outcome (experience-level)
        └─ Task Success / Quality Facets (what 'good' looks like)
            └─ Capability Metrics (model behavior & components)
                └─ Evidence & Labels (what your judge checks)
```

**Example (CollectAI support assistant):**

- **Business outcome:** Reduce cost‑to‑serve while protecting revenue.  
- **User outcomes:** “I get a **correct, grounded** answer in my language without waiting.”  
- **Facets:** Faithfulness/Groundedness, Safety, Helpfulness, Tone, Coverage.  
- **Capabilities/components:** Retrieval hit‑rate, tool‑call success, judge pass‑rate, latency p95, cost/trace.  
- **Evidence:** Docs contain the referenced amounts; logs show tool errors; labels contain evidence spans.

> **Rule of thumb:** Every metric must map to a node on this tree and to **a rubric rule**. If you can’t point to the rule (from Chapter 4), you’re measuring a vibe, not quality.

---

## 3) The Metric Checklist (9 properties)

Before adopting a metric, validate it against this checklist.

1. **Intent clarity:** We can state, in one sentence, what user pain it reduces.  
2. **Population defined:** Who’s included, excluded, and why (e.g., PT‑BR/WhatsApp first message).  
3. **Unit of analysis:** Per **trace**, per **turn**, per **session**, or per **answerable query**.  
4. **Aggregation:** Mean, pass‑rate, p95, or “worst‑slice first.” Avoid single global averages.  
5. **Sensitivity:** We know which code path changes it (retriever, prompt, tool).  
6. **Robustness to gaming:** We track counter‑metrics (e.g., refusal/deflection rate).  
7. **Cost awareness:** Measuring it doesn’t exceed the performance budget.  
8. **Sliceability:** It must be computed per **lang × channel × risk** (your slices).  
9. **Ownership:** An explicit owner updates thresholds and seeds.

Print this and keep it next to your dashboards.

---

## 4) Metric families (choose a balanced set)

### 4.1 Quality & Safety (primary “Should we ship?” signals)

- **Faithfulness / Groundedness Pass‑Rate**  
  *Intent:* Answer must be supported by retrieved evidence or explicit policy.  
  *Unit:* per **trace** (or per atomic answer).  
  *Judge:* retrieval + LLM‑as‑Judge with evidence spans.  
  *Counter‑metric:* **Deflection/Refusal Rate** (percentage of answerable queries the model refuses).

- **Safety Violations (P0): PII, AUTH.BYPASS, Policy**  
  *Intent:* Prevent “never events.”  
  *Unit:* count per 1k traces; we gate at **max = 0** for PII/AUTH.  
  *Checker:* programmatic + judge confirmation.

- **Helpfulness / Task Success**  
  *Intent:* Did the user get what they needed? (Link generated, amount present.)  
  *Judge:* LLM‑as‑Judge or task‑specific heuristic (e.g., contains link token + correct account).  
  *Counter‑metric:* **Hallucination Rate** (already covered by faithfulness).

- **Tone & Style Adherence**  
  *Intent:* Respect “cordial voice,” multi‑lingual politeness.  
  *Judge:* simple keyword patterns + LLM‑as‑Judge for nuance.

- **Coverage**  
  *Intent:* Share of queries for which the model *attempts* an answer when it should.  
  *Counter‑metric:* over‑refusal.

### 4.2 Component / Capability metrics (diagnostic: “Where to fix?”)

- **Retrieval hit‑rate**: fraction of answers where the needed fact appears in top‑k docs.  
- **Tool‑call success**: API/tool executed without error and returned parsable output.  
- **Cite‑density** (if you require citations): number of grounded quotes per answer.  
- **Agent step efficiency**: median steps to success; tool error rate by type.

### 4.3 Efficiency & Reliability (guardrails on experience & cost)

- **Latency p50/p95** per slice and per component (retrieval, generation, tools).  
- **Cost per trace** (in tokens and currency).  
- **Flakiness** (rerun disagreement): probability two identical runs disagree on pass/fail beyond judge noise.  
- **Judge health**: agreement of judge vs gold seeds (calibration score).

### 4.4 Data & Process quality (keep the foundation solid)

- **IAA (κ/α) per facet** for human labels.  
- **Seed coverage**: # of seeds per critical failure mode and per slice.  
- **Rubric drift rate**: ADRs per month touching rules that affect gating metrics.

> **Pick 2–3 from 4.1 as *ship gates*, 2–4 from 4.2 as *diagnostics*, and 2–3 from 4.3 as *experience/cost* guards.**

---

## 5) From taxonomy to concrete metrics (worked example)

We’ll reuse the taxonomy from Chapter 4 (RET.GOLD_NOT_IN_TOPK, PII.LEAK, AUTH.BYPASS, etc.) and define **metric passports**—small spec blocks you can paste into a repo.

### 5.1 Metric passport template

```yaml
id: faithfulness_pass_rate
name: Faithfulness / Groundedness Pass-Rate
intent: "Answers must be supported by retrieved evidence or explicit policy."
population: "All answerable traces in PT-BR and ES; first turn only; excludes small talk."
unit: "per trace"
aggregation: "mean of {pass∈{0,1}}; reported per slice and overall"
judge: "retrieval check + LLM-as-Judge (schema v1.5)"
counter_metrics: ["deflection_rate"]
owner: "Eval Eng (Alice)"
slo:
  gate: {min: 0.92, slice: "worst-of PT-BR.whatsapp, ES.whatsapp"}
  monitor: {min: 0.95 overall}
seeds: ["s_ptw_001", "s_esw_002", "s_ptw_007"]
```

### 5.2 Example passports

**A) Safety P0 (PII/AUTH) — _Never events_**

```yaml
id: safety_p0_violations
intent: "Zero tolerance for PII leaks and auth bypass."
population: "All traces"
unit: "count per 1000 traces"
aggregation: "sum"
checker: "regex for CPF + policy rules + judge confirmation for context"
slo:
  gate: {max: 0}
```

**B) Faithfulness / Groundedness** (primary ship gate) — see template above.

**C) Helpfulness (Task Success)**

```yaml
id: task_success_rate
intent: "Did the user obtain the requested actionable item?"
population: "Billing & payments intents"
unit: "per trace"
judge: "LLM-as-Judge rubric v1.5 (gives pass when the answer supplies the correct link/amount/date)"
aggregation: "pass-rate by intent and overall"
counter_metrics: ["hallucination_rate","deflection_rate"]
slo: {min: 0.88 worst-slice}
```

**D) Retrieval Coverage@K**

```yaml
id: retrieval_coverage_at_k
intent: "Ensure facts needed to answer appear in top-k documents."
definition: "Percentage of traces where gold fact is present in top-k (k=5)."
population: "Answerable traces with numeric/policy claims"
unit: "per trace"
aggregation: "mean"
slo: {min: 0.96 for PT-BR.whatsapp}
```

**E) Latency p95**

```yaml
id: latency_p95_ms
intent: "User shouldn't wait."
population: "All production traces"
unit: "milliseconds per trace"
aggregation: "p95 overall and per slice"
budget: {max: 3500}   # adjust to your product
```

**F) Judge Health**

```yaml
id: judge_gold_agreement
intent: "Keep the evaluator trustworthy."
definition: "Agreement between judge verdicts and frozen seeds (gold), bootstrapped."
unit: "per evaluation run"
aggregation: "mean agreement"
slo: {min: 0.80}
```

**G) Flakiness**

```yaml
id: flakiness_rate
intent: "Detect stochastic regressions."
definition: "Prob two identical runs disagree on pass/fail beyond judge noise."
unit: "per trace (via repeated runs)"
aggregation: "mean; report worst-slice"
slo: {max: 0.03}
```

---

## 6) Populations, units, and aggregation (get these right)

**Population** drives everything. Typical mistakes: mixing “answerable” and “all” queries, or blending channels. Define **eligibility** precisely:

- **Answerable** = rubric says the system *should* answer from available evidence.  
- **First‑turn** vs **full session** metrics give different numbers—pick intentionally.  
- **Slicing keys** must match your risk map: `lang × channel × intent × risk`.

**Unit of analysis:**  
- **Trace** (one generated answer) → most ship gates.  
- **Turn** (multi‑turn session) → good for conversations (Chapter 6).  
- **Session** → best for business outcomes (containment, FCR).

**Aggregation:**  
- Prefer **worst‑slice** gating (min across selected slices).  
- For latency/cost, report **p95** not mean.  
- For counts (violations), use **per‑1k** normalization.

> **Never collapse to a single overall score.** Keep the dashboard multi‑panel and force the conversation on slices.

---

## 7) Counter‑metrics and anti‑gaming design

Every target metric needs at least one **counter‑metric** that catches pathological optimization:

- **Faithfulness ↑** → model could **refuse** more often. Track **Deflection Rate** (refusal when answerable).  
- **Helpfulness ↑** → model may **invent** numbers. Track **Hallucination/RET.GOLD_NOT_IN_TOPK**.  
- **Latency ↓** → model may reduce **retrieval depth**. Track **Coverage@K** and **timeout rate**.  
- **Cost ↓** → model may use smaller models. Track **Judge pass‑rate** by model class.  
- **Cite‑density ↑** → model could spam citations. Track **irrelevant‑cite rate** via judge.

Design your **CI gates** in pairs: main metric + counter‑metric.

---

## 8) Choosing thresholds (risk‑first, data‑driven)

1. **Baseline:** Measure your current numbers on seeds + a representative batch (≥500 traces).  
2. **Risk mapping:** Identify P0/P1 failure modes and critical slices (e.g., PT‑BR/WhatsApp).  
3. **Set gates:**  
   - **P0 safety** → hard **max=0**.  
   - **Primary quality gate** (faithfulness) → **min = baseline + Δ**, e.g., 0.92 worst‑slice.  
   - **Experience budget** → latency p95 and cost/trace caps.  
   - **Evaluator health** → judge agreement ≥ 0.80.
4. **Revisit monthly** via ADRs when user mix or docs change.

**Tip:** Prefer **relative regression gates** during rapid iteration (e.g., “block if worse by ≥3pp”) plus an absolute floor.

---

## 9) Metric tree for a fintech assistant (filled example)

```
North Star: Reduce cost-to-serve without harming revenue or trust.
  ├── User Outcomes
  │    ├─ Trustworthy answers (grounded, safe)
  │    └─ Fast, polite experience (PT-BR & ES)
  ├── Quality Facets
  │    ├─ Faithfulness / Safety / Helpfulness / Tone / Coverage
  │    └─ Efficiency & Reliability (latency, cost, flakiness)
  ├── Capability Metrics
  │    ├─ Retrieval coverage@5, tool success, judge pass-rate
  │    └─ Latency p95, cost/trace, cache hit-rate
  └── Evidence & Labels
       ├─ Seeds per failure mode & slice
       └─ Rubric v1.5 with examples
```

From this tree, the **ship gates** could be:

- `faithfulness_pass_rate` (min 0.92 worst‑slice),  
- `safety_p0_violations` (max 0),  
- `latency_p95_ms` (max 3500),  
- `judge_gold_agreement` (min 0.80).

Diagnostics: `retrieval_coverage_at_k`, `tool_success_rate`, `flakiness_rate`.  
Counter‑metrics: `deflection_rate`, `irrelevant_cite_rate`.

---

## 10) Spec your metric once, use everywhere (the “metric passport” doc)

Put every metric in your repo under `/eval/metrics/<metric_id>.yml`. Engineers, PMs, and analysts should read the **same** definition used by evaluators, CI, and dashboards. Here’s a compact schema you can adopt:

```yaml
id: <machine_name>
name: <human_name>
intent: <one-line why users care>
population: <eligibility definition>
unit: <trace|turn|session>
aggregation: <how to aggregate (min/worst-slice, p95, mean)>
definition: <math or decision rule; link to rubric rule IDs>
judge: <programmatic|retrieval|llm-as-judge; schema version>
counter_metrics: [<ids>]
slo:
  gate: {min|max: <value>, slice: <slice rule or 'worst-of(...)'>}
  monitor: {min|max: <value>}
owner: <role/person>
seeds: [<ids>]
notes: <gotchas, compute cost, expected variance>
```

Commit changes via ADRs when you alter intent or thresholds.

---

## 11) Worked walkthrough on two real traces (PT‑BR & ES)

Let’s apply the passports to two examples from the starter pack (Chapter 4).

### Trace t_0001 (PT‑BR, amount mismatch)

- **Population:** answerable, PT‑BR/WhatsApp.  
- **Faithfulness:** FAIL (amount not in docs → RET.GOLD_NOT_IN_TOPK + MONEY.MISMATCH).  
- **Helpfulness:** FAIL (wrong amount is harmful).  
- **Safety P0:** PASS.  
- **Retrieval coverage:** PASS if correct amount was present in top‑k (it was) but the model ignored it → *diagnostic: synthesis step*.  
- **CI gate impact:** If many such fails appear in PT‑BR/WhatsApp, the **worst‑slice faithfulness gate** blocks the PR until we fix synthesis prompt or post‑processor.

### Trace t_0002 (ES, Pix in AR)

- **Population:** ES/WhatsApp.  
- **Faithfulness:** FAIL (policy mismatch).  
- **Helpfulness:** FAIL.  
- **Safety:** PASS.  
- **Counter‑metric (deflection):** Not triggered; model answered but incorrectly.  
- **Action:** Add a **seed** and a **policy‑aware retrieval check** (surface “Pix no disponible” for AR).

This small exercise shows why **component metrics** (retrieval coverage, tool success) are vital to debug failures exposed by **quality gates**.

---

## 12) How many metrics do you actually need? (minimal viable set)

For most production assistants, the **Minimal Viable Metric Set (MVMS)** is:

1. `faithfulness_pass_rate` (primary quality gate)  
2. `safety_p0_violations` (hard zero)  
3. `deflection_rate` (counter‑metric)  
4. `latency_p95_ms` (experience)  
5. `cost_per_trace` (budget)  
6. `judge_gold_agreement` (evaluator health)

Everything else is **diagnostic** and can be added when you need to localize the fix.

---

## 13) Common “what to measure” pitfalls (avoid now so 5.9 is easier)

- **Vanity averages:** A single overall pass‑rate hides the riskiest slice. Always show **worst‑slice**.  
- **Metric collision:** Optimizing helpfulness while letting faithfulness drop. Pair with counter‑metrics.  
- **Population drift:** Your metric includes non‑answerable small talk; looks green but users still suffer.  
- **Judge drift:** You change the rubric but forget to update the judge prompt/schema. Agreement drops silently.  
- **Double counting:** Counting both “hallucination” and “faithfulness fail” as independent gates for the same event. Use a **primary** failure mode per trace and secondary modes only for analysis.  
- **Latency blind spots:** Reporting mean latency instead of p95/p99.  

---

## 14) Planning your set (exercise sheet)

Copy this into your repo as `/eval/metrics/plan.md` and fill it with your team.

```md
# Metric Plan (v0)
## Business Outcome
- Reduce cost-to-serve with high trust (PT-BR & ES).

## Ship Gates (with counter-metrics)
1) Faithfulness pass-rate ≥ 0.92 (worst-of PT-BR.whatsapp, ES.whatsapp)
   - Counter: Deflection rate ≤ 8% on answerable queries
2) Safety P0 violations = 0 (PII, AUTH)
3) Latency p95 ≤ 3500 ms
4) Judge vs Gold ≥ 0.80

## Diagnostics
- Retrieval coverage@5 ≥ 0.96 PT-BR.whatsapp
- Tool success rate ≥ 0.98
- Flakiness ≤ 3%

## Owners & Review Cadence
- Gates: Eval Eng (Alice); Diagnostics: Retrieval Eng (Bruno)
- Monthly review via ADR
```

---

## 15) What’s next (5.2 preview)

Now that you’ve specified **what** to measure, the next lesson covers **how** to measure it:

- Designing metric implementations (programmatic, retrieval, judge).  
- Creating data splits and gold sets for calibration.  
- Bootstrapping estimates of **true success** when judges are imperfect.  
- Choosing thresholds with uncertainty bounds.

Bring your **metric passports**—we’ll turn them into code and CI gates.

---

## Appendix A — Glossary (for this lesson)

- **Answerable trace:** A query where the system, given its docs/tools, should provide an answer.  
- **Counter‑metric:** A metric intentionally tracked to reduce Goodhart risk on a target metric.  
- **Flakiness:** Non‑deterministic pass/fail changes not due to code changes; includes sampling temperature and external dependencies.  
- **Worst‑slice gating:** Taking the minimum pass‑rate across predefined high‑risk slices and gating on that minimum.  
- **Seed:** A small, frozen example (input + expected outcome) used for regression tests and judge calibration.

---

## Appendix B — Quick formulas & definitions

- **Pass‑rate:** \( \frac{\#\text{passes}}{\#\text{eligible}} \).  
- **Deflection rate:** \( \frac{\#\text{refusals on answerable}}{\#\text{answerable}} \).  
- **Coverage@K:** \( \frac{\#\text{traces with gold fact in top‑K}}{\#\text{eligible}} \).  
- **Flakiness:** \( \Pr[\text{eval(A)} \neq \text{eval(A)}] \) under repeated runs.  
- **Judge Agreement:** bootstrap mean of **exact verdict match** on seeds.
