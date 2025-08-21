# AI Evals for Engineers & PMs  
## Lesson 2.5 — Eliciting Labels for Metric Computation

> **Why this lesson matters:** In Lesson 2.3 you learned to define metrics. But metrics are only as good as their **labels**—the ground you stand on. This lesson shows you **how to get trustworthy labels** (from humans and/or LLMs), turn messy judgments into clean numbers, and do it cost‑effectively.

We’ll move from first principles to practical playbooks you can copy into your project tomorrow.

---

### How this connects to the course so far
- **Chapter 1** gave you the evaluation mindset and lifecycle.  
- **2.1–2.2** taught you what LLMs can/can’t do and how to express intent via prompts.  
- **2.3** turned rubrics into metrics.  
- **2.4** placed those metrics in a two‑layer stack (foundation vs application).  
- **This lesson (2.5)** makes the metrics *computable* by showing how to elicit reliable **labels**.

---

## 1) What is a label? (crisp definition)
A **label** is a structured judgment about an (input, output) pair that your metric can consume.  
Examples:
- `pass/fail` (task success)  
- `0–3` Likert scores per rubric item (grounding, completeness, tone, safety)  
- `class = {FRAUD, NOT_AS_DESCRIBED, NON_RECEIPT}` (classification)  
- `citations = ["doc:7#p2"]` (support for factual claims)  
- `A beats B` (pairwise preference)

**Rule:** If your metric can’t read it **without guessing**, it’s not a usable label.

---

## 2) Label schema design (make it easy to be consistent)

Great labels start with a **schema** that is:
- **Minimal** (only fields you need for metrics)  
- **Unambiguous** (enums, ranges, definitions)  
- **Machine‑checkable** (JSON with strict types)

**Example schema for a RAG answer:**  
```json
{
  "grounding": 0,   // 0–3 (0=none, 3=fully supported with citations)
  "completeness": 0,
  "safety": 0,
  "clarity": 0,
  "citations_valid": true,  // all citations refer to provided doc_ids
  "notes": "one or two sentences"
}
```
**Why it helps:** Your metric aggregator simply averages scores, checks booleans, and you’re done. No prose archaeology.

> **Tip:** Bake the **rubric definitions** right into the labeler UI or judge prompt so raters don’t improvise.

---

## 3) Sources of labels (four main paths)

### A) Human experts (SMEs)
- **When to use:** domain‑specific policies, compliance, or high‑risk tasks.  
- **Pros:** highest trust; handles nuance.  
- **Cons:** expensive; slower; availability bottlenecks.

### B) Trained crowd / internal annotators
- **When to use:** medium‑risk quality judgments, large volumes.  
- **Pros:** scalable; affordable.  
- **Cons:** requires training, QA, and spot checks.

### C) LLM‑as‑judge
- **When to use:** you have a clear rubric and need scalable, cheap, fast judgments.  
- **Pros:** speed; low cost per item; consistent once calibrated.  
- **Cons:** can drift; may be biased or over‑lenient without careful prompt design.

### D) Programmatic/heuristic labels (“weak supervision”)
- **When to use:** simple objective checks (schema validity, contains keyword, price within tolerance).  
- **Pros:** free and deterministic.  
- **Cons:** limited to what can be coded; can be gamed.

**Most robust setups are hybrids**—use programmatic gates + LLM judge for quality + periodic human audits.

---

## 4) Designing instructions that produce **consistent** labels

Whether labeling is done by humans or an LLM, provide:

1. **Task statement** — one sentence: “Decide if the answer is fully grounded in the provided documents.”  
2. **Rubric with definitions** — what each score means (0,1,2,3) with **short, concrete examples**.  
3. **Counter‑examples** — show **borderline** and **bad** cases (contrastive).  
4. **Edge rules** — tie‑breakers for ambiguous cases (e.g., “If no documents are provided, set `grounding=0` and `citations_valid=false`”).  
5. **Output schema** — exact JSON fields with enums and ranges.  
6. **Refusal conditions** — “If the model output contains PII, set `safety=0` and add note `PII`.”

**Why:** If two raters can’t apply the rubric the same way, your metrics will be noisy and misleading.

---

## 5) Building the labeling workflow (nuts and bolts)

A solid workflow has these steps:

1. **Sampling** — Stratify by slices (language, persona, channel) so every important group is represented.  
2. **Assignment** — Give each item to **2+ raters** for redundancy (humans) or **1 LLM judge + 1 human audit** (LLM).  
3. **Quality control** — Insert **gold questions** with known answers; compute rater accuracy against them.  
4. **Disagreement handling** — Majority vote; or **adjudication** by a senior rater when conflict persists.  
5. **Calibration meetings** — Review disagreements weekly; refine rubric/examples.  
6. **Versioning** — Freeze rubric version; bump when rules change (`rubric_v3`).  
7. **Storage** — Save labels with `item_id`, `rater_id`, `timestamp`, `rubric_version`, and **hashes** of inputs/outputs for reproducibility.

**Tooling options:** simple spreadsheets, custom web forms, labeling platforms, or inline in your trace viewer. Start simple; evolve as volume grows.

---

## 6) LLM‑as‑judge: making it reliable

LLM judges need a **tight prompt** (role + rubric + JSON output) and **calibration**:

- **Prompt shape:** include the rubric with concise definitions and 1–2 good/bad examples per item. Force **JSON** output and low temperature.  
- **Gold comparison:** Label 50–100 items with trusted humans; compare LLM labels (agreement rate or correlation).  
- **Bias checks:** Randomize candidate order in pairwise comparisons; hide model identities.  
- **Drift monitoring:** Re‑check agreement monthly or after vendor/model changes.  
- **Escalation:** If the judge marks `safety=0` or `citations_valid=false`, route to **human confirmation** before blocking deploys.

**Decision rule:** You don’t need perfect alignment; you need **stable ranking** and **reliable gates** that block obvious failures.

---

## 7) How many labels do I need? (back‑of‑the‑envelope)

Use **tiered datasets** to keep costs sane:
- **Smoke set (20–50 items):** runs on every PR.  
- **Regression set (200–800):** runs nightly; targeted at known failure modes.  
- **Holdout (300–1000+):** representative, frozen; used for ship decisions.

For proportions (e.g., pass‑rate), a 95% confidence interval is roughly:  
`± 1.96 · sqrt(p · (1 − p) / n)`.  
So with `n=400` and `p≈0.8`, your CI is about `± 0.04` (±4pp), usually enough to tell real improvements from noise.

---

## 8) Turning raw labels into clean metrics

Once you have labels, you must **aggregate** and **decide**:

- **Redundancy merging (humans):** majority vote for categorical; average for Likert; escalate ties.  
- **Rater reliability:** track per‑rater accuracy on golds; down‑weight or flag low performers. (Advanced: Dawid–Skene/GLAD.)  
- **Slice reporting:** compute metrics per slice; enforce **minima** (“no slice < 2.6”).  
- **Gates first:** schema valid? safety pass? If not, **score=0** regardless of other labels.  
- **Decision tables:** document thresholds and what action follows (ship/rollback/iterate).

---

## 9) Costing and throughput (make it real)

**Human time estimates (ballpark):**  
- Simple pass/fail or 0–3 rubric: **15–45 seconds** per item after training.  
- Complex multi‑turn chat review: **1–3 minutes** per conversation.

**LLM judge cost:** usually **$0.000–$0.01** per item depending on model + context.

**Strategies to save cost without losing quality:**  
- Label **by slices**: over‑sample rare/critical segments; under‑sample trivial ones.  
- **Active sampling:** prioritize items where models disagree or confidence is low.  
- **Gold recycling:** reuse golds across releases to track drift.  
- **Semi‑automated audits:** let the LLM propose a label and a short justification; humans skim and approve/reject quickly.

---

## 10) Example end‑to‑end (CollectAI negotiation assistant)

**Goal:** Evaluate if replies are persuasive, compliant, grounded in policy, and well‑formatted for WhatsApp.

**Label schema (JSON):**
```json
{
  "grounding": 0,        // 0–3
  "completeness": 0,     // balance + allowed options + CTA present
  "tone": 0,             // respectful & firm
  "compliance": 0,       // 0=violation, 3=fully compliant
  "citations_valid": true,
  "format_valid": true,  // JSON schema gates
  "notes": ""
}
```

**Labeling plan:**  
- 600 examples: PT/ES × 3 debtor personas × WA/email.  
- **Gates:** `format_valid` and PII check must be true.  
- **LLM judge** does first pass; **human audit** 20% random + 100% of any `compliance ≤ 1`.  
- Weekly **calibration** on 50 disputed items.  
- **Aggregation:** average Likert scores, compute per‑slice metrics, track p95 latency and cost.

**Decision:** Ship only if average ≥ 2.7, no slice < 2.6, 0 severe compliance violations, p95 ≤ 3.5s, cost ≤ $0.010. If fails, run error analysis and expand regression set with failing items.

---

## 11) Common pitfalls (and how to dodge them)

1. **Vague instructions** → inconsistent labels.  
   - *Fix:* Write minimal, example‑rich rubrics; include tie‑breakers.

2. **One rater per item** → noisy metrics.  
   - *Fix:* Add redundancy or audit samples; compute inter‑rater stats.

3. **Uncalibrated LLM judge** → silent drift.  
   - *Fix:* Maintain a human‑gold set; re‑check agreement periodically.

4. **Ignoring slices** → average looks good while a market suffers.  
   - *Fix:* Always compute per‑slice metrics and enforce minima.

5. **No versioning** → can’t compare releases.  
   - *Fix:* Version datasets, rubrics, label prompts, and store hashes.

6. **Labeling the holdout during iteration** → leakage.  
   - *Fix:* Keep holdout frozen and hidden; iterate on dev/regression sets only.

---

## 12) Micro‑exercise (do it now)

Pick a task you care about. Write:

1. A **label schema** (JSON) with only the fields your metric needs.  
2. A **one‑page instruction** with: task statement, 0–3 rubric definitions, 1 positive & 1 negative example, edge rules, and the output schema.  
3. Your **redundancy plan** (LLM judge only? LLM + human audit? two humans + adjudication?).  
4. Your **slice plan** (which segments; how many per slice).

If you can do those four steps, you’ve made your metrics computable and reliable.

---

## 13) Key takeaways

- Labels are **structured judgments** your metrics can consume without guessing.  
- Design **schemas and instructions** that make judgments consistent.  
- Use a **hybrid approach**: code gates + LLM judge + human audits.  
- Control cost with **tiered datasets**, **active sampling**, and **slice‑aware** labeling.  
- Version everything; monitor judge/human **agreement** to catch drift.

---

*End of Lesson 2.5 — Eliciting Labels for Metric Computation*

