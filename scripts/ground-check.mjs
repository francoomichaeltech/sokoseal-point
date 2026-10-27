// Posts a local JPEG and a normalized point (0..1) to /api/ground on a running server.
// Usage: node scripts/ground-check.mjs <image.jpg> <x> <y> [baseUrl]

import { readFile } from "node:fs/promises";

const [imagePath, x, y, baseUrl = "http://localhost:3000"] = process.argv.slice(2);

if (!imagePath || x === undefined || y === undefined) {
  console.error("Usage: node scripts/ground-check.mjs <image.jpg> <x> <y> [baseUrl]");
  process.exit(1);
}

const image = await readFile(imagePath);
const started = Date.now();

const response = await fetch(`${baseUrl}/api/ground`, {
  method: "POST",
  // The route only accepts same-origin requests.
  headers: { "Content-Type": "application/json", Origin: baseUrl },
  body: JSON.stringify({
    image: `data:image/jpeg;base64,${image.toString("base64")}`,
    x: Number(x),
    y: Number(y),
  }),
});

console.log(`HTTP ${response.status} in ${Date.now() - started} ms`);
console.log(JSON.stringify(await response.json(), null, 2));