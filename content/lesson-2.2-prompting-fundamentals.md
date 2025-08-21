# AI Evals for Engineers & PMs  
## Lesson 2.2 — Prompting Fundamentals

> **Purpose of this lesson:** Build the *practical prompting skills* that make evaluation meaningful. If Chapter 1 gave you the map (intent → measurement → decision) and Lesson 2.1 showed the terrain (LLM strengths/weaknesses), this lesson teaches you how to **express intent precisely in prompts** so your evaluations have a fair chance to pass.

---

### How this connects to what you’ve learned
- **Gulf of Specification:** Prompts are one of the main artifacts that translate intent into system behavior.  
- **Evaluation Lifecycle:** Well-structured prompts make metrics stable and regressions easier to detect.  
- **LLM Strengths/Weaknesses:** Prompts should *amplify strengths* (versatility, adaptation) and *mitigate weaknesses* (hallucination, inconsistency, prompt sensitivity).

---

### Learning Objectives
By the end, you will be able to:
1. Write prompts with a **clear role, goal, inputs, rules, and output schema**.  
2. Choose between **zero-shot, few-shot, tool/function calling, and RAG-grounded prompting**.  
3. Set **sampling parameters** (temperature, top_p, max_tokens, stop) to trade off creativity vs consistency.  
4. Apply **guardrails** for safety and compliance.  
5. Design **prompt evaluations** that test instruction-following, formatting, grounding, and robustness.

---

## 1) The anatomy of a reliable prompt

Great prompts are explicit, structured, and testable. Use this five-part skeleton:

1. **Role** — Who/what the model is.  
2. **Goal** — The task and success criteria (short, concrete).  
3. **Inputs** — Delimited variables (docs, user message, JSON).  
4. **Rules** — Constraints: safety, style, policies, format, refusal criteria.  
5. **Output Schema** — Exact structure for the response.

### Reusable template
```text
[ROLE]
You are a <role> whose job is to <business goal>. Optimize for <primary objective> while respecting <constraints>.

[GOAL]
Task: <one-sentence task statement>.
Success when: <3–5 bullet rubric items>.

[INPUTS]
You will receive:
- <INPUT_A> delimited by <<<A>>> … <<</A>>>
- <INPUT_B> delimited by <<<B>>> … <<</B>>>

[RULES]
- Follow company policy: <short summary or link snippet>.
- Safety: refuse if <conditions>.
- Formatting: return exactly the schema below. Do not include extra text.

[OUTPUT SCHEMA]
Return valid JSON:
{
  "verdict": "<pass|fail>",
  "rationale": "<one concise paragraph>",
  "citations": ["<doc_id>:<span>", "..."]
}
```

**Why this works:** It makes the **spec visible** inside the prompt, which stabilizes behavior and makes **evaluation** (code checks + judge checks) straightforward.

---

## 2) Input hygiene: delimit, label, and minimize

LLMs confuse sources when inputs aren’t clearly separated.

- **Delimiters** — Wrap each input with unique markers (`<<<DOC>>> … <<</DOC>>>`).  
- **Labels** — Name each input with a short heading (`User Message:`, `Policy Snippet:`).  
- **Minimize** — Feed only what’s needed; excess text dilutes attention and increases cost.  
- **Ordering** — Place the most authoritative or relevant input *closest* to where it will be used in the instructions.  
- **Attribution** — If grounding to docs, ask for **inline citations** (doc ids or spans).

> **Eval hook:** Add a code check that the JSON parses and citations reference only allowed IDs.

---

## 3) Choosing a prompting mode

### A) Zero-shot
- **Use when:** task is simple and rubric is clear.  
- **Pros:** short, cheap. **Cons:** lower reliability.

### B) Few-shot
- Provide **2–6** compact examples (good + borderline).  
- Match the *style* and *format* you want.  
- **Use when:** the task has nuance or domain specificity.  
- **Eval tip:** include examples that reflect **edge cases** you’ll test.

### C) Tool / Function calling
- Model returns a structured function call; your code executes tools (search, database, payment link creation) and provides results back.  
- **Use when:** you need determinism for side effects or structured outputs.  
- **Eval tip:** track **tool call success rate** and **end-to-end correctness** separately.

### D) RAG-grounded prompting
- Retrieve relevant documents and instruct the model to **only** use them.  
- **Use when:** factuality matters and domain knowledge changes over time.  
- **Eval tip:** add a rubric item for **faithfulness** (“no claims absent from sources”).

---

## 4) Few-shot design in practice

**Do:**
- Keep examples **short** and **canonical**.  
- Annotate *why* an example is good (in comments, not in the model input).  
- Cover **different personas, languages, and tricky cases**.

**Don’t:**
- Overfit to a narrow style that harms generalization.  
- Leak answers from your **holdout** set. Keep examples distinct from eval data.

**Pattern: Contrastive pairs**  
Provide one positive and one negative example to sharpen boundaries.

```text
Example A — ACCEPTABLE
Input: "I lost my card; how to freeze it?"
Output (good): Steps 1–3 with policy citations; friendly tone; ends with CTA.

Example B — UNACCEPTABLE
Input: same as above
Output (bad): Vague advice; no citations; no CTA.
```

---

## 5) Output schemas: JSON-first thinking

Most eval pain disappears when outputs are **machine-checkable**.

- Specify a **strict JSON schema** (field names, enums, numeric ranges).  
- For free-text fields, limit length or ask for bullet lists.  
- Add a `version` field for prompt versioning.  
- Validate with code before any judge-based metric.

**Example (dispute classifier):**
```json
{
  "version": "v3",
  "reason_code": "FRAUD|NOT_AS_DESCRIBED|NON_RECEIPT|OTHER",
  "confidence": 0.0,
  "notes": "string (≤ 3 sentences)"
}
```

**Eval hooks:** JSON parsing rate; allowed enum values; confidence within [0,1]; length checks.

---

## 6) Sampling parameters that matter

- **temperature**: randomness; lower = consistent, higher = creative.  
- **top_p**: nucleus sampling; keep either `temperature` or `top_p` fixed to simplify debugging.  
- **max_tokens**: cap output length; prevents rambling and cost blowups.  
- **stop**: strings that end generation; useful to prevent trailing chatter.

**Default starting points (for reliability):**
- `temperature = 0–0.3` for extraction, classification, compliance.  
- `temperature = 0.5–0.8` for ideation or copywriting (paired with stronger evaluation).

> **Eval hook:** Record params with every trace; changes in params can masquerade as regressions.

---

## 7) Guardrails inside the prompt

Add **refusal rules** and **policy reminders**:

- “Refuse if the user requests actions outside approved payment plans.”  
- “Never disclose PII; if asked, explain policy briefly and offer alternatives.”  
- “If sources are missing or conflicting, answer: `{ "verdict":"fail", "reason":"insufficient grounding" }`.”

**Why:** You want *visible failure* over *silent wrong answers*. That makes evaluation honest and safer.

---

## 8) Putting it together — two end-to-end examples

### Example 1 — RAG answer for merchant policy
```text
ROLE: You are a policy assistant that answers strictly from provided docs.
GOAL: Provide a complete, faithful answer with citations.
INPUTS:
<<<QUESTION>>>
{user_question}
<</QUESTION>>>

<<<DOCS>>>
{top_k_chunks_with_ids}
<</DOCS>>>

RULES:
- Use only DOCS. If unsure, return "insufficient_information".
- Include at least one citation for each factual claim.
- Output schema:

{
  "answer": "<short paragraphs>",
  "citations": ["doc:12#p3", "doc:7#p1"],
  "insufficient_information": true|false
}
```

**Eval plan:**  
- Code: JSON valid; all citations reference provided IDs.  
- Judge: rubric for grounding, completeness, safety, clarity (0–3 each).  
- Thresholds: avg ≥ 2.7; no safety < 2; p95 latency < 4s.

---

### Example 2 — Collections follow-up message (no RAG, policy snippet)
```text
ROLE: Collections assistant. Optimize for respectful persuasion.
GOAL: Draft a WhatsApp reply that confirms identity, states balance, proposes options, and invites in-person meeting.
INPUTS:
<<<LAST_MESSAGE>>>{last_msg}<</LAST_MESSAGE>>
<<<PROFILE>>>{debtor_profile}<</PROFILE>>
<<<POLICY>>>{policy_snippet}<</POLICY>>

RULES:
- Offer only the allowed options in POLICY.
- Tone: friendly, firm, never threatening.
- Output schema:
{
  "message": "<≤ 1200 characters>",
  "offer_type": "full|installments|meeting",
  "next_step": "schedule_meeting|send_link|handoff_human"
}
```

**Eval plan:**  
- Code: JSON valid; `offer_type` ∈ enum; length ≤ 1200 chars.  
- Judge: tone appropriateness, compliance, clarity, CTA.  
- Online: response rate / meeting scheduled rate in A/B tests.

---

## 9) Prompt refinement loop tied to evaluation

1. **Draft** the prompt using the five-part skeleton.  
2. **Smoke-test** with 20–50 diverse cases; fix JSON and obvious rubric failures.  
3. **Run offline eval** on your dev set; do **error analysis** and tag failure modes.  
4. **Refine**: adjust role/rules/examples; maybe add a tool call or RAG grounding.  
5. **Freeze** a holdout and compare variants (A vs B) using LLM-as-judge for ranking.  
6. **Promote** the winner to an online A/B; watch KPI + safety + cost/latency.  
7. **Feed production failures** back into the regression set.

> **Rule:** change only **one variable at a time** (prompt, params, retriever, or model). Otherwise you won’t know what caused the delta.

---

## 10) Robustness and ablations

- **Paraphrase tests:** rewrite the same intent in 5–10 ways; success rate should remain stable.  
- **Long-context tests:** append unrelated “distractor” text; verify focus stays on relevant parts.  
- **Adversarial tests:** malformed JSON, weird punctuation, code block fences, emojis.  
- **Ablations:** remove one rule/example at a time to see which parts matter.

**Eval hooks:** keep separate slices and track metrics per slice to spot brittle behavior early.

---

## 11) Common prompting pitfalls (and fixes)

1. **Vague goals** → Write a single-sentence task and a short success rubric.  
2. **No schema** → Force JSON with enums and ranges; validate first.  
3. **Overlong inputs** → Trim, chunk, or retrieve; place the most relevant first.  
4. **Leaky few-shot** → Keep examples distinct from holdout; rotate if overfitting.  
5. **Ignoring params** → Log and pin `temperature/top_p`; unexpected changes = mystery bugs.  
6. **One global prompt** → Specialize for key personas or languages; evaluate per segment.  
7. **Hidden failures** → Prefer explicit “insufficient_information” over confident nonsense.

---

## 12) Hands-on micro-exercise

Pick one of your features. Using the skeleton, draft a prompt with:  
- Role/Goal/Inputs/Rules/Output schema.  
- One positive and one negative few-shot example.  
- Temperatures and stop sequences specified.  
- A 5-bullet eval rubric (code checks + judge items).

If you can do this crisply, you’re ready for Lesson **2.3 — Defining “Good”: Types of Evaluation Metrics**.

---

## 13) Key takeaways
- Prompts are **specs in code**: make them explicit, structured, and testable.  
- Choose the right prompting mode (zero-shot, few-shot, tools, RAG) based on the task.  
- Tie every prompt to **concrete evaluation hooks** (parsing, schema, rubric, robustness).  
- Iterate with a **disciplined loop** and freeze holdouts to detect real improvements.

---

*End of Lesson 2.2 — Prompting Fundamentals*

