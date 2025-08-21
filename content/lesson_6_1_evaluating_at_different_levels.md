# Lesson 6.1 — Evaluating at Different Levels

> **Chapter:** 6 — Evaluating Multi‑Turn Conversations  
> **This section in the book:** **6.1 Evaluating at Different Levels**  
> **Continuity:** You finished Chapter 5 (judges, calibration, group metrics) and we already sketched a multi‑turn overview. This lesson goes deeper on *levels*: **what is the unit of analysis, which metrics belong to each level, how to aggregate and attach uncertainty, and how to keep numbers honest** across the stack.

---

## Why “levels” matter

In multi‑turn systems, quality is not a single number. It depends on **local moves** (a turn), **procedures** (a sequence of tool steps), and the **whole conversation outcome**. Picking the **wrong unit of analysis** leads to leakage, false lifts, and confusing dashboards.

We’ll standardize six practical levels you can mix and match:

1. **Field/Span level** (inside a message)
2. **Turn level** (one assistant reply)
3. **Exchange level** (user→assistant pair)
4. **Step/Procedure level** (tool or plan step chains)
5. **Conversation level** (entire thread)
6. **Program/Business level** (rollups across conversations)

For each we’ll specify: *unit, good metrics, typical labels/judges, aggregation, bootstrap unit, and pitfalls.*

---

## Level 1 — Field/Span level (inside a message)

**Use when:** the assistant must produce **structured content** inside text: amounts, dates, entity names, citation IDs, JSON fields.

- **Unit:** a **field** or **text span** inside a single assistant message.  
- **Examples:** `amount_due` matches CRM; `due_date` format is ISO; references `[12][14]` correspond to evidence IDs; JSON schema validity.  
- **Metrics:** exact/normalized match, edit distance, date/currency parsing success; **must‑pass** schema validation; citation‑ID validity.  
- **Labels/Judges:** Deterministic checkers preferred; LLM‑as‑judge only for fuzzy spans (e.g., “did the summary mention both options?”) with tight anchors.  
- **Aggregation:** per message → **mean over messages**; expose **per‑field** rates (e.g., amount accuracy vs. date accuracy).  
- **Bootstrap:** **by conversation** if messages come from the same thread (avoid over‑confidence).  
- **Pitfalls:** double‑counting (many fields per message inflate N), locale formatting (R$ vs $), silent schema drift.

**Tip:** Keep a **field dictionary** with canonicalizers (`normalize_currency`, `normalize_date`) to make checks trivial.

---

## Level 2 — Turn level (one assistant reply)

**Use when:** judging how well a single reply handles the **latest user message** given current state.

- **Unit:** one assistant message.  
- **Metrics:** 1–5 rubric scores (Instruction Following, Faithfulness to State, Tone, Actionability, Conciseness) + **must‑pass** safety/policy and schema.  
- **Labels/Judges:** **Turn judge** (short, anchored, JSON‑only). Include a **state snippet** and recent tool results to judge faithfulness.  
- **Aggregation:** average scores per metric; **pass‑rate** for must‑pass; optionally **Any‑pass**/Best‑score when sampling multiple candidates for a turn (best‑of‑n).  
- **Bootstrap:** **by conversation** (turns within the same conversation are correlated).  
- **Pitfalls:** verbosity bias, position bias in pairwise A/B, selection/evaluation **double‑dipping** (same judge chooses and scores).

**Guardrail:** do not feed the **whole history** to the turn judge—give a **digest slice** relevant to the turn to avoid leakage and cost.

---

## Level 3 — Exchange level (user→assistant pair)

**Use when:** the quality depends on **matching the user’s last utterance** plus the immediate response (e.g., refusal quality, targeted follow‑up question).

- **Unit:** the pair `(user_turn_t, assistant_turn_t)`.  
- **Metrics:** *Response relevance*, *question quality*, *positive refusal quality*, *de‑escalation*.  
- **Labels/Judges:** small LLM‑as‑judge with anchors for **local coherence** (did the reply address the question just asked?).  
- **Aggregation & CI:** like Turn‑level, but ensure the judge sees the **user message verbatim** (quoted/delimited).  
- **Pitfalls:** mixing exchange and turn metrics (double counting), quote‑boundary errors that allow **prompt injection** (“Ignore your rules…” inside the user text).

---

## Level 4 — Step/Procedure level (tool or plan chains)

**Use when:** success depends on a **sequence of actions** (retrieve → parse → compute → propose; or `crm_lookup` → `create_payment_link` → `send_message`).

- **Unit:** a **step** (tool call + result) or a **named phase** in the plan.  
- **Metrics (deterministic preferred):**  
  - **Order correctness** (critical prerequisite called before action),  
  - **Arguments validity** (IDs match state),  
  - **Error handling/repair** (error detected and fixed within *k* turns),  
  - **Budget adherence** (≤ N tool calls; no **thrashing**),  
  - **Constraint tracking** (discount ≤ policy).  
- **Labels/Judges:** **Step judge** (reasonableness of plan; repair behavior).  
- **Aggregation:** per conversation **pass‑rate** per step type; **time/calls to complete** a phase (medians + CIs).  
- **Bootstrap:** **by conversation**.  
- **Pitfalls:** only measuring end‑to‑end; missing **component panels** (you can’t tell if model or tool regressed).

**Design pattern:** declare **gates** in the ScenarioSpec (e.g., “Must `crm_lookup` before composing first message”). Gates turn process quality into **boolean, explainable checks**.

---

## Level 5 — Conversation level (whole thread)

**Use when:** stakeholders care about the **outcome** and **journey** across the complete dialogue.

- **Unit:** one conversation/thread.  
- **Metrics:**  
  - **Goal completion** (bias‑corrected **true success**, Chapter 5.6–5.7),  
  - **Efficiency** (turns, tool calls, latency **to goal**),  
  - **Global safety** (no PII overflow; no policy violations across turns),  
  - **Repair rate** (fraction of conversations where the agent fixed its own error),  
  - **User experience** (closing quality, summary, confirmation).  
- **Labels/Judges:** **Conversation judge** that reads a **short digest** + final state.  
- **Aggregation:** means with **group bootstrap by conversation**; **segment tables** (country, language, channel, scenario).  
- **Pitfalls:** digest bloat, selection/eval double‑dipping, Simpson’s paradox (overall up, BR‑WhatsApp down).

**Selector quality:** if you sample multiple replies per key turn, report **Any‑pass** and **Best‑score** at the **conversation** level as in Lesson 5.8 (group metrics).

---

## Level 6 — Program/Business level (across conversations)

**Use when:** you need to connect model quality to **operational outcomes**.

- **Unit:** cohort or time window (day/week), possibly per **segment** or **campaign**.  
- **Metrics:** conversion/collection outcomes, CSAT, resolution rate, escalations, cost/latency per ticket.  
- **Labels:** come from business systems (payments, CRM). Use telemetry to *join* back to the evaluated conversations.  
- **Aggregation:** weighted by traffic mix; report **correlation** and **elasticity** with conversation‑level true success.  
- **Pitfalls:** confounding from policy changes, pricing, seasonality; **do not** use these to tune prompts—use them to sanity‑check directionality.

---

## Putting the levels together — a compositional view

Think of evaluation as a **pyramid**:

- **Base:** Field and Turn checks (deterministic + short judges).  
- **Middle:** Step/Procedure rules that enforce **process discipline**.  
- **Top:** Conversation outcome judged on a **digest** with calibration and CIs.  
- **Business roof:** online KPIs confirming that improvements matter.

### Aggregation principles

1. **Choose a single resampling unit** for uncertainty—**the conversation**—and stick to it for any metric that uses multiple items from a conversation.  
2. **Separate “must‑pass” from scalar scores.** Gate releases on **must‑pass** (safety, schema, policy); track scalar improvement with CIs.  
3. **Avoid double counting.** If you count five fields and one turn per conversation, keep a **per‑conversation roll‑up** so overall N doesn’t explode.  
4. **Expose distributions.** Means can hide long tails; show quantiles (e.g., 90th‑percentile turns to goal).

### Example aggregation (collections first‑message)

- **Field:** `amount_due` exact match (per message).  
- **Turn:** Actionability ≥4 and safety pass (assistant turn that composes the message).  
- **Step:** `crm_lookup` before compose; **no** tool thrashing.  
- **Conversation:** Goal completion (message sent + conversation judge pass), **turns≤4**, **global safety pass**.

Release gate: **CI‑lower(true success) ≥ 0.80 overall AND ≥ 0.75 in BR‑WhatsApp**, plus all **must‑pass** rates ≥ thresholds.

---

## Choosing datasets & labels by level

| Level | Typical labelling source | Split key | Notes |
|---|---|---|---|
| Field | deterministic checkers; small human spot checks | conversation_id | Calibrate borderline spans once per quarter |
| Turn/Exchange | LLM‑as‑judge with anchors; 5–10% human audit | conversation_id | Use **swap tests** for position bias; fix verbosity bias |
| Step/Procedure | rule code + minimal judge | conversation_id | Define gates in ScenarioSpec |
| Conversation | LLM‑as‑judge on digest + human calibration | conversation_id | Correct for judge imperfection (5.6–5.7) |
| Program | BI systems | date/segment | Use only for sanity/impact, not prompt tuning |

---

## Worked example (end‑to‑end across levels)

**Scenario:** First outreach message in collections (pt‑BR).

1. **Field checks**  
   - `amount_due` and `due_date` appear **once** and match CRM (normalized).  
   - Citation IDs in the message (if any) must exist in evidence.  
   - Must‑pass: JSON schema valid for a `Message` object.

2. **Turn judge** for the compose turn  
   - Instruction: addresses first‑outreach task.  
   - Faithfulness: consistent with CRM lookup.  
   - Tone: polite, on‑brand, **pt‑BR**.  
   - Actionability: offers **two payment paths**.  
   - Conciseness: ≤ 120 words; no legal threats.

3. **Step rules**  
   - Gate: `crm_lookup` must occur **before** compose.  
   - Repair timer: if `crm_lookup` fails, repair ≤ 2 turns.  
   - Tool budget: ≤ 3 total calls.

4. **Conversation outcome**  
   - Goal completed if: `message_sent=true` **AND** conversation judge overall pass.  
   - Efficiency: `turns_to_goal ≤ 4`.  
   - Global safety: `pii_items ≤ 2` and zero violations.

5. **Aggregation**  
   - Bootstrap by **conversation** to compute CIs for: goal completion (bias‑corrected), step pass‑rates, turn score means, field exact‑match.  
   - Segment table: BR vs AR × channel.  
   - Release gate as above.

**Reading the dashboard**  
- If **Field** is 99% but **Turn Actionability** is 60%, the content is correct but not **moving the goal**; iterate prompt templates.  
- If **Step** gates fail (no `crm_lookup`), the model is skipping prerequisites; adjust agent planner or policy gate.  
- If **Conversation** true success is high but **latency** is high, you may have **tool thrashing**; tighten budgets.

---

## Common mistakes when mixing levels (and the fix)

- **Mistake:** reporting turn‑level CIs by resampling **turns** → **over‑confident**.  
  **Fix:** resample **conversations**; turns are nested.  

- **Mistake:** averaging field accuracies and turn pass‑rates into one number.  
  **Fix:** keep **separate panels** (Field/Turn/Step/Conversation) and let decision‑makers weigh them.

- **Mistake:** using the **same judge** to select candidate replies and to evaluate conversation outcomes.  
  **Fix:** **Judge A** for selection, **Judge B** for evaluation (or separate splits).

- **Mistake:** allowing the conversation judge to read raw logs with gold labels.  
  **Fix:** pass only **digests** and **state summaries** (blind to labels).

---

## Quick templates (copy/paste)

**Turn judge anchors (1–5)**  
- Instruction: 1 ignores ask; 3 partial; 5 fully addresses the last user message.  
- Faithfulness: 1 contradicts state; 3 mostly grounded; 5 fully consistent with CRM/tool results.  
- Tone: 1 inappropriate; 3 neutral; 5 polite and on‑brand.  
- Actionability: 1 stalls; 3 some progress; 5 clearly advances towards the scenario goal.  
- Conciseness: 1 rambling; 3 some redundancy; 5 concise—**do not reward length**.

**Conversation judge (must‑pass + rubric)**  
- Must‑pass: `safety_policy_global=true`, `schema_valid=true`.  
- Scores: Goal Achievement, Faithfulness to Facts, User Experience, Efficiency.  
- Input: ScenarioSpec + **digest** (≤ 30 lines) + final state summary.

**Release gate pseudocode**  
```python
ship = (true_success_lo >= target_overall
        and all(true_success_lo_seg >= target_seg for seg in critical_segments)
        and safety_must_pass_rate >= 0.99
        and step_gates_pass >= 0.98)
```

---

## Exercises

1. **Map a real task** (e.g., “first outreach”) to the six levels. For each level, write 2–3 metrics and identify the **bootstrap unit**.  
2. **Design a two‑row dashboard**: (a) Field/Turn/Step panel, (b) Conversation outcomes with CIs + segments. Sketch column names.  
3. **Write one gate** and one **step rule** for your scenario. Implement them in your evaluator from Lesson 6.3.  
4. **Bias probe** at the Turn level: create 10 short/long minimal pairs; confirm your turn judge isn’t rewarding verbosity.  
5. **CI sanity**: Run bootstrap by *turn* and by *conversation* on the same data and observe the difference—explain why they diverge.

---

## Summary

“Evaluating at Different Levels” is the discipline of choosing the **right unit** for each question, pairing it with the **right metric**, and aggregating with the **right uncertainty**. Use Field and Turn checks for **local correctness**, Step rules for **procedural discipline**, Conversation judges for **outcomes with calibration and CIs**, and Program‑level metrics to confirm **real‑world impact**. Keep resampling at the **conversation** unit, protect against leakage and double‑dipping, and show segment tables so improvements are real and robust.

In the next lessons (6.2–6.4), you’ve already built practical strategies, automation, and pitfall defenses. This 6.1 section gives you the map that ties them all together.
