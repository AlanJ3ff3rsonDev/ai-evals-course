# Lesson 8.4 — Evaluating **Specific Input Data Modalities** (Images, Tables, Audio & More)

> **Continuity with previous lessons:**  
> - **8.1** taught you to evaluate structured **tool calls**.  
> - **8.2** scaled that to **agentic, multi‑step** systems.  
> - **8.3** gave you a **debugging playbook** for complex pipelines.  
> - **8.4** extends the same principles to **non‑text inputs**: images (documents and UIs), tables/structured data, and audio. You’ll design data contracts, metrics, judges, and CI gates for each modality, with Brazil/Argentina‑friendly edge cases (locale, currency, accent, code‑switching).

---

## Learning Objectives

By the end of this lesson, you will be able to:
1. Define **modality‑aware data contracts** so runs are replayable and comparable across time.  
2. Build **gold labeling protocols** for images (region grounding), tables (cell/granularity), and audio (timestamps & transcripts).  
3. Choose **fit‑for‑purpose metrics** (e.g., IoU, CER/WER, field‑level F1, grounding precision, spreadsheet op correctness).  
4. Write compact **LLM‑as‑judge** prompts to evaluate semantic quality (not just low‑level accuracy) and **calibrate** them to estimate **true success** with CIs.  
5. Stress test and **debug modality‑specific failure modes** (blur, long tables, accents, currency/locale formats).  
6. Enforce **CI gates** so regressions in any modality are caught before deploy.

---

## 0) Why modality‑aware eval matters

Non‑text inputs create **two stacks** of potential errors:
- **Perception stack**: OCR/ASR/vision parsing → *what* the model sees.  
- **Reasoning stack**: tool calling, planning, math, grounding → *what* the model does with what it sees.

A strong evaluation isolates both stacks with **step‑level metrics** and **task‑level success**, then uses **calibrated judges** to correct for automation bias.

---

## 1) Data Contracts (replayable, comparable)

### 1.1 Common structure

For any task `T` with modality input(s), store side‑by‑side:
- **Raw bytes** (image/audio) or **lossless source** (PDF, WAV, CSV).  
- **Derived artifacts** used by your pipeline (OCR text with bounding boxes, ASR transcript with timestamps, detected tables).  
- **Summaries** (digests) for judges to consume.  
- **Versioning**: `as_of`, `parser@version`, `index@version`, `locale` (`pt-BR`, `es-AR`), `currency` (`BRL`, `ARS`).

**Example (image doc):**

```json
{
  "task_id": "D-101",
  "input": {"pdf_uri":"s3://docs/nota_fiscal_123.pdf", "page": 1},
  "derived": {
    "ocr": {
      "engine":"paddleocr@2.7", "as_of":"2025-08-10",
      "tokens":[{"text":"Total","bbox":[120,540,200,560]}, {"text":"R$","bbox":[420,540,440,560]}, {"text":"1.234,56","bbox":[450,540,520,560]}],
      "lines":[...]
    },
    "tables":[{"cells":[...], "bbox":[60,200,520,520]}]
  },
  "locale":"pt-BR",
  "currency":"BRL"
}
```

**Why this matters:** reproducibility. If OCR changes, you can attribute metric shifts to **perception** vs **reasoning**.

---

## 2) Images & Document Understanding

We focus on **business documents** (invoices/notas fiscais, receipts, ID photos) and **UI screenshots**. Many RAG+tool systems depend on robust document understanding.

### 2.1 Gold labeling

Create labels at **three granularities**:

1. **Field extraction** (key‑value): `{"total": "1.234,56", "cnpj":"12.345.678/0001-90"}`  
2. **Region grounding**: for each field, a **bounding box** `bbox=[x1,y1,x2,y2]` indicating the source region.  
3. **Answerability**: is the asked field **present** on the page? (e.g., “prazo de entrega” may be absent.)

**Label UI** should display the page, allow box drawing, and constrain fields to enumerations to avoid typos.

### 2.2 Metrics

- **OCR quality**: **CER** (character error rate) and **WER** (word error rate) on an OCR gold subset.  
- **Field extraction F1** (exact/normalized): compare normalized values (strip spaces, `R$`, decimal comma vs dot).  
- **Grounding**: **IoU** (intersection‑over‑union) ≥ threshold (e.g., 0.5) between predicted box and gold. Report **precision/recall** for grounded fields.  
- **Answerability accuracy**: avoid hallucinating fields not on the doc.  
- **End‑to‑end task success**: judged—was the final answer **correctly grounded** and **consistent** with the image?

**Normalization tips (pt‑BR & es‑AR):**  
- Convert `"1.234,56"` → `1234.56` (float) with locale mapping.  
- Accept **mask formats** for CNPJ/CUIT and normalize to digits for comparison.

### 2.3 Judges

**A) Visual Grounding Judge**

```
You verify that the assistant’s answer is supported by the cited region(s) of the page.
Inputs: field name, normalized answer, OCR tokens (text + bboxes) inside the cited region(s).
Return JSON: {"supported": true|false, "mismatch_reason":"...", "notes":"≤2 sentences"}.
```

**B) Hallucination Judge**

```
Decide if the assistant invented a value not present in the document.
If uncertain, return false.
Return JSON: {"hallucinated": true|false, "notes":"..."}
```

Calibrate both judges on 200–300 labeled samples to estimate `(sensitivity, specificity)` and compute **true success** for **“correct & grounded”**.

### 2.4 Robustness suites

- **Blur/noise** (simulate low‑end camera), **compression** (75%, 50%).  
- **Rotation/cropping**; **multi‑page** docs (field appears on later page).  
- **Locale formatting**: `"R$ 1.234,56"` vs `"ARS 1.234,56"`, date formats `DD/MM/YYYY` vs `YYYY‑MM‑DD`.  
- **Handwritten** fields.  
- **Stamps/overprints** that occlude values.

Measure delta on **Field F1** and **Grounded True Success**; add CI gates to prevent regressions.

### 2.5 Common fixes

- OCR dictionary for **CNPJ/CUIT** patterns; post‑OCR **regex repair**.  
- Train a **lightweight key‑value detector** for totals/date; then route to OCR snippet.  
- Add **layout‑aware** prompts (“Read only inside this bounding box”).  
- Enforce **abstain** when answerability is false.

---

## 3) Tables & Structured Data (CSV, HTML tables, spreadsheets)

Tables appear in bank statements, product catalogs, analytics exports. Errors tend to be **schema misunderstandings** or **aggregation mistakes**.

### 3.1 Gold labeling

- **Schema contract**: column names, types, units, and **locale** (decimal comma).  
- **Cell‑level gold** (optional but powerful): for 1–2% of rows, provide **ground truth cells** for critical columns.  
- **Operation gold**: for each task, store the **correct SQL** or **spreadsheet formula** and **result**.

### 3.2 Metrics

- **Operation correctness** (task‑level): compare the produced number/string with gold; treat numeric tolerance (e.g., `±0.01`).  
- **Program equivalence** (if code/SQL is produced): equivalence class test—execute candidate and compare result set/hash.  
- **Schema adherence**: did the model use the correct columns and units? (judge + static checks).  
- **Group fairness/coverage**: measure success by **slice** (rare categories, long tail of product types).  
- **Temporal stability**: does the answer change if rows are shuffled?

### 3.3 Judges

**A) Table Reasoning Judge**

```
Given the task, a summary of the table schema (names/types/sample values), and the final answer,
decide if the answer matches the requested operation (e.g., sum, average, delta %, top-k).
Return JSON: {"operation_ok": true|false, "missing_filters":[], "wrong_aggregation":true|false, "notes":"..."}
```

**B) SQL/Formula Safety Judge**

```
You are checking for dangerous operations (drop, external calls) and data leaks.
Return JSON: {"safe": true|false, "reasons":["drop","external","pii"], "notes":"..."}
```

Calibrate the **reasoning** judge. Prefer **execution‑based** metrics when possible (ground truth programs).

### 3.4 Robustness suites

- **Wide tables** (50+ columns), **long tables** (1M rows—use samples in eval).  
- **Locale**: decimal comma vs dot, negative numbers in parentheses `(1.234,56)`.  
- **Sparse columns** (many nulls), **duplicates**, and **outliers**.  
- **Joins**: tasks requiring joining two tables with imperfect keys.

### 3.5 Common fixes

- Provide a **schema card** (names/types/units + examples) in the prompt.  
- Insert a **plan‑then‑code** step: first verbal plan, then SQL/code.  
- Add a **validator** that re‑executes candidate programs and checks post‑conditions (row counts, monotonicity).

---

## 4) Audio & ASR (voice notes, IVR calls, screen recordings with narration)

Audio enters either as **final transcript** (ASR pre‑done) or you must **run ASR**. Evaluation distinguishes **perception** (ASR quality) from **reasoning** (intent extraction, summarization, compliance checking).

### 4.1 Gold labeling

- **ASR gold**: word‑level transcript with **timestamps** (at least per sentence).  
- **Intent/slot labels**: e.g., “request_refund(country=AR, product=electronics)”.  
- **Compliance** labels for regulated flows (“disclosed payment terms?” yes/no).

### 4.2 Metrics

- **WER** & **CER** for ASR quality (normalize hesitations, numbers).  
- **Intent F1** and **slot EM/F1** for NLU.  
- **Summarization quality**: judged for **fidelity** to transcript and **coverage** of key facts.  
- **Diarization accuracy** (who spoke when) if required.  
- **Latency** (real‑time factor) for streaming systems.

### 4.3 Judges

**A) Fidelity Judge (summary vs transcript)**

```
Given a transcript excerpt and a summary, mark if the summary faithfully represents facts without adding new claims.
Return JSON: {"faithful": true|false, "hallucination": true|false, "omissions":["price","date","policy"], "notes":"..."}
```

**B) Intent & Slot Judge (when gold unavailable at scale)**

```
Given the transcript and the extracted intent+slots, decide if they match the user's request.
Return JSON: {"intent_correct": true|false, "bad_slots":["country","product"], "notes":"..."}
```

Calibrate on a 300‑item human‑labeled set to compute **true success** for “faithful + correct intent/slots”.

### 4.4 Robustness suites

- **Accents** (pt‑BR regional; Rioplatense Spanish), **code‑switching** (pt+es+en), **background noise**, **overlap**.  
- **Telephone band** (8 kHz), **whispered speech**, **fast speech**.  
- **Numbers & entities**: prices, dates (DD/MM vs MM/DD), names with diacritics.

### 4.5 Common fixes

- Domain‑adapted **ASR vocabulary** (product names, CNPJ, CUIT).  
- Ask for **confirmation** for critical slots (“Você quis dizer AR, Argentina?”).  
- Use **constrained decoding** for numbers/dates (“format: DD/MM/YYYY”).

---

## 5) Cross‑cutting: Modality‑aware Task Success

For multi‑modal tasks (e.g., *“Read the invoice image, sum the items table, and explain discrepancies”*), your **end‑to‑end judge** should require that **each modality’s evidence is cited** and **consistent** with its source. Combine per‑modality metrics with a final **task success** (calibrated).

**Composite success protocol:**
1. Perception passes **minimum thresholds** (OCR/ASR quality).  
2. Reasoning passes modality‑specific checks (operation correctness, grounding).  
3. The **final answer** is faithful and cites sources (with region/timecodes).  
4. No safety violations (privacy, external calls).

Compute **true success** on the composite judge using sensitivity/specificity from a stratified human set (**by modality**).

---

## 6) CI Gates (sample; customize to risk)

```
Images/Docs (CI lower bounds):
- Field extraction F1 ≥ 0.92 overall; ≥ 0.88 for totals/date
- Grounded true success ≥ 0.88
- Hallucination rate ≤ 0.02
- OCR WER ≤ 0.08 on the OCR subset

Tables:
- Operation correctness ≥ 0.90 overall; ≥ 0.85 on wide tables (≥40 cols)
- Program safety incidents = 0 (hard gate)
- Locale correctness ≥ 0.95 for decimal-comma inputs

Audio/ASR:
- True success (faithful summary + correct intent) ≥ 0.85 overall; ≥ 0.80 for code-switching
- WER ≤ 0.12 telephone-band; diarization error ≤ 0.15 when required
```

Add **robustness suites** into CI weekly (Lesson 9 will integrate this into continuous monitoring).

---

## 7) Minimal Code Snippets (metrics you’ll actually use)

### 7.1 IoU for bounding boxes

```python
def iou(boxA, boxB):
    ax1, ay1, ax2, ay2 = boxA
    bx1, by1, bx2, by2 = boxB
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2-ix1) * max(0, iy2-iy1)
    areaA = (ax2-ax1)*(ay2-ay1)
    areaB = (bx2-bx1)*(by2-by1)
    union = max(1e-9, areaA + areaB - inter)
    return inter/union
```

### 7.2 WER/CER (simple Levenshtein)

```python
def edit_distance(a, b):
    m, n = len(a), len(b)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1, m+1):
        for j in range(1, n+1):
            dp[i][j] = min(
                dp[i-1][j] + 1,
                dp[i][j-1] + 1,
                dp[i-1][j-1] + (a[i-1] != b[j-1])
            )
    return dp[m][n]

def wer(ref_words, hyp_words):
    return edit_distance(ref_words, hyp_words) / max(1, len(ref_words))

def cer(ref_chars, hyp_chars):
    return edit_distance(ref_chars, hyp_chars) / max(1, len(ref_chars))
```

### 7.3 Locale‑aware number normalization

```python
def parse_locale_number(s, locale="pt-BR"):
    s = s.replace(" ", "")
    if locale in ("pt-BR","es-AR"):
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    s = s.replace("R$", "").replace("ARS", "").replace("$", "")
    return float(s)
```

### 7.4 Bias‑corrected **true success** (recap)

```python
def true_success(observed_pass, sens, spec):
    return (observed_pass + spec - 1) / max(1e-6, (sens + spec - 1))
```

---

## 8) Debugging Playbook by Modality

### Images/Docs
- **Symptom:** correct value, wrong region cited → **Fix:** tighter region heuristics; require IoU≥0.5; penalize uncited values.  
- **Symptom:** totals wrong when there are **two currencies** → **Fix:** add currency detector; prompt “use currency symbol nearest to total.”  
- **Symptom:** OCR misses hyphenated CNPJ → **Fix:** custom tokenizer + regex repair.

### Tables
- **Symptom:** average instead of weighted average → **Fix:** plan judge enforces operation; add gold programs; template “weighted avg = sum(x*w)/sum(w)”.  
- **Symptom:** decimal comma misread → **Fix:** normalize numbers; unit tests on locale parser.  
- **Symptom:** unstable answers on row order → **Fix:** sort explicitly in candidate SQL; add post‑check “result invariant to order”.

### Audio
- **Symptom:** slots wrong in noisy calls → **Fix:** ask explicit confirmation; add ASR biasing lexicon; increase chunk length with overlap.  
- **Symptom:** hallucinated summaries → **Fix:** fidelity judge + penalty; encourage quoting transcript spans; require timestamps for claims.

---

## 9) Exercises

1. **Images**: Label 200 invoice pages (pt‑BR & es‑AR). Compute Field F1, Grounding IoU, and Grounded True Success. Add a blur robustness suite; report deltas.  
2. **Tables**: Build a dataset of 150 bank‑like CSVs. For each task, store gold SQL and results. Evaluate operation correctness and add a locale decoder; prove improvement on decimal‑comma slices.  
3. **Audio**: Collect 2 hours of IVR calls. Measure WER and build a 100‑item intent+slot set. Calibrate judges and report **true success** on faithful summaries.  
4. **Composite**: Create a task that reads a receipt image, extracts line items, and answers a reconciliation question. Evaluate *perception*, *reasoning*, and *composite* success with calibrated judges.  
5. **CI**: Propose gates for your product; simulate a regression (OCR change) and show that gates catch it without blocking unrelated improvements.

---

## Summary

Evaluating non‑text modalities means **separating perception from reasoning** and enforcing **evidence‑grounding**. With modality‑aware data contracts, precise metrics (IoU, WER/CER, field‑level F1, operation correctness), calibrated judges, and robustness suites, you can measure—and steadily improve—real‑world tasks like invoice reading, table analytics, and call understanding. These practices plug directly into your **agentic** and **tool‑calling** pipelines, and they prepare you for the CI/monitoring workflows in Chapter 9.
