# SokoSeal Point

SokoSeal Point is a phone web application for small retail shops in Tanzania. A shopkeeper or customer points a finger at real products on the counter while holding the microphone button and speaking naturally in Kiswahili, English, or a mix of both (for example, `"Nipe hii mbili, na hii moja"`, `"Give me one, hapana, ziwe saba"`, or `"naomba chumvi mbili na wani soap"`).

The application resolves which products were pointed at and how many were requested, checks them against the shop's own catalogue, and presents a review card in the basket. Nothing enters the basket until the user presses **Add to basket**. Once reviewed, the basket can be sealed as a read-only record. Payments are out of scope.

## Core Principle

**Models interpret; deterministic code decides.**
- Product names, SKUs, and prices come strictly from the shop's local catalogue.
- Unclear pointings, items not in the shop, or mismatched counts never silently alter the basket; they surface as explicit review prompts (`Choose the product` or `Not in your shop`).

## Stack

- **Framework**: Next.js 16.4.3 (App Router, Turbopack, Cache Components), React 19, TypeScript, Tailwind CSS v4
- **On-device hand tracking**: MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`) for fingertip and index-finger ray tracking
- **Meta Model API** (server-side routes only, via `META_API_BASE_URL` and `MODEL_API_KEY`):
  - `sam-3.1`: object bounding-box segmentation on counter frames (`POST /api/scan`)
  - `muse-voice-transcribe-1.0`: speech transcription with shop vocabulary hints (`POST /api/transcribe`)
  - `muse-spark-1.3`: visual product identification against catalogue reference photos (`POST /api/identify`) and structured request parsing (`POST /api/intent`)
- **Local storage**: `localStorage` for shop configuration, product metadata, and basket state; `IndexedDB` (`idb-keyval`) for product reference photos
- **Testing**: Vitest and ESLint

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and set your Meta Model API credentials:

```bash
cp .env.example .env.local
```

Required environment variables in `.env.local`:
- `MODEL_API_KEY`: server-side API key for the Meta Model API
- `META_API_BASE_URL`: base URL (defaults to `https://api.meta.ai/v1`)

3. Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` on a phone (or scan the desktop QR handoff code from your phone). Camera and microphone access require `localhost` or HTTPS.

## Verification Commands

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contributions](CONTRIBUTIONS.md)
- [Third-Party Notices](NOTICE.md)
- [Licence](LICENSE)
