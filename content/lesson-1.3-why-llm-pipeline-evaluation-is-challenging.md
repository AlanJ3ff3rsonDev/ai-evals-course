# AI Evals for Engineers & PMs  
## Lesson 1.3 — Why LLM Pipeline Evaluation is Challenging

> **Plain definition:** *Evaluating LLM systems is harder than traditional software because outputs are open-ended, contexts change rapidly, and there are multiple, often conflicting, dimensions of “quality.”*

In classic software, evaluation means: run code → check deterministic outputs against expected outputs → pass/fail. In LLM systems, outputs can be valid in many different forms, can be partially right or wrong, and can degrade in subtle ways over time.  

This lesson will unpack **why** evaluation is hard, **what unique challenges LLMs add**, and **how to design around these challenges**.

---

### Learning Objectives

By the end, you should be able to:

1. List the major challenges unique to evaluating LLM pipelines.  
2. Understand how each challenge impacts your ability to measure and improve.  
3. Recognize anti-patterns in current evaluation practice.  
4. Apply mitigation strategies that keep evaluations trustworthy and useful.

---

## 1) The core differences from traditional software evaluation

**Traditional software:**  
- Inputs → deterministic code → outputs.  
- Same input always yields same output.  
- Expected outputs defined exactly.  
- Tests are cheap to run and easy to automate.

**LLM pipelines:**  
- Inputs → probabilistic model(s) → open-ended outputs.  
- Same input can yield different valid outputs (and sometimes invalid ones).  
- “Correctness” may be subjective or multi-dimensional.  
- Evaluation often requires human or LLM judgment.  
- Outputs can drift as upstream models or prompts change.

This non-determinism and subjectivity means evaluation is less like a yes/no test, and more like grading an essay or reviewing a design mockup—with the added twist that you need to scale it to thousands of cases automatically.

---

## 2) Key challenges and why they matter

### Challenge 1 — **Defining “good” is subjective**
- In factual QA, “good” might mean *accurate and concise* for one stakeholder, *detailed and thorough* for another.  
- Without a shared rubric, you get inconsistent judgments, noisy metrics, and unproductive debates.

**Mitigation:** Invest time in **rubric definition** with examples and weights. Lock it early and socialize it across teams.

---

### Challenge 2 — **Multiple dimensions of quality**
- LLM outputs are judged on **accuracy, completeness, tone, style, safety, grounding, latency, cost**, etc.  
- A model might score high on accuracy but fail safety (e.g., revealing sensitive data).  
- You can’t collapse everything into one number without losing information.

**Mitigation:** Track **separate metrics** per dimension. Make trade-offs explicit (e.g., “We accept 0.2 drop in style for 0.1 gain in grounding”).

---

### Challenge 3 — **Evaluation is probabilistic**
- Non-determinism from model sampling (temperature > 0), retrieval variations, and API changes means scores fluctuate.  
- You can get different pass rates on the same dataset just by re-running.

**Mitigation:** Fix random seeds where possible, control temperature, and average over multiple runs if needed. Focus on **relative** changes (deltas) rather than absolute scores alone.

---

### Challenge 4 — **Ground truth is hard to get**
- In some domains (medical, legal, customer-specific policy), you can’t easily assemble a perfect “correct answer” set.  
- Even SMEs (subject matter experts) can disagree.

**Mitigation:** Use a **combination** of gold standards for clear cases + rubric-based scoring for subjective ones. Capture multiple acceptable answers when possible.

---

### Challenge 5 — **Cost and latency constraints**
- Judge-based evaluation (human or LLM) costs money and takes time.  
- Running large eval sets frequently can be prohibitively expensive.

**Mitigation:** Maintain **tiered datasets**:  
  - **Smoke tests:** tiny, fast, cheap (run per PR).  
  - **Regression sets:** medium, targeted at known failure modes (run nightly).  
  - **Full offline eval:** large, representative (run weekly or before major release).

---

### Challenge 6 — **Model and data drift**
- LLM vendor updates can silently change model behavior.  
- Your data distribution (user inputs) shifts over time.  
- Performance decays without obvious code changes.

**Mitigation:** Continuous monitoring + periodic re-calibration of judge prompts. Feed new real-world cases into your offline eval set.

---

### Challenge 7 — **Complex multi-step pipelines**
- Failures can come from retrieval, reasoning, tool calls, formatting, or integration layers.  
- An end-to-end “fail” doesn’t tell you which step broke.

**Mitigation:** Evaluate at **multiple levels**: component-level metrics + end-to-end metrics + rich trace logging.

---

### Challenge 8 — **Gaming the metric**
- If teams are incentivized only on one metric, they may “optimize” in ways that harm other dimensions (metric gaming).  
- Example: Improving exact-match rate by overfitting to test set phrasing, harming generalization.

**Mitigation:** Keep metrics balanced and aligned with actual product outcomes. Rotate hidden test sets.

---

### Challenge 9 — **Evaluating subjective or creative tasks**
- For tasks like “write a persuasive debt collection message,” there may be no single correct output—only degrees of effectiveness.  
- User perception and conversion rate are the true end metrics, but these are hard to measure offline.

**Mitigation:** Use proxy rubrics offline + A/B testing online to validate against actual business goals.

---

## 3) Anti-patterns to avoid

- **Metric theater:** Picking easy-to-improve metrics that look good but don’t correlate with business impact.  
- **One-and-done evaluation:** Running a big eval once before launch, then never again.  
- **Ignoring small segments:** Passing overall average while failing for a key user group.  
- **Trusting LLM-as-judge blindly:** Not validating judge agreement with humans.

---

## 4) How to design around these challenges

The core strategies:

1. **Rubric first** — Align stakeholders on what “good” means *before* you write prompts.  
2. **Multi-level eval** — Component + system + online metrics.  
3. **Segmentation** — Measure per segment (language, geography, persona).  
4. **CI integration** — Automate smoke/regression tests.  
5. **Trace everything** — Keep artifacts for error analysis.  
6. **Drift detection** — Compare against frozen holdouts regularly.  
7. **Balance objectives** — Make trade-offs visible and deliberate.

---

## 5) Example: Why it’s hard in practice (Collections agent)

**Spec:** “Agent must be persuasive, compliant, and factually accurate.”  
**Reality:**  
- *Persuasive* is subjective.  
- Compliance requires domain-specific rules.  
- Accuracy depends on retrieval quality and data freshness.  
- Non-deterministic generation changes tone across runs.  
- In production, new slang and negotiation tactics appear.

Without **multi-layered evaluation**, you can’t detect which dimension failed, or why.

---

## 6) Practical checklist

- [ ] Rubric defined and agreed upon.  
- [ ] Datasets cover all major segments and edge cases.  
- [ ] Metrics per quality dimension, not a single average.  
- [ ] CI runs smoke and regression sets automatically.  
- [ ] Drift monitors in place for production.  
- [ ] Evaluation cost and latency budgets respected.  
- [ ] Human–LLM judge agreement checked.

---

## 7) Key takeaways

- LLM evaluation is **multi-dimensional, probabilistic, and dynamic**.  
- Challenges arise from subjectivity, drift, cost, and complexity.  
- The solution is not one magic metric, but a **layered, continuous evaluation process**.  
- Your evaluation design is as important to product success as your prompt design.

---

*End of Lesson 1.3 — Why LLM Pipeline Evaluation is Challenging*

