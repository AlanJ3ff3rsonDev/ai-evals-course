# AI Evals for Engineers & PMs  
## Lesson 4.1 — “Benevolent Dictators” Are Sometimes Preferable

> **Where we are in the course:**  
> Chapter 3 gave you a complete *error‑analysis engine*—datasets, taxonomy, labels, CI, and iteration.  
> **Chapter 4** is about *collaboration*: how multiple people (PMs, engineers, SMEs, labelers, compliance) label and refine together **without** grinding to a halt.  
> We start with a pragmatic truth: in the messy early/mid stages, *consensus can be a trap*. A **benevolent dictator** (BD) model often delivers faster, more consistent evaluations—*if* you wrap it in the right guardrails.

---

### Learning objectives
By the end of this lesson you will be able to:
1. Explain the **benevolent‑dictator** model and when to prefer it over consensus.  
2. Stand up a lightweight **governance system** (roles, RACI, escalation, decision records).  
3. Run short **calibration & adjudication** sessions that end in clear, reproducible decisions.  
4. Track **fairness and quality** with simple team metrics (IAA, time‑to‑decision, appeal rate).  
5. Produce the artifacts you need: **BD Charter**, **Annotation Decision Record (ADR)**, **Adjudication Ladder**, and **Calibration Agenda**.

---

## 1) The problem with pure consensus
- **Endless debates.** Ambiguous traces lead to Slack threads that span days.  
- **Taxonomy drift.** Each annotator invents shades of meaning; labels diverge.  
- **Slow iteration.** If every change needs everyone’s sign‑off, the product stalls.  
- **Unequal expertise.** Domain specialists (compliance, risk) have context others lack; “one person, one vote” can enshrine wrong calls.

> **Goal of collaboration in evals:** *shared understanding* and *stable labels*—not democracy for its own sake. You want **speed + consistency + accountability**.

---

## 2) What is a “Benevolent Dictator” in evaluations?
A **benevolent dictator** is a designated **adjudicator of last resort** who:
- **Owns the taxonomy & codebook**, and can make binding tie‑break decisions.  
- **Resolves disputes quickly** (time‑boxed), writing an **ADR** so others can follow.  
- **Updates the guide** and bumps **rubric/taxonomy versions** when definitions change.  
- **Reports transparently** (dashboards; ADR log); can be *replaced* if the team loses trust.

Think of the BD like an **editor‑in‑chief** of your labeling: the buck stops somewhere so shipping continues.

**Benevolence = guardrails:** transparent decisions, evidence‑first reasoning, ability to appeal, and periodic review/rotation.

---

## 3) When to choose BD vs consensus

| Situation | Prefer **BD** | Prefer **Consensus/Committee** |
|---|---|---|
| Early taxonomy formation; ambiguous domain | ✅ |  |
| High **cost of delay** (product blocked) | ✅ |  |
| Strong **asymmetry** in expertise (e.g., compliance) | ✅ |  |
| Policy/ethics with external implications |  | ✅ |
| Mature, stable taxonomy; training junior raters |  | ✅ |
| Cross‑org standards (interoperability) |  | ✅ |

**Rule of thumb:** Use BD **by default** until the taxonomy stabilizes; then expand shared ownership.

---

## 4) Lightweight governance (RACI + artifacts)

### Roles (adapt to your team)
- **BD (Adjudicator/Editor‑in‑Chief)** — final call; owns codebook & TCRs.  
- **SME(s)** — domain experts (e.g., collections policy, finance).  
- **Labelers** — engineers/analysts applying the codebook.  
- **QA Lead** — monitors IAA, drift, and label quality.  
- **Data Steward** — dataset splits, provenance, CI gates.

### RACI for a single disputed item
- **Resolve:** BD *(Responsible)*  
- **Advise:** SME, QA *(Consulted)*  
- **Apply:** Labelers *(Informed after decision)*

### Required artifacts
1. **BD Charter** — scope, authority, how to appeal, rotation cadence.  
2. **ADR Log** — 1‑pager per decision with examples and the *rule that emerged*.  
3. **Adjudication Ladder** — what gets decided where; time limits.  
4. **Calibration Agenda** — weekly 30‑minute agenda to realign and update the guide.

---

## 5) The Adjudication Ladder (time‑boxed escalation)

1. **Rater self‑check (≤2 min):** Reread **decision rules** in the guide; add evidence span.  
2. **Peer ping (≤5 min):** Ask a second rater in a shared thread; if agreement → ship.  
3. **Micro‑huddle (≤10 min):** Rater + SME on Zoom: propose a rule; collect counter‑example.  
4. **BD decision (≤24 h):** BD reviews evidence, writes an **ADR**, and updates the guide.  
5. **Appeal (rare):** If compliance/ethics implicated, escalate to **committee** (weekly slot).

**Service level:** No item sits blocked >24h. Unresolved patterns become **TCRs** (taxonomy change requests).

---

## 6) Annotation Decision Record (ADR) — template

```
ADR-2025-08-09-007
Context: Dispute between FM-GEN-FAITH-UNSUPPORTED_CLAIM vs FM-RET-FAITH-GOLD_NOT_IN_TOPK.
Evidence: Output states "valor total R$ 2.315" without citing a doc; retrieval top-5 lacked statement.
Decision: Label BOTH: RET.GOLD_NOT_IN_TOPK (primary) + GEN.UNSUPPORTED_CLAIM (symptom).
Rule added: When a factual value appears without a supported doc in top-k, add RET cause tag.
Impact: Taxonomy unchanged; codebook §3.2 updated; 2 regression seeds added.
Owner: BD (m.silva)  Reviewers: SME(compliance), QA
```

**Why ADRs matter:** They turn “tribal memory” into **searchable precedent**—critical for onboarding and reproducibility.

---

## 7) Calibration & adjudication sessions (30‑minute script)

1. **5’ Metrics check** — IAA (overall & by mode), disagreements per 100 items, time‑to‑decision, top confusion pairs.  
2. **20’ Case review** — Walk through 6–8 disputes (screenshare). For each: read evidence → propose rule → BD decides → write ADR.  
3. **5’ Codebook update** — Enumerate changes; bump **rubric_version**; announce in Slack.

> **Output:** ADR links, updated guide, mini‑TCR list, and 2–3 new regression seeds.

**IAA quickies** (we’ll formalize IAA in 4.3): start with **percent agreement**, then track **per‑mode** agreement and **confusion pairs**.

---

## 8) Guardrails that keep “dictator” benevolent
- **Evidence‑first**: No decision without an **evidence span** or log line.  
- **Public log**: ADRs and guide diffs live in the repo; weekly digest post.  
- **Rotation**: Re‑confirm BD every 4–8 weeks or rotate across areas (e.g., retrieval BD, safety BD).  
- **Appeal path**: Compliance/ethics appeals go to a small committee.  
- **Health metrics**: Track **appeal rate**, **IAA trend**, **disagreements aging**.  
- **Sunset**: As taxonomy stabilizes (IAA >0.85; disputes <5/100), move to **committee** or shared ownership.

---

## 9) What to measure (team‑health metrics)
- **IAA (agreement)** overall and **by mode** (exact).  
- **Disagreements per 100 items** and **time‑to‑decision** (median).  
- **Appeal rate** (% of BD decisions escalated).  
- **Rule velocity**: ADRs/week and codebook diffs (small steady changes are healthy).  
- **Label drift**: % of labels changed after ADR publication (should drop).

Set **weekly targets** (e.g., TTDecision ≤ 24h; disagreement aging p90 ≤ 2 days).

---

## 10) Implementing BD in one week (turnkey)

**Day 1** — Nominate BD(s); write a 1‑page **Charter** (scope, ladder, appeal).  
**Day 2** — Create **ADR folder** + template; wire a Slack emoji to mark “needs adjudication”.  
**Day 3** — First **calibration** (20 items); publish 3 ADRs; bump rubric version.  
**Day 4** — Add **dashboard** tiles (IAA, disagreements aging, time‑to‑decision).  
**Day 5** — Retro: what slowed decisions? Adjust ladder limits; rotate a backup BD.

Artifacts produced: `bd-charter.md`, `adr/ADR-*.md`, `calibration-agenda.md`, dashboard screenshot.

---

## 11) Case study: CollectAI (running example)

**Context**: Multilingual debt‑collection assistant (WhatsApp & Email, PT/ES).  
**Pain**: Frequent disputes on *unsupported amounts* vs *retrieval misses*; compliance risk on discounts.  
**BD model**: Product PM as BD for **generation/compliance**; platform engineer as BD for **retrieval/format**.  
**Changes**:  
- 2‑step **Ladder** installed; BD decisions within 24h.  
- ADR rule: “If amount mentioned and no doc in top‑k → tag RET cause + GEN symptom.”  
- Codebook examples added; 6 regression seeds frozen.  
**Results (3 weeks)**:  
- **Disagreements/100** down 40%; **time‑to‑decision** from 3.1 days → **19h** median.  
- IAA (mode IDs) up from 0.73 → **0.86**.  
- Compliance incidents (unauthorized discount) dropped to **0** in holdout & smoke.

---

## 12) Anti‑patterns (avoid these)
1. **Secret decisions** — ADRs not published; team can’t learn.  
2. **Infinite debate** — Ladder lacks timeboxes; “we’ll revisit later” never ends.  
3. **Personality capture** — BD preferences override evidence; rotate or replace.  
4. **Over‑centralization** — Every nit needs BD; empower raters with clearer decision rules.  
5. **No sunset** — When IAA is high and disputes are rare, move to committee.

---

## 13) Templates (copy/paste)

**A) BD Charter (one page)**  
```
Purpose: Fast, consistent adjudication of labeling disputes.
Scope: Failure mode definitions, severity guidance, and tie-break decisions.
Authority: BD resolves disputes ≤24h; may update codebook and bump rubric_version.
Transparency: All decisions logged as ADRs; weekly digest.
Appeals: Compliance/ethics → committee (Fridays 14:00).
Rotation: Reconfirm/rotate every 6 weeks; backup BD named.
Health metrics: IAA, disagreements/100, time-to-decision, appeal rate.
```

**B) Adjudication Ladder (repo README block)**  
```
Self-check (2m) → Peer (5m) → Micro-huddle (10m) → BD (24h) → Committee (weekly)
Never block a PR >24h without ADR link.
```

**C) Calibration Agenda (30m)**  
```
1) Metrics snapshot (IAA, disagreements aging) – 5m
2) Walk 6–8 disputes; decide & log ADRs – 20m
3) Guide updates & version bump; next week’s focus – 5m
```

**D) Slack shorthand**  
- React with 🏷️ to mark “needs adjudication”.  
- BD replies with ✅ + ADR link when resolved.

---

## 14) Micro‑exercises (45–60 minutes)
1. Draft a **BD Charter** for your team (fill the template).  
2. Build an **ADR** for one real disagreement this week; publish it and add two counter‑examples to the guide.  
3. Run a **calibration** on 12 disputed items; measure **time‑to‑decision** and **agreement uplift** before/after.  
4. Add a tiny **dashboard** tile (sheet or notebook) for disagreements aging and appeal rate.

**Deliverables:** `bd-charter.md`, `adr/ADR-YYYY-MM-DD-xxx.md`, updated `annotator_guide.md`, and a screenshot of your metrics tile.

---

### Key takeaways
- Collaboration in evals is about **speed, consistency, and accountability**, not endless consensus.  
- A **benevolent dictator** provides a **clear tie‑break** and maintains the **codebook**—with guardrails (ADRs, transparency, appeals, rotation).  
- Time‑boxed **adjudication** and **weekly calibration** prevent drift and keep iteration moving.  
- Track small team metrics (**IAA**, **time‑to‑decision**, **appeal rate**) so the process stays healthy.  
- Sunset the BD role once your taxonomy is stable and disputes are rare.

---

*End of Lesson 4.1 — “Benevolent Dictators” Are Sometimes Preferable.*
