# Lesson 9.5 — **Course Summary & Final Toolkit for AI Evals (Engineers & PMs)**

> This concluding lesson distills the **whole program**—from fundamentals to CI/CD and continuous improvement—into a compact, battle‑tested toolkit you can run next week. It also includes a 30/60/90 adoption plan, a maturity model, and a capstone checklist you can laminate and put on your monitor.

---

## 0) How We Got Here (Course Map)

- **Ch.1 — Introduction.** We aligned on *why* evals matter and the **three gulfs** of LLM development (spec ↔ behavior, offline ↔ online, demo ↔ production). We introduced the **LLM Evaluation Lifecycle**.  
- **Ch.2 — LLMs, Prompts & Eval Basics.** Prompting fundamentals, defining “good,” metric types, and app‑centric vs. foundation‑model evals.  
- **Ch.3 — Error Analysis.** Open/axial coding to discover *failure modes*; iteratively refine a **taxonomy**; label traces and build a growing **debug set**.  
- **Ch.4 — Collaborative Practices.** Roles, “benevolent dictator” workflow, adjudication, and measuring **inter‑annotator agreement** to stabilize labels.  
- **Ch.5 — Automated Evaluators.** Choose metrics, write **LLM‑as‑Judge** prompts, build splits, estimate true success with imperfect judges, and compute success rates programmatically.  
- **Ch.6 — Evaluating Multi‑Turn Conversations.** Evaluate at different levels (turn, task, session), strategies for multi‑turn, automated trace scoring, and how to address common pitfalls.  
- **Ch.7 — RAG Evaluation.** Overview of RAG risks, synthetic QA generation, retrieval and generation metrics, and failure patterns unique to RAG.  
- **Ch.8 — Architectures & Modalities.** Tool calling, agentic systems, multi‑step pipelines, input data modalities—and how evals adapt to each.  
- **Ch.9 — CI/CD & Operations.** We operationalized evals: **CI for regressions (9.1)**, **CD + online monitoring (9.2)**, **a weekly improvement flywheel (9.3)**, and **practical pitfalls & defenses (9.4)**.

This lesson compresses those ideas into an actionable **operating system for quality**.

---

## 1) Ten Immutable Principles

1. **Version everything** (models, prompts, datasets, metrics, judges, tool schemas, indexes). If you can’t reproduce a number, it’s not a fact.  
2. **Prefer executable truth** when feasible (tests, math checks, schema validation). Use LLM judges for nuance—**calibrate** them against human gold.  
3. **Slice > average.** Every chart must support drill‑down by locale, persona, difficulty, input type, and safety class. Track **worst‑slice**, not only the mean.  
4. **Gate on confidence**, not point estimates: Wilson/Jeffreys lower bounds, and minimum n per gate.  
5. **Keep a living failure taxonomy**. New failure → new label → new test. The system learns from its mistakes.  
6. **CI is small and frequent.** Canaries are tiny and safe. Big batch evals are for exploration and quarterly health checks.  
7. **Quality is multi‑objective**: true success, safety, grounding, latency, cost, and “refuse vs. answer” are product features.  
8. **Offline⇄Online linkage** is sacred: holdouts, canaries, and calibration curves keep you honest.  
9. **People + process** matter: rubrics, IAA, adjudication, and “benevolent dictator” cadence stabilize labels and decisions.  
10. **Documentation is a feature**: dataset cards, judge cards, manifest.json per run, and visible change logs build trust.

---

## 2) The Minimal Production Blueprint (One‑Pager)

**Repo layout**
```
/evals
  datasets/        # canonical eval sets + dataset cards
  suites/          # YAML configs (which datasets + metrics + gates)
  metrics/         # executable metrics (truth, safety, latency, cost)
  judges/          # LLM‑as‑judge prompts + calibration scripts
  tools/           # tool schemas + contract tests
  dashboards/      # queries + charts
  docs/            # runbooks, checklists, incident reviews
```

**Pipelines**
- **Pre‑merge CI (L1/L3 gates):** n≥400 per gate, seeded sampling, temperature=0 judges, Wilson lower bound gates, worst‑slice limits, cost/latency ceilings.  
- **Canary CD:** 1–5% traffic; daily deltas vs. control by slice; rollback rules.  
- **Monitoring:** proxy ⇄ truth calibration, RAG freshness (`index_age_p95`), tool success, safety counters.  
- **Improvement flywheel (weekly):** annotate 50–100 failing traces, merge taxonomy updates, ship countermeasures, raise one gate after 2 weeks stable.

**Artifacts**
- `manifest.json` per run; traces for failed items; dataset/judge cards; decision log linking PR → CI → canary → outcome.

---

## 3) The Eval Maturity Model

| Level | Focus | What It Looks Like | Risk If You Stay Here |
|---|---|---|---|
| **0. Demos** | Ad‑hoc prompts | Manual spot checks; no datasets | Illusion of progress; brittle launches |
| **1. Baseline** | First test set | One metric; some automation | False confidence; no slices |
| **2. Structured** | Taxonomy & debug set | CI gates; dataset/judge cards | Overfitting to known cases |
| **3. Operational** | CI/CD + canaries | Online monitoring; rollback | Blind spots; stale RAG; judge drift |
| **4. Learning System** | Weekly flywheel | Gate ratcheting; red‑team rotation | --- |

Your goal is to reach **Level 4** and stay there—always learning, never static.

---

## 4) The Five Golden Suites (Bring‑Up Kit)

1. **True Success** for your top workflow (execution‑based when possible).  
2. **Grounding / Evidence Support** (esp. for RAG).  
3. **Safety & Policy** (contextualized to your product).  
4. **Latency & Cost** (p50/p95 budgets per slice).  
5. **Refusal & Uncertainty** (good abstentions vs. bad ones).

Each suite includes: dataset card, judge card, seeds, sampling recipe, slices, thresholds, and a runbook.

---

## 5) Canonical Metrics (Cheat‑Sheet)

- **Binary success (task done?):** exact match, tests pass, constraint satisfied. Gate with **Wilson LB**.  
- **Semantic quality:** calibrated LLM judges (paired, blinded). Report sensitivity/specificity vs. human gold.  
- **Grounding:** “Does the quoted evidence support the claim?” (judge + evidence span check).  
- **Retrieval:** recall@k, MRR, nDCG; doc freshness; reranker AUC.  
- **Safety:** refuse‑when‑should, allow‑when‑should, and violation rates by policy class.  
- **Multi‑turn:** turn‑level success, task completion, tool success, loop rate, needless turn rate.  
- **Ops:** p50/p95/p99 latency, cost per solved case, availability (tool/API errors).

---

## 6) RAG & Agents: What to Never Forget

- **RAG**: Index freshness is a *metric*, not a task; verify **evidence supports claim**; fight distractors via reranking; allow reasonable FAQ fallbacks when grounding is absent and risk is low.  
- **Agents**: Step caps; “stop‑when‑AC‑met;” tool contract tests; locale/time‑zone correctness; circuit breakers and safe fallbacks.

---

## 7) People, Labels, and Governance

- **Rubrics with examples** (positives & negatives) reduce label drift.  
- **IAA ≥ 0.7** (Cohen’s κ or Krippendorff’s α) before trusting a new rubric.  
- **Adjudication queue** for disagreements; “benevolent dictator” cadence resolves deadlocks.  
- **Data governance**: PII scrubbing, role‑based access, dataset change logs, audit trails linking changes to outcomes.

---

## 8) The Seven Common Pitfalls (from 9.4) — and Quick Fixes

1. **Label leakage / memorization** → dedupe vs. index & training corpora; rotate debug sets.  
2. **Sampling bias** → stratify; publish the sampling recipe; gate on worst‑slice.  
3. **Judge bias / uncalibrated** → calibrate to human gold; paired, blinded judging; limit weight vs. executable truth.  
4. **Flaky CI** → temperature=0, seeded sampling, Wilson LB, n≥400 per gate.  
5. **Overfitting to evals** → holdouts, canaries, red‑team rotation; watch CI→canary gap.  
6. **Proxy drift** → maintain calibration curves; watch for spam/selection bias.  
7. **Silent cost/latency regressions** → budgets & alerting; report cost per solved case.

Tape this list to your monitor.

---

## 9) 30/60/90‑Day Adoption Plan

**Days 0–30 (Bring‑Up):**  
- Create the five golden suites; label 300–500 items; write dataset/judge cards.  
- Wire **L1/L3 gates** in CI with Wilson LB and worst‑slice constraints.  
- Spin up a canary pipeline and two dashboards (CI trends, canary deltas).

**Days 31–60 (Stabilize & Learn):**  
- Run the **weekly improvement flywheel** (9.3).  
- Start **red‑team rotation** (10–20 adversarial cases / week).  
- Add RAG freshness and tool‑success monitoring; establish rollback rules.

**Days 61–90 (Ratcheting Up):**  
- Raise one gate after **two weeks of stable canary uplift**.  
- Expand slices (locales, segments); add cost per solved case; adopt judge recalibration cadence.  
- Document your **operating playbook**; onboard a second team.

---

## 10) Capstone Artifacts (Templates)

### 10.1 Dataset Card (Skeleton)
```
- Purpose: e.g., BR policy QA for SMB fees
- Sampling recipe: source logs (dates), filters, quotas by slice
- Size & splits: train/dev/ci/holdout (n per slice)
- Labeling: rubric vX; IAA=0.74; adjudication protocol
- Known limitations: coverage gaps, stale examples
- Change log: YYYY‑MM‑DD — what changed and why
```

### 10.2 Judge Card (Skeleton)
```
- Prompt version: judge_qa_grounding_v3
- Decision rubric: success/partial/fail examples
- Calibration: N=300 vs. humans, sens/spec/ROC
- Constraints: blinded, temperature=0, max tokens, retries
- Failure modes: verbosity bias, phrasing preference
```

### 10.3 CI Gate Config (YAML)
```yaml
suite: "policy_qa_weekly"
gates:
  min_ci_lower: 0.86      # Wilson lower bound
  min_worst_slice: 0.82
  max_p90_latency_ms: 2500
  max_cost_usd_per_case: 0.03
  safety_no_regressions: true
holdouts_hidden_from_dev: true
```

### 10.4 Incident Review (One‑Page)
```
- What happened? (user impact; slices affected)
- Leading indicators (which metrics/alerts fired?)
- Root cause (dataset, judge, retrieval, tool, infra)
- Countermeasures (taxonomy labels, guardrails, code fixes)
- What did we learn? (new suite/gate, process change)
```

---

## 11) Final Quality Checklist (The Laminated Card)

- [ ] **Versioned manifest** saved for every run.  
- [ ] **Executable truth** preferred; judges calibrated and blinded.  
- [ ] **Slices first**; worst‑slice gate enforced.  
- [ ] **Wilson LB** with n≥400; seeded sampling; temp=0.  
- [ ] **Safety & policy** pass; refusal logic verified.  
- [ ] **Latency & cost** within budgets (p95 + per‑case cost).  
- [ ] **RAG freshness** & **evidence support** monitored.  
- [ ] **Canary uplift** positive with guardrails; rollback plan tested.  
- [ ] **Debug set** updated from incidents; taxonomy evolved.  
- [ ] **Decision log** links PR → CI → canary → outcome.

If you can’t tick a box, it becomes this week’s flywheel item.

---

## 12) Your Next Moves

1. **Pick a north‑star workflow** and ship the five golden suites.  
2. **Automate CI gates** with lower‑bound thresholds and worst‑slice constraints.  
3. **Launch canary CD** with daily deltas & rollback.  
4. **Start the weekly flywheel**. Every failure becomes a new test or guardrail.  
5. **Teach the ritual** to adjacent teams; pair‑program the first two weeks.

---

## 13) Closing Thoughts

Evaluation is not a report—it’s an **operating system** for product quality. When your org versions everything, prefers executable truth, calibrates judgments, and learns from every incident, **innovation becomes safe**. You ship faster **because** you evaluate better. Keep the flywheel turning, keep your gates honest, and let your datasets tell the story of how your product got excellent.

**Congratulations on completing the course.** Your next PR should already be safer.

---

### Optional Reflection (for you and your team)
- Which slice is riskiest in your product right now, and why?  
- What is your most brittle judge? How will you recalibrate it next week?  
- Which metric would you retire if you had to, and what would replace it?  
- What will you ratchet up two weeks from now?

