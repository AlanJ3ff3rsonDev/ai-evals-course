# AI Evals for Engineers & PMs  
## Lesson 2.8 — Exercises (LLMs, Prompts, and Evaluation Basics)

> **How to use this lesson:** These exercises turn Chapter 2 into muscle memory. You’ll design prompts, define metrics, elicit labels, and wire everything into a mini evaluation harness. Each exercise includes (a) **objective**, (b) **setup**, (c) **step‑by‑step tasks**, and (d) **deliverables** you can drop into a PR. Use a project you care about (recommended) or the **CollectAI** mock scenario provided.

---

### Before you start
Pick one feature to use throughout. If you don’t have one handy, use this **mock brief**:

> **Mock brief — CollectAI follow‑up**  
> Merchants want higher repayment rates. Build a WhatsApp agent that replies to debtors. The agent must be **persuasive**, **policy‑compliant**, and **grounded** in the provided policy snippet. It should propose only allowed options and end with a clear CTA.

You can swap “WhatsApp agent” with your own use case (support bot, document summarizer, tool‑calling agent, etc.).

---

## Exercise 1 — Prompting Skeleton & Input Hygiene

**Objective:** Author a prompt that converts business intent into a testable spec.

**Setup:** Use the five‑part skeleton: **Role, Goal, Inputs, Rules, Output Schema**.

**Steps**
1. Write a **one‑sentence task** (≤ 20 words).  
2. List **3–5 success bullets** (your rubric) directly in the prompt.  
3. Define **inputs** with delimiters: `<<<POLICY>>>…<<</POLICY>>>`, `<<<LAST_MSG>>>…`.  
4. Add **rules**, including *refusal conditions* (visible failure).  
5. Specify a strict **JSON output schema** (with enums/ranges and a `version`).  
6. Pin **params** you will use in eval (temperature, top_p, max_tokens, stop).

**Deliverables**
- `prompt_v1.txt` containing the skeleton.  
- A short note (3–5 lines) explaining the **trade‑offs** you made (e.g., verbosity vs cost).

**Quality check (self‑test)**
- Does another person understand “what good looks like” just from the prompt?  
- Could you validate the output with **code** (before any judge)?

---

## Exercise 2 — From Rubric to Metrics

**Objective:** Turn your rubric into **computable** metrics.

**Setup:** Use a **hybrid** design: code **gates** + judge **scores** + ops.

**Steps**
1. Mark which rubric items are **gates** (schema validity, safety, tool success).  
2. For each non‑gate item, define a **metric** (0–3 Likert or pass/fail) and an **observable** (what the judge/metric must look at).  
3. Specify **aggregation**: mean vs pass‑rate; per‑slice reporting.  
4. Set initial **thresholds** (overall and **min slice**). Include **ops budgets** (p95 latency, $/req).  
5. Write a **decision table**: what happens if thresholds are met/missed.

**Deliverables**
- `metrics.md` with a table like:  

| Item | Observable | Metric | Aggregation | Threshold | Gate? |
|---|---|---|---|---|---|
| JSON validity | output string | parses + enums valid | pass‑rate | 100% | **Yes** |
| Faithfulness | claims vs DOCS | judge 0–3 | mean by slice | ≥ 2.7; min 2.6 | No |
| Compliance | allowed options only | judge 0–3 (0=violation) | mean | **0 severe** | **Yes** |
| Tone | respectful & firm | judge 0–3 | mean | ≥ 2.7 | No |
| Latency | request traces | p95 (s) | per channel | ≤ 3.5 | **Yes** |

---

## Exercise 3 — Label Schema & Instructions

**Objective:** Make labels **consistent** and **machine‑checkable**.

**Setup:** Decide your **label JSON** and write short **instructions** (for humans or an LLM‑judge).

**Steps**
1. Draft the **label schema** with only fields your metrics need. Example:  
```json
{
  "grounding": 0, "completeness": 0, "tone": 0, "compliance": 0,
  "citations_valid": true, "format_valid": true, "notes": ""
}
```
2. Write a **1‑page instruction**: task statement, 0–3 definitions with **good/bad** examples, and **edge rules**.  
3. Include the **output JSON** and require **temperature 0** if using an LLM‑judge.  
4. Define **escalation**: any `compliance ≤ 1` must be sent to a human.

**Deliverables**
- `label_schema.json` and `judge_instructions.md`.

**Quality check**
- Could a new teammate produce the same label you would for the same example?

---

## Exercise 4 — Tiered Datasets & Slices

**Objective:** Build the minimum viable **smoke**, **regression**, and **holdout** sets with **segments**.

**Setup:** Pick slices (e.g., language PT/ES × debtor persona × channel).

**Steps**
1. **Smoke set (20–50):** 2–3 examples per slice; include 3 “obvious fails” (bad JSON, missing doc).  
2. **Regression set (200–800):** cover known failure modes (long inputs, paraphrases, tricky policy lines).  
3. **Holdout (300–1000+):** representative, **frozen**; reserve it for ship decisions.  
4. Document **provenance**: where items came from (real traces vs synthetic).

**Deliverables**
- `datasets.md` listing sizes per slice and how you sampled them.  
- CSV/JSON files for each split (even small mock data is OK).

**Quality check**
- Does each slice have enough examples to detect a 5–10pp change?  
- Are regression items linked to labeled failure modes?

---

## Exercise 5 — Build the LLM‑as‑Judge Prompt (and calibrate)

**Objective:** Create a judge you can trust for iteration and CI.

**Setup:** Use your Exercise‑3 instructions as the judge prompt.

**Steps**
1. Build the **judge prompt** with role + rubric + output JSON.  
2. Label **50–100 items** with humans (or your own careful pass). This is your **gold set**.  
3. Run the **LLM‑judge** on the same items; compute **agreement** (exact/±1 or correlation).  
4. If agreement < your bar (e.g., 85–90%), refine **definitions/examples** and retry.  
5. Decide a **re‑calibration cadence** (monthly or on vendor change).

**Deliverables**
- `judge_prompt_v1.txt`, `judge_calibration.md` with agreement numbers and notes.

**Quality check**
- Does the judge reliably **rank** prompt/model variants the same as humans?

---

## Exercise 6 — End‑to‑End Offline Evaluation

**Objective:** Run the whole eval on your **dev/regression** sets.

**Setup:** Use your prompt, judge, and metrics. Fix **temperature** and **top_p**.

**Steps**
1. Execute the system on the dataset and collect **traces** (inputs, retrieved docs if any, outputs, tool calls).  
2. Run **gates** (JSON, safety, tool success) and mark failures.  
3. Run the **judge** to score quality items; compute per‑slice metrics.  
4. Add **ops** (p50/p95 latency; $/req).  
5. Produce an **evaluation report** with tables and 5–10 concrete example traces (good and bad).

**Deliverables**
- `eval_report.md` including per‑slice tables and example links/hashes.

**Quality check**
- Could a reviewer reproduce your numbers from the report and artifacts?

---

## Exercise 7 — Error Analysis Lite (preview of Chapter 3)

**Objective:** Start a **failure taxonomy** so iteration targets are obvious.

**Setup:** Use your evaluation traces from Exercise 6.

**Steps**
1. Read 30–50 failures; **label** each with a short failure type: *Unsupported claim, Missing CTA, Policy violation, Format error, Long‑context forget, Prompt brittleness,* etc.  
2. Create a simple **bar chart** (counts per failure type) or a table.  
3. Choose **two** failure types to attack first; write a one‑paragraph **hypothesis** each (e.g., “Add explicit rule: include CTA phrase; provide example pairs”).  
4. Add **5–10** examples of each chosen failure to your **regression** set.

**Deliverables**
- `failure_taxonomy.md` + updated regression set files.

**Quality check**
- Are your top 1–2 failure types responsible for ≥ 40% of the observed errors?

---

## Exercise 8 — Foundation vs Application: Short‑list & Decide

**Objective:** Combine the two‑layer evaluation stack to pick a model/version/params.

**Setup:** Short‑list 2–4 candidate models (or 2 prompt variants).

**Steps**
1. **Foundation screen:** run lightweight checks relevant to your app (multilingual instruction following; JSON stability; basic refusal; rough latency/cost).  
2. **Application eval:** run your **regression** set with gates + judge + ops by slice.  
3. Plot a simple **Pareto chart** (quality vs cost vs latency).  
4. Write a **decision memo**: which variant you choose and why; risks; rollback plan.  
5. Freeze **holdout** for the final pre‑ship check.

**Deliverables**
- `shortlist_matrix.md`, `decision_memo.md` with Pareto snapshot.

**Quality check**
- Are you choosing a **Pareto‑efficient** option, not just the highest quality regardless of cost/latency?

---

## Exercise 9 — Online Readiness: Gates & Alerting

**Objective:** Prepare for production by defining online **monitors** that mirror offline gates.

**Setup:** Assume you’ll deploy behind a feature flag to 5–10% of traffic.

**Steps**
1. Decide **online metrics** to track: safety violations, task success proxy (click/visit/deflection), p95 latency, $/req, error rates.  
2. Set **alert thresholds** (what constitutes an incident).  
3. Define **sampling** of real traces to feed back into offline sets weekly.  
4. Write a **runbook** for rollback if gates are breached.  
5. Ensure your **logs** contain the artifacts needed for audits (prompts, params, retrieved doc IDs, judge outputs).

**Deliverables**
- `online_monitors.md` and `rollback_runbook.md`.

**Quality check**
- If a vendor changes their model tomorrow, could you detect and roll back quickly?

---

## Exercise 10 — (Optional) RAG or Tool‑Calling Specialization

Pick one path that matches your product.

### Path A — RAG
1. Build a tiny index from 20–50 policy passages.  
2. Design a **retrieval eval**: Recall@k, MRR, nDCG.  
3. Pair with generation **faithfulness** metrics (citations required).  
4. Test **chunking** strategies (size/overlap) and show their impact on recall & latency.

### Path B — Tool calling
1. Define 2–3 tools (e.g., `create_payment_link`, `schedule_meeting`).  
2. Evaluate **function‑call validity** and **tool success rate** separately from end‑to‑end outcomes.  
3. Add **error‑handling tests** (tool timeout; tool returns `null`); design refusal or retry logic.

**Deliverables**
- `rag_results.md` or `tool_eval.md` with metrics and recommended settings.

---

## Exercise 11 — CI Wiring (smoke + regression)

**Objective:** Make your evaluation **continuous**.

**Setup:** Use whatever CI you have (GitHub Actions, GitLab CI, etc.).

**Steps**
1. Add a job that runs the **smoke set** on every PR; fail on **gates** or >X pp drop in quality.  
2. Add a **nightly** job that runs the **regression set**; publish a report artifact.  
3. Include **dataset and judge prompt versions** in the logs, so runs are reproducible.  
4. (If possible) Auto‑post the summary to the PR thread.

**Deliverables**
- `ci_config.yml` (or equivalent) and a **sample report artifact**.

**Quality check**
- Would a new teammate breaking JSON or compliance get blocked automatically?

---

## Exercise 12 — Reflection & Checklist

**Objective:** Ensure you internalize the chapter.

**Steps**
1. Write a half‑page reflection: **What surprised you? What broke first?**  
2. Answer these prompts:  
   - Where did **code gates** save you from “pretty but wrong”?  
   - Which **slice** was weakest and why?  
   - If you had 10% more budget, where would you spend it (data, prompt work, retrieval, model)?  
3. Paste the **one‑pager template** from Lesson 2.6 and fill it for your feature.

**Deliverables**
- `reflection.md` with the answers and your one‑pager.

---

## What “Good” Looks Like (grading rubric for yourself)

- **Clarity (0–3):** Prompts and metrics are unambiguous; others could run them.  
- **Coverage (0–3):** Datasets include key slices and failure modes.  
- **Trust (0–3):** Gates + judge + calibration + versioning documented.  
- **Decision‑readiness (0–3):** Thresholds, slice minima, and a ship/rollback plan exist.  
- **Ops (0–3):** Latency and cost budgets in place; CI wired.

Aim for **≥ 12/15** across these criteria before moving to Chapter 3.

---

### Appendix — Reusable Templates

**A) Judge prompt (skeleton)**  
```text
ROLE: You are a strict evaluator of assistant responses.
TASK: Apply the rubric and return JSON labels.

RUBRIC (0–3 each)
- Faithfulness: 0=no support; 1=partially; 2=mostly; 3=fully supported with citations.
- Completeness: 0=misses key asks; 3=addresses all parts.
- Compliance: 0=violation; 1=borderline; 2=ok; 3=fully compliant.
- Tone: 0=inappropriate; 3=respectful & firm.

OUTPUT JSON
{"grounding":0,"completeness":0,"compliance":0,"tone":0,"citations_valid":true,"format_valid":true,"notes":""}
Return only JSON. Temperature=0.
```

**B) Decision table (example)**  
| Condition | Action |
|---|---|
| Any **gate** fails | Block merge; bug ticket |
| Quality avg < 2.7 or min slice < 2.6 | Iterate prompt/retrieval; add failures to regression |
| Ops p95 > 3.5s or cost > $0.010 | Optimize; consider caching/model swap |
| All pass | Proceed to canary; enable online monitors |

---

*End of Lesson 2.8 — Exercises (LLMs, Prompts, and Evaluation Basics).*

