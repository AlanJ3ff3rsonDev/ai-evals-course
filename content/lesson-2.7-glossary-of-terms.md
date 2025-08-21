# AI Evals for Engineers & PMs  
## Lesson 2.7 — Glossary of Terms (with why each matters)

> **How to use this:** This isn’t a dry dictionary. Each entry gives a crisp definition, **why it matters for evaluation**, and a quick **in-practice tip**. Terms are grouped to match the flow of the course so far.

---

## A) Core evaluation concepts

**Evaluation** — The disciplined process of turning product intent into measurements that drive decisions.  
*Why it matters:* Everything else hangs on this. Without evals, you ship on vibes.  
*In practice:* Always specify task → rubric → metrics → threshold → decision.

**Rubric** — A short checklist (3–7 bullets) describing “good” output (e.g., faithfulness, completeness, safety).  
*Why it matters:* Converts subjectivity into consistent judgments.  
*In practice:* Put the rubric inside the judge prompt and the PRD.

**Metric** — A measurable function of outputs (and sometimes inputs) used to summarize performance.  
*Why it matters:* Enables tracking and regression protection.  
*In practice:* Combine **code gates** (hard) with **judge scores** (soft).

**Gate (Hard Gate)** — A must-pass check (e.g., JSON parses, safety pass) that sets the score to **0** if it fails.  
*Why it matters:* Prevents “pretty but wrong/unsafe” from inflating quality.  
*In practice:* Run gates before any judge scoring.

**Threshold** — The minimum acceptable metric value to ship (e.g., ≥ 2.7/3 on quality; p95 ≤ 3.5s).  
*Why it matters:* Converts measurements into decisions.  
*In practice:* Document thresholds with rationale and owners.

**Slice / Segment** — A subset of data by property (language, persona, channel, country).  
*Why it matters:* Averages hide harm; slices reveal regressions.  
*In practice:* Require **min slice ≥ θ**, not just a global average.

**Holdout / Dev / Regression / Smoke** — Dataset splits.  
- **Smoke:** tiny, fast set for every PR.  
- **Regression:** medium, targeted at known failure modes; nightly.  
- **Dev:** where you iterate and tune.  
- **Holdout:** frozen, representative; reserved for ship/rollback decisions.  
*In practice:* Never tune on the holdout.

**Ground truth** — The reference answer/label considered correct.  
*Why it matters:* Anchors your metrics; noisiness here corrupts results.  
*In practice:* Use gold sets for clear cases; use rubrics where truth is subjective.

**Label** — A structured judgment about an (input, output) pair (e.g., 0–3 faithfulness).  
*Why it matters:* Metrics are computed from labels.  
*In practice:* JSON label schema with enums/ranges; machine-checkable.

**Gold set** — A small, high-trust labeled subset used to calibrate judges and raters.  
*Why it matters:* Detects drift and rater inconsistency.  
*In practice:* Refresh sparingly; protect from leakage.

**Leakage** — When examples from eval sets influence the system under test (via prompts, examples, training).  
*Why it matters:* Inflates scores without real generalization.  
*In practice:* Separate examples from evals; version and audit provenance.

**Failure taxonomy** — A structured list of recurring failure modes (e.g., wrong amount, missing CTA, unsupported claim).  
*Why it matters:* Directs engineering effort precisely.  
*In practice:* Start simple; refine with open/axial coding (Chapter 3).

**Goodhart’s law** — “When a measure becomes a target, it ceases to be a good measure.”  
*Why it matters:* Over-optimizing one metric can hurt real outcomes.  
*In practice:* Use balanced scorecards (quality + safety + ops), and keep hidden tests.

---

## B) Prompting & generation terms

**Prompt** — The instruction text (and variables) given to an LLM.  
*Why it matters:* It’s your spec in code.  
*In practice:* Use the five-part skeleton: **Role, Goal, Inputs, Rules, Output Schema**.

**Zero-shot / Few-shot** — Prompting with zero or some examples, respectively.  
*Why it matters:* Few-shot often improves nuance and format control.  
*In practice:* Include 2–6 compact, canonical examples; avoid holdout leakage.

**Output schema** — The exact structure you require (usually JSON).  
*Why it matters:* Enables code-based checks and downstream automation.  
*In practice:* Validate strictly; include enums and ranges.

**Temperature / top_p** — Sampling controls for randomness; higher → more creative, lower → more deterministic.  
*Why it matters:* Affects stability and quality.  
*In practice:* Pin values; log them with traces for reproducibility.

**max_tokens / stop** — Limits on output length and stopping conditions.  
*Why it matters:* Keeps costs and rambling in check.  
*In practice:* Set realistic caps; define stop sequences to avoid trailing chatter.

**Context window** — Maximum tokens the model can attend to in one request.  
*Why it matters:* Long inputs may truncate or cause the model to “forget” earlier facts.  
*In practice:* Chunk inputs; place most relevant content near where it’s used.

**Deterministic vs stochastic runs** — Temperature 0 approximates determinism; >0 introduces variation.  
*Why it matters:* Stability is required for compliance and for reproducible evals.  
*In practice:* Use temp 0–0.3 for extraction/classification; multiple trials for creative tasks.

**Visible failure** — Designing prompts to signal uncertainty or insufficiency (e.g., return `insufficient_information=true`).  
*Why it matters:* Safer than confident hallucinations; easier to evaluate.  
*In practice:* Add refusal rules and explicit “can’t answer” outputs.

---

## C) Metric & statistics terms

**Exact match (EM)** — 1 if predicted string equals target; 0 otherwise.  
*Use for:* IDs, normalized numbers, short labels.

**Tolerance check** — Pass if numeric difference ≤ τ.  
*Use for:* Amounts, dates with ±1 day.

**Precision / Recall / F1** — Classification metrics.  
- **Precision:** of predicted positives, how many are correct.  
- **Recall:** of actual positives, how many you found.  
- **F1:** harmonic mean of precision and recall.  
*In practice:* Use **macro-F1** when minority classes matter; **micro-F1** for overall accuracy weighted by frequency.

**Macro vs Micro averaging** — Macro: average metric per class (equal weight). Micro: compute totals first (frequency weight).  
*Why it matters:* Macro reveals minority-class failures.

**Pass-rate** — Fraction of items meeting a condition (e.g., JSON parses).  
*Why it matters:* Simple, interpretable; use CIs.

**Confidence interval (CI)** — Range around an estimate capturing uncertainty (e.g., 95%).  
*In practice:* For pass-rate `p` with `n` items, CI ≈ `±1.96·sqrt(p(1−p)/n)`.

**Win-rate / Pairwise preference** — Probability one output beats another in pairwise comparisons.  
*Why it matters:* Robust for ranking prompts/models.  
*In practice:* Randomize order; use Bradley–Terry/Elo for global scores if needed.

**LLM-as-judge** — Using a model to apply your rubric and output labels.  
*Why it matters:* Scales evaluation cheaply.  
*In practice:* Calibrate to a human gold set; monitor agreement over time.

**Faithfulness** — Degree to which the answer is supported by sources (no fabrication).  
*Why it matters:* Core anti-hallucination metric in RAG.  
*In practice:* Require citations; validate IDs programmatically.

**Completeness** — Whether the answer addresses all parts of the task.  
*Why it matters:* Partial answers frustrate users even if accurate.  
*In practice:* Encode as a rubric item with examples.

**Safety / Compliance** — Absence of prohibited content or policy violations.  
*Why it matters:* Legal and brand risk.  
*In practice:* Treat severe violations as **gates**; audit borderline cases.

**Helpfulness / Clarity / Tone** — UX quality dimensions.  
*Why it matters:* Drives user satisfaction and conversion.  
*In practice:* Rate with judges; keep short definitions to reduce noise.

**Calibration (judges)** — Checking judge agreement with trusted labels.  
*Why it matters:* Detects drift and inconsistency.  
*In practice:* Monthly checks or after model/vendor updates.

---

## D) Retrieval & RAG terms

**RAG (Retrieval-Augmented Generation)** — Pipeline that retrieves documents and uses them to ground the answer.  
*Why it matters:* Reduces hallucinations; updates with new knowledge.  
*In practice:* Evaluate both **retrieval quality** and **generation faithfulness**.

**Embedding** — Vector representation of text used for similarity search.  
*Why it matters:* Drives retrieval recall/precision.  
*In practice:* Choose multilingual embeddings if you serve PT/ES; track version.

**Vector store / Index** — Database for embeddings enabling nearest-neighbor search.  
*Why it matters:* Latency and recall depend on index choice/params.  
*In practice:* Log index version and `top_k` with traces.

**Chunking** — Splitting documents into pieces for indexing.  
*Why it matters:* Chunk size & overlap affect recall and context quality.  
*In practice:* Evaluate different chunking strategies; track per-domain recall.

**Recall@k** — Fraction of queries where a relevant doc is in the top-k retrieved.  
*Why it matters:* Necessary for grounded answers.  
*In practice:* Pair with **MRR**/**nDCG** and downstream faithfulness.

**MRR (Mean Reciprocal Rank)** — Average of `1/rank_of_first_relevant` document.  
*Why it matters:* Rewards high placement of the right doc.

**nDCG@k** — Ranking metric with graded relevance.  
*Why it matters:* Captures usefulness beyond “any hit”.

**Reranking** — Reordering retrieved docs using a stronger (often cross-encoder) model.  
*Why it matters:* Improves top positions without reindexing.  
*In practice:* Measure added latency vs quality lift.

**Citations / doc_id** — Identifiers of the source passages used in the answer.  
*Why it matters:* Enforces faithfulness and enables audits.  
*In practice:* Validate that cited IDs were actually retrieved.

---

## E) Tools, agents, and orchestration

**Tool / Function calling** — The model outputs a structured function call which your system executes (search DB, create ticket).  
*Why it matters:* Bridges language to deterministic actions.  
*In practice:* Track **tool-call validity**, **tool success rate**, and end-to-end **task success**.

**Agent** — A system that sequences multiple steps (think, call tools, observe results, continue) toward a goal.  
*Why it matters:* Powerful but harder to evaluate (many failure points).  
*In practice:* Evaluate **per-step** (tool success, trace validity) and **end-to-end** outcomes.

**Trace** — The full record of inputs, intermediate steps (retrieval chunks, tool calls), and outputs.  
*Why it matters:* Enables error analysis and reproducibility.  
*In practice:* Store with hashes of prompts, params, dataset IDs.

**Plan / Act / Reflect loops** — Patterns where the agent plans actions, executes, and reflects or revises.  
*Why it matters:* Can improve reliability but adds latency/cost.  
*In practice:* Cap the number of steps; evaluate **time-to-success** and **step count**.

---

## F) Data, labeling, and collaboration

**Inter-Annotator Agreement (IAA)** — How consistently multiple human raters label the same items.  
*Why it matters:* Low IAA means your rubric or training needs work.  
*In practice:* Compute simple percent agreement or Cohen’s kappa; run calibration sessions.

**Adjudication** — A senior rater resolves disagreements to create a final label.  
*Why it matters:* Produces trusted labels for the gold set.  
*In practice:* Reserve for high-impact or frequently disputed items.

**Active sampling** — Prioritizing items for labeling based on model uncertainty or disagreement.  
*Why it matters:* Cuts labeling cost while maximizing signal.  
*In practice:* Sample where confidence is low or outputs disagree across variants.

**Red-teaming** — Creating adversarial inputs designed to elicit unsafe or failing behavior.  
*Why it matters:* Surfaces risks early.  
*In practice:* Maintain a curated red-team set; run it in CI.

**Over-block / Under-block** — In safety filters, false positives vs false negatives.  
*Why it matters:* Over-blocking hurts UX; under-blocking risks harms.  
*In practice:* Track both; tune thresholds by severity.

**Calibration (rater training)** — Aligning raters on rubric use with examples and feedback.  
*Why it matters:* Improves IAA and label quality.  
*In practice:* Short training docs + practice rounds + periodic refreshers.

---

## G) Ops, monitoring, and decision-making

**Latency p50/p95/p99** — Median and tail response times.  
*Why it matters:* Users feel the tail; p95 often determines UX.  
*In practice:* Set SLOs by slice; budget in ship gates.

**Cost / request** — Total spend per request (tokens in/out, tool costs).  
*Why it matters:* Affects unit economics.  
*In practice:* Monitor alongside quality; build a Pareto view (quality vs cost vs latency).

**SLO / SLA** — Service Level Objective/Agreement (targets/commitments for performance).  
*Why it matters:* Guides thresholds and alerts.  
*In practice:* Tie eval budgets to SLOs (e.g., p95 ≤ 4s).

**A/B test** — Online experiment comparing variants on real users.  
*Why it matters:* Ground truth for business impact.  
*In practice:* Pair with safety monitors; run until you have enough power.

**Canary / Feature flag** — Rolling out to a small percentage first; toggling features on/off dynamically.  
*Why it matters:* Reduces risk during deployment.  
*In practice:* Use flags connected to your eval gates for fast rollback.

**Drift (model/data)** — Performance change over time due to vendor updates or user behavior shifts.  
*Why it matters:* Silent regressions happen even without code changes.  
*In practice:* Re-run holdouts on schedule; alert on significant deltas.

**Pareto frontier** — Set of options where you can’t improve one objective (quality, cost, latency) without worsening another.  
*Why it matters:* Guides model choice and parameter tuning.  
*In practice:* Prefer Pareto-efficient variants; document trade-offs.

**Reproducibility** — Ability to re-run an eval and get the same numbers.  
*Why it matters:* Builds trust and enables debugging.  
*In practice:* Version datasets, prompts, params; fix random seeds; store hashes.

**Decision memo** — Short document recording the evidence and rationale for a model/prompt rollout.  
*Why it matters:* Makes choices auditable; speeds future changes.  
*In practice:* Include foundation screen, application results, thresholds, risks, rollback plan.

---

## H) Common failure patterns (names to tag during error analysis)

- **Unsupported claim** — Statement not present in sources (RAG faithfulness).  
- **Missing key fact** — Omits amount/date/CTA required.  
- **Policy violation** — Offers unauthorized terms or reveals PII.  
- **Format violation** — Bad/missing JSON fields or enums.  
- **Tone mismatch** — Not respectful/firm as required.  
- **Retrieval miss** — Gold document not in top‑k.  
- **Tool failure** — Function call malformed or external system error.  
- **Over/under‑blocking** — Safety filters too strict/lenient.  
- **Long-context forget** — Loses earlier facts in a long input.  
- **Prompt brittleness** — Fails on paraphrases or punctuation variance.

Tagging with these names speeds Chapter 3’s taxonomy building.

---

## I) Quick reference tables

### I.1 Typical thresholds (starting points — adjust to your context)
- **JSON parse rate:** 100% (gate)  
- **Compliance violations:** 0 severe (gate)  
- **Faithfulness (0–3 judge avg):** ≥ 2.7 overall; **min slice ≥ 2.6**  
- **Latency p95:** ≤ 3.5–4.0s (per channel)  
- **Cost / req:** set per-margin; track along with quality deltas

### I.2 Dataset sizes (rule-of-thumb)
- **Smoke:** 20–50 items (fast PR check)  
- **Regression:** 200–800 items (nightly; includes failure modes)  
- **Holdout:** 300–1000+ items (frozen; ship decisions)

---

## J) Mini checklists you can paste into PRs

**Prompt & Params**  
- [ ] Role/Goal/Inputs/Rules/Output schema present  
- [ ] Inputs delimited; JSON strict; refusal path defined  
- [ ] `temperature/top_p/max_tokens/stop` pinned and logged

**Metrics & Labels**  
- [ ] Gates implemented (schema, safety, tool success)  
- [ ] Judge prompt versioned; calibrated vs gold set  
- [ ] Aggregation by slice with minima and CIs

**Datasets & Repro**  
- [ ] Smoke/regression/holdout versioned and documented  
- [ ] No holdout leakage; trace hashes stored  
- [ ] Decision table with thresholds and owners

---

### Final note
This glossary is a living artifact. As you discover new failure modes or invent new metrics, add them here so your team shares a **common vocabulary**—the fastest path to shipping reliable AI features.

---

*End of Lesson 2.7 — Glossary of Terms.*
