import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameData } from '@/shared/game-data';
import { decodeBadgeAttribute, decodeBadgeSp, getBadgeSpBonus, getBadgeGroups, getBadgeStatSources, setBadgeOption, getBadgeSkillBonus, getBadgePotentialBonus, getBadgePotentialId, setPotentialTotalLevel } from '../core/badges';
import { getPotentialStatBonuses } from '../core/potentials';
import { aggregateAllStats } from '../core/stats';
import { calculateEffectiveDefenseMultiplier, calculateSingleHitDamage } from '../core/calc';
import { findActiveRaid, resolveEnemyPresets } from '../core/enemies';
import { getState, resetState, setBuildInfo, setDiscLevel, setNoteLevel, setStatOverride, setStepExpanded, updateEnemy } from '../core/state';
import { renderWizard } from '../ui/wizard';
import { renderCharacterCard, renderDiscSummary } from '../ui/build-panel';
import { renderNotesSection, renderPotentialArea } from '../ui/buff-panel';
import { renderBadgePanel } from '../ui/badge-panel';
import type { BuffSource } from '../types';

const json = (name: string) => JSON.parse(readFileSync(new URL(`../../../../public/data/${name}.json`, import.meta.url), 'utf8'));

beforeEach(() => {
  resetState();
  vi.stubGlobal('window', { state: { party: {} }, GameData });
  GameData.charGemAttrValue = json('CharGemAttrValue');
  GameData.charGemSlotControl = json('CharGemSlotControl');
  GameData.gameEnums = json('GameEnums');
  GameData.attributes = {};
  GameData.talentGroups = {};
  GameData.talents = {};
  setBuildInfo(103, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
});
afterEach(() => vi.unstubAllGlobals());

describe('badge data and aggregation', () => {
  it('opens an option-type picker without changing the four equipped affixes per badge', () => {
    const html = renderBadgePanel(getState());
    expect(html.match(/data-action="badge-group-open"/g)).toHaveLength(36);
    expect(html).not.toContain('<select data-action="badge-group"');
    expect(getState().badgeOptions.every(options => options.length === 4)).toBe(true);
  });
  it('keeps both SP option groups selectable for all three owners, separate from damage stats', () => {
    for (const slot of [0, 3, 6]) {
      expect([...getBadgeGroups(slot).values()].flat().some(row => row.Id === 2701)).toBe(true);
      expect([...getBadgeGroups(slot).values()].flat().some(row => row.Id === 2801)).toBe(true);
      expect(setBadgeOption(slot, 0, 2701)).toBe(true);
      expect(setBadgeOption(slot, 1, 2801)).toBe(true);
    }
    expect(decodeBadgeSp(GameData.charGemAttrValue['2701'])).toEqual({ main: true, value: .1 });
    expect(decodeBadgeSp(GameData.charGemAttrValue['2801'])).toEqual({ main: false, value: .135 });
    expect(getBadgeSpBonus('master', true)).toBeCloseTo(.1);
    expect(getBadgeSpBonus('assist1', false)).toBeCloseTo(.135);
    const html = renderBadgePanel(getState());
    expect(html).toContain('메인 SP 획득 효율');
    expect(html).toContain('지원 SP 획득 효율');
    expect(html).toContain('13.5%');
    expect(getBadgeStatSources().some(source => /ENERGY/.test(source.key))).toBe(false);
  });
  it('splits preset levels 7–9 into base six plus each owners 90 badge without double counting', () => {
    GameData.charPotentials = json('CharPotential');
    window.state.party = { master: { id: '103' }, assist1: { id: '107' }, assist2: { id: '112' } } as any;
    for (const [position, id, total, slot] of [['master', 510305, 7, 2], ['assist1', 510725, 8, 5], ['assist2', 511241, 9, 8]] as const) {
      expect(setPotentialTotalLevel(position, id, total)).toBe(true);
      expect(getState().potentialLevelOverrides[id]).toBe(6);
      expect(getBadgePotentialBonus(position, id)).toBe(total - 6);
      expect(setPotentialTotalLevel(position, id, total)).toBe(true);
      expect(getState().badgeOptions[slot]!.filter(Boolean)).toHaveLength(1);
    }
    expect(setPotentialTotalLevel('master', 510305, 9)).toBe(true);
    expect(getBadgePotentialBonus('master', 510305)).toBe(3);
    expect(setPotentialTotalLevel('master', 510305, 6)).toBe(true);
    expect(getBadgePotentialBonus('master', 510305)).toBe(0);
  });
  it('does not overwrite a full badge when importing another over-six potential', () => {
    GameData.charPotentials = json('CharPotential');
    window.state.party.master = { id: '103' } as any;
    getState().badgeOptions[2] = [201, 201, 201, 201];
    expect(setPotentialTotalLevel('master', 510305, 7)).toBe(false);
    expect(getState().badgeOptions[2]).toEqual([201, 201, 201, 201]);
  });
  it('offers skill level options only in the 80 badge and adds their actual levels', () => {
    expect(setBadgeOption(0, 0, 3501)).toBe(false);
    expect(setBadgeOption(1, 0, 3503)).toBe(true);
    expect(setBadgeOption(4, 0, 3702)).toBe(true);
    expect(getBadgeSkillBonus('master', 1)).toBe(3);
    expect(getBadgeSkillBonus('assist1', 3)).toBe(2);
    expect(getBadgeSkillBonus('master', 3)).toBe(0);
  });
  it('resolves main, support and common potential options for their own character', () => {
    GameData.charPotentials = json('CharPotential');
    GameData.potentials = json('Potential');
    window.state.party = { master: { id: '103' }, assist1: { id: '107' } } as any;
    window.state.characterLevelPhase = { assist1: 9 } as any;
    expect(getBadgePotentialId(GameData.charGemAttrValue['3901'], 2)).toBe(510305);
    expect(getBadgePotentialId(GameData.charGemAttrValue['4801'], 5)).toBe(510725);
    expect(getBadgePotentialId(GameData.charGemAttrValue['5701'], 5)).toBe(510741);
    expect(setBadgeOption(1, 0, 3901)).toBe(false);
    expect(setBadgeOption(2, 0, 3903)).toBe(true);
    expect(setBadgeOption(5, 0, 4802)).toBe(true);
    expect(getBadgePotentialBonus('master', 510305)).toBe(3);
    expect(getBadgePotentialBonus('assist1', 510725)).toBe(2);
    expect(getBadgePotentialBonus('master', 510725)).toBe(0);
    GameData.itemsKR = { 'Item.510305.1': '탐욕의 총화' };
    expect(renderBadgePanel(getState())).toContain('탐욕의 총화');
    expect(getPotentialStatBonuses('master')).toEqual([]);
    window.state.selectedPotentials = { master: [510305] } as any;
    window.state.potentialLevels = { master: { 510305: 2 } } as any;
    GameData.potentials[510305] = { ...GameData.potentials[510305], Param1: 'EffectValue,LevelUp,9000,EffectTypeParam1,HdPct', Param2: '', Param3: '', Param4: '' } as any;
    GameData.effectValue = { 9050: { EffectTypeFirstSubtype: 1, EffectTypeParam1: .5 } } as any;
    expect(getPotentialStatBonuses('master')[0]).toMatchObject({ level: 5, value: 5000 });
    expect(window.state.potentialLevels.master[510305]).toBe(2);
  });
  it('keeps support badge stats separate from the main trekker', () => {
    setBadgeOption(3, 0, 201);
    setBadgeOption(6, 0, 804);
    expect(getBadgeStatSources()).toEqual([]);
    const html = renderBadgePanel(getState());
    expect(html.match(/class="dmgcalc-badge-character"/g)).toHaveLength(3);
    expect(html.match(/class="dmgcalc-badge-slot"/g)).toHaveLength(9);
  });
  it('shows color quality names instead of raw rarity or overlock counters', () => {
    for (const [index, id] of [801, 802, 803, 804].entries()) setBadgeOption(0, index, id);
    const html = renderBadgePanel(getState());
    for (const color of ['green', 'blue', 'gold', 'rainbow']) expect(html).toContain(`is-${color}`);
    expect(html).toContain('badgeGradeGreen');
    expect(html).toContain('badgeGradeRainbow');
    expect(html).not.toContain('badgeOverlock');
    expect(html).not.toContain('badgeRarity');
    expect(html).toContain('15%');
    expect(html).toContain('<summary title=');
    expect(html).toContain('badge-value-pick');
    expect(html).not.toContain('<select data-action="badge-value"');
  });
  it('uses real flat and decimal-percent values with different units', () => {
    expect(decodeBadgeAttribute(GameData.charGemAttrValue['201'])).toMatchObject({ key: 'Atk', value: 70, isPercentage: false });
    expect(decodeBadgeAttribute(GameData.charGemAttrValue['501'])).toMatchObject({ key: 'Atk', value: 400, isPercentage: true });
    expect(decodeBadgeAttribute(GameData.charGemAttrValue['801'])).toMatchObject({ key: 'CritRate', value: 500, isPercentage: false });
    expect(decodeBadgeAttribute(GameData.charGemAttrValue['2401'])).toMatchObject({ key: 'MARKDMG', value: 2700 });
    expect(decodeBadgeAttribute(GameData.charGemAttrValue['3201'])).toMatchObject({ key: 'MARKCRITRATE', value: 500 });
  });
  it('excludes unverified skill/energy/potential effects rather than guessing', () => {
    for (const id of ['2701', '3501', '3901']) expect(decodeBadgeAttribute(GameData.charGemAttrValue[id])).toBeNull();
    expect(setBadgeOption(0, 0, 3901)).toBe(false);
    expect(setBadgeOption(0, 0, 99999999)).toBe(false);
    expect(setBadgeOption(9, 0, 201)).toBe(false);
    expect(setBadgeOption(0, -1, 201)).toBe(false);
  });
  it('deduplicates repeated option pools without discarding numeric choices', () => {
    const attack = getBadgeGroups().get('12:1:1')!;
    expect(attack.map(row => Number(row.Value))).toEqual([70, 88, 105, 210]);
  });
  it('aggregates options once and lets manual totals replace them', () => {
    expect(setBadgeOption(0, 0, 201)).toBe(true);
    expect(setBadgeOption(0, 1, 501)).toBe(true);
    const stats = aggregateAllStats(103, 90, 0);
    expect(stats.get('Atk')?.total).toBe(73); // 70 × 1.04, existing aggregation rounding
    expect(stats.get('Atk')?.sources).toHaveLength(2);
    expect(aggregateAllStats(103, 90, 0).get('Atk')?.total).toBe(73);
    setStatOverride('Atk', 1000);
    expect(aggregateAllStats(103, 90, 0).get('Atk')?.total).toBe(1000);
  });
  it('enforces slot unlock levels and clears badge choices on character change', () => {
    getState().masterLevel = 79;
    expect(setBadgeOption(0, 0, 201)).toBe(true);
    expect(setBadgeOption(1, 0, 201)).toBe(false);
    getState().masterLevel = 69;
    expect(getBadgeStatSources()).toEqual([]);
    setBuildInfo(107, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    expect(getState().badgeOptions).toEqual(Array.from({ length: 9 }, () => [0, 0, 0, 0]));
  });
});

describe('formula additions', () => {
  const hit = { displayName: 'test', skillPercent: 100, skillAbs: 0, damageType: 5, elementType: 2 };
  it('applies defense ignore before flat penetration and clamps defense at zero', () => {
    expect(calculateEffectiveDefenseMultiplier(500)).toBe(.5);
    expect(calculateEffectiveDefenseMultiplier(500, 2000, 100)).toBeCloseTo(1 - 12000 / 33600);
    expect(calculateEffectiveDefenseMultiplier(500, 10000, 100)).toBe(1);
    expect(calculateEffectiveDefenseMultiplier(500, 0, 1000)).toBe(1);
  });
  it('applies mark-specific crit chance only to mark hits', () => {
    updateEnemy({ def: 0, res: 0 });
    GameData.attributes = json('Attribute');
    setBadgeOption(0, 0, 3201);
    getState().stats = aggregateAllStats(103, 90, 0);
    expect(calculateSingleHitDamage(hit, 1000, 500, 15000, 1, 1).averageDamage).toBe(1050);
    expect(calculateSingleHitDamage({ ...hit, damageType: 1 }, 1000, 500, 15000, 1, 1).averageDamage).toBe(1025);
  });
  it('uses the actual hit element for target resistance', () => {
    updateEnemy({ def: 0, res: 0 });
    getState().enemy.elementalRes = { 1: 250, 2: 750 };
    expect(calculateSingleHitDamage(hit, 1000, 0, 15000, 1, 1).baseDamage).toBe(400);
    expect(calculateSingleHitDamage({ ...hit, elementType: 1 }, 1000, 0, 15000, 1, 1).baseDamage).toBe(750);
  });
});

describe('current raid target data', () => {
  const load = () => Object.fromEntries(Object.entries({ controls: 'ScoreBossControl', levels: 'ScoreBossLevel', monsters: 'Monster', adjustments: 'MonsterValueTempleteAdjust', templates: 'MonsterValueTemplete', skins: 'MonsterSkin', manuals: 'MonsterManual', text: 'KR/MonsterManual' }).map(([key, file]) => [key, json(file)]));
  it('resolves the real current two bosses, names, defense and per-element resistance', () => {
    const bosses = resolveEnemyPresets(load(), new Date('2026-10-25T12:00:00+09:00'));
    expect(bosses.map(boss => boss.name)).toEqual(['난폭한 헤비크랩', '심층의 주인']);
    expect(bosses[0]).toMatchObject({ def: 500, elementalRes: { 1: 250, 2: 250, 3: 2000 } });
    expect(bosses[1]).toMatchObject({ def: 500, elementalRes: { 4: 250, 5: 250, 6: 2000 } });
  });
  it('hides finished seasons the next day and never substitutes the latest expired season', () => {
    const controls = { a: { StartTime: '2026-10-01T00:00:00+09:00', EndTime: '2026-10-31T04:00:00+09:00' } };
    expect(findActiveRaid(controls, new Date('2026-10-31T23:59:00+09:00'))).toBeDefined();
    expect(findActiveRaid(controls, new Date('2026-11-01T00:00:00+09:00'))).toBeUndefined();
    expect(resolveEnemyPresets(load(), new Date('2030-01-01'))).toEqual([]);
  });
});

describe('staged calculator UI', () => {
  it('shows all three party portraits including a clear empty support slot', () => {
    window.state.party.assist1 = { id: '107' } as any;
    const html = renderCharacterCard(getState());
    expect(html).toContain('avg1_103_002.png');
    expect(html).toContain('avg1_107_002.png');
    expect(html).toContain('data-position="assist2"');
    expect(html).toContain('emptyCharacter');
    expect(html).not.toContain('calc-select-character');
  });
  it('renders six disc image slots with individual level and limit-break settings', () => {
    GameData.items = json('Item');
    (window as any).discsState = { selectedDiscs: { main1: { Id: 214067 } }, discNames: { 214067: 'Test disc' } };
    const html = renderDiscSummary();
    expect(html).toContain('assets/disc_icons/outfit_4067.png');
    expect(html.match(/class="dmgcalc-disc-card /g)).toHaveLength(6);
    expect(html.match(/class="disc-level-input"/g)).toHaveLength(6);
    expect(html).toContain('data-action="disc-lb-up" data-slot="sub3"');
    expect(html.match(/class="dmgcalc-disc-group-title"/g)).toHaveLength(2);
    expect(html.match(/class="dmgcalc-disc-grid"/g)).toHaveLength(2);
    expect(html).not.toContain('class="dmgcalc-card-role"');
  });
  it('uses each slot level independently when aggregating disc stats', () => {
    (window as any).discsState = { selectedDiscs: { main1: { Id: 1 }, main2: { Id: 2 }, sub1: { Id: 3 } } };
    GameData.discs = { 1: { AttrBaseGroupId: 10 }, 2: { AttrBaseGroupId: 10 }, 3: { AttrBaseGroupId: 10 } };
    GameData.attributes = { 10110: { Atk: 11 }, 10220: { Atk: 22 }, 10330: { Atk: 33 } };
    setDiscLevel(10, 'main1'); setDiscLevel(20, 'main2'); setDiscLevel(30, 'sub1');
    expect(aggregateAllStats(103, 90, 0).get('Atk')?.total).toBe(66);
    setDiscLevel(20, 'main1');
    expect(getState().discLevels.main2).toBe(20);
    expect(getState().discLevels.sub1).toBe(30);
    expect(aggregateAllStats(103, 90, 0).get('Atk')?.total).toBe(77);
  });
  it('renders original note icons alongside their level controls', () => {
    GameData.subNoteSkills = json('SubNoteSkill');
    getState().noteOverrides['90011'] = 1;
    const html = renderNotesSection(getState());
    expect(html).toContain('assets/common/note_90011_S.png');
    expect(html).toContain('dmgcalc-note-card is-active');
    expect(html).toContain('data-action="note-level-up"');
    expect(html).toContain('type="number" class="lvl-stepper-val dmgcalc-note-level');
    expect(html).toContain('data-note-id="90011" value="1" min="0" max="99"');
  });
  it('accepts directly entered note levels and clamps invalid ranges', () => {
    setNoteLevel('90012', 45);
    expect(getState().noteOverrides['90012']).toBe(45);
    setNoteLevel('90012', 100);
    expect(getState().noteOverrides['90012']).toBe(99);
    setNoteLevel('90012', -1);
    expect(getState().noteOverrides['90012']).toBe(0);
    setNoteLevel('90012', 45.8);
    expect(getState().noteOverrides['90012']).toBe(45);
    setNoteLevel('90012', Number.NaN);
    expect(getState().noteOverrides['90012']).toBe(45);
  });
  it('shows six full-width collapsible sections and existing preset controls', () => {
    const html = renderWizard(getState());
    expect(html.match(/<details class="dmgcalc-section"/g)).toHaveLength(6);
    expect(html).not.toContain('data-calc-section="1" open');
    expect(html).not.toContain('data-action="calc-step"');
    expect(html).toContain('calc-ingame-preset');
    expect(html).toContain('calc-saved-preset');
  });
  it('opens multiple sections independently and preserves selections when folded', () => {
    setStepExpanded(1, true);
    setBadgeOption(0, 0, 201);
    setStepExpanded(4, true);
    setStepExpanded(5, true);
    let html = renderWizard(getState());
    expect(html).toContain('data-calc-section="1" open');
    expect(html).toContain('data-calc-section="4" open');
    expect(html).toContain('data-calc-section="5" open');
    setStepExpanded(4, false);
    html = renderWizard(getState());
    expect(html).not.toContain('data-calc-section="4" open');
    expect(html).toContain('data-calc-section="5" open');
    expect(getState().badgeOptions[0]).toEqual([201, 0, 0, 0]);
    expect(getState().expandedSteps).toEqual([1, 5]);
  });
  it('allows all setup sections before selecting a main trekker and preserves their inputs', () => {
    resetState();
    getState().noteOverrides['90011'] = 7;
    setDiscLevel(60, 'main1');
    expect(setBadgeOption(2, 0, 201)).toBe(true);
    const html = renderWizard(getState());
    expect(html).toContain('calc-select-disc');
    expect(html).toContain('note-level-up');
    expect(html).not.toContain('badge-add');
    expect(html).not.toContain('badge-remove');
    expect(html.match(/<details class="dmgcalc-badge-row /g)).toHaveLength(36);
    expect(setBadgeOption(0, 4, 201)).toBe(false);
    expect(html).toContain('calc-enemy');
    setBuildInfo(103, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    expect(getState().badgeOptions[2]).toEqual([201, 0, 0, 0]);
    expect(getState().noteOverrides['90011']).toBe(7);
    expect(getState().discLevels.main1).toBe(60);
  });
  it('orders potential columns by main/support slots, not incoming buff order', () => {
    window.state.party = { master: { id: '103' }, assist1: { id: '107' }, assist2: { id: '112' } } as any;
    const buff = (id: number, name: string): BuffSource => ({ id: String(id), sourceCharId: id, sourceCharName: name, name: 'test', sourceName: 'test', description: '', buffId: 1, active: true, sourceType: 'potential', statEffects: [] });
    const html = renderPotentialArea([buff(112, 'Third'), buff(103, 'First'), buff(107, 'Second')]);
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
    expect(html.indexOf('Second')).toBeLessThan(html.indexOf('Third'));
  });
});
