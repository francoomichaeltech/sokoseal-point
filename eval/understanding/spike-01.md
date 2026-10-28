# Understanding spike 01

Models: muse-spark-1.3 · muse-voice-transcribe-1.0 · sam-3.1
Clips: phone video, 360x640 at 30 fps after messaging-app compression, 4–11 s

## Video to Spark (video + audio, reasoning low)
| Clip | Spoken | Actions | SAM at Spark point | Upload | Model |
|---|---|---|---|---|---|
| sw-01 | Nipe hii mbili | ADD 2 POINT | MATCH | 4428 ms | 51235 ms (first call) |
| sw-02 | Nataka hizi mbili, na ile moja | ADD 2 POINT; ADD 1 POINT | MATCH; NONE | 5063 ms | 8439 ms |
| sw-03 | Nipe hii tano, hapana, ziwe tatu | ADD 3 POINT | MATCH | 4624 ms | 9567 ms |
| sw-04 | Nipe hii moja (empty table) | ADD 1 POINT, needs_clarification | NONE | 6081 ms | 10350 ms |
| sw-05 | Mambo, bei gani hii? | none | – | 5985 ms | 5238 ms |
| en-01 | Could I get two of this? | ADD 2 POINT | MATCH (pen) | 5725 ms | 10940 ms |
| sw-06-long | six requests | five (two merged) | – | 4914 ms | 24862 ms |
| sw-06-long + transcript, reasoning minimal | six requests | six | – | 3367 ms | 9818 ms |
| sw-02, reasoning minimal | same as sw-02 | same | – | 2835 ms | 31080 ms |

## Muse Voice
- sw-02: "Nataka hivi mbili na ile moja." in 3959 ms
- sw-06: all six requests in 5210 ms

## Transcript to Spark (text only, reasoning minimal), three runs each
| Transcript | Correct | Model |
|---|---|---|
| sw-06, six requests | 6/6 every run | 2062–3178 ms |
| sw-02, two requests | 2/2 every run | 1929–2465 ms |

## SAM with a hand in the frame ("object")
Video frames at 360x640 with the pointing hand in view: objects found in 1 of 5 frames.
The same products without a hand at 1280x963 were all found (spike 01 of grounding).

## Findings
- Kiswahili requests, quantities, corrections and follow-ons were understood from reference
  examples only; no training or fine-tuning.
- Text-only intent from a Muse Voice transcript was faster and more reliable than video input.
- Spark video points land near the fingertip, often beside the product.
- SAM misses objects when a hand is in the frame.
- Video request latency varied from 5 s to 31 s.

## Decisions
- Muse Voice transcribes; Spark turns the transcript into ordered actions (text only).
- Scan the counter with SAM when recording starts, before the hand enters, at full camera resolution.
- Track fingertip pauses on the device during recording and pair them with POINT actions in order.
  If the counts differ, apply none of the POINT actions.
- Video understanding stays as a fallback only.