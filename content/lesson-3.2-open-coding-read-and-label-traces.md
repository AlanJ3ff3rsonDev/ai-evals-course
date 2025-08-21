# AI Evals for Engineers & PMs  
## Lesson 3.2 — Open Coding: Read and Label Traces

> **Where we are:** In 3.1 you bootstrapped a starting dataset with slices and provenance. Now you’ll **read traces** and **label what went wrong** using *open coding*—a systematic, bottom‑up way to name failures **before** you try to organize them into a taxonomy (that’s 3.3).  
> **Goal of this lesson:** Make you fast and consistent at turning raw traces into **evidence‑rich labels** that reveal patterns and guide fixes.

---

### What is “open coding”? (crisp definition)
*Open coding* comes from qualitative research. It means *reading data line‑by‑line and assigning short, descriptive labels to notable fragments* without forcing them into predefined buckets. In LLM evaluation, open coding produces **initial failure labels** attached to specific output spans and inputs.

**Why not jump straight to a taxonomy?** Because you don’t yet know the real shape of failures. Open coding lets the patterns emerge from the data rather than your assumptions.

---

## Learning objectives
By the end you will be able to:
1. Read single‑turn and multi‑turn traces and **segment** them into codeable units.  
2. Apply **clear, observable labels** (not theories) with severity and evidence spans.  
3. Run a **90‑minute coding sprint** with 2–4 people and reach alignment.  
4. Produce a **codebook v0**, a **labeled dataset**, and a **frequency table** that feeds 3.3 (Axial Coding).

---

## 1) The anatomy of a “trace” you should read
A good trace includes:
- **Inputs**: user message(s), retrieved docs (ids + snippets), tool calls & results, policy snippet, profile.  
- **Params**: model name, temperature, top_p, max_tokens, stop.  
- **Prompt**: system/instructions and few‑shot examples (or function schema).  
- **Output**: raw text or JSON.  
- **Runtime**: latency, token counts, tool timings.

> **Tip:** Always display retrieved doc IDs next to quoted spans so you can check faithfulness quickly.

---

## 2) Unit of analysis: what exactly do you label?
Choose a **codeable unit** and stick to it for the session:
- **For single‑turn generation**: the entire output, with **evidence spans** (character ranges or sentence indices).  
- **For multi‑turn**: label **turn‑level** issues, and optionally a **chat‑level** code (e.g., “goal not reached”).  
- **For RAG**: label **retrieval** (miss/irrelevant/duplicate) and **generation** (unsupported claim, missing fact) separately.  
- **For tool/agent systems**: label **step‑level** failures (malformed function call, retry loop, tool timeout) and **end‑to‑end** outcome.

Consistency here keeps your frequencies meaningful.

---

## 3) What a good *open code* looks like
A useful code is:
- **Observable**: describes *what happened*, not *why you think it happened*.  
- **Concise**: 2–4 words (`Missing CTA`, `Unsupported claim`, `JSON invalid`, `PII leaked`).  
- **Atomic**: one issue per code; apply **multiple codes** if needed.  
- **Anchorable**: linked to an **evidence span** (quote or character range).  
- **Actionable**: suggests a plausible fix direction later (prompt rule, retriever, policy snippet, tool, etc.).

**Anti‑patterns**
- “Bad answer”, “Confusing” → too vague.  
- “Prompt needs more examples” → theory, not observation.  
- “Model is dumb” → not helpful (and untrue).

---

## 4) Code schema (copy/paste)
Represent each label as JSON so it’s machine‑readable later:

```json
{
  "item_id": "uuid",
  "turn": 3,                          // optional for multi‑turn
  "phase": "generation|retrieval|tool|safety|format",
  "code": "Unsupported claim",
  "severity": "minor|major|critical",
  "evidence_text": "We can offer a 50% discount today.",
  "evidence_span": [352, 390],        // optional char range in output
  "citation_ids": [],                 // which retrieved ids should have supported it
  "notes": "Policy allows only installments; no doc cites discount.",
  "coder_id": "pm_alex",
  "timestamp": "YYYY‑MM‑DD",
  "rubric_item": "compliance"         // optional link to rubric
}
```

**Why these fields:** later we’ll group by `phase` and `rubric_item`, compute per‑slice frequencies, and add examples to the **regression** set.

---

## 5) The 90‑minute open‑coding sprint (team recipe)

**Participants:** 2–4 coders (PM, engineer, SME). Appoint a **facilitator**.  
**Scope:** 40–80 traces (depending on length).

**Agenda**  
1. **5 min – Setup**: Agree on unit of analysis, severity scale, and logging tool (sheet or simple web form).  
2. **15 min – Warm‑up together**: Read 3–5 traces out loud. Co‑create 8–12 **starter codes** (keep names short).  
3. **45 min – Solo coding**: Each coder labels a different batch. Add new codes sparingly (≤ 5 new per person).  
4. **15 min – Quick alignment**: Compare top codes and severity judgments on 5 overlapping items. Rename or merge obviously duplicate codes.  
5. **10 min – Synthesis**: Export labeled rows; produce quick **frequency counts by slice**.  
6. **5 min – Decide next steps**: Pick the **top 2–3 codes** to attack next sprint; assign owners.

**Ground rules**  
- Code **observations**, not diagnoses.  
- Prefer **more small codes** over one big umbrella.  
- If unsure about severity, mark **unknown**; don’t over‑interpret.  
- Tag slices consistently (PT/ES, persona, channel).

---

## 6) Severity and evidence: make failures honest

Define severity *by potential impact*, not annoyance:
- **Critical**: Safety/compliance violation; leaks PII; wrong monetary amount; broken JSON prevents downstream processing.  
- **Major**: Misleading or incomplete information; missing CTA; fails business goal.  
- **Minor**: Tone off; extra fluff; small grammar issues that don’t affect task success.

Always capture **evidence_text** (exact snippet). This prevents debates later and speeds prompt fixes (you can add the exact phrase to the rules/examples).

---

## 7) Worked examples (CollectAI)

### Example 1 — Single‑turn, policy violation
**Inputs (abridged):**  
- `LAST_MSG`: “Oi, posso pagar metade agora e o resto mês que vem?”  
- `POLICY`: “Ofereça parcelamento somente acima de R$400; não ofereça descontos.”

**Model output:**  
> “Podemos conceder **50% de desconto hoje** e parcelar o restante em 3x… Clique no link.”

**Open codes:**  
```json
[
  {
    "phase": "generation",
    "code": "Unsupported claim",
    "severity": "major",
    "evidence_text": "50% de desconto hoje",
    "notes": "POLICY proíbe desconto; nenhuma citação."
  },
  {
    "phase": "compliance",
    "code": "Policy violation",
    "severity": "critical",
    "evidence_text": "conceder 50% de desconto",
    "notes": "Viola regra de descontos."
  }
]
```

### Example 2 — RAG, missing citation & completeness
**Inputs:** question about payment methods; docs include policy with “PIX, boleto, ou presencial”.  
**Output:** “Você pode pagar por **cartão** ou presencial.” (no citations)

**Open codes:** `Missing fact: PIX`, `Unsupported claim: cartão`, `No citations`, `Incomplete options` (major).

### Example 3 — Multi‑turn state loss
Turn 1 user confirms identity; by Turn 4 the agent asks identity again.  
**Code:** `State inconsistency (forgot identity)` (major), turn=4, evidence_text is the repeated question.

### Example 4 — Format & tool failures
Function call payload has a misspelled enum `offer_tipe`. Tool returns 400.  
**Code:** `JSON invalid (enum)`, `Tool failure: 400`, `No retry/backoff`.

---

## 8) Coding interface: simple but strict
You can start with a spreadsheet. Suggested columns:

`item_id | turn | slice_lang | slice_persona | slice_channel | phase | code | severity | evidence_text | evidence_span | notes | coder_id`

**Shortcuts that speed you up**
- Keyboard shortcuts for common codes (1=Unsupported claim, 2=Missing CTA, 3=JSON invalid…).  
- Auto‑copy of selected output text into `evidence_text`.  
- Dropdowns for `phase`, `severity`, and `code` to keep spelling consistent.

Export to CSV/JSON for aggregation.

---

## 9) Measuring progress: when to stop the open coding pass
You have “enough” when:
- **New‑code creation rate** drops below ~10% of items (you’re seeing repeats).  
- You can name **top 5 codes** covering ≥ 60% of failures.  
- Two coders agree on **severity** for most items after the quick alignment step.  
- You have **5–15 exemplar traces** per top code to seed the regression set.

Don’t chase perfection. The next lesson will refine and merge codes.

---

## 10) From open codes to action (how this feeds the lifecycle)
Open coding outputs three artifacts that immediately drive work:

1. **Codebook v0** — List of codes with brief definitions and examples.  
2. **Frequency table** — Counts by `(code × slice)`; surfaces high‑impact segments.  
3. **Regression seeds** — For each top code, pick 5–10 examples to **freeze** in the regression set (with labels).

These flow directly into **3.3 Axial Coding** (merging/structuring), **3.4 Labeling Traces after Structuring**, and the **prompt/retrieval fixes** you’ll run in the next iteration.

---

## 11) Quick frequency analysis (what to compute)
After the sprint, compute:

- **Top codes overall** (bar chart).  
- **By slice**: e.g., `Unsupported claim` 22% PT vs 9% ES → investigation.  
- **By phase**: retrieval vs generation vs tool vs safety vs format.  
- **Severity distribution**: ensure critical issues are few but captured.  
- **Co‑occurrence**: `No citations` often co‑occurs with `Unsupported claim` → consider a stricter citation rule.

Even a simple pivot table is enough; we’ll visualize more later.

---

## 12) Collaboration and alignment tips
- **Name codes with verbs/nouns**, not sentences (`Missing CTA`, not “The model didn’t add a call to action”).  
- **Prefer reuse** of existing code names; only add a new code if the old ones don’t fit.  
- **Weekly calibration**: review 10 random items together; adjust names/definitions.  
- **Coder notes** are gold—capture “smells” and hypotheses in `notes` but keep the **code** itself factual.

---

## 13) Pitfalls (and antidotes)

1. **Vague labels** (“bad answer”) → no engineering direction.  
   - *Fix:* enforce evidence text; ban vague words.

2. **Diagnosing instead of observing** (“retriever failed”) when you didn’t inspect retrieval.  
   - *Fix:* separate `phase`; only use `retrieval miss` if the gold doc truly wasn’t in top‑k.

3. **Code sprawl** — 60 overlapping codes after one sprint.  
   - *Fix:* facilitator curates names; merge synonyms at the end; cap to ~20–30 before 3.3.

4. **Severity inflation** — everything is “critical”.  
   - *Fix:* maintain a written severity rubric; require justification.

5. **Ignoring slices** — averages look fine while one market suffers.  
   - *Fix:* every label row must include slice columns.

6. **Anchoring on early items** — you keep seeing the same failure everywhere.  
   - *Fix:* randomize item order; stratify by slice for each coder.

---

## 14) Mini‑exercise (try now, 30–45 min)

1. Pull **30 traces** across your slices.  
2. Agree on **unit of analysis** and **severity rubric**.  
3. Code them with 8–12 starter codes.  
4. Export and compute **top 5 codes** overall and by language.  
5. Pick **two codes** to address this week; copy 5 examples of each into the regression set.

Deliverables: a `codes.csv`, a one‑page `codebook_v0.md`, and a `top_codes.png` (or table).

---

## 15) Templates

**A) Severity rubric (example)**  
- **Critical**: violations (safety/compliance), PII exposure, wrong money/date, non‑parsable output (blocks pipeline).  
- **Major**: task failure (missing key element), unsupported factual claim, state loss, wrong tool action (recovered).  
- **Minor**: tone/grammar issues, verbosity, formatting nits with valid JSON.

**B) Codebook v0 entry (example)**  
```
Name: Missing CTA
Definition: Output lacks an explicit invitation to act (visit office, click link, schedule meeting).
Evidence: Look for absence of verbs like “agendar”, “visitar”, “clique” near the end.
Severity guidance: Major if rest of message is good; Critical only if CTA required by policy to proceed.
Examples: [item_0021 span 450‑510], [item_0133 span 210‑240].
```

**C) Simple sheet headers**  
`item_id, turn, lang, persona, channel, phase, code, severity, evidence_text, evidence_span, notes, coder_id`

---

## 16) Key takeaways
- Open coding is **bottom‑up labeling**: name what happened, attach evidence, stay agnostic about causes.  
- Keep codes **short, observable, and anchorable**; capture **severity**.  
- Run a **time‑boxed team sprint**, then compute simple **frequencies by slice**.  
- Export **regression seeds** and a **codebook v0**.  
- Save the urge to group/merge for **3.3 Axial Coding**—that’s next.

---

*End of Lesson 3.2 — Open Coding: Read and Label Traces.*
