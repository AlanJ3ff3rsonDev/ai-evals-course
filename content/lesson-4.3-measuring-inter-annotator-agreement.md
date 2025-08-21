
# Lesson 4.3 — Measuring Inter-Annotator Agreement (IAA)

## 1. Introduction

In the previous lesson (4.2 — Collaborative Annotation Workflow), we explored how multiple annotators can work together in a structured process to produce high-quality evaluation data. But **how do we know if our annotators are consistent and reliable**?

That's where **Inter-Annotator Agreement (IAA)** comes in.

Think of IAA as a **reliability check** for your labeling process. Even if annotators follow the same guidelines, they may interpret them differently. IAA measures how often annotators agree **beyond what would be expected by chance**.

A **high IAA** means annotators interpret the task similarly — your evaluation data is consistent.  
A **low IAA** means there is subjectivity, ambiguity, or unclear guidelines.

---

## 2. Why IAA Matters in LLM Evaluation

In the context of **Large Language Model (LLM) evaluation**, multiple people often rate or label model outputs for correctness, quality, safety, or relevance.  
If annotators disagree too much:
- **Metrics lose meaning** — your scores are noisy.
- **Experiments become unreliable** — improvements might just be random fluctuations.
- **Biases creep in** — subjective judgments could distort results.

IAA helps you:
1. Detect problems in your guidelines or task definitions.
2. Identify annotators who might need more training.
3. Ensure evaluations are **fair, reproducible, and trustworthy**.

---

## 3. Core IAA Metrics

### 3.1 Percent Agreement (Simple but Limited)
The most basic measure — just the proportion of labels where annotators agree.

**Formula:**

$$
\text{Percent Agreement} = \frac{\text{Number of agreements}}{\text{Total items}}
$$

**Example:**  
- 2 annotators label 10 outputs as "Correct" or "Incorrect".  
- They agree on 8 of them.  
- Percent agreement = 8 / 10 = **0.8 (80%)**.

**Limitation:** Doesn’t account for agreement that could happen **by chance**.

---

### 3.2 Cohen’s Kappa (Two Annotators)
Measures agreement between two annotators while correcting for chance.

**Formula:**

$$
\kappa = \frac{P_o - P_e}{1 - P_e}
$$

Where:
- \( P_o \) = observed agreement (like percent agreement).
- \( P_e \) = expected agreement by chance.

**Interpretation:**
- **1.0** → Perfect agreement.
- **0.8 – 1.0** → Almost perfect.
- **0.6 – 0.8** → Substantial.
- **0.4 – 0.6** → Moderate.
- **0.2 – 0.4** → Fair.
- **< 0.2** → Slight.

**Python Example:**

```python
from sklearn.metrics import cohen_kappa_score

annotator1 = ["Correct", "Correct", "Incorrect", "Correct", "Incorrect"]
annotator2 = ["Correct", "Incorrect", "Incorrect", "Correct", "Incorrect"]

kappa = cohen_kappa_score(annotator1, annotator2)
print("Cohen's Kappa:", kappa)
```

---

### 3.3 Fleiss’ Kappa (More than Two Annotators)
Generalizes Cohen’s Kappa for multiple annotators.

**Example Use Case:** 5 annotators each rate the same set of outputs.

**Python Example:**

```python
import numpy as np
from statsmodels.stats.inter_rater import fleiss_kappa

# Each row: counts of ratings per category for an item
# Example: 3 annotators said "Correct", 2 said "Incorrect"
ratings_matrix = np.array([
    [3, 2],
    [4, 1],
    [2, 3],
    [5, 0]
])

kappa = fleiss_kappa(ratings_matrix)
print("Fleiss' Kappa:", kappa)
```

---

### 3.4 Krippendorff’s Alpha (Flexible & Robust)
Works for:
- Any number of annotators.
- Missing data.
- Nominal, ordinal, interval, or ratio data.

**Why it’s powerful:** Handles more complex real-world annotation situations.

**Python Example:**

```python
!pip install krippendorff

import krippendorff

# Example: Matrix with rows = annotators, columns = items
data = [
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 1, 1]
]

alpha = krippendorff.alpha(reliability_data=data)
print("Krippendorff's Alpha:", alpha)
```

---

## 4. Interpreting IAA Scores

**General Guideline (Landis & Koch, 1977):**
| Kappa / Alpha Value | Agreement Strength |
|--------------------|--------------------|
| < 0.00             | Poor               |
| 0.00 – 0.20        | Slight             |
| 0.21 – 0.40        | Fair               |
| 0.41 – 0.60        | Moderate           |
| 0.61 – 0.80        | Substantial        |
| 0.81 – 1.00        | Almost Perfect     |

---

## 5. Integrating IAA into Your Workflow

**Step-by-step:**
1. **Select your metric** (Cohen’s, Fleiss’, Krippendorff’s) depending on annotator count & data type.
2. **Sample a subset** of your annotated data regularly.
3. **Calculate IAA** after major annotation rounds.
4. **Discuss disagreements** in calibration meetings.
5. **Refine guidelines** where disagreements are common.
6. **Recalculate** after training or changes.

---

## 6. Common Pitfalls

- **Small datasets** → IAA can be unstable.
- **Unbalanced labels** → artificially inflate agreement.
- **Overly subjective tasks** → low IAA may be unavoidable.
- **Using only percent agreement** → misleadingly optimistic.

---

## 7. Summary

In this lesson, you learned:
- What IAA is and why it matters.
- How to compute Percent Agreement, Cohen’s Kappa, Fleiss’ Kappa, and Krippendorff’s Alpha.
- How to interpret IAA results.
- How to integrate IAA measurement into collaborative annotation pipelines.

**Next:** We’ll move into **Facilitating Alignment Sessions and Resolving Disagreements (4.4)**, where IAA scores will help guide what to discuss and improve.

---
