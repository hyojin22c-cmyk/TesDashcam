import { describe, expect, it } from 'vitest';
import {
  adaptiveThresholdInv, closeRect, connectedComponents, cropGray, cropHsv, inRangeHsv, iou,
  nonMaxSuppression, otsuThreshold, percentile, RgbaImage,
} from '../src/core/privacy/imageOps';
import { detectPlates, verifyDigitSequence } from '../src/core/privacy/plateDetector';
import { decodeVehicles } from '../src/core/privacy/detectors';

function solid(width: number, height: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  return { data, width, height };
}

function fill(image: RgbaImage, x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) image.data.set([rgb[0], rgb[1], rgb[2], 255], (r * image.width + c) * 4);
  }
}

/** A dark car body with a white plate carrying seven hollow, digit-like glyphs. */
function carWithPlate(): { frame: RgbaImage; vehicle: { x: number; y: number; w: number; h: number }; plate: { x: number; y: number; w: number; h: number } } {
  const frame = solid(640, 480, [110, 112, 115]);
  const vehicle = { x: 170, y: 140, w: 300, h: 240 };
  fill(frame, vehicle.x, vehicle.y, vehicle.w, vehicle.h, [58, 60, 62]);
  const plate = { x: 281, y: 300, w: 78, h: 22 };
  fill(frame, plate.x, plate.y, plate.w, plate.h, [236, 236, 232]);
  for (let i = 0; i < 7; i++) {
    const gx = plate.x + 5 + i * 10, gy = plate.y + 5;
    fill(frame, gx, gy, 6, 12, [28, 28, 30]);
    fill(frame, gx + 2, gy + 2, 2, 8, [236, 236, 232]);
  }
  return { frame, vehicle, plate };
}

describe('image primitives', () => {
  it('converts colours the way the plate thresholds expect', () => {
    const image = solid(2, 1, [255, 0, 0]);
    image.data.set([0, 0, 255, 255], 4);
    const hsv = cropHsv(image, { x: 0, y: 0, w: 2, h: 1 });
    expect([hsv.h[0], hsv.s[0], hsv.v[0]]).toEqual([0, 255, 255]);
    expect([hsv.h[1], hsv.s[1], hsv.v[1]]).toEqual([120, 255, 255]);
    expect(Array.from(inRangeHsv(hsv, [85, 20, 70], [130, 255, 255]))).toEqual([0, 1]);
    expect(Array.from(cropGray(image, { x: 0, y: 0, w: 2, h: 1 }).data)).toEqual([76, 29]);
  });

  it('separates two brightness groups with Otsu', () => {
    const values = new Uint8Array([10, 12, 11, 13, 200, 205, 198, 202]);
    const t = otsuThreshold(values);
    expect(t).toBeGreaterThanOrEqual(13);
    expect(t).toBeLessThan(198);
  });

  it('interpolates percentiles like numpy', () => {
    expect(percentile(new Uint8Array([10, 20, 30, 40]), 50)).toBe(25);
    expect(percentile(new Uint8Array([10, 20, 30, 40]), 100)).toBe(40);
  });

  it('joins nearby blobs when closing and reports component boxes', () => {
    // Kept away from the image border, where closing (as in OpenCV) extends a blob to the edge.
    const w = 30, h = 5;
    const mask = new Uint8Array(w * h);
    for (const x of [6, 7, 10, 11, 22]) mask[2 * w + x] = 1;
    expect(connectedComponents(mask, w, h)).toHaveLength(3);
    const closed = connectedComponents(closeRect(mask, w, h, 5, 1), w, h);
    expect(closed).toHaveLength(2);
    expect(closed[0]).toMatchObject({ x: 6, y: 2, w: 6, h: 1 });
  });

  it('marks pixels darker than their surroundings', () => {
    const gray = { data: new Uint8Array(21 * 21).fill(200), width: 21, height: 21 };
    gray.data[10 * 21 + 10] = 40;
    const out = adaptiveThresholdInv(gray, 9, 6);
    expect(out[10 * 21 + 10]).toBe(1);
    expect(out[0]).toBe(0);
  });

  it('suppresses overlapping boxes and keeps the best', () => {
    const boxes = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 1, y: 1, w: 10, h: 10 }, { x: 40, y: 40, w: 10, h: 10 }];
    expect(nonMaxSuppression(boxes, [0.6, 0.9, 0.7], 0.5, 0.3)).toEqual([1, 2]);
  });
});

describe('plate detection', () => {
  it('finds the plate inside a vehicle box', () => {
    const { frame, vehicle, plate } = carWithPlate();
    const found = detectPlates(frame, [vehicle]);
    expect(found).toHaveLength(1);
    expect(iou(found[0], plate)).toBeGreaterThan(0.6);
    // The whole plate must be inside the region that gets covered.
    expect(found[0].x).toBeLessThanOrEqual(plate.x);
    expect(found[0].x + found[0].w).toBeGreaterThanOrEqual(plate.x + plate.w);
  });

  it('does not invent a plate on a vehicle that shows none', () => {
    const { frame, vehicle, plate } = carWithPlate();
    fill(frame, plate.x, plate.y, plate.w, plate.h, [58, 60, 62]);
    expect(detectPlates(frame, [vehicle])).toEqual([]);
  });

  it('rejects a blank bright rectangle as a digit row', () => {
    const { frame, plate } = carWithPlate();
    fill(frame, plate.x, plate.y, plate.w, plate.h, [236, 236, 232]);
    expect(verifyDigitSequence(cropGray(frame, plate))).toBe(false);
  });
});

describe('vehicle decoding', () => {
  it('keeps confident vehicle classes and scales boxes to the frame', () => {
    const anchors = 3, channels = 84;
    const out = new Float32Array(channels * anchors);
    const set = (anchor: number, cx: number, cy: number, w: number, h: number, cls: number, score: number) => {
      out[anchor] = cx; out[anchors + anchor] = cy; out[2 * anchors + anchor] = w; out[3 * anchors + anchor] = h;
      out[(4 + cls) * anchors + anchor] = score;
    };
    set(0, 160, 160, 80, 60, 2, 0.9);   // car
    set(1, 160, 160, 80, 60, 0, 0.95);  // person: ignored
    set(2, 60, 60, 40, 40, 7, 0.1);     // truck below the score threshold
    expect(decodeVehicles(out, anchors, 1280, 960)).toEqual([{ x: 480, y: 390, w: 320, h: 180 }]);
  });
});
