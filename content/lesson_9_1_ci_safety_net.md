# Lesson 9.1 — **CI: Building a Safety Net Against Regressions**

> **Continuity:** In Chapter 8 you learned how to measure tool calls, agents, RAG, and non‑text modalities with calibrated judges and CI gates. **Chapter 9** shows how to wire those practices into an automated **Continuous Integration (CI)** loop so every change is tested before it reaches users.

---

## Learning Objectives

After this lesson you will be able to:
1. Design a **CI test pyramid for LLM systems** (tripwires → component tests → end‑to‑end checks → robustness suites).  
2. Make your runs **replayable**: version datasets, prompts, indexes, seeds, and judge prompts.  
3. Handle **non‑determinism** with confidence intervals, equivalence tests, and flake controls.  
4. Implement **gates** for correctness, grounding, safety, cost, and latency — including **worst‑slice** gates.  
5. Ship a practical CI workflow (sample YAML + Python) that comments on pull requests with diffs and artifacts.  

---

## 1) Why CI for LLMs is different

Classical CI runs unit tests and integration tests that are **deterministic**. LLM systems add new failure paths:

- **Model drift:** provider pushes a silent model update.  
- **Prompt drift:** small copy edits change behavior.  
- **Data/index drift:** your RAG index re‑built with different chunking or freshness window.  
- **Tool drift:** API returns a new field or starts rate‑limiting.  
- **Judge drift:** a refactor alters automated evaluators’ strictness.

**CI is your seatbelt**: it runs fast **tripwires** and representative **end‑to‑end** evals *on every change* and blocks merges when users would be worse off.

---

## 2) The CI Test Pyramid for LLM Systems

Think in **four layers**, each faster than the one above it. The idea: catch most regressions early, leave only rare issues for slower suites.

### L0 — Static & Schema Checks (seconds)
- Lint prompts and judge prompts (no unescaped braces, JSON schema valid).  
- Validate **tool schemas** and **action arguments** examples.  
- Scan for secrets and unsafe calls in eval tools.

### L1 — Tripwires (sub‑minute)
Lightweight, high‑precision indicators (recap from 8.5):
- **Hallucination rate** on a 50‑item canary set.  
- **Grounding precision** on 50 nuggetized QA pairs.  
- **Over‑call rate** in 30 synthetic tool‑use tasks.  
- **Loop episodes** on 20 agent traces.  
- **OCR/ASR WER** subsets (10–20 items).  
- **Cost & latency** on 20 “hot paths”.

### L2 — Component Tests (minutes)
- **Retriever**: recall@k on nuggetized facts; freshness pass.  
- **Reranker**: nDCG, support precision.  
- **Tool runner**: execution success on mocked fixtures.  
- **Perception**: OCR/ASR on gold subsets.  
- **Reasoners**: program synthesis tasks with execution‑based scoring.

### L3 — End‑to‑End & Slice Gates (5–15 minutes)
- 500–1,000 items stratified by **task type × locale × difficulty**.  
- **Calibrated end‑to‑end judge** → **true success** with CI lower bounds.  
- **Worst‑slice gate**: the minimum CI across slices must stay above threshold.  
- **Robustness mini‑suite**: blur, decimal‑comma, code‑switching, long table.

**Cadence:** L0–L1 run **pre‑merge** on every PR. L2–L3 run on PRs that touch the model/prompt/index/tooling (detected by file paths or labels), and **nightly** regardless.

---

## 3) Make Runs Replayable (the CI “bill of materials”)

> If it’s not versioned, you cannot blame (or exonerate) it.

Store with every CI run:
- **Dataset version**: immutable IDs + item metadata (locale, as_of).  
- **Gold labels**: field/value boxes, SQL results, transcripts, etc.  
- **Prompt versions**: user, system, tool, judge prompts (hash + content).  
- **Model & provider**: e.g., `gpt‑X‑2025‑06‑01`.  
- **Index fingerprint**: commit of chunker, parameters, source doc versions.  
- **Tool fixtures**: mock responses and schemas.  
- **Seeds**: for sampling and any stochastic decoding.  
- **Environment**: docker image hash, Python deps lock.

> Put this **Run Manifest** next to metrics so diffs are explainable.

---

## 4) Non‑Determinism: turn flakiness into math

### 4.1 Confidence intervals (Wilson)
Grade pass/fail at item level; report **95% CI** for rates. Gate on the **lower bound**.

```python
def wilson_ci_lower(successes, total, z=1.96):
    if total == 0: return 0.0
    p = successes/total
    denom = 1 + z*z/total
    center = p + z*z/(2*total)
    margin = z*((p*(1-p)/total + z*z/(4*total*total))**0.5)
    return (center - margin)/denom
```

### 4.2 Equivalence tests for latency/cost
Instead of “< 2.0s”, test **equivalence** around a target (e.g., ±10%).

### 4.3 Flake controls
- **Deterministic decoding** in CI (temperature 0–0.2).  
- **Fixed seeds** and **max tokens**.  
- **Retry‑on‑network** only; do **not** regrade on judge disagreement (that hides bugs).

---

## 5) Gates that actually protect users

Pick **few but sharp** gates, tuned by risk tier (from 8.6). Example for a fintech assistant:

```
Global
- e2e_true_success (CI lower) ≥ 0.85
- worst_slice (CI lower across locale×task_type) ≥ 0.80
- safety_incidents = 0

RAG
- grounded_precision ≥ 0.92 ; uncited_claim_rate ≤ 0.03 ; freshness_violations = 0

Tools
- action_correctness ≥ 0.92 ; execution_success ≥ 0.97 ; over_call_rate ≤ 0.10

Agents
- loop_episodes (median) = 0 ; steps_used ≤ 0.8 * max_steps

Modalities
- OCR_WER ≤ 0.08 (subset) ; ASR_WER ≤ 0.12 telephone-band
- locale_decimal_comma success ≥ 0.95
```

**Fail fast:** L1 tripwires should abort later suites if they breach — save time and money.

---

## 6) A Practical CI Workflow

### 6.1 Repository layout

```
evals/
  datasets/               # immutable items + metadata
  gold/                   # gold labels (doc boxes, SQL results, etc.)
  judges/                 # prompts + configs + calibration sets
  suites/
    l1_tripwires.yaml
    l2_components.yaml
    l3_end2end.yaml
  runners/                # Python entrypoints (sharded)
  reports/                # generated JSON/HTML
  manifests/              # run manifests
```

### 6.2 GitHub Actions (sketch)

```yaml
name: eval-ci
on:
  pull_request:
    paths:
      - "prompts/**"
      - "index/**"
      - "tools/**"
      - "evals/**"
jobs:
  tripwires:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: "3.11"}
      - run: pip install -r evals/requirements.txt
      - run: python evals/runners/run_tripwires.py --out reports/tripwires.json
      - run: python evals/runners/apply_gates.py --in reports/tripwires.json --level L1
  end2end:
    if: ${{ always() && github.event.pull_request.changed_files > 0 }}
    needs: tripwires
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: "3.11"}
      - run: pip install -r evals/requirements.txt
      - run: python evals/runners/run_end2end.py --shards 4 --out reports/e2e.json
      - run: python evals/runners/apply_gates.py --in reports/e2e.json --level L3
      - run: python evals/runners/comment_pr.py --diff reports/e2e.json
```

### 6.3 PR comment (human‑friendly)

```
📊 Evals for PR #123
- True Success: 0.862 → 0.876  (Δ +1.4pts)  ✅
- Worst Slice (pt-BR × policy): 0.807 → 0.782  (CI lower)  ❌ GATE BREACH
- Over-call Rate: 0.11 → 0.07  ✅
- Hallucination Rate: 0.04 → 0.03  ✅

Artifacts: run manifest, failing traces (12), robustness deltas (+2–4 pts lost on blur).
Action: see debug diary link; suggested fix: stricter grounding rule on “prazo de entrega”.
```

### 6.4 Sharding & caching
Split long suites into shards (by hash of item_id). Cache **retrieved chunks**, **tool fixtures**, and **ASR/OCR outputs**; only recompute when inputs change.

---

## 7) Golden Runs, Diffs & Drill‑downs

**Golden run** = last known good baseline (frozen manifest). For every CI run:
1. Compare **observed** metrics vs golden.  
2. If gates breach, attach **diff tables** per slice, and **top failures** by impact.  
3. Link to **traces** (prompts, retrieved chunks, tool calls, citations).  
4. Update **debug diary** with hypothesis and ACs (acceptance criteria).

**Tip:** keep a small **debug set** for each recurring failure mode (from 8.3). Test that set first.

---

## 8) Safety, Privacy & Fixtures

- **Red‑teaming tripwires:** prompt‑injection, system prompt leaks, tool misuse.  
- **PII in fixtures:** use **synthetic but realistic** CNPJ/CUIT, names, addresses.  
- **Tool isolation:** run against **sandbox services**; never hit production in CI.  
- **Judge safety:** judges should **never** call external tools or write files.

---

## 9) Robustness Suites in CI

Run micro‑versions **pre‑merge** (e.g., 50 items per perturbation), and the full suite **nightly/weekly**. Track **delta vs clean**:

- **Images**: blur (50/75%), rotation, crop; report Field F1 Δ and Grounded True Success Δ.  
- **Tables**: decimal‑comma, shuffling rows, sparse columns.  
- **Audio**: noise, code‑switching, telephone band.  
- **RAG**: distractors injected, stale versions.

**Gate idea:** “No robustness delta worse than −3 pts vs golden.”

---

## 10) Minimal Python: Gate Application & Report

```python
import json
from collections import defaultdict

def apply_gates(metrics):
    breaches = []

    def need(name, ok, detail):
        if not ok: breaches.append(f"{name}: {detail}")

    # Core examples (extend as needed)
    need("true_success",
         metrics["true_success"]["ci_lower"] >= 0.85,
         f"ci_lower={metrics['true_success']['ci_lower']:.3f} < 0.85")

    need("worst_slice",
         metrics["worst_slice"]["ci_lower"] >= 0.80,
         f"{metrics['worst_slice']['name']} ci_lower={metrics['worst_slice']['ci_lower']:.3f} < 0.80")

    need("hallucination_rate",
         metrics["hallucination_rate"]["value"] <= 0.02,
         f"value={metrics['hallucination_rate']['value']:.3f} > 0.02")

    if breaches:
        return {"pass": False, "breaches": breaches}
    return {"pass": True, "breaches": []}

def summarize(raw):
    # raw: per-item outcomes; here we fake a structure for demo
    # compute rates, CI bounds, worst slice, etc.
    pass

if __name__ == "__main__":
    with open("reports/e2e.json") as f:
        metrics = json.load(f)
    result = apply_gates(metrics)
    print(json.dumps(result, indent=2))
```

---

## 11) Rollback & Canary Policy (tie to CI)

- **Block merge** on CI breaches.  
- **Canary** to 5–10% traffic **only if** CI passes.  
- **Stop conditions** in canary: any tripwire breach (hallucination, worst slice, safety), or p90 latency +15%.  
- **Automatic rollback** and **debug diary** entry required before reattempt.

---

## 12) Checklists

### Author checklist (before opening PR)
- [ ] Updated prompts/judges have version notes.  
- [ ] If index changed: included fingerprint & freshness notes.  
- [ ] Added/updated acceptance tests and debug set.  
- [ ] Local L1/L2 passed; `make eval-smoke` green.

### Reviewer checklist
- [ ] Run manifest present; seeds & decoding are fixed.  
- [ ] Gates and thresholds match risk tier.  
- [ ] Failing cases attached; hypothesis plausible; fix minimal.  
- [ ] No new safety exposure; fixtures are synthetic.

---

## 13) Exercises

1. **Wire the Pyramid:** Implement L0–L3 for your repo. Make L1 tripwires run in <60s.  
2. **Gate Design:** Propose gates for your highest‑risk workflow; justify thresholds with past data.  
3. **Golden Baseline:** Freeze a golden manifest. Create a scripted **diff report** that highlights the top 10 regressions by slice.  
4. **Flake Audit:** Run your suite 5× with seeds fixed vs random; quantify variance and set CI‑lower gates accordingly.  
5. **Robustness Micro‑Suite:** Add blur/decimal‑comma/code‑switching micro‑suites to pre‑merge CI and alert if Δ < −3 pts.  

---

## Summary

CI for LLM systems is about **fast, informative feedback** that prevents **user‑visible regressions**. Build a pyramid of tests, make runs replayable with a **run manifest**, tame non‑determinism with **CIs and gates**, and automate **PR diffs** that tell developers *what* broke and *where*. With this safety net in place, your team can iterate on prompts, indexes, tools, and models **without fear** — and that is how you ship reliable AI features week after week.
