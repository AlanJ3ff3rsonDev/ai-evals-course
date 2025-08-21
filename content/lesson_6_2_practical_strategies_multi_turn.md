# Lesson 6.2 — Practical Strategies for Multi‑Turn Evaluation

> **Position in course:** Chapter 6 (“Evaluating Multi‑Turn Conversations”)  
> **Previously (6.1):** You learned the concepts: event‑sourced conversation logs, `DerivedState`, three layers of evaluation (turn, step, conversation), ScenarioSpecs, and group‑level bootstrapping.  
> **This lesson (6.2):** A **practical playbook**: ready‑to‑use rubrics, checklists, state tables, and automation patterns you can paste into your project **today**. In 6.3 we’ll wire these into an automated evaluator that consumes raw traces.

---

## Learning objectives

By the end of this lesson you will be able to:
1. Design a **ScenarioSpec** and a **DerivedState** table that make evaluation trivial.  
2. Apply **gating strategies** (clarification, policy, tool use) that turn messy logs into checkable events.  
3. Use **ready‑made rubrics** for turn, step, and conversation judges (short, anchored, JSON‑only).  
4. Detect multi‑turn failure modes—**looping**, **contradictions**, **tool thrashing**, **unsafe accumulation**—with tiny rules.  
5. Produce a **conversation digest** that is cheap for judges and rich enough for humans.  

---

## 1) Conversation design that is easy to evaluate

Do yourself a favor: design the conversation system so that **good behavior leaves footprints** that evaluators can read.

### 1.1 ScenarioSpec (copy/paste template)

```yaml
id: "collections_first_message_pt"
goal: "Send a compliant first outreach with correct amount and due date; offer two payment paths; no legal threats."
preconditions:
  required_facts: ["debtor_name", "amount_due", "due_date"]
  tools_allowed: ["crm_lookup", "payment_link_create"]
  languages_allowed: ["pt-BR", "es-AR"]
success_criteria:
  must_pass:
    - "no_policy_violations"
    - "mentions_amount_due_exactly_once"
    - "offers_at_least_two_paths"
  rubric:
    faithfulness: "1=fabricates or contradicts CRM; 3=mostly grounded; 5=every claim traceable to CRM/tool results"
    helpfulness:  "1=off-topic; 3=partially addresses; 5=clear next steps, resolves user's ask"
    tone:         "1=impolite; 3=neutral; 5=polite, on-brand, respectful"
  outcome_flag: "message_sent"
stop_conditions:
  - "user_requests_handoff"
  - "k_inactive_turns: 3"
```

### 1.2 DerivedState (table shape)

Design a **single source of truth** you can compute after each event.

| key | value | source | turn | last_updated | provenance |
|---|---|---|---|---|---|
| amount_due | 420.00 | crm_lookup.result.amount | 2 | T2 | tool_result#123 |
| due_date | 2025‑08‑20 | crm_lookup.result.due_date | 2 | T2 | tool_result#123 |
| language | pt‑BR | user_msg.text.lang | 1 | T1 | lang_detector |
| policy.discount_max | 0.10 | config | 0 | T0 | policy_v1 |

Maintain companion maps: `constraints`, `outstanding_questions`, `safety_flags`, and a `tool_index` of calls and results. You’ll build these in 6.3 with a tiny reducer.

**Tip:** canonicalize values (dates, currency) so string comparisons are trivial.

---

## 2) Gating strategies that reduce chaos

Gates are **boolean rules** that must be cleared before certain actions. They keep conversations orderly and make evaluation unambiguous.

### 2.1 Clarification gates
- **Rule:** Don’t act until required facts are known.  
- **Checker:** before an assistant action “compose_first_message”, assert all `preconditions.required_facts` are in `DerivedState`.  
- **Metric:** *Clarification sufficiency* (fraction of conversations that satisfied the gate **before** acting).  
- **Judge aid:** a turn rubric item “Actionability” (did the reply move the goal forward *appropriately* given known facts?).

### 2.2 Policy gates
- **Rule:** If the user requests something outside policy (e.g., discount > 10%), the agent must **refuse politely with alternatives**.  
- **Checker:** if `requested_discount > policy.discount_max` and the assistant proposes a higher discount → **violation**.  
- **Judge aid:** include a **positive refusal anchor** (reward safe refusals).

### 2.3 Tool‑use gates
- **Order gate:** Must call `crm_lookup` before composing a payment plan.  
- **Args gate:** Tool arguments must be **consistent** with DerivedState (e.g., `debtor_id`, not a name string).  
- **Budget gate:** Max `n_tool_calls` per scenario (avoid thrashing). Emit a `tool_thrashing` flag if exceeded.

> Gates convert “style preferences” into **checkable facts**, which will give you crisp dashboards in 6.3.

---

## 3) Ready‑to‑use rubrics (short, anchored, JSON‑only)

Each rubric is deliberately brief (10–12 lines). Use them as **defaults** and adapt per scenario. They match the style from Chapter 5 so you can reuse calibration/correction.

### 3.1 Turn Judge (local quality)

**Prompt (skeleton)**

```
You are an impartial evaluator. Read the LATEST USER MESSAGE, the ASSISTANT TURN, and the STATE SNIPPET (facts & constraints).
Score per the rubric and output ONLY valid JSON.

RUBRIC (1–5; use anchors):
- Instruction Following: 1=ignores the ask; 3=partially answers; 5=direct, complete response to the last user message.
- Faithfulness to State: 1=contradicts state/tool results; 3=mostly grounded with minor slips; 5=fully consistent with state.
- Tone & Professionalism: 1=inappropriate; 3=neutral; 5=polite, respectful, on-brand.
- Actionability: 1=stalls or vague; 3=some progress; 5=clearly advances the goal (question or next step).
- Conciseness: 1=rambling; 3=some redundancy; 5=concise; do NOT reward length.
MUST-PASS: safety_policy, schema_valid, positive_refusal_if_applicable.
Return only JSON.
```

**JSON schema**

```json
{
  "scores": {
    "instruction": 1, "faithfulness": 1, "tone": 1, "actionability": 1, "conciseness": 1
  },
  "checks": {"safety_policy": true, "schema_valid": true, "positive_refusal": false},
  "overall_pass": true,
  "notes": "one sentence"
}
```

### 3.2 Step/Procedure Judge (tool plan & repair)

**Prompt (skeleton)**

```
You will evaluate the REASONABLENESS of the agent's plan and tool usage across several turns.
You get a list of TOOL CALLS and RESULTS and a STATE TIMELINE.

RUBRIC (1–5):
- Plan Correctness: 1=illogical order or missing critical step; 3=mostly reasonable; 5=correct order with justified steps.
- Arguments Validity: 1=wrong or missing args; 3=minor issues; 5=correct args with evidence IDs.
- Constraint Adherence: 1=violates policy/limits; 3=borderline; 5=fully respects constraints.
- Repair Behavior: 1=ignores errors; 3=partial recovery; 5=detects and fixes within k turns.
MUST-PASS: no_tool_thrashing (<= budget), schema_valid.
Return only JSON.
```

**JSON schema**

```json
{
  "scores": {"plan": 1, "args": 1, "constraints": 1, "repair": 1},
  "checks": {"no_tool_thrashing": true, "schema_valid": true},
  "overall_pass": true,
  "notes": "short"
}
```

### 3.3 Conversation Judge (outcome)

**Prompt (skeleton)**

```
You will judge whether the conversation achieved the SCENARIO GOAL and whether the path was acceptable.
You are given: SCENARIO SPEC, CONVERSATION DIGEST (bullets), FINAL STATE SUMMARY.

RUBRIC (1–5):
- Goal Achievement: 1=goal not met; 3=partially; 5=fully achieved as defined.
- Faithfulness to Facts: 1=contradictions; 3=mostly aligned; 5=consistent with state and tool results.
- User Experience: 1=confusing/impolite; 3=adequate; 5=clear, polite, closes with next steps.
- Efficiency: 1=wasteful loops; 3=reasonable; 5=succinct path within budget.
MUST-PASS: safety_policy_global, schema_valid.
Return only JSON.
```

**JSON schema**

```json
{
  "scores": {"goal": 1, "faithfulness": 1, "ux": 1, "efficiency": 1},
  "checks": {"safety_policy_global": true, "schema_valid": true},
  "overall_pass": true,
  "notes": "one sentence"
}
```

---

## 4) Tiny rule library for multi‑turn failure modes

Use **simple, transparent rules** over events + DerivedState. These run fast, are explainable, and feed clean features to judges.

### 4.1 Contradiction detector
- Keep `facts_history[key] = [(turn, value, source)]`.  
- Flag if the assistant asserts `value_new != last_known_value` **without** citing an evidence/source update.

### 4.2 Looping detector
- If the same **intent** (e.g., `ask_for_confirmation`) occurs > `k` times without progress change, flag `looping`.  
- Intent can be detected by a tiny text classifier or by agent tool metadata.

### 4.3 Tool thrashing
- Count tool calls; if `> budget` OR same call with identical args repeated ≥ 2 times without new result, flag.

### 4.4 Clarification sufficiency
- Before an action labeled `compose_message`, check that `required_facts` exist; else emit violation and label the triggering turn.

### 4.5 Unsafe accumulation
- Maintain PII fields in state; if total **distinct PII items** exceeds a threshold, require **redaction** or **handoff**.

### 4.6 Repair timer
- When an error is detected (tool error, contradiction), start a **repair clock**. If not resolved within `k` turns → failure.

These rules become columns in your report: **contradictions**, **loops**, **thrashing**, **clarification_violation**, **PII_overflow**, **repair_within_k**.

---

## 5) Conversation digest (cheap, robust context for judges)

Generate a compact, standardized digest so judges don’t read raw logs.

**Digest format (example)**

```
SCENARIO: collections_first_message_pt
FACTS: debtor=João Pereira; amount_due=R$420.00; due_date=2025-08-20; language=pt-BR.
DECISIONS:
- T1: clarified preferred language -> pt-BR.
- T2: crm_lookup(debtor_id=842) -> ok (amount=420, due=2025-08-20).
- T3: user asked about discount; policy.max_discount=10%; agent refused politely; offered boleto/cartão.
- T4: composed first outreach; included amount & due date; no legal threats; sent message.
OUTCOME: goal_completed=true; message_sent=true; turns=4; tool_calls=1; safety_violations=0.
RED FLAGS: none.
```

Keep digests ≤ 20–30 lines. Provide **evidence IDs** (`tool_result#123`) so judges can reward faithfulness.

---

## 6) Metrics and dashboards (what you will report)

**Outcome**  
- **Goal completion (true success)**: bias‑corrected using judge calibration (5.6–5.7).  
- **Efficiency**: median turns/tool calls/latency to goal (+ CIs).  
- **Safety pass**: per turn and global.

**Process**  
- **Clarification sufficiency**, **tool thrashing rate**, **looping rate**, **repair within k**, **contradiction rate**.

**Experience**  
- Average **turn scores** (instruction, faithfulness, tone, actionability, conciseness).  
- **Conversation scores** (goal, faithfulness, UX, efficiency).

**Reporting rules**  
- Bootstrap **by conversation** for CIs.  
- Show **segment breakdowns** (country, language, channel).  
- Always show **judge versions** and the **dataset snapshot** used.

---

## 7) Implementation sketch (what you’ll code in 6.3)

Below is a **preview** that maps concepts to functions. In 6.3 we’ll implement these.

```python
# pipeline.py (sketch)
def reduce_events_to_state(events):
    state = init_state()
    for ev in events:
        state = update(state, ev)           # facts, constraints, safety
        index_tool(ev, state)               # tool_index
        record_history(ev, state)           # for contradictions/repair
    return state

def run_rules(events, state, spec):
    return {
        "clarification_ok": has_required_facts_before_action(events, spec),
        "contradictions": find_contradictions(events, state),
        "looping": detect_loops(events),
        "thrashing": detect_tool_thrashing(events),
        "repair_within_k": repair_timer(events, state, k=2),
        "safety_global": check_safety(state),
    }

def build_digest(events, state, spec):
    return summarize_to_bullets(events, state, spec)

def evaluate_conversation(conv, spec, judges):
    state = reduce_events_to_state(conv.events)
    rules = run_rules(conv.events, state, spec)
    turn_scores = [judge_turn(t, state, judges.turn) for t in conv.assistant_turns]
    step_score = judge_steps(conv, state, judges.step)
    convo_score = judge_conversation(build_digest(conv.events, state, spec), judges.convo)
    return aggregate_results(rules, turn_scores, step_score, convo_score)
```

Design each function to be **pure** and **deterministic**, calling LLM judges with `temperature=0` and the JSON schema from Section 3.

---

## 8) Practical tips (learned the hard way)

- Keep judges **short**. If a prompt exceeds ~12 rubric lines, scores get noisy.  
- **Pin versions**: judge prompt id, model id, temperature, top‑p. Log them.  
- **One digest per conversation**—not per turn—to control cost. Use **turn judges** only on key turns (e.g., assistant turns that contain actions).  
- Use **feature flags** to turn rules on/off without changing code, and log the ruleset version in reports.  
- For bilingual systems, add **bilingual anchors** in tone rubrics and evaluate PT/ES segments separately.  
- Keep rule names **human‑readable** (“clarification_ok”) so dashboards are self‑explaining.

---

## 9) Worked example (end‑to‑end design for one scenario)

**Scenario:** “First outreach” in collections (pt‑BR).  
**Spec:** from §1.1.  
**Key gates:** `crm_lookup` before composing; discount policy; clarification for language.  
**Rules implemented:** contradictions, looping, thrashing, repair timer.  
**Judges:** Turn (5 criteria), Step (4 criteria), Conversation (4 criteria).  
**Digest:** as in §5.

**Expected metrics to report:**  
- Goal completion (true success with CIs), turns/tool calls to goal.  
- Clarification sufficiency, contradiction rate, repair within 2 turns.  
- Tone average and distribution, safety pass per turn and global.  
- Segment table (pt‑BR WhatsApp vs Email).

This package is **enough** to run your first multi‑turn eval and meaningfully compare model/prompt variants.

---

## 10) Exercises

1. **Fill the templates.** Author a ScenarioSpec and a DerivedState table for one of your real conversation types.  
2. **Choose gates.** Pick 2 clarification gates, 1 policy gate, and 1 tool gate. Write the exact conditions that flip each gate to “true”.  
3. **Adopt the rubrics.** Copy the Turn/Step/Conversation rubrics and tailor just **two lines** for your brand. Keep the JSON schemas unchanged.  
4. **Write three rules.** Implement simple pseudocode for `detect_loops`, `find_contradictions`, and `repair_timer`.  
5. **Draft the digest.** For a past conversation, hand‑write the 20‑line digest. Ask: would a human PM understand what happened?  
6. **Design your report.** Decide the rows/columns you’ll show (metrics + segments). Add judge version and dataset snapshot fields.

---

## Summary

Practical multi‑turn evaluation hinges on **structure** and **small, disciplined components**. You designed ScenarioSpecs and a DerivedState that make conversations **checkable**; you installed **gates** that convert fuzzy behaviors into facts; you adopted **short anchored rubrics** for turn/step/conversation judges; and you assembled a small **rule library** that exposes looping, contradictions, and unsafe accumulation. Finally, you learned to produce a **standard digest** that is cheap for judges and clear for humans.

You’re ready for **6.3 — Automated Evaluation of Multi‑Turn Traces**, where we’ll implement the reducer, rules, digest builder, and judge calls to produce CI‑ready reports.
