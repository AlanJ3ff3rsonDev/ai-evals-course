# Lesson 8.3 — Debugging **Multi‑Step Pipelines** (Playbook + Tools)

> **Continuity:**  
> - In **8.1**, you learned to evaluate *single* tool calls.  
> - In **8.2**, we scaled to **agentic systems** with plans, subgoals, and graphs.  
> - In **8.3**, we focus on the *craft of debugging*: how to *see* what happened, *isolate* faults, *prove* causes, and ship **minimal, reliable fixes**. You’ll get a pragmatic, production‑ready playbook used by high‑tempo teams.

---

## Learning Objectives

After this class you will be able to:
1. Instrument pipelines with **replayable traces**, **correlation IDs**, and **state snapshots** suitable for root‑cause analysis.  
2. Use a **failure taxonomy** to classify issues quickly and route to the right fix owner.  
3. Apply the **Four I’s** loop — *Instrument → Inspect → Isolate → Intervene* — to any failure, from a single step to an entire multi‑agent graph.  
4. Run **counterfactual probes** (minimal pairs, ablations, bisection) to prove causality.  
5. Write **fix specs** with acceptance tests and CI gates to prevent regressions.  
6. Build a **debug report** that a PM can read in 5 minutes and an engineer can implement in one sprint.

---

## 0) Mental Model: The Four I’s

```
Instrument → Inspect → Isolate → Intervene
```

- **Instrument**: capture the right signals (events, inputs/outputs, configs, seeds, versions).  
- **Inspect**: visualize the run—timeline, graph, and diffs—then map symptoms to the taxonomy.  
- **Isolate**: prove *where* the fault lives using counterfactuals (change one thing at a time).  
- **Intervene**: design a minimally‑scoped fix with acceptance tests and CI gates.

Keep runs **replayable** (mock non‑deterministic tools; fix seeds), or debugging becomes guesswork.

---

## 1) Minimal Observability Kit (copy & adopt)

### 1.1 Event schema

Every run emits **events**; each event has:
- `run_id` (UUID), `task_id`, `turn_id` (optional), `step_id`, `subgoal_id`  
- `timestamp`, `phase` (`plan|act|observe|reflect|finalize`)  
- `component` (`router|planner|tool_runner|generator|critic`), `version`  
- `input_digest` (first 200 chars or a hash), `output_digest`  
- `cost` (tokens, ms), `status` (`ok|reject|timeout|error`), `error_code`  
- **Artifacts** links: full prompt, tool args, tool result, code cell, stacktrace

Store to NDJSON; example:

```json
{"run_id":"R-82f","task_id":"T-12","step_id":"s3","phase":"act","component":"tool_runner",
 "input_digest":"get_refund_policy{'country':'AR'}","status":"ok",
 "latency_ms":42,"tokens":{"prompt":1020,"gen":46},"version":"orchestrator@1.4.2"}
```

### 1.2 Correlation IDs and seeds
- **Correlation:** `run_id` is the spine; include it in every sub‑component and log line.  
- **Determinism for debug:** `seed`, `temperature`, and **tool fixtures version** recorded per run.

### 1.3 Snapshots
- **State snapshot** after each step: key variables, plan excerpt, budget counters.  
- **Plan graph** snapshot: nodes/edges with statuses (`pending/doing/done/abandoned`).

> With this kit, you can reconstruct any run and compare it against another one deterministically.

---

## 2) Failure Taxonomy (route issues fast)

Use a compact, mutually exclusive taxonomy. Tag each failure with **one primary** and optional **secondaries**.

### A. **Routing/Planning**
- wrong subgoal order, missing dependency, infinite loop, no stopping criteria.

### B. **Retrieval/Evidence**
- doc‑level recall, chunking miss, reranker misorder, freshness leak, distractors.

### C. **Tool Calling**
- wrong tool, schema reject, bad args, exec error/timeout, over‑calling.

### D. **Reasoning/Generation**
- unsupported claim, incomplete answer, wrong format, bad citations, no‑answer mishandled.

### E. **State/Memory**
- stale state, variable overwrite, lost context window, cross‑task leakage.

### F. **Safety/Policy**
- PII leak, unsafe action, unapproved domain, jailbreak/tool injection.

### G. **Infra/Non‑Determinism**
- flaky API, model drift, tokenization mismatch, time‑of‑day effects.

**Why this helps:** it turns chaos into a *queue*. Each tag maps to an owner and a standard diagnostic.

---

## 3) Inspect: Visuals that actually help

- **Timeline view**: step × time with status colors; mark retries/loops.  
- **Graph view**: plan graph with edge labels (“retrieved 3 docs”, “rerank Δ+0.12”).  
- **Diff view**: compare **baseline vs candidate** run; highlight changed prompts, tool args, results, and decisions.  
- **Panel overlay**: step/subgoal/task metrics from Lessons 8.1–8.2 for the same run.

> PM tip: always attach one **good** and one **bad** run side‑by‑side in bug reports.

---

## 4) Isolate: Counterfactual Probes

### 4.1 Minimal pairs
Change exactly **one thing** and re‑run:
- **Prompt token**: swap a synonym or remove one instruction.  
- **k‑sweep**: change top‑k (retrieval) or beam width (planning).  
- **Tool arg**: normalize enum vs free text.  
- **Locale**: pt‑BR ↔ es‑AR.

**Interpretation:** if failure flips to success, the changed factor is **causal** or interacts strongly with the failure.

### 4.2 Ablations
Turn off a module: reranker, critic agent, caching, or a safety rule. Observe metric deltas.

### 4.3 Bisection (binary search for bad commit)
If a regression appeared between `build A` and `build B`:
1. Replay half‑way build; pick the bad half; repeat.  
2. In 3–5 steps you localize to the culprit change (prompt, embeddings, tool version).

### 4.4 Fault injection
- Tool timeouts, stale cache, corrupted field, adversarial doc.  
- Evaluate **recovery** (Lesson 8.2 §6).

---

## 5) Intervene: Design a Minimal Fix (and prove it)

### 5.1 Fix types and examples
- **Prompt fix**: add a *must* constraint; few‑shot negative example (“Do NOT call tools if X”).  
- **Retriever fix**: add domain synonyms; adjust chunking (400→700 tokens, 20% overlap).  
- **Reranker fix**: upgrade model or change top‑N passed to reranker.  
- **Planner fix**: add subgoal template; progress function; loop breaker (“stop if no new evidence in last 2 steps”).  
- **Runtime fix**: JSON repair, retries with backoff, allowlist enforcement.  
- **Data fix**: update stale policy docs; add no‑answer markings.

### 5.2 Acceptance tests (write **before** implementing)
Create a focused **debug set** with 10–30 items reproducing the symptom. Define pass conditions **as metrics** and **as examples** (“these 5 IDs must pass end‑to‑end; loops=0”).

### 5.3 CI gates (prevent regressions)
- Add a **pipeline gate** using CI **lower bounds** on the debug set *and* on the general test set.  
- Example hard gates for a loop bug:
  - `median loop_episodes ≤ 0` on debug set; `≤ 1` on general test.  
  - `true_success (CI lower) ≥ baseline` overall.

---

## 6) Worked Debugging Walkthroughs

### Case 1 — Over‑calling + slow runs (8.1 → tool calling)

**Symptom**: end‑to‑end time ↑; users complain about latency.  
**Inspect**: timeline shows extra calls to `get_store_hours` after answering policy queries.  
**Isolate**: minimal pair (remove “Provide alternatives” line) flips success; necessity judge says those calls are unnecessary.  
**Intervene**: add rule *“Call tools only if facts are not present in evidence or memory”* and a **penalty** in task judge for over‑calling.  
**AC**: overcall_rate ↓ from 0.22 → 0.05 (CI lower < 0.10), p90 latency −35%, true success unchanged.

### Case 2 — Loops in an agent (8.2 → agentic)

**Symptom**: 12‑step loops when computing quarterly metrics.  
**Inspect**: graph shows bouncing between “re‑load CSV” and “summarize”.  
**Isolate**: ablate critic → loop disappears; root cause is critic asking for “more evidence”.  
**Intervene**: add **progress function** + rule “critic may request new evidence only if missing field X/Y/Z”.  
**AC**: loop episodes per task → 0; minimality ratio 1.2 (from 2.7).

### Case 3 — Freshness leak in RAG subgoal

**Symptom**: correct but **future** policy cited.  
**Inspect**: evidence chunk has `version > as_of`.  
**Isolate**: turning on freshness filter fixes; the index joined wrong `as_of`.  
**Intervene**: enforce `doc.version ≤ as_of` at retriever; add freshness metric gate.  
**AC**: freshness ≥ 0.99 with CI lower ≥ 0.98.

---

## 7) Templates you can copy

### 7.1 Debug diary (1 page)

```
Run: R-82f  | Task: T-12  | Build: 2025-08-10  | Owner: @you
Symptom: Looping between steps s5↔s6; p90 wall time 42s; user sees “still working...”
Primary tag: Routing/Planning ; Secondary: Over-calling
Hypothesis: Critic requests new evidence without progress test.
Evidence: Graph diff (v0.7 vs v0.8); critic message excerpts; loop episodes=3
Fix: Add progress function + critic constraint.
AC: loops=0 on debug set; true_success >= baseline; p90 wall ≤ 20s
Status: Implemented → Passed CI → Shipped to canary
```

### 7.2 Fix spec (engineering‑ready)

```
Title: Add progress function and critic constraint to AnalystAgent
Change:
  - planner.prompt += "Only request new evidence if ..."
  - critic.prompt += "Do not ask for more data unless fields A/B/C are missing."
  - orchestrator: track "new_evidence" boolean; end run if false for 2 consecutive steps.
Tests:
  - debug_set_loops.jsonl passes (loops=0, true_success>=baseline)
  - general test: CI lower bounds unchanged
Release plan:
  - ship behind flag; monitor loop episodes on canary for 24h
```

---

## 8) Code Snippets (tiny but handy)

### 8.1 Run diff (prompts + tool args)

```python
import difflib, json

def diff_strings(a, b):
    for line in difflib.unified_diff(a.splitlines(), b.splitlines(), lineterm=""):
        print(line)

def diff_runs(runA, runB):
    for sA, sB in zip(runA["steps"], runB["steps"]):
        if sA["kind"] == "tool_call" and sB["kind"] == "tool_call":
            if sA["tool"] != sB["tool"] or sA["args"] != sB["args"]:
                print(f"Step {sA['step_id']} tool diff:")
                diff_strings(json.dumps(sA["args"],indent=2), json.dumps(sB["args"],indent=2))
```

### 8.2 Loop detector

```python
def loop_episodes(states):
    seen, loops = set(), 0
    for st in states:
        if st in seen: loops += 1
        else: seen.add(st)
    return loops
```

### 8.3 Minimal pair runner (toggle one flag)

```python
def run_with_toggle(task, toggle):
    cfg = {**task["config"], **toggle}
    return orchestrator.run(task["input"], config=cfg, seed=42, mock_tools=True)

def minimal_pair(task, toggle):
    base = run_with_toggle(task, {})
    cand = run_with_toggle(task, toggle)
    return {"base_pass": base.pass_, "cand_pass": cand.pass_, "delta_tokens": cand.tokens-base.tokens}
```

---

## 9) Checklists

### 9.1 Before filing a bug
- [ ] Replayed deterministically (seed + fixtures)  
- [ ] Minimal repro (≤ 3 tasks)  
- [ ] Tagged with taxonomy (A–G)  
- [ ] Attached timeline + graph + diffs  
- [ ] Proposed AC and potential owner

### 9.2 Before shipping a fix
- [ ] Acceptance tests pass on debug set (CI lower)  
- [ ] No regressions on general test (CI lower)  
- [ ] Gates added for the **specific failure metric**  
- [ ] Canary plan defined (what to monitor; rollback condition)

---

## 10) Exercises

1. **Instrument** your pipeline with the event schema; add run diffing. Provide two runs (good/bad) and a **1‑page debug diary**.  
2. **Taxonomy tagging**: label 100 failed tasks; produce a Pareto chart (top 3 tags = 80% of failures).  
3. **Counterfactuals**: for the top failure, design 3 minimal pairs and 1 ablation to prove causality.  
4. **Fix spec & CI**: implement a minimal fix; add an acceptance test set and CI gates; show *before/after* on metrics.  
5. **Robustness drill**: inject a tool timeout and a corrupted field; measure **recovery success** and write the fix plan.

---

## Summary

Debugging multi‑step pipelines is about **systematic visibility and proof**. With the **Four I’s**, a tight **failure taxonomy**, **counterfactual probes**, and **gated fixes**, you turn messy agent traces into predictable, improving systems. This is the bridge between research prototypes and production reliability.

> Next in the chapter: **8.4 — Evaluating Specific Input Data Modalities** (images, tables, audio, and code). We’ll carry over these debugging skills to modality‑specific errors (OCR, ASR, table grounding).

