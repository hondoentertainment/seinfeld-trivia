/**
 * Deterministic PRNG — same numeric seed ⇒ same sequence.
 * Lightweight FNV-ish string hash + Mulberry32, matching common browser game patterns.
 */
export function hashStringToSeed(text: string, salt = 0x7365696e): number {
  let h = salt >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h >>> 0;
}

/** Returns rng(): number in [0, 1). Deterministic given seed32. */
export function mulberry32(seed32: number): () => number {
  return function () {
    let t = (seed32 += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
