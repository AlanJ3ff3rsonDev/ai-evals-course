
# AI Evals for Engineers & PMs  
## Lesson 4.7 — Chapter 4 Summary: Collaborative Evaluation Practices (Playbook on a Page)

> **Where we are in the course:**  
> Chapter 4 transformed evaluation from a solo activity into a **team sport with teeth**.  
> - **4.1** introduced governance (benevolent dictator, escalation path).  
> - **4.2** defined the collaborative annotation workflow, states, QA loops, and dataset lifecycle.  
> - **4.3** gave you inter‑annotator agreement (IAA) to *measure* rater reliability.  
> - **4.4** taught how to run alignment sessions and resolve disagreements with ADRs.  
> - **4.5** connected human labels to automated evaluators (programmatic + LLM‑as‑Judge).  
> - **4.6** listed the common pitfalls and how to avoid them.  
>  
> This summary distills those lessons into a **single operating model**, with checklists, roles, SLAs, and artifacts you can lift into your repo. Treat it as your “two‑pager that keeps the team honest.”

---

## 1) Operating Model — From Disagreement to Product Gate in 10 Steps

1. **Define ownership**  
   - *Roles:* Product (risk & success criteria), Lead Engineer (trace capture & CI), Labeling Lead (workflows & QA), **Benevolent Dictator** (final tie‑breaker), Data Lead (sampling & metrics), On‑call SME (domain correctness).  
   - *SLA:* disputes resolved within **72 hours** or escalated to BD.

2. **Ingest & sample work**  
   - Pull **fresh traces** from production; enforce **slice quotas** (language × channel × risk).  
   - Maintain three sets: **Smoke (tiny, critical)**, **Regression (frozen seeds)**, **Random (refreshed weekly)**.

3. **Collaborative labeling**  
   - Single pass on low‑risk; **dual‑label** high‑risk or low‑confidence; include **evidence spans** (doc IDs / highlights).  
   - All labels carry **taxonomy version** and **mode severity**.

4. **Quality control**  
   - Calculate **IAA** (κ/α) weekly per mode × slice; review confusion pairs.  
   - Run **blind adjudication**; disagreements become ADR candidates.

5. **Alignment session** (30 min)  
   - Review top disagreements → **decide** using examples.  
   - Record **ADR** (rule, examples, decision, owner, due date).

6. **Guide & taxonomy change**  
   - Apply **TCR**: merge/split modes only when fix paths differ.  
   - Update **codebook** in example‑first style; bump **rubric_version**.

7. **Seed & bench updates**  
   - Freeze **3–10 seed items** per ADR; add to Regression set with IDs.  
   - Update **sampling weights** if a slice is weak or changing.

8. **Automate evaluators**  
   - Map rules to **programmatic checks**, **retrieval checks**, and **LLM‑as‑Judge**; define JSON schema with **evidence requirement**.  
   - Calibrate judges vs gold; choose thresholds from reliability curves.

9. **Gates & CI**  
   - Wire evaluator outputs into **pre‑merge** and **nightly** checks.  
   - Gates trigger on **worst slice**, not only overall averages.

10. **Dashboards & drift**  
   - Track **Success rate by mode × slice**, **IAA**, **judge‑vs‑gold agreement**, **cost per decision**, **decision velocity** (ADRs/week).  
   - Shadow/canary new judges; alert on **>10pp** agreement drop.

> **Outcome:** Every disagreement leaves a trail (ADR → guide diff → seeds → evaluator → gate). That trail is your product’s safety net.

---

## 2) Artifacts You Must Have in Repo

- **/eval/guide/**  
  - `codebook.md` (example‑first; 2 positives + 1 counter‑example per rule)  
  - `CHANGELOG.md` with semantic versions and diffs

- **/eval/taxonomy/**  
  - `taxonomy.yml` (mode IDs, severity, owners, lifecycle: proposed/trial/accepted/deprecated)  
  - `tcr/` (Taxonomy Change Requests: template + decisions)

- **/eval/adr/**  
  - One ADR per decision: `adr-YYYYMMDD-<slug>.md` (Context, Decision, Evidence, Diff, Seeds, Owner, Due)

- **/eval/seeds/**  
  - `smoke/`, `regression/`, `random/` with manifest files; each item has immutable `seed_id`

- **/eval/evaluators/**  
  - `programmatic/` (deterministic checks), `retrieval/` (recall & evidence presence), `judges/` (prompts + JSON schema)  
  - `evaluator_config.yml` (thresholds, gates, versions)

- **/eval/ci/**  
  - `nightly.yml` (runs bench + gates), `premerge.yml` (targeted checks on changed areas)

- **/eval/dashboards/**  
  - Notebooks or BI definitions for *mode×slice*, IAA, and judge health

> If an artifact is missing, the corresponding step in the operating model *cannot* be verified.

---

## 3) RACI for Chapter‑4 Work

| Task | PM | Lead Eng | Label Lead | BD | Data Lead | SME |
|---|---|---|---|---|---|---|
| Risk & success definition | **R** | C | C | C | C | C |
| Workflow & tool setup | C | **A/R** | **A/R** | C | C | C |
| Sampling & quotas | C | C | R | C | **A/R** | C |
| Labeling & QA | C | C | **A/R** | C | C | R |
| IAA reporting | C | C | **R** | C | **A/R** | C |
| Alignment session | **A/R** | R | R | **A** | C | R |
| ADR approval | C | C | R | **A** | C | C |
| Evaluator design | **R** | **A/R** | C | C | R | C |
| CI gates | C | **A/R** | C | C | R | C |
| Dashboards & drift | **R** | R | C | C | **A/R** | C |

*A = accountable, R = responsible, C = consulted.*

---

## 4) The Metrics that Matter (and their healthy ranges)

1. **Labeling reliability**  
   - κ/α per mode × slice: **≥ 0.6** acceptable, **≥ 0.8** strong.  
   - Confusion pair share: **< 20%** of total disagreements.

2. **Decision velocity**  
   - ADRs/week: **≥ 5** in early phases; **≥ 2** steady state.  
   - Time‑to‑decision (dispute → ADR): **≤ 72 h**.

3. **Evaluator health**  
   - Judge‑vs‑gold agreement on critical modes: **≥ 0.8**.  
   - Calibration error (Brier or reliability gap): trending **down** quarter‑over‑quarter.

4. **Product gates**  
   - Worst‑slice success rate: **no regression > 1–3pp** week‑over‑week.  
   - Critical gate violations (PII, money, safety): **0** allowed.

5. **Cost & scale**  
   - Cost per evaluation decision (human+compute): downward trend; **≤ target**.  
   - % traffic with gold labels: **5–10%** calibration stream sustained.

---

## 5) Templates (ready to paste)

### 5.1 ADR (Architecture/Annotation Decision Record)
```md
# ADR-2025-08-09: Handling Unsupported Monetary Amounts in PT/WhatsApp
## Context
Disputes on whether to flag amounts absent from retrieved docs.
## Decision
If an amount appears without a matching span in top-k docs → primary=RET.GOLD_NOT_IN_TOPK, secondary=GEN.UNSUPPORTED_CLAIM; severity=major if affects money, safety, or legal.
## Evidence
t_1293, t_1331, t_1377 (spans highlighted)
## Diff
- Guide: add Rule 3.2 with 2 positive + 1 counter-example.
## Seeds
seed/PT/whatsapp/amt_001..007 added to regression.
## Owner & Due
Label Lead (Maria), 2025-08-12
```

### 5.2 TCR (Taxonomy Change Request)
```md
# TCR-2025-08: Merge GEN.HALLUCINATION_TEXT into GEN.UNSUPPORTED_CLAIM
Rationale: same fix path; confusion pair top-1 for 3 weeks.
Examples: 3 positives, 1 counter-example.
Plan: mark deprecated in v1.5; remove after 30 days.
```

### 5.3 Judge Prompt Skeleton
(see full version in 4.5; include strict JSON schema, evidence requirement, and version fields).

### 5.4 CI Gate (YAML sketch)
```yaml
gates:
  - name: worst_slice_faithfulness
    scope: "pt.whatsapp"
    metric: "pass_rate.faithfulness"
    min: 0.92
    block_on_regression_pp: 3
  - name: critical_no_leak
    metric: "violations.pii || violations.unauthorized_discount"
    max: 0
```

---

## 6) The Two Feedback Loops

### Loop A — Human Improvement
Label → Disagreement → ADR → Guide Diff → Seeds → Better Labels  
- **Signal:** κ/α increases, confusion pairs shrink.  
- **Cadence:** weekly alignment session.

### Loop B — Automation Improvement
Guide Diff → Evaluator Update → Calibration vs Gold → CI Gates → Safer Releases  
- **Signal:** Judge agreement stable ≥0.8; fewer human escalations.  
- **Cadence:** bi‑weekly or when ADR materially changes rules.

> Keep both loops running. If either stops, quality plateaus or drifts.

---

## 7) Anti‑Pattern to Guardrail Map (from 4.6)

- **Percent agreement theater →** track κ/α and label distribution; require evidence.  
- **Taxonomy creep →** TCR with fix‑path rule; lifecycle table.  
- **Guide bloat →** example‑first codebook + changelog.  
- **Consensus collapse →** blind first; junior speak first; BD last.  
- **Sampling lies →** slice quotas; seeds + random refresh.  
- **Gold starvation →** 5–10% calibration stream; shadow/canary new judges.  
- **ADR theater →** ADR must include Diff + Seeds + Owner + Due; CI links.  
- **Cost blow‑ups →** adaptive labeling; selective judge runs.  
- **Lab–prod mismatch →** trace parity; smoke on prod traces.  
- **Judge overfit →** diverse examples; novelty monitoring.  
- **Cause vs symptom →** primary/secondary labeling; retrieval checker.  
- **Multilingual pitfalls →** localize rules & prompts; track per slice.  
- **Meetings w/o outcomes →** decision velocity metric; 30‑min agenda.

---

## 8) 30–60–90 Day Rollout Plan

**Days 0–30 (Stabilize reliability)**  
- Stand up **roles** and the **workflow tool**; migrate legacy labels into the new schema.  
- Baseline **IAA**, top confusion pairs, and slice coverage.  
- Run two alignment sessions; publish three ADRs; refactor guide to example‑first.

**Days 31–60 (Automate & gate)**  
- Implement **programmatic + retrieval checks** for objective rules.  
- Ship the first **LLM‑as‑Judge**; calibrate vs gold; create a **Judge Health** dashboard.  
- Wire **pre‑merge gates**; start nightly job on smoke + regression sets.

**Days 61–90 (Scale & harden)**  
- Expand **random refresh**; keep calibration stream at **5–10%**.  
- Introduce **canary/shadow** for judge upgrades; add drift alerts.  
- Publish a **Quarterly Quality Review**: mode×slice progress, costs, and top 5 ADRs’ impact.

---

## 9) Quick Self‑Audit (15 checks)

- [ ] Roles & SLAs defined; BD named; escalation path documented.  
- [ ] Slice quotas match production telemetry.  
- [ ] Labels carry **evidence spans** and **versions**.  
- [ ] κ/α reported weekly per mode × slice.  
- [ ] Weekly alignment session with **≥5 decisions**.  
- [ ] ADRs include **Diff, Seeds, Owner, Due** and live in repo.  
- [ ] Codebook is **example‑first** with a clear **CHANGELOG**.  
- [ ] Regression **seeds** exist and are stable; smoke tests run daily.  
- [ ] Evaluators mapped to **programmatic / retrieval / judge**.  
- [ ] Judges require **evidence**; agreement with gold **≥0.8**.  
- [ ] CI gates check **worst slice** and **critical violations**.  
- [ ] Dashboards show **mode×slice**, IAA, judge health, cost/decision.  
- [ ] Shadow/canary process for judge changes.  
- [ ] Calibration stream sustained (5–10% gold).  
- [ ] Post‑release incidents decreasing over 2 sprints.

---

## 10) Narrative Example — Bringing It All Together (CollectAI)

**Context**: PT & ES WhatsApp flows; most severe incidents involve **incorrect amounts** and **impolite tone**.  
**Actions across Chapter 4:**  
- 4.1 named BD and SLAs; 4.2 deployed a two‑step workflow with evidence spans; 4.3 tracked κ by mode & language; 4.4 resolved two recurring disputes into ADR‑2025‑08‑09 and ADR‑2025‑08‑16; 4.5 shipped `judge_v4` with strict JSON schema; 4.6 prevented taxonomy creep by merging two generation modes.  
**Results (6 weeks):**  
- κ for “unsupported claim” rose from **0.57 → 0.83**; disagreement cycle time from 7 days → **36 hours**.  
- Nightly CI blocked a prompt change that reduced faithfulness on **ES/WhatsApp** by **4.1pp**; issue fixed before deploy.  
- Post‑release **incident count** down **38%**; cost/decision down **22%** via selective judging and adaptive labeling.

**Takeaway:** when every disagreement is turned into a rule, a seed, and a gate, quality improves *and* costs fall.

---

## 11) What to carry forward into Chapter 5

- **Rubric clarity + versioning** is non‑negotiable. Judges are only as good as the rules.  
- **Gold calibration stream** is your reality check—don’t ever turn it off.  
- **Gates and CI** are how evaluation affects the product roadmap, not just a report.  
- **Slice‑first reporting** prevents regressions hidden in averages.  
- **Automation with evidence** is safer than automation with opinion.

> **Next:** Chapter 5 deep‑dives into **Implementing Automated Evaluators**. You already built the *why* and the *what*; now we’ll engineer the *how*: metric definitions, prompts for judges, data splits, and code for estimating true success with imperfect evaluators.
