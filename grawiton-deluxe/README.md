# GRAWITON Deluxe

Neonowy runner 2D na canvasie sterowany jednym przyciskiem. Odwracaj grawitację,
omijaj kolce, zbieraj złote iskry seriami dla combo i przetrwaj jak najdłużej
przy rosnącym tempie.

🎮 **Graj online:** https://natanielbuko-droid.github.io/fantastic-bassoon/grawiton-deluxe/

## Uruchomienie

Wymagany Node.js 18+.

```bash
npm install
npm run dev        # serwer deweloperski (adres w konsoli)
npm run build      # build produkcyjny do dist/
npm run preview    # podgląd builda produkcyjnego
```

## Jak grać

- **Dotknij ekranu / kliknij / naciśnij spację** — odwrócenie grawitacji.
- **Esc / P** — pauza (gra pauzuje się też sama przy utracie fokusu okna).
- Omijaj kolumny z kolcami — szczelina zwęża się z dystansem, a od strefy 3
  przeszkody zaczynają się poruszać.
- Zbieraj **złote iskry** (+2 pkt). Serie zbierane w odstępie do ~2 s budują
  **combo x2–x5**.
- Power-upy: 🛡️ **tarcza** (jedno darmowe zderzenie), ⏳ **spowolnienie czasu**
  (3 s), 🧲 **magnes na iskry** (5 s).
- Co 500 m zmienia się **strefa** — nowa paleta kolorów i wyższe tempo
  (prędkość rośnie logarytmicznie do limitu).
- **⭐ Wyzwanie dnia** — ten sam seed (data UTC), czyli identyczny układ
  przeszkód dla wszystkich graczy danego dnia.
- Top 10 wyników i ustawienia (dźwięk, ograniczone efekty) zapisują się
  w localStorage. Gra szanuje `prefers-reduced-motion`.

## Struktura projektu

```
index.html          — markup ekranów (start / pauza / koniec gry) i HUD
src/
  main.ts           — start aplikacji i spięcie modułów
  game.ts           — pętla gry (fixed timestep 60/s), stany, strefy, render
  player.ts         — fizyka kuli, trail, squash & stretch
  obstacles.ts      — generator przeszkód (gwarancja przechodniości), iskry, power-upy
  particles.ts      — system cząsteczek
  audio.ts          — syntezowane dźwięki i muzyka (WebAudio, bez plików)
  input.ts          — dotyk / mysz / klawiatura w jednym miejscu
  storage.ts        — top 10 wyników i ustawienia w localStorage
  ui.ts             — ekrany, HUD i przyciski (DOM)
  rng.ts            — deterministyczny RNG (seed, wyzwanie dnia)
  style.css         — style ekranów i HUD
```

Bez silnika gier i bez frameworków UI — Vite + vanilla TypeScript (strict).
