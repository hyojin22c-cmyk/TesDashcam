import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_OPTIONS, OverlayRenderer } from '../src/core/renderer';
import { drawRoadsterTelemetry } from '../src/core/roadster-cockpit';
import { DEFAULT_TELEMETRY } from '../src/core/sei-decoder';

describe('Terran drive mode labels', () => {
  it.each([
    ['FSD ACTIVE', true, 'ASSISTED DRIVING'],
    ['FSD ACTIVE', false, 'FSD ACTIVE'],
    ['AUTOPILOT', true, 'AUTOSTEER'],
    ['AUTOPILOT', false, 'AUTOPILOT'],
  ] as const)('renders %s with new labels %s as %s', (apMode, newLabels, expected) => {
    const fillText = vi.fn();
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillText,
    } as unknown as CanvasRenderingContext2D;

    drawRoadsterTelemetry(
      context,
      { fsd: [0, 200] },
      0,
      0,
      1,
      { ...DEFAULT_TELEMETRY, ap_mode: apMode },
      '2026-10-08 17:54:55',
      0,
      false,
      newLabels,
    );

    expect(fillText).toHaveBeenLastCalledWith(expected, 100, 96, 184);
  });
});

it('aligns Terran cell boundaries with the shared telemetry panel', () => {
  const options = { ...DEFAULT_RENDER_OPTIONS, telemetryStyle: 'roadster', map: true } as const;
  const { boxes, offsetX } = OverlayRenderer.computeTelemetryLayout(options, 1280, 720);
  expect(boxes).toHaveLength(6);
  let boundary = offsetX;
  for (const { x, width } of boxes) {
    expect(x).toBe(boundary);
    boundary += width;
  }
});
