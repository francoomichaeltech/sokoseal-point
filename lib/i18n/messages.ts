export type Locale = "en" | "sw";

const en = {
  nav: { products: "Products", point: "Point", basket: "Basket" },
  handoff: {
    title: "Continue on your phone",
    body: "Point at products and speak naturally. Works with your phone camera and microphone.",
    steps: ["Open your phone camera", "Scan the QR code", "Start on your phone"],
    footer: "Already on your phone? Open this link there.",
  },
  point: {
    camera: {
      idle: "Turn on the camera to point at products.",
      starting: "Starting camera…",
      denied: "Camera access is blocked. Allow it in your browser settings, then try again.",
      unavailable: "No camera found. Open this page on a phone over HTTPS.",
      error: "The camera could not start. Try again.",
      start: "Turn on camera",
      retry: "Try again",
    },
    mic: {
      hold: "Hold to speak",
      listening: "Listening…",
      denied: "Microphone access is blocked. Allow it in your browser settings.",
      unavailable: "No microphone found.",
      error: "The microphone could not start. Try again.",
    },
  },
};

export type Messages = typeof en;

const sw: Messages = {
  nav: { products: "Bidhaa", point: "Elekeza", basket: "Kikapu" },
  handoff: {
    title: "Endelea kwenye simu yako",
    body: "Elekeza kwenye bidhaa na uzungumze kwa kawaida. Inatumia kamera na maikrofoni ya simu yako.",
    steps: ["Fungua kamera ya simu yako", "Skani msimbo wa QR", "Anza kwenye simu yako"],
    footer: "Tayari uko kwenye simu? Fungua kiungo hiki huko.",
  },
  point: {
    camera: {
      idle: "Washa kamera ili kuelekeza kwenye bidhaa.",
      starting: "Inawasha kamera…",
      denied: "Kamera imezuiwa. Iruhusu kwenye mipangilio ya kivinjari, kisha jaribu tena.",
      unavailable: "Hakuna kamera. Fungua ukurasa huu kwenye simu kupitia HTTPS.",
      error: "Kamera imeshindwa kuwaka. Jaribu tena.",
      start: "Washa kamera",
      retry: "Jaribu tena",
    },
    mic: {
      hold: "Shikilia ili uongee",
      listening: "Inasikiliza…",
      denied: "Maikrofoni imezuiwa. Iruhusu kwenye mipangilio ya kivinjari.",
      unavailable: "Hakuna maikrofoni.",
      error: "Maikrofoni imeshindwa kuwaka. Jaribu tena.",
    },
  },
};

export const messages: Record<Locale, Messages> = { en, sw };