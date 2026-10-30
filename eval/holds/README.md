# SokoSeal Point — Hold Recordings Dataset Format

This directory holds offline recordings of real phone holds for deterministic replay evaluation.
Actual recording JSON files (`*.json`) are git-ignored to keep raw image data and user recordings local.

## Recording Format

Each recording file in `eval/holds/` can be either a single hold JSON object or an array of hold JSON objects (`RecordedHold[]`).

```json
{
  "id": "c7a84e31-893f-42b7-a367-17210e3d2345",
  "createdAt": 1729864200000,
  "holdStartMs": 12450.5,
  "holdEndMs": 16210.8,
  "durationMs": 3760.3,
  "frameUrl": "data:image/jpeg;base64,...",
  "frameWidth": 1280,
  "frameHeight": 720,
  "samBoxes": [
    { "x1": 0.12, "y1": 0.35, "x2": 0.28, "y2": 0.72 },
    { "x1": 0.55, "y1": 0.40, "x2": 0.70, "y2": 0.85 }
  ],
  "samples": [
    {
      "tip": { "x": 0.21, "y": 0.45 },
      "direction": { "x": 0.05, "y": 0.99 },
      "hand": { "x1": 0.15, "y1": 0.40, "x2": 0.30, "y2": 0.65 },
      "at": 12850
    }
  ],
  "identities": [
    {
      "box": { "x1": 0.12, "y1": 0.35, "x2": 0.28, "y2": 0.72 },
      "state": "product",
      "sku": "COKE1",
      "name": "Coca-Cola 350ml"
    }
  ],
  "transcript": "Nipe hii mbili, na hii moja",
  "heard": "Nipe hii mbili, na hii moja",
  "intent": {
    "transcript": "Nipe hii mbili, na hii moja",
    "actions": [
      { "action": "ADD", "quantity": 2, "reference": "POINT", "namedProduct": null, "spoken": "Nipe hii mbili" },
      { "action": "ADD", "quantity": 1, "reference": "POINT", "namedProduct": null, "spoken": "na hii moja" }
    ],
    "needsClarification": false
  },
  "pairedTargets": [
    { "state": "product", "sku": "COKE1" },
    { "state": "product", "sku": "PEPSI1" }
  ],
  "marks": [
    {
      "target": { "state": "product", "sku": "COKE1" },
      "name": "Coca-Cola 350ml",
      "box": { "x1": 0.12, "y1": 0.35, "x2": 0.28, "y2": 0.72 },
      "duration": 650
    }
  ],
  "outcomes": [
    {
      "index": 0,
      "action": "ADD",
      "quantity": 2,
      "spoken": "Nipe hii mbili",
      "pointNumber": 1,
      "status": "applied",
      "sku": "COKE1",
      "name": "Coca-Cola 350ml",
      "lineQuantity": 2
    }
  ],
  "products": [
    {
      "id": "prod-1",
      "sku": "COKE1",
      "name": "Coca-Cola 350ml",
      "price": 1000,
      "currency": "TZS",
      "aliases": ["Coke", "Soda"],
      "referenceImages": [],
      "active": true
    }
  ],
  "latencies": {
    "scanMs": 1450,
    "transcribeMs": 1200,
    "identifyMs": 2100,
    "intentMs": 1850,
    "totalMs": 3500
  },
  "annotation": {
    "status": "correct",
    "meantProducts": ["COKE1", "PEPSI1"],
    "notes": "Clear lighting, pointed directly at bottles"
  }
}
```

## How to Record and Evaluate

1. Open the app on your phone and navigate to `/debug`.
2. Toggle **Hold Recorder** to **ENABLED**.
3. Go to `/point` and record holds across standard scenarios (see `docs/EVALUATION.md`).
4. In `/basket`, mark each request as **Correct** or **Wrong**, and select what was actually meant.
5. In `/debug`, tap **Export JSON** to download the recordings file.
6. Copy the exported file to `eval/holds/recordings.json`.
7. Run the replay tool:
   ```bash
   node scripts/replay.mjs
   ```
