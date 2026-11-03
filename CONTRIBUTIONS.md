# Contributions

## Project Author

- **Michael Francoo** (`francoomichaeltech`) — product design, architecture, implementation, and real-phone evaluation for SokoSeal Point.

## Contributing Guidelines

1. **Branching**: Create feature or release branches from `main`. Never force-push or rewrite history on `main`.
2. **Deterministic Commerce Boundary**: Models (`sam-3.1`, `muse-voice-transcribe-1.0`, `muse-spark-1.3`) are untrusted interpreters. All SKU resolution, quantity arithmetic, price calculation, and basket state transitions must remain in deterministic TypeScript modules under `lib/commerce/`, `lib/pointing/`, `lib/grounding/`, `lib/identity/validate.ts`, and `lib/intent/validate.ts`.
3. **Bilingual Support**: Every user-facing string in `lib/i18n/messages.ts` must be provided in both English (`en`) and Kiswahili (`sw`).
4. **Quality Checks**: Before every commit, run:

```bash
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All four checks must pass with zero warnings or errors.
5. **Privacy**: Never commit `.env` files, API keys, counter photos, audio/video recordings, or local evaluation recordings.
