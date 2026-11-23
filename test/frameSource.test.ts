import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findStartSample, parseVideoTrack, VideoSample } from '../src/core/frameSource';

function moovPayload(path: string): { moov: Uint8Array; fileSize: number } {
  const file = new Uint8Array(readFileSync(path));
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  for (let p = 0; p + 8 <= file.length;) {
    const size = view.getUint32(p);
    const type = String.fromCharCode(...file.subarray(p + 4, p + 8));
    if (type === 'moov') return { moov: file.subarray(p + 8, p + size), fileSize: file.length };
    p += size;
  }
  throw new Error('fixture has no moov box');
}

describe('parseVideoTrack', () => {
  for (const [name, fps] of [['timing-24fps.mp4', 24], ['timing-30fps.mp4', 30]] as const) {
    it(`reads the sample table of ${name}`, () => {
      const { moov, fileSize } = moovPayload(`test/fixtures/${name}`);
      const track = parseVideoTrack(moov);

      expect(track.codec).toMatch(/^avc1\.[0-9a-f]{6}$/);
      expect(track.codedWidth).toBe(64);
      expect(track.codedHeight).toBe(64);
      expect(track.description[0]).toBe(1); // avcC configurationVersion
      expect(track.samples).toHaveLength(fps);
      expect(track.samples[0].isKey).toBe(true);
      expect(track.durationSec).toBeCloseTo(1, 2);

      let previousEnd = 0;
      track.samples.forEach((sample, i) => {
        expect(sample.size).toBeGreaterThan(0);
        expect(sample.offset).toBeGreaterThanOrEqual(previousEnd);
        expect(sample.offset + sample.size).toBeLessThanOrEqual(fileSize);
        expect(sample.ptsMicros).toBeCloseTo((i * 1_000_000) / fps, -2);
        previousEnd = sample.offset + sample.size;
      });
    });
  }

  it('rejects data without a video track', () => {
    expect(() => parseVideoTrack(new Uint8Array(16))).toThrow();
  });
});

describe('findStartSample', () => {
  const samples: VideoSample[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    offset: i * 10, size: 10, ptsMicros: i * 100_000, isKey: i === 0 || i === 3,
  }));

  it('starts at the last key frame at or before the requested time', () => {
    expect(findStartSample(samples, 0)).toBe(0);
    expect(findStartSample(samples, 250_000)).toBe(0);
    expect(findStartSample(samples, 300_000)).toBe(3);
    expect(findStartSample(samples, 900_000)).toBe(3);
  });

  it('starts at the first sample for times before the track begins', () => {
    expect(findStartSample(samples, -50_000)).toBe(0);
  });
});
