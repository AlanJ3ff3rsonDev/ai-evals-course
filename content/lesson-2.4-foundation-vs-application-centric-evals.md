# AI Evals for Engineers & PMs  
## Lesson 2.4 — Foundation Models vs. Application‑Centric Evals

> **What this lesson does:** You’ve learned to express intent (prompts) and turn it into numbers (metrics). Now we answer a strategic question every PM/engineer faces: **Should we trust general foundation‑model benchmarks, or build our own product‑specific evaluations?** The correct answer is *both*, but with clear roles in a single evaluation stack.

This lesson gives you the mental model, workflow, and checklists to combine **capability screening** (foundation metrics) with **product truth** (application‑centric evals).

---

### How it connects to the course so far
- **Chapter 1** showed *why* evaluation is the bridge from intent to impact.  
- **2.1** mapped LLM strengths/weaknesses you must expect.  
- **2.2** turned intent into *prompts/specs*.  
- **2.3** turned rubrics into *metrics*.  
- **This lesson** decides *where* to apply which metrics—model capability vs product outcome—and how to combine them into one disciplined process.

---

## 1) Two layers of evaluation (one stack)

Think of a **two‑layer stack**:

1. **Foundation‑model layer (capability screen)**  
   “Is this model *able* to do tasks like ours at all?”  
   - Generic, public or vendor benchmarks (reasoning, coding, safety, multilingual).  
   - Goal: **short‑list** models and set expectations (a ceiling).  
   - Properties: cheap to run (often published), comparable across vendors, but **weakly predictive** of your specific product.

2. **Application‑centric layer (product truth)**  
   “Does our *system* solve *our users’* tasks under *our constraints*?”  
   - Private datasets, domain rubrics, end‑to‑end pipelines (retrieval, tools, policies).  
   - Goal: **ship/no‑ship decisions**, regression protection, ROI.  
   - Properties: expensive to build, not comparable across companies, but **strongly predictive** of real outcomes.

**Key principle:** Foundation metrics are **gates for consideration**, not **proofs of suitability**. Application evals are the **deciders**.

---

## 2) What belongs in each layer? (with examples)

| Layer | Typical questions | Examples of metrics | Decisions it informs |
|---|---|---|---|
| Foundation | Can the base model reason, follow instructions, code, be safe, speak our languages? | general QA/reasoning, math, code tests; instruction‑following; toxicity refusal; multilingual ability; tool‑use readiness | Short‑list 2–4 candidate models; set initial temps/context; estimate cost/latency envelopes |
| Application | Will our pipeline deliver grounded, compliant, helpful outputs within SLOs? | JSON/format gates, retrieval recall, faithfulness/completeness (judge), tone/compliance, tool success, latency/cost by slice | Ship/rollback; pricing/SLA; risk sign‑off; regression blocking in CI |

> **Mini‑heuristic:** If a metric can be scored on any generic text without your data or policies, it’s probably *foundation‑layer*. If it needs *your* docs, *your* workflows, or *your* constraints, it’s *application‑layer*.

---

## 3) Why foundation benchmarks alone mislead

- **Domain shift:** Public tasks rarely reflect your domain (e.g., fintech policies, Portuguese/Spanish debt collection).  
- **Pipeline gap:** Benchmarks test *models*, but you ship *systems* (retrieval, tools, caching, guards).  
- **Objective mismatch:** A model great at coding might be mediocre at polite persuasion or policy faithfulness.  
- **Goodhart’s law:** Optimizing purely for a benchmark encourages overfitting and **metric theater**.

**Bottom line:** High benchmark rank ≠ high product impact. Use them to *filter*, not to *decide*.

---

## 4) Why application‑centric evals are non‑negotiable

- They measure **your success definition** (Lesson 2.3 rubric) on **your users’ inputs**.  
- They expose **failure modes** the foundation layer cannot see (vendor JSON quirks, policy gaps, retrieval brittleness, tone/compliance trade‑offs).  
- They align engineering work with **business KPIs** (meeting booked, ticket deflected, repayment scheduled).

> **Rule:** No production rollout without passing the application eval **per slice** (language, market, channel).

---

## 5) How to combine both layers in practice (the workflow)

**Step 0 — Constraints first.**  
List hard constraints: privacy, on‑prem vs API, max cost, latency SLOs, languages, context window, tool calling, safety filters.

**Step 1 — Foundation screen.**  
- Pick 3–6 capability areas that *matter for your app* (e.g., multilingual PT/ES, instruction following, JSON reliability, safe refusal).  
- Use published or quick‑run tests to reject obvious misfits.  
- Record cost/latency envelopes on representative prompts.

**Step 2 — Build the application eval harness.**  
- From Lessons 2.2–2.3: write prompts, output schemas, rubrics.  
- Create **tiered datasets** (smoke/regression/holdout) and slices.  
- Implement code gates + judge metrics; log traces.

**Step 3 — Run A/Bs on the short‑list.**  
- Compare 2–4 models on your **application** metrics.  
- Use **pairwise LLM‑as‑judge** to rank where numeric metrics don’t suffice.  
- Check **ops** (p95 latency, $/req) and **safety** simultaneously.

**Step 4 — Decide & document.**  
- Choose the winner; write a **decision memo** with foundation results (context) and application results (decider).  
- Capture *why* chosen; sets expectations for future vendor/model swaps.

**Step 5 — Wire into CI/CD.**  
- Freeze holdouts; run smoke tests per PR; run regression nightly.  
- Re‑evaluate on vendor updates and before major rollouts.

---

## 6) Quantitative patterns that help decision‑making

- **Ceiling/Floor view:** Foundation layer gives an approximate *ceiling*. If a model fails basic instruction following or JSON stability, it sets a *floor* you won’t beat with prompting alone.  
- **Deltas over absolutes:** In application evals, focus on **relative gains** under fixed seeds/params.  
- **Slice minima:** Require `min_slice_score ≥ θ` so small but critical user groups aren’t sacrificed to improve the average.  
- **Ops triangles:** Plot (quality, latency p95, cost). Prefer Pareto‑efficient options; reject dominated ones.

---

## 7) Case study (CollectAI‑style negotiation assistant)

**Context:** PT/ES WhatsApp agent persuading debtors to visit office or pay via link, with strict compliance.

**Foundation layer checklist:**  
- Multilingual PT/ES accuracy on instruction‑following mini‑tasks.  
- JSON/function‑call reliability on toy schemas.  
- Basic safety refusal on disallowed offers.  
- Latency/cost on representative token sizes.

**Application layer harness:**  
- **Gates (code):** JSON parse = 100%; enums valid; length ≤ 1200; PII redaction on.  
- **Quality (judge):** Faithfulness to policy, completeness (amount/options/CTA), tone (respectful/firm), compliance (no unauthorized deals).  
- **Ops:** p95 latency ≤ 3.5s; cost ≤ $0.010.  
- **Slices:** debtor persona (3), language (PT/ES), channel (WhatsApp/email).

**Decision:** Model A wins foundation benchmarks, but Model B wins application eval (+0.22 judge score on PT persuasion; fewer compliance violations) at similar cost. Choose **Model B**; document rationale; keep Model A as fallback for batch copywriting use‑case.

---

## 8) Common traps and how to avoid them

1. **Benchmark absolutism** — Picking the leaderboard #1 without checking product fit.  
   - *Fix:* Always run the application harness; leaderboards are filters only.

2. **Homemade “benchmarks” with no baselines** — A private set with unclear provenance.  
   - *Fix:* Version datasets; document sampling; keep an untouched holdout; compute CIs.

3. **No safety co‑evaluation** — Optimizing for quality while violations spike.  
   - *Fix:* Make safety a **gate** in the application layer.

4. **Ignoring ops** — Choosing a model that is too slow or expensive for your SLOs.  
   - *Fix:* Evaluate p95 latency and cost alongside quality from day one.

5. **Averages hiding harm** — Great mean score masked by one failing language or persona.  
   - *Fix:* Enforce **slice minima** and report per‑slice dashboards.

6. **Frozen foundation beliefs** — Assuming capability ranks don’t change.  
   - *Fix:* Re‑screen periodically; vendors shift quickly.

---

## 9) Decision artifacts you should produce

- **Short‑list matrix** (foundation layer): model vs capability area vs pass/fail/notes (+ cost/latency).  
- **Application eval report**: per‑metric, per‑slice scores; ops & safety; traces to examples.  
- **Pareto chart**: quality vs cost vs latency.  
- **Decision memo**: “We choose X for use‑case Y because …; risks; rollback plan.”

These artifacts make your decision **auditable** and scalable across teams.

---

## 10) Quick decision playbook (copy/paste)

1. Define constraints (privacy, latency, cost, languages).  
2. Pick 3–6 capability checks → short‑list models.  
3. Build/run the **application harness** with gates + judge metrics.  
4. Compare short‑list on **quality + safety + ops**, by slice.  
5. Choose Pareto‑efficient winner; document; wire into CI/CD.  
6. Re‑run on vendor updates; feed prod traces back into the harness.

---

## 11) Micro‑exercise

Take a current project and fill these two tables:

**A) Foundation screen (example)**  
| Capability | Must‑have? | Test you’ll run | Pass threshold | Notes |
|---|---|---|---|---|
| JSON function call stability | Yes | 200 toy calls | ≥ 99.5% valid | |
| Multilingual PT/ES instruction following | Yes | 100 prompts | ≥ 90% pass | |
| Safety refusal (unauthorized discounts) | Yes | 200 red‑team prompts | ≤ 1% violations | |
| Latency p95 @ 1K/2K/4K tokens | Yes | synthetic load | ≤ 3.5 s | |

**B) Application eval (example)**  
| Metric | Dataset/Slice | Threshold | Gate or Soft? |
|---|---|---|---|
| JSON parse / enums | all | 100% | **Gate** |
| Faithfulness to policy (judge 0–3) | PT/ES × personas | ≥ 2.7; min slice ≥ 2.6 | Soft |
| Compliance violations | all | 0 severe | **Gate** |
| p95 latency | channels | ≤ 3.5 s | **Gate** |
| Cost / req | channels | ≤ $0.010 | Soft |

If you can complete both tables, you’ve operationalized the two‑layer stack.

---

## 12) Key takeaways

- Use **foundation‑model evals** to *filter and inform*, not to decide.  
- Make **application‑centric evals** the *deciders* tied to your business KPIs.  
- Combine them in a **two‑layer stack** wired into CI/CD.  
- Protect users with **gates**, protect the business with **slices + ops budgets**.  
- Document decisions so model swaps and vendor updates are low‑risk.

---

*End of Lesson 2.4 — Foundation Models vs. Application‑Centric Evals*

