# AI Evals for Engineers & PMs  
## Lesson 4.2 — A Collaborative Annotation Workflow

> **Continuity:** In 4.1 we learned why a *benevolent dictator* (BD) speeds decisions and how to keep that role healthy with guardrails (ADRs, appeals, rotation).  
> **This class** turns that philosophy into a **day‑to‑day workflow** you can run with multiple labelers, SMEs, and engineers—without losing speed, quality, or reproducibility.

We’ll design an end‑to‑end system: **queues → labeling → adjudication → merge → QA → metrics → CI**. You’ll get **schemas, state machines, templates, and automation recipes** you can paste into your repo.

---

### Learning objectives
By the end you can:
1. Stand up a **multi‑person annotation pipeline** with clear states and ownership.  
2. Configure **label schemas**, **task queues**, and **versions** so merges are deterministic.  
3. Run efficient **calibration**, **adjudication**, and **spot‑QA** at scale.  
4. Automate **pre‑labeling** with LLM judges while keeping humans in control.  
5. Track **team health** (coverage, throughput, IAA, aging) and wire the workflow to **CI gates**.

---

## 1) Principles for collaborative labeling
1. **Evidence or it didn’t happen.** Every label must carry an **evidence span** (or tool log line).  
2. **Deterministic merges.** Two humans (and optionally a judge) can disagree; your **merge policy** must be a pure function.  
3. **Version everything.** Each label carries `taxonomy_version` and `rubric_version`; prompts/models have hashes.  
4. **Timeboxes > threads.** Short calibration & BD decisions beat long Slack debates.  
5. **Slices first.** Queues are split by slice so coverage isn’t hostage to “whatever showed up today.”  
6. **One change at a time.** The workflow must preserve comparability between runs (Chapter 3 discipline).

---

## 2) The pipeline at a glance (state machine)

```
INGEST → TRIAGE → (PRE‑LABEL) → H1 LABEL → H2 LABEL → MERGE → 
ADJUDICATE (if needed) → QA SPOT‑CHECK → PUBLISH → DASHBOARDS/CI
```

**Definitions**
- **INGEST:** Pull new items from logs or synthetic generator.  
- **TRIAGE:** Assign slice tags; filter PII; dedupe; freeze holdout.  
- **PRE‑LABEL (optional):** LLM‑judge proposes labels + evidence as hints.  
- **H1/H2 LABEL:** Two independent humans label a shared subset (for IAA).  
- **MERGE:** Deterministic union with tie rules; severity = max; evidence kept.  
- **ADJUDICATE:** BD resolves conflicts; writes ADR.  
- **QA SPOT‑CHECK:** Random 5–10% relabeled by QA lead; drift alarms.  
- **PUBLISH:** Append to `labels.parquet` with versions; update regression.  
- **DASHBOARDS/CI:** Rebuild Pareto and gates; run smoke/red‑team.

State is tracked per `task_id`. Nothing moves forward without required fields.

---

## 3) Data model you can copy

### 3.1 Task object (`task.jsonl`)
```json
{
  "task_id": "t_000123",
  "input": {"text": "...", "docs":[{"id":"d3","url":"..."}, {"id":"d9","url":"..."}], "tools":[]},
  "slice": {"lang":"pt","channel":"whatsapp","persona":"returning","intent":"negotiation"},
  "provenance": "log",
  "split": "regression_v5",
  "ingested_at": "2025-08-09T14:12:00Z",
  "holdout": false
}
```

### 3.2 Label object (per rater, per task)
```json
{
  "task_id": "t_000123",
  "rater_id": "h1_ana",
  "labels": [
    {"mode_id":"FM-GEN-COMP-CTA_MISSING","severity":"major","evidence":"...span...","phase":"GEN"}
  ],
  "gates": {"json_valid":true,"enum_valid":true,"citations_valid":false,"pii_blocked":true},
  "scores": {"faithfulness":2,"completeness":2,"tone":3,"compliance":3},
  "meta": {
    "taxonomy_version":"tax_v1.3",
    "rubric_version":"rub_v1.7",
    "prompt_hash":"jB3...",
    "model_id":"gpt-x.x",
    "timestamp":"2025-08-09T15:31:00Z"
  }
}
```

### 3.3 Merge record
```json
{
  "task_id":"t_000123",
  "merge_policy":"union_max_severity_evidence_concat",
  "contributors":["h1_ana","h2_joao","judge_v4"],
  "adjudicated": true,
  "final_labels":[...],
  "adr_id":"ADR-2025-08-09-007"
}
```

All three live in a single **parquet** for speed; keep raw JSON for audits.

---

## 4) Queue design (coverage without drama)

**Queues by slice** (e.g., `pt/wa`, `es/email`) ensure each area gets labeled weekly. Each queue has targets like `n/week`.  
Recommended **ratios**:
- **Double‑label** 20–30% of items per slice for IAA.  
- **Judge pre‑label** 100% as hints *but* don’t block humans from editing.  
- **QA spot‑check** 5–10% after merge.

**Priority sources** (descending): (1) production disagreements, (2) red‑team & traps, (3) random logs, (4) synthetic edge cases.

**Aging guardrail:** No task should sit >7 days from INGEST to PUBLISH. Track **aging buckets** (1–3, 4–7, 8+ days).

---

## 5) Pre‑labeling with an LLM (done safely)
- Use the **same rubric** and require **evidence spans** (quoted text or doc ids).  
- Store in `rater_id="judge_vX"` to keep provenance clear.  
- **Never auto‑merge** judge outputs; show as **hints** in the UI (collapsible).  
- Measure **judge‑human agreement** weekly on the double‑labeled subset; if <0.80 on gold, retrain prompt or swap model.  
- Keep judge **model‑diverse** from the target, if possible.

This cuts time/cost without laundering model mistakes into ground truth.

---

## 6) Deterministic merge policy (no arguments later)
1. **Start with gates:** If any rater flagged a **blocking gate** (e.g., `pii_blocked=false`, `enum_valid=false`), propagate that status to the final record.  
2. **Mode IDs:** Final = **union** of rater modes. If two modes from the **same family** conflict, prefer the one that matches **BD rules** (keep a mapping table).  
3. **Severity:** Final severity = **max**(severities).  
4. **Evidence:** Keep **all** evidence spans; on adjudication, BD selects the canonical span(s).  
5. **Scores:** Take **median** (or mean rounded); store per‑rater scores too.  
6. **Conflict flag:** If H1 ≠ H2 on any field → set `needs_adjudication=true`.

Then run the **Adjudication Ladder** from 4.1; store the **ADR id** on resolution.

**Why union?** It reduces false negatives; with severity max and BD review, you can prune over‑labeling later. If this becomes noisy, switch to **consensus‑first** on mature modes.

---

## 7) UI checklist (what your tool must support)
- **Side‑by‑side**: input, retrieved docs, tool logs, and model output.  
- **Evidence selection**: highlight text spans; capture character indices.  
- **Mode picker**: filtered by **Phase × Rubric**; search by text.  
- **Keyboard first**: numbers for scores; shortcuts for common modes.  
- **Judge hints**: collapsible panel with proposed labels & spans.  
- **Diff viewer**: show H1 vs H2 vs judge on adjudication.  
- **Version banner**: taxonomy/rubric versions visible at the top.  
- **Latency friendly**: cached doc renders; offline mode if possible.

If you can’t build a UI yet, a shared **Google Sheet + screenshots of spans** works to bootstrap, but move to a tool as soon as feasible.

---

## 8) Calibration routine (weekly, 30–45 minutes)
**Inputs:** Last week’s IAA, confusion pairs, 6–10 thorny examples, any ADRs awaiting review.  
**Flow:**
1. **Metrics snapshot (5’)**: IAA overall and by mode; top confusion pairs; aging; queue coverage vs targets.  
2. **Case review (25–30’)**: Walk examples; propose rule; BD decides; record **ADR**.  
3. **Guide changes (5’)**: Update decision rules; bump `rubric_version`; announce in Slack.  
4. **Action items (5’)**: New regression seeds; TCRs to merge/split modes.

**Goal:** Fewer disputes next week; IAA trend up or flat; time‑to‑decision ≤ 24h.

---

## 9) QA program (keep quality high without slowing down)
- **Random spot‑checks**: QA re‑labels 5–10% of merged items; compute QA‑vs‑Final agreement.  
- **Targeted audits**: Double the rate for **new raters** or **new modes** for two weeks.  
- **Drift alarms**: If QA agreement drops >10pp week‑over‑week, trigger a calibration sprint.  
- **Gold refresh**: Add 5–10 gold items per month (diverse slices); re‑score judges and raters.

Document QA results in a monthly **Label Quality Report** (1–2 pages).

---

## 10) Throughput and staffing (simple math)
- A trained rater can label **60–120 items/hour** (simple modes) or **15–40** (complex with evidence).  
- For **n=800 items/week** with 25% double‑labeling, plan for **~18–24 rater‑hours** plus **2–3 BD hours**.  
- Budget **1 QA hour** per 200 final items.

Track **items/hour** per rater *and* error bars (agreement). Incentives should reward **accuracy and speed**, not speed alone.

---

## 11) Privacy & safety (non‑negotiables)
- **PII scrubbing** on ingest; show masked fields to labelers when possible.  
- **Access control**: separate queues for sensitive slices; least privilege.  
- **Audit trails**: every label edit has `who/when/why` (ADR link).  
- **Data minimization**: expire raw text when you can; keep spans & hashes.  
- **Sensitive cohorts**: add extra QA for vulnerable user groups.

---

## 12) Automation recipes (copy into scripts)

**A) Build weekly queues (pseudo‑SQL)**
```sql
INSERT INTO queue (task_id, slice, priority)
SELECT task_id, slice, 
  CASE WHEN source='prod_disagreement' THEN 1
       WHEN source='redteam' THEN 2
       WHEN source='log' THEN 3
       ELSE 4 END
FROM ingest
WHERE split='regression_v5'
QUALIFY ROW_NUMBER() OVER (PARTITION BY slice ORDER BY priority, RANDOM()) <= target_per_slice;
```

**B) Auto‑assign double‑labels**
```python
def assign_double_labels(queue, rate=0.3):
    for task in queue:
        if random() < rate:
            task["assignees"] = sample(raters, 2)
        else:
            task["assignees"] = [least_loaded(raters)]
```

**C) Deterministic merge**
```python
def merge(h1, h2, judge=None):
    final = {}
    final["labels"] = union(h1.labels, h2.labels, prefer_family_rules=True)
    final["severity"] = max_severity(h1, h2)
    final["gates"] = or_dict(h1.gates, h2.gates)
    final["scores"] = median_scores(h1, h2, judge)
    final["needs_adjudication"] = conflict(h1, h2)
    return final
```

Wire these into CI so merges and metrics rebuild automatically each night.

---

## 13) Running example: **CollectAI** (multilingual debt collection)

**Queues**
- `pt/whatsapp` (n=160/wk), `pt/email` (n=80), `es/whatsapp` (n=120), `es/email` (n=80). 25% double‑labeling.  
- Pre‑label 100% with judge_v4; hints collapsed by default.

**Merge policy**
- Union with family rules (e.g., `UNSUPPORTED_CLAIM` vs `GOLD_NOT_IN_TOPK`).  
- Severity=Max; evidence kept; BD adjudicates within 24h.

**Calibration**
- Weekly Wednesday 10:30; 8 disputes; ADRs published; two TCRs in first month.

**QA**
- 10% spot; additional 20% for first two weeks of new rater onboarding.

**Results after 4 weeks**
- IAA overall: **0.86** (↑ from 0.74).  
- Disagreements aging p90: **< 2 days** (was 6.4).  
- Slice coverage met ≥95% of weekly targets.  
- Offline metrics stabilized; fewer “surprise” regressions.

---

## 14) Integrating with CI and dashboards

**Nightly job**
1. Ingest logs → triage → build queues.  
2. Pull completed labels → merge → adjudicate leftovers (notify BD).  
3. Recompute **Pareto by mode × slice**, **IAA**, **aging**, **QA agreement**.  
4. Rebuild **smoke** and **regression** sets (add new seeds).  
5. Run **gates** on the latest model variant; fail CI if min‑slice breaches.

**Dashboards to expose**
- **Coverage**: items/week by slice vs targets.  
- **Throughput**: items/hour by rater; disagreement counts.  
- **IAA**: overall and by top modes; confusion pairs.  
- **Aging**: items in each state > SLA.  
- **Quality**: Pareto; min‑slice trends; gates.  
- **Ops**: p95 latency and $/req for eval runs (to catch heavy prompts).

---

## 15) Onboarding & docs (make it self‑serve)
- **Rater quickstart (1 page)**: shortcuts, top 10 modes, common pitfalls.  
- **Codebook**: decision rules + examples per mode (links to ADRs).  
- **BD Charter & Ladder**: expectations and escalation.  
- **FAQ**: “When do I add a new mode?” → **never without a TCR**.  
- **Glossary**: rubrics, phases, gates, severity definitions.

Keep docs in the repo; link from the UI header. Update versions when anything changes.

---

## 16) Micro‑exercises (60–90 minutes)
1. **Queue builder:** Define your four most important slices and a weekly target table. Generate this week’s queue.  
2. **Merge function:** Implement the union+max‑severity merge in a notebook and test it on 20 double‑labeled items.  
3. **Calibration dry‑run:** Take 6 disputed items, run a 30‑minute session, and publish one ADR.  
4. **Dash tile:** Plot queue **aging buckets** and **IAA by mode** for your last 200 items.

Deliverables: `queues.csv`, `merge_demo.ipynb`, `adr/ADR-<date>-001.md`, `dashboard_screenshot.png`.

---

### Common failure smells (and quick fixes)
- **H1 always overrides H2**: You’re not really double‑labeling—*swap assignments* and inspect IAA per rater.  
- **Judge dominates**: If judge agreement with gold <0.8, hide hints or retrain.  
- **Long tail of “other”**: Open‑codes leak into production—file TCRs or merge by fix path.  
- **Stuck in adjudication**: Tighten timeboxes; pre‑read evidence; decide live in calibration.  
- **Slices unbalanced**: Automate quotas; fail the nightly job if coverage <80% in any slice.

---

## 17) Checklist: ship‑ready collaborative workflow
- [ ] Clear **states** with SLAs; queues by slice.  
- [ ] **Label schema** with evidence, gates, scores, versions.  
- [ ] **Double‑label** policy and **deterministic merge**.  
- [ ] **Adjudication Ladder** + BD in place; ADR log live.  
- [ ] **Calibration** cadence and QA spot‑check program.  
- [ ] **Judge pre‑labeling** with agreement monitoring.  
- [ ] **Dashboards**: coverage, IAA, aging, Pareto, gates.  
- [ ] **CI hooks**: nightly rebuild, min‑slice gates, trap items.  
- [ ] **Docs**: rater quickstart, codebook, glossary, BD charter.

If you can tick these, your team can scale annotations without the usual chaos.

---

### Closing
Collaboration doesn’t mean consensus by committee—it means **frictionless handoffs** through a well‑designed pipeline that preserves evidence, versions, and accountability. With this workflow, you’ll label faster, argue less, and iterate with confidence.

---

*End of Lesson 4.2 — A Collaborative Annotation Workflow.*
