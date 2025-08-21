# Lesson 5.8 (Optional) — Group‑wise Metrics for Evaluating Multiple Outputs

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previously (5.1 → 5.7):** You defined *what* to measure, implemented code metrics, built/validated **LLM‑as‑judge**, corrected for imperfect judges, and shipped Python to compute **true success** with uncertainty.  
> **This lesson (5.8):** Many real systems generate **multiple outputs per input** (n‑sampling, beam search, self‑consistency, top‑k retrieval, multiple tool plans). We’ll learn to evaluate **sets** of outputs—capturing *coverage, diversity, and “at least one is good” success*—without fooling ourselves.  
> **Next (5.9):** Common pitfalls that bite production evaluators.

---

## Learning objectives

By the end, you will be able to:

1. Define a **group** formally and select the right **group aggregator** (max/any‑pass, majority vote, DCG/utility, mean, weighted).  
2. Measure **set quality** (coverage and diversity) alongside correctness.  
3. Estimate **best‑of‑n** success and choose **n** with cost/latency constraints.  
4. Handle **judge imperfection** at the group level (calibration & correction).  
5. Implement a **group‑wise harness** that bootstraps **by group** (not by item) to attach confidence intervals you can trust.

---

## 1) Why group‑wise evaluation?

Modern LLM systems rarely produce just one thing:

- **n‑sampling / self‑consistency**: sample 3–10 answers and pick (or vote on) the best.  
- **RAG**: retrieve top‑k documents; the *set* should contain the needed evidence.  
- **Tool planning**: generate multiple plans/queries and select.  
- **Candidate messages** (collections, support): author several templates, then choose one to send.  
- **Beam search / reranking**: generate N candidates, rerank with a judge or a heuristic.

A single “top‑1 exact match” misses the real product behavior: **Can your system obtain a good outcome given multiple tries/options and a selector?**

---

## 2) Core definitions

Consider dataset \(\mathcal{D} = \{x_i\}_{i=1}^M\). For each input \(x_i\), the system produces a **group** \(G_i = \{o_{i1},\ldots,o_{in_i}\}\) of outputs (candidates, retrievals, plans).

Let \(s_{ij} \in [0,1]\) be a **score** for candidate \(o_{ij}\) (from a deterministic metric or a judge), and let \(\text{pass}_{ij} \in \{0,1\}\) be a derived pass/fail.

A **group‑level aggregator** \(g\) maps all \(\{s_{ij}\}_{j=1}^{n_i}\) to a **group score** \(S_i = g(G_i)\). Dataset score is usually the **mean over groups**: \(\frac{1}{M}\sum_i S_i\). You’ll choose \(g\) to mirror product UX.

### Common aggregators (pick what matches your product)

1. **Any‑pass (“at least one good”)**  
   \(S_i = \max_j \text{pass}_{ij}\). Use when a human/selector can pick any good candidate.

2. **Best‑score (max)**  
   \(S_i = \max_j s_{ij}\). Use when you *select* by a reliable score (judge/ranker).

3. **Majority vote / self‑consistency**  
   \(S_i = \mathbb{1}\{\sum_j \text{pass}_{ij} \ge \lceil n_i/2 \rceil\}\). Great for reasoning tasks with voting.

4. **Top‑k utility (rank‑sensitive)**  
   Present a list to users. Score with **Discounted Cumulative Gain** (DCG) using gains \(g(s_{ij})\) and discount \(\log\):  
   \(\mathrm{DCG}@k = \sum_{j=1}^{k} \frac{g(s_{ij})}{\log_2(j+1)}\). Normalize to nDCG by the ideal ordering.

5. **Coverage / recall‑oriented** (retrieval)  
   \(S_i=\) fraction of gold facts/IDs covered by the set (Recall@k).

6. **Average quality**  
   \(S_i = \frac{1}{n_i}\sum_j s_{ij}\). Use when the **whole set** is consumed (e.g., tool plan requires all steps).

You can—and often should—report **two or three** complementary aggregators: e.g., *Any‑pass* (can we get one good?) and *nDCG@3* (are the first options strong?).

---

## 3) Measuring set **diversity** and **coverage**

Correctness is not enough. A set of five near‑duplicates is fragile.

- **n‑gram distinctness**: proportion of unique unigrams/bigrams across the set.  
- **Semantic diversity**: average pairwise distance in embedding space (cosine).  
- **Facet coverage** (summarization/search): label candidates with facets (who/what/when…) and measure the share of required facets present.  
- **Redundancy penalty**: \(1 - \text{similarity\_max}\) where similarity is token or embedding overlap.

These are **diagnostic** signals: they explain why Any‑pass might be low (“we sampled 5 times but got 5 clones”).

---

## 4) Best‑of‑n, cost, and the math of diminishing returns

If each independent sample succeeds with probability \(p\), the **Any‑pass** success for \(n\) samples is:
\{
P(\text{any pass}) = 1 - (1 - p)^n.
\}
With non‑identical \(p_j\): \(1 - \prod_{j=1}^n (1-p_j)\).

This curve **saturates quickly**. Past 3–5 samples, gains are small—use this to pick a smart **n** given latency/cost.

**Selector quality matters.** If you *pick the best* with a noisy score, your realized success lies **between** Any‑pass and Max‑score. Validate your selector (judge/ranker) on a holdout (5.4–5.5).

---

## 5) Handling **imperfect judges** at the group level

From 5.6–5.7 we learned to correct a judge’s **pass‑rate** using sensitivity \(s\) and specificity \(t\). For group metrics do one of the following:

1. **Calibrate at the group level (recommended)**  
   On a calibration set, label **groups** with humans (“does *any* candidate meet the bar?”). Compare to the **group decision** made by your judge (e.g., Any‑pass using per‑candidate judge). Estimate \((\hat s_{\mathrm{grp}}, \hat t_{\mathrm{grp}})\) and apply the **same correction formula** to the observed group pass‑rate \(q_{\mathrm{grp}}\).

2. **Approximate from candidate‑level calibration**  
   If per‑candidate sensitivity/specificity are \((s,t)\) and candidates are *roughly independent*, the **judge‑observed** Any‑pass rate is \(q^{\mathrm{obs}} = 1 - \prod_j (1 - q^{\mathrm{obs}}_j)\).  
   Convert observed candidate pass‑rates \(q^{\mathrm{obs}}_j\) to **true** rates \(\pi_j\) using 5.6, then compute \(1-\prod_j (1-\pi_j)\). This ignores selection correlation and should be treated as **upper‑bound**.

In both cases, **bootstrap by group** to attach uncertainty (Section 7).

---

## 6) A tiny group‑wise evaluation harness (drop‑in)

Paste the following into your eval repo as `groupwise_eval.py`. It is dependency‑light and meshes with your 5.2/5.7 harnesses.

```python
# groupwise_eval.py
from typing import List, Dict, Any, Tuple
import math, random

def any_pass(passes: List[int]) -> int:
    """1 if any candidate passes (0/1 list), else 0."""
    return 1 if any(passes) else 0

def best_score(scores: List[float]) -> float:
    """Max of candidate scores."""
    return max(scores) if scores else 0.0

def majority_vote(passes: List[int]) -> int:
    """1 if >= half pass, else 0."""
    return 1 if sum(passes) >= math.ceil(len(passes)/2) else 0

def dcg_at_k(gains: List[float], k: int) -> float:
    """Discounted cumulative gain @k (gains assumed already in relevance scale)."""
    k = min(k, len(gains))
    return sum(gains[j] / math.log2(j+2) for j in range(k))

def distinct_ngrams(texts: List[str], n: int = 2) -> float:
    """Distinct-n across a set: |unique n-grams| / |total n-grams|."""
    def ngrams(t):
        toks = t.split()
        return [' '.join(toks[i:i+n]) for i in range(len(toks)-n+1)]
    all_grams = []
    for t in texts:
        all_grams += ngrams(t)
    return len(set(all_grams)) / max(1, len(all_grams))

def group_metrics(group: Dict[str, Any], k_for_dcg: int = 3) -> Dict[str, float]:
    """
    group = {
      "scores": [float,...],      # per-candidate quality scores (e.g., judge 1-5 scaled to 0-1)
      "passes": [0/1,...],        # per-candidate thresholded decisions
      "texts":  [str,...]         # optional, for diversity
    }
    """
    scores = group.get("scores", [])
    passes = group.get("passes", [])
    texts  = group.get("texts", [])
    gains  = scores  # or map via a gain function
    return {
        "any_pass": any_pass(passes),
        "best_score": best_score(scores),
        "majority": majority_vote(passes),
        "dcg@k": dcg_at_k(gains, k_for_dcg),
        "distinct1": distinct_ngrams(texts, 1) if texts else 0.0,
        "distinct2": distinct_ngrams(texts, 2) if texts else 0.0,
    }

def bootstrap_groups(values: List[float], iters: int = 2000, alpha: float = 0.05) -> Tuple[float,float,float]:
    """Bootstrap the mean by resampling *groups* (indices) with replacement."""
    if not values: return (0.0,0.0,0.0)
    import random
    n = len(values)
    means = []
    for _ in range(iters):
        idx = [random.randrange(n) for _ in range(n)]
        means.append(sum(values[i] for i in idx)/n)
    means.sort()
    mean = sum(means)/len(means)
    lo = means[int(alpha/2*len(means))]
    hi = means[int((1-alpha/2)*len(means))-1]
    return mean, lo, hi

def evaluate_dataset(groups: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """Compute group-wise metrics with CIs by bootstrapping *groups*."""
    keys = ["any_pass","best_score","majority","dcg@k","distinct1","distinct2"]
    per_key = {k: [] for k in keys}
    for g in groups:
        gm = group_metrics(g)
        for k in keys:
            per_key[k].append(gm[k])
    report = {}
    for k, vals in per_key.items():
        report[k] = dict(zip(["mean","lo","hi"], bootstrap_groups(vals)))
    return report
```

**Usage sketch**
1. For each input, collect its candidate set with per‑candidate **scores** (e.g., judge 1–5 normalized to 0–1), **passes** (thresholded), and optional **texts**.  
2. Call `evaluate_dataset(groups)` to get dataset means with **group‑level CIs**.  
3. If you present only **top‑k** to users, compute metrics **after truncating** sets to k.

---

## 7) Proper uncertainty: **bootstrap by group**

Independence lives at the **input/group** level, not per candidate. If you resample candidates within a group, you’ll get **over‑confident** intervals. Always resample **groups** (whole sets) as in `bootstrap_groups` above. For segment reporting (BR vs. AR), split groups by segment and bootstrap **within** each slice.

---

## 8) Offline selection: avoid **double‑dipping**

When you both **select** the best candidate and **evaluate** with the **same** judge/ranker, you risk optimistic bias. Safer protocols:

- **Two‑stage judges**: use **judge A** to select and **judge B** (different prompt/model) to evaluate.  
- **Nested splits**: choose selection parameters on *design*, then evaluate on *validation/test* (5.4–5.5).  
- **Human spot‑checks** for the top‑ranked candidate distribution, to ensure the selector is not gaming the rubric.  
- **Log model/selector version** with the eval run for reproducibility.

---

## 9) Worked example (collections domain)

**Scenario:** For each debtor thread, your agent samples **3 candidate first messages**. You show only **1** to the user after selection by an internal judge score (0–1). You care about: *Any‑pass*, *Best‑score*, *nDCG@3* (diagnostic), and *diversity* (distinct‑2).

**Data:** 400 threads \((M=400)\); per thread 3 candidates with judge scores and pass flags (threshold ≥ 0.8).

**Protocol:**
1. Compute per‑thread metrics with `group_metrics`.  
2. Dataset metrics with `evaluate_dataset`.  
3. Sanity: also compute **Any‑pass@3** using a *different* judge (or a human subsample) to avoid selection leakage.  
4. Decide how many samples to run in production using the **best‑of‑n** curve \(1-(1-p)^n\), where \(p\) is the **true** single‑sample success (estimate via 5.7 correction).

**Interpreting results:**  
- If **Any‑pass** ≫ **Best‑score**, your **selector** is leaving wins on the table—iterate the selector prompt (5.5).  
- If **distinct‑2** is low, increase **temperature** or **diversity controls** (e.g., nucleus sampling) or inject **diversified templates**.  
- If **nDCG@3** is good but **Any‑pass** is bad, your **gains** function or judge calibration is off—reinforce faithfulness anchors (5.3).

---

## 10) Choosing **n** with a cost lens

Let `cost_per_try` be tokens/latency budget per candidate and `p` be single‑try true success. The **marginal gain** from \(n \to n+1\) is \((1-p)^n p\). Stop when the **gain per unit cost** falls below your business threshold. Example: with \(p=0.35\), the jump from 3→4 adds only \( (0.65)^3 \cdot 0.35 \approx 0.096 \) absolute—often not worth the latency.

Track **cost & latency** alongside group metrics in your reports (5.2, 5.6).

---

## 11) Checklist before adopting group metrics

- [ ] Aggregator mirrors **product UX** (Any‑pass, Best‑score, vote, nDCG).  
- [ ] **Diversity/coverage** included for diagnosis.  
- [ ] CIs computed by **group bootstrap**.  
- [ ] Judge imperfection handled: **group‑level calibration** or candidate‑level correction (with caveats).  
- [ ] **Double‑dipping** avoided (selector vs. evaluator).  
- [ ] **Segment** breakdowns shown (country, language, channel).  
- [ ] **Cost/latency** tracked per n.  
- [ ] Everything **versioned** (judge prompt ids, selector version, dataset snapshot).

---

## 12) Exercises

1. **Wire your groups.** Export 200 inputs with 3–5 candidates each (scores, passes, texts). Run `evaluate_dataset` and report means + CIs for Any‑pass, Best‑score, nDCG@3, distinct‑2.  
2. **Selector A/B.** Evaluate two selectors (v1 vs. v2) using the *same* candidate sets, but a **different judge** for evaluation. Which selector yields higher Best‑score mean with non‑overlapping CIs?  
3. **Best‑of‑n curve.** Estimate single‑try true success \(p\) via 5.7. Plot \(1-(1-p)^n\) for \(n=1\ldots 6\) (table is fine). Where does the curve saturate relative to your latency budget?  
4. **Diversity fix.** When distinct‑2 < 0.4, try sampling tweaks (temperature, top‑p) or prompt edits to drive variation. Re‑run group metrics: did Any‑pass improve?  
5. **Group‑level calibration.** Build a 100‑group calibration set labeled by humans for **Any‑pass** and estimate group‑level \(s,t\). Correct the observed Any‑pass mean and attach CIs (5.7).

---

## Summary

Group‑wise evaluation reflects how modern LLM systems actually operate: they **produce sets**, **select**, and **present**. Evaluating only top‑1 hides crucial behaviors—**coverage**, **diversity**, and **the headroom unlocked by multiple tries**. Choose an aggregator that matches your UX (Any‑pass, Best‑score, vote, nDCG), compute uncertainty by **bootstrapping groups**, and correct for **judge imperfection** at the group level. Pair these numbers with **cost/latency** so you can pick the right **n** pragmatically. With group metrics in your toolkit, you’re ready for **5.9 — Common Pitfalls** to harden your evaluation pipeline before it hits CI/CD.
