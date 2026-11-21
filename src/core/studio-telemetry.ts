import { clamp } from 'es-toolkit';

import { driveModeLabel, drawSteeringWheel, TELEMETRY_FONT } from './telemetry-style';

import type { RenderOptions } from './renderer';
import type { TelemetryData } from './sei-decoder';

const COLOR = {
  text: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.5)',
  faint: 'rgba(255, 255, 255, 0.3)',
  track: 'rgba(255, 255, 255, 0.1)',
  hover: 'rgba(255, 255, 255, 0.08)',
  primary: '#226cff',
  danger: '#ff4e4e',
};

const font = (weight: number, px: number) => `${weight} ${Math.round(px)}px ${TELEMETRY_FONT}`;

const COLUMN_CAPTIONS: Record<string, string> = {
  timestamp: 'Time',
  steering: 'Steering',
  turn_signal: 'Blinker',
  speed: 'Speed',
  pedal: 'Pedals',
};

const DRIVE_MODES = [
  { key: 'MANUAL', label: 'Manual', color: '#6e6e73' },
  { key: 'TACC', label: 'TACC', color: '#1f9d55' },
  { key: 'AUTOPILOT', label: 'Autopilot', color: '#226cff' },
  { key: 'FSD', label: 'FSD', color: '#7c4dff' },
];

const glyphWidths = new Map<string, number>();

const glyphWidth = (ctx: CanvasRenderingContext2D, ch: string) => {
  const glyph = /\d/.test(ch) ? '0' : ch;
  const key = `${ctx.font}|${glyph}`;
  let width = glyphWidths.get(key);
  if (width === undefined) {
    width = ctx.measureText(glyph).width;
    glyphWidths.set(key, width);
  }
  return width;
};

const measureTabular = (ctx: CanvasRenderingContext2D, text: string): number => {
  let width = 0;
  for (const ch of text) width += glyphWidth(ctx, ch);
  return width;
};

const fillTabular = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number => {
  ctx.save();
  ctx.textAlign = 'center';
  let cx = x;
  for (const ch of text) {
    const w = glyphWidth(ctx, ch);
    ctx.fillText(ch, cx + w / 2, y);
    cx += w;
  }
  ctx.restore();
  return cx - x;
};

const drawTurnSignals = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  leftOn: boolean,
  rightOn: boolean,
  frameIdx: number,
  fps = 36.0,
  scale = 1.0,
): void => {
  const isBlinkPhase = Math.floor((frameIdx / fps) * 3.5) % 2 === 0;
  const tip = Math.round(46 * scale);
  const head = Math.round(22 * scale);
  const stemEnd = Math.round(8 * scale);
  const headY = Math.round(16 * scale);
  const stemY = Math.round(6 * scale);

  ctx.save();
  for (const [direction, on] of [
    [-1, leftOn],
    [1, rightOn],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + direction * tip, cy);
    ctx.lineTo(cx + direction * head, cy - headY);
    ctx.lineTo(cx + direction * head, cy - stemY);
    ctx.lineTo(cx + direction * stemEnd, cy - stemY);
    ctx.lineTo(cx + direction * stemEnd, cy + stemY);
    ctx.lineTo(cx + direction * head, cy + stemY);
    ctx.lineTo(cx + direction * head, cy + headY);
    ctx.closePath();
    ctx.fillStyle = on && isBlinkPhase ? COLOR.text : COLOR.track;
    ctx.fill();
  }
  ctx.restore();
};

export const drawStudioTelemetry = (
  ctx: CanvasRenderingContext2D,
  colBoxMap: Record<string, [number, number]>,
  offsetX: number,
  hudY: number,
  bottomH: number,
  scale: number,
  telemetry: TelemetryData,
  baseDateStr: string,
  currentTimeSec: number,
  frameIdx: number,
  fps: number,
  options: RenderOptions,
) => {
  const px = (value: number) => Math.round(value * scale);
  const captionY = hudY + px(28);
  const iconCenterY = hudY + px(103);

  if (options.draggingCol && colBoxMap[options.draggingCol]) {
    const [dx, dw] = colBoxMap[options.draggingCol];
    const pad = px(10);
    ctx.fillStyle = COLOR.hover;
    ctx.beginPath();
    ctx.roundRect(offsetX + dx - pad, hudY + px(10), dw + pad * 2, bottomH - px(20), px(18));
    ctx.fill();
  }

  ctx.save();
  ctx.fillStyle = COLOR.muted;
  ctx.font = font(500, 15 * scale);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const [key, [x]] of Object.entries(colBoxMap)) {
    const caption = COLUMN_CAPTIONS[key];
    if (caption) ctx.fillText(caption, offsetX + x, captionY);
  }
  ctx.restore();

  if ('timestamp' in colBoxMap) {
    const [x] = colBoxMap.timestamp;
    const left = offsetX + x;
    let dateStr = baseDateStr;
    let timeStr = '00:00:00';
    try {
      const [datePart = '2026-10-07', timePart = '00:00:00'] = baseDateStr.split(' ');
      const [yy, mo, dd] = datePart.split('-').map(Number);
      const [hh, mi, ss] = timePart.split(':').map(Number);
      const d = new Date(yy, (mo || 1) - 1, dd || 1, hh || 0, mi || 0, ss || 0);
      d.setSeconds(d.getSeconds() + currentTimeSec);
      const pad = (value: number) => String(value).padStart(2, '0');
      dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {}

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLOR.muted;
    ctx.font = font(500, 18 * scale);
    fillTabular(ctx, dateStr, left, hudY + px(76));
    ctx.fillStyle = COLOR.text;
    ctx.font = font(600, 40 * scale);
    fillTabular(ctx, timeStr, left, hudY + px(124));

    ctx.restore();
  }

  if ('steering' in colBoxMap) {
    const [x] = colBoxMap.steering;
    drawSteeringWheel(
      ctx,
      offsetX + x + px(52),
      iconCenterY,
      telemetry.steering_deg,
      scale,
      COLOR.text,
    );
  }

  if ('turn_signal' in colBoxMap) {
    const [x] = colBoxMap.turn_signal;
    drawTurnSignals(
      ctx,
      offsetX + x + px(52),
      iconCenterY,
      telemetry.left_blinker,
      telemetry.right_blinker,
      frameIdx,
      fps,
      scale,
    );
  }

  if ('speed' in colBoxMap) {
    const [x] = colBoxMap.speed;
    const speed = Math.round(telemetry.speed_kmh);
    const barX = offsetX + x;
    const barW = px(152);
    const barH = Math.max(4, px(6));
    const barY = hudY + px(58);

    ctx.save();
    ctx.fillStyle = COLOR.track;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();
    const ratio = clamp(speed / 150, 0, 1);
    if (ratio > 0.01) {
      ctx.fillStyle = COLOR.primary;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barH, barW * ratio), barH, barH / 2);
      ctx.fill();
    }

    const number = String(speed);
    ctx.font = font(600, 52 * scale);
    const numberW = measureTabular(ctx, number);
    ctx.font = font(500, 17 * scale);
    const unitW = ctx.measureText('km/h').width;
    const gap = px(8);
    const startX = barX + Math.max(0, Math.round((barW - numberW - gap - unitW) / 2));
    const baselineY = hudY + px(132);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLOR.text;
    ctx.font = font(600, 52 * scale);
    fillTabular(ctx, number, startX, baselineY);
    ctx.fillStyle = COLOR.muted;
    ctx.font = font(500, 17 * scale);
    ctx.fillText('km/h', startX + numberW + gap, baselineY);
    ctx.restore();
  }

  if ('pedal' in colBoxMap) {
    const [x] = colBoxMap.pedal;
    const accel = clamp(Math.round(telemetry.accel_pct), 0, 100);
    const braking = telemetry.brake_applied || telemetry.brake_pct > 0;
    const barW = px(16);
    const top = hudY + px(50);
    const bottom = hudY + px(146);
    const barH = bottom - top;
    const barX = offsetX + x;
    const labelX = barX + barW + px(14);
    const brakeX = offsetX + x + px(96);

    ctx.save();
    ctx.fillStyle = COLOR.track;
    ctx.beginPath();
    ctx.roundRect(barX, top, barW, barH, barW / 2);
    ctx.fill();
    if (accel > 0) {
      const fillH = Math.max(barW, Math.round(barH * (accel / 100)));
      ctx.fillStyle = COLOR.primary;
      ctx.beginPath();
      ctx.roundRect(barX, bottom - fillH, barW, fillH, barW / 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR.muted;
    ctx.font = font(500, 14 * scale);
    ctx.fillText('Accel', labelX, top + px(10));
    ctx.fillText('Brake', brakeX, top + px(10));

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = accel > 0 ? COLOR.text : COLOR.muted;
    ctx.font = font(600, 22 * scale);
    fillTabular(ctx, `${accel}%`, labelX, bottom - px(2));

    const lampW = px(64);
    const lampH = px(28);
    const lampY = bottom - lampH;
    ctx.fillStyle = braking ? COLOR.danger : COLOR.track;
    ctx.beginPath();
    ctx.roundRect(brakeX, lampY, lampW, lampH, lampH / 2);
    ctx.fill();
    ctx.fillStyle = braking ? COLOR.text : COLOR.muted;
    ctx.font = font(600, 14 * scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(braking ? 'On' : 'Off', brakeX + lampW / 2, lampY + lampH / 2);
    ctx.restore();
  }

  if ('fsd' in colBoxMap) {
    const [x] = colBoxMap.fsd;
    const left = offsetX + x;
    const raw = telemetry.ap_mode || 'MANUAL';
    const active = raw === 'FSD ACTIVE' ? 'FSD' : raw;
    const rowH = px(30);
    const step = px(36);
    const rowW = colBoxMap.fsd[1] - px(11);
    const top = hudY + px(16);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    DRIVE_MODES.forEach(({ key, label, color }, index) => {
      const y = top + index * step;
      const on = active === key;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (on) ctx.roundRect(left, y, rowW, rowH, rowH / 2);
      else ctx.arc(left + px(14), y + rowH / 2, px(4), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? COLOR.text : COLOR.faint;
      ctx.font = font(on ? 600 : 500, 16 * scale);
      ctx.fillText(
        driveModeLabel(key, label, options.newDriveModeLabels),
        left + px(26),
        y + rowH / 2,
        rowW - px(32),
      );
    });
    ctx.restore();
  }
};
