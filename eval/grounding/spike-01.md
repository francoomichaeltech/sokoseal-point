# Segmentation spike 01

Model: sam-3.1 · Date: 2026-10-27 · Images: phone photos, 1280x963, direct sunlight and shadows

| Image | Concept | Objects | Latency |
|---|---|---|---|
| scene-all | mug | 1 (mug) | 4037 ms |
| scene-all | pen | 1 (pen) | 3406 ms |
| scene-all | tea strainer | 0 | 2670 ms |
| scene-all | strainer | 1 (strainer) | 2732 ms |
| scene-all | sieve | 0 | 3684 ms |
| scene-all | kitchen strainer | 1 (strainer) | 3894 ms |
| scene-all | yellow strainer | 1 (strainer) | 4105 ms |
| scene-all | object | 3 (strainer, pen, mug) | 4714 ms |
| scene-all | item | 3 (strainer, pen, mug) | 3007 ms |
| scene-all | product | 0 | 2192 ms |
| scene-empty | mug | 0 | 3224 ms |
| scene-empty | object | 0 | 2119 ms |

Findings
- Boxes are returned in image pixels (w, h match the uploaded image).
- Product-specific words are unreliable ("tea strainer", "sieve" found nothing).
- "object" found every product on the counter and nothing on the empty table, so grounding
  uses one "object" request per tap and picks the box under the tap.
- The bag at the edge of scene-all and the shadows were not detected.