# Lesson 8.1 — Evaluating **Tool Calling**

> **Continuity with previous lessons:** Up to Chapter 7, you evaluated *text-only* and *RAG* systems: retrieval panels, grounded generation, and end‑to‑end true success with calibrated judges.  
> **From now on** (Chapter 8), the model can **call tools**—APIs, functions, databases, calculators, vector search, payment gateways, etc. Tool calls make outputs more reliable *when correct*, but they introduce **new failure modes** and **new units of analysis** (call/step vs. task). This lesson gives you a complete evaluation playbook for tool-calling systems.

---

## Learning objectives

By the end, you will be able to:
1. Define **data contracts** for tool schemas, traces, and replayable environments.  
2. Measure **step‑level** metrics (schema validity, tool selection accuracy, argument fidelity, execution success) and **task‑level** outcomes (goal completion, safety, budget).  
3. Build **LLM‑as‑judge** prompts for necessity, correctness, and safety of tool use.  
4. Calibrate judges and estimate **bias‑corrected true success** with **CIs**.  
5. Debug recurring issues (bad arguments, over‑calling, non‑deterministic tools) using a **replay harness** and **contract tests**.  
6. Wire the whole thing into **CI gates** so regressions are caught before deploy.

---

## 1) What “Tool Calling” means operationally

A **tool call** is a structured request emitted by the model that conforms to a **schema** (name + JSON arguments). The runtime **executes** the tool and returns a **result** or **error** that becomes part of the next model turn.

**Example**

```
model → tool.call:
  name: "get_refund_policy"
  args: {"country":"AR","product_type":"electronics"}

runtime → tool.result:
  {"window_days":30,"exceptions":["defecto de fabricación: 90 días"]}
```

**Unit of analysis** expands:
- **Call (step)**: one tool invocation.  
- **Turn**: a model message that may include ≥0 tool calls.  
- **Task**: the full conversation/flow (often multi‑step).

**Key design principle:** Evaluate **both** step‑level *and* task‑level—just like we separated retrieval vs. generation in RAG.

---

## 2) Data contracts (so your eval is replayable)

### 2.1 Tool schema (contract)
For each tool, define:
- `tool_name`, `version`
- **JSON schema** for `args` with: types, required fields, enums/ranges, regular expressions
- **Idempotence** and **side‑effect** flags (`read_only: true/false`)
- **Rate limits** and **latency budget** (p50/p90 targets)
- **Safety constraints** (e.g., PII allowed? domains to call?)

Keep schemas in versioned files, e.g., `tools/get_refund_policy.v3.json`.

### 2.2 Trace schema (for eval and replay)
Store every step as a record:

```json
{
  "task_id": "t_10023",
  "turn_id": 3,
  "call_id": "t_10023#3#1",
  "tool": "get_refund_policy@v3",
  "args": {"country":"AR","product_type":"electronics"},
  "args_raw": "{...}",                    // original emitted payload
  "accept_time_ms": 173,
  "result": {"window_days":30,"exceptions":["defecto..."]},
  "error": null,
  "latency_ms": {"queue":2,"exec":24},
  "status": "ok",                         // ok | rejected_by_contract | exec_error | timeout
  "gold": {                               // optional for labeled sets
    "needed": true,                       // whether this call was needed at this point
    "args": {"country":"AR","product_type":"electronics"},
    "result_check": "window_days==30"
  },
  "tags": ["refunds","es-AR"]
}
```

### 2.3 Replay harness
- **Mock mode**: tools return **deterministic fixtures** from gold data.  
- **Live mode**: calls the real API but records version/endpoint.  
- **Safety net**: for non‑idempotent tools (payments), replay uses mock only.

> Without replay, you cannot reproduce or compare runs reliably.

---

## 3) Metrics — from **call** to **task**

We categorize metrics into **Step‑level** and **Task‑level**. Compute CIs by **task** for task metrics, and by **call** for step metrics (but report both).

### 3.1 Step-level (per call)

1. **Schema Validity Rate**  
   - `% of calls whose args validate against JSON schema`.  
   - Catch: type/enum/range errors.

2. **Tool Selection Accuracy** *(needs labels or judge)*  
   - Did the model call the **right tool** for the user intent and context?  
   - Label `gold.needed=true/false` per call or use a “necessity judge” (below).

3. **Argument Fidelity**  
   - Do emitted args match the **gold args** (exact/soft match)?  
   - For strings: normalized exact match; for numbers/dates: tolerance windows.  
   - Report **EM** and **F1** over arg keys.

4. **Execution Success Rate**  
   - `status == ok` and **no runtime error**.  
   - Track **p50/p90 latency** and **rate-limit hit rate**.

5. **Result Consistency**  
   - If tool is deterministic, `% of calls whose result == gold result`.  
   - For stochastic/real‑time tools, check **post‑conditions** (e.g., keys present).

6. **Safety/Policy**  
   - Calls obey **read_only** where required; no forbidden endpoints; PII rules respected.

### 3.2 Task-level (per conversation/flow)

1. **Task Success (raw / judged)**  
   - Did the final output satisfy the user goal **without policy violations**?  
   - Use a **task judge** reading the trace + final answer.

2. **Minimality (Over‑calling)**  
   - Number of **unnecessary tool calls** per task.  
   - `overcall_rate = (# unnecessary calls) / (# calls)`.

3. **Cost/Latency Budget**  
   - Sum of **model tokens** + **tool time**. CI gate on p50 and p90.

4. **Safety**  
   - No side‑effects on mock‑blocked tools; no PII exfiltration; **source allowlist** compliance.  

5. **End‑to‑End True Success**  
   - Bias‑correct judged pass using calibration `(sensitivity, specificity)` (see §6).

**Segments**: language, user intent, tool family, difficulty, and **statefulness** (stateless vs stateful tasks).

---

## 4) Judges you’ll need (short, anchored, JSON‑only)

### 4.1 **Necessity & Selection Judge** (per turn)

**Purpose:** Decide if a tool should be called now, and which one.

```
You decide whether the assistant should call a tool for this user turn.
Consider the conversation so far and the TOOL CATALOG (names + one-line purpose). 
Return JSON only:
{"needed": true|false, "best_tool": "<name or null>", "rationale":"..."}
```

### 4.2 **Argument Correctness Judge** (per call)

```
Given a tool schema (field types and allowed values), the user turn, and the emitted args,
decide if the args are correct for the user request. Use <= 3 sentences in "rationale".
Return JSON: {"args_correct": true|false, "missing_fields":[], "bad_fields":[]}
```

### 4.3 **Task Success Judge** (end-of-task)

```
You evaluate if the task goal was achieved without policy violations. 
Inputs: user goal summary, tool trace (calls + results), final answer.
Return JSON only:
{"pass": true|false, "fail_reasons":["wrong_tool","bad_args","policy_violation","hallucinated_answer","timeout"], "notes":"..."}
```

**Tips**: Keep judges ≤12 lines, temperature=0, and **feed them summaries** (don’t dump full logs). Version your judges as done in Chapters 5 and 7.

---

## 5) Building a labeled set for tool calling

1. **Start from logs**: sample 200–400 tasks with diverse intents.  
2. **SME pass**: for each task, record **desired tool sequence**, **gold args**, and **post‑conditions**.  
3. **Negative patterns**: include tasks where *no tool* is needed, or where multiple tools could solve the job (to test selection).  
4. **Edge cases**: rate‑limit errors, partial tool outages, null results, and **stateful flows** (login → action).  
5. **Dataset fields**: `task_id`, `goal`, `context`, `gold_steps[]`, `gold_postconditions[]`, `budget`, `safety_rules`, `as_of`.

> Keep **time‑aware** fields: tools evolve (API versions), just like documents in RAG.

---

## 6) Calibration & **true success**

Your judges are fallible. Use the same approach from Chapter 5:

- Sample **~200 tasks**, label **pass/fail** by humans.  
- Estimate **sensitivity (s)** and **specificity (t)** for your **task judge**.  
- Convert observed pass rate `p̂` to **true success** `π̂`:

```
π̂ = (p̂ + t − 1) / (s + t − 1)
```

- Bootstrap **by task** to compute 95% CIs.  
- Report **raw pass**, **true success**, and **CI‑lower** in your dashboard.

> Also calibrate the **necessity** and **argument** judges if you use them to score step‑level metrics.

---

## 7) Debugging playbook (symptom → quick test → fix)

### S1 — **Schema rejections** spike
- **Test:** Count `rejected_by_contract`. Inspect `bad_fields`.  
- **Fix:** Fine‑tune/adjust system prompt to echo schema; add **example tool calls**; add **JSON repair post‑processor**.

### S2 — **Wrong tool selection**
- **Test:** Necessity judge disagreement with gold; high `overcall_rate`.  
- **Fix:** Add a **tool catalog** to the prompt; strengthen intent routing; add negative examples (when **not** to call).

### S3 — **Bad arguments** (right tool, wrong values)
- **Test:** Low **Argument Fidelity EM/F1**.  
- **Fix:** Map from entities in user text to schema enums (country codes, product types); add **entity resolver** tool; require confirmation (“I will use country=AR—correct?”) for risky fields.

### S4 — **Execution errors / timeouts**
- **Test:** `exec_error` proportion and p90 latency.  
- **Fix:** Retries with backoff; shorter **timeout**; tool‑side caching; move heavy tools out of the critical path.

### S5 — **Over‑calling (chatter)**
- **Test:** `overcall_rate` high; many tool calls don’t affect final answer.  
- **Fix:** Prompt rule: *“Only call tools when evidence or computation is required otherwise impossible to answer.”* Add a **penalty** in the judge for unnecessary calls.

### S6 — **Safety & side‑effects**
- **Test:** Any call to non‑allowlisted domains; PII in args; write calls in mock mode.  
- **Fix:** **Runtime guard** that denies non‑allowlisted tools; PII scrubber; separate **read_only** from **mutating** tools and require explicit confirmation before mutating calls.

### S7 — **Non‑deterministic tool results** break tests
- **Test:** Replays differ between runs.  
- **Fix:** In eval, **mock** tools with fixed fixtures; for live runs, evaluate **post‑conditions** (keys present, value ranges) rather than exact equality.

---

## 8) Reporting: Panels & Slices

**Step panel** (by call): Schema Validity, Selection Accuracy, Argument Fidelity (EM/F1), Execution Success, Result Consistency, p50/p90 latency.  
**Task panel**: Raw Pass, **True Success** (CIs), Over‑calling, p50/p90 total latency & tokens, Safety incidents.  
**Slices**: language, intent, tool family, API version, statefulness.  
Include **examples**: 3 strongest and 3 weakest tasks with traces (redacted).

---

## 9) CI gates (sample thresholds; tune to risk)

```
Step-level (CI lower by call):
- Schema validity ≥ 0.98
- Argument fidelity EM ≥ 0.90
- Execution success ≥ 0.97
- p90 tool latency ≤ 500 ms (per critical tool)

Task-level (CI lower by task):
- True success ≥ 0.85 overall; ≥ 0.80 in pt-BR and es-AR
- Overcall rate ≤ 0.10
- Safety incidents = 0 (hard gate)
```

Add **honeypots**: tasks designed to tempt dangerous calls (e.g., external HTTP POST).

---

## 10) Minimal code sketches

### 10.1 Validating args against JSON schema

```python
from jsonschema import validate, ValidationError

def is_valid_args(schema, args):
    try:
        validate(instance=args, schema=schema)
        return True, []
    except ValidationError as e:
        return False, [str(e)]
```

### 10.2 Argument fidelity (exact/soft match)

```python
def arg_fidelity(gold, pred):
    keys = set(gold) | set(pred)
    em_hits = sum(1 for k in keys if str(gold.get(k)).lower() == str(pred.get(k)).lower())
    em = em_hits / max(1, len(keys))

    # simple soft match: numeric tolerance for floats/ints
    soft_hits = 0
    for k in keys:
        g, p = gold.get(k), pred.get(k)
        try:
            if abs(float(g) - float(p)) <= 1e-6: soft_hits += 1
        except Exception:
            soft_hits += 1 if str(g).strip().lower() == str(p).strip().lower() else 0
    f1_like = soft_hits / max(1, len(keys))
    return {"exact_match": em, "f1_like": f1_like}
```

### 10.3 Over‑calling rate

```python
def overcall_rate(calls, needed_flags):
    unnecessary = sum(1 for need in needed_flags if need is False)
    return unnecessary / max(1, len(calls))
```

### 10.4 Bias‑corrected true success (bootstrap by task)

```python
import random

def true_success(pass_flags, s, t, n_boot=2000):
    # observed pass
    p_hat = sum(pass_flags)/len(pass_flags)
    pi_hat = (p_hat + t - 1) / max(1e-6, (s + t - 1))

    boots = []
    for _ in range(n_boot):
        sample = [pass_flags[random.randrange(len(pass_flags))] for _ in range(len(pass_flags))]
        p = sum(sample)/len(sample)
        boots.append((p + t - 1)/max(1e-6,(s + t - 1)))
    boots.sort()
    return {"true_success": pi_hat, "ci_lower": boots[int(0.025*n_boot)], "ci_upper": boots[int(0.975*n_boot)]}
```

---

## 11) Designing great prompts for tool callers

**System rules (copy/paste):**

```
You may call tools when necessary to retrieve data or perform computations.
Follow the tool's JSON schema exactly. 
If the user request can be answered from prior context without a tool, do not call a tool.
Before mutating state, summarize the action and ask for confirmation.
Always include rationales in plain text only if asked; otherwise emit a tool call or a short answer.
```

**Few-shot examples:** Include 3–5 examples of **correct** and **incorrect** calls (especially boundary cases).

**Catalog:** Provide a one‑line description for each tool and **disambiguate** tools with similar names (e.g., `get_refund_policy` vs `get_return_policy`).

---

## 12) Safety specific to tool calling

- **Tool injection**: treat tool outputs as **untrusted**; normalize/escape; prohibit executing code returned by tools unless in a sandbox.  
- **Secrets**: never echo access tokens; redact in traces.  
- **Write operations**: require **confirmation** or **safe mode** (mock) in evaluation.  
- **Allowlist** tools and domains; deny‑by‑default in the runtime layer.  
- **Rate limits**: ensure exponential backoff and **circuit breakers** (stop calling a failing tool). Evaluate with **error‑storm scenarios**.

---

## 13) Worked example (mini)

**User:** “Qual é o prazo de reembolso para eletrônicos na Argentina?”  
**Intended behavior:**  
1) Select `get_refund_policy`.  
2) Args: `country="AR", product_type="electronics"`.  
3) Return answer grounded in tool result, no extra tools.

**Metrics outcome (ideal):**
- Step: schema_valid=1, argument_em=1, execution_success=1, latency=42ms.  
- Task: pass=true, overcall_rate=0, tokens within budget.

**Common regressions to watch in this example:**
- Calls **get_return_policy** instead of **get_refund_policy** → selection error.  
- Args country `"Argentina"` (string) instead of `"AR"` (enum) → schema reject.  
- Over‑calling: `get_store_hours` afterwards → unnecessary.  
- Tool returns `{window_days: null}` → the model must **abstain** or request clarification.

---

## 14) Exercises (to cement the lesson)

1. **Trace dataset:** Build a 150‑task labeled set across pt‑BR and es‑AR with gold tool sequences and args. Include ≥ 20 tasks where **no tool** should be called.  
2. **Replay harness:** Implement mock fixtures for two tools (read‑only + mutating). Verify deterministic replays.  
3. **Panels:** Compute step and task panels with **CIs**, sliced by language and tool family.  
4. **Judges & calibration:** Write necessity and task success judges; label 200 tasks manually to estimate `(s, t)`; report **true success**.  
5. **CI gates:** Add gates from §9 and simulate a regression (argument EM drops to 0.8). Show the build fails and explain **why** using the panels.  
6. **Safety drill:** Create three unsafe scenarios (PII in args, non‑allowlisted domain, write call without confirmation). Ensure your runtime blocks them and your evaluation **flags** them.

---

## Summary

Tool calling shifts evaluation from single‑shot text to **programmed actions**. To keep quality high you must:  
- **Version schemas and traces**, and make runs **replayable**.  
- Measure **step‑level** integrity (schema validity, selection, arguments, execution) and **task‑level** outcomes (success, over‑calling, safety, budget).  
- Use **short, anchored judges** and **calibrate** to report **true success** with **CIs**.  
- Maintain a **debug playbook** and **CI gates** so regressions never reach users.

With this foundation, you’re ready for **Lesson 8.2 — Agentic Systems**, where multiple tools and planning come together in multi‑step pipelines.
