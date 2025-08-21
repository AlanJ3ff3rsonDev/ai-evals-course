# Lesson 5.7 — Python Code for Estimating Success Rates

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previously (5.6):** We learned the *statistics* of correcting raw pass-rates from **imperfect judges** and attaching uncertainty.  
> **This lesson (5.7):** You’ll get **production-ready Python**—a tiny, dependency‑light toolkit you can drop into your eval harness to compute **bias‑corrected true success rates**, **confidence intervals**, **segment-weighted estimates**, and **(optional) multi‑judge EM (Dawid–Skene)**.

---

## What we’ll build

A minimal module with these capabilities:

1. **Confusion & calibration**: estimate judge **sensitivity** and **specificity** (per segment).  
2. **Correction**: convert observed pass-rate `q` (from the judge) into an estimate of the **true success rate** `pi`.  
3. **Uncertainty**: **parametric bootstrap** that jointly samples `q`, `s`, and `t` to produce CIs.  
4. **Segments**: compute `pi` by language/country/channel and combine with **production weights**.  
5. **Ensembles**: majority‑vote judges and estimate the ensemble’s `(s, t)`.  
6. **Optional EM**: a compact **Dawid–Skene** implementation for combining multiple noisy judges when human labels are sparse.

The code is pure‑Python (no external libs) except for `math`/`random` and fits in a single file.

---

## 1) The module: `true_success.py`

Copy the following into a file named `true_success.py` in your project. (It is also embedded in this lesson for convenience.)

```python
# true_success.py
# Tiny library for bias-corrected success-rate estimation with imperfect judges.
# Author: You
# License: MIT

from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple, Iterable
import math, random

# ----------------------
# Basic utilities
# ----------------------

@dataclass
class Confusion:
    tp: int
    fp: int
    fn: int
    tn: int

    def totals(self) -> Tuple[int, int, int, int]:
        return self.tp, self.fp, self.fn, self.tn

    def sensitivity(self) -> float:
        # s = TP / (TP + FN)
        denom = self.tp + self.fn
        return self.tp / denom if denom else 0.0

    def specificity(self) -> float:
        # t = TN / (TN + FP)
        denom = self.tn + self.fp
        return self.tn / denom if denom else 0.0

def wilson_ci(p: float, n: int, z: float = 1.96) -> Tuple[float, float]:
    # 95% Wilson interval for a proportion
    if n == 0:
        return (0.0, 0.0)
    denom = 1 + z*z/n
    center = (p + z*z/(2*n)) / denom
    margin = z * math.sqrt((p*(1-p) + z*z/(4*n)) / n) / denom
    lo, hi = center - margin, center + margin
    return max(0.0, lo), min(1.0, hi)

def beta_sample(alpha: float, beta: float) -> float:
    # Minimal Beta sampler via two Gamma samples (shape-scale form)
    # For stability, fall back on normal approx when shapes are large
    # but Python's random.gammavariate is fine for our sizes.
    x = random.gammavariate(alpha, 1.0)
    y = random.gammavariate(beta, 1.0)
    return x / (x + y) if (x + y) > 0 else 0.0

# ----------------------
# Core estimation
# ----------------------

def correct_true_success(q: float, s: float, t: float) -> float:
    """
    Bias-correct observed pass-rate q using judge sensitivity s and specificity t.
    Returns an estimate of the true success rate pi, clamped to [0,1].
    """
    denom = s + t - 1.0
    if denom <= 0:
        # Judge is not better than random guessing; caller should handle this case.
        return 0.0
    pi = (q - (1.0 - t)) / denom
    return min(1.0, max(0.0, pi))

def parametric_bootstrap_ci(
    K: int, N: int,              # evaluation set: K passes out of N (observed by judge)
    calib: Confusion,            # calibration confusion matrix (judge vs human)
    iters: int = 5000,
    alpha: float = 0.05
) -> Tuple[float, float, float]:
    """
    Jointly sample q, s, t from posterior-like Betas and return (mean_pi, lo, hi).
    Uses Beta(K+1, N-K+1) for q, Beta(TP+1, FN+1) for s, Beta(TN+1, FP+1) for t.
    """
    tp, fp, fn, tn = calib.totals()
    if N == 0:
        return (0.0, 0.0, 0.0)
    samples = []
    for _ in range(iters):
        q = beta_sample(K + 1.0, (N - K) + 1.0)
        s = beta_sample(tp + 1.0, fn + 1.0) if (tp + fn) > 0 else 0.0
        t = beta_sample(tn + 1.0, fp + 1.0) if (tn + fp) > 0 else 0.0
        denom = s + t - 1.0
        if denom <= 0:
            # skip pathological draws (rare if judge is reasonable)
            continue
        pi = correct_true_success(q, s, t)
        samples.append(pi)
    if not samples:
        return (0.0, 0.0, 0.0)
    samples.sort()
    mean_pi = sum(samples) / len(samples)
    lo = samples[int(alpha/2 * len(samples))]
    hi = samples[int((1 - alpha/2) * len(samples)) - 1]
    return mean_pi, lo, hi

# ----------------------
# Data helpers
# ----------------------

def confusion_from_labels(true_labels: Iterable[int], judge_labels: Iterable[int]) -> Confusion:
    """
    true_labels: iterable of 0/1 (0 = fail, 1 = pass)
    judge_labels: iterable of 0/1 from the judge
    """
    tp = fp = fn = tn = 0
    for y, j in zip(true_labels, judge_labels):
        if j == 1 and y == 1:
            tp += 1
        elif j == 1 and y == 0:
            fp += 1
        elif j == 0 and y == 1:
            fn += 1
        elif j == 0 and y == 0:
            tn += 1
    return Confusion(tp, fp, fn, tn)

def observed_pass_rate(judge_labels: Iterable[int]) -> Tuple[int, int, float]:
    labels = list(judge_labels)
    N = len(labels)
    K = sum(labels)
    q = K / N if N else 0.0
    return K, N, q

# ----------------------
# Segments and weighting
# ----------------------

def segment_estimates(
    segments: Dict[str, Dict[str, int]],
    # segments[g] = {"K": , "N": , "tp": , "fp": , "fn": , "tn": }
    weights: Optional[Dict[str, float]] = None,
    iters: int = 5000,
    alpha: float = 0.05
) -> Dict[str, Dict[str, float]]:
    """
    Compute per-segment bias-corrected estimates and (optionally) a weighted overall.
    Returns a dict with entries per segment and an 'overall' key if weights provided.
    """
    out = {}
    total_weight = sum(weights.values()) if weights else None
    overall_samples = []

    for g, d in segments.items():
        K, N = d["K"], d["N"]
        calib = Confusion(d["tp"], d["fp"], d["fn"], d["tn"])
        mean_pi, lo, hi = parametric_bootstrap_ci(K, N, calib, iters=iters, alpha=alpha)
        out[g] = {"mean": mean_pi, "lo": lo, "hi": hi}

    if weights:
        # Weighted bootstrap by sampling segment-level pi* then mixing with weights
        for _ in range(iters):
            tot = 0.0
            for g, d in segments.items():
                w = weights.get(g, 0.0)
                if w <= 0: 
                    continue
                K, N = d["K"], d["N"]
                tp, fp, fn, tn = d["tp"], d["fp"], d["fn"], d["tn"]
                q = beta_sample(K + 1.0, (N - K) + 1.0)
                s = beta_sample(tp + 1.0, fn + 1.0) if (tp + fn) > 0 else 0.0
                t = beta_sample(tn + 1.0, fp + 1.0) if (tn + fp) > 0 else 0.0
                pi = correct_true_success(q, s, t) if (s + t - 1.0) > 0 else 0.0
                tot += (w / total_weight) * pi
            overall_samples.append(tot)
        overall_samples.sort()
        mean_pi = sum(overall_samples)/len(overall_samples) if overall_samples else 0.0
        lo = overall_samples[int(alpha/2 * len(overall_samples))] if overall_samples else 0.0
        hi = overall_samples[int((1 - alpha/2) * len(overall_samples)) - 1] if overall_samples else 0.0
        out["overall"] = {"mean": mean_pi, "lo": lo, "hi": hi}
    return out

# ----------------------
# Ensembles (majority vote)
# ----------------------

def majority_vote(judges: List[List[int]]) -> List[int]:
    """
    judges: list of judge label lists, each containing 0/1 decisions for the same items.
    Returns a list with the majority-vote decision for each item (ties => 1 if tie favors pass, else 0).
    """
    M = len(judges)
    N = len(judges[0]) if judges else 0
    out = []
    for i in range(N):
        votes = sum(j[i] for j in judges)
        out.append(1 if votes >= (M/2) else 0)
    return out

# ----------------------
# Optional: Dawid–Skene EM for binary labels
# ----------------------

@dataclass
class DSParams:
    pi: float                 # prior P(Y=1)
    sens: List[float]         # per-judge sensitivity P(J=1|Y=1)
    spec: List[float]         # per-judge specificity P(J=0|Y=0)

def dawid_skene_binary(
    labels: List[List[Optional[int]]],  # shape: M judges x N items (0/1/None)
    iters: int = 50,
    eps: float = 1e-6
) -> Tuple[List[float], DSParams]:
    """
    Returns (posteriors, params):
    posteriors: list of P(Y=1|observations) for each item
    params: learned judge parameters and prior
    """
    M = len(labels)
    N = len(labels[0]) if M else 0

    # Initialize with simple priors
    pi = 0.5
    sens = [0.8]*M
    spec = [0.8]*M
    post = [0.5]*N

    for _ in range(iters):
        # E-step: compute posteriors per item
        for i in range(N):
            logp1 = math.log(max(pi, eps))
            logp0 = math.log(max(1-pi, eps))
            for m in range(M):
                lij = labels[m][i]
                if lij is None:
                    continue
                # P(J=1 | Y=1) = sens[m]; P(J=0 | Y=0) = spec[m]
                if lij == 1:
                    logp1 += math.log(max(sens[m], eps))
                    logp0 += math.log(max(1 - spec[m], eps))  # P(J=1|Y=0)=1-spec
                else:  # lij == 0
                    logp1 += math.log(max(1 - sens[m], eps))
                    logp0 += math.log(max(spec[m], eps))
            # Normalize
            a = math.exp(logp1 - max(logp1, logp0))
            b = math.exp(logp0 - max(logp1, logp0))
            p1 = a / (a + b)
            post[i] = p1

        # M-step: update pi, sens, spec
        pi = sum(post) / N if N else 0.5
        for m in range(M):
            # sens[m] = sum_i p1 * 1[J=1] / sum_i p1
            num_s = den_s = num_t = den_t = 0.0
            for i in range(N):
                lij = labels[m][i]
                if lij is None:
                    continue
                den_s += post[i]
                den_t += (1 - post[i])
                if lij == 1:
                    num_s += post[i]
                else:
                    num_t += (1 - post[i])  # counts TN
            sens[m] = num_s / den_s if den_s > 0 else sens[m]
            spec[m] = num_t / den_t if den_t > 0 else spec[m]

    return post, DSParams(pi, sens, spec)
```

---

## 2) Worked examples

### Example A — Single judge, overall estimate

```python
from true_success import Confusion, parametric_bootstrap_ci

# Evaluation run: judge passed 740 of 1000 items
K, N = 740, 1000

# Calibration (judge vs. human) confusion
calib = Confusion(tp=360, fn=40, fp=140, tn=460)

mean_pi, lo, hi = parametric_bootstrap_ci(K, N, calib, iters=5000)
print(f"True success ≈ {mean_pi:.3f} (95% CI {lo:.3f}–{hi:.3f})")
# Decision rule: ship only if CI lower bound >= target (e.g., 0.80)
```

### Example B — Segment‑wise (BR vs. AR) with production weights

```python
from true_success import segment_estimates

segments = {
    "BR": {"K": 420, "N": 560, "tp": 210, "fn": 20, "fp": 80, "tn": 250},
    "AR": {"K": 320, "N": 440, "tp": 150, "fn": 20, "fp": 60, "tn": 210},
}
weights = {"BR": 0.65, "AR": 0.35}  # traffic mix

out = segment_estimates(segments, weights=weights, iters=4000)
print("BR:", out["BR"])
print("AR:", out["AR"])
print("Overall (weighted):", out["overall"])
```

### Example C — Majority‑vote ensemble of two LLM judges

```python
from true_success import majority_vote, confusion_from_labels, parametric_bootstrap_ci, observed_pass_rate

# On calibration, we have human labels and two LLM judges J1 and J2
y_true = [1,0,1,1,0,0,1]      # 1=pass, 0=fail
j1 =     [1,0,1,0,0,1,1]
j2 =     [1,0,1,1,0,0,1]

j_ens = majority_vote([j1, j2])
calib = confusion_from_labels(y_true, j_ens)

# On evaluation, use the *ensemble* decisions
eval_labels = [1,1,0,1,0,1,1,0,1,0]
K, N, _ = observed_pass_rate(eval_labels)

mean_pi, lo, hi = parametric_bootstrap_ci(K, N, calib, iters=4000)
print(mean_pi, lo, hi)
```

### Example D — (Optional) Dawid–Skene EM for multiple judges with missing labels

```python
from true_success import dawid_skene_binary

# Three judges over five items; None = judge skipped the item
labels = [
    [1, 0, 1, None, 1],  # Judge A
    [1, 0, None, 0, 1],  # Judge B
    [1, 1, 1, 0, None],  # Judge C
]

post, params = dawid_skene_binary(labels, iters=50)
print("Posterior P(Y=1) per item:", [round(p,3) for p in post])
print("Learned prior pi:", round(params.pi,3))
print("Sensitivities:", [round(x,3) for x in params.sens])
print("Specificities:", [round(x,3) for x in params.spec])

# A bias-corrected true success can be estimated as mean(post)
print("Estimated true success (mean posterior):", sum(post)/len(post))
```

---

## 3) How to slot this into your harness (quick checklist)

- [ ] Compute **observed** `K,N` on the evaluation split from your judge labels.  
- [ ] From the **calibration** split with human labels, compute the judge’s **confusion** (`tp, fp, fn, tn`).  
- [ ] Call `parametric_bootstrap_ci(K,N,calib)` to get `mean, lo, hi`.  
- [ ] For **segments**, prepare per‑segment `(K,N,tp,fp,fn,tn)` and call `segment_estimates(...)` with **weight mix**.  
- [ ] Gate releases on **CI lower bound**. Log the **judge version**, **dataset version**, and **weights** used.

---

## 4) Common pitfalls (and how this code handles them)

- **Youden’s J ≤ 0** (`s + t - 1 ≤ 0`): the judge is no better than random. We skip such draws in the bootstrap and return 0 if it’s systematic—go back to 5.3–5.5 to fix your judge.  
- **CI too wide**: Grow N (evaluation) and/or add calibration items (to tighten `s,t`).  
- **Segment drift**: Always compute per‑segment CIs; a healthy overall can hide a failing segment.  
- **Ensemble math confusion**: Calibrate **after** aggregation. Build the ensemble decision first, then compare to humans to get `(s,t)` for the ensemble itself.

---

## 5) Exercises

1. **Your numbers.** Replace the toy numbers with your latest run and report `mean, lo, hi` overall and by country. Decide whether to ship if the target is 0.80.  
2. **Judge upgrade.** Compare judge v1 and v2 by running this code with each calibration matrix. Which version yields a higher **CI‑lower** on the same evaluation set?  
3. **Weighted mix change.** Recompute the overall estimate assuming next month’s projected traffic (e.g., BR 55%, AR 45%). How does the CI shift?  
4. **EM sanity.** Create a tiny synthetic dataset with three judges of different quality. Does EM recover higher sensitivity for the good judge?  
5. **Stretch.** Extend `parametric_bootstrap_ci` to also return the **posterior means** of `s` and `t` from the samples, and log them alongside `pi`.

---

## Summary

This lesson delivered **ready-to-use Python** to turn noisy judge decisions into a trustworthy estimate of **true success**—with uncertainty you can act on. The functions are intentionally small and explicit so you can audit them in code reviews and plug them straight into CI. Next up (**5.8, optional**), we’ll do **group-wise metrics for evaluating multiple outputs**, then we’ll close Chapter 5 with common pitfalls and the summary.
