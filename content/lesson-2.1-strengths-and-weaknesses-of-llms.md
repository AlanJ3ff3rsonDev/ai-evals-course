# AI Evals for Engineers & PMs  
## Lesson 2.1 — Strengths and Weaknesses of LLMs

> **Plain definition:** *Large Language Models (LLMs) are powerful text generators that can reason, summarize, and interact in natural language, but they also have predictable weaknesses that make evaluation essential.*

Before we design evaluations for LLM-based systems, we must understand **what LLMs are good at** and **where they tend to fail**. This knowledge lets you anticipate likely failure modes and build targeted evaluations.

---

### Learning Objectives

By the end, you should be able to:

1. Describe the key strengths of LLMs and why they enable new product capabilities.  
2. Explain the common weaknesses of LLMs and why they occur.  
3. Map each weakness to evaluation strategies that can detect it.  
4. Recognize how strengths and weaknesses interact in real applications.

---

## 1) Strengths of LLMs

### Strength 1 — **Versatility in language tasks**
- Can handle summarization, translation, reasoning, classification, and creative generation with a single model.  
- This is possible because LLMs are trained on a **broad distribution of text** covering many domains.

**Example:**  
The same model can write a persuasive debt collection message, translate it to Spanish, and answer follow-up questions about the payment plan—all without retraining.

---

### Strength 2 — **Few-shot and zero-shot learning**
- Can generalize to new tasks with **no** or **minimal examples** in the prompt.  
- This allows rapid prototyping without large labeled datasets.

**Example:**  
Give the model a few examples of dispute reasons, and it can classify new ones reasonably well without additional training.

---

### Strength 3 — **Natural interaction**
- Can interpret and respond to natural, unstructured human input.  
- Reduces the need for strict templates or rigid UI flows.

**Example:**  
A support chatbot can handle “My package hasn’t arrived yet, what’s going on?” without the user picking from a menu.

---

### Strength 4 — **Contextual adaptation**
- Can adjust tone, style, and detail level when instructed.  
- Supports personalization and brand voice alignment.

**Example:**  
Agent can be instructed to sound “polite but firm” or “friendly and empathetic” depending on customer profile.

---

### Strength 5 — **Multi-step reasoning (sometimes)**
- Can chain together reasoning steps to solve complex problems—when guided well.  
- Works best when prompt design or system architecture encourages explicit reasoning.

**Example:**  
Can read contract text, extract key clauses, then summarize them for a business user.

---

## 2) Weaknesses of LLMs

### Weakness 1 — **Hallucination**
- Generates plausible-sounding but incorrect information.  
- Caused by predicting the “most likely next token” without guaranteed grounding in facts.

**Example:**  
Makes up a policy clause that doesn’t exist in your documentation.

**Evaluation strategy:**  
- Rubric item for factual grounding.  
- LLM-as-judge or human check against source documents.  
- Exact match / string search in retrieval outputs.

---

### Weakness 2 — **Lack of true understanding**
- No internal model of the world; relies on statistical patterns.  
- Can be tripped up by carefully crafted or adversarial prompts.

**Example:**  
Fails to detect that “I didn’t receive my order” and “My order never arrived” mean the same thing.

**Evaluation strategy:**  
- Paraphrase robustness tests.  
- Adversarial example generation.

---

### Weakness 3 — **Context window limits**
- Can only “see” a fixed amount of text (context window).  
- Relevant information outside that window is ignored.

**Example:**  
For long chat histories, may forget commitments made earlier.

**Evaluation strategy:**  
- Test with varying input lengths.  
- Measure recall of facts from early in the context.

---

### Weakness 4 — **Inconsistent outputs**
- Same input may yield different results across runs (due to randomness).  
- Especially risky for compliance-critical tasks.

**Example:**  
Sometimes includes prohibited payment terms, sometimes doesn’t.

**Evaluation strategy:**  
- Run multiple trials; measure variance.  
- Reduce temperature in generation.

---

### Weakness 5 — **Bias and unfairness**
- Reflects biases in training data (e.g., stereotypes, cultural skew).

**Example:**  
Unequal performance for customer queries in different dialects.

**Evaluation strategy:**  
- Segment performance analysis.  
- Bias-specific test sets.

---

### Weakness 6 — **Dependency on prompt quality**
- Small wording changes can drastically affect performance.

**Example:**  
“List payment options” works, but “Can you tell me how I can pay?” fails to include all options.

**Evaluation strategy:**  
- Prompt robustness tests (multiple paraphrases).  
- Continuous prompt tuning.

---

### Weakness 7 — **Operational unpredictability**
- Vendor model updates, latency spikes, and cost changes can happen without warning.

**Example:**  
An API update changes how JSON is formatted, breaking downstream parsing.

**Evaluation strategy:**  
- Continuous monitoring.  
- Version pinning where possible.

---

## 3) How strengths and weaknesses interact

- **Versatility** enables rapid prototyping, but **hallucination** means you can’t trust outputs blindly.  
- **Natural interaction** boosts UX, but **prompt sensitivity** means you must test multiple phrasings.  
- **Few-shot learning** speeds development, but **inconsistency** can break trust in production.

This interplay means you can’t evaluate only one dimension—your eval plan must cover **both the good and the bad**.

---

## 4) Practical checklist

- [ ] Have we mapped likely strengths and weaknesses for our use case?  
- [ ] Do we have evaluation cases targeting each major weakness?  
- [ ] Are we measuring strengths to ensure they persist across iterations?  
- [ ] Are robustness and fairness part of our evaluation set?

---

## 5) Key takeaways

- LLMs are **general-purpose language tools** with impressive flexibility.  
- Their weaknesses are **predictable** and can be systematically evaluated.  
- Strong evaluation focuses as much on **preventing failures** as on **measuring successes**.

---

*End of Lesson 2.1 — Strengths and Weaknesses of LLMs*

