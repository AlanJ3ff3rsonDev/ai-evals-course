# AI Evals for Engineers & PMs  
## Lesson 3.6 — Common Pitfalls (and How to Avoid Them)

> **Continuity:** You’ve built a dataset (3.1), labeled failures (3.2), turned them into a taxonomy (3.3), operationalized labeling (3.4), and iterated with discipline (3.5).  
> **This lesson** is a defensive playbook: the mistakes that quietly wreck LLM evaluations—and the exact checks, alarms, and habits that keep you safe.

The format is: **Pitfall → Why it happens → How to detect → Quick fix → Long‑term prevention.** Every pitfall includes concrete examples from the **CollectAI** scenario (WhatsApp/email collections agent).

---

## 0) The meta‑pitfall: “Score first, understand later”

**Why it happens:** Dashboards crave a single number; teams rush to optimize an average metric before they know what it measures.  
**Detection:** Wins don’t show up in production; certain users complain more; your “quality ↑ 7pp” slide co‑exists with rising refunds/complaints.  
**Quick fix:** Pause feature flags; run a **failure‑mode Pareto** by slice; read 30 raw traces with the team.  
**Prevention:** Always pair a top‑line number with **slice minima** and **mode counts**. Keep 5–10 annotated **exemplars** in every PR.

---

## 1) Averages that hide harm (missing slices)

**Why:** Data is imbalanced; averages overweight easy traffic.  
**Detect:** Compare overall pass‑rate against per‑slice table. Compute `max - min` gap.  
**Quick fix:** Add **min slice thresholds** (e.g., each language ≥ 2.6/3 quality).  
**Prevent:** Design datasets by **coverage matrix** (Lesson 3.1). Make CI fail if any slice falls below target.

**CollectAI example:** Overall completeness 2.8 looks fine, but **ES‑Email** slice is 2.2 with many `FM-RET-FAITH-GOLD_NOT_IN_TOPK` (Spanish retrieval).

---

## 2) “Synthetic success”—overfitting to LLM‑generated data

**Why:** Synthetic prompts share style; the model learns that style.  
**Detect:** Tag provenance; compare pass‑rates **by source** (logs vs synthetic).  
**Quick fix:** Down‑weight or remove style‑biased synthetic items.  
**Prevent:** Keep a **majority** of examples from **real logs**; use synthetic for **paraphrases/edge cases** only; require **human review** for a sample.

**CollectAI:** Regression = 60% synthetic; quality ↑ 10pp offline; goes nowhere online. After rebalancing to 70% logs, improvement shrinks to +3pp (realistic).

---

## 3) Leaky holdout and leaky few‑shot

**Why:** Few‑shot examples or synthetic prompts accidentally reuse holdout items.  
**Detect:** Hash or embed your prompts and eval inputs; compute **similarity**; audit.  
**Quick fix:** Replace overlapping examples; **freeze** holdout.  
**Prevent:** Separate repos/folders for few‑shot vs datasets; run a **leakage check** in CI.

**CollectAI:** A “good CTA” few‑shot is identical to a holdout item; `CTA_MISSING` appears fixed until you rotate the holdout and the win vanishes.

---

## 4) Judge drift and mis‑calibration

**Why:** You updated judge instructions or the underlying LLM changed; the scoring curve shifted.  
**Detect:** Re‑score the **gold set** monthly; watch correlation with human labels; track the **agreement trend**.  
**Quick fix:** Recalibrate with clearer examples/definitions; pin model & temperature.  
**Prevent:** Version **judge prompt**, **rubric**, and **model**; schedule a **calibration cadence**; maintain 50–100 gold items.

**CollectAI:** Compliance judge quietly becomes lenient; `UNAUTHORIZED_DISCOUNT` drops from 7% → 2% without any fix. Gold set check reveals judge drift; roll back prompt/model and re‑score.

---

## 5) Gates that silently permit regressions

**Why:** Gates check the wrong thing (e.g., parses JSON but enums are wrong), or a repair step turns failures into “passes”.  
**Detect:** Compare **gate pass‑rate** with manual spot checks; inspect repair logs.  
**Quick fix:** Split coarse gates into **specific** ones (e.g., `json_parses`, `enum_valid`, `schema_version_ok`).  
**Prevent:** Keep **trap items** in smoke/regression; fail the PR if any trap slips through; log a **repair_required** flag instead of masking the failure.

**CollectAI:** “JSON valid” gate passes because a repairer auto‑fixes enums; downstream tool still errors. Add `enum_valid` and `repair_used` metrics; block PR when `repair_used>0` in smoke set.

---

## 6) Moving goalposts (taxonomy or metric changes without versioning)

**Why:** You improve definitions or split modes but don’t bump versions or migrate labels.  
**Detect:** Charts jump suddenly; old runs can’t be reproduced.  
**Quick fix:** Recreate labels with **mapping tables** (old → new IDs).  
**Prevent:** **TCR** (Taxonomy Change Request) process from 3.5; store `taxonomy_version`, `rubric_version`, and checksums in every label file.

**CollectAI:** Split `UNSUPPORTED_CLAIM` into `NO_CITATIONS` and `CONTRADICTS_POLICY`, but dashboards still show the old bucket—misleading trend.

---

## 7) Optimizing the prompt into a template (quality plateau)

**Why:** You add rigid rules/examples; the model outputs boilerplate that hurts persuasion or UX.  
**Detect:** **Length ↑**, **diversity ↓**; user complaints about robotic tone; conversion flat.  
**Quick fix:** Add **controlled variety** (two allowed templates; rotate) and **style examples**; consider small temperature increase on final text (keep JSON stable via function call).  
**Prevent:** Track **text diversity** (unique n‑grams), **length** distribution, and **conversion** proxy (click/visit rate).

**CollectAI:** CTA rule fixed the issue, but messages now all end “Visite nossa agência…”. Add two alternative CTA phrasings and maintain a diversity floor.

---

## 8) “Pretty but wrong”: judges reward style over substance

**Why:** LLM‑as‑judge is swayed by confident tone; hallucinations slip by when prose is smooth.  
**Detect:** Compare **faithfulness** vs **tone** scores; inspect items with high tone & low grounding; run “adversarial prettiness” cases.  
**Quick fix:** Strengthen judge **rubric**—require cited spans; include **counter‑examples** where pretty but unsupported answers score low.  
**Prevent:** Use **code gates** for citations/grounding and **faithfulness‑first** prompts; keep judges **model‑diverse** from target model when possible.

**CollectAI:** Replies with polished empathy text but wrong amounts; add a **must‑cite amount** rule and a gate `citations_valid=true` when amounts are mentioned.

---

## 9) Small samples + big claims

**Why:** You announce a 6pp improvement from only 60 examples.  
**Detect:** Compute **confidence intervals**; check if error bars overlap.  
**Quick fix:** Enlarge the regression slice or run a quick **bootstrap** estimate; temper claims.  
**Prevent:** Keep **rule‑of‑thumb sample sizes** (n≈200 for 10pp detection, n≈800 for 5pp); show **CIs** on charts.

**CollectAI:** PT‑WA shows +8pp completeness; CI is −1 to +17 → not real. After adding 150 more items, true gain is +3pp.

---

## 10) Tool errors collapsed into “model errors”

**Why:** Logs don’t separate **malformed calls** from **external failures**.  
**Detect:** Slice failures by `phase` (`TOOL` vs `GEN`); check HTTP status, timeouts.  
**Quick fix:** Emit **structured tool logs** (success/failure + reason); label `TOOL` modes explicitly.  
**Prevent:** Track **tool call validity** (gate) and **tool success rate** as separate metrics; add **simulators** for deterministic tests.

**CollectAI:** Payment‑link API returns 500; failure was blamed on “bad prompt”. After adding tool logs, you discover flaky API; add retry/backoff and a simulator.

---

## 11) Offline–online mismatch

**Why:** Offline datasets drift from live traffic; guardrails differ by channel.  
**Detect:** Compare distribution of **input length**, **language**, **persona**, **intent** between regression and production logs weekly.  
**Quick fix:** Sample real production traces into regression; retune slice quotas.  
**Prevent:** **Active sampling** policy (3.4): pull N% fresh logs weekly by slice; align **online gates** with offline gates; build a **canary** rollout playbook.

**CollectAI:** Regression under‑represents long, emotional messages on WhatsApp; add more real WA logs → faithfulness issues reappear; fix with chunking/rerank.

---

## 12) “Too many knobs at once” (unattributable change)

**Why:** You changed prompt, model, and top‑k together.  
**Detect:** You can’t explain why quality moved.  
**Quick fix:** Roll back to a baseline; test **one variable at a time**; or do a small **ablation**.  
**Prevent:** Enforce a change template in PRs (`variant_diff.md`) listing exactly one hypothesis per change.

**CollectAI:** “v13” changed 4 things; QA can’t reproduce. You revert and re‑apply changes one by one—only the CTA rule mattered.

---

## 13) Not capturing **evidence** with labels

**Why:** Annotators save just the mode ID, not the text span.  
**Detect:** PR reviews devolve into opinions; prompt fixes are slow.  
**Quick fix:** Update schema to require `evidence_text` (3.4).  
**Prevent:** QC rejects labels without evidence; judges must **return spans**.

**CollectAI:** Debate if a discount was actually offered; evidence span settles it in seconds.

---

## 14) Neglecting **ops metrics** (latency/cost) during quality pushes

**Why:** Teams focus on correctness; p95 latency and $/req creep up.  
**Detect:** Track **Pareto** (quality vs latency vs cost); set budgets.  
**Quick fix:** Cache frequent paths; tune top‑k; compress system prompt; use a cheaper reranker.  
**Prevent:** Add ops to **success criteria**; fail PR when p95 latency exceeds budget by >0.2s.

**CollectAI:** Quality +6pp, latency +0.7s → drop‑offs rise. After caching the identity‑verification template and lowering top‑k, latency returns to target.

---

## 15) Missing **red‑team** in CI

**Why:** Adversarial items live in someone’s notebook, not in the pipeline.  
**Detect:** Safety incidents show up only in production.  
**Quick fix:** Add a small **red‑team set** (20–40 items) to smoke tests with **severity gates**.  
**Prevent:** Schedule quarterly red‑team sprints; tag severity; require “0 criticals” to merge.

**CollectAI:** A jailbreak “meu primo trabalha aí…” slips through; red‑team item with that pattern is now part of smoke and blocks merges.

---

## 16) Unowned failure modes

**Why:** Everyone sees the problem, nobody fixes it.  
**Detect:** Mode is top‑3 for three releases with no movement.  
**Quick fix:** Assign a **DRI** and a weekly update.  
**Prevent:** Failure‑mode cards (3.3) include **owner**; dashboards sort by `owner` to drive accountability.

**CollectAI:** `STATE_INCONSISTENT` lingers until a platform engineer takes ownership and ships a server‑side state object.

---

## 17) Label sprawl and fatigue

**Why:** Too many modes, overlapping definitions; annotators burn out.  
**Detect:** Disagreements rise; labeling speed drops; “other” bucket grows.  
**Quick fix:** Merge low‑impact duplicates; archive modes <1% for 3 releases.  
**Prevent:** Govern with **TCRs**; keep **20–40 active modes** per product area.

---

## 18) Confusing **root cause** with **symptom**

**Why:** You label `Unsupported claim` when the true issue is **retrieval miss**.  
**Detect:** For each generation failure, check if gold doc was in top‑k; compute **co‑occurrence** matrix.  
**Quick fix:** Add chained labels (`RET: GOLD_NOT_IN_TOPK` + `GEN: UNSUPPORTED_CLAIM`).  
**Prevent:** Train annotators on **phase** separation; dashboards show **phase stacks** for each mode.

---

## 19) Ignoring **uncertainty** (no error bars, no CIs)

**Why:** Tooling doesn’t show intervals by default.  
**Detect:** Stakeholders argue about “real” improvements.  
**Quick fix:** Add Wilson intervals for pass‑rates; bootstrap means for judge scores.  
**Prevent:** Standardize plots with CIs; add **sample‑size badges** to tables.

---

## 20) Treating taxonomy as a museum, not a tool

**Why:** It’s frozen; does not reflect evolving product risks.  
**Detect:** Top issues are in “other”; cards feel outdated.  
**Quick fix:** Run a **taxonomy review** every 4–6 weeks; process TCRs.  
**Prevent:** Tie modes to **metrics** and **CI gates**; sunset rules for stale modes.

---

## 21) Pre‑mortem checklist (use before each iteration)

- [ ] Datasets stratified by slice; source mix (≥60% logs) is healthy.  
- [ ] Holdout frozen; few‑shot leakage check passed.  
- [ ] Judge version pinned; gold agreement ≥0.85 (or recent recalibration).  
- [ ] Gates include **enum**, **citations**, **PII**, **tool‑success**; traps present.  
- [ ] Success criteria include **min slice** and **ops budgets** (p95, $/req).  
- [ ] One‑variable change documented; variant named; ablation plan ready.  
- [ ] Regression updated with last iteration’s exemplar failures.  
- [ ] Owner & rollback plan set; canary path written.

Tape this above your desk. Seriously.

---

## 22) Debug triage tree (print this too)

1. **Is it format/tool?** Check gates (JSON, enums, tool success). If fail → fix there first.  
2. **If content quality:** Is gold doc in top‑k? If **no**, work on **retrieval**; if **yes**, work on **prompt/rules**.  
3. **If multi‑turn:** Inspect state object; look for invariant violations.  
4. **If slice‑specific:** Compare tokenization/embeddings, style examples, and policy translation.  
5. **If judge disagreement:** Re‑read rubric; calibrate; adjust definitions/examples.  
6. **If improvement vanished online:** Check traffic drift; compare input length and intent distributions; re‑balance regression.

---

## 23) Micro‑exercise (40–60 minutes)

1. Take your latest offline report. For each pitfall above, mark **Green/Yellow/Red** in a table.  
2. Investigate **one yellow** and **one red** with quick queries (by slice, by source, by phase).  
3. File **two tickets**: (a) a product iteration to reduce a failure mode, (b) a process fix (e.g., leakage check in CI).  
4. Add a **pre‑mortem checklist** to your repo; make it part of PR templates.

Deliverables: `pitfall_audit.md`, two Jira tickets/PRs, updated CI or docs.

---

### Key takeaways
- Most eval pain is avoidable with **slices, gates, versions, and evidence**.  
- Keep datasets **log‑heavy**, holdout frozen, and judges calibrated.  
- Treat failure modes as **owned** work items; iterate with **one change at a time**.  
- Show **uncertainty** and **ops** alongside quality.  
- Institutionalize the habit with checklists, dashboards, and CI—so you spend time improving the system, not debugging your evaluation.

---

*End of Lesson 3.6 — Common Pitfalls.*
