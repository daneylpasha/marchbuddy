/**
 * Generates a tight-cropped splash logo from icon.png
 * so MARCH BUDDY text fills most of the Android splash icon area.
 *
 * Run: node scripts/generate-splash-logo.js
 */

const Jimp = require('jimp-compact');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const img = await Jimp.read(path.join(ROOT, 'assets/icon.png'));
  const W = img.bitmap.width;  // 1024
  const H = img.bitmap.height; // 1024

  // MARCH BUDDY text sits roughly in the center of icon.png.
  // Crop tightly around the text with minimal padding so the logo
  // fills as much of the Android 12 splash icon area (288dp) as possible.
  //
  // Estimated text bounds in 1024x1024:
  //   left ~21%, right ~80%, top ~28%, bottom ~69%
  const PAD = 0.05; // 5% padding on each side
  const x = Math.floor(W * (0.21 - PAD));          // ~164
  const y = Math.floor(H * (0.28 - PAD));          // ~236
  const w = Math.floor(W * (0.80 - 0.21 + PAD * 2)); // ~676
  const h = Math.floor(H * (0.69 - 0.28 + PAD * 2)); // ~522

  // Make it square (Android 12 splash icon is square)
  const size = Math.max(w, h);
  const cx = Math.floor(W * 0.505); // horizontal center of text
  const cy = Math.floor(H * 0.49);  // vertical center of text
  const cropX = Math.max(0, cx - Math.floor(size / 2));
  const cropY = Math.max(0, cy - Math.floor(size / 2));
  const cropSize = Math.min(size, W - cropX, H - cropY);

  img.crop(cropX, cropY, cropSize, cropSize);

  const outPath = path.join(ROOT, 'assets/splash-logo.png');
  img.write(outPath, (err) => {
    if (err) { console.error('Error:', err); process.exit(1); }
    console.log(`✓ splash-logo.png generated: ${cropSize}×${cropSize}px`);
    console.log(`  (cropped from x=${cropX}, y=${cropY})`);
    console.log(`  Text fills ~${Math.round(676/cropSize*100)}% of canvas`);
    console.log('\nNext: npx expo prebuild --clean && rebuild');
  });
}

main().catch(console.error);
