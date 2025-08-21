# AI Evals for Engineers & PMs  
## Lesson 1.1 — What is Evaluation?

> **Plain definition:** *Evaluation is the disciplined process of checking whether your system reliably produces the behaviors you intend, under clearly specified conditions, and measuring how well it does so.*

This lesson builds the mental model you’ll reuse throughout the book. We’ll be intentionally practical and concrete, so you can design evaluations for anything from a simple prompt to a multi‑step agentic pipeline.

---

### Learning Objectives

By the end, you should be able to:

1. State a compact definition of evaluation and explain *why* it matters for LLM applications.  
2. Identify the parts of an LLM system and where evaluation attaches.  
3. Write a **task statement**, **success rubric**, and **metric** for a concrete feature.  
4. Distinguish between **offline** vs **online** evaluation, and **code‑based** vs **judge‑based** metrics.  
5. Avoid the most common pitfalls (leaky test sets, vague rubrics, metric theater).

---

## 1) The core idea (intuition first)

Think of evaluation as a **flashlight in a dark room**. Your product (a prompt, tool‑calling chain, or agent) lives inside a complex space of inputs and behaviors. Without a light, you’ll bump into failures randomly—usually in production. With a light, you deliberately illuminate:

- **What “good” looks like** (your *intent*),
- **Where the model deviates** (your *gaps*),
- **How to move the needle** (your *iteration plan*).

A second analogy: evaluation is like **unit tests + user research + analytics merged for AI**. You still write specs and automated checks, but because outputs are open‑ended language, you supplement with structured **rubrics** and sometimes **LLM‑as‑judge** to scale judgments beyond what code alone can express.

---

## 2) Formalizing evaluation in one page

An evaluation always names these ingredients:

- **System (S):** the thing you’re testing (a prompt, a chain, a tool‑calling function, a full app).  
- **Task (T):** what S is *supposed* to do (e.g., “answer support questions from our policy docs”).  
- **Inputs (X):** representative scenarios where S will operate (queries, contexts, tool results).  
- **Outputs (Y):** what S produces for each input.  
- **Criteria (C):** what makes an output *good enough* (accuracy, safety, tone, format, etc.).  
- **Metric (M):** a measurable function that maps outputs to a score: `M: (X, Y) → [0,1]` or a label (pass/fail).  
- **Threshold (θ):** the score you require for ship/keep decisions.  
- **Decision (D):** the action you take given the score (ship, roll back, refine).

> **One‑liner:** *Evaluation is turning your intent (C) into a measurement (M) over representative inputs (X) so you can make a decision (D) about a system (S) performing a task (T).*

---

## 3) Where evaluation attaches in an LLM application

LLM apps are pipelines. You can (and should) evaluate at **multiple levels**:

1. **Prompt/Function level** — “Does this prompt reliably format extraction as JSON?”  
2. **Component level** — “Does the retriever return documents that contain the answer?”  
3. **End‑to‑end (system) level** — “Given a user question, does the final reply meet our policy and solve the user’s need?”  
4. **Guardrails/Safety layer** — “Are toxic/PII outputs blocked without over‑blocking valid requests?”  
5. **Ops level** — **latency** and **cost** budgets under realistic load.

> **Takeaway:** don’t only measure end‑to‑end “vibes.” Keep **instrumentation** (traces, intermediate artifacts) so you can locate the failure *stage* (retrieval vs reasoning vs formatting vs tools).

---

## 4) What counts as “good”? Designing the success rubric

For LLM work, **“correct”** is usually not a single string. You need a **rubric**—a short checklist that a judge (human or model) can apply consistently.

**Example rubric for policy‑grounded answers (RAG):**  
For each response, check:

1. **Grounding:** All factual claims are supported by cited retrieved docs.  
2. **Completeness:** The main question is fully answered; key constraints are respected.  
3. **Faithfulness (No Fabrication):** No claims absent from the sources.  
4. **Safety & Compliance:** No sensitive data leaks; policy‑violating advice is refused.  
5. **Format & Helpfulness:** Clear structure, actionable steps, required format followed.

You can score each item 0/1 (pass/fail) or 0–3 (Likert). The overall metric is the average or a weighted sum. **Weights** reflect business priorities (e.g., faithfulness>style).

> **Tip:** Keep the rubric **short (3–7 bullets)**, concrete, and **domain‑specific**. Vague rubrics produce noisy, unactionable measurements.

---

## 5) Types of evaluation you’ll use

### A. By *when* you measure
- **Offline (pre‑deployment):** You run on a held‑out dataset. Fast, cheap, reproducible. Great for iteration and CI.  
- **Online (post‑deployment):** Real users, A/B tests, bandits, and **guardrail monitors**. The only source of truth for long‑term product impact.

### B. By *how* you measure
- **Code‑based metrics:** exact match, regex checks, numbers within tolerance, JSON validity, latency, cost. Objective, cheap.  
- **Judge‑based metrics:** human raters or **LLM‑as‑judge** applying your rubric. Captures quality dimensions that code can’t (helpfulness, tone, reasoning faithfulness).

### C. By *what* you measure
- **Task success:** Did it solve the user’s problem? (pass@1, win‑rate, success‑rate)  
- **Quality & UX:** helpfulness, clarity, tone, formatting, instruction‑following.  
- **Safety & Compliance:** toxicity, PII, medical/financial policy adherence, jailbreak resistance.  
- **Robustness:** performance under paraphrase, long inputs, tool failures, out‑of‑domain cases.  
- **Cost & Latency:** dollars and milliseconds under load; tail latencies (p95/p99).  
- **Fairness/Group metrics:** does performance vary by segment (language, country, device)?

> **Multi‑objective reality:** you’ll balance *success*, *safety*, *cost*, and *latency*. Make trade‑offs explicit.

---

## 6) Concrete mini‑examples (engineer & PM friendly)

### Example 1 — JSON Extraction Tool
**Task:** Extract `{total_amount_cents, due_date}` from emails.  
**Inputs:** 500 real emails, stratified by vendor, language, and format.  
**Rubric:**  
- JSON parses (code‑metric).  
- `total_amount_cents` exact numeric match within ±1 cent (code‑metric).  
- `due_date` within ±1 day (code‑metric).  
- **Failure categories** logged (missing currency, ambiguity).  
**Threshold:** ≥ 98% pass for both fields on each vendor segment.  
**Decision:** Ship only if every key segment clears 98% (prevents hidden regressions).

### Example 2 — Policy‑Answering RAG Bot
**Task:** Answer merchant policy questions using internal docs.  
**Inputs:** 400 real queries sampled from support; each has a canonical doc span.  
**Rubric (judge‑based):** grounding, completeness, faithfulness, safety, formatting.  
**Metric:** LLM‑as‑judge 0–3 per item; average ≥ 2.6 with **no safety rubric item < 2**.  
**Ops gates:** median latency < 2.0s, p95 < 4.0s; cost < $0.015 per answer.  
**Decision:** If quality passes but p95 exceeds 4s, do not ship—fix retrieval chunking or caching first.

### Example 3 — Chargeback Reason Classifier (PM, risk)
**Task:** Classify dispute reason codes from merchant narratives.  
**Metric:** Macro‑F1 across classes (code‑metric) + **consistency** on unchanged inputs week‑to‑week.  
**Guardrail:** Manual audit of top‑loss merchants monthly; alert if class drift > 8%.

---

## 7) Building a minimal evaluation (step‑by‑step template)

Use this **one‑page template** whenever you create/modify a feature:

1. **Task Statement (one sentence).**  
2. **User/Business Goal:** Why it matters; the decision the metric will inform.  
3. **Representative Inputs:** Sampling plan (sources, segments, sizes).  
4. **Success Rubric:** 3–7 bullets, weighted if needed.  
5. **Metric Definition:** Code checks and/or judge prompt.  
6. **Thresholds & Budgets:** quality gate, safety gate, latency/cost budgets.  
7. **Test Design:** splits (dev/val/holdout), size per split, random seeds, reproducibility.  
8. **Failure Taxonomy (initial):** probable modes you’ll tag in error analysis.  
9. **CI Plan:** when it runs (PRs, nightly), how regressions block merges.  
10. **Logging Plan:** traces to store (inputs, retrieved docs, tools, outputs, judge scores).

> **Rule of thumb for sample sizes:** start with **100–300** examples per key segment to detect large effects; grow as you near launch. Keep a **frozen holdout** for final decisions.

---

## 8) Judge prompts & reliability in one page

When using **LLM‑as‑judge**, reliability hinges on *clear instructions* and *calibration*.

**Write the judge prompt like this:**

- **Role + goal:** “You are a strict evaluator of policy‑grounded answers.”  
- **Rubric with definitions and examples:** include 1–2 *positive* and *negative* examples per rubric item.  
- **Structured output:** fixed JSON fields, one per rubric item, plus a short justification.  
- **Temperature 0** (or as low as your model supports).

**Calibration loop:**  
- Compare LLM judge to a small set of **human‑labeled gold** (e.g., 50–100 items).  
- Compute agreement (e.g., % exact, or correlation).  
- If drift > acceptable range (say, >10–15% disagreement), refine the rubric/examples.

> **Key point:** judges don’t need to be perfect; they must be **consistent enough** to rank variants and block obvious regressions. You can still do **human audits** on critical slices.

---

## 9) Offline vs online: how they fit together

- **Offline** is for **iteration** and **guarding regressions** (fast feedback, CI).  
- **Online** is for **business truth** (retention, conversion, ticket deflection).

A healthy lifecycle looks like this:

1. **Instrument** your system → collect traces.  
2. **Bootstrap** an offline set → run evaluations → pick the best contender.  
3. **Ship behind a flag** → run online A/B with safety monitors.  
4. **Analyze errors** from both offline and online → expand datasets → improve.  
5. **Automate** the offline eval as CI so future changes can’t regress silently.

---

## 10) Common pitfalls (and how to avoid them)

1. **Vague success criteria** → Write a rubric that another engineer could apply without guessing.  
2. **Leaky test sets** → Freeze a holdout; don’t tune on it. Keep generation prompts and seeds fixed.  
3. **Metric theater** → Pick metrics tied to a **product decision** (e.g., “block shipping if faithfulness < 2.6”).  
4. **Single global average** → Break down by **segments** (language, country, channel). Regressions hide in averages.  
5. **Ignoring cost/latency** → Budget and track **p95**; slow “great” systems fail in production.  
6. **No failure taxonomy** → If you don’t tag errors, you won’t know *what to fix*.  
7. **Judge drift** → Re‑calibrate LLM‑as‑judge with periodic human audits.  
8. **No reproducibility** → Fix seeds, snapshot prompts, version datasets; log hashes.

---

## 11) Tiny checklist you can copy into a PR

- [ ] Task statement and business goal written.  
- [ ] Representative dataset created with segments + sizes documented.  
- [ ] Rubric (3–7 bullets) agreed with PM & Eng.  
- [ ] Metrics implemented (code &/or judge) with structured outputs.  
- [ ] Thresholds & budgets set; CI wired to block on failures.  
- [ ] Failure taxonomy defined; error tagging enabled.  
- [ ] Prompts, seeds, datasets versioned; traces stored.  
- [ ] Plan for online A/B + safety monitors.

---

## 12) Hands‑on micro‑exercise (do now)

Pick a feature you care about (e.g., “Agent writes a WhatsApp follow‑up to a debtor”). Write:

1. **Task:** “Given debtor’s last message + policy snippets, draft a persuasive, compliant follow‑up.”  
2. **Rubric (5 bullets):** grounding, completeness, safety/compliance, tone appropriateness, required format.  
3. **Metric:** LLM‑as‑judge with JSON output (0–3 each).  
4. **Dataset:** 150 real conversations across three debtor personas.  
5. **Thresholds:** avg ≥ 2.7, no safety item < 2; p95 latency < 3.5s; cost < $0.01.  
6. **Decision rule:** Ship only if *all* personas clear the threshold.

If you can write the six items above clearly, you have a viable evaluation.

---

## 13) Key takeaways (TL;DR)

- Evaluation = **intent → measurement → decision**.  
- Use **rubrics** to define “good,” then measure with **code** and/or **judges**.  
- Evaluate at **multiple levels** (prompt, component, end‑to‑end, safety, ops).  
- Combine **offline** (fast iteration) with **online** (business truth).  
- Avoid pitfalls: vague rubrics, leaky test sets, averages that hide regressions, ignoring cost/latency.

---

### Optional further reading (for context)
- Classic IR/NLP metrics (EM, F1, ROUGE, BLEU) are useful but insufficient for open‑ended answers—pair them with rubric‑based judging.  
- Preference‑based evaluations (pairwise win‑rate, Elo) are powerful for model comparisons; you’ll meet them again in later lessons.

---

*End of Lesson 1.1 — What is Evaluation?*

