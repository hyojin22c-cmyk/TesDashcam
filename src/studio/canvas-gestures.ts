import { clamp } from 'es-toolkit';

import { OverlayRenderer } from '@/core/renderer';

import { getCanvas, renderFrame, restorePreviousLayout, showSingleCamera } from './playback';
import { getStudio, setOption, setTelemetryOrder } from './store';

import type { CameraKey } from '@/core/constants';

export const toCanvasPoint = (clientX: number, clientY: number) => {
  const canvas = getCanvas();
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const canvasRatio = canvas.width / canvas.height;
  const elementRatio = rect.width / rect.height;
  let contentW = rect.width;
  let contentH = rect.height;
  let offsetX = 0;
  let offsetY = 0;
  if (elementRatio > canvasRatio + 1e-4) {
    contentW = rect.height * canvasRatio;
    offsetX = (rect.width - contentW) / 2;
  } else if (elementRatio < canvasRatio - 1e-4) {
    contentH = rect.width / canvasRatio;
    offsetY = (rect.height - contentH) / 2;
  }
  const x = clientX - rect.left - offsetX;
  const y = clientY - rect.top - offsetY;
  if (x < 0 || x > contentW || y < 0 || y > contentH) return null;
  return { cx: (x / contentW) * canvas.width, cy: (y / contentH) * canvas.height };
};

const telemetryLayout = () => {
  const canvas = getCanvas();
  return canvas
    ? OverlayRenderer.computeTelemetryLayout(getStudio().options, canvas.width, canvas.height)
    : null;
};

export const hitTestTelemetryColumn = (cx: number, cy: number): string | null => {
  const canvas = getCanvas();
  const layout = telemetryLayout();
  if (!canvas || !layout || layout.bottomH <= 0 || cy < layout.frontH) return null;
  const modern =
    getStudio().options.telemetryStyle === 'cards' ||
    getStudio().options.telemetryStyle === 'strip';
  const pad = modern ? 0 : 12 * (canvas.width / 1920);
  return (
    layout.boxes.find(
      ({ x, y, width, height }) =>
        cx >= x - pad && cx < x + width + pad && cy >= y && cy < y + height,
    )?.key ?? null
  );
};

export const dragTelemetryColumn = (cx: number, cy: number) => {
  const dragging = getStudio().options.draggingCol;
  const layout = telemetryLayout();
  if (!dragging || !layout) return;
  const target = hitTestTelemetryColumn(cx, cy);
  if (!target || target === dragging) return;
  const order = [...layout.order];
  const a = order.indexOf(dragging);
  const b = order.indexOf(target);
  if (a < 0 || b < 0) return;
  order[a] = target;
  order[b] = dragging;
  setTelemetryOrder(order);
};

export const setDraggingColumn = (key: string | null) => setOption('draggingCol', key);

const cameraAt = (cx: number, cy: number, frontH: number, scale: number): CameraKey => {
  const canvas = getCanvas();
  const width = canvas?.width ?? 1920;
  const { options } = getStudio();
  const quad = options.layout === 'quad';
  if (options.pillar_pip) {
    const pw = Math.round((quad ? 236 : 320) * scale);
    const ph = Math.round((quad ? 132 : 180) * scale);
    const margin = Math.round(8 * scale);
    const top = frontH - ph - margin;
    const frontW = quad ? width : width - Math.round(480 * scale);
    if (cy >= top && cy <= top + ph) {
      if (cx >= margin && cx <= margin + pw) return 'left_pillar';
      if (cx >= frontW - pw - margin && cx <= frontW - margin) return 'right_pillar';
    }
  }
  if (quad) {
    const top = cy < frontH / 2;
    if (cx < width / 2) return top ? 'front' : 'back';
    return top ? 'left_repeater' : 'right_repeater';
  }
  if (cx < width - Math.round(480 * scale)) return 'front';
  const slot = clamp(Math.floor(cy / (frontH / 3)), 0, 2);
  return (['back', 'left_repeater', 'right_repeater'] as const)[slot] ?? 'back';
};

export const zoomCameraAt = (clientX: number, clientY: number) => {
  const canvas = getCanvas();
  const point = toCanvasPoint(clientX, clientY);
  if (!canvas || !point) return;
  const scale = canvas.width / 1920;
  const { options, activeClip } = getStudio();
  const hasBottomHud =
    options.map ||
    options.timestamp ||
    options.speed ||
    options.fsd ||
    options.turn_signal ||
    options.steering ||
    options.pedal;
  const frontH = canvas.height - (hasBottomHud ? Math.round(180 * scale) : 0);
  if (point.cy >= frontH) {
    setTelemetryOrder(null);
    return;
  }
  if (options.layout === 'single') {
    restorePreviousLayout();
    return;
  }
  const camera = cameraAt(point.cx, point.cy, frontH, scale);
  if (activeClip && !activeClip.cams[camera]) return;
  showSingleCamera(camera);
  renderFrame();
};
