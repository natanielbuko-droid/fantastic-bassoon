/**
 * Deterministyczny generator liczb pseudolosowych (mulberry32).
 * Ten sam seed => ten sam układ przeszkód, iskier i power-upów,
 * co umożliwia tryb "wyzwanie dnia" wspólny dla wszystkich graczy.
 */

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Klucz dzisiejszego dnia w UTC, wspólny dla wszystkich stref czasowych. */
export function dailyKey(): string {
  const d = new Date();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export function dailySeed(): number {
  return hashString("grawiton-deluxe:" + dailyKey());
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
