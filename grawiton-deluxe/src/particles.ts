/**
 * Prosty system cząsteczek rysowany addytywnie (blend "lighter").
 * W trybie ograniczonych efektów (prefers-reduced-motion lub ustawienie)
 * liczba cząsteczek jest mocno zredukowana.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
}

export interface BurstOptions {
  count: number;
  colors: string[];
  speed: number;
  size?: number;
  life?: number;
  gravity?: number;
  spreadY?: number;
}

const MAX_PARTICLES = 500;

export class ParticleSystem {
  private particles: Particle[] = [];
  reduced = false;

  clear(): void {
    this.particles.length = 0;
  }

  burst(x: number, y: number, opts: BurstOptions): void {
    let count = this.reduced ? Math.ceil(opts.count / 4) : opts.count;
    count = Math.min(count, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = opts.speed * (0.3 + Math.random() * 0.7);
      const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y: y + (opts.spreadY ? (Math.random() - 0.5) * opts.spreadY : 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)]!,
        gravity: opts.gravity ?? 0,
        drag: 2.2,
      });
    }
  }

  /** `scroll` — prędkość świata, cząsteczki odpływają w lewo razem z nim. */
  update(dt: number, scroll: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += p.gravity * dt;
      p.x += (p.vx - scroll) * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
