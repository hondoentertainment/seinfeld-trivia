import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

fs.mkdirSync(publicDir, { recursive: true });

function writeSolidPng(size, fileName) {
  const png = new PNG({ width: size, height: size, colorType: 6, inputColorType: 6, bitDepth: 8 });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = 0x1f;
      png.data[idx + 1] = 0x15;
      png.data[idx + 2] = 0x28;
      png.data[idx + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(publicDir, fileName), PNG.sync.write(png));
}

writeSolidPng(192, "pwa-192.png");
writeSolidPng(512, "pwa-512.png");
console.log("Wrote public/pwa-192.png and public/pwa-512.png");
