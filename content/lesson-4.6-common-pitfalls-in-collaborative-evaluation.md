
# AI Evals for Engineers & PMs  
## Lesson 4.6 — Common Pitfalls in Collaborative Evaluation (and How to Fix Them)

> **Continuity recap:**  
> • **4.1** set up governance (benevolent dictator, escalation ladder).  
> • **4.2** built the collaborative annotation workflow (states, merges, QA, CI).  
> • **4.3** measured reliability with IAA.  
> • **4.4** taught facilitation and rule‑making with ADRs.  
> • **4.5** wired labels into automated evaluators.  
> **This lesson** is the “sharp edges” guide: the mistakes we all make, how to spot them early, and the fastest fixes. Keep this beside your dashboard.

---

## How to use this lesson

Each pitfall is formatted as **Symptom → Why it happens → Quick diagnostics → Playbook (fix)**. Copy/paste the checklists into your team’s runbooks.

---

## 1) “Percent Agreement looks great” (but quality is bad)

**Symptom**  
- 90%+ raw agreement, yet obvious errors slip through; product metrics don’t improve.

**Why it happens**  
- **Imbalanced labels** (everyone chooses “pass”).  
- **Ambiguous tasks** where raters avoid choosing hard modes.  
- Over‑reliance on **percent agreement** which ignores chance agreement.

**Diagnostics**  
- Inspect **label distribution**; is one label >80%?  
- Compare **Cohen’s κ / Fleiss’ κ / Krippendorff’s α** to raw agreement.  
- Sample 20 “agreed” items; count true positives.

**Playbook**  
1. Track **κ/α** in dashboards, not just percent agreement.  
2. Add **hard negative** examples to the guide; require **primary vs secondary** labels.  
3. Use **active sampling** to over‑sample borderline items.  
4. In 4.4 sessions, enforce **evidence spans**—no label without proof.

---

## 2) Taxonomy creep (too many, too similar modes)

**Symptom**  
- New failure modes every week; confusion pairs explode; raters hesitate.

**Why it happens**  
- Rules written as **policy essays**; ambiguous boundaries.  
- Modes reflect **symptoms** rather than **fix paths**.  
- Lack of a **TCR** (taxonomy change request) discipline.

**Diagnostics**  
- Top 5 confusion pairs cover > 30% of disagreements.  
- 20+ modes but < 5 drive fixes.  
- Raters ask “what’s the difference between X and Y?” every session.

**Playbook**  
1. **Merge by fix**: If two modes lead to the same engineering fix, merge.  
2. **Split by decision**: Split only if different *decisions* are implied.  
3. Require a **TCR** with 3 examples, 1 counter‑example, and a fix path.  
4. Keep a **mode lifecycle** table (`proposed → trial → accepted → deprecated`).  
5. Re‑run IAA after big taxonomy changes (4.3).

---

## 3) Guide bloat (no one reads it)

**Symptom**  
- 30‑page guide; raters still ask the same questions; inconsistent labels.

**Why it happens**  
- Accreted policies without curation; examples buried.  
- No **versioned diffs**; people don’t know what changed.

**Diagnostics**  
- Time‑to‑onboard > 4 hours.  
- ADRs reference rules that aren’t **searchable**.  
- Raters keep private notes (a shadow guide).

**Playbook**  
1. Convert to **example‑first**: for each rule, show **2 positives + 1 counter‑example**.  
2. **Chop**: move rationale to **appendix**; keep rules crisp (≤3 sentences).  
3. Maintain a **CHANGELOG** with semantic versioning (`rub_v1.8 → 1.9`).  
4. Add **search** (or anchors) and a 1‑page **quicksheet** used during labeling.

---

## 4) Consensus collapse (anchoring and hierarchy issues)

**Symptom**  
- First speaker sets the tone; junior raters never disagree; apparent harmony hides errors.

**Why it happens**  
- Live labeling without **blind passes**.  
- BD or SME speaks first; others conform.

**Diagnostics**  
- In sessions, decisions happen **before** evidence is shown.  
- Low IAA despite “agreement” during meetings.  
- Slack DMs with “I thought it was Y, but…” after the call.

**Playbook**  
1. Use **blind first, discuss later** (4.4).  
2. **Steelman**: require each side to present the other side’s case.  
3. **Round‑robin**: junior voices first; BD speaks **last**.  
4. Switch to **silent voting** when two speakers dominate.

---

## 5) Evidence‑free judging

**Symptom**  
- Labels without spans, doc IDs, or tool logs; ADRs read like opinions.

**Why it happens**  
- Prompting raters to “decide” without a **proof requirement**.  
- Tooling doesn’t support **highlighting** or doc ID insertion.

**Diagnostics**  
- >10% of ADRs have empty Evidence fields.  
- Judge prompts (4.5) often return labels without **evidence**.

**Playbook**  
1. Make **evidence mandatory** in the annotation schema; block save otherwise.  
2. Update **LLM‑as‑Judge** prompts to **reject** outputs lacking evidence.  
3. Add a **QA audit**: sample 20 items/week; fail if evidence is missing.

---

## 6) Sampling lies to you

**Symptom**  
- Offline metrics look great; production users still hit failures.

**Why it happens**  
- Dataset not representative of **slices** (language, channel, risk).  
- Over‑index on **happy path** examples.

**Diagnostics**  
- Compare **slice distribution** with production telemetry.  
- Large **metric swings** after release; sharp regressions in a single slice.

**Playbook**  
1. Build a **slice quota** in the sampler (per language/channel/risk).  
2. Maintain **seed sets** (regressions, edge cases) and **random refresh** weekly.  
3. Track metrics **by slice**; gates fire on worst slice (not just overall).

---

## 7) Gold starvation (no ground truth to keep judges honest)

**Symptom**  
- Automated evaluators (4.5) drift silently; nobody notices until a postmortem.

**Why it happens**  
- Stopped dual‑labeling; no **calibration stream**.  
- Judge versions change without **canary** or **shadow mode**.

**Diagnostics**  
- No judge‑vs‑gold chart within last 14 days.  
- `evaluator_version` changed with no PR discussion.

**Playbook**  
1. Reserve **5–10%** of traffic for **gold** every week.  
2. **Shadow** new judges for 1 week; canary on last 2 weeks of gold.  
3. Alert when agreement with gold drops **>10pp** on any critical mode.

---

## 8) ADR theater (decisions made, nothing changes)

**Symptom**  
- Beautiful ADRs; same disputes appear next week; product doesn’t improve.

**Why it happens**  
- ADRs not **linked** to guide diffs, seeds, and CI gates.  
- No owner/assignee; ADRs sit in a folder.

**Diagnostics**  
- ADRs lack **“Diff/Seeds/Owner”** sections.  
- No **regression seeds** referencing the ADR ID.

**Playbook**  
1. Extend your ADR template with: **Diff**, **Seeds**, **Owner**, **Due date**.  
2. Freeze **3–10 seeds** per new rule; add to nightly **regression suite**.  
3. Include **ADR links** in failing CI diffs so engineers can apply fixes.

---

## 9) Cost & speed blow‑ups

**Symptom**  
- Labeling stalls; budget gets eaten by review loops and judge calls.

**Why it happens**  
- Every item goes to **double labeling**; judges run on **all** traces.  
- No **Pareto** focus on high‑impact modes.

**Diagnostics**  
- Per‑item reviewer minutes doubled in a month.  
- Judge costs rise linearly with traffic, not tied to risk.

**Playbook**  
1. Use **adaptive labeling**: single‑label low‑risk items; dual‑label only on high‑risk or low‑confidence.  
2. Run judges **selectively** (changed slices, failing seeds, canaries).  
3. Track **cost per decision**; set budgets per slice.

---

## 10) Lab–prod mismatch (the classic)

**Symptom**  
- Offline passes, online fails; users report issues unseen in bench.

**Why it happens**  
- Bench lacks **tool call traces**, updated **RAG indexes**, or **fresh prompts**.  
- Different **temperature/tools** configuration online.

**Diagnostics**  
- Check **trace parity**: are tool logs and retrieval exactly the same?  
- Compare model/prompt versions between envs.

**Playbook**  
1. Mirror **production configs** (model, temperature, tools, top‑k).  
2. Capture **full traces** in prod and replay them offline.  
3. Add a **smoke suite** that runs on real, recent prod traces daily.

---

## 11) Over‑fitting the judge to the bench

**Symptom**  
- Judge shows great agreement on last month’s data but collapses on new topics.

**Why it happens**  
- Prompt full of **verbatim examples** from seeds only; no diversity.  
- Lack of **random refresh** in the bench.

**Diagnostics**  
- Agreement drops sharply on a new theme/slice.  
- Examples in the prompt are all from the same week/product area.

**Playbook**  
1. Keep **examples diverse** (slices, difficulty, time). Limit to **6–10** high‑leverage examples.  
2. Refresh **random** 20–30% of bench weekly.  
3. Monitor **agreement by novelty** (time since item was added).

---

## 12) Conflating cause and symptom

**Symptom**  
- Labels mix retrieval issues and generation issues; fixes are misdirected.

**Why it happens**  
- Modes defined by surface text, not by **fix path**.  
- Raters not trained to assign **primary (cause) vs secondary (symptom)**.

**Diagnostics**  
- Many items tagged **both** `UNSUPPORTED_CLAIM` and `HALLUCINATION` with no retrieval tag.  
- Engineering fixes don’t move the metric.

**Playbook**  
1. Require **cause → symptom** ordering (primary vs secondary).  
2. Retrieval checker (programmatic) sets **RET** modes; judge sets **GEN**.  
3. Train with **paired examples** that show causal differences.

---

## 13) Multilingual & channel pitfalls

**Symptom**  
- Great results in EN/Web; worse in PT/WhatsApp or ES/Email.

**Why it happens**  
- Guides and judge prompts written in **one language**; examples not localized.  
- Channel‑specific tone/format rules missing.

**Diagnostics**  
- Agreement drops by **language** or **channel**; tone scores skew.  
- ADRs cite EN‑only rules.

**Playbook**  
1. Localize **rules and examples**; avoid culturally loaded phrasing.  
2. Track **IAA and judge agreement by language/channel**.  
3. Add **channel‑specific** checks (CTA button, character count, link formats).

---

## 14) Missing “definition of done” for sessions

**Symptom**  
- Weekly meetings feel useful but produce little change.

**Why it happens**  
- No **time box**, no **ADR count goal**, no **seed quota**.

**Diagnostics**  
- Sessions end with “we’ll think more.”  
- ADRs don’t show up in changelog.

**Playbook**  
1. Use the 4.4 **30‑minute agenda**; set a goal: **≥5 decisions**.  
2. Capture **decision velocity** and **IAA uplift** week‑over‑week.  
3. Publish a **digest** with links to ADRs and diffs.

---

## 15) Pitfalls in metrics & reporting

**Symptom**  
- Dashboards are pretty but unhelpful; teams argue over what “good” means.

**Why it happens**  
- Aggregates hide **slice failures**; thresholds unclear.  
- Metrics not **aligned to action** (no gates).

**Diagnostics**  
- Success rate looks flat; individual slices swing ±10pp.  
- No chart for **“agreements vs gold”** per mode for the judge.

**Playbook**  
1. Show **mode × slice** tables; default sort by **worst performer**.  
2. Define **gates** (min success per slice; no critical regressions).  
3. Add **sparklines** and **error bars**; link failing cells to example traces.

---

## Quick reference — Pitfall to Fix table

| Pitfall | Fastest Fix |
|---|---|
| Percent agreement only | Track κ/α; add hard negatives |
| Taxonomy creep | Merge by fix; TCR with examples |
| Guide bloat | Example‑first; changelog; quicksheet |
| Consensus collapse | Blind first; junior first; silent vote |
| Evidence‑free labels | Make evidence required; QA audits |
| Sampling bias | Slice quotas; seeds + random refresh |
| Gold starvation | 5–10% calibration stream; shadow/canary |
| ADR theater | ADR Diff + Seeds + Owner + CI links |
| Cost blow‑ups | Adaptive labeling; selective judges |
| Lab–prod mismatch | Trace parity; smoke on prod traces |
| Judge over‑fit | Diverse examples; novelty monitoring |
| Cause vs symptom | Primary/secondary; retrieval checker |
| Multilingual gaps | Localize rules & examples; track by slice |
| Meetings w/o outcomes | Time box; decision velocity; digest |
| Dashboard theater | Mode×slice; gates; links to cases |

---

## Exercises (45–60 minutes)

1) **Pitfall audit:** Use the table above to score your current pipeline (0=not a problem, 1=emerging, 2=hurts). Pick **top 3** to fix this week.  
2) **Guide refactor:** Rewrite one bloated rule into the **example‑first** format with 2 positives + 1 counter‑example. Submit as a PR.  
3) **Bias check:** Compute judge‑vs‑gold agreement by **language × channel**; create a one‑pager of findings and propose one TCR.

**Deliverables:** `pitfall_audit.md`, `guide_diff.md`, `bias_report.md`.

---

## Checklist — keep yourself honest
- [ ] κ/α tracked weekly per mode; label distribution monitored.  
- [ ] TCR process enforced; mode lifecycle table maintained.  
- [ ] Guide is example‑first with a visible changelog.  
- [ ] Sessions produce ADRs with Diff/Seeds/Owner; digest posted.  
- [ ] Calibration stream active; judge shadow/canary before flips.  
- [ ] Bench mirrors prod; smoke runs on recent prod traces.  
- [ ] Dashboards show mode×slice; gates protect worst slices.

---

### Closing
Collaborative evaluation scales only when **process + measurement + automation** reinforce each other. Most failures are **predictable**—and fixable—once you watch the *right* signals, write **operational rules**, and wire decisions into **seeds and gates**. Keep this checklist handy; revisit after every retro.

**Next (4.7):** We’ll summarize Chapter 4 and extract the “playbook on a page,” then move to **Exercises (4.8)** to practice all of it.
