/**
 * Resources Module - Calculations
 */

import { resourcesState, MATERIAL_GROUPS, STAMINA_CONFIG } from './resources-state';
import type { CharacterResources, CharacterAdvance, CharacterSkillUpgrade, DiscPromote, TotalResources, SelectedCharacter, SelectedDisc } from './resources-types';

export function calculateCharacterResources(characterId: string): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  const character = resourcesState.characters[characterId];

  if (!selectedChar || !character) return;

  const resources: CharacterResources = {
    exp: 0,
    expItems: {},
    skillItems: {},
    advanceItems: {},
    gold: 0,
    levelupGold: 0,
  };

  const currentLevel = selectedChar.currentLevel;
  const targetLevel = selectedChar.targetLevel;

  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    const levelId = 10000 + level;
    const levelData = resourcesState.characterUpgrade[levelId];
    if (levelData && levelData.Exp) {
      resources.exp += levelData.Exp;
    }
  }

  resources.levelupGold = Math.round((resources.exp / 1000) * 150);

  const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];
  const advanceGroup = character.AdvanceGroup;

  if (advanceGroup) {
    advanceLevels.forEach((advLevel) => {
      if (targetLevel >= advLevel && currentLevel < advLevel) {
        const advanceLvl = advLevel / 10;

        const advanceData = Object.values(resourcesState.characterAdvance).find(
          (adv) => adv.Group === advanceGroup && adv.AdvanceLvl === advanceLvl
        );

        if (advanceData) {
          if (advanceData.GoldQty) {
            resources.gold += advanceData.GoldQty;
          }

          for (let i = 1; i <= 4; i++) {
            const tidKey = `Tid${i}` as keyof CharacterAdvance;
            const qtyKey = `Qty${i}` as keyof CharacterAdvance;

            if (advanceData[tidKey] && advanceData[qtyKey]) {
              const itemId = advanceData[tidKey] as number;
              const qty = advanceData[qtyKey] as number;

              if (!resources.advanceItems[itemId]) {
                resources.advanceItems[itemId] = 0;
              }
              resources.advanceItems[itemId] += qty;
            }
          }
        }
      }
    });
  }

  const skillTypes = ['normal', 'main', 'assist', 'ultimate'] as const;
  const skillUpgradeGroups = character.SkillsUpgradeGroup || [];

  skillTypes.forEach((skillType, index) => {
    const skillGroup = skillUpgradeGroups[index];
    if (!skillGroup) return;

    const currentSkillLevel = selectedChar.skillLevels[skillType].current;
    const targetSkillLevel = selectedChar.skillLevels[skillType].target;

    const skillUpgrades = Object.values(resourcesState.characterSkillUpgrade)
      .filter((upgrade) => upgrade.Group === skillGroup)
      .sort((a, b) => a.Id - b.Id);

    for (let level = currentSkillLevel; level < targetSkillLevel; level++) {
      const upgrade = skillUpgrades[level];

      if (upgrade) {
        if (upgrade.GoldQty) {
          resources.gold += upgrade.GoldQty;
        }

        for (let i = 1; i <= 4; i++) {
          const tidKey = `Tid${i}` as keyof CharacterSkillUpgrade;
          const qtyKey = `Qty${i}` as keyof CharacterSkillUpgrade;

          if (upgrade[tidKey] && upgrade[qtyKey]) {
            const itemId = upgrade[tidKey] as number;
            const qty = upgrade[qtyKey] as number;

            if (!resources.skillItems[itemId]) {
              resources.skillItems[itemId] = 0;
            }
            resources.skillItems[itemId] += qty;
          }
        }
      }
    }
  });

  resourcesState.characterResources[characterId] = resources;
}

export function calculateDiscResources(discId: string): void {
  const disc = resourcesState.selectedDiscs.find((d) => d.id === discId);
  if (!disc) return;

  const currentLevel = disc.currentLevel;
  const targetLevel = disc.targetLevel;
  const rarity = disc.rarity;

  let totalExp = 0;
  const expGroupPrefix = rarity === 5 ? 41 : rarity === 4 ? 31 : 11;

  for (let level = currentLevel; level < targetLevel; level++) {
    const strengthenId = `${expGroupPrefix}${String(level + 1).padStart(3, '0')}`;
    const strengthenData = resourcesState.discStrengthen[strengthenId];
    if (strengthenData && strengthenData.Exp) {
      totalExp += strengthenData.Exp;
    }
  }

  const advanceItems: Record<number, number> = {};
  let advanceGold = 0;
  const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];

  advanceLevels.forEach((advLevel, index) => {
    if (currentLevel < advLevel && targetLevel >= advLevel) {
      const promoteGroupId = disc.data.PromoteGroupId;
      const advanceNum = index + 1;
      const promoteId = `${promoteGroupId}${String(advanceNum).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        if (promoteData.ExpenseGold) {
          advanceGold += promoteData.ExpenseGold;
        }

        for (let i = 1; i <= 3; i++) {
          const itemIdKey = `ItemId${i}` as keyof DiscPromote;
          const numKey = `Num${i}` as keyof DiscPromote;

          if (promoteData[itemIdKey]) {
            const itemId = promoteData[itemIdKey] as number;
            const qty = (promoteData[numKey] as number) || 0;

            if (qty > 0) {
              if (!advanceItems[itemId]) {
                advanceItems[itemId] = 0;
              }
              advanceItems[itemId] += qty;
            }
          }
        }
      }
    }
  });

  const levelupGold = Math.round((totalExp / 1000) * 250);

  resourcesState.discResources[discId] = {
    exp: totalExp,
    advanceItems,
    gold: advanceGold,
    levelupGold,
  };
}

export function calculateNetResourcesWithMerging(
  totalResources: TotalResources,
  ownedMaterials: Record<string, number>
): TotalResources {
  const netResources: TotalResources = {
    advanceItems: { ...totalResources.advanceItems },
    skillItems: { ...totalResources.skillItems },
    discAdvanceItems: { ...(totalResources.discAdvanceItems || {}) },
    exp: totalResources.exp,
    gold: totalResources.gold,
    levelupGold: totalResources.levelupGold,
  };

  const allMaterialGroups = [
    ...(MATERIAL_GROUPS.advance || []).map((g) => ({ ...g, type: 'advanceItems' as const })),
    ...(MATERIAL_GROUPS.skill || []).map((g) => ({ ...g, type: 'skillItems' as const })),
    ...(MATERIAL_GROUPS.discAdvance || []).map((g) => ({ ...g, type: 'discAdvanceItems' as const })),
  ];

  for (const group of allMaterialGroups) {
    let leftover = 0;
    for (let i = 0; i < group.items.length; i++) {
      const itemId = group.items[i]!;
      const resourceType = netResources[group.type] as Record<number, number>;
      const required = totalResources[group.type]?.[itemId] || 0;
      if (required === 0 && !ownedMaterials[itemId]) continue;

      const owned = (ownedMaterials[itemId] || 0) + leftover;
      const net = required - owned;

      if (net > 0) {
        resourceType[itemId] = net;
        leftover = 0;
      } else {
        resourceType[itemId] = 0;
        leftover = Math.floor(-net / group.mergeRatio);
      }
    }
  }

  for (const type of ['advanceItems', 'skillItems', 'discAdvanceItems'] as const) {
    const resourceType = netResources[type] as Record<number, number> | undefined;
    if (resourceType) {
      for (const itemId in resourceType) {
        const numId = parseInt(itemId);
        if (resourceType[numId] && resourceType[numId] <= 0) {
          delete resourceType[numId];
        }
      }
    }
  }

  return netResources;
}

export function calculateTotalOwnedExp(expType: 'character' | 'disc'): number {
  let totalOwnedExp = 0;
  const itemExpData =
    expType === 'character' ? resourcesState.charItemExp : resourcesState.discItemExp;
  const itemExpMap: Record<number, number> = {};

  Object.values(itemExpData).forEach((item) => {
    itemExpMap[item.ItemId] =
      expType === 'character' ? (item as any).ExpValue : (item as any).Exp;
  });

  for (const itemId in resourcesState.ownedMaterials) {
    if (itemExpMap[parseInt(itemId)]) {
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const expValue = itemExpMap[parseInt(itemId)];
      if (expValue !== undefined) {
        totalOwnedExp += ownedQty * expValue;
      }
    }
  }
  return totalOwnedExp;
}

export function buildItemUsageIndex(): void {
  resourcesState.itemUsageIndex = {};

  Object.entries(resourcesState.characterResources).forEach(([charId, resources]) => {
    const allItems = {
      ...resources.advanceItems,
      ...resources.skillItems,
    };

    Object.keys(allItems).forEach((itemId) => {
      if (!resourcesState.itemUsageIndex[itemId]) {
        resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
      }
      resourcesState.itemUsageIndex[itemId].characters.push(charId);
    });
  });

  Object.entries(resourcesState.discResources).forEach(([discId, resources]) => {
    Object.keys(resources.advanceItems || {}).forEach((itemId) => {
      if (!resourcesState.itemUsageIndex[itemId]) {
        resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
      }
      resourcesState.itemUsageIndex[itemId].discs.push(discId);
    });
  });
}

export function convertToLowestTier(
  itemId: string | number,
  quantity: number
): { lowestItemId: number; convertedQuantity: number } | null {
  const allGroups = [
    ...(MATERIAL_GROUPS.advance || []),
    ...(MATERIAL_GROUPS.skill || []),
    ...(MATERIAL_GROUPS.discAdvance || [])
  ];
  for (const group of allGroups) {
    const itemIndex = group.items.indexOf(parseInt(String(itemId)));
    if (itemIndex !== -1) {
      const multiplier = Math.pow(group.mergeRatio, itemIndex);
      const lowestItemId = group.items[0];
      if (lowestItemId === undefined) continue;
      return {
        lowestItemId,
        convertedQuantity: quantity * multiplier,
      };
    }
  }
  return null;
}

export function calculateStaminaEstimate(
  items: Record<number | string, number>,
  type: string
): { estimatedStamina: number; estimatedDays: number; totalLowestTierCount: number } | null {
  const config = STAMINA_CONFIG[type];
  if (!config) return null;

  let totalLowestTierCount = 0;

  for (const [itemId, qty] of Object.entries(items)) {
    const conversion = convertToLowestTier(itemId, qty);
    if (conversion) {
      totalLowestTierCount += conversion.convertedQuantity;
    }
  }

  if (totalLowestTierCount === 0) return null;

  const dungeonRuns = Math.ceil(totalLowestTierCount / config.dungeonDrop);
  const estimatedStamina = dungeonRuns * config.dungeonStamina;
  const estimatedDays = Math.ceil(totalLowestTierCount / config.dailyTaskReward);

  return {
    estimatedStamina,
    estimatedDays,
    totalLowestTierCount,
  };
}

export function getCharactersUsingItem(itemId: string): SelectedCharacter[] {
  if (resourcesState.itemUsageIndex[itemId]?.characters) {
    return resourcesState.itemUsageIndex[itemId].characters
      .map((charId) => resourcesState.selectedCharacters.find((c) => c.id === charId))
      .filter((c): c is SelectedCharacter => c !== undefined);
  }
  return [];
}

export function getDiscsUsingItem(itemId: string): SelectedDisc[] {
  if (resourcesState.itemUsageIndex[itemId]?.discs) {
    return resourcesState.itemUsageIndex[itemId].discs
      .map((discId) => resourcesState.selectedDiscs.find((d) => d.id === discId))
      .filter((d): d is SelectedDisc => d !== undefined);
  }
  return [];
}

export function isGroupedMaterial(itemId: string | number, type: string): boolean {
  const groups = MATERIAL_GROUPS[type];
  if (!groups) return false;
  return groups.some((group) => group.items.includes(parseInt(String(itemId))));
}
