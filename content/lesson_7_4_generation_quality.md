# Lesson 7.4 — Evaluating Generation Quality (for RAG)

> **Prereqs:** You already built a RAG dataset (7.2) and measured retrieval (7.3). Now we evaluate the **generator**: given a query and top‑k evidence, does the model produce an answer that is **grounded, complete, direct, safe, and well‑styled**—with **correct citations**?  
> **Unit of analysis:** the **query** (or conversation if RAG sits inside a dialog). Bootstrap **by query** unless answers are produced inside multi‑turn flows; then bootstrap **by conversation**.

---

## Learning objectives

By the end of this lesson, you will:
1. Define **precise rubrics** for **Groundedness/Attribution, Completeness, Directness/Utility, Style & Safety**, and **Abstention**.  
2. Implement **short, anchored LLM‑as‑judge prompts** that check those rubrics using a **RAG digest** and **citation IDs**.  
3. Compute **claim‑level attribution** and **citation correctness** with code you can drop into CI.  
4. Bias‑correct observed scores to estimate **true success** with **confidence intervals**.  
5. Debug generation failures and tie them back to **prompting**, **citation format**, or **retrieval headroom**.

---

## 1) What “good generation” means in RAG

Given *query* + *top‑k evidence*, the model should produce an answer that is:

1. **Grounded/Attributable**  
   - Every *factual claim* is supported by at least one of the **provided evidence** chunks.  
   - Citations refer to the **correct chunk IDs** (or doc IDs) and are **sufficient** to justify the claim.

2. **Complete**  
   - Covers **all required aspects** for the intent/answer_type (e.g., mentions **exceptions** for policy items; includes **steps** for procedures).

3. **Direct & Useful**  
   - Answers the question **first**, then gives brief context; no detours or speculation.

4. **Style & Safety**  
   - Language, tone, and formatting match the channel; safe and policy‑compliant (no PII leakage, no legal threats unless required, etc.).

5. **Budget‑aware**  
   - Concise (≤ N words/bullets); fits token/latency budgets.

We’ll turn these into **must‑pass checks** plus **1–5 scores** that your CI can act on.

---

## 2) Data contracts for judging generation

Create a **RAG digest** per query so judges are cheap and robust:

```
QUERY: "Posso obter reembolso após 30 dias?"
TOP‑K EVIDENCE (IDs + snippets):
[doc_123#p5] "Pedidos de reembolso são aceitos até 30 dias da compra..."
[doc_123#p6] "Exceções: defeito de fabricação em até 90 dias..."
METADATA: language=pt‑BR; policy_version=2025‑04‑01; answer_type=short_fact.
MODEL ANSWER:
"Reembolsos após 30 dias não são permitidos, salvo defeito de fabricação (até 90 dias). [doc_123#p5][doc_123#p6]"
```

**Important:** Answers must **include citation IDs** in a fixed format (e.g., `[doc_id#chunk]`). This unlocks strict **attribution** checks.

---

## 3) The generation judge (short & anchored)

Use a deterministic LLM‑as‑judge with **must‑pass** + **rubric scores**. Keep the prompt under ~12 lines and output **strict JSON**.

### 3.1 JSON schema (output)

```json
{
  "must_pass": {
    "schema_valid": true,
    "language_match": true,
    "safety_pass": true,
    "citations_present": true,
    "citations_valid": true,            // IDs found in TOP-K EVIDENCE
    "no_hallucinated_entities": true
  },
  "scores": {
    "groundedness": 1..5,               // support of each claim by provided evidence
    "completeness": 1..5,               // covers exceptions/required aspects
    "directness": 1..5,                 // answers first, minimal fluff
    "style": 1..5                       // tone/format/locale
  },
  "supported_claims": [
    {"claim":"...", "supported_by":["doc_123#p5"], "verdict":"supported|partial|unsupported"}
  ],
  "abstain": {
    "should_have_abstained": false,
    "abstain_quality": null            // 1..5 if no-answer expected
  }
}
```

### 3.2 Prompt (template)

```
You are checking an answer for a Retrieval-Augmented QA system.
Use ONLY the EVIDENCE provided. If a claim is not supported, mark it unsupported.
If citations include IDs not present in EVIDENCE, set citations_valid=false.
Be concise and return JSON only.

Rubric (1–5):
- groundedness: all claims have matching evidence IDs; 5 means fully supported.
- completeness: includes required aspects for answer_type={{answer_type}} (e.g., exceptions/steps).
- directness: answers the question first, avoids speculation.
- style: correct language ({{lang}}), tone, and formatting.

Input:
QUERY: {{question}}
ANSWER: {{model_answer}}
EVIDENCE:
{{evidence_digest_with_ids}}
```

**Tip:** For *procedures*, add a single line: *“For `answer_type=instruction`, prefer numbered steps and check order.”*

---

## 4) Claim‑level attribution (strict & fast)

Beyond the judge’s scalar scores, compute **two deterministic metrics**:

### 4.1 Citation correctness

- **Definition:** fraction of cited IDs in the answer that are actually in **top‑k evidence**.  
- **Check:** extract `\[([^\]]+)\]` IDs and compare with the digest’s ID set.

```python
import re
def citation_correctness(answer: str, valid_ids: set[str]) -> float:
    ids = re.findall(r'\[([^\]]+)\]', answer)
    if not ids: return 0.0
    ok = sum(1 for cid in ids if cid in valid_ids)
    return ok / len(ids)
```

### 4.2 Supported‑claims rate

- Split the answer into **atomic claims** (simple heuristic: sentence split + noun‑phrase extraction), then check **string/number containment** against evidence.  
- Use an LLM **only** to decide ambiguous cases (tie‑breaker).

```python
def supported_claims_rate(claims: list[str], evidence_text: str) -> float:
    hits = 0
    for c in claims:
        norm = c.lower().strip()
        hits += 1 if norm in evidence_text.lower() else 0
    return hits / max(1, len(claims))
```

> These fast checks catch “citation mismatch” and “over‑summarization” even before running the judge.

---

## 5) Completeness by `answer_type` (rubrics you can copy)

| Answer type | Minimal completeness checklist |
|---|---|
| **short_fact** | Mentions the **main fact** and any **critical exception** present in evidence. |
| **instruction** | **Ordered steps**, preconditions, and stop criteria if present. |
| **multi_step** | States **each sub‑answer** and the **final composition** (e.g., eligibility AND discount). |
| **definition/comparison** | Defines both entities and lists **key differences/similarities**. |
| **no_answer** | Says **not found / not applicable** and suggests a next step; **no fabricated facts**. |

Encode the checklist in the judge prompt with a single *“For answer_type=X, ensure …”* line.

---

## 6) Abstention quality (no‑answer items)

For items labelled `"no_answer": true` in 7.2:

- **Must‑pass:** `citations_present=false` (shouldn’t cite irrelevant evidence), `groundedness≥4` is **not** required.  
- **Score:** `abstain_quality` (1–5): clarity, policy‑compliant refusal, helpful next step.  
- **Penalty:** if the model presents **confident false facts**, set `safety_pass=false` and `groundedness=1`.

**Release gate idea:** false‑answer rate on no‑answer items **≤ 2% (CI upper bound)**.

---

## 7) Bias‑corrected **true success** for generation

As in Chapter 5, your judge is **imperfect**. Estimate `(sensitivity s, specificity t)` on a human‑labelled calibration set (≈200 items). Then convert the observed pass rate `p̂` into **true success** `π̂`:

```
π̂ = (p̂ + t − 1) / (s + t − 1)
```

Bootstrap **by query** to get 95% CIs for `π̂`. Report both **raw** and **bias‑corrected** numbers.

**Decision rule example:** Ship if **true_success (CI‑lower) ≥ 0.80 overall and ≥ 0.75 in BR‑pt & es‑AR segments**, with **citation correctness ≥ 0.95**.

---

## 8) Putting it together — scoring & reports

Compute per‑query:

- `must_pass` flags (schema, language, safety, citations_valid)  
- Scalar scores: `groundedness, completeness, directness, style`  
- Deterministic checks: `citation_correctness`, `supported_claims_rate`  
- **End‑to‑end success**: `(must_pass all true) AND (groundedness≥4 AND completeness≥4 AND directness≥4)`

Aggregate with **means** and **bootstrap CIs** by **query**, with **segment slices** (language, topic, doc version, difficulty, answer_type).

**Report panels:**  
1) **Generation quality** (scalar scores + pass rate); 2) **Attribution** (citation correctness, supported‑claims); 3) **Abstention**; 4) **Cost/latency** for the generator; 5) **Examples** (top supported vs unsupported).

---

## 9) Debugging playbook (symptom → fix)

1. **High Recall@5 but low Groundedness**  
   - *Symptom:* The model paraphrases beyond evidence or cites wrong IDs.  
   - *Fix:* enforce **citation format** in the system prompt; add **“Every sentence that contains a fact must include a citation [id]”** rule; increase `k` slightly; add a **re‑ranker** tuned for factual support.

2. **Good Groundedness, low Completeness**  
   - *Symptom:* Omits exceptions/edge cases.  
   - *Fix:* add “**Include exceptions if present**” anchor; use **ideal‑answer** style exemplars per intent; chunk to keep exceptions with the main rule.

3. **Low Directness (rambling)**  
   - *Fix:* impose **word/bullet limits**; put **answer first, details after** in the prompt; add a **verbosity‑penalizing judge** (swap test with short vs long).

4. **Citation correctness < 0.9**  
   - *Fix:* standardize ID format; post‑process model text to **map citations**; teach the model to include IDs via a **tool call** that inserts correct IDs for selected snippets.

5. **Abstain failures** (hallucinated answers on no‑answer items)  
   - *Fix:* introduce an **evidence sufficiency check**: if top‑k evidence lacks key terms, instruct model to abstain; add **no‑answer exemplars**.

6. **Language/style drift**  
   - *Fix:* pass `language` and `locale` explicitly; judge enforces match; pre‑pend a one‑liner brand tone guide per locale.

7. **Segment regression (e.g., es‑AR only)**  
   - *Fix:* verify retrieval slices first; then prompt contains locale‑specific terms (e.g., “cupón” vs “boleto”).

---

## 10) Prompts that work in production (copy/paste)

### 10.1 System prompt for the generator (RAG mode)

```
You answer using ONLY the EVIDENCE provided.
Every sentence that contains a factual claim must include a citation in square brackets with the provided ID, e.g., [doc_123#p5].
Answer in {{lang}}. Start with the direct answer in <=3 sentences. 
If the evidence is insufficient or conflicting, say you cannot find the answer and suggest the next step (no invented facts).
For answer_type={{answer_type}}:
- short_fact: include exceptions from the evidence.
- instruction: numbered steps, each concise.
- multi_step: address each required part before the final summary.
```

### 10.2 Generation judge prompt (short)

(As in §3.2; keep temperature=0; include only the digest).

---

## 11) Minimal code sketch for the evaluation loop

```python
def eval_generation(items, run_answers, judge):
    rows = []
    for it in items:
        digest = build_digest(it["question"], it["evidence"])
        ans = run_answers[it["query_id"]]  # model answer with [ids]
        det = {
          "citation_correctness": citation_correctness(ans, set(digest.ids)),
          "supported_claims_rate": supported_claims_rate(split_claims(ans), digest.text),
        }
        j = judge.score(question=it["question"],
                        answer=ans,
                        evidence=digest.text,
                        answer_type=it["answer_type"],
                        lang=it["language"])
        rows.append({**det, **flatten(j), "query_id": it["query_id"], "segment": it["tags"]})
    return aggregate_with_bootstrap(rows, by="query")
```

---

## 12) CI gates (example)

```
Ship if (CI lower bounds):
- Generation true_success ≥ 0.80 overall and ≥ 0.75 in BR-pt & es-AR
- Citation correctness ≥ 0.95; supported_claims_rate ≥ 0.90
- No-answer false-claim rate ≤ 0.02
- Median answer length ≤ 120 words; latency within budget
```

Tune thresholds by risk and product area.

---

## 13) Exercises

1. **Build the judge:** Implement the JSON‑only generation judge; calibrate `(s, t)` on 200 human‑labelled items. Report **bias‑corrected true success** with CIs.  
2. **Attribution stress test:** Intentionally drop one gold chunk from the digest; measure the drop in groundedness and supported‑claims. What does this say about **evidence sufficiency**?  
3. **Abstain pack:** Add 50 `no_answer=true` items. Measure false‑answer rate and improve it to ≤2% by adjusting the system prompt.  
4. **Segment debugging:** Find the weakest segment (language/topic). Propose 3 prompt tweaks or chunking fixes; re‑run and quantify gains with CIs.  
5. **Verbosity bias probe:** Create 10 short/long minimal pairs of answers; verify the judge doesn’t reward longer text. Adjust rubric if needed.

---

## Summary

Generation quality in RAG = **Groundedness/Attribution + Completeness + Directness + Style/Safety** under budget. Make it measurable by: enforcing **citations** in answers; preparing compact **digests**; running **short, anchored judges** that emit JSON; and computing **deterministic checks** like **citation correctness** and **supported‑claims rate**. Calibrate judges to report **true success with CIs**, slice by segments, and hook **CI gates** to block risky releases. With this in place, you can tell precisely when the generator—not retrieval—is the bottleneck and ship confidently.
