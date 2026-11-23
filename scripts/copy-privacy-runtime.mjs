// Copies the ONNX Runtime Web WebAssembly files next to the app so the privacy mosaic can load
// them from this origin. The copies are build output (public/ort is git-ignored).
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join('node_modules', 'onnxruntime-web', 'dist');
const outDir = join('public', 'ort');
mkdirSync(outDir, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  copyFileSync(join(distDir, file), join(outDir, file));
}
