/**
 * Progressive data loading system
 * Loads only essential data upfront, then lazy-loads feature-specific data
 */

import { fetchJSON } from './network';
import { GameData } from './game-data';

/**
 * Mapping of JSON filenames to GameData properties
 */
const FILE_TO_PROPERTY_MAP: Record<string, keyof typeof GameData> = {
  'Character.json': 'characters',
  'Item.json': 'items',
  'GameEnums.json': 'gameEnums',
  'CharacterDes.json': 'characterDes',
  'CharPotential.json': 'charPotentials',
  'Potential.json': 'potentials',
  'Skill.json': 'skills',
  'EffectValue.json': 'effectValue',
  'HitDamage.json': 'hitDamage',
  'BuffValue.json': 'buffValue',
  'ShieldValue.json': 'shieldValue',
  'OnceAdditionalAttributeValue.json': 'onceAdditionalAttributeValue',
  'ScriptParameterValue.json': 'scriptParameterValue',
  'Attribute.json': 'attributes',
  'TalentGroup.json': 'talentGroups',
  'Talent.json': 'talents',
  'CharacterArchive.json': 'characterArchive',
  'CharacterArchiveContent.json': 'characterArchiveContent',
  'DatingCharacterEvent.json': 'datingEvents',
  'CharGetLines.json': 'charGetLines',
  'AffinityGift.json': 'affinityGifts',
  'Agent.json': 'agents',
  'CharGem.json': 'charGem',

  // Character Upgrade System
  'CharacterUpgrade.json': 'characterUpgrade',
  'CharacterSkillUpgrade.json': 'characterSkillUpgrade',
  'CharacterAdvance.json': 'characterAdvance',
  'CharRaritySequence.json': 'charRaritySequence',
  'CharItemExp.json': 'charItemExp',
  'StarTowerBuildRank.json': 'starTowerBuildRank',

  // Disc System
  'Disc.json': 'discs',
  'DiscIP.json': 'discIP',
  'MainSkill.json': 'mainSkills',
  'SecondarySkill.json': 'secondarySkills',
  'SubNoteSkill.json': 'subNoteSkills',
  'SubNoteSkillPromoteGroup.json': 'subNoteSkillPromote',
  'DiscItemExp.json': 'discItemExp',
  'DiscPromoteLimit.json': 'discPromoteLimit',
  'DiscStrengthen.json': 'discStrengthen',
  'DiscPromote.json': 'discPromote',
  'DiscExtraAttribute.json': 'discExtraAttribute',

  // Language Data (handled dynamically)
  // 'CN/Character.json' -> mapped to 'charactersKR' (assuming current lang structure)
};

/**
 * Data manifest defining core vs lazy-loaded files
 */
interface DataManifest {
  core: string[];
  lazy: {
    [feature: string]: string[];
  };
}

/**
 * Data manifest - defines what to load when
 * Core files: Essential data needed for initial render (< 200KB total)
 * Lazy files: Feature-specific data loaded on-demand
 */
const MANIFEST: DataManifest = {
  // Core files: Only IDs and essential metadata (loaded immediately)
  core: [
    'data/Character.json',
    'data/Item.json',
    'data/GameEnums.json',
  ],

  // Lazy-loaded files per feature
  lazy: {
    // Character builder features
    characterBuilder: [
      'data/CharacterDes.json',
      'data/CharPotential.json',
      'data/Potential.json',
      'data/Skill.json',
      'data/CharacterUpgrade.json',
      'data/CharacterSkillUpgrade.json',
      'data/CharacterAdvance.json',
      'data/CharRaritySequence.json',
      'data/CharItemExp.json',
      'data/EffectValue.json',
      'data/HitDamage.json',
      'data/BuffValue.json',
      'data/ShieldValue.json',
      'data/OnceAdditionalAttributeValue.json',
      'data/ScriptParameterValue.json',
      'data/Attribute.json',
      'data/StarTowerBuildRank.json',
      'data/CharGem.json',
    ],

    // Disc system features
    discSystem: [
      'data/Disc.json',
      'data/DiscIP.json',
      'data/MainSkill.json',
      'data/SecondarySkill.json',
      'data/SubNoteSkill.json',
      'data/SubNoteSkillPromoteGroup.json',
      'data/DiscItemExp.json',
      'data/DiscPromoteLimit.json',
      'data/DiscStrengthen.json',
      'data/DiscPromote.json',
      'data/DiscExtraAttribute.json',
      'data/Attribute.json',
    ],

    // Character database features
    characterDB: [
      'data/CharacterDes.json',
      'data/Attribute.json',
      'data/CharacterArchive.json',
      'data/CharacterArchiveContent.json',
      'data/CharGetLines.json',
      'data/DatingCharacterEvent.json',
      'data/AffinityGift.json',
      'data/TalentGroup.json',
      'data/Talent.json',
      'data/CharPotential.json',
      'data/Potential.json',
      'data/Skill.json',
      'data/EffectValue.json',
      'data/HitDamage.json',
      'data/BuffValue.json',
      'data/ShieldValue.json',
      'data/OnceAdditionalAttributeValue.json',
      'data/ScriptParameterValue.json',
    ],

    // Task assignment features
    taskSystem: [
      'data/Agent.json',
    ],
  },
};

/**
 * Cache for loaded feature data
 */
const loadedFeatures = new Set<string>();

/**
 * In-flight feature loading promises
 */
const loadingFeatures = new Map<string, Promise<void>>();

/**
 * Helper to process and assign loaded data to GameData
 */
function assignData(path: string, data: any, lang: string = ''): void {
  const filename = path.split('/').pop();
  if (!filename) return;

  // Check for explicit mapping
  if (FILE_TO_PROPERTY_MAP[filename]) {
    const key = FILE_TO_PROPERTY_MAP[filename];
    // If it's a language file, we might want to map it differently or merge
    // For now, we assume standard data files
    GameData[key] = data;
    return;
  }
  
  // Fallback: Store in a generic way if needed, or ignore
  // For this refactor, we only explicitly map known files to avoid pollution
}

/**
 * Load core data files (essential for initial render)
 * Should be called immediately on page load
 */
export async function loadCoreData(): Promise<void> {
  const promises = MANIFEST.core.map(async (path) => {
    const data = await fetchJSON(path);
    assignData(path, data);
  });
  await Promise.all(promises);
}

/**
 * Load feature-specific data files
 * Only loads once per feature (cached)
 */
export async function loadFeatureData(feature: string): Promise<void> {
  // Already loaded
  if (loadedFeatures.has(feature)) {
    return;
  }

  // Already loading
  if (loadingFeatures.has(feature)) {
    return loadingFeatures.get(feature);
  }

  // Feature doesn't exist
  if (!MANIFEST.lazy[feature]) {
    console.warn(`[DataLoader] Unknown feature: ${feature}`);
    return;
  }

  // Start loading
  const promise = (async () => {
    const files = MANIFEST.lazy[feature];
    if (!files) return;

    const promises = files.map(async (path) => {
      const data = await fetchJSON(path);
      assignData(path, data);
    });
    await Promise.all(promises);

    loadedFeatures.add(feature);
    loadingFeatures.delete(feature);
  })();

  loadingFeatures.set(feature, promise);
  return promise;
}

/**
 * Load language-specific data files
 * @param lang - Language code (KR, JP, EN, CN)
 * @param files - Array of file names to load (e.g., ['Character.json', 'Skill.json'])
 */
export async function loadLanguageData(lang: string, files: string[]): Promise<void> {
  const dataPath = `data/${lang}`;
  const promises = files.map(async (file) => {
    const path = `${dataPath}/${file}`;
    const data = await fetchJSON(path);
    
    // Logic to map language data to Specific KR properties
    // This mirrors the logic in characterdb.ts
    if (file === 'Character.json') GameData.charactersKR = data as any;
    else if (file === 'Item.json') GameData.itemsKR = data as any;
    else if (file === 'Skill.json') GameData.skillsKR = data as any;
    else if (file === 'Potential.json') GameData.potentialsKR = data as any;
    else if (file === 'CharacterDes.json') GameData.characterDesKR = data as any;
    else if (file === 'UIText.json') GameData.uiText = data as any;
    else if (file === 'DiscIP.json') GameData.discIPKR = data as any;
    else if (file === 'MainSkill.json') GameData.mainSkillsKR = data as any;
    else if (file === 'SecondarySkill.json') GameData.secondarySkillsKR = data as any;
    else if (file === 'SubNoteSkill.json') GameData.subNoteSkillsKR = data as any;
    else if (file === 'TalentGroup.json') GameData.talentGroupsKR = data as any;
    else if (file === 'Talent.json') GameData.talentsKR = data as any;
    else if (file === 'CharacterTag.json') GameData.characterTagKR = data as any;
    else if (file === 'DiscTag.json') GameData.discTagKR = data as any;
    else if (file === 'DatingLandmark.json') GameData.datingLandmarkKR = data as any;
    else if (file === 'DatingBranch.json') GameData.datingBranchKR = data as any;
    else if (file === 'CharGetLines.json') GameData.charGetLinesKR = data as any;
    else if (file === 'CharacterArchiveContent.json') GameData.characterArchiveContentKR = data as any;
    else if (file === 'Agent.json') GameData.agentsKR = data as any;
    // Add more mappings as needed
  });
  await Promise.all(promises);
}

/**
 * Preload feature data in the background (low priority)
 * Useful for features likely to be used soon
 */
export function preloadFeatureData(feature: string): void {
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadFeatureData(feature).catch((err) => {
        console.warn(`[DataLoader] Failed to preload ${feature}:`, err);
      });
    });
  } else {
    setTimeout(() => {
      loadFeatureData(feature).catch((err) => {
        console.warn(`[DataLoader] Failed to preload ${feature}:`, err);
      });
    }, 100);
  }
}

/**
 * Check if feature data is loaded
 */
export function isFeatureLoaded(feature: string): boolean {
  return loadedFeatures.has(feature);
}

/**
 * Get all available features
 */
export function getAvailableFeatures(): string[] {
  return Object.keys(MANIFEST.lazy);
}
