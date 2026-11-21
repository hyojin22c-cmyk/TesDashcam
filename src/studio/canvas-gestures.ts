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

const isModernTelemetry = () => {
  const { telemetryStyle } = getStudio().options;
  return telemetryStyle === 'cards' || telemetryStyle === 'strip';
};

export const hitTestTelemetryColumn = (cx: number, cy: number): string | null => {
  const canvas = getCanvas();
  const layout = telemetryLayout();
  if (!canvas || !layout || layout.bottomH <= 0 || cy < layout.frontH) return null;
  if (isModernTelemetry()) {
    return (
      layout.boxes.find(
        ({ x, y, width, height }) => cx >= x && cx < x + width && cy >= y && cy < y + height,
      )?.key ?? null
    );
  }
  const pad = 12 * (canvas.width / 1920);
  for (const [key, [x, width]] of Object.entries(layout.colBoxMap)) {
    if (cx >= layout.offsetX + x - pad && cx <= layout.offsetX + x + width + pad) return key;
  }
  return null;
};

export const dragTelemetryColumn = (cx: number, cy: number) => {
  const dragging = getStudio().options.draggingCol;
  const layout = telemetryLayout();
  if (!dragging || !layout || layout.bottomH <= 0) return;
  if (isModernTelemetry()) {
    const target = hitTestTelemetryColumn(cx, cy);
    if (!target || target === dragging) return;
    const order = [...layout.order];
    const from = order.indexOf(dragging);
    const to = order.indexOf(target);
    if (from < 0 || to < 0) return;
    order[from] = target;
    order[to] = dragging;
    setTelemetryOrder(order);
    return;
  }
  const { order, colBoxMap, offsetX } = layout;
  const activeKeys = order.filter((key) => key in colBoxMap);
  const index = activeKeys.indexOf(dragging);
  if (index < 0) return;
  const left = activeKeys[index - 1];
  const right = activeKeys[index + 1];
  let target: string | undefined;
  if (left) {
    const [x, width] = colBoxMap[left];
    if (cx < offsetX + x + width * 0.55) target = left;
  }
  if (!target && right) {
    const [x, width] = colBoxMap[right];
    if (cx > offsetX + x + width * 0.45) target = right;
  }
  if (!target) return;
  const reordered = [...order];
  reordered[order.indexOf(dragging)] = target;
  reordered[order.indexOf(target)] = dragging;
  setTelemetryOrder(reordered);
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
  const { frontH } = OverlayRenderer.computeTelemetryLayout(options, canvas.width, canvas.height);
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
