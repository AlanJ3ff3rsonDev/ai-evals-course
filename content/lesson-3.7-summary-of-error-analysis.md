# AI Evals for Engineers & PMs  
## Lesson 3.7 — Summary of Error Analysis (Chapter 3)

> **Context:** Chapter 3 was all about **Error Analysis**—turning messy LLM behavior into *evidence*, *structure*, and *action*. This recap stitches every concept into one practical operating model you can run week after week. Keep this file pinned in your repo; it’s the “how we do error analysis” playbook.

---

### What you built in Chapter 3 (the six artifacts)
1. **Starting Dataset (3.1)** — A *stratified* set of real traces (plus a little synthetic for edge cases), tagged by **slice** (language, persona, channel, intent) with **provenance** and **frozen holdout**.  
2. **Open Codes (3.2)** — Short, observable labels anchored to **evidence spans** (e.g., `Missing CTA`, `Unsupported claim`, `JSON invalid`).  
3. **Taxonomy v1 (3.3)** — Open codes → **failure modes** organized by **phase × rubric**, with stable IDs, definitions, **severity guidance**, owners, and exemplar traces.  
4. **Labeling Workflow (3.4)** — A **schema**, **annotator guide**, and **LLM‑as‑judge** prompt; redundancy + adjudication; labels saved with **versions**.  
5. **Iteration Flywheel (3.5)** — Decide → Change → Evaluate (offline first) → Diagnose → Consolidate → Deploy; plus **TCR** (Taxonomy Change Request) governance.  
6. **Pitfall Shield (3.6)** — Slices, gates, leakage checks, judge calibration, CI traps, pre‑mortem checklist, and a triage tree.

Together, these artifacts transform “model vibes” into **measurable work** that improves your product without breaking safety or ops.

---

## 1) The Error Analysis Operating Model (bird’s‑eye view)

**Inputs** → real logs, frozen holdout, smoke & regression sets.  
**Process** → open code → axial coding → taxonomy v1 → labeling at scale → metrics by **mode × slice** → iteration → governance (TCR) → CI.  
**Outputs** → weekly Pareto chart, failure‑mode cards with owners, regression seeds, release notes, and stable dashboards.

Think of Chapter 3 as installing a *quality engine*: it ingests traces and repeatedly emits **ship/no‑ship evidence** and **fixes that stick**.

---

## 2) The “Phase × Rubric” backbone (your north star)

You anchored failure modes to two dimensions:
- **Phase** (where the issue happens): retrieval, generation, tool, format, safety, dialog/state, ops.  
- **Rubric** (what “good” means): faithfulness, completeness, compliance, tone/clarity (or your app’s equivalents).

This grid prevents *category soup* and keeps the taxonomy stable as your system evolves.

---

## 3) The four golden habits (embed in team culture)

1. **Observe, don’t diagnose (until later).** Open codes name *what happened*, not why.  
2. **Always attach evidence.** Every label cites a text span or tool log line.  
3. **Slice first, then average.** Every metric is reported as `(overall, min‑slice, by‑slice table)`.  
4. **Version everything.** Prompts, datasets, taxonomy, judge rules, and label files.

If you practice only these four, your evaluations will already be better than most teams’.

---

## 4) One‑week error‑analysis sprint (runnable recipe)

**Monday — Inspect & Decide**  
- Pull fresh logs; sample by **slice**.  
- Review last week’s dashboard; read 20–30 raw traces together.  
- Choose **one quality** and **one safety/format** failure mode to target. Fill an **Iteration Brief**.

**Tuesday — Change**  
- Implement the *smallest* change (prompt rule, example pairs, top‑k tweak, tool schema). Name the variant.

**Wednesday — Offline eval**  
- Run on **smoke + regression**. Compute per‑slice metrics with **CIs** and **gates**.  
- If promising, add **5–10 new exemplars** of remaining failures to regression.

**Thursday — Diagnose & Consolidate**  
- Open‑code new failures; check co‑occurrence (retrieval vs generation).  
- If definitions are fuzzy, submit a **TCR** to merge/split modes. Bump taxonomy version if approved.

**Friday — Ship & Monitor**  
- Canary rollout with **online gates**; watch min‑slice quality, p95 latency, and $/req.  
- Write a **Release Note**; update the **failure‑mode cards** and dashboard.

Repeat. Keep cycle time short; protect the holdout; celebrate boring wins.

---

## 5) Role‑specific cheat sheets

### PM / Domain Owner
- Curate the **slices** and **success rubric**; tie failure modes to business impact.  
- Maintain the **Iteration Brief queue**; enforce one‑change‑at‑a‑time discipline.  
- Never present a single number without **min slice** and **example traces**.

### Engineer
- Instrument **tool logs** and **gates** (json parses, enum valid, citations valid, pii blocked, tool success).  
- Own CI: smoke traps, red‑team, schema checks, leakage tests.  
- Version prompts/configs and keep **variant_diff.md** in PRs.

### Data/ML
- Own **label quality** (redundancy, adjudication, gold set) and **judge calibration**.  
- Build the **Pareto dashboard** and retrieval metrics (Recall@k, MRR).  
- Run active sampling to keep datasets representative.

### Compliance/Safety
- Set severity rules and **zero‑tolerance gates** for critical modes.  
- Review **adversarial**/red‑team items; sign off on releases touching policy.

---

## 6) From failure modes → metrics & CI (mapping table)

| Failure mode (example) | Metric(s) | Gate(s) | Typical fix | CI check |
|---|---|---|---|---|
| `FM-GEN-COMP-CTA_MISSING` | Completeness score; conversion proxy | `cta_required` | Add rule + examples | Trap item must fail old, pass new |
| `FM-GEN-FAITH-UNSUPPORTED_CLAIM` | Faithfulness score | `citations_valid` | Require citations; retrieval/rerank | “Pretty but wrong” adversarials |
| `FM-FMT-CLEAR-JSON_ENUM_INVALID` | Parse success | `enum_valid` | Function calling; strict schema | Enum trap set |
| `FM-RET-FAITH-GOLD_NOT_IN_TOPK` | Recall@k; downstream faithfulness | — | chunking/rerank/query rewrite | Retrieval gold run |
| `FM-DIAL-COMP-STATE_INCONSISTENT` | Task success by turn | `state_invariants_ok` | server‑side state; update prompt | Multi‑turn simulator |

This table is your **bridge** from taxonomy to engineering practice.

---

## 7) Quality math you actually need

- **Weighted frequency** for prioritization: `rate × severity_weight`.  
- **Wilson interval** for pass‑rates → puts error bars on your slides.  
- **Non‑inferiority** tests for “don’t get worse” constraints.  
- **Recall@k** and **MRR** for retrieval; slice them the same way you slice generation metrics.  
- **Agreement (%)** between human vs judge and rater vs rater; inspect **confusion pairs** (which modes get mixed up).

You don’t need exotic stats; you need **consistency, slices, and CIs**.

---

## 8) Readiness checklist before Chapter 4 (collaborative evaluation)

- [ ] **Dataset:** Stratified by slice; ≥60% real logs; provenance tagged; **holdout frozen**.  
- [ ] **Labels:** Evidence spans; severity; `phase` column; `taxonomy_version` and `rubric_version` saved.  
- [ ] **Taxonomy:** ≤40 active modes; each has **definition, examples, owner**; TCR process in docs.  
- [ ] **CI:** Smoke traps (format, compliance), small red‑team, leakage test, min‑slice gates, variant diff.  
- [ ] **Dashboard:** Pareto by mode × slice; trend lines; gates; ops (p95 latency, $/req).  
- [ ] **Iteration cadence:** Weekly brief → offline eval → new regression items → canary rollout → release note.  
- [ ] **Collab setup:** A facilitator (the “benevolent dictator”) can make adjudication calls quickly—Chapter 4 will formalize this.

If you’re green on these, your team is ready to scale collaboration without drowning in disagreements.

---

## 9) Top 20 heuristics (posters for the wall)

1. **Name what happened, not why** (open coding).  
2. **One change at a time.**  
3. **Every label has evidence.**  
4. **Always show min slice.**  
5. **Freeze holdout; rotate regression.**  
6. **Gates are specific** (enum, citations, pii, tool success).  
7. **Leakage check** few‑shot vs datasets.  
8. **Judge drift is real**—pin versions, recalibrate.  
9. **Pareto, not perfection.**  
10. **Confuse? Merge by fix; split by root.**  
11. **Taxonomy <40 modes** per product area.  
12. **Owners on modes; cards live in repo.**  
13. **Trap items** for every critical failure.  
14. **Retrieval first** when faithfulness fails.  
15. **Diversity floor**—don’t template creativity away.  
16. **Ops matter**—quality wins that add 0.7s often lose.  
17. **Adjudicate weekly**; update the guide; bump versions.  
18. **Active sampling** to keep distribution honest.  
19. **Write release notes** like change logs for science.  
20. **Tell the story with examples**—3 annotated traces beat 30 charts.

---

## 10) Mini‑exercise (40–60 minutes)

Create a one‑page **Chapter 3 Operational Charter** for your team:
- Purpose (one paragraph).  
- The Phase × Rubric grid you use.  
- Your five top failure modes (with owners).  
- Weekly cadence (who meets when, to do what).  
- CI checks you enforce.  
- The dashboards you publish and who reads them.

Ship it as `error-analysis-charter.md` in your repo; ask each DRI to sign it in the next stand‑up.

---

## 11) What to carry into Chapter 4

- A **codebook** and **annotator guide** you can share with collaborators.  
- A **calibration plan** (regular alignment, adjudication rules).  
- A **thin UI** or sheet for joint labeling (you’ll extend it for collaboration).  
- A **slice‑aware dashboard** ready to display agreement and confusion matrices.

Chapter 4 builds on this foundation to make multi‑person labeling fast, fair, and reproducible.

---

### Closing thought

Error analysis isn’t a one‑time inspection; it’s **how you run** an LLM product. With the artifacts and habits from Chapter 3, you can ship confidently: problems are seen early, fixes are targeted, and improvements stick.

---

*End of Lesson 3.7 — Summary of Error Analysis.*
