# AI Evals for Engineers & PMs  
## Lesson 2.6 — Summary (LLMs, Prompts, and Evaluation Basics)

> **Why this lesson exists:** Chapter 2 gave you the practical building blocks: how LLMs behave, how to express intent in prompts, how to turn that intent into metrics, how to choose between foundation vs application evals, and how to elicit labels so metrics are computable. This summary stitches those parts into one *operational playbook* you’ll reuse in every feature.

---

### The Big Picture in One Sentence
**You design an LLM feature by expressing intent (prompt & rubric), then making that intent measurable (metrics & labels) at two layers (foundation capability vs application truth), and you wire it into CI so changes are safe.**

Everything below is just a clear, repeatable way to do that.

---

## 1) Mental Models You Should Now Own

### 1.1 Strengths & Weaknesses (Lesson 2.1)
- **Strengths:** versatility, few‑shot learning, natural interaction, style adaptation, sometimes multi‑step reasoning.  
- **Weaknesses:** hallucination, prompt sensitivity, context limits, inconsistency, bias, operational drift.

**Mapping → Evaluation:**

| Weakness | What you test | Typical metric |
|---|---|---|
| Hallucination | **Faithfulness to sources** | Judge 0–3 + citation validity gates |
| Prompt sensitivity | **Paraphrase robustness** | Pass‑rate across paraphrases |
| Context limits | **Long input focus** | Recall of early facts; success vs length |
| Inconsistency | **Stability** | Variance across runs; pass@k |
| Bias/Unfairness | **Slice performance** | Per‑slice means/minima |
| Operational drift | **Runtime ops** | p95 latency, cost, error rate |

> **Takeaway:** You don’t “trust” LLMs; you **bound** them with evaluation.

---

### 1.2 Prompting Fundamentals (Lesson 2.2)
A reliable prompt has **five parts**: **Role, Goal, Inputs, Rules, Output Schema**.  
- **Delimit inputs**, keep them **minimal**, require **JSON** outputs.  
- Choose the **mode**: zero‑shot, few‑shot, tool/function calling, or RAG.  
- Log and pin **sampling parameters** (`temperature`, `top_p`, `max_tokens`).  
- Add **refusal rules** so failure is explicit (better than confident nonsense).

**Mini template to copy:**  
```text
ROLE: You are a <role> optimizing for <primary objective> under <constraints>.
GOAL: <one sentence>. Success when: <3–5 rubric bullets>.
INPUTS: <<<A>>>{a}<</A>>> … <<<B>>>{b}<</B>>>
RULES: policy, safety, formatting, refusal conditions.
OUTPUT: strict JSON schema (enums, ranges, version).
```

---

### 1.3 Defining “Good” → Metrics (Lesson 2.3)
Turn rubric items into **metrics**:
- **Code gates:** JSON parse, enums, numeric tolerance, regex, safety detectors, tool success.  
- **Judge scores:** human/LLM ratings for faithfulness, completeness, tone, clarity; pairwise win‑rate.  
- **Ops:** p50/p95 latency, cost, error rate.

**Composite decision:** *Gates pass* AND *quality ≥ threshold* AND *ops within budget* AND *no slice below minimum*.

> Don’t hide behind one big average; compute **per‑slice** metrics and report **CIs**.

---

### 1.4 Foundation vs Application Evals (Lesson 2.4)
Think in **two layers**:
1. **Foundation layer** (capability screen): public/vendor tests for reasoning, JSON stability, multilingual ability, safe refusal, rough cost/latency. Use to shortlist models.  
2. **Application layer** (product truth): your prompts, your docs/policies, your users, your SLOs. Use to decide **ship vs rollback**.

**Decision artifacts:** short‑list matrix, application eval report (per‑slice), Pareto chart (quality/latency/cost), decision memo.

---

### 1.5 Eliciting Labels (Lesson 2.5)
**Labels** are structured judgments your metrics can read without guessing.  
- Design a **label schema** (JSON, enums, ranges).  
- Provide **instructions** with rubric definitions + good/bad examples + edge rules.  
- Use **hybrid sources**: programmatic gates + LLM‑as‑judge + human audits.  
- Maintain **tiered datasets** (smoke, regression, frozen holdout).  
- Calibrate judge vs human on a **gold set**; re‑check regularly.

---

## 2) The Chapter‑2 Operating Procedure (copy/paste)

Follow this **ten‑step loop** every time you create or modify an LLM feature.

1. **Write the one‑sentence task** and **business decision** the metric will inform.  
2. Draft the **prompt** with Role/Goal/Inputs/Rules/Output Schema. Pin params.  
3. Draft a **success rubric** (3–7 bullets, weighted).  
4. Convert each rubric item into **metrics** (code gates + judge).  
5. Create **datasets**: 30‑item smoke, 300‑item regression (with edge cases), 500+ frozen holdout. Slice by language/persona/channel.  
6. Implement **LLM‑as‑judge** prompts + calibration to a 50–100 item human‑gold set.  
7. Define **thresholds** (quality, safety, ops) and **slice minima**; document a decision table.  
8. Run offline eval; do **error analysis**; expand regression set with failures.  
9. Short‑list foundation models if relevant; test them in your **application harness**. Choose the **Pareto‑efficient** option.  
10. Wire the smoke/regression into **CI** (per‑PR, nightly). Keep holdout for ship/rollback decisions; monitor drift online.

---

## 3) “Glue” Checklists You Can Reuse

### 3.1 Prompt Quality Checklist
- [ ] Single‑sentence task + 3–5 success bullets inside the prompt.  
- [ ] Inputs clearly delimited and labeled.  
- [ ] Output schema is strict JSON with enums/ranges; includes `version`.  
- [ ] Safety/refusal rules express visible failure mode.  
- [ ] Temperature/top_p/max_tokens/stop pinned and logged.

### 3.2 Metric Design Checklist
- [ ] Gates cover schema, safety, tool success.  
- [ ] Judge covers faithfulness, completeness, clarity, tone (or equivalents).  
- [ ] Ops budgets set (p95 latency, $/req).  
- [ ] Aggregation by **slice** with minima.  
- [ ] Confidence intervals reported for pass‑rates.

### 3.3 Labeling Checklist
- [ ] JSON label schema is minimal and machine‑checkable.  
- [ ] Instructions include good/bad examples + edge rules.  
- [ ] Redundancy (≥2 humans) **or** LLM judge + human audits.  
- [ ] Gold questions & calibration schedule defined.  
- [ ] Versioning for rubric, datasets, judge prompts.

### 3.4 Decision & Documentation
- [ ] Foundation screen results captured (if model choice involved).  
- [ ] Application eval report (per‑slice) with traces to examples.  
- [ ] Decision memo with thresholds, rationale, and rollback plan.  
- [ ] CI configured to block merges on regression failures.

---

## 4) Integrated Walk‑Through (CollectAI example)

**Feature:** WhatsApp follow‑up for overdue invoice.  
**Task:** “Given the debtor’s last message, policy snippet, and balance, draft a persuasive, compliant follow‑up that proposes allowed options and invites a meeting.”

**Prompt (sketch):** Role=Collections assistant; Goal=persuasion within policy; Inputs=`<<<LAST>>>`, `<<<PROFILE>>>`, `<<<POLICY>>>`; Rules=allowed options only; refusal if missing policy; Output JSON with `message`, `offer_type`, `next_step`.

**Rubric → Metrics:**  
- **Gates:** JSON parse; enum validity; PII redaction; length ≤ 1200 chars.  
- **Judge (0–3):** faithfulness to policy; completeness (balance + options + CTA); tone (respectful & firm); compliance (no unauthorized offers).  
- **Ops:** p95 latency ≤ 3.5s; cost ≤ $0.010.

**Labels:** JSON schema above; LLM judge first pass; human audits 20% random + 100% of any `compliance ≤ 1`.

**Datasets:**  
- Smoke (40 items): per persona × language.  
- Regression (400): includes paraphrase and long‑context slices.  
- Holdout (600): PT/ES × personas × channels, frozen.

**Decision:** Ship if quality ≥ 2.7 and **no slice < 2.6**, gates=100%, ops within budget. Otherwise, run **error analysis** (Chapter 3), expand regression set, and iterate prompts or retrieval/policy snippets.

---

## 5) What to Carry Forward to Chapter 3 (Error Analysis)

You should now have, for at least one feature:

1. A **prompt** (v‑controlled) and **rubric** (with weights).  
2. A working **application eval harness** (gates + judge + ops) with **slice reporting**.  
3. **Datasets** (smoke, regression, holdout) with provenance and versions.  
4. A **label schema** and **judge prompt**, calibrated to a small human‑gold set.  
5. CI wiring for smoke/regression and a documented **decision table**.

With these in place, Chapter 3 will show you how to **read traces**, **label failure modes**, build a **taxonomy**, and **iterate** surgically instead of guessing.

---

## 6) Quick Self‑Test (should take 5 minutes)

- Can you write the five parts of a reliable prompt from memory?  
- For one rubric item (e.g., faithfulness), can you name the **observable**, **metric**, **aggregation**, and **threshold**?  
- Do you know your **slice minima** and **ops budgets**?  
- Could someone else reproduce your eval with your **dataset versions** and **judge prompt**?  
- If a vendor model updates tomorrow, do you have a **frozen holdout** to detect drift?

If you answered “yes” to all, you’re ready for Chapter 3.

---

## 7) One‑Pager Template (print this)

**Feature:** …  
**Business decision:** ship/block/rollback gates? …  
**Prompt:** Role / Goal / Inputs / Rules / Output JSON (vX).  
**Rubric (weighted):** 1) … 2) … 3) …  
**Metrics:** Gates (schema, safety, tools); Judge (items, weights); Ops (p95, cost).  
**Datasets:** Smoke (n=), Regression (n=), Holdout (n=) + slices.  
**Labels:** schema; source (LLM judge vY + human audit %).  
**Thresholds:** overall ≥ …; **min slice ≥ …**; ops ≤ …; safety violations = 0 severe.  
**CI:** per‑PR smoke; nightly regression; holdout for ship.  
**Decision memo link:** …

---

## 8) Key Takeaways (TL;DR)

- Prompts are **specs in code**; make them explicit and testable.  
- Metrics are **decision tools**; combine **gates + judge + ops**, always by **slice**.  
- Foundation benchmarks **filter**; application evals **decide**.  
- Labels need **schema + instructions + calibration** to be trustworthy.  
- Package the whole thing into **CI** so improvements are real and regressions can’t sneak in.

---

*End of Lesson 2.6 — Summary.*
