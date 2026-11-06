/** Unity Animator.StringToHash uses the standard CRC32 bit pattern. Verified
 * against the five recovered Seina damage-tag constants in HitDamage.json. */
export function combatTagHash(value: string): number {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) | 0;
}
