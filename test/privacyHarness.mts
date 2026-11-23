// Ad-hoc comparison of the web privacy detectors against reference boxes from the desktop app.
//   npx vite-node test/privacyHarness.mts <rawDir> <modelsDir> <ref.json> [<ref2.json> ...]
import { readFileSync } from 'node:fs';
import * as ort from 'onnxruntime-web';
import { decodeFaces, decodeVehicles, FACE_INPUT_SIZE, toPlanarFloat, VEHICLE_INPUT_SIZE } from '../src/core/privacy/detectors';
import { detectPlates } from '../src/core/privacy/plateDetector';
import { iou, Rect } from '../src/core/privacy/imageOps';

const [rawDir, modelsDir, ...refFiles] = process.argv.slice(2);
const ref: Record<string, { vehicles: number[][]; plates: number[][]; faces: number[][] }> = {};
for (const f of refFiles) Object.assign(ref, JSON.parse(readFileSync(f, 'utf8')));
const yolo = await ort.InferenceSession.create(readFileSync(`${modelsDir}/yolov8n.onnx`));
const yunet = await ort.InferenceSession.create(readFileSync(`${modelsDir}/face_detection_yunet.onnx`));
const toRect = (r: number[]): Rect => ({ x: r[0], y: r[1], w: r[2], h: r[3] });
const fmt = (r: Rect) => `[${r.x},${r.y},${r.w},${r.h}]`;
const matchCount = (got: Rect[], want: Rect[]) => want.filter((w) => got.some((g) => iou(g, w) >= 0.3)).length;

for (const line of readFileSync(`${rawDir}/index.txt`, 'utf8').trim().split('\n')) {
  const [name, ws, hs] = line.split(' ');
  const width = Number(ws), height = Number(hs);
  const full = new Uint8Array(readFileSync(`${rawDir}/${name}.full.rgba`));
  const v320 = new Uint8Array(readFileSync(`${rawDir}/${name}.v320.rgba`));
  const f640 = new Uint8Array(readFileSync(`${rawDir}/${name}.f640.rgba`));

  const yoloOut = await yolo.run({ images: new ort.Tensor('float32', toPlanarFloat(v320, VEHICLE_INPUT_SIZE, 1 / 255, false), [1, 3, 320, 320]) });
  const vehicles = decodeVehicles(yoloOut.output0.data as Float32Array, yoloOut.output0.dims[2], width, height);
  const t0 = performance.now();
  const plates = detectPlates({ data: full, width, height }, vehicles);
  const plateMs = Math.round(performance.now() - t0);
  const faceOut = await yunet.run({ input: new ort.Tensor('float32', toPlanarFloat(f640, FACE_INPUT_SIZE, 1, true), [1, 3, 640, 640]) });
  const faces = decodeFaces(faceOut as any, Math.min(FACE_INPUT_SIZE / width, FACE_INPUT_SIZE / height), width, height);

  const want = ref[`${name}.jpg`];
  console.log(`${name}: vehicles ${vehicles.length}/${want.vehicles.length} ref` +
    ` | plates ${plates.map(fmt).join(' ') || '-'} (ref ${want.plates.map((p) => `[${p}]`).join(' ') || '-'}; matched ${matchCount(plates, want.plates.map(toRect))}/${want.plates.length}; ${plateMs}ms)` +
    ` | faces ${faces.length} (ref ${want.faces.length}; matched ${matchCount(faces, want.faces.map(toRect))}/${want.faces.length})`);
}
