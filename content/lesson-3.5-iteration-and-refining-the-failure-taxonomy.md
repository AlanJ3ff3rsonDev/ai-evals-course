# AI Evals for Engineers & PMs  
## Lesson 3.5 — Iteration and Refining the Failure Taxonomy

> **How this fits:**  
> • 3.1 gave you a starting dataset.  
> • 3.2 taught you to read traces and label failures (open coding).  
> • 3.3 organized those labels into a **taxonomy**.  
> • 3.4 turned the taxonomy into a **repeatable labeling workflow**.  
> **Now** we close the loop: a disciplined **iteration playbook** that uses those labels to drive improvements—and a clear process to **refine the taxonomy** without breaking your numbers.

---

### Learning objectives
By the end you will be able to:
1. Choose **what to fix first** using a Pareto view and simple ROI scoring.  
2. Design **safe experiments** (offline first) for each failure‑mode category: generation, retrieval, format, safety/compliance, dialog/state, and tools/agents.  
3. Run an **iteration cycle** that updates prompts, retrieval, parameters, or models while protecting against regressions via CI, regression sets, and holdouts.  
4. Evolve your taxonomy **on purpose** (merge/split/add/retire) with versioning, mapping tables, and agreement checks.  
5. Produce the artifacts that make progress legible: **Iteration Brief**, **Change Log**, **Taxonomy Change Request (TCR)**, and **Release Note**.

---

## 1) The Iteration Flywheel (copy/paste)

> **Decide → Change → Evaluate → Diagnose → Consolidate → Deploy**

1) **Decide** a target failure mode (or two) using:  
   - **Weighted frequency** = (% of items with the mode) × **severity weight** (Critical=3, Major=2, Minor=1).  
   - **Slice pain** (where users actually feel it).  
   - **Leverage** (how fixable it is).

2) **Change** one variable at a time if possible: prompt, retrieval settings, schema, safety policy, tool logic, parameters, or model.

3) **Evaluate offline** on **smoke + regression** (and only touch holdout for ship/no‑ship). Report per‑slice with CIs.

4) **Diagnose** remaining failures; add fresh exemplars to **regression**; update hypotheses.

5) **Consolidate**: version prompts, datasets, and taxonomy; update CI thresholds if warranted.

6) **Deploy** behind a flag; monitor online gates; rollback plan ready.

Repeat weekly; small steady gains beat big sporadic changes.

---

## 2) Choosing targets with a Pareto view (impact first)

Start from your labeled report (3.4). Build a simple table:

| Failure Mode | Overall rate | Weighted rate | Top slices | Business risk | Effort (S/M/L) |
|---|---:|---:|---|---|---|
| FM‑GEN‑COMP‑CTA_MISSING | 18% | 0.36 | PT‑WA | Conversion loss | S |
| FM‑GEN‑COMPLY‑UNAUTHORIZED_DISCOUNT | 7% | 0.21 | PT‑WA | Legal/compliance | M |
| FM‑FMT‑CLEAR‑JSON_ENUM_INVALID | 5% | 0.05 | All | Pipeline breaks | S |
| FM‑RET‑FAITH‑GOLD_NOT_IN_TOPK | 10% | 0.20 | ES‑Email | Hallucination risk | M |

**ICE score** (Impact × Confidence × Ease) works well. Tackle **one quality** and **one safety/format** mode per iteration to balance user value and risk.

---

## 3) Experiment design: make improvements real (not noise)

**Principles**
- **Use the same dataset** before/after (regression) to remove sampling variance.  
- **Hold temperature constant** (often 0–0.3) and pin other params.  
- **Version every artifact**: `prompt_v12`, `retrieval_v3`, `taxonomy tax_v1.1`.  
- **Run slice‑wise** and compute **CIs** for pass‑rates.  
- For generation metrics, require improvement in **mean** *and* **min slice**.  

**Sample‑size sanity** (for pass‑rate ∆ detection):  
- To detect a **10 percentage‑point** change near 70% with 95% confidence, you need ~**n=200** items.  
- For **5 pp** change, ~**n=800**. (Rules of thumb—don’t wait for perfection; use the data you have and iterate.)

**Non‑inferiority guardrails**  
- When changing models/params, set a **non‑inferiority margin** (e.g., worst slice quality must not drop >2 pp; p95 latency must not rise >0.3s).

**Variant hygiene**  
- Name variants clearly: `collectai_prompt_v12a_cta-rule`, `retrieval_v3_topk8_rerank`.  
- Change **one thing** when feasible; otherwise, document a mini ablation plan.

---

## 4) Playbooks by failure‑mode category

### A) Generation (content quality & compliance)

**Common fixes**
- **Prompt rules**: add explicit requirements (“Include an explicit CTA in the last sentence; start with a verb”).  
- **Counter‑examples**: few‑shot pairs that show *what not to do* (e.g., offering discounts) with corrections.  
- **Output schema**: add a field (`cta_required: true`) so a **gate** can block when missing.  
- **Formatting guardrails**: require **function calling** or **strict JSON** to reduce formatting drift.  
- **Refusal path**: “If policy lacks permission, reply with refusal JSON.”

**Mini checklist**
- [ ] Rule phrasing is **specific** (“end with ‘Vamos agendar…’ or ‘Visite…’”), not abstract.  
- [ ] 2–4 compact examples cover the edge.  
- [ ] JSON schema updated; CI gate added; regression items frozen.  
- [ ] No collateral damage to tone/length (check slice minima).

**CollectAI example**  
- Add `RULE: The message MUST end with one CTA sentence using an imperative verb.`  
- Few‑shot: include *bad* “no CTA” example and *good* corrected message.  
- Result target: `CTA_MISSING` rate ↓ from 18% → ≤ 6% without tone drop.

---

### B) Retrieval (RAG)

**Knobs to try (one at a time)**
- **Chunking**: size 400–800, overlap 40–120.  
- **Index**: switch from flat → HNSW; adjust `ef_search`; try a reranker.  
- **Query rewrite**: prepend policy keywords; generate bilingual queries.  
- **Top‑k**: raise to 6–10 (watch latency).  
- **Filters**: by merchant/policy version.

**Eval design**
- Use a small **retrieval gold set** (queries with known relevant passages).  
- Track **Recall@k**, **MRR**, and downstream **faithfulness**.  
- Watch for duplicated chunks choking variety.

**CollectAI example**  
- Problem: `GOLD_NOT_IN_TOPK` high for ES‑Email.  
- Fix: bilingual query rewrite + rerank step.  
- Target: Recall@5 +12 pp; faithfulness violations −50% in ES slice; p95 latency +≤0.2s.

---

### C) Format (schemas, enums, length)

**Fixes**
- Migrate to **function calling** so the model emits a structured call (less brittle than freeform JSON).  
- Add **parsing retries** with `temperature=0`, or a **repair step** (but record as a failure mode).  
- Enforce **enum values** and **length limits** with gates; instruct model with examples.

**Checklist**
- [ ] Schema file versioned and referenced in the prompt.  
- [ ] “Return only JSON” and `stop` tokens set.  
- [ ] Regression suite has 10–20 format‑trap items.  
- [ ] p95 “parse time” monitored; repair step doesn’t mask quality issues.

---

### D) Safety & Compliance

**Fixes**
- Pre‑classify intent with a lightweight policy **guard**; short‑circuit unsafe flows.  
- Strengthen refusal text: “I can’t offer discounts. Allowed options are A/B/C.”  
- Add a **policy verbatim** snippet to the prompt (ground refusal).  
- Maintain a **red‑team set**; run it in CI and report by severity.

**Targets**
- Severe violations = **0** (gate).  
- Borderline/soft issues trend downward (Major → Minor), with no decrease in helpfulness in allowed cases.

---

### E) Dialog / State (multi‑turn)

**Fixes**
- Track **conversation state** explicitly (JSON state object stored server‑side).  
- Summarize state each turn using a **state‑update prompt** (short, structured).  
- Add **invariants** (“if identity verified=true, do not ask again”).  
- Cap **step count**; add a *“goal not reached after N turns”* mode and a guardrail/hand‑off.

---

### F) Tools / Agents

**Fixes**
- Harden function schemas; add **idempotency keys**; set **retry/backoff** policy.  
- Log tool **success rate**; differentiate **malformed call** vs **external failure**.  
- Add **simulators** for deterministic test coverage (e.g., mock payment link API).

**Eval**  
- Compute **tool call validity** (gate) and **tool success rate** separately from end‑to‑end task success.

---

## 5) A concrete iteration (end‑to‑end walkthrough)

**Target**: `FM‑GEN‑COMP‑CTA_MISSING` (18% overall, PT‑WA heavy).  
**Hypothesis**: Adding an explicit rule + example pairs will reduce misses without harming tone.  
**Change**: Prompt v12 adds `RULE` and two example pairs; no other changes.

**Plan**  
1. **Datasets**: run on regression_v3 (n=320, stratified) and smoke_v4.  
2. **Metrics**: CTA gate pass‑rate; completeness (0–3), tone (0–3); p95 latency.  
3. **Success**: CTA_MISSING ≤ 6% overall; **min slice ≤ 8%**; tone ≥ baseline −0.1; latency Δ ≤ +0.1s.  
4. **Risks**: Over‑templated ending; longer messages.  
5. **Backout**: revert to prompt_v11 via flag.

**Results** (example)  
- CTA_MISSING: 18% → 5% overall (PT‑WA 24% → 7%).  
- Tone: 2.85 → 2.83 (ns). Length +35 chars (OK).  
- p95 latency +0.05s.  
**Decision**: Accept. Freeze 8 new tricky CTA examples into **regression_v4**.

**Release note**  
- “Prompt v12 enforces CTA rule; CTA failure rate −72%. Added 8 new regression items; thresholds updated.”

---

## 6) Refining the taxonomy without chaos

Taxonomies evolve. Do it with **governance** so metrics stay comparable.

### When to **merge**
- Two modes share the same fix path and annotators confuse them often.  
- Their separate counts no longer inform different actions.

### When to **split**
- One mode hides **distinct causes** with different fixes (e.g., `UNSUPPORTED_CLAIM` → `NO_CITATIONS` vs `CONTRADICTS_POLICY`).  
- Disagreements cluster along a natural boundary.

### When to **retire**
- Mode < 1% for 3 releases **and** adds no diagnostic value. Keep 1–3 regression seeds but archive the mode.

### Process: **Taxonomy Change Request (TCR)**
1. Proposer fills a 1‑pager: current pain, proposed change (merge/split/add/retire), **before/after examples**, impact on metrics/datasets.  
2. Reviewer (taxonomy “benevolent dictator” or committee) approves in a weekly slot.  
3. Apply change: bump **taxonomy version** (e.g., `tax_v1.0 → v1.1`), update **mapping open→mode** table, migrate labels.  
4. **Recalibrate**: sample 30 items; check agreement (target ≥0.8 exact on mode IDs).  
5. Update **regression** and **CI** thresholds if definitions changed materially.

**Mapping & migration**  
- Maintain `mode_id_map.csv` with columns `old_id,new_id,rule`.  
- Recompute historical counts using the map; annotate charts with a vertical line “Taxonomy v1.1”.

---

## 7) Dashboards & decision views (what to watch)

- **Failure‑mode Pareto** (stacked by severity).  
- **Slice heatmap** (mode × slice).  
- **Trend lines** per top mode (last 6 releases).  
- **Gate pass‑rates** & **ops** (p95 latency, $/req).  
- **Drill‑down** to exemplar traces (for each mode and slice).

Keep a **one‑pager** per release summarizing deltas and decisions; paste into PRs and share with stakeholders.

---

## 8) Common pitfalls (and antidotes)

1. **Changing too many things at once** → can’t attribute improvement.  
   - *Fix:* isolate variables; run ablations; document multiple changes.

2. **Optimizing the average** while one slice regresses.  
   - *Fix:* enforce **min slice** thresholds; ship only if all clear.

3. **Overfitting to the holdout/regression** (leakage).  
   - *Fix:* keep holdout frozen; rotate fresh real traces into regression; audit few‑shot examples for overlap.

4. **Chasing synthetic wins** that don’t translate to production.  
   - *Fix:* ensure majority of regression is from **real logs**; monitor online.

5. **Silent taxonomy drift** breaks comparability.  
   - *Fix:* TCR + versioning + recalibration; annotate dashboards on taxonomy changes.

6. **Ignoring ops** (latency/cost) during quality pushes.  
   - *Fix:* include ops in success criteria; monitor Pareto (quality vs latency vs cost).

7. **No owner** for top modes → slow progress.  
   - *Fix:* assign **DRIs** and track in sprint boards.

---

## 9) Templates (steal these)

**A) Iteration Brief (half page)**  
```
Objective: Reduce FM-GEN-COMP-CTA_MISSING from 18% to ≤6% without tone drop.
Hypothesis: Add explicit CTA rule + counter-examples.
Variant: prompt_v12 (diff from v11).
Datasets: smoke_v4 + regression_v3 (stratified), holdout_v2 for final check.
Metrics: CTA gate pass-rate; completeness/tone (0–3); p95 latency; min-slice rule.
Success: Achieve targets; no other mode rises >2pp; ops within budget.
Risks: Templated feel; longer messages.
Plan: Implement → offline eval → error analysis → freeze new items → canary 10% → expand.
Owner: pm_ana; Reviewer: eng_maria; Date: 2025-08-09.
```

**B) Taxonomy Change Request (TCR)**  
```
Proposal: Split FM-GEN-FAITH-UNSUPPORTED_CLAIM into (1) CONTRADICTS_POLICY and (2) NO_CITATIONS.
Rationale: Different fixes; 37% of disagreements come from this confusion.
Examples: t_0123 → CONTRADICTS_POLICY; t_0772 → NO_CITATIONS.
Impact: Labels need remap; judge prompt update; regression seeds repartitioned.
Version bump: tax_v1.0 → tax_v1.1
Approval: ( ) Yes ( ) No — Owner/Date
```

**C) Release Note (short)**  
```
Release R14: Prompt v12; CTA_MISSING −72%; JSON_ENUM_INVALID −60% via function calling.
Added 18 regression items; updated tax_v1.1; CI thresholds tightened.
No latency/cost regression; canary → full rollout.
```

---

## 10) Micro‑exercises (60–90 minutes)

1. **Pick a top failure mode** from your latest report. Fill an **Iteration Brief**.  
2. Implement the smallest change (prompt rule or retriever tweak).  
3. Run the **offline eval** on smoke+regression; compute deltas and CIs by slice.  
4. Add 5–10 new exemplars to **regression**; write a 5‑line **Release Note**.  
5. If you uncovered recurring confusion between two modes, submit a **TCR** and bump taxonomy to `tax_v1.x`.

Deliverables: `iteration_brief.md`, `eval_report.md` (before/after tables), `regression_vX.json` (new items), `release_note.md`, and (if applicable) `tcr.md` + `mode_id_map.csv`.

---

## 11) What to bring into 3.6 (Common Pitfalls)

- Your last two iteration reports with **before/after** numbers.  
- Current **taxonomy version** and any pending TCRs.  
- A shortlist of **modes that didn’t improve** and your hypotheses why.  
- Any slices where **ops trade‑offs** appeared.  

We’ll stress‑test your process against traps teams fall into and show how to dodge them.

---

### Key takeaways
- Treat iteration as a **controlled experiment**, not a vibe shift.  
- Improve quality **and** protect safety/ops with explicit success criteria.  
- After each iteration, **freeze new failures** into regression so wins stick.  
- Govern taxonomy changes with **TCRs, versions, and recalibration**.  
- Share progress with **one‑pagers and dashboards** so decisions are quick and defensible.

---

*End of Lesson 3.5 — Iteration and Refining the Failure Taxonomy.*
