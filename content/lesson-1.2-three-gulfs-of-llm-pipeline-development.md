# AI Evals for Engineers & PMs  
## Lesson 1.2 — The Three Gulfs of LLM Pipeline Development

> **Plain definition:** *The “three gulfs” are the major gaps between what you imagine your LLM system should do and what it actually does in the real world. Evaluation acts as the bridge.*

These gulfs appear whether you’re writing a single prompt or orchestrating a multi-step, tool-using, retrieval-augmented agent. Understanding them lets you design **evaluations that surface hidden problems before your users do**.

---

### Learning Objectives

By the end, you should be able to:

1. Name and explain the **three gulfs** in your own words.  
2. Recognize symptoms of each gulf in real projects.  
3. Map evaluation strategies to each gulf.  
4. Understand why skipping one gulf often makes the others worse.  
5. Apply the gulfs framework to design safer, faster iteration loops.

---

## 1) The metaphor: three “gulfs” = three dangerous gaps

In cognitive psychology and HCI, “gulfs” describe **distances between the mind of the user and the behavior of the system**. Here, we adapt the idea to LLM product development.

In LLM pipelines, you (PM/engineer) are trying to:

1. **Imagine** the desired user experience and system behavior.  
2. **Implement** a pipeline (prompts, models, retrieval, tools) that produces it.  
3. **Ship** it to the real world where real users, inputs, and constraints stress it.

Between these stages are gulfs—gaps where your intentions can leak away.

**The three gulfs:**

1. **Gulf of Specification** — translating *intent* into precise, testable *system behaviors*.  
2. **Gulf of Implementation** — getting the pipeline to actually perform those behaviors on representative inputs.  
3. **Gulf of Reality** — keeping those behaviors reliable in the messy, changing real world.

---

## 2) Gulf 1 — The Gulf of Specification

**Definition:** The gap between what stakeholders *mean* by “success” and the explicit, testable criteria engineers and evaluators can measure.

**Symptoms:**  
- Vague requirements like “make it sound friendly” without examples.  
- PM says “it should answer accurately,” but accuracy isn’t defined for ambiguous cases.  
- Disagreements in design reviews about whether an output is “good.”

**Why it matters:** If you can’t measure it, you can’t reliably improve it. A vague spec → vague eval → false confidence.

**Bridging it with evaluation:**  
- Co-create **success rubrics** early with PM, engineering, design, compliance.  
- Use **example-based alignment**: show good, borderline, and bad outputs.  
- Decide **weights** for different rubric items (e.g., safety > style).  
- Lock the rubric before heavy iteration—changing it midstream can hide regressions.

**Mini-case:**  
PM: “We want our collections agent to be persuasive.”  
Bad spec: “Make it polite but firm.”  
Bridged spec: “Tone scored ≥ 2.7/3 by LLM-as-judge on friendliness and firmness rubric; refusal to offer unauthorized payment plans.”

---

## 3) Gulf 2 — The Gulf of Implementation

**Definition:** The gap between your precise spec and the system’s actual outputs during development.

**Symptoms:**  
- Passing trivial unit tests but failing on realistic, messy cases.  
- Model works on English examples but fails on Spanish inputs.  
- Retrieval finds documents, but the generator ignores them.  
- Tool-calling fails silently on certain edge cases.

**Why it matters:** It’s easy to get “happy path” success and miss catastrophic failure modes.

**Bridging it with evaluation:**  
- Use **representative datasets** (covering all key segments).  
- Evaluate **components** (retrieval, reasoning, formatting) separately.  
- Do **error analysis** to find failure patterns; add them back to the dataset.  
- Automate CI to catch regressions before merge.

**Mini-case:**  
Spec: “JSON parser extracts due date correctly.”  
Gap: Works on 90% of clean emails; fails if month is written in words (“March”).  
Bridge: Add natural language month examples to the test set; track separate accuracy for them.

---

## 4) Gulf 3 — The Gulf of Reality

**Definition:** The gap between performance in your lab/dev environment and performance in real-world deployment.

**Symptoms:**  
- Performance drops on unseen topics, slang, or adversarial inputs.  
- Latency spikes under peak traffic.  
- Costs blow up with longer-than-expected inputs.  
- Regulatory or compliance violations triggered by corner cases.  
- Users behave in unexpected ways (feeding irrelevant or tricky prompts).

**Why it matters:** Lab-perfect systems fail in production without adaptation.

**Bridging it with evaluation:**  
- Deploy **online monitors** for safety, latency, cost, and key quality metrics.  
- Run **A/B tests** to measure business impact vs control.  
- Periodically **refresh datasets** with real production traces.  
- Audit **segment performance** (by geography, language, user type).

**Mini-case:**  
Spec & dev pass: Merchant FAQ bot answers 98% accurately offline.  
Reality gap: In production, slang and typos reduce retrieval recall, dropping success to 84%.  
Bridge: Mine production queries weekly → add to training/eval set → retrain retriever.

---

## 5) How the gulfs interact (and hurt you)

- If **Gulf 1** is wide, you can “succeed” in dev but still fail user/business needs.  
- If **Gulf 2** is wide, your spec is fine, but your implementation doesn’t meet it.  
- If **Gulf 3** is wide, your lab success collapses in production.

Skipping evaluation for one gulf usually **widens the others**. For example:  
- Poor specification → vague eval → no signal during dev → bigger reality gap later.  
- No implementation-level eval → ship with hidden bugs → production trust loss.

---

## 6) Designing evaluation across gulfs

Think of **three evaluation layers**, mapped to the gulfs:

| Gulf | Risk | Evaluation Focus | Example Metric |
|------|------|------------------|----------------|
| Spec | Misaligned goals | Success rubrics, examples, weighting | Judge score ≥ 2.5/3 |
| Impl | Broken behaviors in dev | Component tests, CI, failure taxonomy | JSON parse rate ≥ 99% |
| Reality | Drift, cost, safety in prod | Online monitors, A/B | Win-rate vs control, p95 latency |

> **Tip:** Make a 3×3 matrix of gulfs vs product priorities—fill in what you’ll measure for each.

---

## 7) Concrete walk-through: CollectAI case

**Spec gulf:**  
Initial idea: “Agent persuades debtors to visit office.”  
Bridge: Added rubric on compliance, tone, factual accuracy, and call-to-action clarity.

**Implementation gulf:**  
Early prompt failed for debtors with partial payment history.  
Bridge: Added scenarios with partial payments to eval set; created specialized prompt for those.

**Reality gulf:**  
In production, older debtors received SMS with garbled accents in names.  
Bridge: Added production text encoding cases to CI; upstream fix in SMS gateway.

---

## 8) Practical checklist

- [ ] Have we **written** and agreed on a **success rubric**? (Spec gulf)  
- [ ] Does our dataset **cover real segments and edge cases**? (Impl gulf)  
- [ ] Do we have **component-level** and **end-to-end** metrics? (Impl gulf)  
- [ ] Is there a plan for **online monitoring** after ship? (Reality gulf)  
- [ ] Are we **closing the loop** by feeding prod failures into offline eval? (All gulfs)

---

## 9) Key takeaways

- **Three gulfs** = gaps from *intent → lab → reality*.  
- Each gulf needs its **own evaluation bridge**.  
- Neglecting one gulf can sabotage the others.  
- Evaluation is not just post-launch QA—it’s an **engineering discipline** that starts at the first spec conversation.

---

*End of Lesson 1.2 — The Three Gulfs of LLM Pipeline Development*

