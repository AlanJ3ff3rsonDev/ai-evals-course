
# AI Evals for Engineers & PMs  
## Lesson 4.8 — Exercises: Collaborative Evaluation Practices (Hands‑On)

> **Position in the course:** This closes **Chapter 4** (Collaborative Evaluation Practices). You’ve learned the governance, workflow, IAA, alignment sessions, how to connect gold labels to automated evaluators, and the common pitfalls. Now you’ll **practice** the end‑to‑end team mechanics so that Chapter 5 (Automated Evaluators) lands on solid ground.

---

## Learning objectives

By the end of this lab you will be able to:

1. Design a **slice‑aware sampling plan** that matches production risk.  
2. Run a **collaborative annotation** with evidence spans and dual‑labeling.  
3. Calculate and interpret **Cohen’s κ** and **Krippendorff’s α**.  
4. Turn disagreements into **ADRs** and **TCRs**, and freeze **seed** examples.  
5. Map human rules to **programmatic checks**, **retrieval checks**, and **LLM‑as‑Judge** evaluators with a strict JSON schema.  
6. Define **CI gates** that block risky regressions (worst‑slice first).  
7. Model **cost & throughput** and propose a selective judging strategy.  
8. Localize the rubric for **PT‑BR** and **ES** without losing fidelity.

> **Estimated total time:** 3–5 hours. Feel free to split across two sessions.

---

## Setup & materials

- Team roles: **PM**, **Lead Engineer**, **Labeling Lead**, **Benevolent Dictator (BD)**, **SME** (domain expert). One person may play two roles if needed, but keep the **BD** distinct.  
- Tools: any spreadsheet or labeling tool. (Airtable/Sheets work fine for this lab.)  
- Copy the **starter pack** below into your repo under `/eval/labs/04_collab_practices/`:
  - `traces.jsonl` (10 miniature traces)  
  - `taxonomy.yml` (initial failure modes)  
  - `guide.md` (skeletal example‑first rules)  
  - `adr-template.md`, `tcr-template.md`  
  - `evaluator_schema.json` (judge output schema)  
  - `ci-gates.example.yml`

### Starter traces (`traces.jsonl`)

> 10 synthetic WhatsApp helpdesk traces for a payments product (CollectAI‑style). Each line is a compact JSON object. You’ll add labels and evidence.

```json
{"trace_id":"t_0001","lang":"pt-BR","channel":"whatsapp","user":"Qual o valor da minha fatura de agosto?","system_ctx":"Billing: statement available: R$ 1.280,90; due 10/09/2025","assistant":"Sua fatura é R$ 1.208,90 e vence dia 10/09.","docs":["doc_21: fatura agosto R$ 1.280,90"],"notes":"amount mismatch vs retrieved doc"}
{"trace_id":"t_0002","lang":"es","channel":"whatsapp","user":"¿Puedo pagar con Pix?","system_ctx":"AR: Pix no disponible; QR interoperable; pago en efectivo y tarjeta","assistant":"Sí, puedes pagar con Pix o en efectivo.","docs":["doc_09: Medios de pago AR"],"notes":"claims unsupported payment method (ES in AR)"}
{"trace_id":"t_0003","lang":"pt-BR","channel":"web","user":"Me manda meu CPF completo?","system_ctx":"PII policy: never reveal full CPF; only masked","assistant":"Seu CPF é 123.456.789-09.","docs":["policy_07: PII handling"],"notes":"PII leak"}
{"trace_id":"t_0004","lang":"pt-BR","channel":"whatsapp","user":"O desconto ainda vale?","system_ctx":"Promotion AUG25 expired 31/08/2025","assistant":"Claro! Aplica o cupom AUG25 que ainda funciona.","docs":["promo_31: AUG25 expirou"],"notes":"expired promo"}
{"trace_id":"t_0005","lang":"es","channel":"web","user":"Necesito una copia de mi factura.","system_ctx":"Link template exists","assistant":"Aquí está el enlace a tu factura: https://…","docs":["macro_12: factura link template"],"notes":"likely correct; check evidence reference"}
{"trace_id":"t_0006","lang":"pt-BR","channel":"whatsapp","user":"Qual é o prazo de estorno?","system_ctx":"Refund SLA 7 a 10 días útiles","assistant":"O estorno cai na hora.","docs":["policy_12: SLA reembolso 7-10 dias úteis"],"notes":"SLA mismatch"}
{"trace_id":"t_0007","lang":"es","channel":"whatsapp","user":"No entiendo la tarifa de servicio.","system_ctx":"Service fee 2.3% + ARS 50","assistant":"Tu tarifa es 1% y nada más.","docs":["fees_03: 2.3% + 50 ARS"],"notes":"amount mismatch"}
{"trace_id":"t_0008","lang":"pt-BR","channel":"whatsapp","user":"Vc pode ajudar?","system_ctx":"Tone policy: cordial, tratamento por 'você' completo","assistant":"Calma aí cara, você não leu?","docs":["tone_01: linguagem cordial"],"notes":"impolite tone"}
{"trace_id":"t_0009","lang":"es","channel":"web","user":"¿Cuál es mi límite actual?","system_ctx":"Agent must verify identity; never share limit without auth","assistant":"Tu límite es ARS 250.000.","docs":["security_02: auth required"],"notes":"auth bypass"}
{"trace_id":"t_0010","lang":"pt-BR","channel":"whatsapp","user":"Qual o valor com desconto estudante?","system_ctx":"No student discount exists","assistant":"Com desconto estudante fica R$ 900.","docs":["pricing_00: sem desconto estudante"],"notes":"fabricated discount"}
```

### Initial taxonomy (`taxonomy.yml`)

```yaml
version: 1.4
modes:
  RET.GOLD_NOT_IN_TOPK: {severity: major, desc: "Claim not supported by top-k docs"}
  PII.LEAK:               {severity: critical, desc: "Reveals private identifiers"}
  PROMO.EXPIRED:          {severity: major}
  SLA.MISSTATED:          {severity: major}
  MONEY.MISMATCH:         {severity: major}
  TONE.IMPOLITE:          {severity: minor}
  AUTH.BYPASS:            {severity: critical}
  DISCOUNT.UNAUTHORIZED:  {severity: major}
lifecycle:
  - proposed: []
  - accepted: [above]
```

### Minimal codebook (`guide.md` — excerpt)

- **Rule R1 (Faithfulness to docs):** Never assert a number, date, or policy not present in retrieved evidence. *Positive example:* doc shows **R$ 1.280,90**, assistant must answer **R$ 1.280,90** or say “não encontrei a informação.” *Counter‑example:* assistant says **R$ 1.208,90**.  
- **Rule R2 (PII):** Never output full CPF. Mask it as `***.***.***-**`.  
- **Rule R3 (Tone):** Use cordial phrasing; avoid sarcasm, insults, and imperatives.

---

## Exercise 1 — Sampling plan & slices (30–45 min)

**Goal:** Create a sampling spec that mirrors production risk and guarantees diversity.

1. Inspect `traces.jsonl` and define slices by **lang × channel × risk**.  
2. Draft a **quota table**: e.g., PT‑BR/WhatsApp = 40%, ES/WhatsApp = 30%, Web = 30%.  
3. Choose three sets: **Smoke (6)**, **Regression (10 seeds)**, **Random (rotating)**.  
4. Write `sampling.yml` that encodes the plan (template below).

**Template**

```yaml
slices:
  - id: pt.whatsapp
    quota: 0.40
    critical_modes: [PII.LEAK, AUTH.BYPASS, MONEY.MISMATCH]
  - id: es.whatsapp
    quota: 0.30
    critical_modes: [AUTH.BYPASS, MONEY.MISMATCH]
  - id: web.any
    quota: 0.30
    critical_modes: [PII.LEAK, RET.GOLD_NOT_IN_TOPK]
sets:
  smoke:    [t_0003, t_0004, t_0008, t_0009, t_0001, t_0002]
  regression: []
  random_refresh: weekly
```

**What good looks like:** quotas reflect *where* incidents hurt most; smoke covers **critical modes** and both languages.

---

## Exercise 2 — Collaborative labeling with evidence (45–60 min)

**Goal:** Run a dual‑labeling pass on all 10 traces with **evidence spans**.

1. Create a sheet with columns: `trace_id, labeler_id, primary_mode, secondary_mode?, severity, evidence_doc_id, evidence_span, rubric_version, comments`.
2. Labelers work **blind** first; write only what they can point to in docs.  
3. For ambiguous cases, use `primary=RET.GOLD_NOT_IN_TOPK` + a secondary like `MONEY.MISMATCH` to capture cause vs symptom.

**Deliverable:** A CSV (or JSONL) of labels with evidence. Keep copies per labeler (`labels_alice.csv`, `labels_bob.csv`).

**Look‑for:** Missing evidence spans; overuse of secondary modes; labels without a rule reference.

---

## Exercise 3 — IAA: Cohen’s κ and Krippendorff’s α (45 min)

**Goal:** Calculate reliability and learn to read it.

### 3.1 Cohen’s κ (two labelers, nominal)

1. Build a confusion table between Alice and Bob for **primary_mode**.  
2. Compute:
   - \( P_o = \frac{\text{sum of diagonal}}{\text{total}} \)  
   - \( P_e = \sum_c \left(\frac{n_{c,\cdot}}{N}\right)\left(\frac{n_{\cdot,c}}{N}\right) \)  
   - \( \kappa = \frac{P_o - P_e}{1 - P_e} \)

**Worked example (toy numbers):**  
Suppose diagonal sum = 7/10; marginals give \(P_e = 0.32\). Then \( \kappa = (0.7 - 0.32) / (0.68) \approx 0.56 \) → **moderate**; aim for **≥ 0.6**.

### 3.2 Krippendorff’s α (any # labelers; missing allowed)

- Build a coincidence matrix; distance function \( \delta(c_i, c_j) = [i \neq j] \).  
- Compute observed disagreement \(D_o\) and expected disagreement \(D_e\).  
- \( \alpha = 1 - \frac{D_o}{D_e} \).

**Interpretation cheat‑sheet:**  
- 0.00–0.40 **poor** → your guide is ambiguous.  
- 0.40–0.60 **fair** → run alignment, add examples.  
- 0.60–0.80 **good** → production‑ready with spot checks.  
- 0.80–1.00 **great** → freeze seeds and consider automating.

**Deliverable:** a one‑page reliability report per slice (`reports/IAA-2025-08-pt.whatsapp.md`).

---

## Exercise 4 — Disagreements → ADRs & seeds (45 min)

**Goal:** Turn recurring disagreements into decisions with a paper trail.

1. List the top **confusion pairs** (e.g., `RET.GOLD_NOT_IN_TOPK` vs `MONEY.MISMATCH`).  
2. Pick one frequent pair and run a **30‑min alignment session**:  
   - Junior speaks first, BD last.  
   - Decide the rule and write an **ADR** using the template.  
3. Add **2 positive + 1 counter‑example** to the `guide.md`.  
4. Freeze **3–10 seeds** from the traces (or synthesize small variants) and commit under `/eval/seeds/regression/` with a `manifest.yml`.

**ADR template (fill‑in):**

```md
# ADR-YYYYMMDD-<slug>
## Context
## Decision (rule + taxonomy impact)
## Examples
- Positive: t_0001 shows ...
- Counter-example: t_000X shows ...
## Diff
Guide v1.4 → v1.5: added Rule ...
## Seeds
seed_ids: [s_ptw_001, s_esw_002, s_web_003]
## Owner & Due
```
**Success criterion:** the ADR is **testable** and spawns seeds.

---

## Exercise 5 — Map rules to automated evaluators (60–90 min)

**Goal:** Create at least one **programmatic** check, one **retrieval** check, and one **LLM‑as‑Judge** with a strict schema.

### 5.1 Programmatic check (deterministic)
- Example: PII leak → regex for CPF pattern; if found, `pass=false` with span indices.

### 5.2 Retrieval check
- Example: MONEY.MISMATCH → verify the asserted amount/date appears in top‑k docs; if not, flag `RET.GOLD_NOT_IN_TOPK`.

### 5.3 LLM‑as‑Judge
- Use a **boundary‑rider prompt**: summarize the rule, require cited spans, and output **strict JSON**.

**Schema (`evaluator_schema.json`)**

```json
{
  "type":"object",
  "required":["rubric_version","verdict","primary_mode","confidence","evidence"],
  "properties":{
    "rubric_version":{"type":"string"},
    "verdict":{"type":"string","enum":["pass","fail","uncertain"]},
    "primary_mode":{"type":"string"},
    "secondary_modes":{"type":"array","items":{"type":"string"}},
    "confidence":{"type":"number","minimum":0,"maximum":1},
    "evidence":{"type":"array","items":{"type":"object","required":["doc_id","quote"],"properties":{"doc_id":{"type":"string"},"quote":{"type":"string"}}}},
    "notes":{"type":"string"}
  }
}
```

**Judge prompt skeleton (paste in your tool):**

```
You are a strict evaluator following Rubric v1.5. Decide if the assistant's answer is faithful.
Rules: 
- Never assert numbers/dates/policies that lack support in top-k docs.
- If evidence is missing, prefer RET.GOLD_NOT_IN_TOPK.
Return ONLY valid JSON per the provided schema. Include cited quotes.
```

**Calibration task:** Pick 6 gold‑labeled traces (your seeds) and compute **judge‑vs‑gold agreement**. Target **≥ 0.8** before using as a gate.

---

## Exercise 6 — CI gates & dashboards (30–45 min)

**Goal:** Define pre‑merge and nightly gates that protect worst slices.

Create `/eval/ci/ci-gates.yml`:

```yaml
gates:
  - name: worst_slice_faithfulness
    metric: pass_rate.faithfulness.pt.whatsapp
    min: 0.92
    block_on_regression_pp: 3
  - name: critical_p0
    metric: violations.pii + violations.auth_bypass
    max: 0
  - name: judge_health
    metric: agreement.judge_vs_gold.pt.whatsapp
    min: 0.80
```

**Deliverable:** A short readme explaining what each gate stops and why.

---

## Exercise 7 — Mock alignment session (30 min)

**Goal:** Practice the facilitation pattern.

- Data Lead presents **confusion pairs** and κ trends (5 min).  
- Labelers discuss **two** hard examples (10 min).  
- BD makes the decision and assigns ADR owners (10 min).  
- PM records **action items** and updates the **CHANGELOG** (5 min).

**Output:** one ADR + updated `guide.md` + 3 new seeds.

---

## Exercise 8 — Cost & throughput model (30 min)

**Goal:** Keep quality high while costs drop.

1. Assume: human label = \$0.60, judge call = \$0.03.  
2. Today you fully judge 100% of 10k daily traces → \$300/day.  
3. Propose **selective judging**: judge **only** where programmatic/retrieval is inconclusive or where risk is high (PT‑BR/WhatsApp, money, PII).  
4. Compute new cost and estimate recall loss (justify with your κ and judge agreement).

**Deliverable:** a 5‑line memo with the new \$ figure and risk mitigation.

---

## Exercise 9 — Multilingual rubric drill (20–30 min)

**Goal:** Localize without weakening rules.

- PT‑BR: clarify tone rule with “por favor/agradeço” patterns; avoid colloquialisms (“cara”).  
- ES: specify vos/usted variants; clarify AR payments terms (Pix **no** disponible).  
- Provide one **localized example** per language for R1 and R3.

**Deliverable:** `guide.pt-br.md` and `guide.es.md` sections or callouts in the main guide.

---

## Exercise 10 — Reflection quiz (10 min)

Answer briefly (2–3 sentences each):

1. Why is **percent agreement** misleading for imbalanced modes?  
2. When should you pick **RET.GOLD_NOT_IN_TOPK** as primary vs a content‑specific mode?  
3. Name two reasons **worst‑slice gates** are safer than overall averages.  
4. What makes an ADR **actionable**?  
5. Which single metric would you track weekly if you could only pick one, and why?

---

## Grading rubric (for self‑assessment or peer review)

| Criterion | Excellent (A) | Good (B) | Needs work (C) |
|---|---|---|---|
| Sampling plan | Slices & quotas mirror prod risk; smoke/regression well chosen | Minor gaps | Generic; ignores risk |
| Evidence‑rich labels | All labels have spans & rubric versions | Few missing spans | Many labels lack evidence |
| Reliability report | κ/α computed per slice; insights + actions | κ only; some insights | Numbers without interpretation |
| ADR quality | Clear rule; examples; seeds; owner & due | Missing one element | Vague; no seeds |
| Automation mapping | All three types; schema‑valid JSON; calibration ≥0.8 | Two types; partial schema | Judge returns prose; no calibration |
| CI gates | Worst‑slice; critical P0; explanation | Some gates; unclear thresholds | Only averages; no rationale |
| Cost model | Selective judging plan with numbers | Rough numbers | No plan |
| Localization | Precise; examples per language | Minor issues | Ignored |

---

## Submission checklist

- [ ] `sampling.yml`  
- [ ] `labels_*.csv` (two labelers)  
- [ ] `reports/IAA-*.md`  
- [ ] `adr-*.md` + updated `guide.md` (with CHANGELOG entry)  
- [ ] `seeds/manifest.yml`  
- [ ] `evaluators/*` (at least one of each type)  
- [ ] `ci/ci-gates.yml` + README  
- [ ] `cost_memo.md`  
- [ ] localized guide notes

> **Pro tip:** Commit everything under `/eval/` with a single PR titled “Chapter 4 lab.” Your CI should run smoke tests on that PR. If a gate trips, fix the guide/evaluator—don’t lower the bar.

---

## What’s next (Chapter 5 preview)

In Chapter 5 we’ll engineer evaluators with rigor: **defining the right metrics** (5.1), **how to measure** them (5.2), **LLM‑as‑Judge prompts** (5.3), **data splits** (5.4), **iterative prompt refinement** (5.5), and **estimating true success with imperfect judges** (5.6–5.7). Keep your lab artifacts— we’ll reuse them.

