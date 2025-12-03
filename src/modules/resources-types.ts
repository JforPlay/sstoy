/**
 * Resources Module - Types
 */

import type { CharacterData, Disc, GameEnums } from '../types';
export type { CharacterData, Disc, GameEnums };

export interface MaterialGroup {
  items: number[];
  mergeRatio: number;
  type?: 'advanceItems' | 'skillItems' | 'discAdvanceItems';
}

export interface StaminaConfig {
  dailyTaskReward: number;
  dungeonDrop: number;
  dungeonStamina: number;
}

export interface CharacterUpgrade {
  Exp?: number;
  [key: string]: unknown;
}

export interface CharacterAdvance {
  Group?: number;
  AdvanceLvl?: number;
  GoldQty?: number;
  Tid1?: number;
  Qty1?: number;
  Tid2?: number;
  Qty2?: number;
  Tid3?: number;
  Qty3?: number;
  Tid4?: number;
  Qty4?: number;
  [key: string]: unknown;
}

export interface CharacterSkillUpgrade {
  Id: number;
  Group?: number;
  AdvanceNum?: number;
  GoldQty?: number;
  Tid1?: number;
  Qty1?: number;
  Tid2?: number;
  Qty2?: number;
  Tid3?: number;
  Qty3?: number;
  Tid4?: number;
  Qty4?: number;
  [key: string]: unknown;
}

export interface CharItemExp {
  ItemId: number;
  ExpValue: number;
}

export interface CharGem {
  GenerateCostTid?: number;
  [key: string]: unknown;
}

export interface DiscStrengthen {
  Exp?: number;
  [key: string]: unknown;
}

export interface DiscPromote {
  ExpenseGold?: number;
  ItemId1?: number;
  Num1?: number;
  ItemId2?: number;
  Num2?: number;
  ItemId3?: number;
  Num3?: number;
  [key: string]: unknown;
}

export interface DiscItemExp {
  ItemId: number;
  Exp: number;
}

export interface DiscIP {
  StoryName?: string;
  [key: string]: unknown;
}

export interface Item {
  Id: number;
  Title?: string;
  Icon?: string;
  Rarity?: number;
  [key: string]: unknown;
}

export interface SelectedCharacter {
  id: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  skillLevels: {
    normal: { current: number; target: number };
    main: { current: number; target: number };
    assist: { current: number; target: number };
    ultimate: { current: number; target: number };
  };
}

export interface SelectedDisc {
  id: string;
  name: string;
  rarity: number;
  currentLevel: number;
  targetLevel: number;
  data: Disc;
}

export interface CharacterResources {
  exp: number;
  expItems: Record<number, number>;
  skillItems: Record<number, number>;
  advanceItems: Record<number, number>;
  gold: number;
  levelupGold: number;
}

export interface DiscResources {
  exp: number;
  advanceItems: Record<number, number>;
  gold: number;
  levelupGold: number;
}

export interface TotalResources {
  exp: number;
  advanceItems: Record<number, number>;
  skillItems: Record<number, number>;
  discAdvanceItems?: Record<number, number>;
  gold: number;
  levelupGold: number;
}

export interface ResourcesState {
  characters: Record<string, CharacterData & { AdvanceGroup?: number; SkillsUpgradeGroup?: number[]; GemSlots?: number[] }>;
  characterNames: Record<string, string>;
  characterUpgrade: Record<string, CharacterUpgrade>;
  characterSkillUpgrade: Record<string, CharacterSkillUpgrade>;
  characterAdvance: Record<string, CharacterAdvance>;
  charItemExp: Record<string, CharItemExp>;
  charGem: Record<string, CharGem>;
  discs: Record<string, Disc & { PromoteGroupId?: number; StrengthenGroupId?: number }>;
  discStrengthen: Record<string, DiscStrengthen>;
  discPromote: Record<string, DiscPromote>;
  discItemExp: Record<string, DiscItemExp>;
  discIP: Record<string, DiscIP>;
  discIPNames: Record<string, string>;
  gameEnums: GameEnums;
  items: Record<string, Item>;
  itemNames: Record<string, string>;
  selectedCharacters: SelectedCharacter[];
  selectedDiscs: SelectedDisc[];
  ownedMaterials: Record<string, number>;
  characterResources: Record<string, CharacterResources>;
  discResources: Record<string, DiscResources>;
  itemUsageIndex: Record<string, { characters: string[]; discs: string[] }>;
  currentElementFilter: string;
  currentSearchFilter: string;
  characterSelectorFuse: any;
}
