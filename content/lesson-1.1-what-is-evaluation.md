
# Lesson 1.1 — What is Evaluation?

Welcome to the first lesson of **AI Evals for Engineers & PMs**. This lesson lays the foundation for everything we’ll cover in the course. By the end of it, you’ll not only have a clear definition of what “evaluation” means in the context of large language models (LLMs) and AI systems, but you’ll also understand **why it matters**, **how it works**, and **how to begin designing your own evaluations**.

Think of this lesson as building your first mental model: a way of framing evaluation that you’ll reuse across prompts, pipelines, and full AI-powered applications.

---

## Learning Objectives

By the end of this lesson, you will be able to:

* **Define evaluation** in a compact, precise way.
* **Explain why evaluation matters** specifically for LLM-based applications.
* **Identify where evaluation attaches** inside an LLM system.
* **Write your first evaluation plan**, including a task statement, rubric, and metric.
* **Distinguish key categories of evaluation**, such as offline vs. online, or code-based vs. judge-based.
* **Recognize and avoid common pitfalls**, such as leaky test sets or vague rubrics.

---

## 1. Why Evaluation Matters (Intuition First)

Imagine entering a dark room filled with furniture. Without a flashlight, you’ll stumble around blindly, tripping over chairs and bumping into walls. That’s what it feels like to develop an AI system without proper evaluation. Failures will emerge only after you’ve deployed, when it’s often too late or too costly to fix them.

Now imagine switching on a flashlight. Suddenly, you can see:

* **What “good” looks like** — the paths you want to follow.
* **Where your system deviates** — the hidden obstacles.
* **How to iterate effectively** — where to focus improvements next.

This flashlight is **evaluation**. It helps you deliberately illuminate your system’s behavior instead of leaving success to chance.

Another analogy: evaluation is the **fusion of unit tests, user research, and analytics**—all tailored for AI. Like unit tests, you specify expectations. Like user research, you check if outputs meet human needs. Like analytics, you measure performance over time. But because AI outputs are open-ended, evaluation requires new tools: structured rubrics and sometimes even using an LLM as a judge.

---

## 2. A Formal Definition of Evaluation

Here’s the one-sentence definition you should memorize:

**Evaluation is the disciplined process of checking whether your system reliably produces the intended behavior under clearly specified conditions, and measuring how well it does so.**

To make this practical, every evaluation includes the following **ingredients**:

* **System (S):** The thing you’re testing (prompt, pipeline, full app).
* **Task (T):** What the system is supposed to do.
* **Inputs (X):** Representative scenarios or test cases.
* **Outputs (Y):** What the system produces.
* **Criteria (C):** The rules that define “good enough.”
* **Metric (M):** A measurable function that translates outputs into scores.
* **Threshold (θ):** The minimum acceptable score.
* **Decision (D):** The action you’ll take based on results.

A compact formula is:

**Evaluation = Intent (C) → Measurement (M) → Decision (D)**

Put simply, evaluation is about turning **intent** into **evidence**.

---

## 3. Where Evaluation Lives in LLM Applications

Modern LLM systems are not monoliths; they are **pipelines**. A single app might include prompts, retrieval steps, tool calls, reasoning chains, and safety filters. Failures can occur at any stage.

You should therefore evaluate at multiple levels:

1. **Prompt or Function level**
   *“Does this prompt reliably return JSON?”*

2. **Component level**
   *“Does the retriever return documents that actually contain the answer?”*

3. **End-to-end system level**
   *“Does the final user-facing response meet policy requirements and solve the user’s problem?”*

4. **Guardrails and Safety**
   *“Does the system block toxic outputs without blocking safe ones?”*

5. **Operational level**
   *“Does the system stay within latency and cost budgets under real-world load?”*

The key lesson: don’t just measure vague “end-to-end vibes.” Keep instrumentation so you know **where in the pipeline the failure occurred**.

---

## 4. What Counts as “Good”? Designing a Success Rubric

Unlike classical software, “correct” in LLM systems is rarely a single string. Instead, we rely on **rubrics**—short checklists that judges (human or model) can apply consistently.

For example, imagine a **retrieval-augmented generation (RAG)** bot that answers policy questions. A good rubric could be:

* **Grounding:** All claims are backed by retrieved documents.
* **Completeness:** The main question is fully answered.
* **Faithfulness:** No fabrications beyond retrieved sources.
* **Safety & Compliance:** No leaks of sensitive data; policy rules respected.
* **Format & Helpfulness:** Clear, structured, and actionable.

Each rubric item can be scored **0/1** (fail/pass) or on a **Likert scale (0–3)**. The overall score might be an average or weighted sum.

👉 **Tip:** Keep rubrics **short (3–7 bullets), concrete, and domain-specific**. If your rubric is vague, your evaluation will be noisy and unhelpful.

---

## 5. Types of Evaluation

Evaluations can be categorized along three key dimensions:

### A. When You Measure

* **Offline:** Run tests before deployment on a fixed dataset. Fast, reproducible, and good for iteration.
* **Online:** Measure in production with real users (A/B tests, live monitoring). The only true measure of long-term impact.

### B. How You Measure

* **Code-based metrics:** Objective checks like regexes, JSON validity, numeric matches, latency.
* **Judge-based metrics:** Subjective checks by human raters or LLM-as-judge applying your rubric.

### C. What You Measure

* **Task success:** Did it solve the problem?
* **Quality & UX:** Tone, helpfulness, formatting.
* **Safety & Compliance:** Toxicity, PII handling, policy adherence.
* **Robustness:** Performance under paraphrases, long contexts, edge cases.
* **Cost & Latency:** Time and money budgets.
* **Fairness:** Consistency across user segments.

In reality, you’ll balance multiple objectives simultaneously (success vs. cost vs. safety).

---

## 6. Concrete Mini-Examples

Let’s make this real with three examples:

### Example 1: JSON Extraction Tool

* **Task:** Extract `{total_amount_cents, due_date}` from invoices.
* **Inputs:** 500 real invoices across vendors and formats.
* **Rubric:**

  * JSON parses correctly.
  * `total_amount_cents` within ±1 cent.
  * `due_date` within ±1 day.
* **Threshold:** ≥ 98% accuracy per vendor segment.
* **Decision:** Ship only if every segment clears threshold.

### Example 2: Policy-Answering RAG Bot

* **Task:** Answer merchant policy questions.
* **Rubric:** Grounding, completeness, faithfulness, safety, formatting.
* **Metric:** LLM-as-judge (0–3 per item).
* **Ops Gates:** Latency < 2s (median), < 4s (p95).
* **Decision:** Don’t ship if latency budget fails, even if quality is good.

### Example 3: Chargeback Reason Classifier

* **Task:** Classify dispute reason codes.
* **Metric:** Macro-F1 + weekly consistency.
* **Guardrail:** Manual audit of top-loss merchants; alert if drift > 8%.

---

## 7. How to Build a Minimal Evaluation (Template)

Every evaluation you design should include:

1. **Task Statement**
2. **User/Business Goal**
3. **Representative Inputs**
4. **Success Rubric**
5. **Metric Definition**
6. **Thresholds & Budgets**
7. **Test Design**
8. **Failure Taxonomy**
9. **CI Plan**
10. **Logging Plan**

👉 Rule of thumb: Start with **100–300 examples per key segment**. Expand later.

---

## 8. Judge Prompts & Reliability

When using LLMs as judges, reliability is critical.

**Best practices:**

* Write explicit instructions with positive and negative examples.
* Use structured outputs (e.g., JSON with scores).
* Set temperature = 0 for determinism.
* Calibrate against a gold set (50–100 human-labeled cases).
* Accept some imperfection—what matters is **consistency**.

---

## 9. Offline vs. Online Evaluation Lifecycle

A healthy evaluation workflow looks like this:

1. Collect traces.
2. Build offline datasets.
3. Iterate offline.
4. Deploy behind a flag.
5. Run online A/B testing.
6. Expand datasets with new failure cases.
7. Automate offline eval in CI to prevent regressions.

---

## 10. Common Pitfalls

* **Vague rubrics:** Always write clear, concrete items.
* **Leaky test sets:** Keep a frozen holdout set.
* **Metric theater:** Don’t measure for the sake of optics—tie metrics to real decisions.
* **Overreliance on averages:** Segment your data.
* **Ignoring latency/cost:** Track p95/p99, not just averages.
* **No failure taxonomy:** Tagging errors helps you fix them.
* **Judge drift:** Recalibrate periodically.
* **No reproducibility:** Fix seeds, snapshot prompts, version datasets.

---

## 11. Evaluation Checklist (For PRs)

Before shipping, confirm:

* [ ] Task statement written.
* [ ] Representative dataset created.
* [ ] Rubric agreed with PM/Eng.
* [ ] Metrics implemented.
* [ ] Thresholds set; CI blocks failures.
* [ ] Failure taxonomy in place.
* [ ] Prompts and seeds versioned.
* [ ] Online A/B plan ready.

---

## 12. Hands-On Micro-Exercise

**Your Turn:** Imagine you’re building an AI assistant that writes **WhatsApp follow-ups to debtors**.

* **Task:** Draft a persuasive, compliant follow-up.
* **Rubric:** Grounding, completeness, safety, tone, format.
* **Metric:** LLM-as-judge scoring (0–3).
* **Dataset:** 150 conversations, 3 debtor personas.
* **Thresholds:** Average ≥ 2.7, no safety item < 2, latency < 3.5s.
* **Decision:** Ship only if all personas clear the bar.

If you can write these six items clearly, you already know how to evaluate.

---

## 13. Key Takeaways (TL;DR)

* **Evaluation = intent → measurement → decision.**
* Define “good” using rubrics.
* Evaluate at multiple pipeline levels.
* Combine offline (iteration) and online (truth).
* Avoid pitfalls like vague rubrics, leaky sets, or ignoring cost.

---

## Optional Further Reading

* Classic metrics: EM, F1, ROUGE, BLEU.
* Preference-based evaluations: win-rates, Elo scores.
* Emerging methods: simulation environments, counterfactual robustness.

---

**End of Lesson 1.1 — What is Evaluation?**

