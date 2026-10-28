# SokoSeal Point: product direction

## What it does
A shop assistant on the phone. The shopper or shopkeeper points at products on the counter and says
what they want, in Kiswahili or English. SokoSeal works out which products were meant and how many,
checks them against the shop's own catalogue, and updates the basket. Nothing is added unless every
part is verified.

## Who it is for
Small shops in Tanzania, where people name products by pointing: "nipe hii mbili, na ile moja".
Many products have no name the buyer knows.

## Languages
- Kiswahili is the primary language. The demo and evaluation start there.
- English is fully supported so judges can try it.
- Models are not trained or fine-tuned. Kiswahili and English reference examples in the prompt show
  the expected patterns (demonstratives, quantities, corrections). Evaluation sets are kept separate
  and never added to prompts.

## Pipeline
1. Hold the button, point and speak, release. The phone records a 3–6 s clip.
2. Muse Spark watches and listens to the clip and returns the requested actions in spoken order,
   with when and where the finger pointed for each "hii/ile".
3. SAM 3.1 outlines the product at that point.
4. The outlined product is matched against the catalogue's reference photos. No match is UNKNOWN.
5. Code applies the verified actions in order. Prices come only from the catalogue.

## Safety rules
- Models interpret; code decides. No model output changes the basket directly.
- If the number of pointed products does not match the number of "this/that" references, those
  actions are not applied.
- Unknown products, unclear speech and failed calls leave the basket unchanged.
- The basket is a draft. Seal is the human review step.

## Out of scope
Payments, inventory, currency conversion, delivery.