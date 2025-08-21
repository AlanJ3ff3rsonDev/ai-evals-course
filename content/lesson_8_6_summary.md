# Lesson 8.6 — **Summary of Chapter 8: Specific Architectures & Data Modalities**

> **Continuity with the course:**  
> - **8.1 Tool Calling** gave you atomic measures for *actionable* steps.  
> - **8.2 Agentic Systems** scaled those measures to multi‑step reasoning and plans.  
> - **8.3 Debugging Pipelines** taught the **Four I’s** (Instrument → Inspect → Isolate → Intervene).  
> - **8.4 Modalities** split **perception vs reasoning** for images, tables, audio.  
> - **8.5 Pitfalls** gave you a radar of failure modes and countermeasures.  
> - **8.6** distills everything into an **operating procedure, checklists, thresholds, and templates** you can adopt tomorrow in product work (Nuvem Pago/Pago Nube scenarios included).

---

## 1) Executive Recap: What you can now evaluate (and ship)

You can now design, implement, and defend evaluations for:
1. **Tool‑calling steps** — *necessity, correctness, execution success, minimality, cost & latency*.  
2. **Agent runs** — *plan quality, subgoal completion, progress/loops, coordination efficiency*.  
3. **Multi‑step pipelines** — with **replayable traces**, **run diffs**, **counterfactuals**, and **acceptance tests**.  
4. **RAG quality** — *retrieval coverage, grounding precision/recall, freshness, hallucination rate, supported claims*.  
5. **Modalities** — separating **perception** (OCR/ASR/vision) from **reasoning** (math/logic/tool use) with metrics like **IoU**, **WER/CER**, **field‑level F1**, **operation correctness**.  
6. **True success** — judge calibration (sensitivity/specificity) → **bias‑corrected success** with **confidence intervals**.  
7. **CI gates** — per‑slice thresholds and canary policies that prevent regressions *without blocking progress*.

> **Bottom line:** you can instrument, measure, and iterate **end‑to‑end** while keeping shipping velocity.

---

## 2) The Metric Map (cheat sheet)

| Layer | What to ask | Core metrics | “Tripwire” metrics |
|---|---|---|---|
| **Tool step** | Did we call the **right** tool, with **correct** args, and execute safely? | necessity precision, action correctness, execution success, arg fidelity | over‑call rate, unsafe call incidents, retries/timeouts |
| **Plan/Agent** | Are we making progress with minimal chatter? | subgoal completion, steps used/limit, loop episodes, info‑gain/message | cycle rate, reflection debt, coordination overhead |
| **RAG** | Are answers **supported & fresh**? | grounded true success (support precision/recall), freshness pass rate | uncited‑claim rate, distractor susceptibility |
| **Images/Docs** | Did we read & cite the right region? | field F1 (normalized), IoU≥τ, answerability accuracy | wrong‑region‑right‑value, OCR WER drift |
| **Tables** | Are operations correct & schema‑aligned? | operation correctness, program equivalence, schema adherence | locale failure (decimal‑comma), order sensitivity |
| **Audio** | Did ASR perceive and NLU extract faithfully? | WER/CER, intent/slot F1, fidelity‑judged summaries | accent/code‑switching drop, hallucinated facts |
| **End‑to‑End** | Would a user accept this answer? | **true success** (calibrated), p90 latency, unit cost | worst‑slice CI lower bound, safety incidents |

> Keep **tripwires** cheap and fast (pre‑merge), and **core metrics** comprehensive (nightly/CI).

---

## 3) One‑Page SOP — Ship With Confidence

**S1. Scope the task.** Write a **task statement** with inputs, outputs, locale/currency, and *“what counts as done.”*  
**S2. Choose metrics per layer.** Use the metric map; pick *≤3* primary + *≤3* tripwires.  
**S3. Draft judges.** Keep prompts short, JSON‑only. Plan **calibration** (300‑item human set).  
**S4. Build the dataset.** Stratify by **task type × locale × difficulty**. Include **robustness suites** (blur, long tables, accents).  
**S5. Instrument runs.** Event schema + correlation IDs + seeds + state snapshots.  
**S6. Baseline.** Compute observed metrics **and** calibrated **true success** with CIs. Save **gold errors** separately.  
**S7. Improve.** Follow **Four I’s**; run **counterfactuals**; design **minimal fixes** with acceptance tests.  
**S8. CI gates.** Add per‑slice gates + tripwires; publish pass/fail policy.  
**S9. Canary.** Ship to 5–10% traffic with rollback conditions tied to tripwires.  
**S10. Report.** Two artifacts: **(a) 1‑page PM brief** (deltas, CI pass, risk), **(b) engineering appendix** (diffs, traces, debug set).

> Print this SOP. Use it to run weekly improvement cycles.

---

## 4) Thresholds by Risk Tier (tune to your domain)

| Risk tier | Example | Primary gates (CI lower unless noted) | Tripwires |
|---|---|---|---|
| **Tier A: Critical** | payouts, chargebacks, KYC fields | true success ≥ **0.90**; grounded precision ≥ **0.95**; safety incidents = **0** | worst‑slice ≥ **0.85**; p90 latency ≤ SLO; cost ≤ budget |
| **Tier B: Important** | policy Q&A, analytics summaries | true success ≥ **0.85**; operation correctness ≥ **0.90** | hallucination ≤ **0.02**; over‑call ≤ **0.10** |
| **Tier C: Assistive** | writing aids, drafts | true success ≥ **0.75**; style/format ≥ **0.85** | complaint rate (canary) ≤ baseline; guard content filters |

> Start strict on **safety/freshness**, flexible on style. Harden over time.

---

## 5) Templates (copy‑paste)

### 5.1 End‑to‑End Judge (calibratable)

```
You are a strict evaluator.
Task: <task statement with locale/currency/as_of>
Input digests: <retrieved snippets or cited regions/timestamps>
Assistant answer: <text>
Rules:
- Mark PASS only if the answer is correct, grounded in the provided evidence, and follows required format.
- If any claim is unsupported or contradicts evidence, mark FAIL.
Return JSON only:
{"pass": true|false, "reasons": ["unsupported_claim","format","freshness"], "notes": "<≤2 short sentences>"}
```

### 5.2 Tool Necessity Judge

```
Given the user question, retrieved context (if any), and the final answer,
decide whether each tool call was necessary to answer correctly.
Return JSON:
{"calls":[{"tool":"get_rate","necessary":true,"why":"..."}, ...],
 "over_call_rate": 0.25}
```

### 5.3 Debug Diary (from 8.3)

```
Run: <id>  | Symptom: <short>  | Tag: <taxonomy A–G>
Evidence: <timeline/graph snippets>  | Hypothesis: <one>
Fix: <minimal change>  | AC: <metrics & thresholds>  | Status: <done/canary>
```

### 5.4 CI Gate Spec (YAML‑ish)

```yaml
gates:
  e2e_true_success: {min_ci_lower: 0.85}
  grounded_precision: {min: 0.92}
  hallucination_rate: {max: 0.02}
  worst_slice_ci_lower: {min: 0.80, dimension: ["locale","task_type"]}
  over_call_rate: {max: 0.10}
  safety_incidents: {max: 0}
```

---

## 6) Worked Example (invoice Q&A across BR/AR)

**Task.** “Given an invoice image (pt‑BR or es‑AR), extract the *total amount*, *currency*, and *issue date*. Provide the answer with a citation box.”  
**Metrics.** Field F1 (normalized), IoU≥0.5 for citations, **grounded true success**, OCR WER subset, p90 latency.  
**Judges.** Grounding judge + end‑to‑end judge (calibrated on 300 items).  
**Robustness.** Blur (50/75%), rotated pages, handwritten totals, two‑currency pages.  
**Gates.** True success ≥ 0.88; worst‑slice (decimal‑comma) ≥ 0.85; hallucination ≤ 0.02; WER ≤ 0.08; latency ≤ 2.0s.  
**Debug Set.** 25 items where totals appear twice or are occluded.  
**Result.** After adding a **currency‑nearby heuristic** and OCR regex repair, grounded true success ↑ +7pts, hallucinations ↓ → 0.  

Attach: **before/after** run graphs and the debug diary.

---

## 7) What to Automate vs. Keep Human

- **Automate**: tripwires, basic correctness checks, schema/format validation, loop detection, over‑call counting, WER/IoU.  
- **LLM‑judge**: semantic grounding, operation reasoning, faithfulness. **Calibrate**.  
- **Human**: gold maintenance, ambiguity adjudication, high‑risk slices, canary review.

> The winning pattern is **human‑in‑the‑loop on small, strategic slices**; robot on everything else.

---

## 8) The “Always Be Improving” Loop (ABI)

1. **Collect** new failures from prod (traces + user flags).  
2. **Classify** with the taxonomy (A–G) and update the **Pareto chart** weekly.  
3. **Pick** one top failure; design **counterfactual probes**.  
4. **Fix** minimally; add a **debug set**; create/raise a **gate**.  
5. **Ship** to canary; watch tripwires; either rollback or roll forward.  
6. **Share** a 1‑pager (delta, cost/latency impact, slice safety).

This is the heartbeat of an eval‑driven org.

---

## 9) Glossary (rapid recall)

- **Necessity precision** — fraction of tool calls that were actually required.  
- **Grounded true success** — bias‑corrected pass rate requiring **supporting evidence**.  
- **Loop episodes** — repeated state visits in an agent trace.  
- **IoU** — overlap ratio between predicted and gold bounding boxes.  
- **WER/CER** — ASR/OCR error rates at word/character levels.  
- **Worst‑slice CI lower** — the minimum 95% CI among slices; your “do no harm” guard.  
- **Four I’s** — Instrument, Inspect, Isolate, Intervene.

---

## 10) Capstone Checklist

- [ ] Pick a **Tier A** task in your product.  
- [ ] Build a stratified **1k‑item** set with BR/AR locales and robustness suites.  
- [ ] Implement the **event schema** + **run diffs**.  
- [ ] Ship **judges** and **calibration** (300 items).  
- [ ] Baseline, then improve one failure with the **Four I’s**.  
- [ ] Add **CI gates** + **canary** and write the **1‑page brief**.  
- [ ] Present **before/after** including **true success**, **latency**, **cost**, and **worst‑slice**.

---

## 11) What’s next (Chapter 9 preview)

- **9.1 CI:** build an automated net to catch regressions.  
- **9.2 CD + Monitoring:** track real‑world performance, not just lab metrics.  
- **9.3 Continuous Improvement Flywheel:** make ABI a habit.  
- **9.4 Production Pitfalls:** real‑world traps in live evals.  
- **9.5 Summary.**

> We’ll connect your Chapter‑8 practice to **shipping loops** that keep models honest in production.

---

## Exercises

1. **SOP Drill:** Pick a new feature. Apply the **SOP** end‑to‑end; submit your gates and canary plan.  
2. **Judge Calibration:** Using 300 labeled items, compute **true success** for your end‑to‑end judge. Include CIs and per‑slice results.  
3. **Tripwire Harness:** Implement pre‑merge tripwires for loops, over‑calls, hallucination, and WER/IoU subsets. Show that a synthetic regression fails fast.  
4. **Capstone Build:** Deliver the full package (dataset, metrics, judges, gates, canary, report). Aim for +5–10 pts improvement on **true success** without cost/latency regressions.

---

## Summary (of the Summary)

Chapter 8 gave you **precision tools** to measure and improve complex LLM systems across **tools, agents, RAG, and modalities**. You now have: a **metric map**, a **shipping SOP**, **templates**, and **gates** that translate evaluation into **product reliability**. With this foundation, Chapter 9 will turn your workflow into **continuous integration & deployment** for evals.

