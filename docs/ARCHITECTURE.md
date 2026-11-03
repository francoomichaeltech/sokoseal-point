# SokoSeal Point Architecture

## 1. System Overview

SokoSeal Point turns a mobile phone into a point-and-speak counter tool for small shops. The user points at physical products on the counter while holding the microphone button and speaking in Kiswahili, English, or a combination of both.

The architecture separates **probabilistic perception** (vision segmentation, visual matching, speech transcription, and intent extraction) from **deterministic decision-making** (ray-to-box geometry, visit segmentation, action validation, SKU lookup, price calculation, and basket state transitions).

```
Phone Camera & Mic
  │
  ├─► Background / Hold-Start Counter Scan ──► POST /api/scan (sam-3.1, concept="object")
  │     └─► cleanBoxes() drops frame-covering surfaces, tiny noise, and duplicate boxes
  │
  ├─► On-Device Hand Tracking (MediaPipe Hand Landmarker @ 20 fps)
  │     └─► One-Euro smoothed fingertip + index finger ray + stillness keyframes
  │     └─► segmentVisits() resolves fingertip proximity & capped ray to ordered Visits
  │     └─► preIdentifyVisits() starts POST /api/identify during the hold (cached per scan)
  │
  └─► Hold Release
        ├─► Parallel: POST /api/transcribe (muse-voice-transcribe-1.0) + locateTargets()
        ├─► Deterministic transcript normalisation (Kiswahili/English numbers, aliases)
        ├─► POST /api/intent (muse-spark-1.3) with transcript, product names, and pointCount
        ├─► parseIntent() validates schema & removes duplicate actions from same spoken words
        ├─► keepLongest() trims pass-over visits when camera saw more visits than POINT actions
        └─► applyActions() (lib/commerce/plan.ts) produces review preview & explicit outcomes
```

## 2. Directory Structure

- `app/`: Next.js App Router pages and server API routes
  - `app/setup/`: One-time shop setup (name, language, currency)
  - `app/(app)/products/`: Product catalogue list, add (`new`), and edit (`edit`)
  - `app/(app)/point/`: Live camera viewfinder and hold-to-speak interaction
  - `app/(app)/basket/`: Request review card, basket lines, proof log, and sealed view
  - `app/(app)/settings/`: Single-shop settings (shop name, language, locked currency, validated catalogue export/import)
  - `app/api/scan/`, `app/api/identify/`, `app/api/transcribe/`, `app/api/intent/`: Same-origin protected server routes calling the Meta Model API
- `lib/pointing/`: Hand landmarker loader, gesture ray extraction, One-Euro filter, fingertip-first and ray target resolution (`resolve.ts`), trace visit segmentation (`trace.ts`), duration pruning (`fit.ts`), and target location (`locate.ts`)
- `lib/grounding/`: SAM box parsing (`parse.ts`), box cleaning and ray/point selection (`select.ts`)
- `lib/identity/`: Prompt construction, strict JSON schema validation, and crop preparation for product identification against reference photos
- `lib/voice/`: Keyword hint builder (`keywords.ts`) prioritizing shop product names within the transcribe route limit
- `lib/intent/`: Pre-parse transcript normalization (`normalize.ts`), prompt with bilingual examples (`prompt.ts`), and strict output validation and deduplication (`validate.ts`)
- `lib/commerce/`: Deterministic basket planning (`plan.ts`), named product matching (`targets.ts`), user edit tracking (`changes.ts`), and local basket store (`store.ts`)
- `lib/catalogue/`: Product store (`store.ts`), SKU generation (`sku.ts`), IndexedDB photo storage (`photos.ts`), reference crop caching (`references.ts`), and validated JSON export/import (`transfer.ts`)

## 3. Key Technical Decisions

### 3.1 Counter Scanning and Capture Quality
- SAM (`sam-3.1`) is queried with the generic concept `"object"` while no hand is in view, becausehands occlude products and product-name prompts to SAM are less reliable than generic object proposals.
- Frame sharpness (Laplacian variance) and exposure quality are scored across a rolling buffer of recent frames (`lib/media/capture.ts`) so blurry or poorly exposed frames are avoided.
- If no recent background scan exists when the user presses the microphone button, `scanWithFallback` captures the sharpest frame immediately, retries once on failure, and falls back to the newest cached scan so a quick press still gets a counter photo.
- During a hold, `usePointingSession` records sharp stillness keyframes per pointing visit. If the camera moved during the hold and the initial scan cannot identify a visited product, `locateTargets` checks the visit's keyframe and displays every photo used in the basket review card.

### 3.2 Pointing and Grounding Geometry
- **Clean boxes (`cleanBoxes`)**: Boxes covering more than `55%` of the frame (table surface or large shadows) and tiny noise (`< 1.5%` side or `< 0.1%` area) are removed, and near-duplicate boxes (`IoU >= 0.8`) are merged.
- **Close products (`resolveDwell`)**: When the fingertip is directly on a box or within `0.028` normalized distance of a box edge, proximity decides before the ray. If two boxes are equally close (within `0.012`), the selection is marked `AMBIGUOUS` rather than guessed.
- **Empty space (`selectAlongRay` & `segmentVisits`)**: The pointing ray is capped relative to the visible finger/hand length (`1.15x` hand length) so pointing at empty counter space does not fly across the frame to hit a distant object. A still finger aiming at empty counter space for `>= 450 ms` is recorded as a `"none"` visit so its spoken words pair with `"nothing_pointed"` instead of shifting subsequent product pointings.

### 3.3 Speech, Normalization, and Intent
- **Voice hints (`lib/voice/keywords.ts`)**: Shop product names and aliases are placed ahead of generic Kiswahili/English shopping words and capped to the route limit (`80` hints, `<= 40` chars each).
- **Deterministic normalization (`lib/intent/normalize.ts`)**: Spoken number words (`moja`, `mbili`, `tatu`, `wani`, `tu`, `three`, etc.), common ASR mishearings (`nipee`, ` Aomba`, `vikombe`, `sabunii`), and singular/plural catalogue variants are normalized deterministically before intent parsing and during `NAMED` product matching.
- **Duplicate action filtering (`lib/intent/validate.ts`)**: Consecutive identical actions emitted for the exact same `spoken` excerpt are collapsed, while genuine repeated requests (`"hii moja, na hii moja"`) are preserved.

### 3.4 Speed Optimization
- As soon as a pointing visit (`>= 300 ms`) is detected during a hold, `preIdentifyVisits` starts identifying that box against the shop's reference photos and caches the `Promise<TargetIdentity>` per scan (`ScanIdentityCache`).
- On release, speech transcription and any remaining identity checks run in parallel (`Promise.all`), using compact JPEG crops (`384 px` target crops, `256 px` reference photos) and minimal reasoning effort.
