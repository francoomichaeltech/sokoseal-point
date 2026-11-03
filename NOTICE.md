# Third-Party Notices

SokoSeal Point incorporates open-source software and pre-trained model assets from third parties.

## Production Dependency Licence Summary

Generated with `npx license-checker --production --summary`:

```text
├─ MIT: 15
├─ Apache-2.0: 8
├─ ISC: 4
├─ LGPL-3.0-or-later: 1
├─ CC-BY-4.0: 1
├─ UNLICENSED: 1
├─ BSD-3-Clause: 1
└─ 0BSD: 1
```

Note: The single `UNLICENSED` entry in the summary is the root package `sokoseal-point@0.1.0` itself (which is marked `"private": true` in `package.json` and licensed under the [MIT License](LICENSE)).

## Direct Production Dependencies

- `@mediapipe/tasks-vision` (`^1.1.1`) — Apache-2.0 License, Copyright Google LLC
- `idb-keyval` (`^6.3.0`) — Apache-2.0 License, Copyright Jake Archibald
- `lucide-react` (`^1.62.0`) — ISC License, Copyright Cole Bemis and Lucide Contributors
- `next` (`16.4.3`) — MIT License, Copyright Vercel, Inc.
- `openai` (`^7.45.1`) — Apache-2.0 License, Copyright OpenAI
- `qrcode.react` (`^4.2.0`) — ISC License, Copyright Paul O'Shannessy
- `react` (`19.3.0`) and `react-dom` (`19.3.0`) — MIT License, Copyright Meta Platforms, Inc. and affiliates
- `server-only` (`^0.0.1`) — MIT License, Copyright Meta Platforms, Inc. and affiliates

## Pre-Trained Models and Runtime Services

- **MediaPipe Hand Landmarker (`hand_landmarker.task`)** — Created by Google LLC, licensed under the Apache License, Version 2.0 (`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`).
- **Meta Model API** — Server-side inference calls use `sam-3.1`, `muse-voice-transcribe-1.0`, and `muse-spark-1.3` via the Meta Model API (`https://api.meta.ai/v1`).
