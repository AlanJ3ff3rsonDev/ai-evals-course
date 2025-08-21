
# AI Evals for Engineers & PMs  
## Lesson 4.4 — Facilitating Alignment Sessions and Resolving Disagreements

> **Continuity recap:**  
> • **4.1** installed the *benevolent dictator (BD)* model and guardrails (ADRs, appeals, rotation).  
> • **4.2** gave you a scalable *collaborative annotation workflow* (states, merge rules, QA).  
> • **4.3** taught *IAA* so you can quantify rater consistency.  
> **This class** teaches the human craft: **how to run alignment sessions that turn disagreements into clear rules**—fast, respectfully, and with durable outcomes.

---

### Learning objectives
By the end of this lesson you will be able to:
1. Decide **when** to call an alignment session and **which cases** to bring.  
2. Facilitate a **30–45 minute session** that ends with decisions, not debates.  
3. Apply **evidence‑first** techniques to resolve disagreements and write **good rules**.  
4. Produce the artifacts that make outcomes stick: **ADRs**, **guide diffs**, **regression seeds**.  
5. Track **session health metrics** (decision velocity, IAA uplift, appeal rate) and continuously improve.

---

## 1) When to run an alignment session

Use the workflow metrics from 4.2–4.3 as **triggers**:

- **IAA drop**: overall or per‑mode falls > **10pp** week‑over‑week.  
- **Disagreement aging**: p90 unresolved items > **2 days**.  
- **Confusion pairs**: top 3 mode pairs account for > **30%** of disagreements.  
- **New mode or policy**: e.g., launched a refusal rule or changed compliance guidance.  
- **High‑risk slice**: disputes in *sensitive cohorts* (e.g., vulnerable users) or *regulated content*.

**Session types** (pick one):  
- **Calibration** (weekly default): review hard cases to tighten decision rules.  
- **Decision Jam** (time‑boxed): settle a specific confusion pair.  
- **TCR Review**: merge/split modes; rename IDs; update taxonomy version.  
- **Hotfix Adjudication**: unblock production (≤24h turnaround).  
- **Retro**: meta‑process improvements (cadence, docs, tooling).

---

## 2) Preparation: the Case Pack

A **Case Pack** is a small, curated set of items that deserve group attention.

**Selection recipe (15–20 items total)**  
- 8–10 from **top confusion pair(s)** (e.g., `GEN.UNSUPPORTED_CLAIM` vs `RET.GOLD_NOT_IN_TOPK`).  
- 3–5 from **new/rare** modes.  
- 2–3 **edge cases** that expose policy boundaries.  
- 2 **positive controls** (clear‑cut examples to warm up & calibrate).

**Each case includes**: `item_id`, input, model output, retrieved docs/tool logs, H1/H2/judge labels, evidence spans, slice, risk note, and a **proposed rule** (drafted by the facilitator). Put all in a single doc or dashboard for screensharing.

---

## 3) Roles & ground rules

- **Facilitator** (often the BD): timekeeper, asks for evidence, decides or records decision.  
- **Scribe**: fills an **ADR** per decision and logs codebook diffs.  
- **Raters**: present evidence and steelman each other’s positions.  
- **SME** (optional): clarifies domain/policy nuances.  
- **Observer(s)**: silent unless invited (keep group small).

**Ground rules**  
1) **Evidence or it didn’t happen** (quote spans or point to doc IDs).  
2) **Steelman first**: restate the other side’s position fairly before arguing.  
3) **One rule per decision**: aim for the smallest change that resolves the class of cases.  
4) **Time boxes**: 3–5 minutes per case; unresolved → **escalate** (ladder from 4.1).  
5) **Publish or it didn’t happen**: no private decisions; ADRs are public in the repo.

---

## 4) The 7‑step facilitation script (repeat per case)

1. **Orient (30s)** — Read *aloud* the input and model output; show retrieval/logs.  
2. **State the dispute (30s)** — “Is this `UNSUPPORTED_CLAIM` or `GOLD_NOT_IN_TOPK`?”  
3. **Evidence round (60–90s)** — H1, then H2, each shows spans/log lines; SME adds policy notes.  
4. **Hypothesis (60s)** — Facilitator proposes a **rule**: *If the value appears without a supporting doc in top‑k, tag retrieval cause + generation symptom.*  
5. **Stress test (60–90s)** — Apply the rule to 2–3 similar cases (counter‑examples or prior ADRs).  
6. **Decide (30s)** — BD makes the call (or records committee escalation).  
7. **Document (60s)** — Scribe writes ADR & codebook delta; facilitator assigns a **regression seed** and, if relevant, a **TCR** (taxonomy change request).

**Tip:** Keep a *rule parking lot*. If a rule solves just one example, it’s probably too specific—park it until you see 3+ occurrences.

---

## 5) Writing **good rules**

A rule is *good* when it is:
- **Observable** — relies on spans/logs you can actually check.  
- **Operational** — can a junior rater apply it with the codebook?  
- **Minimal** — smallest clause that explains & disambiguates; no policy essays.  
- **Bidirectional** — explains both *when to apply* and *when not to*.  
- **Versioned** — references `rubric_version` and, if needed, `taxonomy_version`.

**Example (before → after)**

> *Before:* “Amounts must be supported by documents.”  
> *After:* **Rule 3.2** — *When the assistant states a numeric **amount** and the retrieval **top‑k lacks** a document explicitly asserting that amount, label `RET.GOLD_NOT_IN_TOPK` (primary) **and** `GEN.UNSUPPORTED_CLAIM` (secondary). If a doc asserts a **different** amount, apply `GEN.CONTRADICTS_SOURCE` instead.*

Add **2 examples + 1 counter‑example** to the guide for every new rule.

---

## 6) Techniques for resolving sticky disagreements

- **Ladder of Evidence**: Ask “What span supports your label?” → “What would falsify it?”  
- **Blind first, discuss later**: Have raters label silently, then reveal; prevents anchoring.  
- **Forced ranking**: If multiple modes fit, require primary vs secondary (cause vs symptom).  
- **Boundary tests**: Construct a minimal pair example; if the rule flips, your rule is sensitive and useful.  
- **Appeal to *fix path***: Merge modes that share fixes; split modes that require different fixes (ties to 3.3 axial coding).  
- **Policy proxy**: If a policy SME is absent, apply the **most conservative** interpretation; schedule a follow‑up ADR when SME returns.

**Social dynamics**  
- Use **round‑robin** input: junior voices first.  
- If two people dominate, switch to **silent voting** (thumbs in Zoom, form, or emoji).  
- Keep **psychological safety**: treat disagreements as a sign your guide needs work, not that a person is “wrong.”

---

## 7) Templates (copy/paste)

**A) 30‑minute Calibration Agenda**  
```
1) Metrics snapshot (IAA by mode; disagreement aging; top confusion pairs) – 5m
2) Case pack walkthrough (8–10 items; 3–4 minutes each) – 25m
   - Evidence → Proposed rule → Stress test → Decide → ADR
3) Codebook diffs & version bump; assign regression seeds – 3m
4) Announcements & parking lot – 2m
```

**B) ADR (Annotation Decision Record)**  
```
ADR-2025-08-09-014
Case: t_004219  Slice: pt/whatsapp  Risk: financial amount
Question: UNSUPPORTED_CLAIM vs GOLD_NOT_IN_TOPK vs CONTRADICTS_SOURCE
Evidence: Output "valor R$ 2.315"; top-5 docs contain no explicit 2,315; doc d17 states 2,135
Decision: Label RET.GOLD_NOT_IN_TOPK (primary), GEN.CONTRADICTS_SOURCE (secondary)
Rule: If a stated numeric value conflicts with any retrieved doc value → CONTRADICTS_SOURCE; if no doc asserts the value → UNSUPPORTED_CLAIM + RET.GOLD_NOT_IN_TOPK
Diff: Codebook §3.2 updated with 2 examples and 1 counter-example
Seeds: Added t_004219 and t_003901 to regression_v6
Owner: BD (a.souza)  Reviewers: SME(compliance), QA
```

**C) Disagreement Triage Rubric**  
- **Blocker?** (policy/compliance/PII/safety) → prioritize now.  
- **Frequency?** Seen ≥3 times this week? → add to case pack.  
- **Impact?** Affects a top Pareto mode or key slice? → add.  
- **Confusion pair?** If yes, include at least two **contrast** examples.

---

## 8) Asynchronous vs. synchronous sessions

**Async (doc‑first)** works when time zones clash. Recipe:  
1) Post the **case pack** with a comment template (position + evidence + proposed rule).  
2) Collect comments for 24 hours.  
3) BD publishes decisions + ADRs.  
4) Hold a **10‑minute** sync just to clarify rule wording & assign seeds.

**Sync** is better for complex policy topics; record screen with spans visible.

---

## 9) Metrics for session health

- **Decision velocity**: decisions/hour; target **8–15** depending on complexity.  
- **IAA uplift**: IAA (per‑mode) **before vs after**; aim for +5–10pp where disagreements were concentrated.  
- **Appeal rate**: % of ADRs escalated; target **<5%**.  
- **Re‑label rate**: % of items changed in the week after rule publication; should **decline over time**.  
- **Seeds added**: 3–10 regression items per new/changed rule.

Track these on the same dashboard as 4.2 (coverage, aging, Pareto).

---

## 10) Case study — **CollectAI** (running example)

**Context**: PT/ES WhatsApp & Email for debt collection. Disputes on amounts and tone.  
**Trigger**: IAA for `UNSUPPORTED_CLAIM` fell from 0.86 → **0.71**; confusion with `CONTRADICTS_SOURCE`.  
**Action**: Decision Jam (45m) with 12 cases; SME from compliance joined.

**Outcomes**:  
- New **Rule 3.2** (see section 5) + counter‑examples.  
- **ADR‑014…019** published; 7 seeds frozen.  
- IAA one week later: **0.71 → 0.84** on that mode; overall IAA **+4pp**.  
- Disagreement aging p90 dropped to **< 1.5 days**.

---

## 11) Anti‑patterns & quick fixes

- **“Let’s debate the taxonomy first.”** → Decide *labels* for current cases; file a **TCR** separately.  
- **Rules without examples.** → Each rule needs *two* examples and *one* counter‑example.  
- **Hidden decisions.** → ADRs or it didn’t happen. Post a weekly digest.  
- **Scope creep.** → If you’re writing more than 3 sentences, the rule is probably two rules.  
- **Endless escalations.** → Use the ladder; if committee meets weekly, assign a **temporary default** to unblock work.

---

## 12) Micro‑exercises (45–60 minutes)

1) **Case Pack Build** — From last week’s data, pick 10 items that represent your top confusion pair. Paste into a doc with spans/log links and a proposed rule per case.  
2) **Run a Mini‑Session** — 30 minutes with 3 roles (facilitator, scribe, rater). Produce at least **2 ADRs** and **1 guide diff**.  
3) **Measure Uplift** — Re‑label 30 items for that mode 48h later; compute IAA change and disagreement aging.

**Deliverables**: `case_pack_<date>.md`, `adr/ADR-...`, `annotator_guide_diff.md`, small table with IAA before/after.

---

## 13) Checklist — a “done right” alignment session
- [ ] **Trigger** justified (metric or policy change).  
- [ ] **Case pack** curated (8–15 items; includes contrast examples).  
- [ ] **Facilitation script** followed; time boxes respected.  
- [ ] **Decisions** recorded as ADRs; examples added to guide.  
- [ ] **Seeds** added to regression set; TCRs filed if taxonomy changed.  
- [ ] **Digest** posted; metrics tracked (velocity, IAA uplift, appeal rate).

If you can tick all boxes, your sessions will be **fast, fair, and durable**.

---

### Closing
Disagreements are **signals**, not annoyances. With a small dose of structure—case packs, evidence‑first facilitation, ADRs, and follow‑through—you’ll turn those signals into **crisp rules** that raise IAA, stabilize labels, and accelerate product iteration.

**Next up (4.5):** We wire these collaborative labels into **automated evaluators** so you get the speed of machines with the judgment of your team.

---

*End of Lesson 4.4 — Facilitating Alignment Sessions and Resolving Disagreements.*
