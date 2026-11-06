/** Reproducible simulator randomness, not a claim to reproduce the client's
 * secret/session seed. State belongs to a replay, never to a module singleton. */
export function nextCombatRandom(seed: number): { seed: number; percent: number } {
  let next = seed | 0;
  if (!next) next = 0x6d2b79f5;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  const unsigned = next >>> 0;
  return { seed: unsigned, percent: unsigned / 0x100000000 * 100 };
}
