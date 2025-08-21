# Lesson 6.3 — Automated Evaluation of Multi‑Turn Traces (Code You Can Run)

> **Position in course:** Chapter 6 (“Evaluating Multi‑Turn Conversations”)  
> **Previously (6.1–6.2):** We defined the model for conversations (events → `DerivedState`), picked metrics at three layers (turn, step, conversation), and wrote ScenarioSpecs, gates, rubrics, and a small rule library.  
> **This lesson (6.3):** We translate that plan into **runnable code**: a tiny, dependency‑light evaluator that ingests raw traces, builds state, runs rules, calls judges, and emits a report with **confidence intervals**, segment breakdowns, and raw‑trace links.

> **What you’ll get**
> - A **minimal Python package**: reducers, rules, judge wrappers, bootstrapper, and a CLI.  
> - Clear data contracts (JSON).  
> - Pluggable judge interface so you can swap in your LLM provider.  
> - Outputs: CSVs for metrics and per‑conversation results (easy to feed a dashboard).

---

## 0) Repository layout (drop‑in)

```
/eval_multi_turn/
  specs/                       # ScenarioSpec YAML files
  data/                        # frozen input traces (JSONL)
  judges/                      # prompts, schemas (from 6.2)
  src/
    mt_eval/
      __init__.py
      contracts.py             # data classes and schemas
      reducer.py               # events -> DerivedState
      rules.py                 # small rule library
      digest.py                # conversation digest
      judge_client.py          # pluggable LLM client
      judge_prompts.py         # default rubrics
      evaluate.py              # orchestration
      bootstrap.py             # CIs (by conversation)
      reporting.py             # CSV/pretty tables
  scripts/
    run_eval.py                # CLI entrypoint
```

All modules below are included inline; copy into your repo, or adapt names.

---

## 1) Data contracts (JSON)

### 1.1 Event log (input)
One conversation per JSON object (in JSONL). Keep events atomic.

```json
{
  "conversation_id": "conv_001",
  "segment": {"country": "BR", "language": "pt-BR", "channel": "whatsapp"},
  "scenario_id": "collections_first_message_pt",
  "events": [
    {"type": "user_msg", "turn": 1, "text": "Oi, posso pagar em duas vezes?", "timestamp": "2025-08-03T10:00:00Z"},
    {"type": "assistant_msg", "turn": 1, "text": "Posso ajudar! Qual seu idioma preferido?", "meta": {"intent": "clarify_lang"}},
    {"type": "user_msg", "turn": 2, "text": "pt-BR", "timestamp": "2025-08-03T10:00:05Z"},
    {"type": "tool_call", "turn": 3, "name": "crm_lookup", "args": {"debtor_id": 842}},
    {"type": "tool_result", "turn": 3, "name": "crm_lookup", "result": {"amount_due": 420.0, "due_date": "2025-08-20"}, "status": "ok"},
    {"type": "assistant_msg", "turn": 4, "text": "João, o valor é R$420 com vencimento em 20/08. Podemos gerar boleto ou cartão. Segue link...", "meta": {"intent": "compose_first_message"}}
  ]
}
```

### 1.2 ScenarioSpec (YAML)
Exactly the structure from **6.2 §1.1** (copy that file into `/specs/…` and load it).

---

## 2) Core modules (copy/paste)

> The code is pure‑Python (no external deps beyond stdlib). If you used `true_success.py` (Lesson 5.7) and `groupwise_eval.py` (Lesson 5.8), they plug in here.

### 2.1 `contracts.py` — types & helpers

```python
# src/mt_eval/contracts.py
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class Event:
    type: str
    turn: int
    text: Optional[str] = None
    name: Optional[str] = None
    args: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    timestamp: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

@dataclass
class Conversation:
    conversation_id: str
    segment: Dict[str, str]
    scenario_id: str
    events: List[Event]

@dataclass
class DerivedState:
    facts: Dict[str, Any] = field(default_factory=dict)
    constraints: Dict[str, Any] = field(default_factory=dict)
    safety: Dict[str, Any] = field(default_factory=lambda: {"pii_items": set(), "violations": []})
    outstanding_questions: List[str] = field(default_factory=list)
    tool_index: List[Dict[str, Any]] = field(default_factory=list)
    history: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)  # per key history
```

### 2.2 `reducer.py` — events → `DerivedState`

```python
# src/mt_eval/reducer.py
from typing import Dict, Any, List
from .contracts import Event, DerivedState

def init_state() -> DerivedState:
    return DerivedState()

def update_state(state: DerivedState, ev: Event) -> DerivedState:
    # Update tool index
    if ev.type == "tool_call":
        state.tool_index.append({"turn": ev.turn, "name": ev.name, "args": ev.args})
    if ev.type == "tool_result":
        state.tool_index.append({"turn": ev.turn, "name": ev.name, "result": ev.result, "status": ev.status})
        if ev.name == "crm_lookup" and ev.status == "ok":
            _set_fact(state, "amount_due", ev.result.get("amount_due"), ev.turn, source=f"{ev.name}_result")
            _set_fact(state, "due_date", ev.result.get("due_date"), ev.turn, source=f"{ev.name}_result")
    # Very simple language detector for demo
    if ev.type == "user_msg" and ev.text:
        if "pt" in (ev.meta or {}).get("lang", "pt-BR") or "R$" in ev.text:
            _set_fact(state, "language", "pt-BR", ev.turn, "user_msg")
    if ev.type == "assistant_msg" and ev.meta:
        intent = ev.meta.get("intent")
        if intent == "compose_first_message":
            _set_fact(state, "message_sent", True, ev.turn, "assistant_msg")
    return state

def _set_fact(state: DerivedState, key: str, value: Any, turn: int, source: str):
    if value is None: 
        return
    state.facts[key] = value
    state.history.setdefault(key, []).append({"turn": turn, "value": value, "source": source})
```

### 2.3 `rules.py` — small rule library

```python
# src/mt_eval/rules.py
from typing import Dict, Any, List
from .contracts import Event, DerivedState

def required_facts_before_action(events: List[Event], required: List[str], action_intent: str) -> bool:
    """Return True if 'action_intent' occurs only after all required facts are present."""
    facts = set()
    for ev in events:
        if ev.type == "tool_result" and ev.name == "crm_lookup" and ev.status == "ok":
            if "amount_due" in ev.result: facts.add("amount_due")
            if "due_date" in ev.result: facts.add("due_date")
        if ev.type == "assistant_msg" and (ev.meta or {}).get("intent") == action_intent:
            return all(r in facts for r in required)
    return False

def find_contradictions(events: List[Event], state: DerivedState) -> List[Dict[str, Any]]:
    contradictions = []
    for key, hist in state.history.items():
        vals = {h["value"] for h in hist}
        if len(vals) > 1:
            contradictions.append({"key": key, "values": list(vals)})
    return contradictions

def detect_loops(events: List[Event], intent: str, k: int = 3) -> bool:
    count = 0
    for ev in events:
        if ev.type == "assistant_msg" and (ev.meta or {}).get("intent") == intent:
            count += 1
    return count >= k

def detect_tool_thrashing(state: DerivedState, budget: int = 5) -> bool:
    return len([x for x in state.tool_index if "name" in x]) > budget
```

### 2.4 `digest.py` — compact conversation digest

```python
# src/mt_eval/digest.py
from .contracts import Conversation, DerivedState, Event

def build_digest(conv: Conversation, state: DerivedState) -> str:
    lines = []
    lines.append(f"SCENARIO: {conv.scenario_id}")
    # Facts
    f = state.facts
    facts_line = "FACTS: " + "; ".join([f"{k}={v}" for k,v in f.items()])
    lines.append(facts_line if len(facts_line) < 220 else facts_line[:220] + "…")
    # Decisions (simple)
    for ev in conv.events:
        if ev.type == "tool_call":
            lines.append(f"T{ev.turn}: call {ev.name}({short(ev.args)})")
        if ev.type == "tool_result":
            lines.append(f"T{ev.turn}: {ev.name} -> {short(ev.result)} [{ev.status}]")
        if ev.type == "assistant_msg" and ev.meta and ev.meta.get("intent"):
            lines.append(f"T{ev.turn}: intent={ev.meta['intent']}")
    # Outcome
    goal = "true" if f.get("message_sent") else "false"
    lines.append(f"OUTCOME: goal_completed={goal}")
    return "\n".join(lines)

def short(obj, n=80):
    import json
    try:
        s = json.dumps(obj, ensure_ascii=False)
        return s if len(s) <= n else s[:n] + "…"
    except Exception:
        return str(obj)[:n]
```

### 2.5 `judge_client.py` — pluggable interface

```python
# src/mt_eval/judge_client.py
from typing import Dict, Any

class JudgeClient:
    """
    Minimal interface. Implement `score_turn`, `score_steps`, `score_conversation`
    using your LLM provider. Always return JSON per the schemas you adopted in 6.2.
    """
    def __init__(self, model_name: str = "your-judge-model", temperature: float = 0.0):
        self.model_name = model_name
        self.temperature = temperature

    def score_turn(self, latest_user: str, assistant: str, state_snippet: Dict[str, Any]) -> Dict[str, Any]:
        # TODO: Replace with real LLM call. Here we return a stub for demos.
        return {"scores": {"instruction": 4, "faithfulness": 4, "tone": 4, "actionability": 4, "conciseness": 4},
                "checks": {"safety_policy": True, "schema_valid": True, "positive_refusal": False},
                "overall_pass": True, "notes": "stub"}

    def score_steps(self, tool_timeline: str) -> Dict[str, Any]:
        return {"scores": {"plan": 4, "args": 4, "constraints": 4, "repair": 4},
                "checks": {"no_tool_thrashing": True, "schema_valid": True},
                "overall_pass": True, "notes": "stub"}

    def score_conversation(self, scenario_spec: str, digest: str, final_state: Dict[str, Any]) -> Dict[str, Any]:
        return {"scores": {"goal": 4, "faithfulness": 4, "ux": 4, "efficiency": 4},
                "checks": {"safety_policy_global": True, "schema_valid": True},
                "overall_pass": True, "notes": "stub"}
```

### 2.6 `bootstrap.py` — CIs (by conversation)

```python
# src/mt_eval/bootstrap.py
import random

def bootstrap_mean(values, iters=2000, alpha=0.05):
    if not values:
        return 0.0, 0.0, 0.0
    n = len(values)
    means = []
    for _ in range(iters):
        idx = [random.randrange(n) for _ in range(n)]
        means.append(sum(values[i] for i in idx) / n)
    means.sort()
    mean = sum(means) / len(means)
    lo = means[int(alpha/2 * len(means))]
    hi = means[int((1-alpha/2) * len(means)) - 1]
    return mean, lo, hi
```

### 2.7 `evaluate.py` — orchestration

```python
# src/mt_eval/evaluate.py
import json
from collections import defaultdict
from typing import Dict, Any, List
from .contracts import Conversation, Event
from .reducer import init_state, update_state
from .rules import required_facts_before_action, find_contradictions, detect_loops, detect_tool_thrashing
from .digest import build_digest
from .judge_client import JudgeClient
from .bootstrap import bootstrap_mean

def load_conversations(path_jsonl: str) -> List[Conversation]:
    convs = []
    with open(path_jsonl, "r", encoding="utf-8") as f:
        for line in f:
            raw = json.loads(line)
            events = [Event(**e) for e in raw["events"]]
            convs.append(Conversation(raw["conversation_id"], raw["segment"], raw["scenario_id"], events))
    return convs

def evaluate_conversation(conv: Conversation, spec: Dict[str, Any], judge: JudgeClient) -> Dict[str, Any]:
    # 1) Build state
    state = init_state()
    for ev in conv.events:
        state = update_state(state, ev)

    # 2) Run rules
    req = spec["preconditions"]["required_facts"]
    clarification_ok = required_facts_before_action(conv.events, req, action_intent="compose_first_message")
    contradictions = find_contradictions(conv.events, state)
    loops = detect_loops(conv.events, intent="clarify_lang", k=3)
    thrash = detect_tool_thrashing(state, budget=5)

    # 3) Judges
    #   For demo, call only the conversation judge with a digest.
    digest = build_digest(conv, state)
    convo = judge.score_conversation(json.dumps(spec, ensure_ascii=False), digest, state.facts)

    # 4) Pack result (one row per conversation)
    return {
        "conversation_id": conv.conversation_id,
        "segment": conv.segment,
        "scenario_id": conv.scenario_id,
        "goal_completed_obs": 1 if state.facts.get("message_sent") else 0,
        "clarification_ok": int(clarification_ok),
        "contradictions": len(contradictions),
        "loops": int(loops),
        "thrashing": int(thrash),
        "judge_overall_pass": int(convo["overall_pass"]),
        "judge_goal_score": convo["scores"]["goal"],
        "digest": digest
    }

def aggregate(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Bootstrap by conversation
    from statistics import mean
    def col(name): return [r[name] for r in results]
    report = {
        "N_conversations": len(results),
        "goal_completed_obs": bootstrap_mean(col("goal_completed_obs")),
        "judge_overall_pass": bootstrap_mean(col("judge_overall_pass")),
        "clarification_ok": bootstrap_mean(col("clarification_ok")),
        "contradictions_rate": bootstrap_mean([1 if r["contradictions"]>0 else 0 for r in results]),
        "loops_rate": bootstrap_mean(col("loops")),
        "thrashing_rate": bootstrap_mean(col("thrashing")),
        "goal_score_mean": bootstrap_mean(col("judge_goal_score")),
    }
    return report
```

### 2.8 `reporting.py` — CSVs

```python
# src/mt_eval/reporting.py
import csv
from typing import List, Dict, Any

def write_per_conversation(rows: List[Dict[str, Any]], path: str):
    if not rows: return
    keys = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(r)

def write_summary(summary: Dict[str, Any], path: str):
    # Flatten CI triples (mean, lo, hi)
    flat = {}
    for k, v in summary.items():
        if isinstance(v, tuple) and len(v) == 3:
            flat[f"{k}_mean"] = v[0]; flat[f"{k}_lo"] = v[1]; flat[f"{k}_hi"] = v[2]
        else:
            flat[k] = v
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(flat.keys()))
        w.writeheader()
        w.writerow(flat)
```

### 2.9 `scripts/run_eval.py` — CLI

```python
# scripts/run_eval.py
import argparse, json, yaml, os
from mt_eval.evaluate import load_conversations, evaluate_conversation, aggregate
from mt_eval.judge_client import JudgeClient
from mt_eval.reporting import write_per_conversation, write_summary

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Path to JSONL with conversations")
    ap.add_argument("--spec", required=True, help="Path to ScenarioSpec YAML")
    ap.add_argument("--outdir", required=True, help="Output directory")
    args = ap.parse_args()

    with open(args.spec, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    convs = load_conversations(args.data)
    judge = JudgeClient(model_name="your-judge", temperature=0.0)

    rows = [evaluate_conversation(c, spec, judge) for c in convs]
    summary = aggregate(rows)

    os.makedirs(args.outdir, exist_ok=True)
    write_per_conversation(rows, os.path.join(args.outdir, "per_conversation.csv"))
    write_summary(summary, os.path.join(args.outdir, "summary.csv"))
    print("Wrote:", args.outdir)

if __name__ == "__main__":
    main()
```

> Replace the `JudgeClient` stubs with real calls to your LLM provider, using the **rubrics and schemas** from Lesson 6.2. Keep `temperature=0` for determinism.

---

## 3) How to integrate **true success** (from Chapter 5)

Right now the summary table reports **observed** rates (e.g., `judge_overall_pass`). To estimate **bias‑corrected true success**, plug in your calibration confusion `(tp,fp,fn,tn)` per segment and call the `parametric_bootstrap_ci` function from **Lesson 5.7’s `true_success.py`** on the conversation‑level pass/fail.

**Sketch:**

```python
from true_success import Confusion, parametric_bootstrap_ci

def true_success_rate(rows, calib: Confusion):
    K = sum(r["judge_overall_pass"] for r in rows)     # passes observed by the conversation judge
    N = len(rows)
    mean, lo, hi = parametric_bootstrap_ci(K, N, calib, iters=5000)
    return mean, lo, hi
```

Compute **per‑segment** and then a **weighted overall** as in Lesson 5.7. Gate releases on the **CI lower bound**.

---

## 4) Segments & group bootstrap

Bootstrap **by conversation** (not by turn). When you need BR vs AR or channel splits, filter the `rows` list per segment, compute the same aggregates, and display a table:

```
metric | overall mean [CI] | BR mean [CI] | AR mean [CI] | WhatsApp | Email
```

Use production traffic mix as weights (see Lesson 5.7’s `segment_estimates`).

---

## 5) End‑to‑end dry‑run (with the stubs)

1. Put 10–20 toy conversations in `data/sample.jsonl` following the event contract.  
2. Save your ScenarioSpec from Lesson 6.2 in `specs/collections_first_message_pt.yaml`.  
3. Run:
   ```bash
   python scripts/run_eval.py --data data/sample.jsonl \
       --spec specs/collections_first_message_pt.yaml \
       --outdir reports/demo_run
   ```
4. Open `reports/demo_run/per_conversation.csv` and `summary.csv`. With the stub judges, numbers sit near 0.8–1.0; with a real judge they’ll vary.

---

## 6) Hardening tips (productionizing)

- **Caching:** cache judge responses keyed by `(prompt_id, model_id, digest_hash)` to save cost.  
- **Trace links:** store a pointer to the raw conversation (e.g., S3 path) in each CSV row.  
- **Versioning:** log `judge_prompt_id`, `model_id`, `temperature`, `top_p`, `schema_version`, `ruleset_version`, `spec_version`.  
- **Monitoring split:** sample a weekly set from production; run the evaluator; alert on shifts in honeypots and on **judge agreement** vs a 30‑item human audit.  
- **Cost & latency:** add columns for token counts or ms per judge call; show **quality–cost curves**.  
- **Security:** sanitize raw texts before logging; redact PII in digests meant for dashboards.

---

## 7) Frequently asked questions

**Q: Can we evaluate long conversations cheaply?**  
A: Yes—use **digests** (small bullets) for conversation judges and call **turn judges only on action turns**. Keep prompts short; pass only the **state slice** relevant to the action.

**Q: How do we avoid double‑dipping for selection?**  
A: If you **select** a candidate reply using Judge A, evaluate with **Judge B** (different prompt/model). Or do nested splits: pick selection params on **design**, measure on **validation/test**.

**Q: What if tool results are private?**  
A: Hash or ID‑reference sensitive fields in `DerivedState`; judges can still verify **consistency** without seeing raw values.

---

## 8) Exercises

1. **Wire your data.** Convert 50 real conversations into the event schema and run the CLI. Verify the digest reads like a concise story.  
2. **Replace the stub.** Implement `JudgeClient.score_conversation` using your LLM. Keep the JSON schema from 6.2.  
3. **Add a rule.** Implement `repair_timer` that starts on any tool error and requires a fix within 2 turns. Add it to the CSV.  
4. **True success.** Using 200 calibration conversations with human labels, compute `(s,t)` for the conversation judge. Report **bias‑corrected** goal completion with CIs, overall and by country.  
5. **Dashboard.** Load the CSVs into your BI tool (or pandas) and recreate the outcome/process/experience sections from Lesson 6.1.

---

## Summary

You now have a **working evaluator** for multi‑turn conversations: it reads event logs, builds `DerivedState`, runs rules that surface looping/contradictions/thrashing, produces a **digest** for an LLM judge, and aggregates results with **group‑level bootstrap CIs**. Plug in the **true‑success correction** from Chapter 5 to make numbers decision‑grade. In **6.4**, we’ll tackle multi‑turn–specific pitfalls and show diagnostics that quickly explain regressions.
