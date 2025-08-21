# AI Evals for Engineers & PMs  
## Lesson 1.4 — The LLM Evaluation Lifecycle: Bridging the Gulfs with Evaluation

> **Plain definition:** *The LLM Evaluation Lifecycle is the structured process of designing, running, and maintaining evaluations across all three gulfs—specification, implementation, and reality—so your system continuously meets user and business needs.*

You can think of this lifecycle as **the glue between product design and production reliability**.  
It’s not a single event, but a repeating loop that turns intent into measurement into improvement.

---

### Learning Objectives

By the end, you should be able to:

1. Describe the lifecycle stages and how they map to the three gulfs.  
2. Know what activities, artifacts, and metrics belong in each stage.  
3. Understand how offline and online evaluation connect in practice.  
4. Design a lifecycle for your own LLM product that avoids the “one-and-done” trap.  
5. Build a feedback loop that incorporates failure analysis into iteration.

---

## 1) Why “lifecycle” matters

Most teams treat evaluation as:  
**Build → Test once → Ship**.

That’s dangerous because:

- LLM outputs can **drift**.  
- Real-world inputs can **shift**.  
- Your definition of “good” can **evolve**.  

A lifecycle approach means **continuous** evaluation with structured checkpoints, so regressions are caught early and improvements are guided by data.

---

## 2) Overview of the lifecycle stages

We’ll break it into **five** main stages:

1. **Specification & Design** — Define success, align on rubrics, choose metrics.  
2. **Dataset Creation & Instrumentation** — Build representative, segmented test data; add logging.  
3. **Offline Evaluation (Pre-Deployment)** — Run component + system-level metrics in dev.  
4. **Online Evaluation & Monitoring** — Measure in production; track business KPIs, safety, cost, latency.  
5. **Error Analysis & Continuous Improvement** — Feed failures into the next cycle.

These stages **map directly to the three gulfs**:

| Stage | Gulf addressed |
|-------|----------------|
| Specification & Design | Gulf of Specification |
| Offline Evaluation | Gulf of Implementation |
| Online Evaluation | Gulf of Reality |

---

## 3) Stage 1 — Specification & Design

**Goal:** Close the **Gulf of Specification** by making “good” measurable.

Activities:
- Write a **task statement** for each feature.  
- Co-create a **success rubric** (3–7 bullets, weighted).  
- Pick **metrics**: code-based, judge-based, or both.  
- Define **thresholds** for ship/no-ship decisions.  
- Decide **segments** (e.g., language, geography, input type).

Artifacts:
- Task statement document.  
- Rubric with examples of good/bad outputs.  
- Metrics definitions.  
- Threshold table.

Example:
> *Debt collection agent should achieve LLM-as-judge average ≥ 2.7/3 on persuasion, compliance, tone. No compliance score < 2. Latency p95 ≤ 3.5s. Evaluated across three debtor personas.*

---

## 4) Stage 2 — Dataset Creation & Instrumentation

**Goal:** Give yourself the **right inputs** and **visibility** for evaluation.

Activities:
- Sample real user queries, stratified by segment.  
- Synthesize edge cases you expect to be hard.  
- Create a **frozen holdout** for final decisions.  
- Instrument your pipeline to log all inputs, outputs, retrieved docs, tool calls, and scores.

Artifacts:
- Dataset split: dev / regression / holdout.  
- Edge case set.  
- Logging schema.

Example:
> *For a collections bot, sample 150 conversations per debtor persona; add 50 synthetic cases with policy trick questions.*

---

## 5) Stage 3 — Offline Evaluation (Pre-Deployment)

**Goal:** Close the **Gulf of Implementation** before shipping.

Activities:
- Run metrics on **component level** (retrieval accuracy, tool success, JSON parse rate).  
- Run metrics on **end-to-end level** (rubric scores, exact match, etc.).  
- Compare against thresholds; identify failures.  
- Do **error analysis**: tag each failure by category.

Artifacts:
- Evaluation report with per-metric, per-segment scores.  
- Failure taxonomy spreadsheet.  
- Updated dataset with new examples from failures.

Example:
> *Retriever recall ≥ 85% per segment; JSON parse rate ≥ 98%; rubric score ≥ 2.7 avg with no compliance item < 2.*

---

## 6) Stage 4 — Online Evaluation & Monitoring

**Goal:** Close the **Gulf of Reality** and detect drift.

Activities:
- Deploy behind a flag; run **A/B tests**.  
- Monitor **business KPIs** (conversion, CSAT, retention).  
- Monitor **safety, latency, cost** continuously.  
- Collect real-world traces for later offline eval.

Artifacts:
- Online dashboard with KPI + safety metrics.  
- Alerting rules for threshold breaches.  
- Weekly trace sample for audit.

Example:
> *Monitor persuasion success rate by persona in production; alert if drop > 10% vs baseline.*

---

## 7) Stage 5 — Error Analysis & Continuous Improvement

**Goal:** Turn failures into improvements.

Activities:
- Review offline + online failures weekly.  
- Update failure taxonomy if new modes appear.  
- Add new cases to regression set.  
- Adjust prompts, data, or architecture; re-run lifecycle.

Artifacts:
- Updated regression set.  
- Prompts / retrieval / model updates.  
- Post-mortem documents.

Example:
> *Found production failures with accented names in SMS; fixed encoding and added to regression set.*

---

## 8) How offline and online evaluation connect

- Offline: Faster iteration, reproducible, cost-effective.  
- Online: Ground truth for business outcomes, real drift detection.

Healthy flow:
1. Collect prod traces → label → add to offline set.  
2. Improve model/pipeline offline → meet thresholds.  
3. Ship in A/B → confirm KPI lift.  
4. Roll out + keep monitoring.

---

## 9) Example Lifecycle in Action (CollectAI)

1. **Spec & Design:** Rubric for persuasion, compliance, tone.  
2. **Dataset:** 500 conversations + 100 synthetic edge cases.  
3. **Offline:** Passes rubric thresholds in dev.  
4. **Online:** A/B test shows +12% payment link clicks.  
5. **Continuous:** Add new slang terms from prod to dataset.

---

## 10) Practical checklist

- [ ] Rubric agreed, metrics chosen, thresholds set.  
- [ ] Datasets created with segments + edge cases.  
- [ ] Offline eval passing thresholds.  
- [ ] Online monitors + alerting in place.  
- [ ] Failure taxonomy updated regularly.  
- [ ] Continuous loop between prod traces and offline eval.

---

## 11) Key takeaways

- Lifecycle = **spec → dataset → offline → online → improvement**.  
- Each stage bridges a gulf (spec, impl, reality).  
- Offline + online must feed each other.  
- Without the loop, you’ll drift into failure unnoticed.

---

*End of Lesson 1.4 — The LLM Evaluation Lifecycle: Bridging the Gulfs with Evaluation*

