import { i18n } from '@/i18n';

import { DEFAULT_TELEMETRY } from './sei-decoder';

import type { RenderOptions } from './renderer';
import type { TelemetryData } from './sei-decoder';

export const TELEMETRY_STYLES = ['classic', 'studio', 'cards', 'strip'] as const;
export type TelemetryStyle = (typeof TELEMETRY_STYLES)[number];

export const TELEMETRY_KEYS = [
  'timestamp',
  'steering',
  'turn_signal',
  'speed',
  'pedal',
  'fsd',
] as const;

export const driveModeLabel = (key: string, label: string, useNewLabels?: boolean) => {
  if (!useNewLabels) return label;
  if (key === 'AUTOPILOT') return 'AUTOSTEER';
  if (key === 'FSD') return 'ASSISTED DRIVING';
  return label;
};

export const TELEMETRY_FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export const MODERN_HUD_BACKGROUND = '#191b1e';
export const DEFAULT_CARD_ACCENT = '#91b6ff';
export const TELEMETRY_CARDS = ['drive', 'controls', 'mode'] as const;
type Card = (typeof TELEMETRY_CARDS)[number];

const CARD_FIELDS: Record<Card, readonly string[]> = {
  drive: ['speed', 'timestamp'],
  controls: ['steering', 'turn_signal', 'pedal'],
  mode: ['fsd'],
};
const WEIGHTS: Record<string, number> = {
  timestamp: 230,
  speed: 230,
  steering: 180,
  turn_signal: 150,
  pedal: 250,
  fsd: 260,
  drive: 30,
  controls: 40,
  mode: 30,
};

export const getCardOrder = (options: RenderOptions) => {
  const inherited = options.telemetryOrder?.flatMap((field) =>
    TELEMETRY_CARDS.filter((card) => CARD_FIELDS[card].includes(field)),
  );
  return [...new Set([...(options.telemetryCardOrder ?? inherited ?? []), ...TELEMETRY_CARDS])];
};

type TelemetryBox = { key: string; x: number; y: number; width: number; height: number };

export const computeModernTelemetryBoxes = (
  keys: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  options: RenderOptions,
  cardOrder: Card[],
): TelemetryBox[] => {
  const cards = options.telemetryStyle === 'cards';
  const visible = cards
    ? cardOrder.filter((card) => CARD_FIELDS[card].some((field) => keys.includes(field)))
    : keys;
  const inset = 12 * scale;
  const gap = cards ? 10 * scale : 0;
  const available = width - inset * 2 - gap * (visible.length - 1);
  const totalWeight = visible.reduce((sum, key) => sum + WEIGHTS[key], 0);
  x += inset;
  return visible.map((key) => {
    const boxWidth = (available * WEIGHTS[key]) / totalWeight;
    const box = { key, x, y: y + inset, width: boxWidth, height: height - inset * 2 };
    x += boxWidth + gap;
    return box;
  });
};

const timestampParts = (base: string, seconds: number) => {
  const date = new Date(base.replace(' ', 'T'));
  if (!Number.isFinite(date.getTime())) return ['—', '—'];
  date.setSeconds(date.getSeconds() + seconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ];
};

export const drawModernTelemetry = (
  ctx: CanvasRenderingContext2D,
  boxes: TelemetryBox[],
  telemetry: TelemetryData,
  baseDate: string,
  seconds: number,
  options: RenderOptions,
  scale: number,
  drawWheel: (x: number, y: number, angle: number, size: number) => void,
  drawSignals: (x: number, y: number, scale: number, separation?: number) => void,
) => {
  const cards = options.telemetryStyle === 'cards';
  const present = telemetry !== DEFAULT_TELEMETRY;
  const speed =
    present && Number.isFinite(telemetry.speed_kmh) ? String(Math.round(telemetry.speed_kmh)) : '—';
  const hasAngle = present && Number.isFinite(telemetry.steering_deg);
  const [date, time] = timestampParts(baseDate, seconds);
  const mode = telemetry.ap_mode === 'FSD ACTIVE' ? 'FSD' : telemetry.ap_mode;
  const hasBrake =
    present &&
    (typeof telemetry.brake_applied === 'boolean' || Number.isFinite(telemetry.brake_pct));
  const braking = hasBrake && (telemetry.brake_applied || telemetry.brake_pct > 0);
  const accel =
    present && Number.isFinite(telemetry.accel_pct) ? Math.round(telemetry.accel_pct) : null;
  const fg = '#f0f1ee';
  const muted = '#b6babd';
  const accent = cards ? (options.cardAccent ?? DEFAULT_CARD_ACCENT) : fg;

  const setFont = (size: number, bold = false) => {
    ctx.font = `${bold ? 700 : 500} ${size}px ${TELEMETRY_FONT}`;
  };

  const text = (
    value: string,
    center: number,
    y: number,
    width: number,
    size: number,
    color = fg,
    bold = false,
  ) => {
    setFont(size * scale, bold);
    const measured = ctx.measureText(value).width;
    if (measured > width) setFont((size * scale * width) / measured, bold);
    ctx.fillStyle = color;
    ctx.fillText(value, center, y);
  };

  const speedValue = (center: number, y: number, width: number, size: number) => {
    setFont(20 * scale);
    const unit = 'km/h';
    const unitWidth = ctx.measureText(unit).width;
    setFont(size * scale, true);
    const gap = 6 * scale;
    const numberSize = Math.min(
      size * scale,
      (size * scale * (width - unitWidth - gap)) / ctx.measureText(speed).width,
    );
    setFont(numberSize, true);
    const numberWidth = ctx.measureText(speed).width;
    const left = center - (numberWidth + gap + unitWidth) / 2;
    ctx.fillStyle = accent;
    ctx.fillText(speed, left + numberWidth / 2, y);
    ctx.font = `500 ${20 * scale}px ${TELEMETRY_FONT}`;
    ctx.fillStyle = muted;
    ctx.fillText(unit, left + numberWidth + gap + unitWidth / 2, y + 7 * scale);
  };

  const timeValue = (center: number, y: number, width: number, compact = false) => {
    text(date, center, y - (compact ? 23 : 30) * scale, width, 17, muted);
    text(time, center, y, width, compact ? 27 : 34, fg, true);
  };

  const steering = (center: number, y: number, width: number, indicators: boolean) => {
    const size = Math.min(43 * scale, width * (indicators ? 0.23 : 0.4));
    if (indicators) {
      const separation = options.steering ? size / 2 + 9 * scale : 0;
      drawSignals(center, y, Math.min(scale, (width / 2 - separation) / 50), separation);
    }
    if (!options.steering) return;
    if (hasAngle) drawWheel(center, y, telemetry.steering_deg, size);
    text(
      hasAngle ? `${Math.round(telemetry.steering_deg)}°` : '—',
      center,
      y + 33 * scale,
      width,
      19,
    );
  };

  const pedals = (center: number, y: number, width: number) => {
    const half = width / 2;
    const accelX = center - width / 4;
    const brakeX = center + width / 4;
    text(i18n.t('hud_accel'), accelX, y - 18 * scale, half, 17, muted);
    text(i18n.t('hud_brake'), brakeX, y - 18 * scale, half, 17, muted);
    text(accel === null ? '—' : `${accel}%`, accelX, y + 4 * scale, half, 23, fg, true);
    text(
      hasBrake ? (braking ? 'ON' : 'OFF') : '—',
      brakeX,
      y + 4 * scale,
      half,
      23,
      braking ? '#ff7770' : fg,
      true,
    );
    if (cards && accel !== null) {
      const trackWidth = half * 0.65;
      ctx.fillStyle = '#494d51';
      ctx.fillRect(accelX - trackWidth / 2, y + 23 * scale, trackWidth, 4 * scale);
      ctx.fillStyle = accent;
      ctx.fillRect(
        accelX - trackWidth / 2,
        y + 23 * scale,
        (trackWidth * Math.max(0, Math.min(accel, 100))) / 100,
        4 * scale,
      );
    }
  };

  const driveMode = (center: number, y: number, width: number) => {
    text(i18n.t('hud_drive_mode'), center, y - 30 * scale, width, 18, muted);
    text(
      present && mode ? driveModeLabel(mode, mode, options.newDriveModeLabels) : '—',
      center,
      y,
      width,
      26,
      fg,
      true,
    );
  };

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  boxes.forEach(({ key, x, y, width, height }, index) => {
    const center = x + width / 2;
    const middle = y + height / 2;
    const valueY = middle + 8 * scale;
    const usable = width - 20 * scale;
    if (cards || options.draggingCol === key) {
      ctx.fillStyle = cards ? '#25282b' : '#33373b';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 10 * scale);
      ctx.fill();
      if (options.draggingCol === key) {
        ctx.strokeStyle = muted;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
      }
    } else if (index > 0) {
      ctx.fillStyle = '#42464a';
      ctx.fillRect(x, y + 25 * scale, Math.max(1, scale), height - 50 * scale);
    }

    switch (key) {
      case 'drive': {
        const both = options.speed && options.timestamp;
        if (options.speed) speedValue(center, both ? middle - 27 * scale : middle, usable, 56);
        if (options.timestamp) timeValue(center, both ? middle + 46 * scale : valueY, usable, both);
        break;
      }
      case 'controls': {
        const hasIcons = options.steering || options.turn_signal;
        if (hasIcons)
          steering(
            center,
            options.pedal ? middle - 38 * scale : middle - (options.steering ? 13 : 0) * scale,
            usable,
            options.turn_signal,
          );
        if (options.pedal) pedals(center, hasIcons ? middle + 43 * scale : valueY, usable);
        break;
      }
      case 'speed':
        speedValue(center, valueY, usable, 51);
        break;
      case 'timestamp':
        timeValue(center, valueY, usable);
        break;
      case 'steering':
        steering(center, valueY - 16 * scale, usable, false);
        break;
      case 'turn_signal':
        drawSignals(center, valueY, Math.min(scale, usable / 100));
        break;
      case 'pedal':
        pedals(center, valueY, usable);
        break;
      case 'mode':
      case 'fsd':
        driveMode(center, valueY, usable);
        break;
    }
  });
  ctx.restore();
};
