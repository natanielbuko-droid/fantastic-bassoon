/**
 * Pętla gry i maszyna stanów: menu -> playing <-> paused -> gameover.
 *
 * Logika działa na stałym kroku 60 kroków/s (fixed timestep z akumulatorem),
 * niezależnie od FPS — render odbywa się w requestAnimationFrame i może
 * przebiegać z inną częstotliwością niż fizyka. Świat ma stałą wysokość
 * wirtualną 540 jednostek, skalowaną do rozmiaru okna.
 */

import { Player, PLAYER_RADIUS } from "./player";
import { ObstacleField, type PowerType } from "./obstacles";
import { ParticleSystem } from "./particles";
import { AudioEngine } from "./audio";
import { UI } from "./ui";
import { mulberry32, dailySeed, randomSeed, type RNG } from "./rng";
import { addScore, saveSettings, type Settings } from "./storage";

export type GameState = "menu" | "playing" | "paused" | "gameover";

const VIEW_H = 540;
const STEP = 1 / 60;
const PX_PER_M = 32;

// Prędkość rośnie logarytmicznie do limitu.
const SPEED_BASE = 250;
const SPEED_MAX = 620;
const SPEED_LOG = 85;

const ZONE_LENGTH_M = 500;
const ZONE_BLEND_TIME = 1.2;
const COMBO_WINDOW = 2.0;
const SLOW_DURATION = 3;
const SLOW_SCALE = 0.45;
const MAGNET_DURATION = 5;
const MAGNET_RADIUS = 280;
const HIT_STOP = 0.08;
const DEATH_DELAY = 1.0;
const SHAKE_TIME = 0.5;

type RGB = [number, number, number];

interface Palette {
  bgTop: RGB;
  bgBottom: RGB;
  column: RGB;
  spike: RGB;
  accent: RGB;
  player: RGB;
}

function hex(s: string): RGB {
  return [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
}

function makePalette(p: Record<keyof Palette, string>): Palette {
  return {
    bgTop: hex(p.bgTop),
    bgBottom: hex(p.bgBottom),
    column: hex(p.column),
    spike: hex(p.spike),
    accent: hex(p.accent),
    player: hex(p.player),
  };
}

// Palety stref — cyklicznie co 500 m.
const PALETTES: Palette[] = [
  makePalette({ bgTop: "#0b0a1e", bgBottom: "#1a0b2e", column: "#17797c", spike: "#ff2a6d", accent: "#2de2e6", player: "#2de2e6" }),
  makePalette({ bgTop: "#01161e", bgBottom: "#04352b", column: "#1b7d51", spike: "#ff5d8f", accent: "#3dfc9a", player: "#3dfc9a" }),
  makePalette({ bgTop: "#1a0522", bgBottom: "#3d0b3f", column: "#a45b00", spike: "#ff206e", accent: "#ff9e00", player: "#41ead4" }),
  makePalette({ bgTop: "#030b1a", bgBottom: "#0b2545", column: "#2a6f8f", spike: "#ef476f", accent: "#64dfdf", player: "#ffd60a" }),
  makePalette({ bgTop: "#1b0308", bgBottom: "#3a0d12", column: "#8f2d3c", spike: "#ffe94e", accent: "#ff4d6d", player: "#ff8fa3" }),
  makePalette({ bgTop: "#10002b", bgBottom: "#240046", column: "#5a3d8a", spike: "#ff6d00", accent: "#c77dff", player: "#80ffdb" }),
];

function mix(a: RGB, b: RGB, f: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
}

interface StarLayer {
  factor: number;
  alpha: number;
  stars: Star[];
}

export class Game {
  state: GameState = "menu";

  private ctx: CanvasRenderingContext2D;
  private player = new Player();
  private field = new ObstacleField();
  private particles = new ParticleSystem();

  private viewW = 960;
  private scale = 1;
  private dpr = 1;

  private starLayers: StarLayer[] = [];

  // Stan rundy
  private rng: RNG = Math.random;
  private daily = false;
  private speed = SPEED_BASE;
  private distM = 0;
  private score = 0;
  private comboCount = 0;
  private comboTimer = 0;
  private shield = false;
  private slowT = 0;
  private magnetT = 0;
  private invulnT = 0;
  private hitStop = 0;
  private shakeT = 0;
  private deathT = 0;
  private zoneNumber = 1;
  private prevZoneNumber = 1;
  private zoneBlend = 1;

  // Pętla
  private last = performance.now();
  private acc = 0;

  private motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private canvas: HTMLCanvasElement,
    private ui: UI,
    private audio: AudioEngine,
    private settings: Settings,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D niedostępny");
    this.ctx = ctx;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.motionQuery.addEventListener("change", () => this.applyFxSettings());
    this.applyFxSettings();

    requestAnimationFrame((t) => {
      this.last = t;
      requestAnimationFrame((t2) => this.frame(t2));
    });
  }

  /** Ograniczenie efektów: ustawienie gracza LUB preferencja systemowa. */
  private get reducedFx(): boolean {
    return this.settings.reducedFx || this.motionQuery.matches;
  }

  private applyFxSettings(): void {
    this.particles.reduced = this.reducedFx;
    this.ui.setReducedFx(this.settings.reducedFx);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = h / VIEW_H;
    this.viewW = w / this.scale;
    this.makeStars();
  }

  private makeStars(): void {
    const specs = [
      { factor: 0.14, alpha: 0.5, count: 42, size: 1.3 },
      { factor: 0.32, alpha: 0.7, count: 26, size: 2.1 },
      { factor: 0.58, alpha: 0.95, count: 14, size: 3 },
    ];
    this.starLayers = specs.map((s) => ({
      factor: s.factor,
      alpha: s.alpha,
      stars: Array.from({ length: s.count }, () => ({
        x: Math.random() * (this.viewW + 20),
        y: Math.random() * VIEW_H,
        size: s.size * (0.6 + Math.random() * 0.8),
        phase: Math.random() * Math.PI * 2,
      })),
    }));
  }

  // ---------- Sterowanie stanami ----------

  startRun(daily: boolean): void {
    const seed = daily ? dailySeed() : randomSeed();
    this.rng = mulberry32(seed);
    this.daily = daily;

    this.speed = SPEED_BASE;
    this.distM = 0;
    this.score = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.shield = false;
    this.slowT = 0;
    this.magnetT = 0;
    this.invulnT = 0;
    this.hitStop = 0;
    this.shakeT = 0;
    this.zoneNumber = 1;
    this.prevZoneNumber = 1;
    this.zoneBlend = 1;
    this.acc = 0;

    this.player.reset(this.viewW * 0.28, VIEW_H / 2);
    this.field.init(this.rng, this.viewW, VIEW_H);
    this.particles.clear();

    this.state = "playing";
    this.ui.showScreen(null);
    this.audio.startMusic();
  }

  restart(): void {
    this.startRun(this.daily);
  }

  toMenu(): void {
    this.state = "menu";
    this.audio.stopMusic();
    this.ui.showScreen("start");
  }

  /** Jeden przycisk: flip w grze, start/restart na ekranach. */
  flipOrStart(): void {
    switch (this.state) {
      case "playing":
        this.flip();
        break;
      case "menu":
        this.startRun(false);
        break;
      case "gameover":
        this.restart();
        break;
      case "paused":
        this.resume();
        break;
    }
  }

  private flip(): void {
    if (!this.player.alive || this.hitStop > 0) return;
    this.player.flip();
    this.audio.playFlip();
    const pal = this.palette();
    this.particles.burst(this.player.x, this.player.y, {
      count: 10,
      colors: [pal.player, "#ffffff"],
      speed: 200,
      size: 3,
      life: 0.35,
    });
  }

  pauseToggle(): void {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }

  /** Auto-pauza przy utracie fokusu okna. */
  autoPause(): void {
    if (this.state === "playing") this.pause();
  }

  private pause(): void {
    this.state = "paused";
    this.audio.stopMusic();
    this.ui.showScreen("pause");
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.acc = 0;
    this.audio.startMusic();
    this.ui.showScreen(null);
  }

  toggleMute(): void {
    this.settings.muted = !this.settings.muted;
    saveSettings(this.settings);
    this.audio.setMuted(this.settings.muted);
    this.ui.setMuted(this.settings.muted);
  }

  toggleReducedFx(): void {
    this.settings.reducedFx = !this.settings.reducedFx;
    saveSettings(this.settings);
    this.applyFxSettings();
  }

  // ---------- Pętla ----------

  private frame(now: number): void {
    const dtReal = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    if (this.state === "playing") {
      if (this.hitStop > 0) {
        // Hit-stop: świat zamiera na chwilę (czas rzeczywisty).
        this.hitStop -= dtReal;
      } else {
        const timeScale = this.slowT > 0 ? SLOW_SCALE : 1;
        this.acc += dtReal * timeScale;
        let steps = 0;
        while (this.acc >= STEP && steps < 8) {
          this.step(STEP);
          this.acc -= STEP;
          steps++;
        }
        if (steps === 8) this.acc = 0; // za wolne urządzenie — nie goń zaległości

        // Czasy power-upów płyną w czasie rzeczywistym (spowolnienie trwa 3 s
        // zegarowe, nie 3 s spowolnionego świata).
        if (this.player.alive) {
          this.slowT = Math.max(0, this.slowT - dtReal);
          this.magnetT = Math.max(0, this.magnetT - dtReal);
          this.invulnT = Math.max(0, this.invulnT - dtReal);
        }
      }
      this.shakeT = Math.max(0, this.shakeT - dtReal);
    } else if (this.state === "menu") {
      this.updateStars(dtReal, 55);
    } else if (this.state === "gameover") {
      this.updateStars(dtReal, 25);
      this.particles.update(dtReal, 0);
    }

    this.render(now);
    requestAnimationFrame((t) => this.frame(t));
  }

  private step(dt: number): void {
    this.updateStars(dt, this.speed);

    if (!this.player.alive) {
      // Animacja śmierci: świat stoi, cząsteczki dogasają.
      this.particles.update(dt, 0);
      this.deathT -= dt;
      if (this.deathT <= 0) this.finishRun();
      return;
    }

    this.speed = Math.min(SPEED_MAX, SPEED_BASE + SPEED_LOG * Math.log1p(this.distM / 60));
    this.distM += (this.speed * dt) / PX_PER_M;

    // Strefy: co 500 m nowa paleta z płynnym przejściem.
    const zone = Math.floor(this.distM / ZONE_LENGTH_M) + 1;
    if (zone !== this.zoneNumber) {
      this.prevZoneNumber = this.zoneNumber;
      this.zoneNumber = zone;
      this.zoneBlend = 0;
    }
    this.zoneBlend = Math.min(1, this.zoneBlend + dt / ZONE_BLEND_TIME);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    this.player.x = this.viewW * 0.28;
    this.player.update(dt, PLAYER_RADIUS + 3, VIEW_H - PLAYER_RADIUS - 3, this.speed);
    this.field.update(dt, this.speed, this.distM, this.zoneNumber, this.viewW, VIEW_H);
    this.particles.update(dt, this.speed * 0.4);

    this.collectPickups(dt);
    this.checkCollision();
    this.updateHud();
  }

  private collectPickups(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const pal = this.palette();

    if (this.magnetT > 0) {
      for (const s of this.field.sparks) {
        const dx = px - s.x;
        const dy = py - s.y;
        if (dx * dx + dy * dy < MAGNET_RADIUS * MAGNET_RADIUS) {
          const k = Math.min(1, dt * 9);
          s.x += dx * k;
          s.y += dy * k;
        }
      }
    }

    for (let i = this.field.sparks.length - 1; i >= 0; i--) {
      const s = this.field.sparks[i]!;
      const dx = px - s.x;
      const dy = py - s.y;
      const rr = PLAYER_RADIUS + s.r + 5;
      if (dx * dx + dy * dy < rr * rr) {
        this.field.sparks.splice(i, 1);
        this.comboCount++;
        this.comboTimer = COMBO_WINDOW;
        this.score += 2 * this.multiplier();
        this.audio.playCollect(this.comboCount);
        this.particles.burst(s.x, s.y, {
          count: 12,
          colors: ["#f9f871", "#ffffff"],
          speed: 240,
          size: 3.4,
          life: 0.45,
        });
      }
    }

    for (let i = this.field.powerups.length - 1; i >= 0; i--) {
      const p = this.field.powerups[i]!;
      const dx = px - p.x;
      const dy = py - p.y;
      const rr = PLAYER_RADIUS + p.r + 7;
      if (dx * dx + dy * dy < rr * rr) {
        this.field.powerups.splice(i, 1);
        this.applyPower(p.type);
        this.audio.playPowerup();
        this.particles.burst(p.x, p.y, {
          count: 22,
          colors: [pal.accent, "#ffffff"],
          speed: 320,
          size: 4,
          life: 0.6,
        });
      }
    }
  }

  private applyPower(type: PowerType): void {
    switch (type) {
      case "shield":
        this.shield = true;
        break;
      case "slow":
        this.slowT = SLOW_DURATION;
        break;
      case "magnet":
        this.magnetT = MAGNET_DURATION;
        break;
    }
  }

  /** Mnożnik combo x1..x5 — rośnie co 3 iskry zebrane w serii. */
  private multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.comboCount / 3));
  }

  private checkCollision(): void {
    if (this.invulnT > 0) return;
    const hit = this.field.hits(this.player.x, this.player.y, PLAYER_RADIUS - 2, VIEW_H);
    if (!hit) return;

    if (this.shield) {
      // Tarcza: jedno darmowe zderzenie.
      this.shield = false;
      this.invulnT = 1.2;
      this.hitStop = HIT_STOP;
      this.shakeT = SHAKE_TIME * 0.4;
      this.audio.playShieldBreak();
      this.particles.burst(this.player.x, this.player.y, {
        count: 26,
        colors: ["#64dfdf", "#ffffff"],
        speed: 380,
        size: 3.6,
        life: 0.55,
      });
      return;
    }

    this.die();
  }

  private die(): void {
    const pal = this.palette();
    this.player.alive = false;
    this.deathT = DEATH_DELAY;
    this.hitStop = HIT_STOP;
    this.shakeT = SHAKE_TIME;
    this.audio.playDeath();
    this.audio.stopMusic();
    this.particles.burst(this.player.x, this.player.y, {
      count: 70,
      colors: [pal.player, pal.spike, "#ffffff"],
      speed: 520,
      size: 4.5,
      life: 0.9,
      gravity: 500,
    });
  }

  private finishRun(): void {
    const entry = {
      score: this.score,
      distance: Math.floor(this.distM),
      date: new Date().toISOString(),
      daily: this.daily,
    };
    const { scores, rank } = addScore(entry);
    const best = scores.length > 0 ? scores[0]!.score : this.score;
    this.state = "gameover";
    this.ui.showGameOver(this.score, this.distM, best, scores, rank, this.daily);
  }

  private updateHud(): void {
    this.ui.updateHUD(this.score, this.multiplier(), this.comboCount, this.distM, {
      shield: this.shield,
      slow: this.slowT / SLOW_DURATION,
      magnet: this.magnetT / MAGNET_DURATION,
    });
  }

  // ---------- Render ----------

  private updateStars(dt: number, speed: number): void {
    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        star.x -= speed * layer.factor * dt;
        if (star.x < -10) {
          star.x += this.viewW + 20;
          star.y = Math.random() * VIEW_H;
        }
      }
    }
  }

  /** Paleta bieżącej strefy zmieszana z poprzednią podczas przejścia. */
  private blended(pick: (p: Palette) => RGB): string {
    const cur = PALETTES[(this.zoneNumber - 1) % PALETTES.length]!;
    const prev = PALETTES[(this.prevZoneNumber - 1) % PALETTES.length]!;
    return mix(pick(prev), pick(cur), this.zoneBlend);
  }

  private palette(): { bgTop: string; bgBottom: string; column: string; spike: string; accent: string; player: string } {
    return {
      bgTop: this.blended((p) => p.bgTop),
      bgBottom: this.blended((p) => p.bgBottom),
      column: this.blended((p) => p.column),
      spike: this.blended((p) => p.spike),
      accent: this.blended((p) => p.accent),
      player: this.blended((p) => p.player),
    };
  }

  private render(now: number): void {
    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Screen shake przy śmierci (wyłączony przy ograniczonych efektach).
    if (this.shakeT > 0 && !this.reducedFx) {
      const mag = 14 * (this.shakeT / SHAKE_TIME);
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }

    const pal = this.palette();
    const w = this.viewW;

    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.bgTop);
    grad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-24, -24, w + 48, VIEW_H + 48);

    // Paralaksa: 3 warstwy gwiazd.
    ctx.save();
    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        const tw = 0.6 + 0.4 * Math.sin(now / 700 + star.phase);
        ctx.globalAlpha = layer.alpha * tw;
        ctx.fillStyle = "#dff5ff";
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
    }
    ctx.restore();

    // Linie podłogi i sufitu.
    ctx.save();
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-24, 1.5);
    ctx.lineTo(w + 24, 1.5);
    ctx.moveTo(-24, VIEW_H - 1.5);
    ctx.lineTo(w + 24, VIEW_H - 1.5);
    ctx.stroke();
    ctx.restore();

    if (this.state !== "menu") {
      this.field.draw(ctx, w, VIEW_H, pal.column, pal.spike, pal.accent);
    }

    this.particles.draw(ctx);

    if ((this.state === "playing" || this.state === "paused") && this.player.alive) {
      // Miganie podczas nietykalności po zbitej tarczy.
      const blink = this.invulnT > 0 && Math.floor(now / 80) % 2 === 0;
      if (!blink) {
        this.player.draw(ctx, pal.player, this.shield);
      }
    }

    // Winieta spowolnienia czasu.
    if (this.slowT > 0 && this.state === "playing") {
      ctx.save();
      ctx.globalAlpha = Math.min(0.28, this.slowT * 0.4);
      const vg = ctx.createRadialGradient(w / 2, VIEW_H / 2, VIEW_H * 0.3, w / 2, VIEW_H / 2, VIEW_H * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "#c77dff");
      ctx.fillStyle = vg;
      ctx.fillRect(-24, -24, w + 48, VIEW_H + 48);
      ctx.restore();
    }
  }
}
