import { fetchJSON } from '@/shared/network';
import { getState } from './state';

export interface EnemyPreset {
  id: number;
  name: string;
  def: number;
  level: number;
  elementalRes: Record<number, number>;
}

let presets: EnemyPreset[] = [];
let loadError = false;
export function getEnemyPresets(): EnemyPreset[] { return presets; }
export function hasEnemyLoadError(): boolean { return loadError; }

/** Matches the guide's policy: hide a season starting the day after its end. */
export function findActiveRaid(controls: Record<string, any>, now = new Date()): any | undefined {
  return Object.values(controls).filter(control => {
    const start = Date.parse(control.StartTime);
    const end = new Date(control.EndTime);
    end.setHours(24, 0, 0, 0);
    return Number.isFinite(start) && now.getTime() >= start && now.getTime() < end.getTime();
  }).sort((a, b) => Date.parse(b.StartTime) - Date.parse(a.StartTime))[0];
}

export function resolveEnemyPresets(data: Record<string, any>, now = new Date()): EnemyPreset[] {
  const control = findActiveRaid(data.controls, now);
  if (!control) return [];
  return (control.LevelGroup as number[]).flatMap(id => {
    const level = data.levels[String(id)];
    const monster = data.monsters[String(level?.MonsterId)];
    const adjust = data.adjustments[String(monster?.Templete)];
    const template = Object.values(data.templates).filter((row: any) => row.TemplateId === adjust?.TemplateId)
      .sort((a: any, b: any) => a.Lv - b.Lv)[0] as any;
    if (!template || !Number.isFinite(template.Def)) return [];
    const skin = data.skins[String(monster.FAId)];
    const manual = data.manuals[String(skin?.MonsterManual)];
    const name = data.text[manual?.Name] || `#${level.MonsterId}`;
    const elementalRes: Record<number, number> = {};
    for (const [i, key] of ['WER', 'FER', 'SER', 'AER', 'LER', 'DER'].entries()) {
      const value = adjust?.[`${key}Fix`] ?? template[key] ?? 0;
      if (!Number.isFinite(value)) return [];
      elementalRes[i + 1] = value;
    }
    return [{ id: level.Id, name, def: template.Def, level: template.Lv, elementalRes }];
  });
}

export async function loadEnemyPresets(): Promise<void> {
  const lang = window.i18n?.currentLang || 'KR';
  const files = {
    controls: 'ScoreBossControl.json', levels: 'ScoreBossLevel.json',
    monsters: 'Monster.json', skins: 'MonsterSkin.json', manuals: 'MonsterManual.json',
    adjustments: 'MonsterValueTempleteAdjust.json', templates: 'MonsterValueTemplete.json', text: `${lang}/MonsterManual.json`
  };
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await fetchJSON(`data/${file}`)]));
    presets = resolveEnemyPresets(Object.fromEntries(entries));
    loadError = false;
    // Revalidate a previously selected season after data/language changes.
    const selected = getState().enemyPresetId;
    if (selected !== null && !presets.some(preset => preset.id === selected)) selectEnemyPreset(null);
  } catch (error) {
    presets = [];
    loadError = true;
    console.error('[DamageCalculator] Failed to load raid targets', error);
    selectEnemyPreset(null);
  }
}

export function selectEnemyPreset(id: number | null): void {
  const state = getState();
  const preset = presets.find(item => item.id === id);
  state.enemyPresetId = preset?.id ?? null;
  if (preset) {
    state.enemy = { def: preset.def, res: 0, level: preset.level, elementalRes: { ...preset.elementalRes }, toughnessBroken: false };
  } else {
    // Preserve the selected element's resistance as a starting manual value.
    const element = Number((window as any).GameData?.characters?.[state.masterCharId!]?.EET) || 1;
    state.enemy.res = state.enemy.elementalRes?.[element] ?? state.enemy.res;
    delete state.enemy.elementalRes;
  }
}
