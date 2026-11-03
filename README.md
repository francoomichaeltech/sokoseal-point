# SokoSeal Point

SokoSeal Point is a mobile web application built for small retail shops in Tanzania. A shopkeeper or customer points a finger at physical products on the counter while holding the microphone button and speaking naturally in Kiswahili, English, or a mix of both—for example:

- `"Nipe hii mbili, na hii moja"` ("Give me two of this, and one of this")
- `"Give me one, hapana, ziwe saba"` ("Give me one—no, make it seven")
- `"Naomba chumvi mbili na wani soap"` ("Please give me two salt and one soap")

SokoSeal Point resolves which objects on the counter were pointed at and how many units were requested, matches them against the shop's own local catalogue and reference photos, and presents a structured **New request** review card in the basket. Nothing enters the basket until the user explicitly taps **Add to basket**. Once confirmed, the basket can be sealed into a read-only transaction record. Payments are intentionally out of scope.

---

## Core Design Principle

**Models interpret; deterministic code decides.**

1. **Catalogue Authority**: Product names, SKUs, and prices come exclusively from the shop's local catalogue (`localStorage` and `IndexedDB`). AI models cannot invent products, alter prices, or mutate the basket directly.
2. **Explicit Review Gate**: Every hold resolves into a review card before touching the basket. The user can inspect the single labelled counter photo, verify the interpreted actions, resolve any ambiguous item, or discard the request.
3. **Honest Uncertainty Handling**:
   - Pointing at an object that is not in the shop catalogue surfaces directly as **`That item is not in your shop`** (`not_in_shop`) without showing a misleading product picker.
   - Pointing at empty counter space surfaces directly as **`No product where you pointed`** (`nothing_pointed`) without guessing a nearby product.
   - Ambiguous pointings (`unclear_product`), pointing-count mismatches (`count_mismatch`), or unverified references (`check_failed`, `no_previous`) require the user to explicitly pick a catalogue product or skip the line before adding.

---

## Architecture and End-to-End Pipeline

```text
Mobile Camera & Microphone
  │
  ├─► 1. Pre-Point Counter Scan (No Hand in View)
  │     ├─► Rolling frame quality scorer (Laplacian sharpness + exposure balance)
  │     ├─► POST /api/scan ──► Meta SAM (sam-3.1, concept="object")
  │     └─► cleanBoxes() + selectSceneBoxes() isolate distinct counter objects
  │
  ├─► 2. On-Device Fingertip & Ray Tracking (During Hold)
  │     ├─► MediaPipe Hand Landmarker (@mediapipe/tasks-vision @ 20 fps on device)
  │     ├─► One-Euro filter smooths fingertip (landmark 8) and index-finger ray (5 -> 8)
  │     ├─► resolveDwell() checks fingertip proximity (<= 0.04) before capped ray cast
  │     ├─► segmentVisits() groups chronological product visits and still empty-space pauses
  │     └─► preIdentifyVisits() starts POST /api/identify during the hold (cached per scan)
  │
  └─► 3. Hold Release & Deterministic Basket Planning
        ├─► Parallel execution:
        │     ├─► POST /api/transcribe ──► Meta Muse Voice (muse-voice-transcribe-1.0)
        │     └─► locateTargets() ──► Meta Muse Spark (muse-spark-1.3) batch visual ID
        │           labels all counter objects on the single pre-point photo (sceneMarks)
        │           and resolves pointed visits in chronological order (marks)
        ├─► Deterministic transcript normalization (Kiswahili/English numerals, typos, aliases)
        ├─► POST /api/intent ──► Meta Muse Spark (muse-spark-1.3) structured action parser
        │     (with deterministic local fallback parser if the network is unreachable)
        ├─► parseIntent() schema validation + duplicate-action deduplication
        ├─► keepLongest() trims brief hand pass-overs when visits exceed POINT actions
        ├─► Session frame and scan caches are cleared immediately so the next hold starts fresh
        └─► applyActions() (lib/commerce/plan.ts) computes preview outcomes for review
```

### Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Application Framework** | Next.js 16.4.3 (App Router, Turbopack, Cache Components), React 19, TypeScript | Mobile UI, state management, and same-origin server API routes |
| **Styling** | Tailwind CSS v4 | Mobile-first responsive interface and desktop QR handoff |
| **On-Device Vision** | MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`) | Real-time 21-keypoint hand and fingertip tracking in the browser via WASM |
| **Object Segmentation** | Meta `sam-3.1` (`POST /api/scan`) | Counter object bounding-box detection prior to hand entry |
| **Speech Recognition** | Meta `muse-voice-transcribe-1.0` (`POST /api/transcribe`) | Push-to-talk bilingual (Kiswahili/English) audio transcription with catalogue vocabulary hints |
| **Visual Identification** | Meta `muse-spark-1.3` (`POST /api/identify`) | Multimodal comparison of counter object crops (`448 px`) + full counter scene (`512 px`) against shop reference photos (`320 px`) |
| **Intent Extraction** | Meta `muse-spark-1.3` (`POST /api/intent`) | Structured extraction of ordered `ADD`, `REMOVE`, and `SET` actions with `POINT`, `SAME`, and `NAMED` references |
| **Local Persistence** | `localStorage` + `IndexedDB` (`idb-keyval`) | On-device persistence for shop settings, product catalogue, reference photos, and basket state |
| **Verification** | Vitest 5, TypeScript 5, ESLint 9 | Automated unit and integration test suites (`18` test files, `118` tests) |

---

## Setup and Running with Your Own Meta Model API Key

Judges and developers can run and test SokoSeal Point locally or on a mobile phone using their own Meta Model API key. No hosted credits from the author are required, and API keys are never committed to the repository.

### Prerequisites

- **Node.js**: v20 or newer (`npm` v10+)
- **Meta Model API Key**: An active key with access to `sam-3.1`, `muse-voice-transcribe-1.0`, and `muse-spark-1.3`

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/francoomichaeltech/sokoseal-point.git
cd sokoseal-point
npm install
```

Note: `npm install` automatically runs `scripts/copy-mediapipe.mjs` (`postinstall`), which copies the MediaPipe WebAssembly runtime files from `node_modules/@mediapipe/tasks-vision/wasm` into `public/mediapipe/wasm` so hand tracking loads locally without external WASM CDN dependencies.

### 2. Configure Your Meta Model API Key (`.env.local`)

Copy the provided `.env.example` template to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` and set your `MODEL_API_KEY`:

```dotenv
# Server-side only. Never prefix with NEXT_PUBLIC_ and never commit .env.local.
MODEL_API_KEY=your_meta_model_api_key_here
META_API_BASE_URL=https://api.meta.ai/v1

# Verified Meta Model API identifiers
META_INTENT_MODEL=muse-spark-1.3
META_SEGMENT_MODEL=sam-3.1
META_VOICE_MODEL=muse-voice-transcribe-1.0
```

**Security guarantees for `MODEL_API_KEY`**:
- Every module in `lib/meta/` (`sam.ts`, `spark.ts`, `voice.ts`) imports `"server-only"`, preventing any build from bundling API credentials into client JavaScript.
- Every server route (`/api/scan`, `/api/identify`, `/api/transcribe`, `/api/intent`) enforces `isSameOrigin(request)` and strict payload validation before invoking the Meta Model API.
- `.gitignore` excludes `.env*` (while keeping `.env.example`), ensuring `.env.local` is never tracked by Git.

### 3. Start the Development Server

```bash
npm run dev
```

- **On a desktop browser**: Opening `http://localhost:3000` displays the **Desktop Handoff** screen with a language toggle (`English` / `Kiswahili`) and a scannable QR code for opening the app on a phone.
- **On a mobile phone ( or mobile device emulator)**: Open `http://localhost:3000` (via USB port-forwarding `adb reverse tcp:3000 tcp:3000` or an HTTPS tunnel) to access the full camera and microphone workflow. Note that mobile browsers require either `localhost` or `https://` to grant `getUserMedia` camera and microphone permissions.

---

## Step-by-Step Phone Testing Guide

1. **One-Time Shop Setup (`/setup`)**:
   - Enter a shop name (for example, `Duka la Michael`), select your interface language (`English` or `Kiswahili`), and choose your currency (`TZS`, `KES`, `UGX`, or `USD`). Currency is locked once set so basket totals remain consistent.
2. **Add Catalogue Products (`/products` -> `/products/new`)**:
   - Add 3 to 4 real physical items you have in front of you (for example: `Chumvi` at `500`, `Sabuni` at `1500`, `Mafuta ya Family Care` at `1300`, `Kikombe` at `500`).
   - Capture **2 to 3 clear reference photos** of each item from slightly different angles against your counter surface, and optionally add spoken aliases (for example, `Salt`, `Soap`, `Cup`) or a short visual distinguishing note.
3. **Arrange the Counter and Open Point (`/point`)**:
   - Place your catalogue items on a well-lit surface with `4–6 cm` of spacing between items, plus one non-shop object (such as a phone charger or pen) and an area of empty counter space.
   - Let the camera view the counter **without your hand in frame for 1–2 seconds** first. SokoSeal Point automatically captures the sharpest unobstructed counter frame and runs `sam-3.1` in the background (`Ready to point`).
4. **Hold to Point and Speak**:
   - **Multi-item pointing**: Press and hold the microphone button, point your index fingertip at the first item for ~1 second, move to the second item for ~1 second, and say `"Nipe hii mbili, na hii moja"`. Release the button.
   - **Code-switching and self-correction**: Hold the button, point at an item, and say `"Give me one, hapana, ziwe tatu, na kikombe moja"`. Release the button.
   - **Non-shop item and empty counter space**: Hold the button, point at the non-shop object (`"nipe hii moja"`), or point at empty counter space (`"nipe hii moja"`). Release the button.
5. **Review on the Basket Card (`/basket`)**:
   - Inspect the **single pre-point counter photo**: every detected object on the counter is labelled either in green (`<Product> · in stock`) or dashed (`Not in your shop`).
   - Inspect the action rows below the photo:
     - Validated items show their catalogue name, unit price, and quantity (`Add 2 · Chumvi`).
     - Non-shop items state `That item is not in your shop` directly.
     - Empty-space pointings state `No product where you pointed` directly.
   - Tap **Add to basket** to commit the validated actions, or **Discard** to cancel.
6. **Audit Log and Sealing (`/basket`)**:
   - Expand **What was asked** to inspect the chronological audit trail of heard speech, normalized transcripts, and exact basket line changes.
   - Tap **Seal basket** to lock the basket into a read-only record, then tap **Start new basket** to return directly to `/point`.
7. **Catalogue Backup and Restore (`/settings`)**:
   - Use **Export catalogue** to download a validated JSON bundle containing all products and base64 reference photos, or **Import catalogue** to restore a shop catalogue on another device.

---

## Repository Structure

```text
sokoseal-point/
├── app/
│   ├── (app)/
│   │   ├── basket/             # Basket review card, line items, proof log, and sealed state
│   │   ├── point/              # Camera viewfinder and push-to-talk pointing session
│   │   ├── products/           # Catalogue list, new product form, and edit product form
│   │   ├── settings/           # Shop name, language toggle, currency display, export/import
│   │   └── layout.tsx          # Fixed mobile shell (AppHeader + scrollable main + BottomNav)
│   ├── api/
│   │   ├── identify/route.ts   # POST /api/identify -> muse-spark-1.3 visual matching
│   │   ├── intent/route.ts     # POST /api/intent   -> muse-spark-1.3 request action parser
│   │   ├── scan/route.ts       # POST /api/scan     -> sam-3.1 object segmentation
│   │   └── transcribe/route.ts # POST /api/transcribe -> muse-voice-transcribe-1.0 ASR
│   ├── setup/page.tsx          # First-run shop onboarding (name, language, currency)
│   ├── globals.css             # Design tokens and mobile viewport utilities
│   ├── layout.tsx              # Root layout and DeviceGate wrapper
│   └── page.tsx                # Entry redirect (/setup -> /products -> /point)
├── components/
│   ├── basket/                 # RequestCard, PointedEvidence, PointedChips, ProofSheet, SealedView
│   ├── camera/                 # PointSession, HoldButton, StatusPill, OutcomeList
│   ├── products/               # ProductForm, PhotoSlot
│   ├── shop/                   # ShopGate route guard
│   └── ui/                     # AppHeader, BottomNav, DesktopHandoff, DeviceGate, LanguageSwitch
├── docs/
│   └── ARCHITECTURE.md         # Deep-dive technical architecture and pipeline specification
├── lib/
│   ├── catalogue/              # Product store, SKU generator, IndexedDB photos, JSON transfer
│   ├── commerce/               # Deterministic basket planner (plan.ts), target matcher, store
│   ├── grounding/              # SAM box parser, cleanBoxes(), selectSceneBoxes(), ray casting
│   ├── http/                   # Same-origin request guard for server API routes
│   ├── i18n/                   # Complete English (en) and Kiswahili (sw) message dictionaries
│   ├── identity/               # Visual identification prompt, strict JSON validator, cropper
│   ├── intent/                 # Speech normalizer, fallback parser, prompt, action deduplicator
│   ├── media/                  # Camera hook, frame sharpness/exposure scorer, WAV recorder
│   ├── meta/                   # Server-only adapters for sam-3.1, muse-spark-1.3, muse-voice-1.0
│   ├── pointing/               # Hand tracker, One-Euro filter, resolveDwell(), segmentVisits(), locateTargets()
│   ├── requests/               # In-memory hold request lifecycle (runHold.ts, store.ts)
│   ├── shop/                   # Shop configuration store
│   └── voice/                  # Catalogue-prioritized ASR keyword builder
├── scripts/
│   └── copy-mediapipe.mjs      # Copies MediaPipe WASM binaries to public/mediapipe/wasm
└── tests/                      # 18 Vitest test suites (118 unit and integration tests)
```

---

## Verification and Automated Tests

Run the full verification suite before deploying or committing changes:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
```

All `18` test files (`118` tests) run deterministically offline in Vitest:
- `tests/grounding.test.ts` & `tests/resolve.test.ts`: Box cleaning, fingertip-proximity priority over slanted rays, nested/overlapped object selection, and ray reach capping.
- `tests/trace.test.ts`, `tests/dwell.test.ts`, & `tests/fit.test.ts`: Chronological multi-visit trace segmentation, empty-space dwell detection, and pass-over visit pruning.
- `tests/capture.test.ts`: Sharpness/exposure frame scoring, scan retry/fallback, in-hold pre-identification caching, single-photo `sceneMarks` labelling, and strict empty-space preservation.
- `tests/identity.test.ts`: Multimodal prompt formatting, scene context inclusion, and strict SKU validation against catalogue references.
- `tests/intent.test.ts` & `tests/voice-keywords.test.ts`: Kiswahili/English numeral and typo normalization (`"wani soap"`, `"adi ten"`, `"namba tatu"`), self-corrections, duplicate-action filtering, and local fallback intent parsing.
- `tests/commerce.test.ts`, `tests/commerce-targets.test.ts`, & `tests/changes.test.ts`: Safe basket planning (`ADD`, `REMOVE`, `SET`), `not_in_shop` and `nothing_pointed` rejections, and user confirmation tracking.
- `tests/catalogue-transfer.test.ts` & `tests/sku.test.ts`: Catalogue JSON export/import validation and SKU reservation rules.

---

## Known Limitations and Engineering Trade-offs

1. **Pre-Point Unobstructed Counter View**: `sam-3.1` segments objects most reliably when no hand is occluding the counter. If a user immediately covers the counter with their hand before the first background scan completes, `scanWithFallback` captures an immediate frame on button press, which may include the entering hand and reduce bounding-box precision. Waiting ~1 second pointing the camera at the counter before pressing the microphone button yields the cleanest single-photo scene labels.
2. **Cloud Inference Latency**: Object segmentation (`sam-3.1`), speech transcription (`muse-voice-transcribe-1.0`), visual identification (`muse-spark-1.3`), and intent parsing (`muse-spark-1.3`) execute over HTTPS against the Meta Model API. While SokoSeal Point overlaps visual identification during the hold (`preIdentifyVisits`) and runs transcription in parallel with remaining vision checks on release, slow 3G/edge mobile connections will increase post-release review time. If an API call times out or fails, deterministic fallbacks ensure the app never crashes or traps the user on an error screen.
3. **Physical Spacing and Lighting**: Products stacked directly on top of one another (`< 2 cm` separation) or filmed in very dim counter lighting can produce overlapping bounding boxes (`AMBIGUOUS`) or low-confidence visual matches (`unknown`). By design, SokoSeal Point refuses to guess in those cases and asks the user to confirm or reports the item as not in stock.
4. **Device-Local Storage**: Catalogue items, reference photos, and baskets are stored in the phone browser's `localStorage` and `IndexedDB`. Clearing site data removes local state unless the shopkeeper exports a backup via **Settings -> Export catalogue**.

---

## Documentation and Licences

- [Technical Architecture (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [Contribution Guidelines (`CONTRIBUTIONS.md`)](CONTRIBUTIONS.md)
- [Third-Party Notices (`NOTICE.md`)](NOTICE.md)
- [MIT Licence (`LICENSE`)](LICENSE)
