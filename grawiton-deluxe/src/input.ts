/**
 * Ujednolicone wejście: dotyk/klik na canvasie oraz klawiatura.
 * `pointerdown` reaguje natychmiast (bez opóźnienia 300 ms — canvas ma
 * `touch-action: none`, a viewport wyłącza zoom podwójnym tapnięciem).
 */

export interface InputHandlers {
  /** Odwrócenie grawitacji (lub start/restart, zależnie od stanu gry). */
  onFlip(): void;
  onPauseToggle(): void;
  /** Pierwsza interakcja użytkownika — odblokowuje AudioContext. */
  onInteraction(): void;
}

export function setupInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    h.onInteraction();
    h.onFlip();
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case "Space":
      case "ArrowUp":
      case "KeyW":
        e.preventDefault();
        h.onInteraction();
        h.onFlip();
        break;
      case "Escape":
      case "KeyP":
        h.onInteraction();
        h.onPauseToggle();
        break;
    }
  });

  // Odblokowanie audio także po kliknięciu przycisków menu.
  window.addEventListener("pointerdown", () => h.onInteraction(), { capture: true });
}
