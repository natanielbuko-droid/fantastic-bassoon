import "./style.css";
import { Game } from "./game";
import { UI } from "./ui";
import { AudioEngine } from "./audio";
import { setupInput } from "./input";
import { loadSettings } from "./storage";
import { dailyKey } from "./rng";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Brak elementu #game");

const settings = loadSettings();
const ui = new UI();
const audio = new AudioEngine(settings.muted);
const game = new Game(canvas, ui, audio, settings);

ui.setMuted(settings.muted);
ui.setDailyInfo(dailyKey());
ui.showScreen("start");

ui.bind({
  onStart: (daily) => game.startRun(daily),
  onRestart: () => game.restart(),
  onResume: () => game.resume(),
  onMenu: () => game.toMenu(),
  onToggleMute: () => game.toggleMute(),
  onToggleFx: () => game.toggleReducedFx(),
});

setupInput(canvas, {
  onFlip: () => game.flipOrStart(),
  onPauseToggle: () => game.pauseToggle(),
  onInteraction: () => audio.unlock(),
});

// Auto-pauza przy utracie fokusu okna/karty.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.autoPause();
});
window.addEventListener("blur", () => game.autoPause());
