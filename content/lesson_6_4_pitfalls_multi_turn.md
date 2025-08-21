# Lesson 6.4 — Addressing Common Pitfalls in Multi‑Turn Evaluation

> **Position in course:** Chapter 6 (“Evaluating Multi‑Turn Conversations”)  
> **Previously (6.1–6.3):** You defined a conversation data model, designed gates and rubrics, and implemented an automated evaluator that reduces events → `DerivedState`, runs rules, calls judges, and emits reports with CIs.  
> **This lesson (6.4):** We focus on **what breaks in practice**—the multi‑turn‑specific traps that derail teams—and give **symptom → diagnosis → fix** playbooks plus drop‑in rules and prompts. Think of this as your on‑call guide when numbers look weird.

---

## How to use this lesson

- Each pitfall includes **what you’ll see**, **why it happens**, **quick checks**, and **hard fixes**.  
- Many fixes are one‑line rules or tiny prompt edits you can paste into the code from Lesson 6.3.  
- At the end: a **triage runbook** and a **10‑minute regression drill**.

---

## Pitfall 1 — **Goalpost drift** (the goal silently changes)

**Symptom**  
- Pass‑rate drops for no apparent reason; reading examples shows the agent solved a *different* user goal than your ScenarioSpec.  
- Judges disagree because “success” is ambiguous: user changed their mind mid‑conversation.

**Why**  
- Real users wander. Specs without **explicit scope rules** leave judges guessing whether the agent should follow the new goal or push back.

**Quick checks**  
- Compare the **first explicit goal** vs. the **final action** in the digest.  
- Count conversations where a **new user intent** appears after turn *t*.

**Fix**  
1. Add a **scope rule** to ScenarioSpec:  
   - “If user goal changes after confirmation, agent must re‑confirm before acting.”  
2. Turn‑judge anchor: *“Actionability = 1 if agent proceeds on outdated goal.”*  
3. Add a rule `require_reconfirmation_on_goal_change` (two lines) and report its violation rate.

---

## Pitfall 2 — **Looping** and **stalling**

**Symptom**  
- Turns to success balloons; lots of “Can you confirm?” messages with no progress.

**Why**  
- Missing **repair timers** and **turn budgets**.  
- The agent keeps asking for the same info when state is already known.

**Quick checks**  
- `detect_loops(intent="clarify_*")` from 6.3.  
- Plot a histogram of *turns to success*; heavy right tail ⇒ loops.

**Fix**  
- Add **intent‑specific loop limits** (`≤2` per clarification).  
- Add a **repair timer**: once an error is logged, require a fix within *k* turns or trigger **handoff**.  
- Turn‑judge anchor: penalize *Actionability* when repeating without new info.  
- Conversation‑judge anchor: reward **efficient** paths.

---

## Pitfall 3 — **Contradictions** and **state decay**

**Symptom**  
- Agent restates amount/dates differently across turns; users get confused.  
- Faithfulness looks fine per turn but the **conversation contradicts itself**.

**Why**  
- State not canonicalized; tools return slightly different formats; judges see only the last turn.

**Quick checks**  
- Use `find_contradictions()` (6.3) over `facts_history`.  
- Sample 20 flagged convos; confirm they’re real contradictions.

**Fix**  
- Canonicalize units and formats in `DerivedState` (dates, currency).  
- Pass a **state snippet** with the *authoritative* values to turn judges.  
- Add a **global contradiction rule** and surface it on dashboards.

---

## Pitfall 4 — **Tool thrashing** (too many calls, same args)

**Symptom**  
- Latency/cost spike; tool calls repeated with identical args; little new information.

**Why**  
- Agent retries blindly on soft errors; no budget gate.

**Quick checks**  
- `detect_tool_thrashing(budget=5)` and count duplicates `(name,args)` pairs.  
- Compare *tool_calls to goal* across variants.

**Fix**  
- Introduce **budget gates** by scenario; log **first failure reason**; require a different argument or backoff before retry.  
- Step‑judge rubric: “Arguments Validity” and “Repair Behavior” anchored to penalize blind retries.

---

## Pitfall 5 — **Selector–evaluator double‑dipping** (multi‑turn flavor)

**Symptom**  
- Offline Any‑pass @k looks great, but conversation‑level lift is small in prod.

**Why**  
- Same judge selects the **assistant reply** during the conversation and evaluates the conversation outcome.

**Quick checks**  
- Swap to a **different family** judge for evaluation; measure drop.  
- Run a **split‑by‑judge** A/B on a frozen validation set.

**Fix**  
- Two‑judge design: **Judge A** selects turns; **Judge B** evaluates conversations.  
- Or: **nested evaluation** with disjoint design/validation conversations (6.1, 5.4).

---

## Pitfall 6 — **Safety accumulation** (PII creeps over time)

**Symptom**  
- Early turns safe, later turns leak extra PII or policy‑restricted content.  
- Safety pass by turn looks okay; **global safety** fails.

**Why**  
- No **global safety state**; safety judged locally per turn only.

**Quick checks**  
- Track `safety_flags` and number of distinct PII fields in DerivedState.  
- Add a “PII overflow” column in the report.

**Fix**  
- Add a **global safety rule**: total distinct PII ≤ threshold unless explicit consent logged.  
- Conversation‑judge must‑pass: `safety_policy_global=true`.  
- Redact in digests, store hashed values.

---

## Pitfall 7 — **Ambiguous rubrics** (long, fuzzy, or conflicting)

**Symptom**  
- Low inter‑judge agreement; JSON malformed; high variance.

**Why**  
- Prompts too long; overlapping criteria; no anchors.

**Quick checks**  
- Count rubric lines and tokens; >12 lines is a smell.  
- Run **swap tests** for position bias and **verbosity probes** (5.5).

**Fix**  
- Trim to **short anchored criteria** (6.2).  
- Force strict **JSON schema** and a single example.  
- Set `temperature=0`, pin versions, and calibrate `(s,t)` per judge (5.6).

---

## Pitfall 8 — **Digest bloat** (judges read novels)

**Symptom**  
- Judge latency/cost high; scores unstable.

**Why**  
- Raw logs or long digests fed to judges; includes irrelevant turns and private data.

**Quick checks**  
- Average digest token length; any >1k tokens needs attention.  
- Compare scores with a *minimal* digest.

**Fix**  
- Limit digest to **20–30 lines**; include only facts, decisions, tool summaries, red flags, and outcome.  
- Pass **evidence IDs** instead of full payloads.

---

## Pitfall 9 — **Misattributing blame** (tool vs model vs policy)

**Symptom**  
- A regression is blamed on the model; later you discover a tool or policy change caused it.

**Why**  
- No **component metrics**; only end‑to‑end scores.

**Quick checks**  
- Add **component counters**: tool error rate, retrieval recall, policy blocks.  
- Build a small **ablation**: re‑evaluate with the old tool outputs if possible.

**Fix**  
- Extend reports with **component panels**: retrieval quality, tool error histograms, policy block rates.  
- Encode tool version & policy version in every row.

---

## Pitfall 10 — **Termination confusion** (conversations never end)

**Symptom**  
- Agent keeps chatting; users drop; outcome unclear.

**Why**  
- No explicit **stop conditions** or **close behavior** in specs.

**Quick checks**  
- Count conversations with >N turns and `goal_completed=false`.  
- Scan digests for missing “closing” events.

**Fix**  
- Add `stop_conditions` to ScenarioSpec and a **closing checklist** (“confirm decision, summarize, next steps”).  
- Turn‑judge anchor for *Actionability* rewards closing when appropriate.

---

## Pitfall 11 — **Segment illusions** (Simpson’s paradox in dialogue)

**Symptom**  
- Overall pass improves; BR‑WhatsApp regresses.

**Why**  
- Mix shift across **scenario × language × channel**.

**Quick checks**  
- Segment table with CIs (bootstrap by conversation).  
- Weighted overall using production mix (5.7).

**Fix**  
- Gate releases on **per‑segment CI lower bounds** as well as overall.  
- Keep frozen **stratified splits** for validation/test.

---

## Pitfall 12 — **Synthetic comfort** (great on fake data, meh on real)

**Symptom**  
- High scores on synthetic dialogues; real customer traces underperform.

**Why**  
- Synthetic data lacks noise and edge cases; prompts overfit teacher style.

**Quick checks**  
- Compare length/topic distributions to production.  
- Run a weekly **monitoring** sample from prod and track drift.

**Fix**  
- Use synthetic only for **augmentation** and **probing** specific skills.  
- Always validate on a **recent real** sample.

---

## Pitfall 13 — **Schema drift** (state or event fields change)

**Symptom**  
- Evaluator breaks or silently mis‑reads fields after a deployment.

**Why**  
- No schema versioning; contracts changed without notices.

**Quick checks**  
- Validate JSON against a schema; add **smoke tests** in CI.  
- Keep `schema_version` in every row.

**Fix**  
- Adopt **JSON Schema** or `pydantic` models; refuse to run on mismatched versions.  
- Log **ruleset_version** and **spec_version** per run.

---

## Pitfall 14 — **Judge gaming** (agent writes to the rubric)

**Symptom**  
- Agents append “Evidence: [12] [14]” or “As per policy…” to please the judge without actually complying.

**Why**  
- Rubric rewards **form** over **substance**.

**Quick checks**  
- Human audit of a small sample where scores jumped.  
- Add probes with **fake evidence IDs**; judge should penalize.

**Fix**  
- Change the rubric to require **verifiable citations** (IDs must match the digest/tool results).  
- Add a rule `validate_citation_ids` that cross‑checks IDs in the answer with the digest’s evidence list.

---

## Pitfall 15 — **Time/latency blindness**

**Symptom**  
- Model “wins” on quality but makes the UX worse due to slow responses or tool chains.

**Why**  
- Reports ignore **latency to goal** and **tool calls to goal**.

**Quick checks**  
- Add medians + CIs for latency/turns/tool_calls to the summary table.

**Fix**  
- Specify **latency budgets** per scenario and penalize over‑budget paths in the conversation judge’s **Efficiency** criterion.

---

## Quick rules & snippets you can paste today

**A. Require reconfirmation on goal change**

```python
def require_reconfirmation_on_goal_change(events, k=1):
    last_goal = None; confirmed = False
    for ev in events:
        if ev.type == "user_msg" and "new goal" in (ev.meta or {}).get("intent",""):
            last_goal = "changed"; confirmed = False
        if ev.type == "assistant_msg" and (ev.meta or {}).get("intent") == "confirm_new_goal":
            confirmed = True
        if ev.type == "assistant_msg" and (ev.meta or {}).get("intent") == "act_on_goal" and last_goal=="changed" and not confirmed:
            return False
    return True
```

**B. Repair timer**

```python
def repair_timer(events, k=2):
    time_since_error = None
    for ev in events:
        if ev.type == "tool_result" and ev.status != "ok":
            time_since_error = 0
        elif time_since_error is not None:
            if ev.type == "assistant_msg" and (ev.meta or {}).get("intent") == "repair":
                time_since_error = None
            else:
                time_since_error += 1
                if time_since_error > k:
                    return False
    return True
```

**C. Validate citations against digest evidence**

```python
def validate_citation_ids(answer_text, evidence_ids):
    ids = {x.strip("[]") for x in answer_text.split() if x.startswith("[") and x.endswith("]")}
    return ids.issubset(set(map(str, evidence_ids)))
```

Add each rule as a boolean column; include in the **must‑pass checklist** or as diagnostics.

---

## Triage runbook (when a metric moves unexpectedly)

1. **Open the segment heatmap**. Is the change localized? If yes, focus there.  
2. **Check component panels**: tool errors, retrieval recall, policy blocks.  
3. **Read 10 digests**: do they show goalpost drift, loops, or contradictions?  
4. **Swap judges** (A ↔ B). Does the ranking change? If yes, suspect judge drift or gaming.  
5. **Honeypots**: compare scores on invariant items; any shift → judge drift.  
6. **Latency & cost**: did tool thrashing increase?  
7. **Schema version**: confirm data contracts and ruleset versions.  
8. **Reproduce**: run the previous model/prompt on the same dataset snapshot.

---

## 10‑minute regression drill (CI routine)

- [ ] Pull the latest **monitoring split** and run the evaluator (6.3).  
- [ ] Check **honeypots** and **adversarial probes** first.  
- [ ] Scan **segment heatmap** for BR/AR × channel.  
- [ ] Open 5 digests from the worst cell; annotate the failure mode.  
- [ ] Confirm **judge version** and **schema_version** match expectations.  
- [ ] If selection changed (best‑of‑n), ensure **evaluator judge ≠ selector judge**.  
- [ ] Output a short **incident note** with hypothesis + next experiment.

---

## Exercises

1. **Wire two new rules** from this lesson into your evaluator (e.g., `repair_timer` and `require_reconfirmation_on_goal_change`). Add them as columns and re‑run on your last dataset.  
2. **Build a “red flag” dashboard**: contradictions, loops, thrashing, PII overflow, reconfirmation failures—one row per segment with sparklines.  
3. **Judge gaming probe**: craft 10 conversations where the assistant fakes citations (`[999]`). Ensure your validator catches them and the judge penalizes.  
4. **Latency budget**: set per‑scenario budgets and update the conversation judge’s **Efficiency** anchors. Re‑run and check how rankings change.  
5. **Incident simulation**: deliberately break one tool (10% error rate) and confirm your component panel isolates the issue.

---

## Summary

Multi‑turn evaluation adds new ways to go wrong: **drifting goals**, **loops**, **contradictions**, **tool thrashing**, **global safety leaks**, **judge gaming**, and **silent schema drift**. You now have concise **diagnostics**, **rules**, and **prompt edits** to detect and fix them. Carry this runbook into your CI/monitoring—when a number moves, you’ll know exactly where to look and what to try first.

Up next: **6.5 — Summary**, where we condense Chapter 6 into an operational checklist you can paste into your team’s wiki.
