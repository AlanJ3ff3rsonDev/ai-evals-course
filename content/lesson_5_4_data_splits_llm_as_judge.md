# Lesson 5.4 — Data Splits for Designing and Validating LLM‑as‑Judge

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previously:**  
> • **5.1** defined *what* to measure (success criteria).  
> • **5.2** implemented *how* to measure with code metrics and an evaluation harness.  
> • **5.3** authored robust **LLM‑as‑judge** prompts and rubrics.  
> **This lesson (5.4):** We’ll design **data splits** that make your judges *trustworthy*—they generalize, resist bias, and don’t overfit to a handful of examples.  
> **Next (5.5):** We’ll refine judge prompts iteratively using these splits.

---

## Learning objectives

By the end you will be able to:

1. Build **purpose‑specific datasets** for judge *design, calibration, validation, testing,* and *monitoring*.
2. Create **leakage‑safe splits** (random, **stratified**, and **group‑aware**) so prompts don’t overfit.
3. Size splits with **power/uncertainty** in mind and attach **confidence intervals** to judge scores.
4. Validate judges by checking **agreement with humans**, **swap tests** (for pairwise), and **segment breakdowns**.
5. Implement a **reproducible splitting pipeline** you can rerun as data grows.

---

## 1) Why judge‑specific data splits?

An LLM judge is a *model* you are designing. Like any model, it can **overfit** to the examples you used to craft the rubric or prompt. If that happens, your evaluation becomes a mirror of your design set instead of a window into reality.

Good splits give you:  
- **Signal for editing the rubric** (design/calibration),  
- **Unbiased selection** among multiple judge prompts (validation),  
- **Final confidence** before adoption (test), and  
- **Ongoing drift detection** in production (monitoring).

Think of these as **roles**, not just percentages.

---

## 2) The five core datasets (roles)

### 2.1 Design (a.k.a. “prompt crafting” set)
- **Purpose:** Rapidly iterate on rubric wording, JSON schema, and output anchors.  
- **Content:** 50–150 diverse, *messy* real traces; include both good and bad outputs.  
- **Rule:** It’s OK to read and discuss these examples freely. **Never** report final metrics from here.

### 2.2 Calibration set (for thresholds & anchors)
- **Purpose:** Tune **cutoffs** (e.g., pass if faithfulness ≥ 4), set **weights**, and debug judge variance.  
- **Content:** 100–300 items with **gold answers** or **human labels**, balanced across categories (languages, topics, difficulty). Include **honeypots** (obvious pass/fail) to detect broken judges.  
- **Output:** A *calibration table* mapping raw judge scores to actionable decisions.

### 2.3 Validation set (holdout for prompt selection)
- **Purpose:** Choose among multiple candidate judge prompts.  
- **Rule:** Freeze it *before* you start comparing prompts. Never hand‑edit it mid‑contest.  
- **Decision:** Pick the prompt that best matches human labels (e.g., highest **Spearman/Pearson** correlation, accuracy vs. pass/fail gold, or highest pairwise win rate).

### 2.4 Test set (final check before adoption)
- **Purpose:** One‑time confirmation that your selected judge generalizes.  
- **Rule:** Use *once* per major judge revision. If you look repeatedly, it becomes validation.  
- **Size:** 200–500+ depending on variance and business risk.

### 2.5 Monitoring / Canary set (production sampling)
- **Purpose:** Track your adopted judge against **fresh traffic** to detect drift.  
- **Mechanics:** Sample N traces per day/week, label a subset with humans, compare with judge, and watch group‑wise trends.

> Optional but useful: **Regression suite (must‑pass assertions)** and **Adversarial set** (stress tests for verbosity bias, refusal quality, and tricky edge cases).

---

## 3) How to split safely (random, stratified, and group‑aware)

### 3.1 Start with a tidy record schema
Every item should include:  
`id, input, candidate_output, reference (optional), label (optional), category, difficulty, language, group_id (doc/thread/user/merchant), metadata`

### 3.2 Random is not enough
Random splits can leak information. For example, if multiple items come from the **same conversation thread** or **same document**, placing some in design and some in validation lets the judge “cheat” on style or content.

### 3.3 Group‑aware splitting (to stop leakage)
- Use `group_id` to keep all items from a **conversation**, **document**, **merchant**, or **case** together.  
- Assign **entire groups** to a split. This prevents the judge from seeing near‑duplicates across splits.

### 3.4 Stratification (to keep distributions similar)
- Stratify by stable attributes (**language, topic domain, difficulty, channel**).  
- Goal: each split mirrors overall proportions, so performance comparisons are fair.  
- If data is scarce, enforce **minimum per‑cell counts** (e.g., at least 20 Portuguese, 20 Spanish, etc., in validation).

### 3.5 Pairwise extras
If your judge does **A vs. B** comparisons:
- Duplicate each item with **swapped order** (A/B and B/A).  
- Ensure both copies land in the **same split** (group them by a shared `pair_id`).  
- Expect symmetry; big asymmetry = **position bias**.

---

## 4) How big should each split be? (practical rules)

Exact math depends on variance, but use these heuristics:

- **Design:** 50–150 items. You’ll read them a lot.  
- **Calibration:** ≥ 100 items *per key segment* you care about (e.g., BR/PT/ES, short vs. long).  
- **Validation:** 150–300 total is a good start for prompt selection.  
- **Test:** 200–500 for high‑stakes launches; more if variance is high.  
- **Monitoring:** e.g., 50–200 items/week; increase when you ship big changes.

For pass/fail metrics, the **Wilson interval** gives a sense of uncertainty. As a rough guide, with **n = 300**, the 95% CI half‑width for a rate near 0.5 is ≈ **±6%**. If you need tighter decisions, grow your set or aggregate over more weeks.

---

## 5) Validating your judge

You are testing the *judge itself*, not the model under test.

1. **Agreement with humans:** Compare judge scores to human labels on calibration/validation. Use correlation (Spearman for ranks), accuracy/F1 for pass/fail, and confusion matrices for where it disagrees.  
2. **Reliability over segments:** Check Portuguese vs. Spanish vs. English; short vs. long; domain slices. Large gaps → refine rubric or add segment‑specific thresholds.  
3. **Swap tests (pairwise):** A vs. B and B vs. A should give similar win rates.  
4. **Gold items:** Verify that honeypots consistently pass/fail.  
5. **Stress tests:** Probe verbosity bias; ensure safe refusals are rewarded; check hallucination traps for RAG.  
6. **Cost/latency:** Judges must be fast enough for your CI/CD loop (Chapter 9).

When you’re satisfied, **freeze** the judge prompt and version it (`judge_prompt_id`, `judge_model_id`, `dataset_version`).

---

## 6) A reproducible splitting pipeline (reference implementation)

Below is a pure‑Python, dependency‑free approach that produces **group‑aware, stratified** splits. It approximates iterative stratification: we fill each split by **largest‑need** first while keeping groups intact.

```python
from collections import defaultdict, Counter
import random

def stratified_group_split(records, *, 
                           group_key="group_id", 
                           strat_keys=("language","category"),
                           ratios=(0.5, 0.2, 0.2, 0.1), # design, calib, valid, test
                           seed=7):
    '''
    records: list[dict] with keys group_id and stratification keys.
    Returns: dict with split_name -> list[records]
    '''
    random.seed(seed)
    split_names = ["design","calib","valid","test"]
    assert abs(sum(ratios)-1.0) < 1e-6
    # 1) Group records
    groups = defaultdict(list)
    for r in records:
        groups[r[group_key]].append(r)

    # 2) Compute global target proportions for each (stratum) cell
    def stratum_key(r):
        return tuple(r.get(k, "NA") for k in strat_keys)
    global_counts = Counter(stratum_key(r) for r in records)
    targets = {name: {cell: ratios[i]*cnt for cell, cnt in global_counts.items()}
               for i, name in enumerate(split_names)}

    # 3) Greedy assignment by largest remaining need
    remaining = {name: targets[name].copy() for name in split_names}
    splits = {name: [] for name in split_names}

    # Shuffle groups for tie‑breaking
    group_items = list(groups.items())
    random.shuffle(group_items)

    for gid, items in group_items:
        # Compute this group's stratum footprint
        def stratum_key(r):
            return tuple(r.get(k, "NA") for k in strat_keys)
        footprint = Counter(stratum_key(r) for r in items)
        # Choose split that reduces largest deficit
        best_name, best_score = None, float("inf")
        for name in split_names:
            # Score is L1 distance after assignment; smaller is better
            score = 0.0
            for cell, c in footprint.items():
                score += max(0.0, remaining[name].get(cell, 0.0) - c)
            if score < best_score:
                best_name, best_score = name, score
        # Assign
        splits[best_name].extend(items)
        for cell, c in footprint.items():
            remaining[best_name][cell] = max(0.0, remaining[best_name].get(cell, 0.0) - c)

    return splits
```

**Usage tips**
- Pass `group_key="thread_id"` for multi‑turn conversations, `"doc_id"` for RAG, or `"merchant_id"` for collections.  
- Tune `ratios`. For pairwise tasks, set `group_key="pair_id"` to keep **A/B and B/A** together.  
- After splitting, compute per‑split distributions and verify they are close to overall.

### Pairwise swap duplication helper

```python
def make_pairwise_items(examples):
    '''
    Given items with fields 'A' and 'B', create two items with swapped order.
    Returns new list with pair_id tying the two versions together.
    '''
    out, pid = [], 0
    for ex in examples:
        pid += 1
        a = dict(ex)
        a["candidate_A"], a["candidate_B"] = ex["A"], ex["B"]
        a["pair_id"], a["order"] = pid, "AB"
        b = dict(ex)
        b["candidate_A"], b["candidate_B"] = ex["B"], ex["A"]
        b["pair_id"], b["order"] = pid, "BA"
        out.extend([a,b])
    return out
```

This small toolkit is enough to build robust splits you can reproduce with a fixed **seed** and a versioned **dataset snapshot**.

---

## 7) Worked example (collections / fintech)

**Goal:** Evaluate first‑message quality from a collections agent across BR and AR, WhatsApp and email.

1. **Label schema (from 5.1 & 5.3):** Safety (pass/fail), Faithfulness to CRM facts (1–5), Tone (1–5), Helpfulness (1–5).  
2. **Dataset:** 2,000 real traces labeled with country, channel, debtor segment, and a `thread_id`.  
3. **Splits:**  
   - *Design* 50% (readable)  
   - *Calibration* 20% (gold + honeypots)  
   - *Validation* 20% (judge selection)  
   - *Test* 10% (final)  
   Use `group_key="thread_id"` and stratify by `{country, channel}`.  
4. **Checks:**  
   - Validate judge vs. 300 human labels (Spearman ≥ 0.75 on faithfulness).  
   - Swap tests pass (A/B ≈ B/A within 2 p.p.).  
   - Segment gaps < 0.3 points; if larger, revise rubric.  
5. **Freeze** the winning judge prompt and store `judge_prompt_id=v3`, `judge_model_id=gpt‑X‑YYYYMM`.  
6. **Monitoring:** Sample 100 traces/week per country and alert if faithfulness CI‑lower < 4.2 or safety pass‑rate < 99.5%.

---

## 8) Checklist before you trust your splits

- [ ] **Group leakage** blocked (same thread/doc/user not spread across splits).  
- [ ] **Strata balanced** (language, domain, channel; check per‑split histograms).  
- [ ] **Gold items** present in calibration/validation.  
- [ ] **Swap tests** configured for pairwise.  
- [ ] **Seeds & versions** recorded: dataset snapshot, split seed, judge prompt ID, judge model ID.  
- [ ] **CIs** attached to metrics; MDE roughly sufficient for your decision.  
- [ ] **Monitoring plan** ready with sampling rules and alerts.

---

## Exercises

1. **Build your splits.** Take a sample of 1,000 traces from your pipeline. Add `thread_id`, `language`, `channel`, and `debtor_segment`. Use `stratified_group_split` to generate 50/20/20/10 splits. Show per‑split distributions.  
2. **Leakage hunt.** Write a quick script to check whether any `thread_id` appears in more than one split. Fix the split function if so.  
3. **Swap test.** Create 100 pairwise items with A/B and B/A variants. Confirm win‑rates are symmetric within 2–3 p.p.  
4. **Agreement check.** Label 200 items with two human raters and your judge. Report correlation and where disagreements concentrate (segment view).  
5. **Drift simulation.** Add a new message template to your model and re‑evaluate on the monitoring set. Do any segment CIs cross your alert thresholds?

---

## Summary

For LLM‑as‑judge to be credible, you must treat it like a *model under development*. That means **clear roles for datasets**, **group‑aware, stratified splits**, and **frozen holdouts** for selection and final checks. Validate agreement with humans, run **swap tests** for pairwise, and track **segment‑wise** performance with CIs. With trustworthy splits in place, you can iterate confidently in **5.5 — Iterative Prompt Refinement for the LLM‑as‑Judge**, knowing your improvements are real and not artifacts of leakage or overfitting.
