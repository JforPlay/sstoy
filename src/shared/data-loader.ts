/**
 * Progressive data loading system
 * Loads only essential data upfront, then lazy-loads feature-specific data
 */

import { fetchJSON } from './index';

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
    ],

    // Character database features
    characterDB: [
      'data/CharacterArchive.json',
      'data/CharacterArchiveContent.json',
      'data/CharGetLines.json',
      'data/DatingCharacterEvent.json',
      'data/AffinityGift.json',
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
 * Load core data files (essential for initial render)
 * Should be called immediately on page load
 */
export async function loadCoreData(): Promise<void> {
  const promises = MANIFEST.core.map((path) => fetchJSON(path));
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

    const promises = files.map((path) => fetchJSON(path));
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
  const promises = files.map((file) => fetchJSON(`${dataPath}/${file}`));
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
