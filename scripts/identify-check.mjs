// Posts reference photos and object crops to /api/identify on a running server.
// Usage: node scripts/identify-check.mjs SKU:Name:reference.jpg [...] -- crop.jpg [...]
// Set BASE_URL to test another server (default http://localhost:3000).

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const split = args.indexOf("--");

if (split < 1 || split === args.length - 1) {
  console.error("Usage: node scripts/identify-check.mjs SKU:Name:reference.jpg [...] -- crop.jpg [...]");
  process.exit(1);
}

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const toDataUrl = async (file) => `data:image/jpeg;base64,${(await readFile(file)).toString("base64")}`;

const products = await Promise.all(
  args.slice(0, split).map(async (spec) => {
    const [sku, name, file] = spec.split(":");
    if (!sku || !name || !file) {
      console.error(`Bad reference "${spec}", expected SKU:Name:file.jpg`);
      process.exit(1);
    }
    return { sku, name, image: await toDataUrl(file) };
  }),
);
const targets = await Promise.all(args.slice(split + 1).map(toDataUrl));

const started = Date.now();
const response = await fetch(`${baseUrl}/api/identify`, {
  method: "POST",
  // The route only accepts same-origin requests.
  headers: { "Content-Type": "application/json", Origin: baseUrl },
  body: JSON.stringify({ targets, products }),
});

console.log(`HTTP ${response.status} in ${Date.now() - started} ms`);
console.log(JSON.stringify(await response.json(), null, 2));