/**
 * Zapis w localStorage: top 10 wyników z datą oraz ustawienia gracza.
 * Wszystkie odczyty są odporne na uszkodzone/niedostępne localStorage
 * (np. tryb prywatny) — wtedy gra działa bez zapisu.
 */

const SCORES_KEY = "grawiton.scores";
const SETTINGS_KEY = "grawiton.settings";

export interface ScoreEntry {
  score: number;
  distance: number;
  date: string; // ISO
  daily: boolean;
}

export interface Settings {
  muted: boolean;
  reducedFx: boolean;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // brak miejsca / tryb prywatny — ignorujemy
  }
}

export function loadScores(): ScoreEntry[] {
  const data = read<unknown>(SCORES_KEY);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (e): e is ScoreEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as ScoreEntry).score === "number" &&
      typeof (e as ScoreEntry).distance === "number" &&
      typeof (e as ScoreEntry).date === "string",
  );
}

/** Dodaje wynik, przycina do top 10 i zwraca pozycję (0-9) lub -1 poza listą. */
export function addScore(entry: ScoreEntry): { scores: ScoreEntry[]; rank: number } {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score || b.distance - a.distance);
  const top = scores.slice(0, 10);
  write(SCORES_KEY, top);
  return { scores: top, rank: top.indexOf(entry) };
}

export function bestScore(): number {
  const scores = loadScores();
  return scores.length > 0 ? scores[0]!.score : 0;
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY);
  return {
    muted: s?.muted === true,
    reducedFx: s?.reducedFx === true,
  };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}
