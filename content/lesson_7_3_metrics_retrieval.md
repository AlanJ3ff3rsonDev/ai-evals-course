# Lesson 7.3 — Metrics for Retrieval Quality

> **Chapter 7 context:** 7.1 mapped the RAG landscape and 7.2 built a dataset with **queries, gold evidence, ideal answers, negatives, and `as_of` timestamps**. Now we turn those items into **decision‑grade retrieval metrics** that tell you *what to fix* (indexing, chunking, reranking, routing) and *when to ship*.
>
> **Unit of analysis:** the **query** (or the conversation if queries are embedded in a multi‑turn flow). We bootstrap CIs by **query** unless otherwise noted.

---

## 0) What “good retrieval” means in RAG

Your retriever succeeds when, for a small `k` (typically 3–10), it returns **enough correct evidence** near the top so the generator can answer **completely and grounded**—fast and within budget. That implies four goals:

1. **Bring the right things:** *relevance & recall*.  
2. **Rank them early:** *rank sensitivity* (not just present somewhere deep).  
3. **Avoid clutter:** *precision & diversity* (distinct useful chunks, not duplicates).  
4. **Meet budgets:** *latency, cost, and freshness* (respect `as_of`/versions).

We’ll measure each with clear formulas and show how to interpret them.

---

## 1) Ground truth & granularity: document vs. chunk

- **Gold set** `G(q)`: for query `q`, the set of **chunk_ids** (or doc_ids) that *contain the facts* needed to answer. Prefer **chunk‑level** to make **attribution** possible later.  
- **Top‑k list** `R_k(q)`: first `k` items returned by the retriever **after reranking** (or **before** if you are evaluating the raw retriever). Each item has `{chunk_id, rank, score}`.

**Tip:** If your gold is at **doc‑level** but you retrieve **chunks**, treat a retrieved chunk as correct if its `doc_id ∈ gold_docs(q)`.

---

## 2) Core metrics (with formulas)

Let `rel(i)` be the graded relevance (2=strong, 1=partial, 0=irrelevant) of the item at rank `i`. Binary relevance is a special case where `rel(i) ∈ {0,1}`.

### 2.1 Hit/Recall family

- **Hit@k** (a.k.a. “Any‑pass”):  
  `hit@k(q) = 1[ R_k(q) ∩ G(q) ≠ ∅ ]`  
  *Use when a single gold chunk is enough to answer.*

- **Recall@k** (multi‑gold aware):  
  `recall@k(q) = | R_k(q) ∩ G(q) | / | G(q) |`  
  *Use when the answer needs multiple pieces (exceptions, conditions). Report mean and distribution.*

- **Weighted Recall@k** (graded):  
  `wrecall@k(q) = ( Σ_{x∈R_k(q)} rel(x) ) / ( Σ_{x∈G(q)} rel(x) )`

### 2.2 Rank‑sensitive quality

- **MRR (Mean Reciprocal Rank):**  
  For the first relevant rank `r*`: `rr(q) = 1 / r*` (0 if none); **MRR = mean(rr)**.  
  *Penalizes when the first good chunk is buried.*

- **nDCG@k (Normalized Discounted Cumulative Gain):**  
  `DCG@k(q) = Σ_{i=1..k} (2^{rel(i)} − 1) / log2(i+1)`  
  `nDCG@k(q) = DCG@k(q) / IDCG@k(q)` (IDCG is the ideal DCG for the same set).  
  *Handles graded relevance and rewards placing the best chunks high.*

- **MAP@k (Mean Average Precision):**  
  `AP@k(q) = (1 / |G(q)|) Σ_{i=1..k} P@i(q) * is_rel(i)`; **MAP** is the mean over queries.  
  *Stable when you have complete gold sets; otherwise prefer nDCG.*

### 2.3 Precision & diversity

- **Precision@k:** `precision@k(q) = (# relevant in top k) / k`.  
  Useful when `k` is part of your **budget** (token/latency).  
- **Distinct‑docs@k:** number of **unique `doc_id`** in top‑k (higher is usually better).  
- **Redundancy ratio:** `1 − distinct_docs@k / k`.  
- **Novelty@k (optional):** fraction of top‑k chunks whose **textual overlap** with higher ranks is below a threshold.

> **Interpretation:** If Precision@5 is low but Recall@5 is high, you’re retrieving the right chunk **and** lots of distractors → tune reranker/diversity.

### 2.4 Budget & ops

- **Latency (ms)**: retrieval time and reranking time; report **median** + **p90** with CIs.  
- **Cost**: embedding updates, index storage, and per‑query tokens/compute for rerankers.  
- **Freshness**: fraction of retrieved items with `doc.version ≤ query.as_of` (avoid using newer docs than the label’s timestamp).

---

## 3) Curves & headroom: the **k‑sweep**

Don’t pick a single `k` blindly. Plot **Recall@k and nDCG@k** for `k ∈ {1,3,5,10,20}`. The shape shows:

- **Retriever headroom:** If Recall@10 >> Recall@5, your reranker or `k` is constraining recall.  
- **Chunking issues:** If Recall@20 is still low, the gold chunks may be split unfavorably or the index misses synonyms.  
- **Budget trade‑off:** Where does **nDCG@k** start to **flatten**? That’s your sweet spot for cost/quality.

> In CI, compute **AUC(k, Recall)** as a single summary and keep the curve for debugging.

---

## 4) Handling incomplete or graded gold

You rarely have perfect gold. Three pragmatic tactics:

1. **Pooling:** For each query, union the top‑k from **several retrievers** (BM25, dense, hybrid); have a judge mark relevance for the pool. Use pooled labels for metrics.  
2. **LLM relevance judge:** When human labelling is expensive, use a short anchored judge to label each retrieved chunk as 2/1/0 relevant. Use this for **Precision/nDCG**; still compute **Hit/Recall** against gold to avoid optimism.  
3. **Lower/upper bounds:** Report metrics with **gold‑only** (lower bound) and **gold+judge** (upper bound) to communicate uncertainty.

**Calibration:** As in Chapter 5, collect ~200 human‑judged items, estimate the relevance judge’s `(sensitivity, specificity)`, and adjust aggregate precision estimates if needed.

---

## 5) Reranker & router evaluation (component‑level)

Separate **raw retriever** from **reranker** (and **router** if you have multiple sources).

- **Raw retriever:** measure **Recall@50** (or 100) and **MRR@50**—does the right evidence appear *somewhere*?  
- **Reranker:** measure **nDCG@k** and **Precision@k** from the **raw top‑50** to final **top‑k**—does it put the right evidence **early** and **remove distractors**? Report **Δ vs. raw**.  
- **Router:** **coverage** (fraction of queries sent to the correct source) and **misroutes** (queries routed to the wrong index). Use per‑source Recall@k.

---

## 6) Segment analysis (where retrieval fails)

Slice by **topic, language, document version, query difficulty, answer type**. For each segment report:

- `Recall@5` (mean with 95% CI, bootstrap by **query**).  
- `nDCG@5`.  
- `Precision@5`, `Distinct‑docs@5`.  
- `Median latency`.

> **Gate on CI‑lower bounds** per critical segment to avoid Simpson’s paradox (overall up, BR refunds down).

---

## 7) Data contracts for runs (so metrics are reproducible)

Log every retrieval run as JSONL with this minimal schema:

```json
{
  "query_id": "q_000042",
  "system": "hybrid_v3 + cross-enc-base",
  "k_raw": 50,
  "topk": [
    {"rank": 1, "chunk_id": "doc_123#p6", "score": 18.4, "doc_version": "2025-04-01"},
    {"rank": 2, "chunk_id": "doc_123#p5", "score": 17.9, "doc_version": "2025-04-01"},
    {"rank": 3, "chunk_id": "doc_777#p2", "score": 13.2, "doc_version": "2024-12-01"}
  ],
  "latency_ms": {"retrieve": 35, "rerank": 22},
  "index_version": "v2025_06_01",
  "chunker": {"algo": "hdgsent", "target_tokens": 600, "overlap": 80}
}
```

Store alongside the **dataset snapshot** (`DATASET_VERSION`, `AS_OF_RANGE`) and **code version** so numbers can be reproduced.

---

## 8) Reference implementations (Python snippets)

**Recall / Hit / Precision**

```python
def recall_at_k(gold: set, retrieved: list, k: int) -> float:
    return len(set(retrieved[:k]) & gold) / max(1, len(gold))

def hit_at_k(gold: set, retrieved: list, k: int) -> int:
    return 1 if set(retrieved[:k]) & gold else 0

def precision_at_k(relevance: list[int], k: int) -> float:
    # relevance is [1/0] for the ranked list; provide via gold or a relevance judge
    return sum(relevance[:k]) / max(1, k)
```

**MRR**

```python
def mrr(relevance: list[int], k: int | None = None) -> float:
    upto = relevance if k is None else relevance[:k]
    for i, r in enumerate(upto, start=1):
        if r > 0: 
            return 1.0 / i
    return 0.0
```

**nDCG**

```python
import math

def dcg(relevance: list[int], k: int) -> float:
    return sum(((2**rel - 1) / math.log2(i+1)) for i, rel in enumerate(relevance[:k], start=1))

def ndcg(relevance: list[int], k: int) -> float:
    ideal = sorted(relevance, reverse=True)
    idcg = dcg(ideal, k) or 1.0
    return dcg(relevance, k) / idcg
```

**Bootstrap by query**

```python
import random
def mean_ci(values, n_boot=2000, alpha=0.05):
    n = len(values)
    boots = []
    for _ in range(n_boot):
        sample = [values[random.randrange(n)] for _ in range(n)]
        boots.append(sum(sample)/n)
    boots.sort()
    lo = boots[int((alpha/2)*n_boot)]
    hi = boots[int((1-alpha/2)*n_boot)]
    return (sum(values)/n, lo, hi)
```

**k‑sweep** (compute curves for Recall@k, nDCG@k).

---

## 9) Debugging playbook (when numbers look off)

1. **Low Recall@5, high Recall@50:** reranker or small `k`. Inspect reranker; test **re‑ranking only** with larger input set.  
2. **Low Recall@50:** index/embedding/chunking issues. Try **document‑level retrieval**; if doc‑level recall is fine, your **chunker** likely split key facts.  
3. **High Recall@5, low Precision@5:** add a **cross‑encoder reranker** or stronger lexical constraints; increase **diversity** (distinct‑doc bonus).  
4. **Low MRR / nDCG:** good evidence is present but buried; tune scoring, re‑rank on the top‑N, or add **query expansion**.  
5. **Big gaps by language/topic:** verify stopword lists, normalization (accents), and per‑language tokenization; check **domain synonyms** (BR “boleto” vs AR “cupón”).  
6. **Freshness failures:** retrieved docs are **newer** than `as_of` → labels outdated or `as_of` ignored; fix time filters.  
7. **Latency regressions:** profile **retrieve vs rerank**; cap `k_raw` and cache frequent queries.

**Hands‑on triage:** For 20 misses, print a table with `query`, `gold_evidence`, `top10`, and a **BM25 top‑10** side‑by‑side. This quickly reveals synonym and chunking issues.

---

## 10) CI gates & reporting

**Report layout** (per system & per segment):
- **Retrieval panel:** Recall@{1,3,5}, nDCG@5, Precision@5, Distinct‑docs@5, MRR, latency (median/p90) — each with **95% CIs** (bootstrap by query).  
- **k‑sweep plot** (Recall & nDCG).  
- **Top misses**: queries with 0 recall@10; their gold docs/sections.  
- **Artifacts**: index version, chunker settings, reranker model/version.

**Suggested gates (example)**

```
Ship if (CI lower bounds):
- Recall@5 ≥ 0.90 overall and ≥ 0.85 in BR-pt and es-AR segments
- nDCG@5 ≥ 0.80 overall
- Precision@5 ≥ 0.60 and Distinct-docs@5 ≥ 3.0 (avg)
- Median retrieval latency ≤ 60 ms; rerank ≤ 50 ms
```

Tune to your domain and risk tolerance.

---

## 11) Special cases & advanced topics

- **Open‑domain Q/A without complete gold:** rely on **pooling** + relevance judge; be transparent with bounds.  
- **Router across multiple corpora:** record **source** per item; compute recall *per source* and **coverage** (how often each source is selected).  
- **Entity‑centric queries:** treat **entity linking** as part of retrieval; compute **EL F1** in addition to chunk recall.  
- **Query rewriting agents:** if an agent rewrites queries, log both **original** and **rewritten**; measure recall for each to ensure the rewrite helps.  
- **No‑answer items:** measure **false‑evidence rate**—how often retrieval returns “relevant‑looking” but not actually relevant chunks for `no_answer=true` items.

---

## 12) Exercises

1. **Compute curves:** On your 7.2 dataset, compute Recall@k and nDCG@k for `k∈{1,3,5,10,20}`; identify the knee point per segment.  
2. **Reranker ablation:** Run metrics on the raw top‑50 vs reranked top‑5; report the **Δ** in nDCG@5 and Precision@5.  
3. **Chunking experiment:** Double your chunk size (or overlap) and re‑index; compare Recall@5 and Distinct‑docs@5 with CIs. What changed?  
4. **Freshness filter:** Enforce `doc.version ≤ as_of` and recompute metrics; quantify how much “cheating with newer docs” you were doing.  
5. **Hard‑negative stress test:** For 100 queries, insert 3 hard negatives at ranks {1,2,3}; measure reranker robustness (nDCG@5 drop).  
6. **Latency budgeting:** Measure median & p90 latency; set a per‑segment gate that keeps experience good without harming recall.

---

## Summary

Retrieval quality is not one number. Use **Hit/Recall** to know *whether* evidence appears, **nDCG/MRR** to know *how early*, **Precision/Diversity** to know *how clean*, and **Latency/Freshness** to know *at what cost*. Evaluate the **raw retriever** and **reranker** separately, report **k‑sweep curves**, slice by **segments**, and attach **bootstrap CIs** by query. With these metrics and clean run logs, you can diagnose failures, tune chunking/ranking, and set **gates** that make your generator’s life easy—and your releases safe.
