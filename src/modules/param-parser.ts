/**
 * Parameter Parser Module
 *
 * Refactored from the monolithic parseParamValue function into smaller,
 * focused functions for better maintainability and testability.
 *
 * Parameter format: "fileType,levelType,baseId[,fieldKey][,formatType][,enumType]"
 *
 * LevelTypes:
 * - LevelUp: Adds (level × 10) to base ID for level-scaled lookups
 * - NoLevel: Direct ID lookup
 * - DamageNum: Fetches skill damage arrays with skill level indexing
 */

import type {
  Position,
  FileType,
  LevelType,
  FormatType,
  ParseResult,
  ParamParserState,
} from '@/types';

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
 * Parse the parameter string into its component elements
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
 * Parse LevelUp type parameters
 * Adds (level × 10) to base ID, with special handling for Buff type
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
 * Parse NoLevel type parameters
 * Direct ID lookup without level adjustment
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
 * Parse DamageNum type parameters
 * Handles skill damage arrays with various level indexing strategies
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
 * Calculate the array index for damage values
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
 * Calculate index for levelTypeData === 3
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
 * Calculate index based on DamageType for specific potentials
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
 * Format a value based on format type
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
 * Format an enum value using GameEnums
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
 * Check if an array has non-zero elements
 */
function hasNonZeroArray(arr: number[] | undefined): boolean {
  return Array.isArray(arr) && arr.some((v) => v !== 0);
}

// =============================================================================
// MAIN PARSER FUNCTION
// =============================================================================

/**
 * Parse a parameter value string and return the computed value
 *
 * @param paramString - Format: "fileType,levelType,baseId[,fieldKey][,formatType][,enumType]"
 * @param level - Current potential/skill level (1-13)
 * @param skillLevel - Character's skill level
 * @param position - Character position (master/assist1/assist2)
 * @param state - Character state containing all data sources
 * @param isSpecificPotential - Whether this is a specific potential (Stype 42)
 * @param characterLevelPhase - Character level phase (0-8)
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
 * Parse and replace parameter placeholders in descriptions
 * Replaces &Param1& through &Param10& with parsed values
 * Also processes element tags like ##빛 속성 표식#1015#
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

  // Parse element tags (##빛 속성 표식#1015#) if parseElementTags is available
  if (typeof window !== 'undefined' && window.parseElementTags) {
    result = window.parseElementTags(result);
  }

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
 * Extract buff metadata from parameters
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
 * Process text containing skill name references like 「[skill]」
 * Replaces [skill] with actual skill name from data
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
 * Process text for display - handles skill references and element tags
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
