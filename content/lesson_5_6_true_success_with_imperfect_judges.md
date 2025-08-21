# Lesson 5.6 — Estimating True Success Rates with Imperfect Judges

> **Course position:** Chapter 5 (“Implementing Automated Evaluators”)  
> **Previously:**  
> • **5.1–5.2**: Defined *what* to measure and implemented *how* to measure.  
> • **5.3–5.5**: Built LLM-as-judge prompts and iterated using clean data splits.  
> **This lesson (5.6):** When your judge is **not perfect**, raw pass-rates are biased. We’ll correct them—to estimate the **true success rate** your users would experience—and attach uncertainty you can use for release decisions.  
> **Next (5.7):** We’ll implement the estimators in Python.

---

## Learning objectives

By the end of this lesson you will be able to:

1. Explain why raw judge pass-rates are biased when judges have **false positives/negatives**.  
2. Estimate **sensitivity** and **specificity** (or full confusion matrices) from a **calibration set** with human labels.  
3. Compute a **bias-corrected true success rate** and **confidence intervals**.  
4. Combine **multiple judges** (LLMs and/or humans) by estimating each one’s reliability (Dawid–Skene / EM) and aggregating posteriors.  
5. Make **release decisions** using **lower confidence bounds** under judge uncertainty.

---

## 1) The problem in one picture

Imagine your judge is a classifier deciding **Pass** or **Fail** for each model output. Let the **true** (unobserved) label be `Y ∈ {pass, fail}`, and the judge’s observed label be `J ∈ {pass, fail}`.

- **Sensitivity** (a.k.a. recall/true-positive rate):  
  \[ s = P(J=\text{pass} \mid Y=\text{pass}) \]
- **Specificity** (true-negative rate):  
  \[ t = P(J=\text{fail} \mid Y=\text{fail}) \]

Your **raw pass-rate** (the fraction the judge calls “pass”) is:
\[ q = P(J=\text{pass}) \]

But what you actually want is the **true success rate**:
\[ \pi = P(Y=\text{pass}) \]

Because the judge is imperfect, \( q \neq \pi \). We must correct \( q \) using \( s \) and \( t \).

---

## 2) Calibrate your judge: estimate sensitivity & specificity

Use a **calibration set** (from 5.4) with **human labels** `Y` and judge outputs `J`.

Build the 2×2 **confusion matrix** (judge vs. truth):

|              | Truth: Pass | Truth: Fail |
|--------------|-------------|-------------|
| Judge: Pass  | TP          | FP          |
| Judge: Fail  | FN          | TN          |

Then estimate:

- \(\hat s = \dfrac{TP}{TP + FN}\)  
- \(\hat t = \dfrac{TN}{TN + FP}\)

> **Tip:** Compute these **per segment** (language/channel/difficulty). Judge quality often varies by slice. You can later **weight** slice-wise estimates by production mix.

Attach uncertainty to \(\hat s, \hat t\) with binomial CIs (Wilson or Jeffreys/Beta). We’ll use them in bootstraps later.

---

## 3) Correcting bias: from observed pass-rate \(q\) to true rate \( \pi \)

Using the law of total probability:

\[
q = P(J=\text{pass}) = s\,\pi + (1-t)\,(1-\pi).
\]

Rearrange to solve for \(\pi\):

\[
\boxed{\;\hat\pi = \dfrac{q - (1 - \hat t)}{\hat s + \hat t - 1}\;}\quad\text{provided }(\hat s + \hat t > 1).
\]

- The denominator \(\hat s + \hat t - 1\) is **Youden’s J statistic**. If it’s ≤ 0, your judge is no better than random—**do not** use it without redesigning (5.3–5.5).
- Clamp \(\hat\pi\) to \([0,1]\) after correction.

**Worked intuition**  
- If the judge is **perfect** (s=1, t=1), then \(\hat\pi = q\).  
- If the judge has many **false positives** (low \(t\)), raw \(q\) is **too high**; the correction subtracts the expected FP share.  
- If the judge has many **false negatives** (low \(s\)), raw \(q\) is **too low**; the correction adds back missed passes.

---

## 4) Uncertainty: confidence intervals for \( \pi \)

There are two uncertainty sources: (1) sampling variability in \(q\) on your evaluation set, and (2) uncertainty in \(\hat s,\hat t\) from the calibration set.

**Recommended:** **Parametric bootstrap**

1. From the evaluation set of size \(N\), the observed passes \(K\sim \text{Binomial}(N, q)\). Sample \(q^\*\) from a Beta posterior or normal approximation.  
2. From the calibration set, sample \(s^\*\) from \(\text{Beta}(TP+1, FN+1)\) and \(t^\*\) from \(\text{Beta}(TN+1, FP+1)\).  
3. Compute \(\pi^\* = \dfrac{q^\* - (1 - t^\*)}{s^\* + t^\* - 1}\) and clamp to \([0,1]\).  
4. Repeat B times (e.g., 5,000). The **2.5% and 97.5% quantiles** of \(\{\pi^\*\}\) give a 95% CI.

**Decision rule for releases**  
Ship only if the **lower bound** of the CI meets your target (e.g., \(\text{LB}(\pi) \ge 0.80\)). That guards you against optimistic judges.

---

## 5) Multiple judges: how to combine them

Real pipelines often use **ensembles** of judges—e.g., two LLMs plus a human spot-checker. Treat each judge \(m\) as having its **own** sensitivity \(s_m\) and specificity \(t_m\). You have two main strategies:

### 5.1 Majority vote (simple)
- Let the aggregated decision be the majority of \(\{J_m\}\).
- Empirically estimate the ensemble’s \( \hat s_{\text{ens}}, \hat t_{\text{ens}} \) on the calibration set by comparing the **aggregated** vote to human labels.
- Then apply the single-judge correction from Section 3 using \((\hat s_{\text{ens}}, \hat t_{\text{ens}})\).

### 5.2 Dawid–Skene (probabilistic EM)
- Estimate each judge’s **confusion matrix** without assuming ground truth for every item.  
- EM returns **posterior probabilities** \(P(Y=\text{pass}\mid \mathbf{J})\) per item.  
- The estimated **true success rate** is just the **mean posterior**:

\[
\hat\pi = \frac{1}{N}\sum_{i=1}^N P(Y_i=\text{pass}\mid \mathbf{J}_i).
\]

- This naturally handles **missing judges** and **different reliabilities**.

> **Practical tip:** Even with EM, keep a **small human-labeled calibration set** to anchor the model and to validate that EM doesn’t go off the rails on certain segments.

---

## 6) Beyond pass/fail: Likert scales and thresholds

If your judge outputs a **Likert score** (e.g., 1–5), you typically choose a **threshold** \(\tau\) (e.g., pass if score ≥ 4). Then you can compute \(s,t\) for that threshold and proceed as above.

Alternative: treat the Likert score as a **noisy measurement** of a latent continuous quality. You can fit a simple **ordinal logistic model** against human labels and predict \(P(Y=\text{pass}\mid \text{score})\). The average of those probabilities is again an estimate of \(\pi\).

**Choosing the threshold \(\tau\):**  
- On calibration, sweep \(\tau\) to maximize **balanced accuracy** \(\frac{s+t}{2}\), or to hit a **precision** constraint if false passes are very costly.  
- Record \(\tau\) as part of your **judge version** (5.5).

---

## 7) Segment-aware estimates (recommended for production)

Compute \(\hat\pi\) **per segment** \(g\) (country, channel, language), each with its own \((\hat s_g,\hat t_g)\). Then combine using **production mix weights** \(w_g\) to get an overall estimate:

\[
\hat\pi_{\text{overall}} = \sum_g w_g \,\hat\pi_g, \quad \sum_g w_g = 1.
\]

Bootstrap at the **segment level** by resampling segments or by stratified bootstraps, so variance reflects real traffic composition.

---

## 8) Guardrails & sanity checks

- **Youden’s J must be positive:** \(\hat s + \hat t - 1 > 0\). If not, your judge isn’t adding signal—go back to 5.3–5.5.  
- **Bounds sanity:** If \(\hat\pi\) leaves \([0,1]\), your inputs are inconsistent; investigate data leakage or calibration drift.  
- **Honeypots:** Track the pass-rate of known “obvious pass/fail” items over time; drops indicate judge drift.  
- **Cost/latency:** A judge that is perfect but too slow for CI/CD (Chapter 9) can still block releases.  
- **Adversarial checks:** Re-run verbosity/position/style/refusal probes after any judge update.  
- **Labeling noise:** Human labels aren’t perfect either—use **dual human raters** on calibration and reconcile disagreements.

---

## 9) Decision playbook (copy/paste into your runbook)

1. **Compute raw q:** On your evaluation split, measure raw judge pass-rate \(q\) (with binomial CI).  
2. **Calibrate judge:** On calibration data, estimate \(\hat s, \hat t\) (with CIs), overall and per segment.  
3. **Correct q → \(\hat\pi\):** Apply the bias-correction formula.  
4. **Attach uncertainty:** Run the **parametric bootstrap** that samples both \(q\) and \((s,t)\).  
5. **Gate releases:** Ship only if **CI-lower(\(\pi\)) ≥ target** (overall and in critical segments).  
6. **Report clearly:** Publish a short table with \(\hat\pi\) mean, CI, \(N\), judge version, dataset version, and segments.  
7. **Monitor:** In production, update weekly with fresh samples and re-run steps 1–4.

---

## 10) Worked example (numbers)

- Evaluation set: \(N=1{,}000\), judge passed \(K=740\) → \(q = 0.74\).  
- Calibration (vs human): \(TP=360, FN=40\) → \(\hat s = 0.90\); \(TN=460, FP=140\) → \(\hat t = 0.77\).  
- Correction:

\[
\hat\pi = \frac{0.74 - (1 - 0.77)}{0.90 + 0.77 - 1} = \frac{0.74 - 0.23}{0.67} \approx \frac{0.51}{0.67} \approx 0.761.
\]

So **true success** is ~76.1%, slightly **higher** than raw \(q\) because the judge tends to **false-fail** (FN) more than **false-pass**.

- Bootstrap CI (sketch): After 5,000 draws of \(q^\*, s^\*, t^\*\), the 95% CI is \([0.73, 0.79]\). If your target is 0.75, the **lower bound is 0.73** → **do not ship** yet.

---

## 11) Exercises

1. **Compute correction & CI:** Using your latest validation run, compute \(q\), estimate \((\hat s,\hat t)\) from calibration, and produce a bias-corrected \(\hat\pi\) with a 95% bootstrap CI. Decide whether to release if the target is 80%.  
2. **Segmented estimates:** Repeat Exercise 1 for BR vs. AR and WhatsApp vs. Email. Which segment is the bottleneck?  
3. **Judge ensemble:** Combine two judges (LLM A and LLM B) by majority vote, estimate ensemble \((s,t)\), and recompute \(\hat\pi\). Did variance shrink?  
4. **Threshold tuning:** For a Likert judge (1–5), sweep thresholds \(\tau \in \{3, 4, 5\}\) on calibration, pick \(\tau\) by balanced accuracy, then redo Exercise 1.  
5. **Stretch:** Implement Dawid–Skene EM on a small set with three judges and no human labels for half the items. Compare the posterior-mean \(\hat\pi\) with the simple correction.

---

## Summary

Judges are **measurement instruments**. Like any instrument, they have **error**. If you ignore that error, you’ll make **overconfident** or **biased** decisions. The fix is straightforward: **calibrate** your judge (estimate sensitivity/specificity), **correct** the observed pass-rate, and **quantify uncertainty** that reflects both the judge and your sample. For ensembles, either estimate the aggregate confusion matrix or use **Dawid–Skene** to weight judges by reliability. With these tools, your evaluation numbers reflect **reality**—and in 5.7 we’ll code the estimators to make this automatic in your pipeline.
