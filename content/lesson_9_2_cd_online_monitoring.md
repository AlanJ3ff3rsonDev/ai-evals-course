# Lesson 9.2 — **CD & Online Monitoring: Tracking Real‑World Performance**

> **Continuity with the course:**  
> **9.1 CI** gave you a pre‑merge safety net. **9.2** extends that discipline to **deployment** and **real‑time monitoring** so regressions are caught (and rolled back) *in production* before users are harmed.

---

## Learning Objectives

After this lesson you will be able to:
1. Choose the right **deployment strategy** (shadow, canary, blue/green, feature flags) for LLM systems.  
2. Design a **telemetry schema** that makes every live answer **explainable and comparable** across versions.  
3. Define **online SLIs/SLOs** (true success proxies, grounding, cost/latency, worst‑slice) and wire **alerts**.  
4. Detect **data & behavior drift** (inputs, retrieval, tools, judges) and act fast.  
5. Run **A/B tests** safely for LLMs and avoid common pitfalls (selection bias, Simpson’s paradox, seasonality).  
6. Operate with a **rollback runbook**, dashboards, and weekly health reviews.

---

## 1) From CI to CD — mental model

- **CI** = *before merge*: fast tripwires + calibrated end‑to‑end tests.  
- **CD** = *after merge*: controlled rollout + **online monitors**.  
- Treat production like a lab with **flags**, **canaries**, and **replayable traces** so you can:  
  1) **Detect** online changes, 2) **Diagnose** with traces, 3) **Decide** to roll forward or back.

> Rule of thumb: **Never deploy what you cannot observe**.

---

## 2) Deployment Strategies for LLM Features

### 2.1 Shadow (a.k.a. “dark launch”)
- **What:** New model runs **in parallel** on real traffic; responses are **not shown** to users.  
- **Use when:** You need to validate **cost/latency**, tool compatibility, and judge/grounding behavior safely.  
- **Key monitors:** latency, cost, tool failures, hallucination proxy, grounding proxy deltas vs prod.

### 2.2 Canary
- **What:** Serve new version to **5–10%** of traffic; compare against control.  
- **Use when:** You already passed shadow; want **user‑visible** validation.  
- **Gates:** stop if any **tripwire** breaches (hallucination, worst slice, safety), or **p90 latency** ↑ > 15%.

### 2.3 Blue/Green
- **What:** Two identical stacks; flip traffic from blue → green when green passes probes.  
- **Use when:** Infrastructure or index changes; need **instant rollback**.

### 2.4 Feature Flags
- **What:** Toggle behavior without redeploy (model ID, prompt template, reranker, tools).  
- **Use when:** Running experiments, emergency kill switch, region‑by‑region rollout.

> **Pattern:** **Shadow → Canary → Blue/Green flip** (with flags).

---

## 3) Telemetry: the **Run Event** you need in production

Every live answer should emit a **single event** with everything you need to analyze outcomes and cost. Keep it **privacy‑respectful** (hash IDs, no raw PII).

```json
{
  "run_id": "b8d4...",
  "timestamp": "2025-08-01T12:34:56Z",
  "tenant": "br", "locale": "pt-BR", "channel": "web",
  "experiment": {"bucket": "A", "flag_version": "r2025-08-01-01"},
  "task_type": "invoice_total_extraction", "difficulty": "auto:hard",
  "as_of": "2025-07-01",
  "input_digest": {"n_chars": 812, "n_pages": 1, "language": "pt"},
  "stack": {
    "model": "gpt-X-2025-06-01",
    "system_prompt_hash": "sha256:...",
    "tools": [{"name":"get_fx_rate","version":"3.2"}],
    "retriever": {"index_id":"invoices-v4","chunker":"c1024-o128"}
  },
  "actions": [
    {"tool":"ocr","ok":true,"lat_ms":420,"retries":0},
    {"tool":"get_fx_rate","ok":true,"lat_ms":180,"retries":1}
  ],
  "citations": {"present": true, "count": 1, "iou": 0.61},
  "outputs": {"lat_ms_total": 1670, "cost_usd": 0.0047, "length_out": 62},
  "judges": {"grounding_proxy":"pass","safety_proxy":"pass","format_proxy":"pass"},
  "label_hooks": {"human_reviewed": false, "gold_id": null},
  "anomaly": {"loop": 0, "over_call": 0},
  "result": {"status": "served"}
}
```

**Design notes**
- **Correlate**: `run_id` across microservices (retrieval, tools, judge).  
- **Hashes not blobs**: store content out‑of‑band; keep event light.  
- **Locale/as_of**: allow **freshness** and **decimal‑comma** slicing.  
- **Proxies** (below) give online signal even without full labels.

---

## 4) Online SLIs & SLOs (what to watch live)

We use two families of metrics:

1) **Outcome Proxies** — fast, imperfect signals predictive of user harm.  
2) **System Health** — latency, cost, throughput, error budgets.

### 4.1 Outcome Proxies (examples)

| SLI | Why it matters | How to compute online |
|---|---|---|
| **Grounding proxy** | Uncited claims drive complaints | Require a citation box or retrieved snippet ID; mark **FAIL** if missing/mismatched format |
| **Hallucination proxy** | Detect unsupported claims | Heuristic e.g., “no citation + contains numerals/claims” or a lightweight LLM judge in a sidecar |
| **Freshness proxy** | Prevent quoting future policies | Compare cited doc version ≤ `as_of`; FAIL on violation |
| **Tool necessity proxy** | Cost & latency bloat | For tasks with known closed‑book answers, flag calls as suspicious; sample to judge |
| **Loop proxy** | Agent stuck | Detect repeated states/actions; “≥ N identical tool calls within M steps” |
| **Format proxy** | Downstream parsing | JSON schema check, required fields present |
| **Worst‑slice pass rate** | Don’t hurt minorities | Slice by locale × task_type × difficulty; track CI lower bound per hour/day |

**SLO examples** (tune by risk tier):
- Grounding proxy pass rate **≥ 0.95**.  
- Freshness violations **= 0**.  
- Hallucination proxy **≤ 0.02**.  
- Worst‑slice CI lower **≥ 0.85**.  
- p90 latency **≤ 2.0 s**; unit cost **≤ budget**.

### 4.2 System Health

- **Latency**: p50, p90, p99 per route.  
- **Cost**: prompt+completion tokens, tool/API spend.  
- **Error budgets**: percent of SLIs allowed to fail before auto rollback.  
- **Throughput**: RPS; queue depth; backpressure signals.

> **Alert hygiene:** use **multi‑window** logic (e.g., breach for 3 of 5 minutes AND for 1 hour) to avoid noise.

---

## 5) Drift Detection (inputs, retrieval, tools, outputs)

LLM systems degrade when **distributions change**.

### 5.1 Input/query drift
- Track **language mix**, **length**, **topic** clusters, **OCR quality**.  
- Use **PSI** (Population Stability Index) or **KL divergence** to flag shifts.

```python
# Tiny PSI helper
import numpy as np

def psi(expected, actual, buckets=10):
    q = np.linspace(0, 1, buckets+1)
    e_bins = np.histogram(expected, bins=np.quantile(expected, q))[0] / len(expected)
    a_bins = np.histogram(actual, bins=np.quantile(expected, q))[0] / len(actual)
    a_bins = np.clip(a_bins, 1e-6, 1)  # avoid log(0)
    e_bins = np.clip(e_bins, 1e-6, 1)
    return np.sum((a_bins - e_bins) * np.log(a_bins / e_bins))
# Rule of thumb: PSI > 0.25 = major shift
```

### 5.2 Retrieval/index drift
- **Coverage**: percent of answers with at least one citation.  
- **Age**: `now - doc.version` distribution.  
- **Nugget recall** (sampled): judge whether retrieved chunks contain the atomic facts.

### 5.3 Tool ecosystem drift
- **Schema mismatches** and **rate‑limit** spikes.  
- **Success rate** per tool version; automatically route to *fallbacks* on dip.

### 5.4 Output drift
- **Verbosity** (tokens), **sentiment**, **format adherence**.  
- **Grounding proxy** drop without input drift → likely prompt/model change.

---

## 6) Online Labeling & Calibration

Full “true success” requires labels. In production, do it **strategically**:

- **Thin gold stream**: 0.1–1% of traffic → human review; cover worst slices.  
- **User signals**: edits, thumbs, repeated queries → weak labels (treat cautiously).  
- **Periodic calibration**: weekly 300‑item sample per major workflow; compute judge sensitivity/specificity and re‑estimate **true success** online.  
- **Gold error queue**: when model seems right but proxy/label says wrong → adjudicate and correct.

> Publish **two lines** on dashboards: observed proxy and **calibrated estimate** (with CI).

---

## 7) A/B Testing & Experimentation for LLMs

### 7.1 Guardrails before you test
- **Safety**: block variants with known injection risks in shadow.  
- **Non‑interference**: use **mutually exclusive** buckets; fix upstream data feeds.  
- **Power**: estimate minimum detectable effect (MDE) given variance; avoid underpowered tests.

### 7.2 Design choices
- **Between‑subjects A/B** for stable tasks.  
- **Interleaving** (pairwise or multileaving) for **rankers**.  
- **Bandits** to shift traffic when cost/latency differ widely (still keep holdout!).

### 7.3 Avoid classic traps
- **Simpson’s paradox** → always analyze **per slice**; require no‑harm on worst slice.  
- **Seasonality** → keep tests long enough (at least one weekly cycle).  
- **Novelty effects** → watch edit/abandon rates over time.  
- **CUPED** (variance reduction) → use past user behavior as covariate when available.

### 7.4 Example success criteria (policy Q&A)
- **Primary**: calibrated grounded true success (CI lower) ↑ ≥ 2 pts.  
- **Guardrails**: hallucination proxy ≤ 2%, freshness violations = 0, p90 latency ±10% band.  
- **Per‑slice gate**: pt‑BR policy questions CI lower not ↓ by >1 pt.

---

## 8) Dashboards that drive action

**Home** (exec view):  
- True success (proxy + calibrated), hallucination proxy, freshness violations, worst‑slice CI, p90 latency, unit cost.  

**Detail** (engineer view):  
- Slice matrix (locale × task_type × difficulty).  
- Retrieval coverage & age, tool success & retries.  
- Robustness deltas vs clean traffic (blur, decimal‑comma, code‑switching).  
- Top regressions with **links to traces** (prompts, citations, tool calls).

**Weekly health review**: 30 mins. Review **Pareto of failures**, assign **one countermeasure**, update **CI gates** if stable.

---

## 9) Alerting & Runbooks

### 9.1 Sample alerts (multi‑window)

- **[P1] Freshness violation > 0 in 5 min OR > 0 in 1 h** → **auto rollback**.  
- **[P1] Hallucination proxy ≥ 5% for 10 min AND ≥ 3% for 1 h** → page on‑call, consider rollback.  
- **[P2] Worst‑slice CI lower < 0.80 for 1 h** → mitigate; raise gate in CI if persistent.  
- **[P2] Tool success < 0.95 for 15 min** → switch to fallback, open incident.

### 9.2 Rollback runbook (one pager)
1) **Freeze** experiment; flip **flag** to control; announce in #incidents.  
2) **Capture** the **run manifest** of last good and bad; attach top failing traces.  
3) **Classify** failure (taxonomy from 8.3); pick minimal fix.  
4) **Hotfix** to shadow; pass tripwires; **canary** 5%; reopen traffic.  
5) **Postmortem** within 48 h: cause, user impact, what CI/alerts will catch next time.

---

## 10) Monitoring per Architecture (quick recipes)

### 10.1 RAG
- **Coverage**: percent with citations.  
- **Support precision (proxy)**: judge on a sample (background worker).  
- **Freshness**: violations count; **index age** histogram.  
- **Distractor susceptibility**: interleave a distractor in 1% of requests; ensure answer cites correct doc.

### 10.2 Tool‑calling
- **Over‑call rate** (proxy).  
- **Execution success** and **retry depth**.  
- **Unsafe tool attempts** (blocked by policy).  
- **Argument fidelity** errors (schema mismatches).

### 10.3 Agents
- **Loop episodes** and **steps_used** vs cap.  
- **Info‑gain per message** (entropy drop proxy).  
- **Subgoal completion** for multi‑turn tasks (needs light labeling).

### 10.4 Modalities
- **OCR/ASR WER subsets** sampled from live; track **WER drift**.  
- **Region IoU** for cited boxes when available.  
- **Locale slices** (decimal comma; code‑switching).

---

## 11) Data Quality & Privacy in Production

- **Retention**: raw inputs expire quickly; keep **digests** + **hashes**.  
- **PII**: tokenize IDs; mask names/addresses in logs; access controlled.  
- **Gold storage**: separate enclave for human labels (auditable).  
- **User consent**: for using edits/feedback as labels; honor deletion.  
- **Model/provider changes**: record **effective date**; annotate dashboards.

---

## 12) Example SQL & Queries (materialize SLIs)

### 12.1 Worst‑slice CI lower (daily)

```sql
WITH by_slice AS (
  SELECT DATE_TRUNC('day', timestamp) AS d,
         locale, task_type,
         COUNTIF(grounding_proxy = 'pass') AS pass,
         COUNT(*) AS n
  FROM runs
  WHERE d >= CURRENT_DATE - INTERVAL '14 days'
  GROUP BY 1,2,3
),
ci AS (
  SELECT d, locale, task_type,
         pass, n,
         -- Wilson lower bound (approx)
         ( ( (pass/n) + 1.96*1.96/(2*n) -
             1.96*sqrt( (pass/n)*(1 - pass/n)/n + 1.96*1.96/(4*n*n) )
           ) / (1 + 1.96*1.96/n) ) AS ci_lower
  FROM by_slice
)
SELECT d, MIN_BY((locale||'×'||task_type), ci_lower) AS worst_slice,
       MIN(ci_lower) AS worst_ci_lower
FROM ci
GROUP BY d
ORDER BY d DESC;
```

### 12.2 Canary delta summary

```sql
SELECT metric,
       AVG(value) FILTER (WHERE bucket='A') AS control,
       AVG(value) FILTER (WHERE bucket='B') AS treatment,
       AVG(value) FILTER (WHERE bucket='B') -
       AVG(value) FILTER (WHERE bucket='A') AS delta
FROM daily_metrics
WHERE metric IN ('grounding_pass_rate','p90_latency','unit_cost')
  AND d >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY metric;
```

---

## 13) Putting it Together — a rollout playbook (example)

**Scenario:** new RAG prompt for policy Q&A.

1) **Shadow** for 3 days. Monitor: coverage, grounding proxy, p90 latency, cost.  
2) **Canary** 10% for 5 days. SLOs: grounded proxy ≥ 0.95, hallucination ≤ 0.02, latency within ±10%, worst‑slice CI ≥ 0.85.  
3) **A/B** full week. Primary: calibrated grounded true success (weekly 300‑item sample).  
4) **Flip** with blue/green; keep flag for kill switch.  
5) **Weekly review**: add any recurring failures to **debug set**; update **CI gates**.

---

## 14) Exercises

1. **Emit the Run Event:** Implement the telemetry schema above in your service; verify `run_id` correlation across retriever/tools/judges.  
2. **Choose a Strategy:** For your next change, decide Shadow vs Canary vs Blue/Green; justify with risk, traffic, and rollback needs.  
3. **Build Proxies:** Implement grounding/hallucination proxies and a freshness check; set SLOs by risk tier.  
4. **Drift Watcher:** Compute PSI for input length distribution weekly; alert at PSI > 0.25.  
5. **A/B Plan:** Draft a 1‑page experiment design including success metrics, guardrails, slices, duration, and power estimates.  
6. **Runbook Drill:** Write the rollback steps for a freshness violation incident; include owners and alert thresholds.

---

## Summary

**CD & Online Monitoring** turns your evaluation craft into **operational safety**. Deploy with **shadow → canary → flip**, capture rich **run events**, and watch **outcome proxies** (grounding, hallucination, freshness, worst slice) alongside **system health** (latency, cost). Detect **drift** early, calibrate with a thin stream of **human labels**, and test with **A/B** designs that respect slices and guardrails. With dashboards, alerts, and a crisp **rollback runbook**, your team can improve models continuously **without surprising users**.

> Next: **9.3 — The Continuous Improvement Flywheel** — how to convert all these signals into a weekly rhythm of selecting problems, shipping countermeasures, and ratcheting gates upward.
