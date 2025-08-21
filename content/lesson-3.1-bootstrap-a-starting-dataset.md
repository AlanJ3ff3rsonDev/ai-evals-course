# AI Evals for Engineers & PMs  
## Lesson 3.1 — Bootstrap a Starting Dataset

> **Why this lesson now?**  
> Chapter 2 gave you the machinery to *evaluate*. Chapter 3 is about **feeding that machinery with the right data** so it finds real problems fast. We start with a pragmatic question: **How do you build a good starting dataset when you have little or no labeled data?**

Your goal is not to build a perfect benchmark. Your goal is to assemble a **small, representative, failure‑revealing dataset** that lets you iterate quickly, define the first regression set, and make honest ship decisions.

---

### Learning objectives
By the end you will be able to:
1. Define the **minimum viable dataset (MVD)** for an LLM feature.  
2. Collect examples from **the right sources** (logs, SMEs, synthetic, augmentation) while avoiding leakage and bias.  
3. Structure the data into **splits and slices** that surface regressions.  
4. Apply a **data quality checklist** (dedupe, normalization, privacy, provenance).  
5. Produce the artifacts your team needs: a **coverage matrix**, **data card**, and **versioned files**.

---

## 1) What “good enough” looks like

A starting dataset should be:
- **Representative:** covers the **key slices** (language, persona, channel, domain).  
- **Varied:** includes **happy paths, edge cases, and adversarial prompts**.  
- **Traceable:** each item has **provenance** (where it came from) and **purpose** (what failure it targets).  
- **Small (at first):** big enough to see signal, small enough to label in a day or two.

**Rule‑of‑thumb sizes (starting point):**
- **Smoke:** 20–50 items (2–3 per slice).  
- **Dev/Regression seed:** 200–400 items.  
- **Holdout seed:** 200–400 items (frozen; don’t touch during iteration).

You’ll expand these over time, but this is **enough** to start finding real issues.

---

## 2) Decide slices first (or regret it later)

Slices prevent averages from hiding harm. Pick the **smallest set** of slices that reflect real risk and business priorities. Typical axes:

- **Language:** e.g., Portuguese, Spanish (and English if relevant).  
- **Persona/segment:** debtor archetypes, merchant tier, user sophistication.  
- **Channel:** WhatsApp, email, web chat.  
- **Task subtype:** information request vs negotiation; FAQ vs policy appeal.  
- **Risk level:** compliance‑sensitive vs casual.

> **Deliverable:** a 2×2 (or 3×N) **coverage matrix** listing how many examples you want per slice. Keep it visible in your PR/README.

**Example (CollectAI):**

| Slice axis | Values | Target n |
|---|---|---|
| Language | PT, ES | 150 each |
| Persona | New debtor, Repeat late payer, Disputed charge | ~100 each |
| Channel | WhatsApp, Email | Split evenly |

(Note: overall n above will overlap; you’ll stratify to meet all targets.)

---

## 3) Where to get examples (four reliable sources)

### A) Real traces (best signal)
- **What:** Chat logs, tickets, emails, forms, call transcripts.  
- **Pros:** Natural wording and distribution.  
- **Cons:** Privacy, PII, legal constraints; may require redaction.

**How:** Pull a random sample **per slice**; remove PII; keep **metadata columns**: `item_id`, `slice_lang`, `slice_persona`, `slice_channel`, `source=prod_log`, `timestamp`. Anonymize *before* anyone reads the content.

### B) SME‑crafted cases
- **What:** Short prompts created by the product/compliance team to represent **must‑handle** scenarios.  
- **Pros:** Guarantees coverage of edge cases and policy lines.  
- **Cons:** Can be stylized (less natural).

**How:** Run a 60–90 minute workshop: list top 10 questions + top 10 pitfalls; write 3 variants each. Tag with the **failure mode you expect** (“policy: unauthorized discount”, “missing CTA”).

### C) Synthetic generation (LLM‑seeded)
- **What:** Use an LLM to paraphrase or generate realistic variants from your seeds.  
- **Pros:** Scales cheaply; great for paraphrase robustness and long‑context tests.  
- **Cons:** Risk of model style bias; must include **human review**.

**How:** Prompt the LLM with slice metadata (“Write the same intent in PT for a first‑time debtor, WhatsApp tone”). **Reject** sterile outputs; keep only natural‑sounding variants.

### D) Adversarial/red‑team items
- **What:** Inputs designed to break safety, compliance, formatting, or grounding.  
- **Pros:** Surfaces catastrophic failures early.  
- **Cons:** Easy to over‑index; balance with realistic traffic.

**How:** Maintain a small curated set (e.g., 20–40 items) and label severity.

> **Tip:** Mix sources in each split, but keep the `source` field so you can analyze by provenance (synthetic vs real).

---

## 4) Define an item schema (so you can evolve without chaos)

Store each example as JSON or a row in CSV/Parquet with **explicit fields**. Suggested minimal schema for single‑turn tasks:

```json
{
  "item_id": "uuid",
  "inputs": {
    "user_message": "text",
    "policy_snippet": "text_or_id",
    "profile_json": { "age_group": "adult", "history": "partial_payment" }
  },
  "expected_properties": {
    "must_include": ["balance", "CTA"],
    "must_not_include": ["unauthorized_discount"]
  },
  "slices": { "lang": "pt", "persona": "new_debtor", "channel": "whatsapp" },
  "source": "prod_log|sme|synthetic|redteam",
  "provenance_note": "ticket 123 anonymized; policy v4.2",
  "created_at": "YYYY-MM-DD",
  "dataset_split": "dev|regression|holdout"
}
```

For **RAG**, add `doc_ids` or actual `doc_passages` you expect retrieval to use. For **multi‑turn**, include a list of `(role, content)` messages and a **task goal**.

> **Why schema now?** It allows **automatic checks** (inputs present, length, PII flags), enables **judge prompting** later, and makes your dataset future‑proof.

---

## 5) Prevent leakage (the silent score‑inflator)

Leakage = examples or answers from your evaluation set **influence** the system. Common paths:
- **Few‑shot examples** in your prompts are copied from the dev or holdout set.  
- **Synthetic generation** uses your own model to produce both dataset and answers.  
- **Agents** store eval items in memory and reuse them later.

**Controls:**
- Keep **few‑shot examples** in a separate file; audit against your eval items (hash match or semantic similarity).  
- Freeze a **holdout** split early and **hide** it from day‑to‑day iteration.  
- Record **hashes** of inputs so you can dedupe and detect reuse.

---

## 6) Privacy, ethics, and security (non‑negotiable)

- **PII redaction:** names, phone numbers, emails, document IDs. Replace with realistic placeholders (“<FIRST_NAME>”).  
- **Consent/Policy:** check your company’s data policy; get approvals to use logs for eval.  
- **Sensitive content:** tag and restrict access; create **severity levels** for safety violations in red‑team sets.  
- **Localization:** avoid stereotyping personas; use neutral, respectful phrasing.

Document decisions in a **Data Card** (see §11).

---

## 7) Build the first splits (and why each exists)

- **Smoke** (20–50): runs per PR; includes 5–10 format/safety traps and at least one example per slice.  
- **Dev/Regression** (200–400 to start): your day‑to‑day iteration set; contains **known failure modes** and variety. As you discover new bugs, **add them here**.  
- **Holdout** (200–400 to start): representative sample across slices; **frozen**. Use only for ship/no‑ship and for drift checks.

**Sampling recipe:**
1. Decide target counts per slice (`coverage matrix`).  
2. Sample from each source (logs, SME, synthetic) to reach targets.  
3. Randomly assign **70% to dev/regression** and **30% to holdout** (stratified by slice).  
4. Manually audit the holdout (typos, illegal PII). Then **lock it** (version tag + checksum).

---

## 8) Quality checks before labeling

Run a quick script or spreadsheet filters to catch issues:

- **Deduplicate** near‑identical items (cosine similarity on embeddings).  
- **Normalize** whitespace, emojis, casing, punctuation quirks (but don’t erase naturalness).  
- **Length sanity:** not too short to be trivial; not too long for your context window.  
- **Field presence:** all required inputs are present per your prompt schema.  
- **Source flags:** ensure red‑team items are a **small fraction** (e.g., 10–20%) so they don’t dominate averages.  
- **PII checks:** verify placeholders were applied; re‑run detectors.

Keep a **QC log** listing issues found and fixes made (date + author).

---

## 9) Label just enough to move (and save the rest)

Don’t label every item up front. Label in **tiers**:

1. **Pilot labeling (50–100 items):** shake out rubric problems; calibrate judges (LLM or human).  
2. **First pass (all Smoke + half of Dev):** enough to run metrics and find patterns.  
3. **On‑demand:** only label more when decisions require it (e.g., model choice).

> This keeps cost/time down and focuses human effort on **high‑signal** areas.

---

## 10) Use LLMs to multiply your seeds—carefully

Synthetic + augmentation are great for **paraphrases**, **distractors**, and **long‑context** constructions.

**Paraphrase prompt (sketch):**
```
Rewrite the message in {LANG} with the same intent.
Keep it realistic for {CHANNEL}. Vary slang and punctuation.
Return 3 variants as a JSON list.
```

**Long‑context builder:**
- Concatenate the real user query with 1–2 paragraphs of *distractor* text (unrelated but plausible).  
- Evaluate whether the system keeps focus.

**Negative control:** Use a prompt to intentionally produce **format errors** (missing fields, wrong enums) to seed your **gates** tests.

**Human review policy:** sample 10–20% of synthetic items; discard unnatural ones.

---

## 11) Produce a **Data Card** (1 page)

Document the who/what/why of your dataset so future you (and auditors) understand it.

**Template:**
- **Name & version:** `collectai_eval_v0.1`  
- **Purpose:** early offline evaluation for persuasion/compliance assistant.  
- **Intended use:** dev/regression; not for training.  
- **Slices:** PT/ES; personas {new, repeat, dispute}; channels {WA, email}.  
- **Composition:** 45% logs (anonymized), 35% SME cases, 15% synthetic, 5% red‑team.  
- **PII policy:** redacted placeholders; auto + manual checks.  
- **Labeling:** LLM‑judge v2 calibrated to 80 human gold items (agreement 0.87).  
- **Known limitations:** few examples of elderly users; limited dispute variety.  
- **Contact/owner:** team + email.  
- **Checksum:** SHA256 of each split file.

Put the Data Card in your repo and update the version whenever you modify the dataset.

---

## 12) Worked example (CollectAI)

**Goal:** Evaluate WhatsApp/email replies that must: state balance, offer allowed options, invite a meeting (CTA), be respectful & firm, and never offer unauthorized discounts.

**Slices:** `lang ∈ {pt, es}`, `persona ∈ {new, repeat, disputed}`, `channel ∈ {wa, email}` → 12 cells. Target **25 items per cell** for the first regression set (≈300 items).

**Sources:**  
- Logs: 150 anonymized real messages across slices.  
- SME: 80 cases covering tricky policies (“installments only if balance > X”, “holiday grace period”).  
- Synthetic: 50 paraphrases + 20 long‑context builds.  
- Red‑team: 20 “please reduce my balance by 50%?” / “my cousin said…” jailbreak‑style prompts.

**Splits:**  
- **Smoke (40):** one per cell + 28 traps (format, safety, adversarial).  
- **Regression (300):** remainder of logs/SME/synthetic + 15 red‑team.  
- **Holdout (220):** stratified sample across cells; frozen.

**Artifacts:** coverage matrix, Data Card, versioned CSV/JSON files, checksums, and a QC log.

---

## 13) Checklist (print this)

**Design**
- [ ] Slices chosen; coverage matrix with target counts.  
- [ ] Item schema defined (JSON/CSV columns).  
- [ ] Leakage controls planned (few‑shot separation; holdout isolation).

**Collection**
- [ ] Real traces sampled and anonymized (with metadata).  
- [ ] SME workshop held; edge cases written.  
- [ ] Synthetic paraphrases/long‑context built; human‑reviewed.  
- [ ] Red‑team set curated with severity tags.

**Quality & Ethics**
- [ ] Deduped; normalized; length sanity checks.  
- [ ] PII redaction verified; policy approvals secured.  
- [ ] Red‑team proportion reasonable (≤ 20%).

**Splits & Versioning**
- [ ] Smoke / Regression / Holdout created and **checksummed**.  
- [ ] Holdout **frozen** and out of daily iteration.  
- [ ] Data Card written; repo paths documented.

**Labeling Plan**
- [ ] Pilot labeled (50–100) for calibration.  
- [ ] First pass labeled for smoke + half of regression.  
- [ ] Judge vs human agreement measured; cadence defined.

---

## 14) Common pitfalls (and the antidote)

1. **Over‑fitting to synthetic style** → brittle to real slang.  
   - *Fix:* keep a majority of items from **real logs**; audit synthetic outputs.

2. **Averages hide segment pain** → PT looks great, ES fails.  
   - *Fix:* plan **slices first** and enforce **min slice** rules in metrics.

3. **Leaky holdout** → “improvements” don’t generalize.  
   - *Fix:* freeze and hide the holdout; audit few‑shot and synthetic prompts.

4. **PII leakage** → legal/compliance risk.  
   - *Fix:* automated + manual redaction; placeholder policy; access controls.

5. **No provenance** → can’t reproduce or defend numbers.  
   - *Fix:* store `item_id`, source, checksums, and a Data Card.

6. **Too big too soon** → weeks to label; slow iteration.  
   - *Fix:* start small; label just enough to move; expand as failures appear.

---

## 15) Micro‑exercise (20–40 minutes)

Pick a live feature or use the CollectAI mock. Produce:
1. A **coverage matrix** with 2–3 slice axes.  
2. A **10‑item smoke set** (include 3 traps).  
3. A **schema** (JSON/CSV columns).  
4. A **Data Card** (first draft).

If you can deliver those today, you’re ready for **3.2 — Open Coding: Read and Label Traces** where we’ll transform raw failures into a **structured failure taxonomy**.

---

### Key takeaways
- Start small, **stratified by slices**, with real data wherever possible.  
- Mix **logs + SME + synthetic + red‑team**; tag provenance.  
- Define **schema**, enforce **privacy**, and **version** everything.  
- Freeze a **holdout** early; use smoke/regression for iteration.  
- The point isn’t perfection; it’s **fast, honest signal** that guides improvements.

---

*End of Lesson 3.1 — Bootstrap a Starting Dataset.*
