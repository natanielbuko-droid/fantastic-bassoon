/**
 * Warstwa DOM: ekrany (start / pauza / koniec gry), HUD i przyciski.
 * Cały tekst interfejsu po polsku, liczby formatowane przez pl-PL.
 */

import type { ScoreEntry } from "./storage";
import type { PowerType } from "./obstacles";
import { POWER_ICONS } from "./obstacles";

export type ScreenName = "start" | "pause" | "gameover" | null;

export interface UIHandlers {
  onStart(daily: boolean): void;
  onRestart(): void;
  onResume(): void;
  onMenu(): void;
  onToggleMute(): void;
  onToggleFx(): void;
}

export interface PowerState {
  shield: boolean;
  /** Pozostały czas 0..1. */
  slow: number;
  magnet: number;
}

const nf = new Intl.NumberFormat("pl-PL");

function fmt(n: number): string {
  return nf.format(Math.floor(n));
}

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Brak elementu: ${selector}`);
  return el;
}

interface PowerSlot {
  root: HTMLElement;
  bar: HTMLElement;
}

export class UI {
  private hud = $<HTMLDivElement>("#hud");
  private hudScore = $<HTMLDivElement>("#hud-score");
  private hudCombo = $<HTMLDivElement>("#hud-combo");
  private hudDist = $<HTMLDivElement>("#hud-dist");
  private screens = {
    start: $<HTMLElement>("#screen-start"),
    pause: $<HTMLElement>("#screen-pause"),
    gameover: $<HTMLElement>("#screen-gameover"),
  };
  private btnMute = $<HTMLButtonElement>("#btn-mute");
  private btnFx = $<HTMLButtonElement>("#btn-fx");
  private powerSlots: Record<PowerType, PowerSlot>;

  private lastScore = "";
  private lastCombo = "";
  private lastDist = "";

  constructor() {
    const powersEl = $<HTMLDivElement>("#hud-powers");
    const makeSlot = (type: PowerType): PowerSlot => {
      const root = document.createElement("div");
      root.className = `power p-${type} hidden`;
      const icon = document.createElement("span");
      icon.textContent = POWER_ICONS[type];
      const bar = document.createElement("span");
      bar.className = "bar";
      const fill = document.createElement("i");
      bar.appendChild(fill);
      root.append(icon, bar);
      powersEl.appendChild(root);
      return { root, bar: fill };
    };
    this.powerSlots = {
      shield: makeSlot("shield"),
      slow: makeSlot("slow"),
      magnet: makeSlot("magnet"),
    };
  }

  bind(h: UIHandlers): void {
    $("#btn-start").addEventListener("click", () => h.onStart(false));
    $("#btn-daily").addEventListener("click", () => h.onStart(true));
    $("#btn-again").addEventListener("click", () => h.onRestart());
    $("#btn-resume").addEventListener("click", () => h.onResume());
    $("#btn-pause-menu").addEventListener("click", () => h.onMenu());
    $("#btn-go-menu").addEventListener("click", () => h.onMenu());
    this.btnMute.addEventListener("click", () => h.onToggleMute());
    this.btnFx.addEventListener("click", () => h.onToggleFx());
  }

  showScreen(name: ScreenName): void {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle("hidden", key !== name);
    }
    this.hud.classList.toggle("hidden", name === "start");
  }

  setMuted(muted: boolean): void {
    this.btnMute.textContent = muted ? "🔇" : "🔊";
    this.btnMute.setAttribute("aria-label", muted ? "Włącz dźwięk" : "Wycisz dźwięk");
  }

  setReducedFx(reduced: boolean): void {
    this.btnFx.textContent = reduced ? "Efekty: ograniczone" : "Efekty: pełne";
  }

  setDailyInfo(key: string): void {
    $("#daily-info").textContent =
      `Wyzwanie dnia ${key} (UTC): ten sam układ przeszkód dla wszystkich graczy.`;
  }

  updateHUD(
    score: number,
    multiplier: number,
    comboCount: number,
    distM: number,
    powers: PowerState,
  ): void {
    const scoreText = fmt(score);
    if (scoreText !== this.lastScore) {
      this.hudScore.textContent = scoreText;
      this.lastScore = scoreText;
    }

    const comboText = multiplier > 1 ? `x${multiplier} • ${comboCount}` : "";
    if (comboText !== this.lastCombo) {
      this.hudCombo.textContent = comboText;
      this.hudCombo.classList.toggle("hidden", comboText === "");
      this.lastCombo = comboText;
    }

    const distText = `${fmt(distM)} m`;
    if (distText !== this.lastDist) {
      this.hudDist.textContent = distText;
      this.lastDist = distText;
    }

    this.updatePower("shield", powers.shield ? 1 : 0);
    this.updatePower("slow", powers.slow);
    this.updatePower("magnet", powers.magnet);
  }

  private updatePower(type: PowerType, fraction: number): void {
    const slot = this.powerSlots[type];
    const active = fraction > 0;
    slot.root.classList.toggle("hidden", !active);
    if (active) {
      slot.bar.style.width = `${Math.round(fraction * 100)}%`;
    }
  }

  showGameOver(
    score: number,
    distM: number,
    best: number,
    scores: ScoreEntry[],
    rank: number,
    daily: boolean,
  ): void {
    $("#go-score").textContent = fmt(score);
    $("#go-dist").textContent = `${fmt(distM)} m`;
    $("#go-best").textContent = fmt(best);
    $("#go-record").classList.toggle("hidden", !(rank === 0 && score > 0));

    const tbody = $<HTMLTableSectionElement>("#go-table tbody");
    tbody.innerHTML = "";
    if (scores.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "Brak zapisanych wyników.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    scores.forEach((entry, i) => {
      const tr = document.createElement("tr");
      if (i === rank) tr.className = "current";
      const cells = [
        `${i + 1}.`,
        fmt(entry.score),
        `${fmt(entry.distance)} m`,
        new Date(entry.date).toLocaleDateString("pl-PL"),
        entry.daily ? "⭐" : "",
      ];
      for (const text of cells) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });

    this.showScreen("gameover");
    const modeLabel = daily ? " (wyzwanie dnia)" : "";
    $("#screen-gameover h2").textContent = `Koniec gry${modeLabel}`;
  }
}
