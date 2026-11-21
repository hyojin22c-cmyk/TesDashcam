import { clamp } from 'es-toolkit';

import { driveModeLabel } from './telemetry-style';

import type { TelemetryData } from './sei-decoder';

export const ROADSTER_UNIT_WIDTH = 172;
export const ROADSTER_PORTRAIT_WIDTH = 132;

const bevel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) => {
  const cut = 12 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + cut);
  ctx.lineTo(x + cut, y);
  ctx.lineTo(x + width - cut, y);
  ctx.lineTo(x + width, y + cut);
  ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height);
  ctx.lineTo(x + cut, y + height);
  ctx.lineTo(x, y + height - cut);
  ctx.closePath();
  ctx.fillStyle = '#080b09';
  ctx.fill();
  const metal = ctx.createLinearGradient(0, y, 0, y + height);
  metal.addColorStop(0, '#93948b');
  metal.addColorStop(0.12, '#4b4d46');
  metal.addColorStop(0.78, '#242822');
  metal.addColorStop(1, '#696458');
  ctx.strokeStyle = '#141512';
  ctx.lineWidth = 15 * scale;
  ctx.stroke();
  ctx.strokeStyle = metal;
  ctx.lineWidth = 9 * scale;
  ctx.stroke();
  ctx.strokeStyle = '#1b1d19';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
};

const drawFastener = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
  ctx.fillStyle = '#171815';
  ctx.beginPath();
  ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#858074';
  ctx.lineWidth = scale;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 2 * scale, y + scale);
  ctx.lineTo(x + 2 * scale, y - scale);
  ctx.stroke();
};

const drawRailPlate = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  lamp: string,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(8, 0);
  ctx.lineTo(61, 0);
  ctx.lineTo(69, 12);
  ctx.closePath();
  ctx.fillStyle = '#20211f';
  ctx.fill();
  ctx.strokeStyle = '#777366';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#10110f';
  ctx.fillRect(18, 3, 31, 6);
  ctx.fillStyle = lamp;
  for (let i = 0; i < 3; i++) ctx.fillRect(22 + 8 * i, 5, 5, 2);
  ctx.restore();
};

let artwork: HTMLImageElement | undefined;

const getArtwork = () => {
  if (!artwork && typeof Image !== 'undefined') {
    artwork = new Image();
    artwork.src = `${import.meta.env.BASE_URL}models/roadster-cockpit-prototype.webp`;
  }
  return artwork;
};

export const prepareRoadsterCockpit = async () => {
  await getArtwork()?.decode();
};

export const drawRoadsterCockpit = (
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  width: number,
  top: number,
  height: number,
  scale: number,
) => {
  const portraitWidth = ROADSTER_PORTRAIT_WIDTH * scale;
  const unitPanelX = left + 10 * scale;
  const unitPanelWidth = right - portraitWidth - unitPanelX - 7 * scale;
  ctx.save();
  const rail = ctx.createLinearGradient(0, top - 14 * scale, 0, top + 32 * scale);
  rail.addColorStop(0, '#706d60');
  rail.addColorStop(0.42, '#47463d');
  rail.addColorStop(1, '#282823');
  const unitPanelRight = unitPanelX + unitPanelWidth;
  ctx.beginPath();
  ctx.moveTo(0, top + 8 * scale);
  ctx.lineTo(18 * scale, top - 7 * scale);
  if (left > 0) {
    ctx.lineTo(left - 36 * scale, top - 7 * scale);
    ctx.lineTo(left - 19 * scale, top + 7 * scale);
  }
  ctx.lineTo(unitPanelX + 12 * scale, top + 7 * scale);
  ctx.lineTo(unitPanelX + 30 * scale, top - 13 * scale);
  ctx.lineTo(unitPanelX + unitPanelWidth * 0.35, top - 13 * scale);
  ctx.lineTo(unitPanelX + unitPanelWidth * 0.35 + 14 * scale, top - 2 * scale);
  ctx.lineTo(unitPanelRight - 30 * scale, top - 2 * scale);
  ctx.lineTo(unitPanelRight - 13 * scale, top + 10 * scale);
  ctx.lineTo(right - portraitWidth + 9 * scale, top + 10 * scale);
  ctx.lineTo(right - portraitWidth + 24 * scale, top - 9 * scale);
  ctx.lineTo(right - 17 * scale, top - 9 * scale);
  ctx.lineTo(right, top + 5 * scale);
  ctx.lineTo(width, top + 5 * scale);
  ctx.lineTo(width, top + height);
  ctx.lineTo(0, top + height);
  ctx.closePath();
  ctx.fillStyle = rail;
  ctx.fill();
  const art = getArtwork();
  if (art?.naturalWidth) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.58;
    if (left > 0) {
      ctx.drawImage(art, 16, 605, 352, 34, 0, top - 8 * scale, left, 24 * scale);
    }
    ctx.drawImage(art, 401, 604, 914, 31, unitPanelX, top - 14 * scale, unitPanelWidth, 31 * scale);
    ctx.drawImage(
      art,
      405,
      899,
      897,
      35,
      unitPanelX,
      top + height - 12 * scale,
      unitPanelWidth,
      12 * scale,
    );
    ctx.restore();
  }
  ctx.strokeStyle = '#777366';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  bevel(ctx, unitPanelX, top + 12 * scale, unitPanelWidth, height - 24 * scale, scale);
  if (left > 0) {
    bevel(ctx, 8 * scale, top + 12 * scale, left - 16 * scale, height - 24 * scale, scale);
    drawRailPlate(ctx, 32 * scale, top - 6 * scale, scale, '#e5ae51');
    drawFastener(ctx, left - 24 * scale, top + 12 * scale, scale);
  }
  drawRailPlate(ctx, unitPanelX + 58 * scale, top - 12 * scale, scale, '#de694c');
  drawRailPlate(ctx, unitPanelRight - 112 * scale, top - 1 * scale, scale, '#81b577');
  drawFastener(ctx, unitPanelX + 23 * scale, top + height - 12 * scale, scale);
  drawFastener(ctx, unitPanelRight - 23 * scale, top + height - 12 * scale, scale);

  const portraitX = right - 125 * scale;
  const portraitY = top + 24 * scale;
  bevel(ctx, portraitX, portraitY, 118 * scale, 136 * scale, scale);
  drawRailPlate(ctx, portraitX + 24 * scale, portraitY + 7 * scale, scale, '#e5ae51');
  drawFastener(ctx, portraitX + 11 * scale, portraitY + 126 * scale, scale);
  drawFastener(ctx, portraitX + 107 * scale, portraitY + 126 * scale, scale);
  if (!art?.naturalWidth) {
    ctx.restore();
    return;
  }
  ctx.drawImage(
    art,
    428,
    644,
    832,
    248,
    unitPanelX + 10 * scale,
    top + 67 * scale,
    144 * scale,
    43 * scale,
  );
  const screenX = portraitX + 5 * scale;
  const screenY = portraitY + 23 * scale;
  ctx.fillStyle = '#303a3d';
  ctx.fillRect(screenX - 2 * scale, screenY - 2 * scale, 112 * scale, 98 * scale);
  ctx.drawImage(art, 1368, 657, 257, 224, screenX, screenY, 108 * scale, 94 * scale);
  ctx.restore();
};

const DISPLAY_GREEN = '#b6ff83';
const DISPLAY_AMBER = '#ffca73';
const DISPLAY_DIM = '#314640';

const LABELS: Record<string, string> = {
  timestamp: 'REC TIME',
  speed: 'VELOCITY',
  steering: 'STEERING',
  turn_signal: 'SIGNALS',
  pedal: 'PEDALS',
  fsd: 'DRIVE MODE',
};

export const drawRoadsterTelemetry = (
  ctx: CanvasRenderingContext2D,
  columns: Record<string, [number, number]>,
  offset: number,
  top: number,
  scale: number,
  telemetry: TelemetryData,
  recordedAt: string,
  elapsed: number,
  blinkPhase: boolean,
  newDriveModeLabels?: boolean,
) => {
  const date = new Date(recordedAt.replace(' ', 'T'));
  date.setTime(date.getTime() + Math.floor(elapsed * 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = Number.isNaN(date.getTime())
    ? '00:00:00'
    : [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':');

  ctx.save();
  ctx.textBaseline = 'middle';
  for (const [key, [x, width]] of Object.entries(columns)) {
    const w = width / scale;
    ctx.save();
    ctx.translate(offset + x, top);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#485247';
    ctx.fillRect(0, 54, 1, 83);
    ctx.fillStyle = '#9da99a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(LABELS[key], w / 2, 40, w - 12);

    const display = (value: string, y: number, size: number, color = DISPLAY_GREEN) => {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px monospace`;
      ctx.fillText(value, w / 2, y, w - 16);
    };

    switch (key) {
      case 'timestamp':
        display(clock, 92, 29);
        display(recordedAt.slice(0, 10), 129, 15, '#a2b6ac');
        break;
      case 'speed': {
        display(String(Math.round(telemetry.speed_kmh)), 83, 45);
        display('KM/H', 115, 13, '#a2b6ac');
        const step = (w - 24) / 10;
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = telemetry.speed_kmh > i * 15 ? DISPLAY_GREEN : DISPLAY_DIM;
          ctx.fillRect(13.5 + step * i, 135, step - 3, 10);
        }
        break;
      }
      case 'steering': {
        const angle = Math.round(telemetry.steering_deg);
        display(`${angle > 0 ? '+' : ''}${angle}°`, 89, 25);
        ctx.fillStyle = DISPLAY_DIM;
        ctx.fillRect(12, 131, w - 24, 4);
        ctx.fillStyle = DISPLAY_GREEN;
        ctx.fillRect(w / 2 + clamp(angle / 180, -1, 1) * (w / 2 - 16) - 3, 124, 6, 17);
        break;
      }
      case 'turn_signal':
        for (const [direction, active] of [
          [-1, telemetry.left_blinker],
          [1, telemetry.right_blinker],
        ] as const) {
          ctx.save();
          ctx.translate(w / 2 + direction * 22, 103);
          ctx.scale(direction, 1);
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-4, -19);
          ctx.lineTo(-14, -19);
          ctx.lineTo(4, 0);
          ctx.lineTo(-14, 19);
          ctx.lineTo(-4, 19);
          ctx.closePath();
          ctx.fillStyle = active && blinkPhase ? DISPLAY_AMBER : DISPLAY_DIM;
          ctx.fill();
          ctx.restore();
        }
        break;
      case 'pedal': {
        const accel = clamp(Math.round(telemetry.accel_pct), 0, 100);
        const braking = telemetry.brake_applied || telemetry.brake_pct > 0;
        display(`ACC ${accel}%`, 69, 15);
        ctx.fillStyle = DISPLAY_DIM;
        ctx.fillRect(12, 81, w - 24, 6);
        ctx.fillStyle = DISPLAY_GREEN;
        ctx.fillRect(12, 81, ((w - 24) * accel) / 100, 6);
        display(`BRK ${braking ? 'ON' : 'OFF'}`, 118, 15, braking ? DISPLAY_AMBER : '#a2b6ac');
        break;
      }
      case 'fsd': {
        const mode = telemetry.ap_mode || 'MANUAL';
        const modeKey = mode === 'FSD ACTIVE' ? 'FSD' : mode;
        display(driveModeLabel(modeKey, mode, newDriveModeLabels), 96, 20);
        break;
      }
    }

    ctx.restore();
  }
  ctx.restore();
};
