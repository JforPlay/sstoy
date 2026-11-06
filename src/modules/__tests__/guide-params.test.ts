import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatGuideAbilityText } from '../guide-params';
const read = (file: string) => JSON.parse(readFileSync(`public/data/${file}.json`, 'utf8'));
const parameters = { effectValue: read('EffectValue'), buffValue: read('BuffValue'), shieldValue: {}, hitDamage: {}, onceAdditionalAttributeValue: {}, scriptParameterValue: {} };
describe('current raid descriptions', () => {
  it('resolves November mechanics from referenced value tables instead of removing numbers', () => {
    const abilities = read('ScoreBossAbility'), text = read('KR/ScoreBossAbility');
    const description = formatGuideAbilityText(text[abilities[100025].Desc], abilities[100025], parameters);
    expect(description).toContain('8.00%');
    expect(description).toContain('3.0');
    expect(description).toContain('5');
    expect(description).not.toContain('&Param');
    expect(description).not.toContain('?');
    const second = formatGuideAbilityText(text[abilities[100026].Desc], abilities[100026], parameters);
    expect(second).toContain('4.00%');
    expect(second).toContain('12.00%');
    expect(second).not.toContain('?');
  });
});
