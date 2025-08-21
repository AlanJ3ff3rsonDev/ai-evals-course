# AI Evals for Engineers & PMs  
## Lesson 3.8 — Exercises (Hands‑On Error Analysis)

> **Purpose:** Cement everything from Chapter 3 by doing it end‑to‑end. These exercises map 1‑to‑1 to Lessons **3.1 → 3.7**. You can complete them with a spreadsheet, a notebook, and a lightweight labeling UI (even a shared Google Sheet).  
> **Deliverable style:** short, practical artifacts you can drop into a repo. Every task has **acceptance criteria**, **time estimates**, and **stretch goals**.

---

### Exercise Pack Overview (do in order)
1. **E3.1 Bootstrap a Starting Dataset** — Build a stratified sample with provenance and a frozen holdout.  
2. **E3.2 Open Coding** — Label 120 traces with observable codes + evidence spans.  
3. **E3.3 Axial Coding** — Merge codes into a Phase × Rubric taxonomy; write Failure‑Mode Cards.  
4. **E3.4 Labeling at Scale** — Define a label schema, write a codebook, run a calibration with 2 annotators + an LLM‑judge.  
5. **E3.5 Iteration Cycle** — Pick one failure mode, implement the smallest fix, and run an offline eval.  
6. **E3.6 Pitfall Audit** — Stress‑test your setup with the 21‑item checklist; file two fixes.  
7. **E3.7 Chapter Summary Board** — Create a one‑page operational charter and dashboard sketch.

Each exercise lists **what to submit**. Keep your answers compact but **evidence‑rich** (screenshots of traces, snippets, or small tables are great).

---

## E3.1 — Bootstrap a Starting Dataset (from Lesson 3.1)
**Goal.** Assemble a **stratified** dataset of real traces (plus a few synthetic edge cases), and freeze a **holdout** split.

**Steps**
1. Export 600–1000 recent production items (or realistic samples) with metadata: `lang`, `persona`, `channel`, `intent`, `created_at`, and text fields.  
2. Define slices you care about (e.g., `lang∈{pt,es}`, `channel∈{whatsapp,email}`, `persona∈{new,returning}`).  
3. Stratify into splits: **smoke** (50), **regression** (300), **holdout** (200+), remainder as **dev**.  
4. Add a `provenance` column: `log` vs `synthetic` and the generator/prompt if synthetic.  
5. Save CSV/Parquet and a short **README.md** describing selection rules.

**Acceptance criteria**
- A table that shows **counts by slice** per split (smoke/regression/holdout).  
- ≥60% **log** provenance overall; **holdout is 100% log** and **frozen**.  
- A **data card** (half page) listing known biases and what’s *not* covered.

**Stretch goals**
- Add 12–20 **adversarial** items for smoke tests (jailbreaks, schema traps).  
- Compute input **length distribution** and compare to production; comment on mismatches.

---

## E3.2 — Open Coding: Read and Label Traces (from Lesson 3.2)
**Goal.** Produce **observable** codes with evidence spans—no diagnosis yet.

**Steps**
1. Randomly sample **120** items from **regression** (stratified by slice).  
2. For each, read INPUT → OUTPUT (and tools/retrieval if present).  
3. Assign **1–3 short codes** (e.g., `Missing CTA`, `Unsupported claim`, `JSON invalid`).  
4. Highlight/copy the **evidence text** and paste as a field; keep **char indices** if your UI supports it.  
5. Track **severity** (minor/major/critical) using a simple rubric.

**Acceptance criteria**
- A table `item_id, codes[], evidence_text, severity, slice` for 120 items.  
- At least **20 unique codes**, each with ≥3 examples.  
- A 10‑line **annotation log**: ambiguities you noticed and how you resolved them.

**Stretch goals**
- Compute **inter‑coder agreement** by double‑labeling 30 items with a colleague and calculating percent agreement.  
- Pre‑cluster codes by **co‑occurrence** (e.g., `Unsupported claim` often co‑occurs with `Gold not in top‑k`).

---

## E3.3 — Axial Coding: Structuring & Merging (from Lesson 3.3)
**Goal.** Convert codes into a **Phase × Rubric** taxonomy with stable IDs and Failure‑Mode Cards.

**Steps**
1. Draw the Phase × Rubric grid (phase: retrieval/generation/format/tool/safety/dialog; rubric: faithfulness/completeness/compliance/tone/clarity).  
2. Drag codes into cells; **merge by fix path**, **split by distinct cause**.  
3. Assign **IDs** like `FM-GEN-COMP-CTA_MISSING`.  
4. Draft **Failure‑Mode Cards** for the top 5 (definition, decision rules, severity guidance, examples, owner).  
5. Produce a `open_code → mode_id` **mapping table**.

**Acceptance criteria**
- A `taxonomy_v1.json` with **20–40** active failure modes.  
- Five **Failure‑Mode Cards** (one page each or concise table rows).  
- A **Pareto** table: top modes with weighted frequency and top failing slices.

**Stretch goals**
- A short **TCR** (Taxonomy Change Request) proposing one merge/split with before/after examples.  
- Include **owner** per mode and a plan for **regression seeds** (3–10 per top mode).

---

## E3.4 — Labeling at Scale (from Lesson 3.4)
**Goal.** Turn the taxonomy into a reliable labeling process with humans + LLM‑judge.

**Steps**
1. Create a `label_schema.json` and a 4–6 page **annotator guide** (decision rules + examples).  
2. Label **80 items** with **two human annotators** (overlap 20 items).  
3. Run an **LLM‑as‑judge** on the same 80; force it to return mode IDs and evidence text.  
4. **Merge** labels (union by mode; severity = max; adjudicate disagreements) into `labels.parquet`.  
5. Write a **Label Quality Report**: agreement rates (human‑human; human‑judge), top confusion pairs, and guide updates.

**Acceptance criteria**
- Agreement ≥ **0.75** on mode IDs (exact) for the 20‑item overlap; severity disagreement ≤ ±1.  
- The judge achieves ≥ **0.85** agreement on a small **gold** subset (10 items) or is flagged for retraining.  
- Labels saved with **taxonomy_version** and **rubric_version** fields.

**Stretch goals**
- Add **active sampling**: label items where two model variants disagree or judge confidence is low; compare error yield vs random.  
- Plot **per‑mode rates** with Wilson intervals for the 80‑item run.

---

## E3.5 — Iteration Cycle (from Lesson 3.5)
**Goal.** Reduce one high‑impact failure mode without harming others.

**Steps**
1. Pick one target from your Pareto (e.g., `FM-GEN-COMP-CTA_MISSING`).  
2. Write an **Iteration Brief** (objective, hypothesis, variant, datasets, metrics, success criteria, risks, owner).  
3. Implement the **smallest change** (prompt rule, counter‑examples, top‑k bump, function‑call schema, etc.). Name it `variant_vX`.  
4. Run **offline eval** on **smoke + regression**; compute deltas by **slice** with CIs; check **gates** and **ops** (p95 latency, $/req).  
5. Freeze **5–10** new exemplar failures into the regression set.

**Acceptance criteria**
- A before/after table for the target mode and 3–5 sentinel modes; **min‑slice rule** satisfied.  
- A one‑page **Release Note** summarizing the change and results.  
- Updated `regression_vX.json` with new seeds.

**Stretch goals**
- Do a small **ablation** (turn the change off/on) to isolate what actually helped.  
- Canary to **10% traffic** for 24h and paste an **online** comparison of gates/ops.

---

## E3.6 — Pitfall Audit (from Lesson 3.6)
**Goal.** Guard against silent but common failures.

**Steps**
1. Paste the **21‑item pre‑mortem checklist** from 3.6 into `pitfall_audit.md`.  
2. Mark each item **Green/Yellow/Red**, with one‑line justification and a link to evidence (screenshot or small table).  
3. File **two tickets**: (a) a **process** fix (e.g., leakage check in CI), and (b) a **product** fix (e.g., strengthen refusal rule).  
4. Add the checklist to your PR template.

**Acceptance criteria**
- At least **one Red** turned **Green** via a documented change in this sprint.  
- CI shows a new **trap** or **gate** added (screenshot or short description).

**Stretch goals**
- Build a **debug triage tree** diagram for your product (format/tool → retrieval → generation → dialog/state).

---

## E3.7 — Chapter Summary Board (from Lesson 3.7)
**Goal.** Make the whole engine legible to your team.

**Steps**
1. Draft a **one‑page charter**: purpose, Phase × Rubric grid, top 5 modes with owners, weekly cadence, CI checks, dashboards.  
2. Sketch a **dashboard** (Figma, slides, or a notebook screenshot) showing: Pareto by mode × slice, trend lines, gates, and ops.  
3. Share with your team and collect **two feedback quotes**; incorporate one change.

**Acceptance criteria**
- Charter saved as `error-analysis-charter.md`.  
- Dashboard sketch that could be implemented next sprint.  
- Quotes and the change you made.

**Stretch goals**
- Wire up a tiny **live** view: a notebook that reads `labels.parquet` and renders the Pareto + min‑slice table.

---

## Templates (copy/paste)

**A) `label_schema.json` (minimal)**
```json
{
  "schema_version": "1.0",
  "fields": {
    "item_id": "string",
    "labels": [{
      "mode_id": "string",
      "severity": "minor|major|critical",
      "evidence_text": "string",
      "phase": "enum",
      "slice": {"lang":"string","persona":"string","channel":"string"}
    }],
    "gates": {"json_valid":"bool","enum_valid":"bool","citations_valid":"bool","pii_blocked":"bool"},
    "judge_scores": {"faithfulness":"int","completeness":"int","tone":"int","compliance":"int"},
    "meta": {"coder_id":"string","taxonomy_version":"string","rubric_version":"string","timestamp":"string"}
  }
}
```

**B) Failure‑Mode Card (Markdown)**
```
# FM-GEN-COMP-CTA_MISSING
**Definition**: Output lacks an explicit call to action.
**Decision rules**: End of message must contain a verb-led CTA (e.g., "Visite...", "Agende...").
**Severity**: Major by default; Critical if policy mandates CTA to proceed.
**Examples**: [t_0123], [t_0455] with spans.
**Non-examples**: CTA present but weak phrasing → not this mode.
**Fix ideas**: Add rule; include negative/positive examples; enforce `cta_required` gate.
**Owner**: pm_ana
```

**C) Iteration Brief (half page)**
```
Objective: Reduce FM-... from X% to ≤Y% without harming Z.
Hypothesis: <smallest change likely to help>.
Variant: <name and exact diff>.
Datasets: smoke_v?, regression_v?; holdout_v? for final check only.
Metrics: target mode rate; sentinel modes; min-slice rule; p95 latency; $/req.
Success: <numeric targets + non-inferiority>.
Risks: <templating, cost, length>.
Plan: implement → offline eval → freeze new seeds → canary → release note.
Owner: <name>   Date: <YYYY-MM-DD>
```

**D) TCR — Taxonomy Change Request**
```
Change type: Merge|Split|Add|Retire
From/To: FM-OLD → FM-NEW1, FM-NEW2
Why now: frequent confusion; different fixes; <evidence>
Impact: labels to remap; judge prompt update; regression edits
Version: tax_v1.0 → tax_v1.1
Approval: <name/date>
```

**E) Wilson interval helper (Python)**
```python
from math import sqrt
def wilson(p, n, z=1.96):
    denom = 1 + z**2/n
    center = (p + z*z/(2*n))/denom
    margin = (z*sqrt((p*(1-p) + z*z/(4*n))/n))/denom
    return center - margin, center + margin
```

---

## Scoring rubric (self‑assessment)
- **Clarity (30%)** — Definitions, guides, and briefs are crisp and observable; evidence spans present.  
- **Coverage (25%)** — Slices well represented; failure modes are 20–40 with owners; Pareto explains ≥60% of failures.  
- **Rigor (25%)** — Versions recorded; CIs shown; gates and traps exist; leakage check done.  
- **Impact (20%)** — One iteration shows a measurable improvement without harming min‑slice or ops.

Passing bar: **≥ 70%** overall and **all acceptance criteria** met for E3.1–E3.5.

---

## Submission checklist
- [ ] `dataset/` folder with splits + data card.  
- [ ] `open_coding.csv` with codes and evidence.  
- [ ] `taxonomy_v1.json`, `open_to_modes.csv`, `failure_mode_cards/`.  
- [ ] `label_schema.json`, `annotator_guide.md`, `labels.parquet`, `label_quality_report.md`.  
- [ ] `iteration_brief.md`, `eval_report.md`, `regression_vX.json`, `release_note.md`.  
- [ ] `pitfall_audit.md` with two tickets/PR links.  
- [ ] `error-analysis-charter.md` and dashboard sketch.

---

## Hints & frequent questions
- **How big is “big enough”?** For 10pp changes around 70% pass‑rate, ~**n=200** examples is often plenty; show CIs and be transparent.  
- **Judge or human first?** Start human for gold; then let an LLM pre‑label and humans approve/edit.  
- **What if my taxonomy explodes?** Merge by **fix path**; retire modes <1% for three consecutive releases; file a **TCR** for any change.  
- **How do I avoid templated outputs when adding strict rules?** Maintain **two acceptable phrasings** and randomize; track **diversity**.  
- **My gains vanish online. Why?** Compare offline vs online **input distributions**; pull fresh logs into regression; align **gates** across environments.

---

### Closing
If you complete this pack, you’ve installed the full **Error Analysis engine** in your workflow. Next up: Chapter 4—**Collaborative Evaluation Practices**—to scale labeling and settle disagreements quickly *without* derailing momentum.

*End of Lesson 3.8 — Exercises.*
