/**
 * Parameter Parser Module
 *
 * Dynamic parameter parsing system for skill and potential descriptions. Parses
 * parameter strings that reference game data files and converts them into display
 * values, with level-based scaling and special format handling.
 *
 * Key Features:
 * - Three parsing modes: LevelUp (scaled), NoLevel (static), DamageNum (array-indexed)
 * - Multiple format types: percentages, enum lookups, fixed values
 * - Level-based damage calculations with complex indexing strategies
 * - Description parameter replacement (&Param1& through &Param10&)
 * - LRU caching for parsed descriptions (500 entries)
 *
 * Parameter Format: "fileType,levelType,baseId[,fieldKey][,formatType][,enumType]"
 *
 * @module modules/param-parser
 * @see {@link shared/game-data} For data source definitions
 * @see {@link modules/app-char} For usage in character descriptions
 *
 * @example
 * ```typescript
 * // Parse a level-scaled effect value
 * const result = parseParamValue('effect,LevelUp,90201,Value,10KPct', 3, 1, 'master', state);
 * // Looks up ID 90231 (90201 + 3*10), returns value as percentage
 *
 * // Parse description with multiple parameters
 * const desc = parseDescriptionParams(
 *   "Deals &Param1& damage",
 *   { Param1: "damage,DamageNum,10001" },
 *   level, skillLevel, state, position
 * );
 * ```
 */

import type {
  Position,
  FileType,
  LevelType,
  FormatType,
  ParseResult,
  ParamParserState,
} from '../types';

import { parseElementTags } from '../shared';

// =============================================================================
// FILE TYPE MAPPING
// =============================================================================

// Complete mapping for all file type variations
export const FILE_TYPE_MAP: Record<string, keyof ParamParserState> = {
  effect: 'effectValue',
  effectvalue: 'effectValue',
  buff: 'buffValue',
  buffvalue: 'buffValue',
  shield: 'shieldValue',
  shieldvalue: 'shieldValue',
  damage: 'hitDamage',
  hitdamage: 'hitDamage',
  onceadditional: 'onceAdditionalAttributeValue',
  onceadditionalattribute: 'onceAdditionalAttributeValue',
  onceadditionalattributevalue: 'onceAdditionalAttributeValue',
  scriptparam: 'scriptParameterValue',
  scriptparameter: 'scriptParameterValue',
  scriptparametervalue: 'scriptParameterValue',
  skill: 'skills',
};

// =============================================================================
// PARSED PARAMETER INTERFACE
// =============================================================================

export interface ParsedElements {
  fileType: string;
  levelType: LevelType;
  baseId: string;
  fieldKey: string | null;
  formatType: FormatType | null;
  enumType: string | null;
}

interface ParserContext<T extends ParamParserState = ParamParserState> {
  state: T;
  level: number;
  skillLevel: number;
  position: Position | null;
  isSpecificPotential: boolean;
  characterLevelPhase: number;
}

// =============================================================================
// ELEMENT PARSING
// =============================================================================

/**
 * Parses parameter string into structured components
 *
 * Splits comma-separated parameter string and validates required fields.
 * Returns null if parameter is invalid or missing required components.
 *
 * @param paramString - Parameter string to parse
 * @returns Parsed elements or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parseElements('effect,LevelUp,90201,Value,10KPct');
 * // { fileType: 'effect', levelType: 'LevelUp', baseId: '90201', fieldKey: 'Value', formatType: '10KPct', enumType: null }
 * ```
 */
function parseElements(paramString: string): ParsedElements | null {
  if (!paramString || typeof paramString !== 'string') {
    return null;
  }

  const elements = paramString.split(',').map((e) => e.trim());

  if (elements.length < 3) {
    return null;
  }

  const [fileType, levelType, baseId, fieldKey, formatType, enumType] = elements;

  if (!fileType) {
    return null;
  }

  return {
    fileType: fileType.toLowerCase(),
    levelType: levelType as LevelType,
    baseId: baseId || '',
    fieldKey: fieldKey || null,
    formatType: (formatType as FormatType) || null,
    enumType: enumType || null,
  };
}

// =============================================================================
// LEVEL UP PARSER
// =============================================================================

/**
 * Parses LevelUp type parameters with level-based ID adjustment
 *
 * Calculates lookup ID by adding (level × 10) to base ID. Buff type has special
 * handling - only applies level adjustment if tens digit is 0.
 *
 * @param elements - Parsed parameter components
 * @param ctx - Parser context with state and level information
 * @returns Parse result with formatted value and level type
 *
 * @example
 * ```typescript
 * // At level 3: ID 90201 → 90231 (90201 + 3*10)
 * const result = parseLevelUp({ fileType: 'effect', levelType: 'LevelUp', baseId: '90201', ... }, ctx);
 * ```
 */
function parseLevelUp<T extends ParamParserState>(
  elements: ParsedElements,
  ctx: ParserContext<T>
): ParseResult {
  const { fileType, baseId, fieldKey, formatType, enumType } = elements;
  const dataKey = FILE_TYPE_MAP[fileType];

  if (!dataKey || !ctx.state[dataKey]) {
    return { value: `[${fileType}]`, levelType: 'LevelUp' };
  }

  const dataSource = ctx.state[dataKey] as Record<string, Record<string, unknown>>;
  let lookupId = baseId;

  // Special handling for Buff type
  if (fileType === 'buff') {
    const baseIdNum = parseInt(baseId);
    const lastTwoDigits = baseIdNum % 100;
    const tensDigit = Math.floor(lastTwoDigits / 10);

    if (tensDigit === 0) {
      // Tens digit is 0: apply level adjustment
      lookupId = (baseIdNum + ctx.level * 10).toString();
    }
    // Otherwise use base ID directly
  } else {
    // Standard level adjustment
    lookupId = (parseInt(baseId) + ctx.level * 10).toString();
  }

  // Lookup with fallback to base ID
  let dataEntry = dataSource[lookupId];
  if (!dataEntry) {
    dataEntry = dataSource[baseId];
  }

  if (!dataEntry) {
    return { value: `[${fileType}:${lookupId}]`, levelType: 'LevelUp' };
  }

  // Extract value using field key
  if (!fieldKey || dataEntry[fieldKey] === undefined) {
    return { value: `[${fieldKey}]`, levelType: 'LevelUp' };
  }

  const value = dataEntry[fieldKey];

  // Apply formatting if specified
  if (formatType) {
    return { value: formatValue(value, formatType, enumType, fileType, ctx.state), levelType: 'LevelUp' };
  }

  return { value: value as string | number, levelType: 'LevelUp' };
}

// =============================================================================
// NO LEVEL PARSER
// =============================================================================

/**
 * Parses NoLevel type parameters with direct ID lookup
 *
 * Performs direct lookup using base ID without any level adjustments.
 * Used for static values that don't scale with level.
 *
 * @param elements - Parsed parameter components
 * @param ctx - Parser context with state information
 * @returns Parse result with formatted value and level type
 */
function parseNoLevel<T extends ParamParserState>(
  elements: ParsedElements,
  ctx: ParserContext<T>
): ParseResult {
  const { fileType, baseId, fieldKey, formatType, enumType } = elements;
  const dataKey = FILE_TYPE_MAP[fileType];

  if (!dataKey || !ctx.state[dataKey]) {
    return { value: `[${fileType}]`, levelType: 'NoLevel' };
  }

  const dataSource = ctx.state[dataKey] as Record<string, Record<string, unknown>>;
  const dataEntry = dataSource[baseId];

  if (!dataEntry) {
    return { value: `[${fileType}:${baseId}]`, levelType: 'NoLevel' };
  }

  if (!fieldKey || dataEntry[fieldKey] === undefined) {
    return { value: `[${fieldKey}]`, levelType: 'NoLevel' };
  }

  const value = dataEntry[fieldKey];

  if (formatType) {
    return { value: formatValue(value, formatType, enumType, fileType, ctx.state), levelType: 'NoLevel' };
  }

  return { value: value as string | number, levelType: 'NoLevel' };
}

// =============================================================================
// DAMAGE NUM PARSER
// =============================================================================

interface DamageEntry {
  levelTypeData?: number;
  LevelData?: number;
  MainOrSupport?: number;
  DamageType?: number;
  SkillPercentAmend?: number[];
  SkillAbsAmend?: number[];
}

/**
 * Parses DamageNum type parameters for skill damage calculations
 *
 * Handles complex skill damage arrays with multiple indexing strategies:
 * - levelTypeData === 4: Uses character level phase
 * - levelTypeData === 3: Uses specific skill based on LevelData
 * - DamageType present: Uses skill type (normal/skill/ultimate)
 * - Default: Uses skill level - 1 as index
 *
 * Supports both SkillPercentAmend (percentage) and SkillAbsAmend (absolute) damage.
 *
 * @param elements - Parsed parameter components
 * @param ctx - Parser context with state, levels, and character information
 * @returns Parse result with combined damage string and optional red color flag
 *
 * @example
 * ```typescript
 * // Returns "25.5% + 100" for skill at level 5
 * const result = parseDamageNum({ fileType: 'damage', levelType: 'DamageNum', baseId: '10001', ... }, ctx);
 * ```
 */
function parseDamageNum<T extends ParamParserState>(
  elements: ParsedElements,
  ctx: ParserContext<T>
): ParseResult {
  const { fileType, baseId } = elements;
  const dataKey = FILE_TYPE_MAP[fileType];

  if (!dataKey || !ctx.state[dataKey]) {
    return { value: `[${fileType}]`, levelType: 'DamageNum' };
  }

  const dataSource = ctx.state[dataKey] as Record<string, DamageEntry>;
  const dataEntry = dataSource[baseId];

  if (!dataEntry) {
    return { value: `[${fileType}:${baseId}]`, levelType: 'DamageNum' };
  }

  // Determine the array index based on levelTypeData
  const { index, useRedColor } = calculateDamageIndex(dataEntry, ctx);

  // Check for valid data
  const hasPercentData = hasNonZeroArray(dataEntry.SkillPercentAmend);
  const hasAbsData = hasNonZeroArray(dataEntry.SkillAbsAmend);

  if (!hasPercentData && !hasAbsData) {
    return { value: '[DamageNum]', levelType: 'DamageNum', color: useRedColor ? 'red' : undefined };
  }

  // Build display string
  const displayParts: string[] = [];

  if (hasPercentData && dataEntry.SkillPercentAmend) {
    const percentValue = dataEntry.SkillPercentAmend[index] ?? 0;
    displayParts.push((percentValue / 10000).toFixed(1) + '%');
  }

  if (hasAbsData && dataEntry.SkillAbsAmend) {
    const absValue = dataEntry.SkillAbsAmend[index] ?? 0;
    displayParts.push(absValue.toString());
  }

  return {
    value: displayParts.join(' + '),
    levelType: 'DamageNum',
    color: useRedColor ? 'red' : undefined,
  };
}

/**
 * Calculates appropriate array index for damage value lookup
 *
 * Determines which element of SkillPercentAmend/SkillAbsAmend arrays to use
 * based on levelTypeData and character state. Returns red color flag for
 * invalid/unsupported cases.
 *
 * @param dataEntry - Damage data entry from HitDamage.json
 * @param ctx - Parser context with character and level information
 * @returns Object containing array index and red color flag
 */
function calculateDamageIndex<T extends ParamParserState>(
  dataEntry: DamageEntry,
  ctx: ParserContext<T>
): { index: number; useRedColor: boolean } {
  const maxIndex = Math.max(
    dataEntry.SkillPercentAmend?.length ?? 0,
    dataEntry.SkillAbsAmend?.length ?? 0
  ) - 1;

  // levelTypeData === 4: Use character level phase
  if (dataEntry.levelTypeData === 4) {
    const index = Math.min(Math.max(0, ctx.characterLevelPhase), maxIndex);
    return { index, useRedColor: false };
  }

  // levelTypeData === 3 with HitDamage: Use LevelData to determine skill
  if (dataEntry.levelTypeData === 3) {
    return calculateLevelData3Index(dataEntry, ctx, maxIndex);
  }

  // Default: Use skill level for specific potentials with DamageType
  if (ctx.isSpecificPotential && ctx.position && dataEntry.DamageType) {
    return calculateDamageTypeIndex(dataEntry, ctx, maxIndex);
  }

  // Fallback: Use skill level - 1 as index
  const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
  return { index, useRedColor: false };
}

/**
 * Calculates index for levelTypeData === 3 (skill-specific damage)
 *
 * Uses LevelData field to determine which skill to reference:
 * - 5: Normal attack skill
 * - 2: Main/assist skill (based on MainOrSupport)
 * - 4: Ultimate skill
 * - Other: Returns maxIndex with red color warning
 *
 * @param dataEntry - Damage data entry
 * @param ctx - Parser context with character state
 * @param maxIndex - Maximum valid array index
 * @returns Object containing calculated index and red color flag
 */
function calculateLevelData3Index<T extends ParamParserState>(
  dataEntry: DamageEntry,
  ctx: ParserContext<T>,
  maxIndex: number
): { index: number; useRedColor: boolean} {
  // Check if state has party property (CharacterState specific)
  const stateWithParty = ctx.state as any;
  if (!ctx.position || !stateWithParty.party || !stateWithParty.party[ctx.position]) {
    const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const character = stateWithParty.party[ctx.position];
  if (!character || typeof character === 'string') {
    const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const isMaster = ctx.position === 'master';
  const levelData = dataEntry.LevelData;
  const charData = (character as unknown as { data: Record<string, number> }).data;

  let skillId: number | null = null;

  switch (levelData) {
    case 5: // Normal attack
      skillId = (isMaster ? charData.NormalAtkId : charData.AssistNormalAtkId) ?? null;
      break;
    case 2: // Main skill
      if (dataEntry.MainOrSupport === 2) {
        skillId = charData.AssistSkillId ?? null;
      } else {
        skillId = charData.SkillId ?? null;
      }
      break;
    case 4: // Ultimate
      skillId = (isMaster ? charData.UltimateId : charData.AssistUltimateId) ?? null;
      break;
    default:
      // Other values: use last index with red color
      return { index: Math.max(0, maxIndex), useRedColor: true };
  }

  if (skillId) {
    const effectiveLevel = stateWithParty.skillLevels?.[ctx.position]?.[skillId] ?? 1;
    const index = Math.min(Math.max(0, effectiveLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
  return { index, useRedColor: false };
}

/**
 * Calculates index based on DamageType for specific potentials (Stype 42)
 *
 * Maps DamageType enum to appropriate skill (NORMAL/SKILL/ULTIMATE) and
 * uses that skill's current level as the array index.
 *
 * @param dataEntry - Damage data entry with DamageType field
 * @param ctx - Parser context with character and enum data
 * @param maxIndex - Maximum valid array index
 * @returns Object containing calculated index and red color flag
 */
function calculateDamageTypeIndex<T extends ParamParserState>(
  dataEntry: DamageEntry,
  ctx: ParserContext<T>,
  maxIndex: number
): { index: number; useRedColor: boolean } {
  // Check if state has party property (CharacterState specific)
  const stateWithParty = ctx.state as any;
  if (!ctx.position || !stateWithParty.party || !stateWithParty.party[ctx.position]) {
    const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const character = stateWithParty.party[ctx.position];
  if (!character || typeof character === 'string') {
    const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const isMaster = ctx.position === 'master';
  const charData = (character as unknown as { data: Record<string, number> }).data;
  const damageType = dataEntry.DamageType;

  // Get damage type key from GameEnums
  const damageTypeInfo = (stateWithParty.gameEnums as Record<string, Record<number, { key?: string }>>)?.damageType?.[damageType ?? 0];
  const damageTypeKey = damageTypeInfo?.key;

  let skillId: number | null = null;

  if (!isMaster) {
    skillId = charData.AssistSkillId ?? null;
  } else {
    switch (damageTypeKey) {
      case 'NORMAL':
        skillId = charData.NormalAtkId ?? null;
        break;
      case 'SKILL':
        skillId = charData.SkillId ?? null;
        break;
      case 'ULTIMATE':
        skillId = charData.UltimateId ?? null;
        break;
    }
  }

  if (skillId) {
    const effectiveLevel = stateWithParty.skillLevels?.[ctx.position]?.[skillId] ?? 1;
    const index = Math.min(Math.max(0, effectiveLevel - 1), maxIndex);
    return { index, useRedColor: false };
  }

  const index = Math.min(Math.max(0, ctx.skillLevel - 1), maxIndex);
  return { index, useRedColor: false };
}

// =============================================================================
// VALUE FORMATTING
// =============================================================================

/**
 * Formats parsed value according to specified format type
 *
 * Supported Format Types:
 * - HdPct: Multiply by 100, add % (0.25 → 25%)
 * - 10KHdPct: Divide by 100, add % (2500 → 25%)
 * - 10K: Divide by 10000 (10000 → 1.0)
 * - 10KPct: Divide by 10000, add % (10000 → 1.0%)
 * - Enum: Look up enum value from GameEnums
 * - Text: Look up skill name from translations
 * - Fixed: Return as-is
 *
 * @param value - Raw value to format
 * @param formatType - Format type identifier
 * @param enumType - Enum type for enum lookups (e.g., 'EAT', 'SAT')
 * @param fileType - Source file type for context
 * @param state - Parser state with game data
 * @returns Formatted value as string or number
 *
 * @example
 * ```typescript
 * formatValue(2500, '10KPct', null, 'effect', state); // '0.3%'
 * formatValue(5, 'Enum', 'EAT', 'effect', state); // '공격력' (localized)
 * ```
 */
export function formatValue<T extends ParamParserState>(
  value: unknown,
  formatType: FormatType | string,
  enumType: string | null,
  fileType: string,
  state: T
): string | number {
  // Handle Enum type
  if (formatType === 'Enum' && enumType && value != null) {
    return formatEnumValue(value, enumType, state);
  }

  const numValue = parseFloat(String(value));

  switch (formatType) {
    case 'HdPct':
      // Already in percent, multiply by 100
      return (numValue * 100).toFixed(2) + '%';

    case '10KHdPct':
      // Divide by 100 for percentage
      return (numValue / 100).toFixed(2) + '%';

    case '10K':
      // Divide by 10000
      return (numValue / 10000).toFixed(1);

    case '10KPct':
      // Divide by 10000 and add %
      return (numValue / 10000).toFixed(1) + '%';

    case 'Fixed':
      return value as string | number;

    case 'Text':
      if (fileType === 'skill') {
        // Try skillsKR first (translated skill names)
        if (state.skillsKR) {
          const translated = (state.skillsKR as any)[String(value)];
          if (translated) {
            return translated;
          }
        }
        // Fallback to skillNames if available
        const stateWithSkillNames = state as any;
        if (stateWithSkillNames.skillNames) {
          return stateWithSkillNames.skillNames[String(value)] ?? (value as string);
        }
      }
      return value as string;

    default:
      return value as string | number;
  }
}

/**
 * Formats enum value by looking up localized name from GameEnums
 *
 * Supports abbreviated enum types (EAT, SAT, ET, PAT, PT) which are mapped
 * to full enum names. Tries UI text first for EAT type, then falls back to
 * GameEnums.
 *
 * @param value - Enum numeric value
 * @param enumType - Enum type abbreviation
 * @param state - Parser state with game enums and UI text
 * @returns Localized enum name or original value if not found
 */
function formatEnumValue<T extends ParamParserState>(
  value: unknown,
  enumType: string,
  state: T
): string | number {
  // Try UI text first for EAT type
  if (enumType === 'EAT' && state.uiText) {
    const uiTextKey = `UIText.Enums_Effect_${value}.1`;
    const uiText = state.uiText;
    if (uiText[uiTextKey]) {
      return uiText[uiTextKey];
    }
  }

  // Map abbreviations to full enum names
  const enumMap: Record<string, string> = {
    EAT: 'effectAttributeType',
    SAT: 'stateAttributeType',
    ET: 'effectType',
    PAT: 'playerAttributeType',
    PT: 'parameterType',
  };

  const fullEnumName = enumMap[enumType] ?? enumType;
  const enumData = state.gameEnums?.[fullEnumName] as
    | Record<string, { name?: string }>
    | undefined;

  if (enumData && enumData[String(value)]) {
    return enumData[String(value)]?.name ?? (value as string | number);
  }

  return value as string | number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Checks if array contains any non-zero values
 *
 * @param arr - Array to check
 * @returns True if array exists and has at least one non-zero element
 */
function hasNonZeroArray(arr: number[] | undefined): boolean {
  return Array.isArray(arr) && arr.some((v) => v !== 0);
}

// =============================================================================
// MAIN PARSER FUNCTION
// =============================================================================

/**
 * Parses parameter value string and returns computed value with formatting
 *
 * Main entry point for parameter parsing. Dispatches to appropriate parser
 * (parseLevelUp, parseNoLevel, or parseDamageNum) based on levelType.
 *
 * Parameter Format: "fileType,levelType,baseId[,fieldKey][,formatType][,enumType]"
 *
 * Examples:
 * - "effect,LevelUp,90201,Value,10KPct" - Effect value scaled by level
 * - "buff,NoLevel,5001,Time,Fixed" - Static buff duration
 * - "damage,DamageNum,10001" - Skill damage array lookup
 *
 * @param paramString - Parameter string in comma-separated format
 * @param level - Current potential/skill level (1-13)
 * @param skillLevel - Character's skill level for damage calculations
 * @param position - Character position (master/assist1/assist2)
 * @param state - Parser state containing all game data sources
 * @param isSpecificPotential - Whether this is a specific potential (Stype 42)
 * @param characterLevelPhase - Character level phase (0-8 for 1+, 10+, ..., 80+)
 * @returns Parse result with formatted value, level type, and optional color
 *
 * @example
 * ```typescript
 * // Parse level-scaled effect at level 5
 * const result = parseParamValue('effect,LevelUp,90201,Value,10KPct', 5, 1, 'master', state);
 * // Returns: { value: '2.5%', levelType: 'LevelUp' }
 * ```
 */
export function parseParamValue<T extends ParamParserState>(
  paramString: string,
  level: number,
  skillLevel: number,
  position: Position | null,
  state: T,
  isSpecificPotential = false,
  characterLevelPhase = 8
): ParseResult {
  // Parse elements
  const elements = parseElements(paramString);
  if (!elements) {
    return { value: paramString };
  }

  // Create context
  const ctx: ParserContext<T> = {
    state,
    level,
    skillLevel,
    position,
    isSpecificPotential,
    characterLevelPhase,
  };

  // Dispatch to appropriate parser
  switch (elements.levelType) {
    case 'LevelUp':
      return parseLevelUp(elements, ctx);

    case 'NoLevel':
      return parseNoLevel(elements, ctx);

    case 'DamageNum':
      return parseDamageNum(elements, ctx);

    default:
      return { value: `[${elements.levelType}]` };
  }
}

// =============================================================================
// DESCRIPTION PARSER
// =============================================================================

/**
 * Parses and replaces parameter placeholders in descriptions
 *
 * Replaces &Param1& through &Param10& placeholders with parsed values from
 * the params object. Each placeholder is parsed using parseParamValue() and
 * wrapped in styled span tags with appropriate CSS classes.
 *
 * Also processes element tags like ##빛 속성 표식#1015# using parseElementTags().
 *
 * @param description - Raw description string with &ParamN& placeholders
 * @param params - Object mapping Param1...Param10 to parameter strings
 * @param level - Current potential/skill level
 * @param skillLevel - Character's skill level
 * @param state - Parser state with game data
 * @param position - Character position for skill lookups
 * @param isSpecificPotential - Whether this is specific potential (Stype 42)
 * @param characterLevelPhase - Character level phase (0-8)
 * @returns Description with placeholders replaced by styled HTML
 *
 * @example
 * ```typescript
 * const desc = parseDescriptionParams(
 *   "Increases ATK by &Param1& for &Param2& seconds",
 *   { Param1: "effect,LevelUp,90201,Value,10KPct", Param2: "buff,NoLevel,5001,Time,Fixed" },
 *   5, 1, state, 'master'
 * );
 * // Returns: "Increases ATK by <span class="param-value">2.5%</span> for <span class="param-value">10</span> seconds"
 * ```
 */
export function parseDescriptionParams<T extends ParamParserState>(
  description: string,
  params: Record<string, string>,
  level: number,
  skillLevel: number,
  state: T,
  position: Position | null = null,
  isSpecificPotential = false,
  characterLevelPhase = 8
): string {
  if (!description || !params) return description;

  let result = description;

  // Replace &Param1& through &Param10&
  for (let i = 1; i <= 10; i++) {
    const placeholder = `&Param${i}&`;
    const paramValue = params[`Param${i}`];

    if (result.includes(placeholder) && paramValue) {
      const parsed = parseParamValue(
        paramValue,
        level,
        skillLevel,
        position,
        state,
        isSpecificPotential,
        characterLevelPhase
      );

      // Build class name based on levelType and color
      let className = 'param-value';
      if (parsed.color === 'red') {
        className += ' param-red';
      } else if (parsed.levelType === 'NoLevel') {
        className += ' param-no-level';
      }

      // Wrap the parsed value in a styled span
      const styledValue = `<span class="${className}">${parsed.value}</span>`;
      result = result.replaceAll(placeholder, styledValue);
    }
  }

  // Parse element tags (##빛 속성 표식#1015#)
  result = parseElementTags(result);

  return result;
}

// =============================================================================
// BUFF METADATA EXTRACTION
// =============================================================================

interface BuffMetadata {
  time?: number;
  timeSuperposition?: number;
}

/**
 * Extracts buff duration metadata from parameter definitions
 *
 * Searches through Param1...Param10 for buff-type parameters and extracts
 * Time and TimeSuperposition fields from BuffValue data.
 *
 * @param params - Object containing Param1...Param10 definitions
 * @param level - Current level for LevelUp adjustments
 * @param state - Parser state with buffValue data
 * @returns Object with time and timeSuperposition values, or null if no buff found
 *
 * @example
 * ```typescript
 * const metadata = extractBuffMetadata({ Param1: "buff,LevelUp,5001" }, 3, state);
 * // Returns: { time: 10, timeSuperposition: 5 }
 * ```
 */
export function extractBuffMetadata<T extends ParamParserState>(
  params: Record<string, string>,
  level: number,
  state: T
): BuffMetadata | null {
  if (!params) return null;

  for (let i = 1; i <= 10; i++) {
    const paramString = params[`Param${i}`];
    if (!paramString || typeof paramString !== 'string') continue;

    const elements = paramString.split(',').map((e) => e.trim());
    if (elements.length < 3) continue;

    const [fileType, levelType, baseId] = elements;
    
    if (!fileType || !baseId) continue;
    
    const dataKey = FILE_TYPE_MAP[fileType.toLowerCase()];

    if (dataKey === 'buffValue' && state.buffValue) {
      let lookupId = baseId;

      if (levelType === 'LevelUp') {
        lookupId = (parseInt(baseId) + level * 10).toString();
      }

      const buffEntry = state.buffValue[lookupId] as
        | { Time?: number; TimeSuperposition?: number }
        | undefined;

      if (buffEntry && (buffEntry.Time !== undefined || buffEntry.TimeSuperposition !== undefined)) {
        return {
          time: buffEntry.Time,
          timeSuperposition: buffEntry.TimeSuperposition,
        };
      }
    }
  }

  return null;
}

// =============================================================================
// TEXT PROCESSING - SKILL NAMES AND ELEMENT TAGS
// =============================================================================

/**
 * Processes text containing skill name placeholders [skill]
 *
 * Note: Currently a stub function. Skill name replacement requires context
 * about which skill to reference. Use processTextForDisplay() instead.
 *
 * @param text - Text to process
 * @param state - Parser state with skill data
 * @returns Original text (unmodified in current implementation)
 */
export function processSkillNameReferences<T extends ParamParserState>(
  text: string,
  state: T
): string {
  if (!text || typeof text !== 'string') return text;

  // Pattern to match 「[skill]」 or just [skill]
  const skillPattern = /\[skill\]/gi;

  // For now, we'll replace with a placeholder
  // The actual skill name should be determined from context
  // This function should be called with the appropriate skill context

  return text;
}

/**
 * Processes text for display by replacing skill placeholders with actual names
 *
 * Replaces [skill] placeholders with localized skill names from skillsKR data.
 * Requires skillId to be provided for proper name lookup.
 *
 * @param text - Text containing [skill] placeholders
 * @param state - Parser state with skills and skillsKR data
 * @param skillId - Optional skill ID to look up skill name
 * @returns Text with [skill] replaced by skill name
 *
 * @example
 * ```typescript
 * const text = processTextForDisplay("Enhances [skill] damage", state, 10001);
 * // Returns: "Enhances 빛의 격류 damage"
 * ```
 */
export function processTextForDisplay<T extends ParamParserState>(
  text: string,
  state: T,
  skillId?: number | null
): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Replace [skill] placeholders with actual skill names if skillId is provided
  if (skillId && state.skillsKR) {
    const skill = state.skills?.[skillId];
    if (skill && typeof skill === 'object' && skill !== null && 'Title' in skill) {
      const skillNameKey = (skill as any).Title;
      const skillName = (state.skillsKR as any)[skillNameKey] || `Skill ${skillId}`;
      result = result.replace(/\[skill\]/gi, skillName);
    }
  }

  return result;
}

/**
 * Parses Main Skill descriptions with {N} placeholders
 *
 * Main Skills use {0} through {9} placeholders that map to Param1...Param10
 * in the skill data. This function performs simple string replacement and
 * wraps values in styled spans.
 *
 * @param description - Skill description with {0}...{9} placeholders
 * @param skill - Skill data object containing Param1...Param10 values
 * @returns Description with placeholders replaced and element tags parsed
 *
 * @example
 * ```typescript
 * const desc = parseSkillDescription("Deals {0} damage", { Param1: "150%" });
 * // Returns: "Deals <span class=\"param-value\">150%</span> damage"
 * ```
 */
export function parseSkillDescription(description: string, skill: Record<string, unknown>): string {
  if (!description || !skill) return description;

  let result = description;

  // Main Skills use {0} to {9} placeholders
  for (let i = 0; i < 10; i++) {
    const placeholder = `{${i}}`;
    // Params are 1-indexed in data (Param1, Param2, etc.)
    const paramKey = `Param${i + 1}`;
    const paramValue = skill[paramKey];

    if (result.includes(placeholder) && paramValue !== undefined && paramValue !== null) {
      const styledValue = `<span class="param-value">${paramValue}</span>`;
      result = result.replaceAll(placeholder, styledValue);
    }
  }

  // Parse element tags
  return parseElementTags(result);
}

// =============================================================================
// SIMPLE PARAMETER SUBSTITUTION
// =============================================================================

/**
 * Performs simple parameter substitution for Secondary Skills
 *
 * Secondary Skills use {1} through {10} placeholders that map directly to
 * Param1...Param10 values. Unlike Main Skills, these are already formatted
 * values rather than lookup keys.
 *
 * @param description - Skill description with {1}...{10} placeholders
 * @param skill - Skill data object containing Param1...Param10 values
 * @returns Description with placeholders replaced and element tags parsed
 *
 * @example
 * ```typescript
 * const desc = substituteSkillParams("Increases ATK by {1}", { Param1: "25%" });
 * // Returns: "Increases ATK by <span class=\"param-value\">25%</span>"
 * ```
 */
export function substituteSkillParams(
  description: string,
  skill: Record<string, unknown>
): string {
  if (!description || !skill) return description;

  let result = description;

  for (let i = 1; i <= 10; i++) {
    const placeholder = `{${i}}`;
    const paramKey = `Param${i}`;
    const paramValue = skill[paramKey];

    if (result.includes(placeholder) && paramValue !== undefined && paramValue !== null) {
      const styledValue = `<span class="param-value">${paramValue}</span>`;
      result = result.replaceAll(placeholder, styledValue);
    }
  }

  // Parse element tags
  return parseElementTags(result);
}
