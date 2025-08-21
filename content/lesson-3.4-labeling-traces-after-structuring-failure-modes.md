# AI Evals for Engineers & PMs  
## Lesson 3.4 — Labeling Traces after Structuring Failure Modes

> **Where we are:**  
> In 3.2 you labeled raw traces with short, observable open codes. In 3.3 you merged them into a **Failure Taxonomy v1** (phase × rubric) with clear definitions and IDs.  
> **This lesson** turns that taxonomy into a **repeatable labeling workflow** so anyone on your team (or an LLM‑judge) can assign the *same labels* to the *same trace*. That is the bedrock of reliable metrics, CI gates, and fast iteration.

---

### Learning objectives
By the end you will be able to:
1. Convert your taxonomy into a **label schema** and **annotator guide** (codebook v1).  
2. Run a **calibrated labeling workflow** with humans and/or an LLM‑judge.  
3. Measure and improve **label quality** (redundancy, agreement, adjudication).  
4. Store labels with **provenance & versions** so metrics are reproducible.  
5. Produce the artifacts needed for CI: `label_schema.json`, `annotator_guide.md`, `labeling_playbook.md`, and a versioned `labels.parquet/csv`.

---

## 1) From taxonomy → label schema

Your taxonomy defines **what** can go wrong. The label schema defines **how** to record it consistently.

**Minimal schema (single‑turn example)**
```json
{
  "item_id": "uuid",
  "labels": [
    {
      "mode_id": "FM-GEN-COMP-CTA_MISSING",
      "severity": "minor|major|critical",
      "evidence_span": [210, 256],          // optional char indices in output
      "evidence_text": "…",
      "phase": "generation",                // duplicate of mode metadata OK
      "slice": {"lang":"pt","persona":"new","channel":"wa"}
    }
  ],
  "gates": { "json_valid": true, "citations_valid": true, "pii_blocked": true },
  "judge_scores": {"faithfulness": 3, "completeness": 2, "tone": 3, "compliance": 3},
  "coder_meta": {"coder_id":"pm_ana","rubric_version":"v1.2","taxonomy_version":"tax_v1.0","timestamp":"YYYY-MM-DD"}
}
```

**Notes**
- You can attach **multiple labels** to the same item if several failure modes appear.  
- Keep **gates** and **judge scores** in the same record so aggregation is easy.  
- For **multi‑turn** conversations, add `turn_index` to each label; for **RAG**, include `retrieved_ids` and `citation_ids`.

---

## 2) Annotator guide (Codebook v1 → “how to label”)

Turn each Failure‑Mode Card (3.3) into a **clear instruction** for annotators. Keep it short and example‑rich.

**Guide structure (per failure mode)**
1. **ID & Name** (stable).  
2. **One‑line definition**—observable (what, not why).  
3. **Decision rules**—how to tell this mode apart from neighbors.  
4. **Severity guidance**—what counts as critical/major/minor.  
5. **Examples**—2–3 short snippets with labels.  
6. **Non‑examples**—similar‑looking cases that should **not** be labeled as this mode.  
7. **UI hints**—where to highlight evidence; what to do if unsure (use `severity=unknown` and leave a note).

Keep the whole guide to ~4–6 pages so people actually read it.

---

## 3) Human labeling workflow (repeatable and fast)

**A) Assignment**
- Stratify by **slice** so each annotator sees a broad mix.  
- Give each item to **2 annotators** when stakes are high (compliance, policy). One may be a senior reviewer for **adjudication** later.

**B) Interface**
- A simple web form or spreadsheet is fine to start; must support:  
  - Selecting `mode_id` from a dropdown (searchable),  
  - Setting **severity**,  
  - Highlighting **evidence** (copy text to `evidence_text`),  
  - Toggling **gates** (JSON valid, PII blocked),  
  - Entering **judge scores** (0–3) if you collect them manually.

**C) Quality control**
- Insert **gold examples** (known answers). Track per‑rater accuracy.  
- Include **honeypot negatives** (no failure mode present) to catch over‑labeling.  
- Sample **10–20%** for senior **adjudication** each week.

**D) Calibration cadence**
- 30‑minute weekly meeting: review 10 disagreements; update the guide if needed (bump `rubric_version`); share quick “before/after” numbers.

---

## 4) LLM‑as‑judge labeling (when and how)

You can scale with an LLM‑judge that outputs **failure‑mode labels** and rubric **scores**. Do it with **guardrails**.

**Judge prompt skeleton**
```text
ROLE: Strict evaluator. You apply a fixed taxonomy of failure modes.
TASK: Given INPUTS (user, policy, retrieved docs) and OUTPUT, return JSON with:
- failure_modes: list of {mode_id, severity, evidence_text, evidence_span}
- gates: {json_valid, citations_valid, pii_blocked}
- judge_scores: {faithfulness, completeness, tone, compliance}  // 0–3

TAXONOMY (ID, name, definition, severity guidance): … (shortened)

RULES:
- Use only listed mode_ids.
- Severity: critical if safety/compliance violation or wrong money/date; major if task failure; minor for tone/format nits.
- If insufficient info, return an empty failure_modes array.
OUTPUT: Strict JSON only. Temperature=0.
```

**Calibration**
- Label **50–100 items** with trusted humans (gold).  
- Compare **agreement** (exact match of `mode_id`, severity ±1 allowed). Record confusion pairs; improve definitions or examples.  
- Set a **confidence use policy**: e.g., accept the LLM’s labels when it’s consistent on gold (≥85–90%); otherwise route to human.

**Hybrid plan**
- Let the LLM **pre‑label** and propose evidence. Humans **approve/edit** quickly. This can 2–3× speed without much quality loss.

> We’ll go deep on IAA in Chapter 4. For now, track simple **percent agreement** and a confusion table.

---

## 5) Aggregating multiple labels per item

After labeling, you might have **0..N failure modes** per item and **2 raters** per item.

**Merge rules**
1. **Gates**: use logical AND (if any rater marks `json_valid=false`, treat as fail until adjudicated).  
2. **Failure modes**: union by `mode_id`; if severities differ, take the **max** (conservative) unless adjudicated.  
3. **Judge scores**: average (or take median) across raters; record standard deviation for stability.  
4. **Adjudication**: senior rater can override; store `adjudicator_id` and rationale.

**Output**: one row per `item_id` with merged labels + metadata, ready for metric computation.

---

## 6) Label provenance & versioning (reproducibility matters)

Add these fields to your label files:
- `taxonomy_version` (e.g., `tax_v1.0`)  
- `rubric_version` (judge instructions version)  
- `label_prompt_version` (if using an LLM‑judge)  
- `dataset_version` (smoke/regression/holdout)  
- `coder_id` (or `judge_model`) and timestamp

Store files in a folder like:  
`/labels/<split>/<version>/labels.parquet` plus a `CHANGELOG.md` explaining updates.

> If taxonomy changes (3.5 iteration), keep a **mapping table** from old → new IDs so you can replay history.

---

## 7) From labels → metrics (closing the loop)

With merged labels you can compute:
- **Per‑mode frequency** and **rate** (by slice).  
- **Severity distribution** per mode.  
- **Gate pass‑rates** (JSON, citations, PII).  
- **Composite quality** (judge 0–3 average) with **slice minima**.  
- **Pareto chart** of failure modes (which to fix next).

Link each failure mode to the **metric** it should affect (from 2.3):  
- `FM-GEN-COMP-CTA_MISSING` → Completeness score; add a **gate** `cta_required=true` if your policy mandates it.  
- `FM-FMT-CLEAR-UNPARSABLE_JSON` → Schema gate (block).  
- `FM-RET-FAITH-GOLD_NOT_IN_TOPK` → Retrieval recall@k.

---

## 8) Practical templates

**A) `label_schema.json` (sketch)**
```json
{
  "schema_version": "1.0",
  "fields": {
    "item_id": "string",
    "labels": [{
      "mode_id": "string",
      "severity": "enum",
      "evidence_span": "int[2]",
      "evidence_text": "string",
      "phase": "enum",
      "slice": "object"
    }],
    "gates": {"json_valid":"bool","citations_valid":"bool","pii_blocked":"bool"},
    "judge_scores": {"faithfulness":"int","completeness":"int","tone":"int","compliance":"int"},
    "coder_meta": {"coder_id":"string","rubric_version":"string","taxonomy_version":"string","timestamp":"string"}
  }
}
```

**B) `annotator_guide.md` outline**
```
1. Purpose & definitions (observable labels, severity rubric)
2. How to use the UI (select mode, highlight evidence, save)
3. Mode‑by‑mode pages (definition, decision rules, examples, non‑examples)
4. Common mistakes (double‑counting, diagnosing, severity inflation)
5. FAQ (multi‑turn, RAG, tool calls)
```

**C) `labeling_playbook.md` checklist**
- [ ] Split & slice quotas set; assignment list sent.  
- [ ] Gold set loaded; agreement baseline computed.  
- [ ] Weekly calibration scheduled; 10 disputes pre‑selected.  
- [ ] Adjudication queue configured; SLA 48h.  
- [ ] Export script creates `labels.parquet` with versions & checksums.  
- [ ] Metric job reads labels and writes a report per PR/nightly.

---

## 9) Worked example (CollectAI)

**Taxonomy v1 highlights**  
- `FM-GEN-COMP-CTA_MISSING`  
- `FM-GEN-COMPLY-UNAUTHORIZED_DISCOUNT`  
- `FM-GEN-FAITH-UNSUPPORTED_CLAIM`  
- `FM-FMT-CLEAR-JSON_ENUM_INVALID`  
- `FM-RET-FAITH-GOLD_NOT_IN_TOPK`

**Labeling setup**  
- Two human annotators (PT, ES fluent) + LLM‑judge v2 for pre‑labels.  
- 300 regression items; 220 holdout (frozen).  
- Weekly calibration on 20 overlaps.

**Process**  
1. LLM‑judge pre‑labels; outputs JSON with failure_modes + gates + judge_scores.  
2. Humans review; edit mode_ids/severity/evidence when needed.  
3. Script merges duplicates; adjudicator reviews disagreements.  
4. Metrics pipeline computes per‑mode rates by slice.  
5. Pareto reveals top 3: `CTA_MISSING` (22% PT‑WA), `UNAUTHORIZED_DISCOUNT` (7% critical), `JSON_ENUM_INVALID` (5%).

**Outcome**  
- Add prompt rule + examples for CTA; extend JSON enum gate; tighten compliance refusal text.  
- Next release shows `CTA_MISSING` down to 6% with no hit to tone or latency.

---

## 10) Active sampling: label where it matters

Save time by **prioritizing** items that are likely to be informative:
- **Disagreement sampling**: label items where two model variants disagree or where judge confidence is low.  
- **Error‑biased sampling**: oversample slices/modes with high failure rates.  
- **Diversity sampling**: ensure a spread of lengths, personas, and channels.

Document your policy in the playbook so numbers remain interpretable.

---

## 11) Pitfalls (and how to dodge them)

1. **Label drift** — definitions morph silently across weeks.  
   - *Fix:* version the guide; hold weekly calibration; re‑label a tiny **anchor set** every release.

2. **Over‑labeling** — every nit gets a failure mode.  
   - *Fix:* align on severity; minor tone nits should not dominate engineering time.

3. **Mode confusion** — annotators pick neighboring modes inconsistently.  
   - *Fix:* add **decision rules** in the guide; prefer fewer, clearer modes; revise taxonomy in 3.5.

4. **Judge over‑trust** — LLM labels mistakes consistently.  
   - *Fix:* keep a human audit % and a gold set; inspect **confusion pairs** regularly.

5. **Unreproducible metrics** — missing versions/owners.  
   - *Fix:* store `taxonomy_version`, `rubric_version`, `label_prompt_version`, dataset version, and checksums in the label files.

---

## 12) Micro‑exercise (45–60 min)

1. Export 50 regression traces (mixed slices).  
2. Label them using your taxonomy with **one human** and **LLM‑prelabels**.  
3. Label the same 15 items by a **second human**.  
4. Merge; compute percent agreement by `mode_id` (exact) and severity (±1).  
5. Write a one‑page **Label Quality Report**: top confusion pairs, fixes to the guide, and next week’s audit plan.

Deliverables: `label_schema.json`, `annotator_guide.md`, `labels_v0.1.parquet/csv`, `label_quality_report.md`.

---

## 13) What flows into 3.5 (Iteration & Refinement)

Bring to the next lesson:
- Labeled regression set with **mode IDs** and **severity**.  
- Per‑mode **frequencies by slice** and a Pareto chart.  
- A list of **hypotheses** for the top 2–3 modes and their candidate fixes.  
- Notes on **confusions** that may require merging/splitting modes (taxonomy updates).

---

### Key takeaways
- Your taxonomy becomes **real** only when it drives a **consistent labeling workflow**.  
- Design a **schema + guide**, run **calibration**, and track **versions**.  
- Use a **hybrid** of LLM pre‑labels + human audits for speed with trust.  
- Merge labels conservatively and map them back to metrics and CI gates.  
- Keep improving quality via **calibration** and **active sampling**; bring your insights to 3.5 to refine both the taxonomy and the system.

---

*End of Lesson 3.4 — Labeling Traces after Structuring Failure Modes.*
