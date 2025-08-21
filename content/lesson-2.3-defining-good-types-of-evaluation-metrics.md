# AI Evals for Engineers & PMs  
## Lesson 2.3 — Defining “Good”: Types of Evaluation Metrics

> **Purpose:** In Lessons 1.1–1.5 we built the evaluation mindset (intent → measurement → decision). In 2.1 you learned what LLMs are good/bad at, and in 2.2 you learned to express intent crisply in prompts. **Now we turn that intent into numbers** that drive engineering and product decisions.

Think of this lesson as the **translation layer** between your rubric and your CI dashboard. We’ll map each kind of task to an appropriate metric family, show how to combine metrics safely, and explain how to set thresholds that actually protect your product.

---

### Learning Objectives
By the end you can:
1. Convert a **rubric** into one or more **metrics** with clear formulas and decision rules.  
2. Choose wisely between **code-based**, **judge-based**, and **hybrid** metrics.  
3. Aggregate metrics across examples and **slices** (segments) without hiding regressions.  
4. Set **thresholds** and basic **confidence intervals** so results are trustworthy.  
5. Avoid “metric theater” by tying metrics to the business decision they inform.

---

## 1) From rubric to metric: the 5-step recipe

1. **Name the criterion** (from your rubric).  
2. **Choose an observable**—what you can actually check (string, number, schema, citation ids, human rating).  
3. **Define the metric function** `M(x, y) → [0,1]` (or a label).  
4. **Aggregate** across the dataset (mean, pass-rate, macro/micro).  
5. **Decide** using a threshold and a rule (ship/block/iterate).

> Example: “Grounding” → check that every factual sentence cites a provided doc → score = (# grounded claims)/(# factual claims) → average per example → ship if mean ≥ 0.9 and no slice < 0.85.

---

## 2) Metric families at a glance

| Family | What it measures | Pros | Cons | Typical uses |
|---|---|---|---|---|
| **Code-based** | Exact structure, numbers, strings, schemas, latency/cost | Cheap, deterministic, reproducible | Misses subjective qualities | Extraction, classification, tool calling, ops budgets |
| **Judge-based (human/LLM)** | Helpfulness, faithfulness, tone, reasoning quality | Captures nuance, task success | Costly/noisy; needs calibration | Q&A quality, RAG grounding, copy quality |
| **Hybrid** | Combine code gates + judge scores | Balanced, safer | More design effort | End-to-end product metrics (what you’ll ship with) |

**Rule of thumb:** start with **code gates** for *must-haves* (JSON parses, safety pass), then layer **judge-based** scores for qualities you can’t code-check.

---

## 3) Code-based metrics (with mini-formulas & examples)

### 3.1 Exact match & tolerance
- **Exact string/number match**: `EM = 1` if output equals target, else `0`.
- **Numeric tolerance** (e.g., cents within ±1): `pass` if `|y_pred − y_true| ≤ τ`.

**Use for:** field extraction, date/amount parsing, SQL/JSON validity.

---

### 3.2 Schema & format validity
- **JSON parse rate:** fraction of outputs that parse.  
- **Enum validity:** fraction of outputs with allowed labels.  
- **Length / regex checks:** e.g., phone pattern, max characters.

**Tip:** Treat schema failures as **hard fails** (score = 0) before any quality scoring.

---

### 3.3 Classification metrics
- **Confusion matrix** for each class (TP/FP/FN/TN).  
- **Precision:** `TP / (TP + FP)` — how often predicted positives are correct.  
- **Recall:** `TP / (TP + FN)` — how many actual positives you found.  
- **F1:** harmonic mean `2·(Prec·Rec)/(Prec+Rec)`.

- **Macro-averaged F1**: average F1 over classes (treats classes equally).  
- **Micro-averaged F1**: compute totals across classes first (weights by frequency).

**When to use which:** Use **macro** if small classes matter (risk codes, rare intents).

---

### 3.4 Sequence/Span extraction
- **Token-level F1** or **span-level exact match**.  
- For named entities: precision/recall/F1 over spans.

---

### 3.5 Retrieval metrics (for RAG)
- **Recall@k:** fraction of queries whose gold document appears in top-k.  
- **MRR (Mean Reciprocal Rank):** `avg(1/rank_of_first_relevant)`; higher is better.  
- **nDCG@k:** ranking quality with graded relevance.

**Important:** *Good retrieval is necessary but not sufficient*—pair with generation quality and **faithfulness** (below).

---

### 3.6 Operational metrics
- **Latency:** p50/p95/p99.  
- **Cost:** average $/request; tokens in/out.  
- **Stability:** error rates, tool-call success, timeout rate.

**Ship gates:** set budgets (e.g., p95 ≤ 4s; cost ≤ $0.015).

---

## 4) Judge-based metrics (human & LLM-as-judge)

### 4.1 Rubric ratings (Likert 0–3 or 1–5)
- Evaluate each criterion: **grounding, completeness, safety, clarity, tone**.  
- Output a structured JSON rating per item + short justification.

**Aggregation:** average per item; optionally weighted sum (faithfulness > style).

---

### 4.2 Pairwise preferences & win-rate
- Show two candidate outputs (A vs B); judge picks the better one.  
- **Win-rate:** `P(A beats B)` over many pairs.  
- Robust for comparing prompt variants or models.

**Optional:** Fit a **Bradley–Terry/Elo** model for a global score across many variants.

---

### 4.3 Task success (pass/fail)
- Judge decides if the user’s need is satisfied according to a short checklist.  
- Feels like a unit test for open-ended outputs.

---

### 4.4 Calibrating LLM-as-judge
- Build a small **human-labeled gold** set (e.g., 50–100).  
- Measure **agreement** between the LLM judge and humans (exact/±1, correlation).  
- If drift > 10–15%, refine the rubric/examples; re-measure periodically.

**Bias control:** randomize candidate order; hide model identities; avoid “length = better”.

---

## 5) Hybrid scoring: make failure honest and improvement meaningful

1. **Gatekeepers (hard gates)** — If these fail, the example is **0** regardless of other scores:
   - JSON parses; schema valid  
   - Safety/PII checks pass  
   - Tool calls succeeded (when required)

2. **Quality score (soft score)** — Average of judge items: grounding, completeness, clarity, tone.

3. **Composite decision** — Ship when:  
   - Gatekeepers pass AND  
   - Quality score ≥ threshold AND  
   - Ops within budget AND  
   - No key **slice** underperforms.

**Why this pattern:** You prevent “pretty but wrong” outputs from inflating scores.

---

## 6) Aggregation without hiding regressions

- **Per-example to dataset:** average (mean) or pass-rate.  
- **By slice:** compute metrics per **segment** (language, country, user type, channel).  
- **Macro vs micro:** macro treats slices equally; micro weights by size.  
- **Quantiles:** report p50/p95 for latency and cost (averages hide tail pain).  
- **Confidence intervals:** for a pass-rate `p` on `n` examples, a rough 95% CI is  
  `p ± 1.96 · sqrt(p·(1−p)/n)` (good enough to see if a 2–3% delta is noise).

> **Practical rule:** Don’t declare wins on <100 examples per slice unless effects are large.

---

## 7) Setting thresholds that matter

How to pick numbers that aren’t arbitrary:

1. **Baseline first:** measure current system on dev + holdout.  
2. **Back-solve from business:** e.g., to hit NPS or deflection targets, offline pass-rate needs ≥ X%.  
3. **Safety/Compliance are gates:** set high bars (e.g., no severe violations).  
4. **Ops budgets:** pick p95 latency and $/req that fit your SLO and margin.  
5. **Per-slice minima:** “No slice < threshold” avoids “average looks fine” traps.

Document thresholds in a **table** with rationale and owners.

---

## 8) Choosing metrics by task — a quick map

| Task | Primary metrics | Secondary metrics | Notes |
|---|---|---|---|
| **Field extraction / parsing** | JSON parse rate; exact/tolerance match; span F1 | latency, cost | Use small `temperature`; deterministic parsing. |
| **Classification / routing** | Macro-F1; per-class precision/recall | calibration (confidence) | Watch minority classes. |
| **Retrieval (RAG)** | Recall@k, MRR, nDCG | diversity, latency | Use per-domain slices. |
| **RAG answering (generation)** | Faithfulness & completeness (judge) | style, clarity | Use citations; penalize unsupported claims. |
| **Multi-turn conversation** | Task success rate (judge); end-of-chat resolution rate | turn-level helpfulness | Also track *state consistency* across turns. |
| **Tool calling / agents** | Function-call validity; tool success; end-to-end task success | step count, time-to-success | Evaluate both component and system. |
| **Safety** | Violation rate (disallowed prompts) and over-block rate (allowed prompts) | jailbreak success rate | Separate severities. |
| **Ops** | p50/p95 latency; $/req; error rate | variance | Set budgets as ship gates. |

---

## 9) Worked example — CollectAI negotiation assistant

**Rubric (5 items):** grounding to policy, completeness (amount/options/next step), tone (respectful/firm), compliance (no unauthorized offers), clarity & CTA.

**Metrics:**  
- **Gates (code):** JSON parses; allowed enums only; message length ≤ 1200; no PII in output.  
- **Quality (judge):** 0–3 per rubric item → average score.  
- **Ops:** p95 latency, cost per message.  
- **Slices:** debtor persona (3), channel (WhatsApp/email), language (pt/es).

**Thresholds:**  
- Gates = 100% pass on holdout.  
- Quality ≥ **2.7** overall; **no slice < 2.6**.  
- Ops: p95 ≤ **3.5s**, cost ≤ **$0.010**.  
- **Decision rule:** Ship only if all conditions met; otherwise run **error analysis** and expand regression set.

**Why this works:** The gates prevent unsafe/wrong formats, judge captures persuasion/compliance, and slices protect key groups.

---

## 10) Common pitfalls (and the antidotes)

1. **Metric theater** — Choosing easy metrics that look good.  
   - *Antidote:* Start from the **product decision** and work backward.

2. **Single global average** — Hides failures in important segments.  
   - *Antidote:* Always compute **per-slice** metrics and minima.

3. **Uncalibrated judges** — LLM-as-judge drifts or disagrees with humans.  
   - *Antidote:* Maintain a gold set; check agreement; refresh examples.

4. **Untested gates** — JSON or safety failures silently excluded.  
   - *Antidote:* Make gates explicit with **0 score** when they fail.

5. **Tiny eval sets** — Declare wins on noise.  
   - *Antidote:* Use the CI tiers (smoke/regression/holdout) and report **CIs**.

6. **Changing the rubric mid-flight** — You can’t compare before/after.  
   - *Antidote:* Freeze versions; bump `metric_version` when rules change.

---

## 11) Micro-exercise (do it now)

Take the prompt you designed in Lesson 2.2. For **two** rubric items (e.g., *faithfulness* and *tone*), specify:

- The **observable** you’ll check.  
- The **metric function** (code or judge).  
- The **aggregation** (per-slice?).  
- The **threshold** and **decision rule**.

If you can write those four bullets unambiguously, you’ve successfully turned intent into measurement.

---

## 12) Key takeaways

- Metrics are not numbers for dashboards; they are **decision tools**.  
- Use **code gates** for must-haves, **judge scores** for nuanced quality, and combine them thoughtfully.  
- Always evaluate by **slices** and attach **thresholds** with rationale.  
- Keep datasets, rubrics, and metric code **versioned** so improvements are real.

---

*End of Lesson 2.3 — Defining “Good”: Types of Evaluation Metrics*

