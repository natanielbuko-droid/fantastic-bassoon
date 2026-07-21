/**
 * Generator i logika przeszkód, iskier oraz power-upów.
 *
 * Gwarancja przechodniości: nowa szczelina jest losowana tylko w pionowym
 * oknie osiągalnym z poprzedniej szczeliny przy aktualnej prędkości
 * przewijania i fizyce gracza (grawitacja + prędkość graniczna), z zapasem
 * bezpieczeństwa 50% i uwzględnieniem amplitudy ruchomych przeszkód.
 */

import type { RNG } from "./rng";
import { GRAVITY, TERMINAL_VY } from "./player";

export const COLUMN_WIDTH = 72;
export const SPIKE_HEIGHT = 14;
/** Hitbox kolców jest płytszy niż grafika — gra wybacza otarcia. */
const SPIKE_HITBOX = 7;

export interface Obstacle {
  x: number;
  width: number;
  gapCenter: number;
  gapHalf: number;
  moveAmp: number;
  movePhase: number;
  moveSpeed: number;
  /** Bieżące pionowe wychylenie ruchomej przeszkody. */
  offset: number;
}

export interface Spark {
  x: number;
  y: number;
  r: number;
  phase: number;
}

export type PowerType = "shield" | "slow" | "magnet";

export interface PowerUp {
  x: number;
  y: number;
  r: number;
  type: PowerType;
  phase: number;
}

export const POWER_ICONS: Record<PowerType, string> = {
  shield: "🛡️",
  slow: "⏳",
  magnet: "🧲",
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function circleRectHit(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

export class ObstacleField {
  obstacles: Obstacle[] = [];
  sparks: Spark[] = [];
  powerups: PowerUp[] = [];

  private rng: RNG = Math.random;
  private nextX = 0;
  private prevX = 0;
  private lastGapCenter = 0;
  private sincePower = 0;
  private powerThreshold = 0;

  init(rng: RNG, viewW: number, viewH: number): void {
    this.rng = rng;
    this.obstacles.length = 0;
    this.sparks.length = 0;
    this.powerups.length = 0;
    this.nextX = viewW * 1.25;
    this.prevX = viewW * 0.4;
    this.lastGapCenter = viewH / 2;
    this.sincePower = 0;
    this.powerThreshold = 1800 + this.rng() * 1500;
  }

  update(dt: number, speed: number, distM: number, zoneNumber: number, viewW: number, viewH: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      o.x -= speed * dt;
      if (o.moveAmp > 0) {
        o.movePhase += o.moveSpeed * dt;
        o.offset = Math.sin(o.movePhase) * o.moveAmp;
      }
      if (o.x + o.width < -120) this.obstacles.splice(i, 1);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.x -= speed * dt;
      s.phase += dt * 6;
      if (s.x < -60) this.sparks.splice(i, 1);
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i]!;
      p.x -= speed * dt;
      p.phase += dt * 3;
      if (p.x < -60) this.powerups.splice(i, 1);
    }

    this.nextX -= speed * dt;
    while (this.nextX < viewW + 360) {
      this.spawn(speed, distM, zoneNumber, viewH);
    }
  }

  private spawn(speed: number, distM: number, zoneNumber: number, viewH: number): void {
    const x = this.nextX;
    // Szczelina zwęża się z dystansem (z twardym minimum).
    const gapHalf = Math.max(158, 264 - distM * 0.12) / 2;
    const spacing = 215 + speed * 0.85 + this.rng() * 130;

    // Ruchome przeszkody od strefy 3.
    let moveAmp = 0;
    let moveSpeed = 0;
    if (zoneNumber >= 3) {
      moveAmp = 30 + Math.min(zoneNumber * 5, 45);
      moveSpeed = 1.1 + this.rng() * 1.3;
    }

    // Sprawdzenie osiągalności: ile pionowej drogi gracz zdoła pokonać
    // w czasie przelotu między szczelinami przy obecnej prędkości.
    const t = spacing / speed;
    const maxTravel = Math.min(0.5 * GRAVITY * t * t, TERMINAL_VY * t) * 0.5;
    const reach = Math.max(70, maxTravel - moveAmp);

    const margin = gapHalf + 30;
    let lo = Math.max(margin, this.lastGapCenter - reach);
    let hi = Math.min(viewH - margin, this.lastGapCenter + reach);
    if (lo > hi) {
      lo = hi = clamp(this.lastGapCenter, margin, viewH - margin);
    }
    const gapCenter = lo + this.rng() * (hi - lo);

    // Oscylacja nie może wypchnąć szczeliny poza ekran.
    moveAmp = Math.max(
      0,
      Math.min(moveAmp, gapCenter - gapHalf - 12, viewH - gapHalf - 12 - gapCenter),
    );

    this.obstacles.push({
      x,
      width: COLUMN_WIDTH,
      gapCenter,
      gapHalf,
      moveAmp,
      movePhase: this.rng() * Math.PI * 2,
      moveSpeed,
      offset: 0,
    });

    this.sincePower += spacing;
    let powerPlaced = false;
    if (this.sincePower >= this.powerThreshold) {
      this.sincePower = 0;
      this.powerThreshold = 2600 + this.rng() * 2800;
      const roll = this.rng();
      const type: PowerType = roll < 0.4 ? "shield" : roll < 0.7 ? "slow" : "magnet";
      this.powerups.push({
        x: x + COLUMN_WIDTH / 2,
        y: gapCenter,
        r: 15,
        type,
        phase: this.rng() * Math.PI * 2,
      });
      powerPlaced = true;
    }

    // Iskry: łuk między poprzednią a nową szczeliną (zawsze na osiągalnej
    // trajektorii) albo pionowa linia w szczelinie nieruchomej kolumny.
    if (!powerPlaced) {
      const inGap = moveAmp === 0 && this.rng() < 0.45;
      if (inGap) {
        const n = 3;
        for (let i = 0; i < n; i++) {
          this.sparks.push({
            x: x + COLUMN_WIDTH / 2,
            y: gapCenter + (i - (n - 1) / 2) * Math.min(30, gapHalf * 0.6),
            r: 7,
            phase: this.rng() * Math.PI * 2,
          });
        }
      } else {
        const n = 3 + Math.floor(this.rng() * 3);
        const arcH = (this.rng() - 0.5) * 70;
        const x0 = this.prevX + COLUMN_WIDTH;
        const x1 = x;
        for (let i = 0; i < n; i++) {
          const f = (i + 1) / (n + 1);
          this.sparks.push({
            x: x0 + (x1 - x0) * f,
            y:
              this.lastGapCenter +
              (gapCenter - this.lastGapCenter) * f +
              Math.sin(f * Math.PI) * arcH,
            r: 7,
            phase: this.rng() * Math.PI * 2,
          });
        }
      }
    }

    this.prevX = x;
    this.lastGapCenter = gapCenter;
    this.nextX += spacing;
  }

  /** Kolizja kuli gracza z kolumnami (korpus + spłycony hitbox kolców). */
  hits(px: number, py: number, pr: number, viewH: number): Obstacle | null {
    for (const o of this.obstacles) {
      if (px + pr < o.x || px - pr > o.x + o.width) continue;
      const c = o.gapCenter + o.offset;
      const topEnd = c - o.gapHalf;
      const botStart = c + o.gapHalf;
      if (circleRectHit(px, py, pr, o.x, -200, o.width, topEnd + 200 + SPIKE_HITBOX)) return o;
      if (circleRectHit(px, py, pr, o.x, botStart - SPIKE_HITBOX, o.width, viewH - botStart + 200 + SPIKE_HITBOX)) {
        return o;
      }
    }
    return null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    columnColor: string,
    spikeColor: string,
    accentColor: string,
  ): void {
    for (const o of this.obstacles) {
      if (o.x > viewW + 40 || o.x + o.width < -40) continue;
      const c = o.gapCenter + o.offset;
      const topEnd = c - o.gapHalf;
      const botStart = c + o.gapHalf;

      ctx.save();
      ctx.fillStyle = columnColor;
      ctx.shadowColor = columnColor;
      ctx.shadowBlur = 16;
      ctx.fillRect(o.x, -8, o.width, topEnd + 8);
      ctx.fillRect(o.x, botStart, o.width, viewH - botStart + 8);

      // Rozświetlone krawędzie
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(o.x, -8, 4, topEnd + 8);
      ctx.fillRect(o.x, botStart, 4, viewH - botStart + 8);

      // Kolce
      ctx.fillStyle = spikeColor;
      ctx.shadowColor = spikeColor;
      ctx.shadowBlur = 10;
      const n = Math.floor(o.width / 18);
      const sw = o.width / n;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = o.x + i * sw;
        ctx.moveTo(sx, topEnd);
        ctx.lineTo(sx + sw / 2, topEnd + SPIKE_HEIGHT);
        ctx.lineTo(sx + sw, topEnd);
        ctx.moveTo(sx, botStart);
        ctx.lineTo(sx + sw / 2, botStart - SPIKE_HEIGHT);
        ctx.lineTo(sx + sw, botStart);
      }
      ctx.fill();
      ctx.restore();
    }

    // Iskry — pulsujące złote gwiazdki
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.sparks) {
      if (s.x > viewW + 30 || s.x < -30) continue;
      const pulse = 0.75 + 0.25 * Math.sin(s.phase);
      ctx.fillStyle = "#f9f871";
      ctx.shadowColor = "#f9f871";
      ctx.shadowBlur = 12;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.phase * 0.4);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? s.r : s.r * 0.42;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Power-upy — okręgi z ikonami
    for (const p of this.powerups) {
      if (p.x > viewW + 40 || p.x < -40) continue;
      const bob = Math.sin(p.phase) * 5;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(8,8,24,0.7)";
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(POWER_ICONS[p.type], 0, 1);
      ctx.restore();
    }
  }
}
