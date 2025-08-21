
# AI Evals for Engineers & PMs  
## Lesson 4.5 — Connecting Collaborative Labels to Automated Evaluators

> **Continuity recap:**  
> • **4.1** gave us a *benevolent dictator (BD)* model to keep labeling decisive.  
> • **4.2** installed a *collaborative annotation workflow* with states, merges, QA, and CI.  
> • **4.3** taught *IAA* so we can quantify rater reliability.  
> • **4.4** covered *alignment sessions* to convert disagreements into crisp rules and ADRs.  
> **This class** turns those **human labels and rules** into **automated evaluators**—so your pipeline scales from dozens of items/day to thousands, without losing the judgment encoded by your team.

---

## Learning objectives
By the end you will be able to:
1. Translate **human rubric + ADRs** into **machine‑checkable evaluators** (LLM‑as‑judge, heuristics, and hybrid).  
2. Design a **data flow** that keeps *gold labels*, *judge outputs*, and *metrics* versioned and comparable.  
3. Calibrate and monitor judges using **agreement with gold**, **calibration curves**, and **drift alarms**.  
4. Convert evaluator outputs into **gates** and **CI checks** that protect production.  
5. Produce the artifacts you need: **Judge Prompt spec**, **JSON schema**, **Evaluation DAG**, and **Judge Health dashboard**.

---

## 1) What exactly are “automated evaluators”?

An **automated evaluator** is any program that takes an **input + model trace** and returns **scores/labels** according to your rubric—without a human in the loop.

Three practical types (often combined):

1) **Programmatic / Heuristic checks** — deterministic rules: JSON validity, token limits, profanity, format, citation presence, etc.  
2) **Retrieval checks** — verify that cited or relevant documents exist in the **top‑k**; compute recall/precision over chunks.  
3) **LLM‑as‑Judge** — a model applies your rubric to the trace and emits scores/labels (with evidence).

> **Rule of thumb:** push everything **objective and structural** into programmatic checks; use **LLM‑as‑Judge** for the **semantic** parts you codified through ADRs.

---

## 2) From rubric to evaluator: a mapping recipe

Start from the **Codebook** (decision rules) and **ADRs** (precedents). For each rubric dimension or failure mode:

1. **Define observable signals**  
   - *Evidence spans*, *doc IDs*, *tool logs*, *citations*, *JSON fields*, *regex patterns*.  
2. **Choose evaluator type**  
   - If it’s deterministic (e.g., “Must include a CTA button”), **programmatic**.  
   - If it depends on retrieved evidence being present, **retrieval metric**.  
   - If it’s semantic or stylistic (e.g., *unsupported claim*, *tone*), **LLM‑as‑Judge**.  
3. **Specify outputs**  
   - **Labels**: mode IDs (`GEN.UNSUPPORTED_CLAIM`), **severity**, **phase**.  
   - **Scores**: 1–5 or 0–1 (define thresholds).  
   - **Gates**: boolean pass/fail per rule.  
4. **Write examples** (positive, negative, counter‑examples) from ADRs.  
5. **Version everything** (`rubric_version`, `taxonomy_version`, `prompt_hash`, `evaluator_version`).

> Treat evaluators as **first‑class models**: they have prompts, versions, and health metrics.

---

## 3) Data flow & objects (drop‑in)

**Inputs to an evaluator**  
- `task`: input text, retrieved docs (IDs + chunks), tool logs.  
- `model_output`: what the product model produced.  
- `context`: rubric/taxonomy versions, language/slice, risk flags.  
- *(Optional)* `gold`: human labels for a calibration subset.

**Evaluator output (JSON)**  
```json
{
  "task_id": "t_001293",
  "evaluator_id": "judge_v4",
  "rubric_version": "rub_v1.8",
  "taxonomy_version": "tax_v1.4",
  "labels": [
    {"mode_id":"GEN.UNSUPPORTED_CLAIM","severity":"major","evidence":"...span...","confidence":0.78}
  ],
  "scores": {"faithfulness": 0.4, "completeness": 0.8, "tone": 0.9},
  "gates": {"json_valid": true, "citations_present": false},
  "explanations": {"faithfulness":"Claimed amount not in docs top-5."},
  "prompt_hash": "6a1d…",
  "timestamp": "2025-08-09T12:10:00Z"
}
```

Store to **Parquet** for speed; keep raw JSON for auditability.

---

## 4) LLM‑as‑Judge prompt spec (copy/paste)

**System intent** (keep short, operational):
```
You evaluate assistant outputs using a strict, versioned rubric.
Always cite evidence spans or document IDs that support your decision.
Respond ONLY in the JSON schema provided. Do not add extra fields.
```

**User content (template)**:
```
RUBRIC_VERSION: rub_v1.8
TAXONOMY_VERSION: tax_v1.4
SLICE: pt / whatsapp

TASK:
<user_input>

MODEL_OUTPUT:
<assistant_output>

RETRIEVED_DOCS (top-k with ids):
- d17: <chunk text>
- d28: <chunk text>
- d31: <chunk text>

TOOL_LOGS (if any):
- call_id=tool_07, name=check_balance, result=...

EVALUATION GOALS:
1) Identify failure modes from the taxonomy.
2) Score Faithfulness (0–1), Completeness (0–1), Tone (0–1).
3) Set gates for json_valid, citations_present, pii_blocked.

DECISION RULES (extracts):
- Rule 3.2: If a numeric amount is stated without a supporting doc in top‑k, label RET.GOLD_NOT_IN_TOPK (primary) and GEN.UNSUPPORTED_CLAIM (secondary).
- Rule 3.3: If a stated numeric value conflicts with a retrieved doc's value, label GEN.CONTRADICTS_SOURCE.
- Severity: major if the error affects money, safety, or legal compliance; else minor.

Return JSON ONLY.
```

**JSON schema** (validate on receipt):
```json
{
  "type":"object",
  "properties":{
    "labels":{"type":"array","items":{
      "type":"object",
      "properties":{
        "mode_id":{"type":"string"},
        "severity":{"type":"string","enum":["minor","major","critical"]},
        "evidence":{"type":"string"},
        "confidence":{"type":"number","minimum":0,"maximum":1}
      },
      "required":["mode_id","severity","evidence"]
    }},
    "scores":{"type":"object"},
    "gates":{"type":"object"}
  },
  "required":["labels","scores","gates"]
}
```

**Important**: the judge must **quote evidence** or specify **doc IDs**. Re‑prompt if evidence is missing.

---

## 5) Calibrating the judge: agreement & bias

To trust automation, we must quantify how close the judge is to **gold human labels**.

1. **Agreement with gold**  
   - Compute **mode‑wise agreement** (per failure mode).  
   - Use **Cohen’s κ** (single judge vs gold) or **Matthews Corr.** for binary gates.  
   - Track **precision/recall** for each mode (judge as classifier vs gold).

2. **Calibration curves for scores**  
   - Bin predicted scores (e.g., faithfulness) and plot **mean gold outcome** per bin.  
   - Target: monotonic, low error; if off, adjust **thresholds** (e.g., pass if faithfulness ≥ 0.8).

3. **Confidence sanity**  
   - Is higher **confidence** associated with higher **agreement**? If not, hide confidence or retrain.

4. **Slice analysis**  
   - Agreement by **language**, **channel**, **persona**, **risk level** to detect bias.

> **Guardrail:** If judge‑vs‑gold agreement falls below **0.8** on a critical mode, the gate should **de‑activate** and fall back to human review.

---

## 6) Drift & change management

- **Version every evaluator**: `evaluator_id=judge_v4`, `prompt_hash`, `model_id`.  
- **Canary tests**: Before swapping versions, run on **last 2 weeks of gold**; compare agreement & slice bias.  
- **Shadow mode**: Run the new judge in parallel for a week; if stable, flip.  
- **ADR hooks**: A new ADR that changes a rule requires a **prompt update** + **evaluator_version bump**.  
- **Drift alarms**: Fire when judge‑vs‑gold agreement drops > **10pp** or when **disagreement aging** rises.

---

## 7) Hybrid evaluators (best of both)

Combine deterministic checks with judge outputs:

- **Gate chain**: `json_valid → pii_blocked → citation_present → judge.faithfulness ≥ 0.8`.  
- **Cause + Symptom**: Retrieval checker tags `RET.GOLD_NOT_IN_TOPK`, judge adds `GEN.UNSUPPORTED_CLAIM`.  
- **Auto‑adjudication**: If judge disagrees with **both** human raters → send to BD with **priority**.

This mirrors how humans reasoned in ADRs and improves data quality.

---

## 8) CI integration (make it bite)

**Nightly CI job**
1. Run evaluators on latest **offline bench** (smoke + regression + random).  
2. Aggregate metrics by **mode × slice**.  
3. Apply **gates** (min slice success, no critical regressions).  
4. Fail the build with a **readable diff** (top failing modes, example traces).  
5. Post a **Slack digest** with links to ADRs and judge health dashboard.

**Pre‑merge guard** (for prompt changes)  
- On PRs that modify prompts or tools, run **targeted evaluators** + **smoke tests**; block if gates fail.

---

## 9) Judge Health Dashboard (minimum viable)

**Tiles to track**
- **Agreement with gold**: overall & by mode (last 7/30 days).  
- **Precision/Recall** per mode.  
- **Score calibration**: faithfulness reliability curve.  
- **Slice bias**: agreement by language, channel, persona.  
- **Drift**: week‑over‑week change; significant drops flagged.  
- **Volume**: items judged/day; % routed to human review.

Use the same Parquet store as labels; rebuild nightly.

---

## 10) Running example — **CollectAI**

**Goal**: Automate checks for **amount correctness** and **polite tone** in PT/ES WhatsApp.  
**Setup**:  
- Programmatic gates: JSON validity, presence of `cta_button`, and newline‑bounded money regex.  
- Retrieval checker: Verify that the **exact amount** is in the top‑k doc text (strip punctuation and thousand separators).  
- Judge (`judge_v4`): applies **Rule 3.2** from ADRs; emits `RET.GOLD_NOT_IN_TOPK` and/or `GEN.UNSUPPORTED_CLAIM` with evidence; scores `faithfulness`, `tone`.

**Calibration** (on 1,000 gold items):  
- Agreement (binary pass/fail): **0.92**; precision **0.88**, recall **0.94** for amount errors.  
- Tone threshold fixed at **≥ 0.75** to reduce false blocks; human review for **0.6–0.75**.  
- Slice check: PT slightly higher agreement than ES (0.94 vs 0.90) → added Spanish examples to the prompt.

**CI gates**:  
- Block merge if **faithfulness pass rate** drops > **3pp** on `pt/whatsapp`.  
- Always block on **critical**: PII leak or unauthorized discount.  
- Post 5 failing examples with evidence spans for engineers to fix promptly.

**Outcome**: Time to evaluate a new prompt variant fell from ~2 hours (manual) to **<10 minutes** (automated), with no increase in post‑deploy incidents.

---

## 11) Anti‑patterns & fixes

- **Judge with no evidence** → Require spans/IDs; reject outputs without evidence.  
- **“One judge to rule them all”** → Use **separate prompts** per domain (retrieval, safety, tone).  
- **Comparability drift** → Change prompt AND thresholds in the same week; avoid. Version & change **one variable at a time**.  
- **Silent threshold tweaks** → All thresholds live in `evaluator_config.yml`; PRs must show diffs.  
- **Unbounded costs** → Cache doc renders; batch judge calls; run only on changed slices when possible.  
- **Gold starvation** → If you stop double‑labeling, you cannot measure judge health. Keep a **calibration stream** (see 4.2).

---

## 12) Micro‑exercises (60–90 minutes)

1. **Prompt skeleton** — Draft a judge prompt for your highest‑impact failure family. Include 3 examples from ADRs and a strict JSON schema.  
2. **Agreement check** — Compute judge‑vs‑gold precision/recall for that mode on 200 items; plot agreement by slice.  
3. **Calibration curve** — For a numeric score (faithfulness), bin predictions and compute observed pass rate per bin; pick a threshold.  
4. **CI gate** — Add a simple YAML‑driven gate to fail your nightly run when the new threshold is breached on any top slice.

Deliverables: `judge_prompt.md`, `judge_eval.ipynb`, `evaluator_config.yml`, dashboard screenshot.

---

## 13) Checklist — connecting labels to automation
- [ ] Rubric & ADRs mapped to evaluator types (programmatic, retrieval, judge).  
- [ ] Strict **JSON schema** with evidence spans/IDs.  
- [ ] **Agreement** and **bias** metrics computed weekly vs gold.  
- [ ] **Thresholds** chosen from calibration curves; stored in config.  
- [ ] **Versioning**: evaluator_id, prompt_hash, model_id, rubric/taxonomy versions.  
- [ ] **CI gates** with readable diffs and example traces.  
- [ ] **Dashboard** for judge health & drift.  
- [ ] **Shadow + canary** before replacing evaluator versions.  
- [ ] Ongoing **gold stream** to keep the judge honest.

---

### Closing
Collaborative labels **encode your team’s judgment**. Automated evaluators let that judgment scale—*without* giving up rigor. Treat judges like any model: version them, test them against gold, monitor drift, and wire their outputs into CI. This is how you move from *manual, artisanal evals* to a **self‑healing evaluation system** that protects the product as it evolves.

**Next (4.6):** We’ll catalog the **common pitfalls** teams hit when automating evaluators—and how to avoid them.
