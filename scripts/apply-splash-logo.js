/**
 * Directly generates and places splashscreen_logo.png files in Android
 * drawable directories — no full prebuild needed, just rebuild after.
 *
 * Run: node scripts/apply-splash-logo.js
 */

const Jimp = require('jimp-compact');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets/splash-logo.png');
const ANDROID_MAIN = path.join(ROOT, 'android/app/src/main/res');

// Android 12 splash icon box is ALWAYS 288dp — imageWidth must be <= 288
const IMAGE_WIDTH_DP = 230; // fits within Android 12 circular clip (radius 144dp)
const CANVAS_DP = 288;

const DENSITIES = [
  { name: 'mdpi',    multiplier: 1   },
  { name: 'hdpi',    multiplier: 1.5 },
  { name: 'xhdpi',   multiplier: 2   },
  { name: 'xxhdpi',  multiplier: 3   },
  { name: 'xxxhdpi', multiplier: 4   },
];

async function main() {
  const src = await Jimp.read(SRC);

  for (const { name, multiplier } of DENSITIES) {
    const canvasPx = Math.round(CANVAS_DP * multiplier);
    const imagePx  = Math.round(IMAGE_WIDTH_DP * multiplier);
    const offset   = Math.round((canvasPx - imagePx) / 2);

    const logo = src.clone().resize(imagePx, imagePx);
    const canvas = new Jimp(canvasPx, canvasPx, 0x000000ff);
    canvas.composite(logo, offset, offset);

    const outDir  = path.join(ANDROID_MAIN, `drawable-${name}`);
    const outFile = path.join(outDir, 'splashscreen_logo.png');

    fs.mkdirSync(outDir, { recursive: true });
    await canvas.writeAsync(outFile);
    console.log(`✓ ${name.padEnd(8)} ${canvasPx}×${canvasPx}px`);
  }

  console.log('\nDone! Now rebuild: npx expo run:android');
}

main().catch(err => { console.error(err); process.exit(1); });
