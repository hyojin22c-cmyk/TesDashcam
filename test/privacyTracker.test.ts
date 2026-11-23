import { describe, expect, it } from 'vitest';
import { BoxTracker, matchTemplate } from '../src/core/privacy/boxTracker';
import { GrayImage } from '../src/core/privacy/imageOps';

// Deterministic textured image so a patch has one clear best match.
function texture(width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  let seed = 12345;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = seed % 256;
  }
  return { data, width, height };
}

function cut(image: GrayImage, x: number, y: number, w: number, h: number): GrayImage {
  const data = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) data.set(image.data.subarray((y + r) * image.width + x, (y + r) * image.width + x + w), r * w);
  return { data, width: w, height: h };
}

/** Pastes a smooth, plate-sized pattern so the box-averaged copy keeps its structure. */
function paste(image: GrayImage, x: number, y: number, w: number, h: number): void {
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      image.data[(y + r) * image.width + x + c] = 128 + Math.round(100 * Math.sin(c / 9) * Math.cos(r / 7));
    }
  }
}

describe('matchTemplate', () => {
  it('finds a small patch at its exact position', () => {
    const image = texture(120, 90);
    const hit = matchTemplate(image, cut(image, 47, 31, 16, 10), 20, 10, 100, 70);
    expect(hit).toMatchObject({ x: 47, y: 31 });
    expect(hit!.score).toBeGreaterThan(0.99);
  });

  it('finds a large patch at full-resolution accuracy', () => {
    const image: GrayImage = { data: new Uint8Array(400 * 300).fill(90), width: 400, height: 300 };
    paste(image, 150, 100, 120, 96);
    const template = cut(image, 150, 100, 120, 96);
    const moved: GrayImage = { data: new Uint8Array(400 * 300).fill(90), width: 400, height: 300 };
    paste(moved, 170, 110, 120, 96);
    const hit = matchTemplate(moved, template, 100, 60, 340, 250);
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.x - 170)).toBeLessThanOrEqual(1);
    expect(Math.abs(hit!.y - 110)).toBeLessThanOrEqual(1);
    expect(hit!.score).toBeGreaterThan(0.95);
  });

  it('returns null when the search window is smaller than the template', () => {
    const image = texture(60, 40);
    expect(matchTemplate(image, cut(image, 0, 0, 30, 20), 0, 0, 20, 10)).toBeNull();
  });
});

describe('BoxTracker', () => {
  it('reports a detection immediately and follows it between detections', () => {
    const tracker = new BoxTracker(1, 48);
    const first: GrayImage = { data: new Uint8Array(400 * 300).fill(90), width: 400, height: 300 };
    paste(first, 100, 120, 60, 20);
    expect(tracker.update([{ x: 100, y: 120, w: 60, h: 20 }], first)).toEqual([{ x: 100, y: 120, w: 60, h: 20 }]);

    const second: GrayImage = { data: new Uint8Array(400 * 300).fill(90), width: 400, height: 300 };
    paste(second, 112, 124, 60, 20);
    const [followed] = tracker.trackInterframe(second);
    expect(Math.abs(followed.x - 112)).toBeLessThanOrEqual(1);
    expect(Math.abs(followed.y - 124)).toBeLessThanOrEqual(1);
  });

  it('keeps covering a box for a while after detections stop, then drops it', () => {
    const tracker = new BoxTracker(1, 5);
    tracker.update([{ x: 10, y: 10, w: 40, h: 12 }], null);
    tracker.update([{ x: 10, y: 10, w: 40, h: 12 }], null);
    let frames = 0;
    while (tracker.update([], null).length > 0 && frames < 50) frames++;
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThan(6);
  });

  it('forgets everything on reset', () => {
    const tracker = new BoxTracker(1, 48);
    tracker.update([{ x: 10, y: 10, w: 40, h: 12 }], null);
    tracker.reset();
    expect(tracker.trackInterframe(null)).toEqual([]);
  });
});
