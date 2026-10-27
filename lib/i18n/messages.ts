export type Locale = "en" | "sw";

const en = {
  nav: { products: "Products", point: "Point", basket: "Basket" },
  handoff: {
    title: "Continue on your phone",
    body: "Point at products and speak naturally. Works with your phone camera and microphone.",
    steps: ["Open your phone camera", "Scan the QR code", "Start on your phone"],
    footer: "Already on your phone? Open this link there.",
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
};

export const messages: Record<Locale, Messages> = { en, sw };