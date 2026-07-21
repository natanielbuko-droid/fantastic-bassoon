/**
 * Kula gracza: fizyka pionowa z odwracalną grawitacją, trail
 * oraz squash & stretch zależny od prędkości pionowej.
 */

export const PLAYER_RADIUS = 13;
export const GRAVITY = 2300; // jedn./s^2 (świat ma 540 jedn. wysokości)
export const TERMINAL_VY = 950;

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const TRAIL_MAX_AGE = 0.35;

export class Player {
  x = 0;
  y = 0;
  vy = 0;
  /** +1 = grawitacja w dół, -1 = w górę. */
  gravityDir = 1;
  alive = true;
  trail: TrailPoint[] = [];

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.gravityDir = 1;
    this.alive = true;
    this.trail.length = 0;
  }

  flip(): void {
    this.gravityDir *= -1;
    // Mały "kop" w nową stronę + wytłumienie starej prędkości — sterowanie
    // reaguje natychmiast zamiast czekać, aż grawitacja wyhamuje kulę.
    this.vy = this.vy * 0.25 + this.gravityDir * 140;
  }

  update(dt: number, minY: number, maxY: number, scroll: number): void {
    this.vy += this.gravityDir * GRAVITY * dt;
    this.vy = Math.max(-TERMINAL_VY, Math.min(TERMINAL_VY, this.vy));
    this.y += this.vy * dt;

    if (this.y >= maxY) {
      this.y = maxY;
      if (this.vy > 0) this.vy = 0;
    } else if (this.y <= minY) {
      this.y = minY;
      if (this.vy < 0) this.vy = 0;
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i]!;
      t.age += dt;
      t.x -= scroll * dt;
      if (t.age > TRAIL_MAX_AGE) this.trail.splice(i, 1);
    }
    this.trail.push({ x: this.x, y: this.y, age: 0 });
  }

  /** Squash & stretch: rozciągnięcie wzdłuż ruchu przy dużej prędkości pionowej. */
  stretch(): { sx: number; sy: number } {
    const s = Math.min(Math.abs(this.vy) / 1600, 0.35);
    return { sx: 1 - s * 0.7, sy: 1 + s };
  }

  draw(ctx: CanvasRenderingContext2D, color: string, shielded: boolean): void {
    // Trail
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of this.trail) {
      const a = 1 - t.age / TRAIL_MAX_AGE;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PLAYER_RADIUS * a * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const { sx, sy } = this.stretch();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(sx, sy);

    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Błysk
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(-4, this.gravityDir * -4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (shielded) {
      ctx.save();
      ctx.strokeStyle = "#64dfdf";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#64dfdf";
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 120);
      ctx.beginPath();
      ctx.arc(this.x, this.y, PLAYER_RADIUS + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
