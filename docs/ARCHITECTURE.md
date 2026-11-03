# SokoSeal Point Technical Architecture

## 1. Architectural Overview

SokoSeal Point turns a standard mobile phone into a multimodal point-and-speak counter assistant for small retail shops in Tanzania. The user holds the microphone button, points at physical items on the counter, and speaks naturally in Kiswahili, English, or a mix of both.

The core architectural boundary separates **probabilistic model perception** from **deterministic application logic**:

- **Probabilistic Perception (Untrusted Interpreters)**:
  - `sam-3.1` (`POST /api/scan`): Proposes normalized 2D object bounding boxes `[x1, y1, x2, y2]` on a counter frame.
  - `muse-voice-transcribe-1.0` (`POST /api/transcribe`): Transcribes push-to-talk 16 kHz mono PCM WAV audio into text, biased by shop vocabulary hints.
  - `muse-spark-1.3` (`POST /api/identify` and `POST /api/intent`): Matches counter object crops against reference photos and parses spoken transcripts into structured action candidates.
- **Deterministic Decision Engine (Trusted Authority)**:
  - `lib/grounding/select.ts`: Cleans SAM boxes (`cleanBoxes`), isolates distinct counter objects (`selectSceneBoxes`), and casts rays (`castRay`).
  - `lib/pointing/resolve.ts` & `lib/pointing/trace.ts`: Resolves fingertip proximity (`TOUCH_LIMIT = 0.04`) and length-capped finger rays (`resolveDwell`) into ordered chronological visits (`segmentVisits`).
  - `lib/identity/validate.ts` & `lib/intent/validate.ts`: Enforces strict JSON schemas, rejects hallucinated SKUs, and deduplicates repeated actions.
  - `lib/commerce/plan.ts`: Pairs `POINT`, `SAME`, and `NAMED` actions with resolved targets and catalogue SKUs, computing preview outcomes without mutating the basket until explicit user confirmation.

```text
Phone Camera & Microphone
  │
  ├─► 1. Background / Pre-Point Counter Scan
  │     ├─► Rolling frame buffer scored by Laplacian sharpness & exposure (lib/media/capture.ts)
  │     ├─► POST /api/scan (sam-3.1, concept="object") while no hand is in view
  │     └─► cleanBoxes() removes full-table surfaces, tiny noise, and duplicate IoU >= 0.8 boxes
  │
  ├─► 2. On-Device Hand & Fingertip Tracking (MediaPipe Hand Landmarker @ 20 fps)
  │     ├─► One-Euro filter smooths fingertip (landmark 8) & index ray (5 -> 8)
  │     ├─► Stillness keyframes captured when fingertip velocity drops
  │     ├─► segmentVisits() resolves fingertip proximity & capped ray to ordered Visits
  │     └─► preIdentifyVisits() starts POST /api/identify during the hold (ScanIdentityCache)
  │
  └─► 3. Hold Release & Review Card Resolution (lib/requests/run-hold.ts)
        ├─► Parallel execution:
        │     ├─► POST /api/transcribe (muse-voice-transcribe-1.0) with 1 retry
        │     └─► locateTargets() identifies all distinct scene objects (sceneMarks)
        │           on the single pre-point counter photo (evidence) + ordered pointed visits (marks)
        ├─► normalizeTranscript() & formatTranscript() clean bilingual numbers, typos, and aliases
        ├─► POST /api/intent (muse-spark-1.3) with deterministic fallbackParseIntent()
        ├─► parseIntent() validates schema & removes consecutive duplicate actions
        ├─► keepLongest() trims brief hand pass-overs when visits > POINT actions
        ├─► Session frame & scan caches cleared immediately so next hold is isolated
        └─► applyActions() (lib/commerce/plan.ts) renders preview in RequestCard
```

---

## 2. Module Responsibilities

| Directory | Files | Responsibility |
| :--- | :--- | :--- |
| `app/api/scan/` | `route.ts` | Validates same-origin and JPEG data URL (`<= 900 KB`), invokes `sam-3.1` with concept `"object"`, and parses normalized bounding boxes. |
| `app/api/identify/` | `route.ts` | Validates up to `20` target crops, up to `50` catalogue products (`<= 3` reference images each), and optional full-scene image; invokes `muse-spark-1.3`. |
| `app/api/transcribe/` | `route.ts` | Validates multipart `WAV` upload (`44 bytes` to `10 MB`) and up to `80` keyword hints (`<= 40` chars each); invokes `muse-voice-transcribe-1.0`. |
| `app/api/intent/` | `route.ts` | Validates transcript (`<= 500` chars), product names (`<= 200`), and `pointCount` (`0..20`); invokes `muse-spark-1.3` with strict JSON schema. |
| `lib/grounding/` | `parse.ts`, `select.ts`, `types.ts` | Parses SAM coordinate tokens, filters background/noise boxes (`cleanBoxes`), selects distinct counter objects for single-photo labelling (`selectSceneBoxes`), and casts rays (`castRay`). |
| `lib/pointing/` | `hand-tracker.ts`, `gesture.ts`, `one-euro.ts`, `resolve.ts`, `trace.ts`, `fit.ts`, `locate.ts`, `use-pointing-session.ts` | Runs MediaPipe hand tracking, extracts smoothed index-finger rays, resolves each sample to a box or empty space, segments chronological visits, and maps visits to catalogue identities. |
| `lib/identity/` | `prompt.ts`, `validate.ts`, `adapter.ts`, `client.ts`, `identify-targets.ts` | Crops counter objects (`448 px`) and full scene context (`512 px`), compares against cached `320 px` reference crops, and validates returned SKUs. |
| `lib/voice/` | `keywords.ts`, `client.ts`, `types.ts` | Prioritizes shop product names and aliases ahead of bilingual retail vocabulary within the `80`-keyword limit. |
| `lib/intent/` | `normalize.ts`, `prompt.ts`, `validate.ts`, `adapter.ts`, `client.ts` | Normalizes spoken Kiswahili/English numerals and ASR typos, prompts `muse-spark-1.3`, provides a deterministic local fallback parser (`fallbackParseIntent`), and deduplicates actions. |
| `lib/commerce/` | `plan.ts`, `targets.ts`, `changes.ts`, `store.ts`, `types.ts` | Matches `POINT`, `SAME`, and `NAMED` actions to catalogue SKUs, enforces quantity/stock rules, records user overrides, and manages basket state. |
| `lib/catalogue/` | `store.ts`, `sku.ts`, `photos.ts`, `references.ts`, `transfer.ts` | Persists product metadata in `localStorage` and reference photos in `IndexedDB`, generates unambiguous SKUs, and validates JSON export/import bundles. |

---

## 3. Detailed Subsystem Specifications

### 3.1 Counter Scanning, Frame Scoring, and Session Isolation

1. **Frame Quality Scoring (`lib/media/capture.ts`)**:
   - Every candidate camera frame is evaluated on a `96 px` luminance grid using Laplacian variance (sharpness) and mean luminance exposure balance (`scoreFrameQuality`).
   - `pickBestFrame` selects the highest-scoring frame from the rolling pre-hand buffer so motion-blurred or shadowed frames are rejected before calling `sam-3.1`.
2. **Background Scan and Scene-Change Refresh (`components/camera/point-session.tsx`)**:
   - While no hand is visible in the viewfinder, `PointSession` maintains a fresh background scan every `3 seconds` and computes an `8 x 8` luminance signature (`frameSignature`, `signatureDistance >= 14`). If the camera moves or products are rearranged on the counter, a new scan is triggered automatically.
   - If the user presses the microphone button before a background scan completes, `scanWithFallback` captures the sharpest frame immediately, retries once on transient error, and falls back to the newest cached scan.
3. **Complete Per-Hold State Isolation**:
   - As soon as a hold finishes (`stopHold` in `components/camera/point-session.tsx`), `scanRef.current`, `scanPromiseRef.current`, `scanSignatureRef.current`, `identityCacheRef.current`, and `recentFramesRef.current` are cleared. No images or object identities from a previous hold ever carry over into the next hold.

### 3.2 Pointing Geometry and Visit Segmentation

1. **Box Cleaning and Scene Selection (`lib/grounding/select.ts`)**:
   - `cleanBoxes(boxes)` discards boxes smaller than `MIN_BOX_SIDE = 0.015` or `MIN_BOX_AREA = 0.001`, discards background/table surfaces larger than `MAX_BOX_AREA = 0.55` (or `width > 0.92 && height > 0.75`), and merges near-duplicates with `IoU >= 0.8`.
   - `selectSceneBoxes(cleaned, visitedBoxes)` selects all visited boxes first and adds distinct non-overlapping foreground counter objects (`0.008 <= area <= 0.35`, filtering out nested label sub-boxes and multi-object container boxes, up to `8` boxes total) so the single pre-point counter photo labels every object on the table.
2. **Fingertip-First Resolution (`lib/pointing/resolve.ts`)**:
   - Hand detections (`withoutHand`, `HAND_COVERAGE = 0.75`) are removed from candidates, except when checking direct fingertip touch/proximity so a small object partially overlapped by the pointing hand is never lost.
   - `resolveDwell(boxes, ray)` checks:
     1. Direct containment (`selectTarget` with `EDGE_TOLERANCE = 0.01`, preferring a smaller nested object when `area(inner) <= 0.5 * area(outer)`).
     2. Immediate fingertip adjacency (`nearestBox` within `TOUCH_LIMIT = 0.04` in front of the tip, marking two candidates within `AMBIGUITY_MARGIN = 0.02` as `AMBIGUOUS`).
     3. Length-capped finger ray (`castRay` up to `maxRayReach(ray) = 1.35 * fingerLength`), preventing a ray aimed at empty counter space from crossing the entire frame to hit a distant product.
     4. Near-miss fallback (`nearestBox` within `NEAREST_LIMIT = 0.068` along the forward direction).
3. **Chronological Visit Segmentation (`lib/pointing/trace.ts`)**:
   - `segmentVisits(samples, boxes)` groups consecutive samples (`MAX_GAP_MS = 250`) that hit the same box (`MIN_VISIT_MS = 300`) or hold still (`STILL_EMPTY_RADIUS = 0.045`) while aiming at empty counter space (`MIN_EMPTY_VISIT_MS = 300`).
   - Short flickers (`REJOIN_MS = 500`) on the same target are merged.
   - Empty-space wobbles within `NEAR_VISIT_RADIUS = 0.08` of a product visit are suppressed, while genuine empty-space pointings remain `{ kind: "none" }` in exact chronological order.
4. **Single-Photo Evidence and Strict Empty Space (`lib/pointing/locate.ts`)**:
   - `locateTargets` batch-identifies `sceneBoxes` on the single pre-point counter photo (`primaryEvidence`), reusing in-hold cached promises from `preIdentifyVisits` (`ScanIdentityCache`).
   - `sceneMarks` stores the identity and bounding box of every distinct counter object on `primaryEvidence`, which `RequestCard` renders in a single `<PointedEvidence />` photo showing which items on the counter are in stock (`<Name> · in stock`) and which are not (`Not in your shop`).
   - `marks` stores only the user's chronological pointing visits. Visits with `hit.kind === "none"` remain `{ state: "none" }` without cropping or guessing nearby products.

### 3.3 Bilingual Speech Normalization, Resilient Intent Parsing, and Safe Commerce

1. **Deterministic Transcript Normalization (`lib/intent/normalize.ts`)**:
   - Before intent extraction, `normalizeTranscript(transcript, productNames)` applies deterministic word-level and phrase-level replacements:
     - Bilingual action phrases and ASR collisions: `"adi ten"` -> `"add 10"`, `"namba tatu"` -> `"3"`, `"nipee"` / `"hiipe"` -> `"nipe"`, `"naombaa"` -> `"naomba"`, `"giv me"` -> `"give me"`, `" hapana "` self-correction preservation.
     - SpokenKiswahili and English numerals (`moja`/`wani` -> `1`, `mbili`/`tuu` -> `2`, `tatu` -> `3`, up to `kumi`/`ten` -> `10`).
     - Fuzzy product-name token alignment (Levenshtein distance `<= 1` for tokens `>= 4` chars, plus Kiswahili `ki-`/`vi-` singular/plural stem matching) against the shop's active product names and aliases.
   - `formatTranscript(text)` formats the displayed quote with clean capitalization, single spacing, and terminal punctuation.
2. **Resilient Intent Extraction (`lib/intent/adapter.ts` & `lib/requests/run-hold.ts`)**:
   - `extractIntent` calls `muse-spark-1.3` with a strict JSON schema (`ADD`, `REMOVE`, `SET`; `POINT`, `SAME`, `NAMED`), retrying once on transient failure.
   - If the cloud request fails or returns an unparseable payload, `fallbackParseIntent` deterministically parses the normalized transcript and pointing count locally so `runHold` always transitions to `phase: "ready"` and never strands the user on an error screen.
3. **Safe Basket Planning (`lib/commerce/plan.ts`)**:
   - `applyActions(currentLines, actions, targets, products, choices)` executes a pure dry run:
     - `POINT` consumes the next target in `targets`:
       - `state: "product"` -> resolves the catalogue product (`applied`).
       - `state: "unknown"` -> rejects with `reason: "not_in_shop"` (rendered directly as `That item is not in your shop`, never offering a product chooser).
       - `state: "none"` -> rejects with `reason: "nothing_pointed"` (rendered directly as `No product where you pointed`, never offering a product chooser).
       - `state: "ambiguous"` or `state: "error"` -> rejects with `unclear_product` or `check_failed` (allowing the user to pick a product or skip).
     - `SAME` reuses the previous resolved SKU in the same hold.
     - `NAMED` matches `namedProduct` (and `spoken` fallback) against active catalogue names and aliases using exact, stem, and bounded edit-distance matching (`lib/commerce/targets.ts`).
     - Nothing is written to `basketStore` until the user presses **Add to basket**.
