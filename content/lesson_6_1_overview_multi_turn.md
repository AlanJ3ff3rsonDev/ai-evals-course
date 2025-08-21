# Lesson 6.1 — Evaluating Multi‑Turn Conversations: Overview & Game Plan

> **Where we are:** Chapter 6 extends everything you learned in Chapter 5 to **dialogues**. You already know how to design metrics, build judges, create leakage‑safe splits, correct for imperfect judges, and bootstrap uncertainty. Now we’ll apply these tools to **conversations** where quality depends on **sequences of turns**, **state**, and **tools**.
>
> **This lesson (Overview):** establish concepts, schemas, and a step‑by‑step plan for evaluating multi‑turn systems. Concrete automation patterns and code come in 6.2–6.4.

---

## Learning objectives

By the end, you will be able to:

1. Describe why multi‑turn evaluation is different from single‑turn and what can go wrong if you treat it the same.  
2. Define a **conversation data model** (events, turns, state) that makes evaluation easy rather than painful.  
3. Choose **evaluation axes** at three granularities—turn, sub‑task, and conversation—mapping each to metrics and judges.  
4. Design **goal specs** and **success criteria** for end‑to‑end conversations (including tool use).  
5. Plan leakage‑safe **splits**, **bootstrap strategy**, and **reporting** for multi‑turn.  
6. Prepare for automation: what to implement in 6.2 (practical strategies) and 6.3 (automated evaluation of traces).

---

## 1) Why multi‑turn is different (and harder)

A conversation is not just more text. New failure modes appear:

- **State & memory:** the assistant must remember facts and constraints across turns (amounts, deadlines, names, policy limits).  
- **Long‑horizon goals:** the outcome depends on a chain of actions (ask clarifying Q → retrieve → propose next step → confirm).  
- **Tool use:** the agent may call tools (search, CRM, payment), and the *sequence* of tool results affects success.  
- **Recovery & repair:** good agents make and then *fix* mistakes. Your metrics must recognize successful repair rather than only first‑shot accuracy.  
- **User steering:** users change goals mid‑stream; the agent should negotiate scope, not stubbornly follow the old plan.  
- **Safety drift:** safe at turn 1, unsafe by turn 6 (e.g., privacy leakage after accumulating PII).

**Takeaway:** treat a conversation as a **structured process**—with *events*, *state transitions*, and *checkpoints*—not just a blob of text.

---

## 2) The conversation data model (make eval simple by design)

A good schema makes 80% of evaluation trivial. Use an **event‑sourced** structure:

```
Conversation
  id, segment (country, language, channel), scenario_id
  events: [
    {type: "user_msg",   turn: 1, text, timestamp},
    {type: "assistant_msg", turn: 1, text, meta: {tool_suggestions, safety_flags}},
    {type: "tool_call",  turn: 2, name, args, request_payload},
    {type: "tool_result",turn: 2, name, result_payload, status},
    ...
  ]
```

Add a **derived state** object you can compute from events at any time:

```
DerivedState (after each event)
  known_facts: {debtor_name, amount_due, due_date, ...}
  constraints: {policy: {discount<=10%, channel="WhatsApp"}, user_prefs: {language="pt-BR"}}
  outstanding_questions: [...]
  progress: {goal_defined, plan_proposed, confirmation_obtained, ...}
  safety: {pii_shared=false, policy_violations=[]}
```

Why this matters: many automated checks (6.3) become simple **rules over state** (e.g., “No message should reveal PII unless user provided it earlier”).

> **Tip:** Store **scenario_id** to group similar conversations, and **group_id=thread_id** for leakage‑safe splits.

---

## 3) Granularities of evaluation (three layers)

To keep evaluation explainable, separate **what** you score at each layer.

### A. Turn‑level (local quality)
- **Instruction following:** Did the agent answer the user’s *latest* question?  
- **Faithfulness to state:** Are facts consistent with `DerivedState` and tool results?  
- **Tone & safety:** Clear, respectful, policy‑compliant, no unsafe content.  
- **Actionability:** Does the turn move the conversation forward (ask a crisp question, propose a step)?

**How to measure:** LLM‑as‑judge with a short rubric (5.3 style) + must‑pass safety checks. For faithfulness, pass the *relevant slice* of `DerivedState` and recent tool results.

### B. Sub‑task or step‑level (procedural quality)
- **Clarification step success:** Did the agent ask the necessary disambiguation questions?  
- **Tool plan execution:** Were tools called in a reasonable order with correct arguments?  
- **Constraint tracking:** Did the agent respect policy/limits at each step?  
- **Repair behavior:** If an error occurred, did the agent detect and fix it within `k` turns?

**How to measure:** Rule‑based checkers over events and state transitions, plus LLM‑as‑judge for subjective “reasonableness”.

### C. Conversation‑level (outcome quality)
- **Goal completion:** Was the defined goal achieved (e.g., *obtain a promise‑to‑pay* or *provide a correct plan*)?  
- **Efficiency:** Turns to success, tool calls to success, latency budget.  
- **Consistency:** No contradictions; consistent persona across turns.  
- **User experience:** Did the agent confirm, summarize decisions, and close politely?

**How to measure:** A single **conversation judge** that reads a concise **trace digest** (not the full raw log), plus deterministic outcome checks (e.g., `progress.goal_completed=true`).

---

## 4) Goal specification & success criteria (make it checkable)

Create a **Scenario Spec** for each conversation archetype. Keep it declarative so code can execute it.

```
ScenarioSpec
  id: "first_message_to_debtor_pt"
  goal: "Send the first outreach message with correct amount and due date; offer two payment paths; avoid legal threats."
  preconditions:
    required_facts: ["debtor_name", "amount_due", "due_date"]
    tools_allowed: ["crm_lookup", "payment_links"]
  success_criteria:
    must_pass:
      - "no_policy_violations"
      - "mentions_amount_due_exactly_once"
      - "offers_at_least_two_paths"
    rubric (1–5):
      faithfulness: anchors...
      helpfulness: anchors...
      tone: anchors...
    outcome_flag: "message_sent_to_user"   # from events
  stop_conditions:
    - "user_requests_handoff"
    - "k_inactive_turns=3"
```

With a clear `ScenarioSpec`, you can compute deterministic **must‑pass** outcomes and only use a judge where human nuance is needed.

---

## 5) Metrics catalogue for multi‑turn (what to report)

### Outcome & efficiency
- **Goal completion rate** (bias‑corrected true success, §5.6–5.7)  
- **Turns to goal**, **tool calls to goal**, **latency to goal** (median + CI)  
- **Restart/repair rate** (fraction of cases where the agent fixed its own error)

### Process & behavior
- **Constraint adherence rate** (policy, brand, legal)  
- **State accuracy** (no contradictions vs. `DerivedState` across turns)  
- **Clarification sufficiency** (asked all required disambiguation questions before acting)  
- **Selector quality** (if multiple candidate replies are generated, 5.8 style)

### Experience & safety
- **Tone & professionalism** (1–5)  
- **Safety pass** (policy checklist per turn and global)  
- **Closing quality** (confirmation + next steps + summary)

> **Always attach CIs** and show **segment breakdowns** (country, language, channel). Bootstrap **by conversation** (not by turn).

---

## 6) Splits & sampling (leakage and power)

Use **group‑aware** splits with `group_key=conversation_id` (or `thread_id`) and **stratify** by scenario, language, channel, and difficulty. Recommended roles:

- **Design**: open book for prompt crafting and rule writing.  
- **Calibration**: human labels for turn‑ and conversation‑level judges; compute `(s,t)` per axis.  
- **Validation**: pick among judge prompts and state rules.  
- **Test**: touch once per release.  
- **Monitoring**: weekly sample of fresh conversations from prod.

**Sampling for power:** Because conversations are longer and more variable, you usually need **fewer conversations** than single‑turn items, but ensure you have enough per segment (e.g., at least 40–50 per critical cell) to compute CIs that separate candidates.

---

## 7) Judges for conversations (pattern library)

### A. Turn judge (lightweight)
Prompt reads only the **last user message**, the **assistant turn**, and a **state snippet** (relevant facts / evidence IDs). Outputs 1–5 scores + must‑pass flags. Keeps cost low.

### B. Step judge (plan/tool reasoning)
Prompt reads a **compact trace digest** (list of tool calls and results) and evaluates **reasonableness**, **argument correctness**, and **repair** behavior.

### C. Conversation judge (global outcome)
Prompt reads **ScenarioSpec**, **final state summary**, and a **short turn digest** (e.g., 5–10 bullet events). Asks: *Was the goal achieved? Was the path acceptable?*

> Keep each judge **short**, **anchored**, and **JSON‑only** (5.3). Calibrate `(s,t)` per judge against human labels (5.6).

---

## 8) Trace digestion (so judges stay cheap and robust)

Never feed raw logs spanning thousands of tokens. Instead, produce a **digest** per conversation:

- **Facts timeline**: `T1: amount_due=R$420; T3: due_date=2025‑08‑20`  
- **Decision points**: `clarified language=pt‑BR; user chose boleto`  
- **Tool summary**: `crm_lookup(ok); payment_link(created)`  
- **Red flags**: `attempted discount>10% (blocked)`  
- **Final outcome**: `goal_completed=true; message_sent=true`

Digests make judges cheap, limit leakage, and stabilize across small prompt edits.

---

## 9) Reporting & visualization (make it readable)

Your report (HTML/Notebook) should include:

1. **Outcome table**: goal completion (true success with CI), by segment.  
2. **Efficiency table**: turns/tool calls/latency, medians with CIs.  
3. **Safety & constraint**: must‑pass rates, with links to failing examples.  
4. **Behavioral diagnostics**: clarification sufficiency, repair rate, state contradictions.  
5. **Example viewer**: pick any conversation to see the digest, judge JSON, and raw trace (for root‑cause).

All numbers must show **judge version** and **dataset snapshot** (5.5).

---

## 10) Worked example (collections domain, condensed)

**Scenario:** “First outreach conversation” (2–5 turns).

**Success**: Agent sends a correct, polite, on‑brand first message with accurate amount & due date; offers two payment paths; no legal threats.

**Evaluation plan:**  
- **Turn‑level:** Judge tone & instruction following for each assistant turn (scores 1–5).  
- **Step‑level:** Rule checker ensures *clarify language if unknown*, *fetch CRM*, *compose message only after facts are known*, *no discount>10%*.  
- **Conversation‑level:** Conversation judge reads the digest and decides *goal_completed* (pass/fail) + rubric (helpfulness, faithfulness).  
- **Outcome metrics:** True success (bias‑corrected), turns to goal, safety pass rate.  
- **Diagnostics:** Repair rate (if tool failed once, did the agent recover?), contradictions (facts changed incorrectly), and closing quality.

**Why this works:** you score **local quality** (turns), **procedure** (steps), and **outcome**—and you can explain failures quickly.

---

## 11) How this connects to Chapter 5 (continuity map)

- **Data splits (5.4)** → use `group_key=conversation_id`.  
- **Judge iteration (5.5)** → refine turn/conversation judges with bias probes (verbosity, position).  
- **Imperfect judges (5.6–5.7)** → calibrate each judge axis and correct pass‑rates.  
- **Group metrics (5.8)** → a conversation is the **group unit**; bootstrap by conversation.  
- **Pitfalls (5.9)** → guard against *double‑dipping* when you use a judge to select a reply and the same judge to evaluate it.

---

## 12) What we will build next (preview of 6.2–6.4)

- **6.2 Practical strategies:** concrete patterns like *state tables*, *checklists for clarification*, *repair timers*, *turn budgets*, and *conversation digests*. You’ll see ready‑to‑copy rubrics for turn/step/conversation judges and a “conversation spec” template.  
- **6.3 Automated evaluation of multi‑turn traces:** Python that ingests event logs, constructs `DerivedState`, runs rule‑based checks, calls judges, aggregates metrics, and outputs reports with CIs (using the same bootstrap patterns as 5.7–5.8).  
- **6.4 Addressing common pitfalls:** multi‑turn‑specific issues such as **looping**, **goalpost shifts**, **tool thrashing**, **forgetting earlier facts**, and **unsafe accumulations** of PII—with diagnostics and fixes.

---

## Exercises

1. **Sketch a ScenarioSpec** for one of your conversation types. List `required_facts`, `tools_allowed`, `success_criteria`, and `stop_conditions`.  
2. **Define your DerivedState.** Write the dictionary keys you need to track (facts, constraints, outstanding questions, safety flags). Keep it minimal.  
3. **Draft rubrics.** Create a 6–10 line rubric for a *Turn judge* and a short outcome rubric for a *Conversation judge*.  
4. **Design your splits.** Decide stratification axes (scenario, language, channel). Pick a seed, and define how many conversations you need per segment for stable CIs.  
5. **Pick 3–5 diagnostics** you will always report (e.g., repair rate, clarification sufficiency, contradiction rate).

---

## Summary

Multi‑turn evaluation = **process evaluation**. Model quality is not a single score; it is *the sequence*: how the agent clarifies, uses tools, respects constraints, repairs mistakes, and lands the goal—safely and politely. The key is to **structure** conversations (events → state), evaluate at **three layers** (turn, step, conversation), use **clear goal specs**, and reuse Chapter 5’s machinery (splits, judges, CIs, group bootstrap).

In **6.2** we’ll turn this plan into practical strategies and ready‑made rubrics you can paste into your project.
