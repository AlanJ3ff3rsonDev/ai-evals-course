# Lesson 5.2 — Implementing Metrics (How to Measure)

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previous lesson (5.1):** We defined **what** to measure (success criteria, label schemas, target behaviors, and business KPIs).  
> **This lesson (5.2):** We implement **how** to measure those targets in code or with calibrated judges.  
> **Next (5.3):** We’ll write robust LLM-as-judge prompts.

---

## Learning objectives

By the end of this lesson you will be able to:

1. Translate qualitative success definitions into **metric functions** you can run repeatedly.
2. Implement **deterministic, code-based metrics** (exact match, numeric tolerance, classification, ranking/IR, string similarity, structured-output checks, constraint checks).
3. Plan and run **judge-based metrics** (human/LLM judges) with clear rubrics and aggregation—while avoiding leakage into 5.3.
4. Quantify uncertainty with **confidence intervals** and **sample-size** reasoning.
5. Assemble a small, reusable **evaluation harness** you can plug into any LLM pipeline.
6. Recognize common pitfalls (gaming the metric, noisy labels, distribution shift) and design defenses.

---

## 1) The mental model: a metric is just a function

A metric is a pure function that maps **(input, output, optional context, reference label)** to a **score** (or a dict of scores). The key property is **repeatability**: given the same arguments, it returns the same number without manual judgment.

Formally:

```
score = metric(example) 
# where example = {id, input, output, reference, metadata}
```

A good metric has three traits:

- **Validity**: “Does it measure what we care about?” (alignment with your 5.1 success definitions and business impact)
- **Reliability**: “Is it stable across samples, raters, and time?” (low variance, robust to noise)
- **Actionability**: “Does it tell us *where* we are wrong and how to improve?” (trace-level signals, per-category breakdowns)

Keep these three words taped to your monitor. When in doubt, choose metrics that are **valid for your task**, **reliable enough** to trust, and **actionable** for iteration.

---

## 2) Step-by-step: from success definition to runnable metric

### Step A — Specify the evaluation record schema

Use a simple, flat JSONL/CSV schema so every metric can read the same record shape.

- `id`: unique identifier  
- `input`: the user prompt or task context  
- `output`: the system’s answer  
- `reference`: a ground-truth label or expected behavior (may be `None`)  
- `metadata`: task-specific fields (e.g., numeric tolerance, category, difficulty)  

### Step B — Choose metric families appropriate to the task

Below are the most common families. You’ll rarely use just one—**compose** them to see different angles of quality.

#### 2.1 Exact/Set/Subset Match
Great for **closed-form tasks** (e.g., classification labels, canonical answers).  
- **Exact match (EM)**: 1 if strings are identical after normalization; else 0.  
- **Set/Subset**: for multi-label classification, measure whether predicted set equals/is subset of reference set.

Use when the answer space is small and unambiguous. Don’t use EM to judge long-form generation.

#### 2.2 Numeric metrics with tolerance
For arithmetic or extraction tasks that produce numbers. 
- Compare `|pred - ref|` ≤ absolute or relative tolerance.
- Aggregate with MAE/MAPE/RMSE as needed.

Store tolerance in `metadata` so some items can be stricter than others.

#### 2.3 Classification metrics
When you predict from a finite label set:
- **Accuracy** (overall correctness)
- **Precision/Recall/F1** (per class and macro/micro averaging)
- **Confusion matrix** for error patterns
- **AUROC/AUPRC** if you output calibrated probabilities

This is reliable, interpretable, and fast. It’s the backbone of many eval suites.

#### 2.4 Ranking & Information Retrieval (IR) metrics
For tasks that return an **ordered list** (e.g., retrieval or tool selection):
- **Precision@k, Recall@k**
- **Mean Average Precision (mAP)**
- **nDCG** (emphasizes early, highly relevant items)

Even if your product is not “RAG,” ranking metrics are invaluable whenever the model presents **choices** in order.

#### 2.5 String-similarity metrics (use carefully)
- **Edit distance** (Levenshtein): small changes in wording penalized proportionally.
- **ROUGE/BLEU/chrF**: n-gram overlap—useful for short summaries but **do not** over-interpret for long, creative text.
- **BERTScore** (semantic similarity with embeddings) gives better signal on paraphrases but can still be gamed.

Treat these as **weak signals**, not ground truth.

#### 2.6 Structured-output & tool-calling checks
For JSON, function-calling, or API tool use:
- **Schema validation** (keys required, types, ranges)
- **Business constraints** (e.g., price ≥ 0, currency ∈ {BRL, ARS, MXN})
- **Cross-field consistency** (e.g., `sum(line_items) == total`)
- **Safety constraints** (e.g., no PII fields populated in restricted contexts)

These are high-value metrics because they prevent downstream system crashes.

#### 2.7 Constraint & cost/latency metrics
Measure **non-quality** aspects that still matter in production:
- **Latency** (p50/p95)
- **Token/cost usage** per trace
- **Length constraints** (e.g., answer ≤ N tokens)
- **Guardrail hits** (did the output trip a safety rule?)

They ensure your solution is **usable** in real-world budgets and SLAs.

#### 2.8 Judge-based metrics (overview only; we’ll deep-dive in 5.3)
Some qualities are inherently subjective (helpfulness, tone, reasoning clarity). Implement with:
- **Rubric scoring** (e.g., 1–5 on “factual correctness”)
- **Pairwise preference** (A vs. B)
- **Pass/Fail checklists** (meets all criteria → 1, else 0)

In 5.3 we’ll craft prompts and aggregation protocols for LLM-as-judge; here you just **design the metric shape** and storage format.

---

## 3) Quantifying uncertainty: CIs and sample size

A single average can mislead. Always attach **uncertainty**:

- **Bootstrap CI**: resample with replacement across examples, recompute metric, and take percentiles (e.g., 2.5–97.5%).  
- **Wilson interval** for proportions (e.g., exact match rate).  
- **Minimum Detectable Effect (MDE)**: given baseline metric `p`, desired delta `δ`, and confidence (e.g., 95%), you can approximate how many examples you need. When in doubt, **add more data or reduce variance** (stratify by category and compute group-wise CIs).

These give stakeholders a feel for **how confident** you are that a change is real.

---

## 4) A tiny evaluation harness (reference implementation)

Below is a minimal, dependency-free harness. You can paste it into `eval_5_2.py` and run on a JSONL dataset. It supports: exact match, numeric tolerance, classification (accuracy/F1), retrieval precision@k, edit distance, and simple JSON schema checks.

> **Tip:** Keep each **metric** as a small, pure function. Then combine them in an `Evaluator` that iterates over records and aggregates numbers and per-example diagnostics.

```python
import json, math, statistics
from collections import Counter, defaultdict
from typing import List, Dict, Any, Tuple

# ---------- Utilities ----------

def normalize_text(s: str) -> str:
    return " ".join(s.strip().lower().split())

def safe_float(x):
    try:
        return float(x)
    except Exception:
        return None

# ---------- Metric functions ----------

def exact_match(pred: str, ref: str) -> int:
    return 1 if normalize_text(pred) == normalize_text(ref) else 0

def numeric_close(pred: str, ref: str, abs_tol: float = None, rel_tol: float = None) -> int:
    p, r = safe_float(pred), safe_float(ref)
    if p is None or r is None:
        return 0
    if abs_tol is not None and abs(p - r) <= abs_tol:
        return 1
    if rel_tol is not None and abs(p - r) <= rel_tol * max(1.0, abs(r)):
        return 1
    return 0

def edit_distance(a: str, b: str) -> int:
    # Classic DP Levenshtein distance
    a, b = a or "", b or ""
    dp = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, dp[0] = dp[0], i
        for j, cb in enumerate(b, 1):
            dp[j], prev = min(
                dp[j] + 1,      # deletion
                dp[j-1] + 1,    # insertion
                prev + (ca != cb) # substitution
            ), dp[j]
    return dp[-1]

def accuracy(y_true: List[str], y_pred: List[str]) -> float:
    z = [1 if normalize_text(p) == normalize_text(t) else 0 for p, t in zip(y_pred, y_true)]
    return sum(z) / len(z) if z else 0.0

def f1_macro(y_true: List[str], y_pred: List[str]) -> float:
    classes = sorted(set(map(normalize_text, y_true)) | set(map(normalize_text, y_pred)))
    f1s = []
    for c in classes:
        tp = sum(1 for p, t in zip(y_pred, y_true) if normalize_text(p)==c and normalize_text(t)==c)
        fp = sum(1 for p, t in zip(y_pred, y_true) if normalize_text(p)==c and normalize_text(t)!=c)
        fn = sum(1 for p, t in zip(y_pred, y_true) if normalize_text(p)!=c and normalize_text(t)==c)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec  = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2*prec*rec/(prec+rec) if (prec+rec) else 0.0
        f1s.append(f1)
    return sum(f1s)/len(f1s) if f1s else 0.0

def precision_at_k(pred_ids: List[Any], gold_ids: List[Any], k: int) -> float:
    pred_topk = pred_ids[:k]
    hit = sum(1 for x in pred_topk if x in gold_ids)
    return hit / max(1, len(pred_topk))

def json_schema_ok(obj: Dict[str, Any], required: Dict[str, type]) -> int:
    for key, t in required.items():
        if key not in obj: 
            return 0
        if not isinstance(obj[key], t):
            return 0
    return 1

# ---------- Aggregation helpers ----------

def bootstrap_ci(values: List[float], iters=1000, alpha=0.05) -> Tuple[float,float]:
    if not values:
        return (0.0, 0.0)
    import random
    N = len(values)
    samples = []
    for _ in range(iters):
        s = [values[random.randrange(N)] for __ in range(N)]
        samples.append(sum(s)/len(s))
    lo = sorted(samples)[int((alpha/2)*iters)]
    hi = sorted(samples)[int((1-alpha/2)*iters)]
    return (lo, hi)

# ---------- End-to-end evaluator ----------

class Evaluator:
    def __init__(self, records: List[Dict[str, Any]]):
        self.records = records

    def run(self) -> Dict[str, Any]:
        # Example metrics; adapt per task
        em_values, num_values, ed_values = [], [], []
        cls_true, cls_pred = [], []
        retr_p5_values = []
        json_ok_values = []

        for r in self.records:
            pred = str(r.get("output", ""))
            ref  = r.get("reference")

            # Exact match
            if isinstance(ref, str):
                em_values.append(exact_match(pred, ref))
                ed_values.append(edit_distance(pred, ref))

            # Numeric tolerance (use metadata if provided)
            if isinstance(ref, (int, float, str)):
                tol_abs = r.get("metadata", {}).get("abs_tol")
                tol_rel = r.get("metadata", {}).get("rel_tol")
                num_values.append(numeric_close(pred, str(ref), abs_tol=tol_abs, rel_tol=tol_rel))

            # Classification (when 'label' exists)
            if "label" in r:
                cls_true.append(str(r["label"]))
                cls_pred.append(str(r.get("pred_label", pred)))

            # Retrieval (when 'retrieved_ids' exists)
            if "retrieved_ids" in r and "gold_ids" in r:
                retr_p5_values.append(precision_at_k(r["retrieved_ids"], r["gold_ids"], k=5))

            # JSON schema (when 'json_output' exists)
            if "json_output" in r:
                req = r.get("json_required_types", {"title": str, "price": (int, float)})
                json_ok_values.append(json_schema_ok(r["json_output"], req))

        # Aggregate
        report = {}
        if em_values:
            report["exact_match"] = {
                "mean": sum(em_values)/len(em_values),
                "ci": bootstrap_ci(em_values)
            }
        if num_values:
            report["numeric_within_tolerance"] = {
                "mean": sum(num_values)/len(num_values),
                "ci": bootstrap_ci(num_values)
            }
        if ed_values:
            report["edit_distance"] = {
                "mean": sum(ed_values)/len(ed_values),
                "ci": bootstrap_ci(ed_values)
            }
        if cls_true:
            report["classification"] = {
                "accuracy": accuracy(cls_true, cls_pred),
                "f1_macro": f1_macro(cls_true, cls_pred)
            }
        if retr_p5_values:
            report["retrieval_p@5"] = {
                "mean": sum(retr_p5_values)/len(retr_p5_values),
                "ci": bootstrap_ci(retr_p5_values)
            }
        if json_ok_values:
            report["json_schema_pass_rate"] = {
                "mean": sum(json_ok_values)/len(json_ok_values),
                "ci": bootstrap_ci(json_ok_values)
            }
        return report
```

**How to use it**
1. Prepare a `data.jsonl` file with one JSON object per line, e.g.:

```json
{"id": 1, "input": "2+2", "output": "4", "reference": "4"}
{"id": 2, "input": "Price?", "output": "{\"title\":\"Chair\",\"price\":149.9}", "json_output": {"title":"Chair","price":149.9}, "json_required_types": {"title":"", "price":0}}
{"id": 3, "input": "Classify", "pred_label": "positive", "label": "negative"}
{"id": 4, "input": "Find docs", "retrieved_ids": [2,7,9,10,5], "gold_ids": [5,8,12]}
```

2. Load and run:

```python
with open("data.jsonl") as f:
    records = [json.loads(line) for line in f]
rep = Evaluator(records).run()
print(json.dumps(rep, indent=2))
```

3. Extend by **adding new metric functions** and including them in `Evaluator.run()`.

---

## 5) Designing judge-based metrics (brief setup; details in 5.3)

When code can’t reliably capture your success criteria (e.g., “Is the answer *helpful and non-misleading*?”), use **judges**. For 5.2 we focus on **data structures** and **aggregation**; in 5.3 we’ll author the prompts/rubrics.

- **Record structure**: add a `judgments` field per example, each with `{rater_id, question_id, criterion, score, rationale}`.  
- **Aggregation**: average over raters; keep **per-criterion** breakdowns (factuality, safety, tone).  
- **Calibration**: include a few **gold** items with known outcomes to detect lenient/harsh raters.  
- **Reliability**: compute inter-rater agreement (overview now; deep dive in Ch.4). If reliability is low, tighten the rubric **before** relying on the metric.

This separation lets your evaluation pipeline treat judge scores **the same way** as code-based scores—just another column to aggregate with CIs.

---

## 6) Making metrics trustworthy in production

1. **Stable preprocessing**: canonicalize text (lowercase, trim, normalize whitespace, Unicode NFC).  
2. **Idempotent runs**: same input → same score. Fix seeds when sampling.  
3. **Version everything**: dataset version, metric code version, model hyperparameters, temperature.  
4. **Stratify**: aggregate by segment (language, difficulty, customer tier). Many regressions only appear in a slice.  
5. **Guard against gaming**: if a metric can be trivially optimized (e.g., keyword overlap), pair it with complementary metrics (e.g., judge factuality).  
6. **Track *cost and latency* alongside quality**: small quality wins that triple cost often fail business reality.  
7. **Use acceptance tests**: a tiny set of must-pass checks for releases; broader suites for score tracking.  
8. **Close the loop with error analysis**: every evaluation run should yield a **shortlist of concrete fixes** (see Ch.3).

---

## 7) Worked micro-examples

### A. Numeric extraction with tolerance
- **Task:** Extract the interest rate from a paragraph.
- **Metric:** `numeric_close(pred, ref, abs_tol=0.001, rel_tol=0.01)`  
- **Why:** Parsing may yield 0.1199 vs 0.12; that’s acceptable.

### B. Tool calling for payment links
- **Task:** Produce `{"amount_cents": int, "currency": "BRL|ARS", "expires_at": ISO8601}`  
- **Metric:** `json_schema_ok + custom range checks (amount_cents > 0; currency in set; date in future)`  
- **Why:** Structured validity is more important than wording.

### C. Retrieval candidates for negotiation context
- **Task:** Return 5 most relevant debtor records.  
- **Metric:** `precision@k` vs a curated set of relevant IDs; add **latency** and **cost**.  
- **Why:** Early precision drives downstream negotiation quality and speed.

---

## 8) Checklist before you ship a metric

- [ ] Does this metric **align** with your success definition (5.1) and business goals?  
- [ ] Is it **reliable** across re-runs and stable to minor noise?  
- [ ] Is it **actionable**—will a bad score tell engineers what to try next?  
- [ ] Do you report **CIs** and **segment breakdowns**?  
- [ ] Are **cost/latency** tracked for each run?  
- [ ] Is there a **minimum acceptance** bar for releases and alerts for regressions?  
- [ ] Have you paired **objective** metrics with **judge** metrics where appropriate?  
- [ ] Is everything **versioned** (dataset, code, model settings)?

---

## 9) Exercises

1. **Convert a success definition to metrics.** Pick one of your real tasks (e.g., “generate a legally-safe payment reminder”). Propose two code metrics and one judge metric. Explain why each is valid, reliable, and actionable.  
2. **Implement a new metric.** Add a **length-penalized ROUGE-L** to the harness (hint: compute LCS length and normalize by reference length; then penalize answers that exceed a max token count).  
3. **Add CIs and segments.** Split your eval set into Brazilian vs. Argentine merchants and compute metrics with bootstrap CIs per segment. Where is performance weakest?  
4. **Schema robustness.** Extend `json_schema_ok` to support **nested** schemas and constrain date formats. Break the model intentionally and observe which items fail.  
5. **Design a judge form.** Create a one-page rubric with three 1–5 criteria (Factuality, Actionability, Tone). Define each *precisely* so two judges would likely agree.

---

## Summary

Implementing metrics is the craft of turning your success definitions into **repeatable, trustworthy functions.** Start with the simplest **deterministic checks** that capture correctness and safety; add **judge-based** metrics when qualities are subjective. Always quantify **uncertainty**, slice by **segments**, and pair **quality** with **cost/latency**. With a small harness and disciplined versioning, your team can evaluate every change with confidence—setting us up perfectly for **5.3: Writing LLM-as-Judge Prompts**.
