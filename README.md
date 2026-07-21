# 🧮 Kalkulator

Prosty kalkulator webowy — czysty HTML, CSS i JavaScript, bez żadnych zależności.

**👉 Wypróbuj online: https://natanielbuko-droid.github.io/fantastic-bassoon/**

🎮 W repozytorium znajdziesz też grę **[GRAWITON Deluxe](grawiton-deluxe/)** —
neonowy runner 2D z odwracaniem grawitacji.
Zagraj online: https://natanielbuko-droid.github.io/fantastic-bassoon/grawiton-deluxe/

## Funkcje

- Dodawanie, odejmowanie, mnożenie, dzielenie
- Procenty, liczby dziesiętne, backspace, czyszczenie
- Pełna obsługa klawiatury (cyfry, `+ - * /`, `Enter` = wynik, `Backspace`, `Esc` = wyczyść)
- Działa na telefonie i komputerze

## Uruchomienie lokalne

Nie wymaga instalacji — wystarczy otworzyć `index.html` w przeglądarce, albo:

```bash
python3 -m http.server 8000
```

i wejść na `http://localhost:8000`.

## Publikacja

Strona jest hostowana na GitHub Pages z gałęzi `gh-pages`. Każda zmiana w `main`
jest publikowana automatycznie przez workflow `.github/workflows/pages.yml`,
który dodatkowo buduje grę GRAWITON Deluxe (Vite) i publikuje ją pod
ścieżką `/grawiton-deluxe/`.
