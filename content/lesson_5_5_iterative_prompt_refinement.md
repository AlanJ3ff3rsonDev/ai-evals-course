# Lesson 5.5 — Iterative Prompt Refinement for the LLM-as-Judge

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previously:**  
> • **5.1** defined *what* to measure.  
> • **5.2** implemented *how* to measure with code metrics and a harness.  
> • **5.3** wrote robust LLM-as-judge prompts and JSON outputs.  
> • **5.4** created leakage-safe **data splits** for designing and validating judges.  
> **This lesson (5.5):** We will **iterate** on judge prompts methodically—turning noisy rubrics into reliable, business-ready evaluators without overfitting.

---

## Learning objectives

By the end of this lesson, you will be able to:
1. Run a **tight improvement loop** for judge prompts using design/calibration/validation/test splits.  
2. Translate disagreements with humans into **actionable edits** to rubrics and output schemas.  
3. Use **pairwise tests**, **swap tests**, and **CIs** to decide whether a new judge is better (not just different).  
4. Apply **bias probes** (verbosity, position, style) during refinement.  
5. Document versions and set **stopping rules** so iteration remains scientific.

---

## 1) The mindset: your judge is a model

Treat the judge like any other model under development. That means:
- **Hypothesize → change → measure → decide**, not “tweak until scores look good.”  
- Every change should map to a **named hypothesis** (e.g., “add a conciseness anchor to reduce verbosity bias”).  
- **Version everything**: prompt text, rubric wording, JSON schema, sampling temperature/params, and the judge model ID.

You will make faster progress with **small, surgical edits**, measured on frozen datasets, than with wholesale rewrites.

---

## 2) The iterative loop (end-to-end)

**Step 0 — Starting point**  
Take your **v1 judge** from 5.3, splits from 5.4, and calibration thresholds.

**Step 1 — Collect signals**  
Run the v1 judge on:  
- The **calibration set** (with human/gold labels)  
- The **validation set** (for model selection)  
Compute: correlation with humans, accuracy/F1 for pass/fail, per-criterion gaps, segment breakdowns. Save per-item diagnostics.

**Step 2 — Diagnose failure themes**  
Use your **Chapter 3 taxonomy** to tag disagreements. Typical themes:  
- Rewards long answers → **verbosity bias**  
- Penalizes safe refusals → **refusal handling** weak  
- Treats unsupported claims leniently → **faithfulness anchor** weak  
- Over-penalizes minor grammar in Spanish → **language bias**  
- JSON outputs sometimes malformed → **schema instructions** unclear

**Step 3 — Propose minimal prompt edits**  
For each theme, write a **one-line hypothesis** and a **small edit**. Examples:
- Add an explicit **conciseness criterion with anchors** and cap words considered.  
- Add a **positive refusal anchor**: “If the candidate safely refuses a disallowed request and offers alternatives, reward it.”  
- Add a **groundedness rule**: “Claims must be traceable to evidence IDs; unsupported claims lower the score.”  
- Strengthen **JSON schema instruction** with an example and a failure penalty.  
- Add **negative examples**: show 1–2 bad answers and why they score low (keep examples generic to avoid leakage).

**Step 4 — Generate 2–5 prompt variants**  
Change *one* dimension per variant if possible. Label variants `v2a`, `v2b`, … Avoid exploding the search space.

**Step 5 — Evaluate variants on validation**  
- For **absolute scoring** tasks (Likert/Checklist): compare correlation/accuracy vs. human labels with **bootstrap CIs**.  
- For **preference** tasks: run **pairwise** A/B judgments on the same inputs; compute win rate with **Wilson CIs**.  
- Always run **swap tests** when pairwise (A/B vs B/A).  
- Track **segment gaps** (e.g., PT vs ES, WhatsApp vs Email).

**Step 6 — Decide & record**  
Adopt the variant only if it **beats v1** by a **pre-registered criterion** (e.g., Spearman +0.05 with CI separation; or win-rate CI-lower ≥ 55%). Record: prompt text, model/version, metrics, CI, date, and rationale.

**Step 7 — Test & freeze**  
Run the winner on the **test set** once. If it clears thresholds, freeze as `judge_prompt_id = v2` and move to monitoring.

**Step 8 — Monitor & revisit**  
In production, sample fresh traces weekly. If drift or bias appears, return to Step 2 with targeted edits.

This loop is deliberately boring—that’s how you keep the evaluation credible.

---

## 3) Editing rubrics: patterns that work

### 3.1 Anchors (good/bad, short but concrete)
Write **1–2 line anchors** for low/mid/high for each criterion. Example (Faithfulness 1–5):
- **1**: Contradicts evidence or fabricates material information.  
- **3**: Mostly grounded; minor unsupported claims that do not change the main meaning.  
- **5**: Every claim traceable to evidence IDs; no speculation; quotes key phrases precisely when necessary.

### 3.2 Checklists for must-pass rules
Some properties are binary. Use **checklists** and compute overall pass as the conjunction of items.  
- No PII beyond what the user provided.  
- No unauthorized financial advice or settlement offers.  
- JSON schema valid (keys/types/ranges).

### 3.3 Negative instructions
Be explicit about what **not** to reward (“Do NOT give extra points for length or poetic language”).

### 3.4 Style guidance without favoritism
Reward **clarity** and **professional tone**, not a specific dialect. Provide bilingual anchors if you serve multiple languages.

### 3.5 Few-shot examples (use sparingly)
One or two **mini exemplars** can stabilize judgments—just ensure they’re **generic** and not near-duplicates of items in your validation/test sets to avoid leakage.

---

## 4) Bias probes during refinement

Always probe for known biases while iterating. Keep a small **adversarial set** you run every time.

- **Verbosity probe:** For each item, create a short and a long paraphrase with identical facts. The judge should not systematically prefer long.  
- **Position probe (pairwise):** Ensure A/B and B/A give symmetric results (≤2–3 p.p. difference).  
- **Style probe:** Neutral vs. flowery rewrite; judge should prefer clarity when rubric says so.  
- **Refusal probe:** Disallowed request with a good refusal; judge should *reward* safe alternatives.  
- **Language probe:** Equivalent outputs in PT and ES—scores should be comparable when content quality matches.

If a probe fails, edit the rubric and try again.

---

## 5) Practical safeguards (so you don’t overfit)

- **Fix your acceptance rules in advance.** “Adopt a variant if Spearman improves by ≥ 0.05 and CI does not overlap” or “Win-rate CI-lower ≥ 55%.”  
- **Limit rounds per week** (e.g., max 2) and **archive** variants after each round.  
- **Never touch the test set** until you have a single candidate.  
- **Rotate human raters** on calibration to avoid overfitting to one annotator’s style.  
- **Document every change** in a short changelog entry (what hypothesis, what edit, outcomes).

---

## 6) A tiny experiment harness for prompt iteration

You can drop this into your 5.2 harness. It runs multiple judge prompt variants on the **validation** split, computes correlations vs. human labels, and returns a ranked table with bootstrap CIs. Replace `call_model` with your API.

```python
import json, random, statistics, math
from collections import defaultdict
from typing import List, Dict
import numpy as np

def bootstrap_ci(vals, iters=1000, alpha=0.05, agg=np.mean):
    if not vals:
        return (0.0, 0.0)
    n = len(vals); idx = np.arange(n)
    samples = [agg(np.array(vals)[np.random.choice(idx, n, replace=True)]) for _ in range(iters)]
    lo, hi = np.percentile(samples, [100*alpha/2, 100*(1-alpha/2)])
    return float(lo), float(hi)

def spearman(x, y):
    # Simple Spearman implementation
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0]*len(v)
        for k, i in enumerate(order):
            r[i] = k+1
        return r
    rx, ry = rank(x), rank(y)
    mx, my = np.mean(rx), np.mean(ry)
    num = sum((a-mx)*(b-my) for a,b in zip(rx,ry))
    den = math.sqrt(sum((a-mx)**2 for a in rx)*sum((b-my)**2 for b in ry))
    return num/den if den else 0.0

def run_judge(model, prompt_text, items):
    # Return list of numeric scores for one criterion from judge outputs.
    scores = []
    for it in items:
        raw = call_model(model=model, prompt=prompt_text.format(**it), temperature=0)  # plug your API
        obj = parse_json(raw)  # reuse parser from 5.3
        scores.append(obj['scores']['faithfulness'])  # or the criterion you target
    return scores

def compare_variants(variants, items, human_scores, model='gpt-judge'):
    '''
    variants: dict{name -> prompt_text}
    items: validation records with fields used to fill the prompt template
    human_scores: list[float] gold human labels aligned with items
    '''
    table = []
    idx = list(range(len(items)))
    for name, prompt in variants.items():
        s = run_judge(model, prompt, items)
        rho = spearman(s, human_scores)
        boots = []
        for _ in range(500):
            sel = np.random.choice(idx, len(idx), replace=True)
            bs = [s[i] for i in sel]
            bh = [human_scores[i] for i in sel]
            boots.append(spearman(bs, bh))
        lo, hi = np.percentile(boots, [2.5, 97.5])
        table.append({'variant': name, 'spearman': rho, 'ci': [float(lo), float(hi)]})
    table.sort(key=lambda r: r['spearman'], reverse=True)
    return table
```

**Usage sketch**
1. Prepare 200–300 validation items with human scores for `faithfulness`.  
2. Create 3–4 prompt variants (small edits).  
3. Run `compare_variants`; adopt a winner only if CI separation meets your rule.  
4. Confirm on the test set once; then freeze and deploy.

---

## 7) Worked example (collections domain)

**Context:** Your collections agent must send the *first message* to a debtor. The judge evaluates **Safety (pass/fail)**, **Faithfulness to CRM facts (1–5)**, **Helpfulness (1–5)**, **Tone (1–5)**.

**Observation:** On validation, v1 judge shows **verbosity bias** (long messages score ~+0.4). Also, it penalizes **polite refusals** too harshly when the model refuses to negotiate discounts out of policy.

**Edits (v2a and v2b):**
- **v2a (conciseness anchor):** Add criterion *Conciseness (1–5)* and the note “Do not reward length. Prefer concise messages that cover essentials.” Cap words considered to 120.  
- **v2b (refusal anchor):** Add checklist: “If negotiation is out of policy and the candidate refuses *politely* and offers the next step (e.g., schedule a visit), mark **pass**.”

**Results:**  
- v2a Spearman with human helpfulness improves from 0.62 → 0.71 (CI: +0.05 to +0.13).  
- v2b reduces false negatives on refusal items from 22% → 6% on calibration; overall pass-rate aligns with humans within 1.5 p.p.  
- Pairwise swap tests within 1.8 p.p. symmetry. Segment gaps (PT vs ES) shrink by 0.2 points.

**Decision:** Adopt **v2b** merged with **v2a** (single combined rubric) → run once on test; freeze as `judge_prompt_id=v2`.

---

## 8) Checklist before shipping a refined judge

- [ ] Change is tied to a **named hypothesis** and a **small prompt edit**.  
- [ ] **Variants** limited (≤5) per round; acceptance rule pre-registered.  
- [ ] Evaluated on **validation** with **CIs** and **segment breakdowns**.  
- [ ] **Bias probes** ran; swap tests passed (pairwise).  
- [ ] **Test set** run exactly once before adoption.  
- [ ] Prompt text, model ID, parameters, and results **versioned** and documented.  
- [ ] Monitoring plan updated with new thresholds if anchors changed.

---

## Exercises

1. **From disagreement to edit.** Pick 30 items where judge and human disagree. For each, tag the failure mode and propose a **one-line edit** to the rubric. Implement two variants.  
2. **Bias probe pack.** Build five minimal pairs for verbosity, position, style, refusal, and language. Run them with each variant; document any bias and the edit that fixes it.  
3. **Adopt-or-reject.** Define your acceptance rule (e.g., “improve Spearman by ≥ 0.05; CI-lower above baseline”). Run one iteration and decide.  
4. **Changelog writing.** Draft a concise changelog entry for your chosen variant with hypothesis, edit diff, metrics, and final decision.  
5. **Stretch:** Implement a **Bradley–Terry** aggregation for pairwise judgments to estimate a latent quality score for each prompt variant and compare with simple win-rate.

---

## Summary

Prompt refinement for LLM-as-judge is an **engineering loop**, not an art project. Start with concrete **disagreements**, make **small edits** tied to explicit hypotheses, and select winners with **frozen holdouts** and **confidence intervals**. Probe for known **biases**, confirm on a **test set**, and **version** everything. With this discipline, your judge becomes stable enough to support reliable release decisions—setting the stage for **5.6: Estimating True Success Rates with Imperfect Judges**.
