# AI Evals for Engineers & PMs  
## Lesson 3.3 — Axial Coding: Structuring and Merging Failure Modes

> **Continuity from 3.2:** You just ran *open coding* and produced lots of short, observable labels (e.g., `Missing CTA`, `Unsupported claim`, `JSON invalid`). That was intentionally bottom‑up.  
> **Now** we switch to *axial coding*: we **organize**, **merge**, and **name** the recurring patterns into a stable **failure taxonomy** that will steer iteration and power your regression suite.

This lesson shows you how to turn a noisy pile of codes into a **decision‑ready map** of failure modes—with clear definitions, exemplars, owners, and links to fixes and metrics.

---

### Learning objectives
By the end you will be able to:
1. Merge overlapping open codes into **coherent failure modes** with crisp names and definitions.  
2. Build a **taxonomy** (tree + tags) that’s stable enough for CI and iteration planning.  
3. Quantify coverage and impact so you can **prioritize** fixes (Pareto view).  
4. Produce three artifacts: **Taxonomy v1**, **Failure‑Mode Cards**, and a **Mapping Table** from open codes → failure modes.

---

## 1) What is *axial coding* in this context?
In qualitative analysis, axial coding finds **axes** (relationships) that connect codes: causes, context, consequences. In LLM eval practice, we use it to:

- **Group** related codes (e.g., `No citations`, `Unsupported claim`) under **parent themes** (e.g., *Faithfulness*).  
- **Merge** synonyms and near‑duplicates (`Missing CTA`, `No next step`).  
- **Split** overly broad codes when evidence shows different fixes (`JSON invalid` → `Wrong enum` vs `Unescaped characters`).  
- **Attach metadata** (severity guidance, affected slices, hypothesized root causes, candidate fixes).

The output isn’t a research paper; it’s a **working taxonomy** your team uses every week.

---

## 2) Start with a backbone: the “Phase × Rubric” grid
Anchor your taxonomy to two dimensions you already have:

- **Phase** (where in the pipeline): `retrieval`, `generation`, `tool`, `format`, `safety`, `dialog/state`, `ops`.  
- **Rubric item** (what “good” means): `faithfulness`, `completeness`, `compliance`, `tone/clarity` (or your app’s equivalents).

Create a simple **grid** (sheet or Notion table). Each cell will hold candidate **failure modes**; this avoids dumping everything into one bucket.

**Example cells (CollectAI)**  
- *Generation × Compliance*: `Unauthorized discount offered`, `Privacy/PII in message`.  
- *Retrieval × Faithfulness*: `Gold doc not in top‑k`, `Top‑k has duplicate chunks`.  
- *Format × Ops*: `JSON schema invalid`, `Enum mismatch`, `Too long (>1200 chars)`.  
- *Dialog/State × Completeness*: `Missing CTA after negotiation`, `State inconsistency`.  

---

## 3) Merge rules: how to combine open codes without losing signal

**Heuristic H1 — Same fix ⇒ same failure mode.**  
If two codes would be fixed by the *same* change, merge them.  
- `Missing CTA` and `No invitation to visit office` → **FM‑GEN‑COMP‑CTA_MISSING**.

**Heuristic H2 — Different root ⇒ split.**  
If fixes differ, keep separate:  
- `Unsupported claim (offers discount)` vs `Unsupported claim (wrong amount)` → different modes: **Unauthorized discount** vs **Incorrect balance**.

**Heuristic H3 — Keep names observable.**  
Use **what** happened, not **why** (“Retriever miss” only if gold truly absent from top‑k; otherwise `Irrelevant top‑k` or `Cited doc not used`).

**Heuristic H4 — Cap granularity to actionability.**  
Aim for **20–40** modes for a product area. Too few → vague; too many → unmanageable.

**Heuristic H5 — Preserve examples.**  
When merging, keep **exemplar trace IDs** so the regression set can be seeded immediately.

---

## 4) Naming conventions & IDs (make them stable)

Adopt a consistent ID schema so you can reference modes in tickets, PRs, and dashboards:

```
FM-<PHASE>-<RUBRIC>-<SHORT_NAME>
```

- `PHASE`: `RET`, `GEN`, `TOOL`, `FMT`, `SAFE`, `DIAL`, `OPS`.  
- `RUBRIC`: `FAITH`, `COMP`, `COMPly`, `TONE`, `CLEAR` (pick yours).  
- `SHORT_NAME`: snake case, 2–4 words.

**Examples**  
- `FM-GEN-COMPLY-UNAUTHORIZED_DISCOUNT`  
- `FM-FMT-CLEAR-JSON_ENUM_INVALID`  
- `FM-RET-FAITH-GOLD_NOT_IN_TOPK`  
- `FM-DIAL-COMP-STATE_INCONSISTENT`

Keep an **index table** with `ID | Name | Definition | Severity guidance | Slices | Examples | Fix ideas | Owner`.

---

## 5) Failure‑Mode Card (template)
For each mode, create a one‑pager (can be a table row + modal).

**Failure‑Mode Card — Template**  
- **ID & Name**: `FM-GEN-FAITH-UNSUPPORTED_CLAIM`  
- **Definition**: Output asserts a fact **not supported** by provided docs/policy.  
- **Detection/Signature**: `citations_valid=false` OR judge label `faithfulness ≤ 1`; phrases like “posso oferecer 50%” while policy forbids discounts.  
- **Severity guidance**: Major by default; **Critical** if promotes unauthorized financial terms or misstates an amount/date.  
- **Typical Slices**: PT > ES; WhatsApp > Email.  
- **Root cause hypotheses**: Weak retrieval; prompt lacks “refuse if not supported”; missing few‑shot examples; judge too lenient.  
- **Candidate fixes**: Tighten refusal rule, require citations; add counter‑example; improve chunking or rerank; per‑slice prompt.  
- **Examples (trace ids)**: `t_0123, t_0455, t_0789` (+ links).  
- **Regression seeds**: `t_0123` (frozen), `t_0789` (frozen).  
- **Owner**: PM/Eng name.

These cards become your **iteration backlog**.

---

## 6) The axial‑coding workshop (90–120 minutes)

**Inputs:** open‑code table from 3.2 with counts by slice; top 100–300 labeled traces; facilitator + 2–4 stakeholders.

**Process**  
1. **Lay out the Phase × Rubric grid.**  
2. **Drag codes** into cells. Start merging synonyms **by fix** (H1) and splitting by distinct causes (H2).  
3. For each tentative mode, write a **one‑line definition** and **severity guidance**.  
4. **Quantify**: sum frequencies of merged codes; compute per‑slice breakdown.  
5. **Prioritize**: pick top modes by `(frequency × severity × business impact)` → create **Pareto list**.  
6. **Assign owners** and **seed regression**: choose 3–10 exemplar traces per mode and freeze them.  
7. **Version** the result as **Taxonomy v1** (`tax_v1.0`) and store in repo.

**Outputs**  
- `taxonomy_v1.json` (or CSV) with failure modes + metadata.  
- `mapping_open_to_modes.csv` (open code → mode ID).  
- `failure_mode_cards/` directory (one file per mode).  
- `regression_set_v1.json` updated with exemplar items.

---

## 7) Quantifying coverage & impact (so you know where to start)

Compute these summaries (you can do this in a spreadsheet or a notebook):

- **Coverage of top N modes:** What percent of all failures do the top 5 modes explain? Aim for ≥ 60%.  
- **Slice impact:** For each mode, list top failing slices (PT/ES, persona, channel).  
- **Severity distribution:** Share of Critical/Major/Minor within each mode.  
- **Trend over time:** After each iteration, plot counts to ensure modes shrink or move from Critical → Minor.

Then build a **Pareto chart**: sort modes by (weighted) frequency; draw cumulative coverage. Start with the top 2–3 modes.

---

## 8) Example taxonomy v1 (CollectAI)

**Phase: Generation**  
- `FM-GEN-COMPLY-UNAUTHORIZED_DISCOUNT` — Offers discounts disallowed by policy.  
- `FM-GEN-COMP-CTA_MISSING` — Lacks explicit invitation (visit office / click link).  
- `FM-GEN-FAITH-UNSUPPORTED_CLAIM` — Asserts facts not in sources.  
- `FM-GEN-COMP-INCOMPLETE_OPTIONS` — Doesn’t present all allowed payment options.  
- `FM-GEN-TONE-NOT_RESPECTFUL_OR_FIRM` — Tone misses the respectful & firm balance.

**Phase: Retrieval**  
- `FM-RET-FAITH-GOLD_NOT_IN_TOPK` — Gold passage absent from top‑k.  
- `FM-RET-FAITH-DUPLICATE_CHUNKS` — Redundant passages crowd out variety.  
- `FM-RET-FAITH-IRRELEVANT_TOPK` — Off‑topic chunks dominate.

**Phase: Format**  
- `FM-FMT-CLEAR-JSON_ENUM_INVALID` — Enum values not in schema.  
- `FM-FMT-CLEAR-UNPARSABLE_JSON` — Broken braces/escaping.  
- `FM-FMT-OPS-TOO_LONG` — Exceeds 1200‑char limit.

**Phase: Dialog/State**  
- `FM-DIAL-COMP-STATE_INCONSISTENT` — Forgets confirmed info; repeats ID check.

**Phase: Tool**  
- `FM-TOOL-COMP-CALL_MALFORMED` — Function call wrong/missing args.  
- `FM-TOOL-OPS-NO_RETRY` — Tool failure without retry/backoff.

Each has a card with definitions, examples, and owners. The **mapping table** merges open codes like `No CTA`, `Missing invite`, `No next step` → `FM-GEN-COMP-CTA_MISSING`.

---

## 9) Mapping table (mechanical step you should not skip)

Create a simple table that translates every **open code** into exactly **one** failure mode ID.

| Open code (3.2) | Failure mode ID | Notes |
|---|---|---|
| `Missing CTA` | `FM-GEN-COMP-CTA_MISSING` | merged with `No next step` |
| `Unsupported claim` | `FM-GEN-FAITH-UNSUPPORTED_CLAIM` | requires `citations_valid=false` |
| `JSON invalid` | `FM-FMT-CLEAR-UNPARSABLE_JSON` | split: see enum case |
| `Wrong enum` | `FM-FMT-CLEAR-JSON_ENUM_INVALID` |  |
| `Gold doc missing` | `FM-RET-FAITH-GOLD_NOT_IN_TOPK` |  |

This table is your **bridge** from last week’s labels to the new taxonomy. It also lets you **replay history** with the updated modes.

---

## 10) From taxonomy to engineering work

For each top failure mode, create an **Iteration Brief** (half a page):

- **Problem:** paste the Failure‑Mode Card summary + frequency/slice data.  
- **Hypothesis:** the smallest change likely to reduce the failure (prompt rule, add counter‑example, retriever rerank, tool schema fix).  
- **Experiment:** concrete change + datasets to run (regression + holdout).  
- **Success metric:** e.g., reduce `FM-GEN-COMPLY-UNAUTHORIZED_DISCOUNT` by 80% with **no** increase in `FM-GEN-COMP-CTA_MISSING` or latency.  
- **Risk:** what could regress?  
- **Owner & timeline**.

This ties error analysis directly to **CI and product metrics** (from Chapter 2).

---

## 11) Versioning & governance (keep the taxonomy sane)

- **Version IDs**: `tax_v1.0`, bump minor for name tweaks, major for structural changes.  
- **Change log**: record merges/splits with rationale and sample traces.  
- **Ownership**: each mode has a **DRI** (directly responsible individual).  
- **Sunset rule**: when a mode’s frequency stays <1% for three releases, move it to “archive”; keep its regression seeds but stop investing in discovery.  
- **Add mode rule**: only add a new mode if (a) distinct fix path and (b) seen ≥ 5 times or with Critical severity.

---

## 12) Sanity checks & metrics for the taxonomy itself

- **Inter‑coder consistency** on the new failure modes: sample 30 items, double‑label using the mapping table; target ≥ 0.8 agreement (exact or ±1 severity).  
- **Pareto stability**: top 5 modes remain top 5 across two consecutive weeks (unless a fix landed).  
- **Slice invariants**: if a mode is PT‑only, ask *why* (prompt language, tokenizer, embeddings?).  
- **Leakage control**: ensure regression seeds are **not** used as few‑shot examples.

---

## 13) Pitfalls (and how to dodge them)

1. **Taxonomy sprawl** — every meeting adds 5 new modes.  
   - *Fix:* enforce the **distinct fix** criterion; cap the active set; archive low‑impact modes.

2. **Over‑merging** — different root causes hidden under one label.  
   - *Fix:* ask “Would the same change fix both?” If no, split.

3. **Theory‑driven names** (“Retriever confusion”) with no observable signature.  
   - *Fix:* rewrite in observable terms: `Gold not in top‑k` or `Irrelevant top‑k`.

4. **Unowned modes** — no progress.  
   - *Fix:* assign DRIs; include in squad rituals (standup, retro).

5. **No link to metrics** — taxonomy becomes a museum.  
   - *Fix:* for each mode, list the metric(s) it affects and the **gates** it should trip.

---

## 14) Micro‑exercise (45–60 min)

Using your 3.2 output:
1. Build the **Phase × Rubric grid** and drag all open codes into cells.  
2. Merge/split to produce **20–40 failure modes** with IDs and one‑line definitions.  
3. Fill **Failure‑Mode Cards** for the top 5 modes; assign owners.  
4. Freeze **3–10 exemplars** per top mode into the regression set.  
5. Export `taxonomy_v1.json` and `open_to_modes.csv`.

If you complete these steps, you’re ready for **3.4 — Labeling Traces after Structuring Failure Modes**, where the taxonomy drives consistent labeling at scale.

---

## 15) Deliverable templates

**A) `taxonomy_v1.json` (sketch)**  
```json
[
  {
    "id": "FM-GEN-COMPLY-UNAUTHORIZED_DISCOUNT",
    "definition": "Offers discounts disallowed by policy.",
    "phase": "generation",
    "rubric": "compliance",
    "severity_guidance": "critical when financial terms; major otherwise",
    "slices": ["pt", "whatsapp"],
    "examples": ["t_0123","t_0455"],
    "owner": "eng_maria"
  }
]
```

**B) `open_to_modes.csv`**  
`open_code,mode_id,notes`

**C) Failure‑Mode Card (Markdown)**  
```
# FM-GEN-COMP-CTA_MISSING
**Definition:** Output lacks explicit call to action.
**Signature:** No “clique”, “agendar”, “visitar”; end of message missing CTA.
**Severity:** Major; Critical only if CTA required by policy to proceed.
**Slices:** PT>ES; WhatsApp>email.
**Fix ideas:** Add rule + examples; enforce `cta_required=true` gate.
**Examples:** t_0211, t_0873
**Owner:** pm_ana
```

---

## 16) Key takeaways

- Axial coding turns raw labels into a **working taxonomy** aligned to **phase × rubric**.  
- Merge by **fix path**; split by **distinct cause**; keep **observable names**.  
- Quantify impact and prioritize with a **Pareto** view.  
- Package results into **Taxonomy v1**, **Failure‑Mode Cards**, and a **mapping table**.  
- Seed your **regression** set from exemplars so improvements stick and regressions can’t hide.

---

*End of Lesson 3.3 — Axial Coding: Structuring and Merging Failure Modes.*
