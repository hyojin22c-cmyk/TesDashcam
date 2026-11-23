// Post-processing for the two bundled detection models. The functions take already-resized
// RGBA pixels so they run the same way in the browser (canvas resize) and in tests.
import { nonMaxSuppression, Rect } from './imageOps';

export const VEHICLE_INPUT_SIZE = 320;
export const FACE_INPUT_SIZE = 640;

// COCO classes that carry a licence plate: car, motorcycle, bus, truck.
const VEHICLE_CLASSES = [2, 3, 5, 7];
const VEHICLE_SCORE = 0.28;
const FACE_SCORE = 0.45;

/** RGBA pixels -> planar RGB floats. `scale` is 1/255 for YOLO and 1 for YuNet (which expects BGR). */
export function toPlanarFloat(rgba: Uint8ClampedArray | Uint8Array, size: number, scale: number, bgr: boolean): Float32Array {
  const plane = size * size;
  const out = new Float32Array(plane * 3);
  const first = bgr ? 2 : 0, last = bgr ? 0 : 2;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = rgba[p + first] * scale;
    out[plane + i] = rgba[p + 1] * scale;
    out[plane * 2 + i] = rgba[p + last] * scale;
  }
  return out;
}

/**
 * Decodes YOLOv8 output (1 x 84 x N, channel-major) for a frame that was stretched to
 * 320 x 320. Returns vehicle boxes in frame pixels.
 */
export function decodeVehicles(output: Float32Array, anchors: number, frameWidth: number, frameHeight: number): Rect[] {
  const sx = frameWidth / VEHICLE_INPUT_SIZE;
  const sy = frameHeight / VEHICLE_INPUT_SIZE;
  const classCount = output.length / anchors - 4;
  const boxes: Rect[] = [];
  const scores: number[] = [];
  for (let i = 0; i < anchors; i++) {
    let bestClass = 0, bestScore = -Infinity;
    for (let c = 0; c < classCount; c++) {
      const score = output[(4 + c) * anchors + i];
      if (score > bestScore) { bestScore = score; bestClass = c; }
    }
    if (bestScore < VEHICLE_SCORE || !VEHICLE_CLASSES.includes(bestClass)) continue;
    const cx = output[i], cy = output[anchors + i], w = output[2 * anchors + i], h = output[3 * anchors + i];
    const box = {
      x: Math.trunc((cx - w / 2) * sx), y: Math.trunc((cy - h / 2) * sy),
      w: Math.trunc(w * sx), h: Math.trunc(h * sy),
    };
    if (box.w >= 25 && box.h >= 20 && box.w < frameWidth * 0.90) {
      boxes.push(box);
      scores.push(bestScore);
    }
  }
  return nonMaxSuppression(boxes, scores, VEHICLE_SCORE, 0.45).map((i) => boxes[i]);
}

export type FaceOutputs = Record<string, { data: Float32Array }>;

/**
 * Decodes YuNet outputs for a frame that was scaled by `frameScale` into the top-left of a
 * 640 x 640 input. Returns face boxes in frame pixels, padded by 15% like the desktop filter.
 */
export function decodeFaces(outputs: FaceOutputs, frameScale: number, frameWidth: number, frameHeight: number): Rect[] {
  const boxes: Rect[] = [];
  const scores: number[] = [];
  for (const stride of [8, 16, 32]) {
    const cols = FACE_INPUT_SIZE / stride;
    const cls = outputs[`cls_${stride}`].data;
    const obj = outputs[`obj_${stride}`].data;
    const bbox = outputs[`bbox_${stride}`].data;
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(Math.min(1, Math.max(0, cls[i])) * Math.min(1, Math.max(0, obj[i])));
      if (score < FACE_SCORE) continue;
      const row = Math.floor(i / cols), col = i - row * cols;
      const cx = (col + bbox[i * 4]) * stride;
      const cy = (row + bbox[i * 4 + 1]) * stride;
      const w = Math.exp(bbox[i * 4 + 2]) * stride;
      const h = Math.exp(bbox[i * 4 + 3]) * stride;
      boxes.push({ x: cx - w / 2, y: cy - h / 2, w, h });
      scores.push(score);
    }
  }
  return nonMaxSuppression(boxes, scores, FACE_SCORE, 0.3).map((i) => {
    const b = boxes[i];
    const padX = b.w * 0.15, padY = b.h * 0.15;
    const x = Math.max(0, Math.trunc((b.x - padX) / frameScale));
    const y = Math.max(0, Math.trunc((b.y - padY) / frameScale));
    return {
      x, y,
      w: Math.min(frameWidth - x, Math.trunc((b.w + padX * 2) / frameScale)),
      h: Math.min(frameHeight - y, Math.trunc((b.h + padY * 2) / frameScale)),
    };
  }).filter((b) => b.w > 0 && b.h > 0);
}
