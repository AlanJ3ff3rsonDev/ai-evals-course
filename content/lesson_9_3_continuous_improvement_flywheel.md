# Lesson 9.3 — **The Continuous Improvement Flywheel**

> **Continuity with the course:**  
> In **9.1** you built a pre‑merge safety net with CI gates, and in **9.2** you learned to deploy safely with CD, online monitoring, and rollback. **9.3** shows how to turn those capabilities into a **repeatable operating rhythm** that steadily increases quality and lowers risk week after week.

---

## Learning Objectives

After this lesson you will be able to:
1. Run a **weekly improvement loop** that converts telemetry and evals into shippable fixes.  
2. Maintain a **failure‐mode backlog** (taxonomy‑aware) and choose the highest‑leverage countermeasures.  
3. Write **hypotheses and acceptance criteria (ACs)** that connect problems → interventions → metrics/gates.  
4. Design **countermeasure patterns** (prompt, retrieval, tools, agents, judges) and know when to use each.  
5. **Ratcheting strategy:** raise gates and SLOs without blocking delivery.  
6. Facilitate short, focused **rituals** (reviews, standups, postmortems) that keep the flywheel spinning.

---

## 1) The Flywheel at a Glance

```
Signals → Diagnose → Prioritize → Design Fix → Implement → Evaluate → Rollout → Ratchet & Document → (repeat)
        (online proxies, CI, traces)      (ACs)             (CI + shadow/canary)         (gates/SLOs)
```

- **Signals**: from CI, dashboards, red‑team, user edits, canary deltas.  
- **Diagnose**: map to a **failure taxonomy** (from Chapter 3), confirm with traces.  
- **Prioritize**: choose items that maximize **Expected Quality Lift (EQL)** per time.  
- **Design Fix**: pick a countermeasure pattern; write a brief **hypothesis + ACs**.  
- **Implement**: small, reversible changes first (two‑way doors).  
- **Evaluate**: CI tripwires → end‑to‑end → robustness; then **shadow/canary**.  
- **Rollout**: flip feature flags; keep kill switch.  
- **Ratcheting**: raise gates and SLOs when stable; update docs and debug sets.

> The key to momentum is **small batches** and **tight feedback cycles**: most loops should complete in **≤ 1 week** for incremental improvements.

---

## 2) Inputs that feed the loop

1) **CI & CD metrics:** true success (CI‑lower), grounded precision, hallucination proxy, cost/latency, worst‑slice.  
2) **Drift detectors:** PSI for inputs, index age, tool success, WER drift for OCR/ASR.  
3) **User signals:** thumbs, edits, abandon/re‑query, NPS, support tickets.  
4) **Incident reviews:** postmortems yield **guardrail ideas** and **debug sets**.  
5) **Red‑team & robustness**: injection attempts, blur/decimal‑comma/code‑switching deltas.

**Rule:** every signal must link to at least one **reproducible trace** (prompt, retrieved chunks, tool calls, citations) so an engineer can reproduce and fix.

---

## 3) The Failure‑Mode Backlog (taxonomy‑aware)

Create a single backlog (Jira/Linear/Notion). Each item uses this **schema**:

```yaml
title: "pt-BR policy Q&A: grounded but stale rates for 'prazo de entrega'"
taxonomy: ["RAG", "Freshness", "Citation/Support"]
evidence:
  - link: trace://run/2025-07-21/b8d4…
  - metric_delta: "freshness violations = 3 (last 24h)"
  - slices: ["pt-BR × policy"]
impact:
  users: "BR merchants using policy portal"
  occurrence: "12/day (canary)"
  severity: "medium"
hypothesis: "Index age > 45d on 'shipping_policy' corpus leads to stale citations"
acceptance_criteria:
  - "Freshness violations return to 0 for 7 days in BR policy slice"
  - "No drop in grounded true success (CI lower stays ≥ 0.85)"
  - "Index_age_p95 ≤ 7 days for that corpus"
countermeasure_candidates:
  - "Nightly recrawl + TTL=14d + freshness pinning on critical docs"
  - "RAG prompt requires date check; reject if after as_of"
owner: "@retrieval-oncall"
due: "2025-08-09"
debug_set: "br-policy-freshness-32"
```

**Tips**
- Use the **taxonomy from Chapter 3** so clusters are discoverable (e.g., “Unsupported claim”, “Missing evidence”, “Wrong tool arguments”).  
- Attach **top 3 traces** and the **slice** that worsened.  
- Always propose **countermeasure candidates**; the review meeting chooses one.

---

## 4) Prioritization: Expected Quality Lift (EQL)

When everything feels important, use a simple heuristic:

```
EQL = Impact × (Win Probability) × (Expected Lift) ÷ Effort
```

- **Impact**: users affected × severity (1–5).  
- **Win Probability**: confidence that fix works (0.2, 0.5, 0.8).  
- **Expected Lift**: points of success you believe you can add (e.g., +2pts).  
- **Effort**: S/M/L in engineer-days (1, 2, 5).

Prioritize the **top 3** EQL items; the rest wait. Keep a **fast lane** for **safety** and **freshness** defects (they bypass ranking).

---

## 5) Writing Hypotheses and ACs (Acceptance Criteria)

**Hypothesis format:** *“If we [intervention], then [metric] will improve for [slice], because [mechanism].”*

- **Intervention**: specific (e.g., “add date filter in retriever; require citations ≤ `as_of`”).  
- **Metric**: measured the same way as in CI/CD (e.g., **grounded true success**).  
- **Slice**: locale × task_type × difficulty; include **worst-case slice**.  
- **Mechanism**: prevents cargo‑cult changes; builds shared understanding.

**ACs should be**: measurable, time‑bounded, risk‑aware.  
Example AC set:
1. **Primary**: +1.5 pts in grounded true success (CI lower) on pt‑BR policy slice in CI L3.  
2. **Guardrails**: hallucination proxy ≤ 2%; p90 latency within ±10%; cost ≤ +5%.  
3. **Robustness**: no Δ worse than −2 pts on blur/decimal‑comma minisuites.  
4. **Deployment**: 0 freshness violations during canary week.

Put ACs **at the top of the PR description** and in the **PR comment bot** so reviewers see the alignment immediately.

---

## 6) Countermeasure Patterns (choose the right lever)

Below is a **decision tree** and a toolbox of **patterns**. Use the smallest lever that explains the failures.

### 6.1 Retrieval‑Augmented Generation (RAG)
- **When to use**: Missing/incorrect citations, stale facts, distractors.  
- **Patterns**
  - **Index hygiene**: TTL + recrawl; **pin** “critical” docs; keep **age histograms**.  
  - **Chunking/reranking**: increase overlap; add **nuggetization**; train a lightweight reranker.  
  - **Query rewriting**: structured templates; add locale hints (“pt‑BR”).  
  - **Prompt grounding rules**: “reject if no citation” + **structured evidence** (IDs, page #).  
  - **Distractor defense**: require multiple independent citations or **answer abstention**.

### 6.2 Tool‑Calling
- **Symptoms**: over‑calling, wrong arguments, flaky executions.  
- **Patterns**
  - **Decision prompt** with explicit preconditions; add **negative examples**.  
  - **Schema tightening** with JSON schema + examples; **unit tests** for argument fidelity.  
  - **Caching** idempotent tools; **circuit breakers** and fallbacks.  
  - **Post‑call validation**: compare tool output to instruction (e.g., price within bounds).

### 6.3 Agents & Multi‑Turn
- **Symptoms**: loops, wandering, verbosity.  
- **Patterns**
  - **Explicit subgoals** and **step caps**; prompt to **stop early** when AC met.  
  - **Critic/self‑check** between steps with small judge; penalize repeated tool calls.  
  - **Memory pruning**: keep only evidence‑bearing messages.

### 6.4 Judges & Metrics
- **Symptoms**: false positives/negatives, drift.  
- **Patterns**
  - **Recalibration** with a fresh 300‑item sample; re‑estimate sensitivity/specificity.  
  - **Rewrite prompts** with more counterexamples; add **few‑shot hard negatives**.  
  - **Hybrid scoring**: execution‑based for code/math; judge only for nuance.

### 6.5 Prompts (user/system)
- **Symptoms**: style, format, missing fields.  
- **Patterns**
  - **Structured output** with JSON schema and **role rationale** only as hidden scratch (not in final).  
  - **Locale knobs** (decimal comma, address format).  
  - **Length caps** and **bulleted answers** to control verbosity.

> Pick **one** pattern per PR when possible; it shortens the loop.

---

## 7) Evaluate → Rollout → Ratchet (how to graduate a fix)

1. **Local/CI**: Tripwires first. If any gate fails, stop.  
2. **End‑to‑end & slices**: Ensure worst‑slice CI lower meets the AC.  
3. **Robustness micro‑suite**: check blur, decimal‑comma, code‑switching deltas.  
4. **Shadow**: validate cost/latency; check tool success and citations present.  
5. **Canary**: 10% for ≥ 3–5 days. Watch online SLOs and **ACs**.  
6. **Flip**: blue/green or full flag rollout.  
7. **Ratchet**: if stable for 2–3 weeks, **raise gates/SLOs** slightly (e.g., +1 pt), then lock the new baseline.

**Ratcheting rules of thumb**
- Increase only what you can **measure reliably** (CI lower preferred).  
- **Don’t ratchet two gates at once** on the same workflow.  
- Keep a **back‑off plan**: if the gate blocks >2 PRs in a week for noise, revisit the metric or calibration.

---

## 8) Weekly Rituals (a 90‑minute cadence)

### Monday — **Quality Review** (45 min)
- **Inputs**: weekly dashboard, worst‑slice trend, top regressions list, incidents.  
- **Decisions**: pick **Top 3** EQL items; assign owners; agree on **ACs**; set target release dates.

### Daily — **Micro‑standup** (10 min)
- Yesterday’s movement on Top 3, blockers, changes to ACs if evidence contradicts.

### Thursday — **Rollout Review** (20 min)
- Canary deltas; decide flip/hold; confirm no new safety/freshness incidents.

### Friday — **Retrospective** (15 min)
- What sped up the loop? What slowed it? Update checklists/templates.

**Roles**
- **PM**: ensures problems are **user‑backed** and ACs match business goals.  
- **EM/Tech Lead**: keeps the loop **small‑batch** and improves tooling.  
- **DS/ML**: designs evals, calibrates judges, analyzes deltas.  
- **QA/Annotation lead**: maintains gold/debug sets.  
- **Risk/Legal**: reviews safety and compliance gates for ratcheting.

---

## 9) Example: Fintech Support RAG — shipping a 1‑week fix

**Problem**: BR merchants ask about **parcelamento** fees; answers cite a generic page, sometimes stale.

**Monday Diagnose**
- Signals: grounding proxy dipped from 0.97→0.92 on **pt‑BR × policy**; freshness violations 3/day.  
- Traces show index age ~60 days on `fees_policy_br` corpus.

**Hypothesis & ACs**
- Hypothesis: “Nightly recrawl + TTL=21d + prompt rule requiring fee table version ≤ `as_of` will restore grounding.”  
- AC1: **Grounded true success** +2 pts (CI lower) on the target slice in CI.  
- AC2: **Freshness violations** return to 0 during canary week.  
- AC3: **Latency/cost** within ±10%.

**Countermeasure**
- Infra: add TTL + recrawl on corpus; pin the most recent fee doc.  
- Prompt: “If most recent fee table date > `as_of`, answer: ‘I don’t have the latest fee table for your date.’”

**Evaluate**
- CI L1/L3 pass (+2.4 pts). Robustness fine.  
- Shadow: no cost change; citations present 99%.  
- Canary (10%): 5 days; violations 0; worst‑slice CI lower 0.87→0.89.

**Rollout & Ratchet**
- Flip to 100%; after 2 weeks stable, raise **grounded precision** gate from 0.92→0.94 for policy Q&A.

**Documentation**
- Add 8 failing traces to **debug set**; write a 1‑page **countermeasure card** (what worked/why).

---

## 10) Templates & Checklists

### 10.1 Hypothesis + ACs (paste into PR)

```markdown
**Problem:** [link to backlog card + traces]

**Hypothesis:** If we [intervention], then [metric] will improve for [slice], because [mechanism].

**Acceptance Criteria**
- Primary: [metric + target + CI type] on [slice] in CI L3
- Guardrails: [safety, hallucination proxy, latency, cost]
- Robustness: [delta bounds]
- Deployment: [shadow/canary SLOs and duration]

**Plan:** [L1→L3 steps; shadow; canary]

**Observability:** new counters/logs added? [yes/no]
```

### 10.2 Countermeasure Card (for the wiki)

```markdown
# Countermeasure: Freshness Guard for Policy Tables
**When to use:** RAG answers risk citing stale tables.
**Steps:** TTL + nightly recrawl + prompt freshness check.
**Signals improved:** Grounding proxy, freshness violations.
**Known tradeoffs:** Slight uptick in index rebuild cost.
**Related debug sets:** br-policy-freshness-32.
```

### 10.3 Ratcheting Checklist
- [ ] Metric stable (no negative trend) for ≥ 2 weeks.  
- [ ] No open incidents in that workflow.  
- [ ] Variance understood (CI width ≤ 3 pts).  
- [ ] Stakeholders agree (PM/Risk).  
- [ ] Update: CI gate, SLO doc, runbook, dashboards, and **gold/debug sets**.

---

## 11) Anti‑Patterns (what slows the flywheel)

- **Mega‑PRs** touching prompts + retriever + tools at once → hard to attribute deltas.  
- **No slices**: averages hide regressions in long‑tail locales.  
- **Over‑rotating to judges**: rely on calibrated true success and execution‑based scoring when possible.  
- **Skipping shadow**: canary outages from schema mismatches or tool limits.  
- **Ratchet too early**: gates that block work for noise discourage engineers.  
- **Never delete debug sets**: retire obsolete ones or they dilute signal.

---

## 12) Exercises

1. **Backlog Setup:** Create your taxonomy‑aware backlog with 10 items populated from real traces. Include hypotheses and ACs.  
2. **Prioritize with EQL:** Rank the items and pick your Top 3 for next week.  
3. **Write a PR:** Draft a small countermeasure PR with the **Hypothesis + AC** template.  
4. **Run a Loop:** Execute the full loop (CI → shadow → canary). Paste the PR bot comment and interpret the deltas.  
5. **Ratcheting Plan:** After two weeks of stability, propose which gate to raise and by how much. Justify with CI width and incident history.  
6. **Countermeasure Card:** Document one successful fix and add 8–20 examples to the debug set that reproduce the old failure.

---

## Summary

The **Continuous Improvement Flywheel** is how mature AI teams convert eval craft into **predictably rising quality**. Use your taxonomy to keep a sharp **backlog**, write **hypotheses and ACs** so every change has a measurable intent, prefer **small, reversible** countermeasures, and graduate fixes through **CI → shadow → canary**. When stable, **ratchet** gates and SLOs so the baseline never slides back. Repeat weekly. Over a quarter, these 1–2 point lifts compound into **order‑of‑magnitude** reductions in user harm and support load.

> Next: **9.4 — Practical Considerations & Common Pitfalls for Production LLM Evaluation** — what breaks in the wild and how to design around it.
