# SokoSeal Point — Evaluation and Replay Guide

This document describes how to record phone data at commit `b7a1613`, export the recordings, and run the deterministic replay evaluation tool to establish baseline numbers and measure any future matching changes.

---

## 1. Setup

1. **Device**: A modern mobile phone with rear camera and microphone (tested on iOS Safari and Chrome Android over HTTPS).
2. **Shop Catalogue**: Set up 2 to 4 active products with 3 clear reference photos each (e.g., Coca-Cola, Pepsi, Cooking Oil). Ensure label is visible and distinct.
3. **Counter Setup**: Place products on a counter or table 50 to 80 cm from the phone camera in good, even indoor light. Ensure all products are in view.
4. **Enable Debug Hold Recorder**:
   - In the browser, navigate to `/debug`.
   - Switch **Hold Recorder** to **ENABLED**.
   - Return to the Point screen (`/point`).

---

## 2. Recording Checklist (20–30 Holds)

Record holds covering the following test categories:

| Category | Count | Example Phrase & Action | Expected Behavior |
|---|:---:|---|---|
| **Single Product** | 4–5 | Point at product A: *"Nipe hii mbili"* / *"Give me two of this"* | ADD 2 of Product A |
| **Two Products** | 4–5 | Point at A then B: *"Nipe hii moja, na hii tatu"* | ADD 1 of Product A; ADD 3 of Product B |
| **Correction** | 3–4 | Point at A: *"Nipe hii tano, hapana, ziwe tatu"* | ADD 3 of Product A |
| **Mixed Language** | 3–4 | *"Give me two of this, na ile moja"* | ADD 2 of Product A; ADD 1 of Product B |
| **Empty Space** | 3–4 | Point deliberately at an empty spot on the table for 1–2 s: *"Nipe hii moja"* | Should detect no object (`nothing_pointed`), NOT snap to a nearby product |
| **Not in Shop** | 3–4 | Point at an uncatalogued object (e.g. a pen, keys, or unlisted soap): *"Nipe hii moja"* | Should classify as `not_in_shop` (`unknown`), NOT guess a shop product |
| **Five Products** | 2–3 | Point sequentially at 5 products in one hold: *"Nipe hii moja, na hii mbili, na hii moja, na hii moja, na hii tatu"* | All 5 pointings and requests captured in exact order |
| **Far Distance (~1 m)** | 2–3 | Step back so counter is ~1 m away, point clearly at product | Hand detected and visit resolved to correct object |
| **Quick Pointing** | 2–3 | Point briefly (~400 ms) on product A, then B | Both products captured without dropping |

---

## 3. Annotating and Exporting Recordings

1. **Annotate in Basket**:
   - Immediately after releasing each hold, the app navigates to `/basket`.
   - The **Hold Recorder Result** box appears above the buttons:
     - Mark **Correct** (green) if the app identified the correct product and quantity.
     - Mark **Wrong** (red) if it made an error.
     - For each request, select what was **actually meant** (Product SKU, "Nothing / Empty space", or "Not in shop").
     - Your annotation is saved automatically to IndexedDB.
2. **Export Recordings**:
   - Navigate to `/debug`.
   - Tap **Export JSON**.
   - Your browser downloads a file named `sokoseal-recordings-<timestamp>.json`.
   - No audio files are exported — only transcripts, bounding boxes, fingertip coordinates, and latencies.

---

## 4. Running the Replay Tool

Copy the exported JSON file to your local computer:
```bash
cp /path/to/sokoseal-recordings-*.json eval/holds/recordings.json
```

Run the deterministic replay evaluation:
```bash
node scripts/replay.mjs
```
Or specify a custom file directly:
```bash
node scripts/replay.mjs path/to/my-recordings.json
```

### Metrics Reported

1. **Pointing Accuracy**: Percentage of pointed requests where the replayed visit resolved to the annotated meant product.
2. **Empty-Space Accuracy**: Percentage of empty space gestures that correctly avoided targeting any counter object (`nothing_pointed`).
3. **Not-In-Shop Accuracy**: Percentage of uncatalogued objects correctly classified as `not_in_shop` (`unknown`).
4. **Action Accuracy**: Percentage of total actions whose final outcome (applied with correct product/quantity or rejected with correct reason) matched ground truth.
5. **Choose-Product Rate**: Percentage of actions requiring manual user disambiguation (`count_mismatch`, `nothing_pointed`, `not_in_shop`, `unclear_product`, `check_failed`, `no_previous`).
6. **Latency Per Step (Median & P90)**:
   - SAM 3.1 Counter Scan (`scanMs`)
   - Muse Voice Transcription (`transcribeMs`)
   - Muse Spark Product Identity (`identifyMs`)
   - Muse Spark Intent Parsing (`intentMs`)
   - Total Pipeline Duration (`totalMs`)

---

## 5. Baseline Evaluation Table (b7a1613)

*To be recorded by the repository owner on a real phone at commit `b7a1613`:*

| Metric | Baseline (b7a1613) | Target (Phase 3) |
|---|:---:|:---:|
| Total Holds Evaluated | *[Owner records]* | 20–30 |
| Pointing Accuracy | *[Owner records]* | Higher |
| Empty-Space Accuracy | *[Owner records]* | Higher (no phantom snaps) |
| Not-In-Shop Accuracy | *[Owner records]* | Higher |
| Action Accuracy | *[Owner records]* | Higher |
| Choose-Product Rate | *[Owner records]* | Lower on unambiguous holds |
| Scan Latency (P50 / P90) | *[Owner records]* | Lower |
| Total Pipeline Latency (P50 / P90) | *[Owner records]* | Lower |
