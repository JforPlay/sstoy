/**
 * Core type definitions for Stella Sora Tools
 */

// =============================================================================
// POSITION & COMMON TYPES
// =============================================================================

export type Position = 'master' | 'assist1' | 'assist2';
export type DescriptionMode = 'brief' | 'detailed';
export type MainTab = 'characters' | 'discs' | 'summary' | 'preset' | 'dmgcalc';

// =============================================================================
// CHARACTER TYPES
// =============================================================================

export interface CharacterData {
  Id: string;
  EET: number;  // Element type
  Rarity: number;
  Name?: string;
  [key: string]: unknown;
}

export interface SkillData {
  id: number;
  icon?: string;
  name?: string;
  title?: string;
  briefDesc?: string;
  desc?: string;
  cd?: number;
  MaxLevel?: number;
  data?: Record<string, unknown>;
}

export interface CharacterSkills {
  normalAtk?: SkillData;
  skill?: SkillData;
  ultimate?: SkillData;
  dodge?: SkillData;
  specialSkill?: SkillData;
  masterSkill?: SkillData;
}

export interface PotentialData {
  Id: number;
  Stype: number;  // 41 = normal, 42 = specific
  MaxLevel?: number;
  Icon?: string;
  Name?: string;
  BriefDesKey?: string;
  DesKey?: string;
  [key: string]: unknown;
}

// =============================================================================
// DISC TYPES
// =============================================================================

export type DiscSlotId = 'main1' | 'main2' | 'main3' | 'sub1' | 'sub2' | 'sub3';

export interface Disc {
  Id: number;
  EET: number;  // Element type
  Visible: boolean;
  DiscBg?: string;
  MainSkillGroupId?: number;
  SecondarySkillGroupId1?: number;
  SecondarySkillGroupId2?: number;
  SubNoteSkillGroupId?: number;
  [key: string]: unknown;
}

export interface DiscIP {
  Id: number;
  StoryName: string;
  [key: string]: unknown;
}

export interface Item {
  Id: number;
  Icon?: string;
  Rarity?: number;
  [key: string]: unknown;
}

export interface MainSkill {
  Id: string;
  Name: string;
  Desc: string;
  Level: number;
  Icon?: string;
  IconBg?: string;
  Param1?: string;
  Param2?: string;
  Param3?: string;
  Param4?: string;
  Param5?: string;
  Param6?: string;
  Param7?: string;
  Param8?: string;
  Param9?: string;
  Param10?: string;
  [key: string]: unknown;
}

export interface SecondarySkill {
  Id: string;
  Name: string;
  Desc: string;
  Level: number;
  Score?: number;
  Icon?: string;
  IconBg?: string;
  NeedSubNoteSkills?: string;  // JSON string of note requirements
  Param1?: string;
  Param2?: string;
  Param3?: string;
  Param4?: string;
  Param5?: string;
  Param6?: string;
  Param7?: string;
  Param8?: string;
  Param9?: string;
  Param10?: string;
  [key: string]: unknown;
}

export interface SubNoteSkill {
  Id: string;
  Name: string;
  BriefDesc: string;
  Desc: string;
  Icon?: string;
  Param2?: string;
  Scores?: number[];
  [key: string]: unknown;
}

export interface SubNoteSkillPromoteGroup {
  Id: string;
  GroupId: number;
  Phase?: number;
  SubNoteSkills?: string;  // JSON string of note contributions
  [key: string]: unknown;
}

export interface EffectValue {
  Id: string;
  EffectTypeParam1?: number | string;
  [key: string]: unknown;
}

export interface GameEnums {
  elementType?: Record<number, { name: string; icon: string }>;
  itemRarity?: Record<number, { key: string; stars: number }>;
  [key: string]: unknown;
}

// Legacy interfaces for compatibility
export interface DiscData {
  Id: string;
  EET: number;  // Element type
  DiscType: number;  // 1 = main, 2 = sub
  Icon?: string;
  Name?: string;
  [key: string]: unknown;
}

export interface DiscSelection {
  discId: string;
  limitBreak?: number;  // 1-5 for main discs
  level?: number;       // 0-8 for sub discs
}

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Minimal interface for parameter parsing
 * Both CharacterState and CharacterDBState must satisfy this
 */
export interface ParamParserState {
  // Required data sources for parameter parsing
  effectValue: Record<string, unknown>;
  buffValue: Record<string, unknown>;
  shieldValue: Record<string, unknown>;
  hitDamage: Record<string, unknown>;
  onceAdditionalAttributeValue: Record<string, unknown>;
  scriptParameterValue: Record<string, unknown>;

  // Optional data sources
  gameEnums?: Record<string, unknown>;
  uiText?: Record<string, string>;
  skills?: Record<string, unknown>;
  skillsKR?: Record<string, unknown>;
}

export interface CharacterState extends ParamParserState {
  // Party composition
  party: Record<Position, { id: string; name: string; data: CharacterData } | null>;

  // Skill levels per position
  skillLevels: Record<Position, Record<number, number>>;

  // Selected potentials per position
  selectedPotentials: Record<Position, number[]>;

  // Potential levels per position
  potentialLevels: Record<Position, Record<number, number>>;

  // Potential marks (essential, recommended, minimum, low)
  potentialMarks: Record<Position, Record<number, PotentialMark>>;

  // Character level phase (0-8) per position
  characterLevelPhase: Record<Position, number>;

  // Description display mode
  descriptionMode: DescriptionMode;

  // Data caches
  characters: Record<string, CharacterData>;
  potentials: Record<number, PotentialData>;
  skills: Record<number, SkillData>;
  items: Record<number, Item>;
  characterNames: Record<string, string>;
  potentialNames: Record<string, string>;
  itemNames: Record<string, string>;
  skillNames: Record<string, string>;

  // Data sources for parameter parsing
  effectValue: Record<string, unknown>;
  buffValue: Record<string, unknown>;
  shieldValue: Record<string, unknown>;
  hitDamage: Record<string, unknown>;
  onceAdditionalAttributeValue: Record<string, unknown>;
  scriptParameterValue: Record<string, unknown>;
  gameEnums: Record<string, unknown>;
  uiText?: Record<string, string>;

  // UI state
  characterSelector: {
    fuse: unknown;  // Fuse.js instance
    currentFilter: string;
  };
}

export interface DiscState {
  // Data caches
  allDiscs: Disc[];
  discNames: Record<number, string>;
  itemData: Record<number, Item>;
  gameEnums: GameEnums;
  mainSkillData: Record<string, MainSkill>;
  secondarySkillData: Record<string, SecondarySkill>;
  mainSkillKRData: Record<string, string>;
  secondarySkillKRData: Record<string, string>;
  subNoteSkillPromoteData: Record<string, SubNoteSkillPromoteGroup>;
  subNoteSkillData: Record<string, SubNoteSkill>;
  subNoteSkillKRData: Record<string, string>;
  effectValueData: Record<string, EffectValue>;

  // Disc selections
  selectedDiscs: Record<DiscSlotId, Disc | null>;

  // Limit breaks (1-6 for main discs)
  discLimitBreaks: Record<DiscSlotId, number>;

  // Sub disc levels (Phase 0-8)
  subDiscLevels: {
    sub1: number;
    sub2: number;
    sub3: number;
  };

  // Acquired notes (manual)
  acquiredNotes: Record<string, number>;

  // Current slot being edited
  currentSlot: DiscSlotId | null;

  // Required notes by main disc secondary skills
  requiredNotes: Set<string>;

  // Disc selector UI state
  discSelector: {
    allDiscsWithNames: Array<{ disc: Disc; name: string; id: string }>;
    fuse: unknown;
    selectedElement: string;
    searchListener: ((e: Event) => void) | null;
  };
}

export type PotentialMark = 'essential' | 'recommended' | 'minimum' | 'low' | null;

// =============================================================================
// PARAMETER PARSING TYPES
// =============================================================================

export type LevelType = 'LevelUp' | 'NoLevel' | 'DamageNum';

export type FormatType =
  | 'HdPct'
  | '10KHdPct'
  | '10K'
  | '10KPct'
  | 'Enum'
  | 'Fixed'
  | 'Text';

export type FileType =
  | 'effect'
  | 'buff'
  | 'shield'
  | 'damage'
  | 'onceAdditional'
  | 'scriptParam';

export interface ParsedParam {
  fileType: FileType;
  levelType: LevelType;
  baseId: string;
  fieldKey?: string;
  formatType?: FormatType;
  enumType?: string;
}

export interface ParseResult {
  value: string | number;
  levelType?: LevelType | null;
  color?: string;
}

// =============================================================================
// SAVE/LOAD TYPES
// =============================================================================

export interface SavedBuild {
  version: string;
  title: string;
  memo?: string;
  timestamp: number;

  // Character data
  party: Record<Position, string | null>;
  skillLevels: Record<Position, Record<number, number>>;
  selectedPotentials: Record<Position, number[]>;
  potentialLevels: Record<Position, Record<number, number>>;
  potentialMarks: Record<Position, Record<number, PotentialMark>>;
  characterLevelPhase: Record<Position, number>;

  // Disc data
  mainDiscs: (DiscSelection | null)[];
  subDiscs: (DiscSelection | null)[];
  noteLevels: Record<string, number>;
}

export interface PresetBuild {
  id: string;
  title: string;
  author?: string;
  authorLink?: string;
  element?: number;
  tags?: string[];
  characters: Record<Position, string | null>;
  // ... other build data
}

// =============================================================================
// I18N TYPES
// =============================================================================

export type GameLanguage = 'KR' | 'EN' | 'JP' | 'CN';
export type UILanguage = 'ko' | 'en' | 'jp';

export interface I18n {
  currentLang: GameLanguage;
  uiLang: UILanguage;
  translations: Record<string, unknown>;

  init(): Promise<void>;
  setLanguage(lang: GameLanguage): Promise<void>;
  t(key: string): string;
  getDataPath(lang?: GameLanguage): string;
  getUILang(lang?: GameLanguage): UILanguage;
  updatePage(): void;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

export interface LRUCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  clear(): void;
  size: number;
}

// =============================================================================
// DOM ELEMENT TYPES
// =============================================================================

export interface ActionElement extends HTMLElement {
  dataset: DOMStringMap & {
    action?: string;
    position?: Position;
    potentialId?: string;
    skillId?: string;
    characterId?: string;
    discId?: string;
    tab?: MainTab;
    element?: string;
    delta?: string;
    maxLevel?: string;
    [key: string]: string | undefined;
  };
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

type CompressionLib = Pick<
  typeof import('fflate'),
  'deflateSync' | 'inflateSync' | 'strToU8' | 'strFromU8'
>;

declare global {
  interface Window {
    // State objects
    state: CharacterState;
    discsState: DiscState;
    i18n?: I18n;

    // Shared utilities
    appUtils: {
      fetchJSONCached: (path: string) => Promise<unknown>;
      clearJSONCache: (prefix?: string) => void;
      log: (...args: unknown[]) => void;
      debounce: <T extends (...args: unknown[]) => unknown>(fn: T, wait?: number) => T;
    };

    // Audio player
    AudioPlayer?: {
      play: (audioPath: string) => Promise<void>;
      pause: () => void;
      stop: () => void;
      setVolume: (volume: number) => void;
      getVolume: () => number;
      getCurrentTrack: () => string | null;
      isPlaying: () => boolean;
      onPlaybackEnd: (callback: () => void) => void;
      clearEndCallbacks: () => void;
    };
    // Data loading functions
    loadFeatureData?: (feature: string) => Promise<void>;

    // Character module functions
    switchMainTab: (tab: MainTab) => void;
    isDataLoaded: () => boolean;
    updateCharacterCard?: (position: Position) => void;
    updatePotentialsDisplay?: (position: Position) => void;
    saveToLocalStorage?: () => void;
    loadBuildFromStorage?: (index: number) => void;
    deleteBuildFromStorage?: (index: number) => void;
    generateShareURL?: () => void;
    openLoadModal?: () => void;

    // Disc module functions
    loadDiscData: () => Promise<void>;
    renderDiscs?: (preserveFocusId?: string | null) => void;
    openDiscSelector: (slotId: DiscSlotId) => void;
    selectDiscOption: (discId: string | number) => void;
    closeDiscSelector: () => void;
    openImageViewer: (imagePath: string, title: string) => void;
    closeImageViewer: () => void;
    adjustLimitBreak: (slotId: DiscSlotId, delta: number) => void;
    adjustSubDiscLevel: (slotId: 'sub1' | 'sub2' | 'sub3', delta: number) => void;
    adjustAcquiredNote: (noteId: string, delta: number) => void;
    setAcquiredNote: (noteId: string, value: string | number) => void;
    adjustTotalNoteLevel: (noteId: string, delta: number) => void;
    setTotalNoteLevel: (noteId: string, value: string | number) => void;
    toggleNotesSidebar: () => void;
    calculateNotesFromSubDiscs: () => Record<string, number>;
    calculateDiscScore: () => number;
    updateRequiredNotes: () => void;
    
    // Summary/build module functions
    renderSummary?: () => void;
    updateSummary?: () => void;
    saveBuildNotes?: () => void;
    cyclePotentialMark?: (position: Position, potId: number) => void;
    calculateCharacterScore?: (position: Position) => number;
    generatePotentialIconHTML?: (potId: number, position: Position, level: number, mark: PotentialMark) => string;

    // Preset module functions
    renderPresets?: () => void;
    loadPresetBuilds?: (filePath?: string) => Promise<unknown>;
    loadPresetBuild?: (hash: string, title: string) => void;
    
    // Damage Calculator functions
    renderDamageCalculator?: () => Promise<void>;

    // Toast notification
    showToast?: (message: string, type?: ToastType) => void;
    showError?: (message: string) => void;
    showWarning?: (message: string) => void;
    showSuccess?: (message: string) => void;
    showInfo?: (message: string) => void;
    
    // Icon utility
    getIcon?: (iconName: string, additionalClasses?: string) => string;
    createIconElement?: (iconName: string, additionalClasses?: string) => HTMLElement;
    ICONS?: Record<string, string>;
    
    // Theme utility
    toggleTheme?: () => void;
    setTheme?: (theme: 'light' | 'dark') => void;
    initTheme?: () => void;
    
    // Element tag and description parser
    parseElementTags?: (description: string) => string;
    processDescriptionText?: (description: string) => string;

    // Image error handling and optimization
    handleImageError?: (img: HTMLImageElement) => void;
    createOptimizedImage?: (src: string, alt: string, className?: string, eager?: boolean) => string;
    createResponsiveImage?: (basePath: string, alt: string, className?: string, eager?: boolean, width?: number, height?: number) => string;
    preloadImage?: (src: string) => void;
    enableLazyLoadingInContainer?: (container: HTMLElement) => void;

    // Empty state helpers
    createEmptyState?: (iconName: string, message: string) => string;
    createLoadingState?: (message?: string) => string;

    // Build state
    buildState?: { buildTitle?: string; buildMemo?: string };
    handleBuildTitleChange?: (event: Event) => void;
    handleBuildMemoChange?: (event: Event) => void;
    closeLoadModal?: () => void;
    openIngameCodeModal?: () => void;

    // Compression library
    fflate?: CompressionLib;
  }
}

export {};
