# Lesson 6.5 — Chapter 6 Summary: Evaluating Multi‑Turn Conversations

> **Purpose:** Compress everything from Chapter 6 into one durable, practical reference you can paste into your repo’s `README_multi_turn.md`. This is the *operational* view—the minimum you must do to evaluate conversations well, without leaks, noise, or surprises.

---

## 1) The mental model (what changed from single‑turn)

Multi‑turn quality is **process quality**. You don’t just check “Was this answer good?”—you check **how the agent clarifies, plans, uses tools, repairs errors, and lands the goal** across a sequence of turns, **safely** and **politely**. That adds three ingredients:

1. **Structure the logs as events → DerivedState.** Every message, tool call, and result becomes an *event*. From events you compute **DerivedState** (facts, constraints, safety flags, outstanding questions, progress).  
2. **Evaluate at the right level.** Use a **pyramid** of levels: *Field/Span → Turn → Exchange → Step/Procedure → Conversation → Program*. Each level has **appropriate metrics** and **one bootstrap unit**—the **conversation**.  
3. **Digest then judge.** Don’t feed novels to judges. Build a **compact digest** (facts timeline, decision bullets, tool summary, red flags, outcome). Judges read this + the ScenarioSpec and emit **short, anchored JSON scores**.

Everything else—splits, iteration, calibration, CIs—stays the same as Chapter 5.

---

## 2) The pyramid (cheat sheet)

| Level | Unit | Best metrics | Labeling/Judges | CI/Resampling | Typical pitfalls |
|---|---|---|---|---|---|
| **Field/Span** | field in a message | exact/normalized match, schema pass, citation‑ID validity | deterministic checks; tiny judge for fuzzy spans | by **conversation** | double counting; locale formats; schema drift |
| **Turn** | one assistant reply | rubric 1–5 (instruction, faithfulness, tone, actionability, conciseness); safety must‑pass | short **Turn judge** with state slice | by **conversation** | verbosity/position bias; selector–evaluator coupling |
| **Exchange** | (user_t, assistant_t) | local coherence, refusal quality | judge with quoted latest user text | by **conversation** | prompt injection via user text |
| **Step/Procedure** | tool call or phase | order correctness; args validity; repair ≤k; budget; policy adherence | rule checks + **Step judge** for reasonableness | by **conversation** | missing component panels; tool thrashing |
| **Conversation** | entire thread | **true success** (bias‑corrected); turns/calls/latency; global safety; repair rate; UX | **Conversation judge** on digest + final state | by **conversation** | digest bloat; Simpson’s paradox |
| **Program** | cohort/time window | conversions/CSAT/escalations; cost | BI systems; not for prompt tuning | n/a | confounding; seasonality |

**Rule of one:** pick **one resampling unit** (conversation) for CIs and don’t mix it with turns/fields in the same estimate.

---

## 3) Minimal data contracts (so eval is easy)

### 3.1 Event log (input)
```json
{
  "conversation_id": "conv_001",
  "segment": {"country":"BR","language":"pt-BR","channel":"whatsapp"},
  "scenario_id": "collections_first_message_pt",
  "events": [
    {"type":"user_msg","turn":1,"text":"Oi, posso pagar em duas vezes?"},
    {"type":"assistant_msg","turn":1,"text":"Posso ajudar! Qual seu idioma preferido?","meta":{"intent":"clarify_lang"}},
    {"type":"tool_call","turn":2,"name":"crm_lookup","args":{"debtor_id":842}},
    {"type":"tool_result","turn":2,"name":"crm_lookup","status":"ok","result":{"amount_due":420.0,"due_date":"2025-08-20"}},
    {"type":"assistant_msg","turn":3,"text":"João, valor R$420, venc. 20/08. Boleto ou cartão?","meta":{"intent":"compose_first_message"}}
  ]
}
```

### 3.2 DerivedState (computed)
```
facts: {amount_due: 420.0, due_date: 2025-08-20, language: pt-BR, message_sent: true?}
constraints: {policy: {discount_max: 0.10}}
safety: {pii_items: {...}, violations: []}
outstanding_questions: [...]
history: per‑key list of (turn, value, source) for contradiction checks
tool_index: [{turn, name, args/result, status}]
```

### 3.3 ScenarioSpec (declarative)
```
id, goal, preconditions.required_facts, tools_allowed, success_criteria:
  must_pass: [no_policy_violations, mentions_amount_due_exactly_once, offers_two_paths]
  rubric: {faithfulness, helpfulness, tone, efficiency}
stop_conditions: [user_requests_handoff, k_inactive_turns=3]
```

---

## 4) Judges you actually use

- **Turn judge** (5 short criteria + must‑pass) → JSON only.  
- **Step judge** (plan order, args validity, constraint adherence, repair) → JSON only.  
- **Conversation judge** (goal, faithfulness, UX, efficiency) → JSON only.

**Best practices**  
- Keep prompts **under ~12 rubric lines** and deterministic (`temperature=0`).  
- **Pin versions** (prompt id + model id + params).  
- **Calibrate** each judge vs. human labels to get `(sensitivity, specificity)`; compute **bias‑corrected true success** as in Chapter 5.6–5.7.  
- Use **different judges** (or splits) for selection vs. evaluation to avoid **double‑dipping**.

---

## 5) Rules that catch multi‑turn failures (the tiny library)

- **Clarification gates**: don’t act until `required_facts` known.  
- **Contradictions**: flag if a fact changes without a new source.  
- **Looping**: same intent repeats ≥k without progress.  
- **Tool thrashing**: repeated identical calls or > budget.  
- **Repair timer**: after an error, require a fix within k turns.  
- **Global safety**: PII count ≤ threshold; conversation‑level safety must‑pass.  
- **Goal change reconfirmation**: if goal shifts mid‑stream, reconfirm before acting.

Expose each as a column and a rate in your reports.

---

## 6) Reporting that drives decisions

**Always include**  
1. **Outcome table**: true success with 95% CI (bootstrap by conversation), **turns/tool‑calls/latency to goal** (medians + CIs).  
2. **Process panel**: clarification sufficiency, contradiction rate, loops, thrashing, repair ≤k, policy adherence.  
3. **Experience & safety**: tone averages, per‑turn safety pass, **global safety** pass.  
4. **Segments**: BR vs AR × channel × scenario—each with CIs and traffic‑weighted overall.  
5. **Artifacts**: judge versions, dataset snapshot id, ruleset version, and links to **digests + raw traces**.

**Release gate (example)**  
```
Ship if:
- true_success_CI_lower ≥ 0.80 overall AND ≥ 0.75 in BR‑WhatsApp
- step_gates_pass ≥ 0.98 and global_safety_pass ≥ 0.99
- cost/latency within budget; no increase in loops/thrashing
```
Choose thresholds appropriate to your domain.

---

## 7) CI/CD & monitoring (preview of Chapter 9)

Automate a **weekly monitoring split** from production. Run the evaluator; alert on:
- **Honeypots** (invariant cases) moving → judge drift.  
- **Segment regressions** (CI lower bound crosses threshold).  
- **Component panels**: tool errors, retrieval recall, policy blocks.  
- **Judge agreement** vs a 30‑item human audit.

Everything should run from one command (local & CI): `python scripts/run_eval.py --data ... --spec ...`

---

## 8) One‑page playbook (paste in your repo)

1. **Structure:** event logs → reducer → DerivedState.  
2. **Spec:** ScenarioSpec with preconditions, success criteria, stop conditions.  
3. **Rules:** clarification, contradictions, loops, thrashing, repair timer, global safety, reconfirmation.  
4. **Judges:** Turn, Step, Conversation (anchored, JSON‑only, pinned).  
5. **Calibration:** estimate `(s,t)` on a calibration set; compute **true success** with bootstrap CIs.  
6. **Aggregation:** bootstrap **by conversation**; report segments; weight by traffic mix.  
7. **Release gate:** CI‑lower thresholds + must‑pass gates + cost/latency budgets.  
8. **Artifacts:** persist judge versions, dataset snapshots, ruleset/spec versions, raw trace links.  
9. **Monitoring:** weekly canaries; alert on drift and regressions.

Stick this at the top of the evaluator repo to onboard new engineers in minutes.

---

## 9) What to memorize (sticky ideas)

- **Unit of truth = the conversation.** Resample at that level.  
- **Short judgy prompts, long discipline in rules.** Let code catch what code can; ask judges only for nuance.  
- **Digest first.** Cheap, robust, explainable.  
- **Correct for imperfect judges.** Report **true success**, not raw pass‑rate.  
- **Segments matter.** Avoid Simpson’s paradox; gate per critical segment.  
- **Selection ≠ evaluation.** Use different judges or disjoint splits.

---

## 10) Exercises (capstone)

1. **Ship your v1 evaluator:** run it on 200 real conversations; publish a report with outcome/process/experience + segments.  
2. **Calibrate:** label 100 conversations with humans; estimate judge `(s,t)`; recompute **true success** with CIs.  
3. **Honeypots & probes:** add 10 invariants (should never change) and a small adversarial pack (verbosity, injection, fake citations).  
4. **Drill:** simulate a regression (increase tool errors by 10%); confirm the process panel blames the right component.  
5. **CI gate dry‑run:** set thresholds, intentionally break them, and verify the pipeline blocks the “release.”

---

## 11) How Chapter 6 connects forward

- **Chapter 7 (RAG):** You’ll reuse this scaffolding but add **retrieval quality** and **faithfulness** specific to documents.  
- **Chapter 8 (Architectures):** Tool‑calling and agentic systems get special diagnostics (tool correctness, multi‑step pipelines).  
- **Chapter 9 (CI/CD):** We turn your evaluator into a **safety net** against regressions with continuous monitoring.

---

### Final takeaway

> **Structure → Rules → Judges → Calibration → CIs → Segments → Gates.**  
> Do those seven consistently and your conversation evaluator becomes a **decision instrument** you can trust in weekly releases.
