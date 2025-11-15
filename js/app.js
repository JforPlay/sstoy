// Constants
const SKILL_LEVEL_BONUS = 3; // Added to skill's base MaxLevel

// Global state
let state = {
    characters: {},
    characterNames: {},
    charPotentials: {},
    potentials: {},
    potentialNames: {},
    itemNames: {},
    gameEnums: {},
    skills: {},
    skillNames: {},
    effectValue: {},
    hitDamage: {},
    onceAdditionalAttributeValue: {},
    scriptParameterValue: {},
    buffValue: {},
    shieldValue: {},
    currentPosition: null,
    activeTab: 'master', // Track active tab
    descriptionMode: 'brief', // 'brief' or 'detailed'
    party: {
        master: null,
        assist1: null,
        assist2: null
    },
    selectedPotentials: {
        master: [],
        assist1: [],
        assist2: []
    },
    potentialLevels: {
        master: {},
        assist1: {},
        assist2: {}
    },
    skillLevels: {
        master: {},
        assist1: {},
        assist2: {}
    },
    characterLevelPhase: {
        master: 8,  // Default to 80+ (index 8)
        assist1: 8,
        assist2: 8
    },
    // Character selector state
    characterSelector: {
        allCharacters: [],
        fuse: null,
        selectedElement: 'all'
    }
};

// Description cache for performance optimization
const descriptionCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

// Clear cache when data changes
function clearDescriptionCache() {
    console.log(`[Cache Stats] Hits: ${cacheHits}, Misses: ${cacheMisses}, Hit Rate: ${cacheHits > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) : 0}%`);
    descriptionCache.clear();
    cacheHits = 0;
    cacheMisses = 0;
}

// Get cache statistics
function getCacheStats() {
    return {
        size: descriptionCache.size,
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: cacheHits > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) : 0
    };
}

// Make state accessible globally for saveload.js
window.state = state;
window.clearDescriptionCache = clearDescriptionCache;
window.getCacheStats = getCacheStats;

// Initialize character cards with click handlers
function initializeCharacterCards() {
    const positions = ['master', 'assist1', 'assist2'];
    positions.forEach(position => {
        const card = document.getElementById(`${position}-card`);
        if (card && !state.party[position]) {
            // Set up click handler for empty cards
            card.style.cursor = 'pointer';
            card.onclick = () => openCharacterSelect(position);
        }
    });
}

// Load data on page load
async function loadData() {
    try {
        // Load all JSON files
        const [characters, characterNames, charPotentials, potentials, potentialNames, itemNames, items, gameEnums, skills, skillNames, effectValue, hitDamage, onceAdditionalAttributeValue, scriptParameterValue, buffValue, shieldValue] = await Promise.all([
            fetch('data/Character.json').then(r => r.json()),
            fetch('data/kr/Character.json').then(r => r.json()),
            fetch('data/CharPotential.json').then(r => r.json()),
            fetch('data/Potential.json').then(r => r.json()),
            fetch('data/kr/Potential.json').then(r => r.json()),
            fetch('data/kr/Item.json').then(r => r.json()),
            fetch('data/Item.json').then(r => r.json()),
            fetch('data/GameEnums.json').then(r => r.json()),
            fetch('data/Skill.json').then(r => r.json()),
            fetch('data/kr/Skill.json').then(r => r.json()),
            fetch('data/EffectValue.json').then(r => r.json()),
            fetch('data/HitDamage.json').then(r => r.json()),
            fetch('data/OnceAdditionalAttributeValue.json').then(r => r.json()),
            fetch('data/ScriptParameterValue.json').then(r => r.json()),
            fetch('data/BuffValue.json').then(r => r.json()),
            fetch('data/ShieldValue.json').then(r => r.json())
        ]);

        state.characters = characters;
        state.characterNames = characterNames;
        state.charPotentials = charPotentials;
        state.potentials = potentials;
        state.potentialNames = potentialNames;
        state.itemNames = itemNames;
        state.items = items;
        state.gameEnums = gameEnums;
        state.skills = skills;
        state.skillNames = skillNames;
        state.effectValue = effectValue;
        state.hitDamage = hitDamage;
        state.onceAdditionalAttributeValue = onceAdditionalAttributeValue;
        state.scriptParameterValue = scriptParameterValue;
        state.buffValue = buffValue;
        state.shieldValue = shieldValue;
        
        // Initialize empty character cards with click handlers
        initializeCharacterCards();
    } catch (error) {
        console.error('Error loading data:', error);
        // Use toast notification instead of alert
        if (typeof showError === 'function') {
            showError('게임 데이터를 불러오는데 실패했습니다. data/ 폴더에 모든 데이터 파일이 있는지 확인해주세요.');
        } else {
            alert('게임 데이터를 불러오는데 실패했습니다. data/ 폴더에 모든 데이터 파일이 있는지 확인해주세요.');
        }
    }
}

// Initialize the app
loadData();

// Map of file type keywords to actual data references
const FILE_TYPE_MAP = {
    'effect': 'effectValue',
    'effectvalue': 'effectValue',
    'hitdamage': 'hitDamage',
    'onceadditionalattribute': 'onceAdditionalAttributeValue',
    'onceadditionalattributevalue': 'onceAdditionalAttributeValue',
    'scriptparameter': 'scriptParameterValue',
    'scriptparametervalue': 'scriptParameterValue',
    'shield': 'shieldValue',
    'shieldvalue': 'shieldValue',
    'buff': 'buffValue',
    'buffvalue': 'buffValue',
    'skill': 'skills'
};

/**
 * Parse a single parameter value string
 * Format: "FileType,LevelType,BaseId[,FieldKey][,FormatType]"
 *
 * @param {string} paramString - The parameter string to parse
 * @param {number} level - The level to use for LevelUp calculations (default: 1)
 * @param {number} skillLevel - The skill level to use for DamageNum calculations (default: 1)
 * @param {string} position - The character position (master/assist1/assist2) for HitDamage DamageType lookup
 * @param {boolean} isSpecificPotential - Whether this is a specific potential (Stype 42)
 * @param {number} characterLevelPhase - The character level phase (0-8) for levelTypeData = 4 (default: 8 for 80+)
 * @returns {object} - Object with {value, levelType, useRedColor} for styling purposes
 */
function parseParamValue(paramString, level = 1, skillLevel = 1, position = null, isSpecificPotential = false, characterLevelPhase = 8) {
    if (!paramString || typeof paramString !== 'string') return { value: paramString, levelType: null, useRedColor: false };

    // Split by comma to get elements
    const elements = paramString.split(',').map(e => e.trim());

    if (elements.length < 3) {
        return { value: paramString, levelType: null, useRedColor: false };
    }
    
    // Extract all elements (can be more than 5)
    const [fileType, levelType, baseId, fieldKey = null, formatType = null, enumType = null] = elements;
    
    // Get the data source (case-insensitive lookup)
    const dataKey = FILE_TYPE_MAP[fileType.toLowerCase()];
    if (!dataKey || !state[dataKey]) {
        return { value: `[${fileType}]`, levelType: null, useRedColor: false }; // Return placeholder
    }
    
    const dataSource = state[dataKey];
    let lookupId = baseId;
    let value = null;
    
    // Handle different level types
    if (levelType === 'LevelUp') {
        // For Buff, check the tens digit (second digit from right)
        if (fileType.toLowerCase() === 'buff') {
            const baseIdNum = parseInt(baseId);
            const lastTwoDigits = baseIdNum % 100;
            const tensDigit = Math.floor(lastTwoDigits / 10);

            if (tensDigit === 0) {
                // Tens digit is 0 (ID ends in 00-09): apply level adjustment
                const adjustedId = baseIdNum + (level * 10);
                lookupId = adjustedId.toString();
            } else {
                // Tens digit is not 0: use base ID directly
                lookupId = baseId;
            }
        } else {
            // For other types: add (level * 10) to the base ID
            const adjustedId = parseInt(baseId) + (level * 10);
            lookupId = adjustedId.toString();
        }
        
        // Lookup the data
        const dataEntry = dataSource[lookupId];
        if (!dataEntry) {
            return { value: `[${fileType}:${lookupId}]`, levelType, useRedColor: false };
        }

        // Extract value using field key
        if (fieldKey && dataEntry[fieldKey] !== undefined) {
            value = dataEntry[fieldKey];
        } else {
            return { value: `[${fieldKey}]`, levelType, useRedColor: false };
        }

        // Handle format type (5th element) with optional enum type (6th element)
        if (formatType) {
            return { value: formatValue(value, formatType, enumType, fileType), levelType, useRedColor: false };
        }
        
    } else if (levelType === 'NoLevel') {
        // For NoLevel: use base ID directly
        const dataEntry = dataSource[lookupId];
        if (!dataEntry) {
            return { value: `[${fileType}:${lookupId}]`, levelType, useRedColor: false };
        }

        // Extract value using field key
        if (fieldKey && dataEntry[fieldKey] !== undefined) {
            value = dataEntry[fieldKey];
        } else {
            return { value: `[${fieldKey}]`, levelType, useRedColor: false };
        }

        // Handle format type (5th element) with optional enum type (6th element)
        if (formatType) {
            return { value: formatValue(value, formatType, enumType, fileType), levelType, useRedColor: false };
        }
        
    } else if (levelType === 'DamageNum') {
        // For DamageNum: fetch SkillPercentAmend and SkillAbsAmend fields
        const dataEntry = dataSource[lookupId];
        if (!dataEntry) {
            return { value: `[${fileType}:${lookupId}]`, levelType, useRedColor: false };
        }

        // Check if this is levelTypeData = 4 (character level phase based)
        let index;
        let useRedColor = false;

        if (dataEntry.levelTypeData === 4) {
            // Use character level phase directly as index (0-8)
            index = Math.min(Math.max(0, characterLevelPhase),
                Math.max(dataEntry.SkillPercentAmend?.length || 0, dataEntry.SkillAbsAmend?.length || 0) - 1);
        } else if (dataEntry.levelTypeData === 3 && fileType.toLowerCase() === 'hitdamage') {
            // For levelTypeData = 3 with HitDamage, use LevelData to determine which skill level to use
            let effectiveSkillLevel = skillLevel;

            if (position && state.party[position]) {
                const character = state.party[position];
                const isMaster = position === 'master';
                const levelData = dataEntry.LevelData;

                let skillId = null;

                if (levelData === 5) {
                    // Use normal attack skill level
                    skillId = isMaster ? character.data.NormalAtkId : character.data.AssistNormalAtkId;
                } else if (levelData === 2) {
                    // Use main skill level (SkillId for both master and assist - not AssistSkillId)
                    skillId = character.data.SkillId;
                } else {
                    // Other LevelData values - use last index and mark for red color
                    useRedColor = true;
                    const arrayLength = Math.max(dataEntry.SkillPercentAmend?.length || 0, dataEntry.SkillAbsAmend?.length || 0);
                    index = Math.max(0, arrayLength - 1);
                    effectiveSkillLevel = null; // Skip normal indexing
                }

                if (skillId && effectiveSkillLevel !== null) {
                    effectiveSkillLevel = state.skillLevels[position]?.[skillId] || 1;
                }
            }

            // Use skill level - 1 as index (only if not using red color logic)
            if (effectiveSkillLevel !== null) {
                index = Math.min(Math.max(0, effectiveSkillLevel - 1),
                    Math.max(dataEntry.SkillPercentAmend?.length || 0, dataEntry.SkillAbsAmend?.length || 0) - 1);
            }
        } else {
            // For specific potentials with HitDamage, use skill level based on DamageType
            let effectiveSkillLevel = skillLevel;
            if (isSpecificPotential && position && dataEntry.DamageType && fileType.toLowerCase() === 'hitdamage') {
                const character = state.party[position];
                if (character) {
                    const isMaster = position === 'master';
                    const damageType = dataEntry.DamageType;

                    // Get the damageType key from GameEnums
                    const damageTypeInfo = state.gameEnums.damageType?.[damageType];
                    const damageTypeKey = damageTypeInfo?.key;

                    let skillId = null;

                    // For assist: always use AssistSkillId (the 'skill' slot)
                    // For master: map DamageType key to corresponding skill
                    if (!isMaster) {
                        skillId = character.data.AssistSkillId;
                    } else {
                        // Map DamageType key to skill ID for master
                        switch(damageTypeKey) {
                            case 'NORMAL': // Normal Attack
                                skillId = character.data.NormalAtkId;
                                break;
                            case 'SKILL': // Skill
                                skillId = character.data.SkillId;
                                break;
                            case 'ULTIMATE': // Ultimate
                                skillId = character.data.UltimateId;
                                break;
                        }
                    }

                    if (skillId) {
                        effectiveSkillLevel = state.skillLevels[position]?.[skillId] || 1;
                    }
                }
            }

            // Use skill level - 1 as index
            index = Math.min(Math.max(0, effectiveSkillLevel - 1),
                Math.max(dataEntry.SkillPercentAmend?.length || 0, dataEntry.SkillAbsAmend?.length || 0) - 1);
        }
        
        // Check if arrays have non-zero elements
        const hasNonZeroPercent = dataEntry.SkillPercentAmend && 
            Array.isArray(dataEntry.SkillPercentAmend) && 
            dataEntry.SkillPercentAmend.some(v => v !== 0);
        
        const hasNonZeroAbs = dataEntry.SkillAbsAmend &&
            Array.isArray(dataEntry.SkillAbsAmend) &&
            dataEntry.SkillAbsAmend.some(v => v !== 0);

        if (!hasNonZeroPercent && !hasNonZeroAbs) {
            return { value: `[DamageNum]`, levelType, useRedColor };
        }

        // Build the display string based on which fields have values
        let displayParts = [];

        if (hasNonZeroPercent) {
            const percentValue = dataEntry.SkillPercentAmend[index];
            // Divide by 10000 and format as percentage
            const percentDisplay = (percentValue / 10000).toFixed(1) + '%';
            displayParts.push(percentDisplay);
        }

        if (hasNonZeroAbs) {
            const absValue = dataEntry.SkillAbsAmend[index];
            displayParts.push(absValue.toString());
        }

        return { value: displayParts.join(' + '), levelType, useRedColor };

    } else {
        return { value: `[${levelType}]`, levelType, useRedColor: false };
    }

    return { value: value !== null ? value : paramString, levelType, useRedColor: false };
}

/**
 * Format a value based on format type
 * @param {*} value - The value to format
 * @param {string} formatType - The format type (HdPct, 10KHdPct, Enum, Text, etc.)
 * @param {string} enumType - Optional enum type for Enum format (e.g., "EAT" for effectAttributeType)
 * @param {string} fileType - The file type (e.g., "Skill", "Effect", etc.) for context-specific formatting
 * @returns {string|number} - The formatted value
 */
function formatValue(value, formatType, enumType = null, fileType = null) {
    // Handle Enum type - convert using GameEnums
    if (formatType === 'Enum' && enumType && value !== null && value !== undefined) {
        // Map common abbreviations to full enum names
        const enumMap = {
            'EAT': 'effectAttributeType',
            'SAT': 'stateAttributeType',
            'ET': 'effectType',
            'PAT': 'playerAttributeType',
            'PT': 'parameterType',
            // Add more mappings as needed
        };
        
        const fullEnumName = enumMap[enumType] || enumType;
        const enumData = state.gameEnums[fullEnumName];
        
        if (enumData && enumData[value]) {
            return enumData[value].name || value;
        }
        
        return value;
    }
    
    // Handle percentage formats
    if (formatType === 'HdPct') {
        // HdPct is already in percent, just multiply by 100 for display
        return (parseFloat(value) * 100).toFixed(2) + '%';
    } else if (formatType === '10KHdPct') {
        // Divide by 100 for percentage (10000 -> 100%)
        return (parseFloat(value) / 100).toFixed(2) + '%';
    } else if (formatType === '10K') {
        // Divide by 10000 (100000 -> 10)
        return (parseFloat(value) / 10000).toFixed(1);
    } else if (formatType === '10KPct') {
        // Divide by 10000 and add % (100000 -> 10%)
        return (parseFloat(value) / 10000).toFixed(1) + '%';
    } else if (formatType === 'Fixed') {
        // Return the value as-is without decimal processing
        return value;
    } else if (formatType === 'Text') {
        // Fetch text from kr/Skill.json only if fileType is "Skill"
        if (fileType && fileType.toLowerCase() === 'skill') {
            if (state.skillNames && state.skillNames[value]) {
                return state.skillNames[value];
            }
        }
        return value;
    }
    
    // Default: return as-is
    return value;
}

/**
 * Extract buff metadata from parameters
 * Looks for BuffValue parameters and extracts Time and TimeSuperposition
 * 
 * @param {object} params - Object containing Param1-Param10 fields
 * @param {number} level - Level for LevelUp calculations (default: 1)
 * @returns {object|null} - Buff metadata or null if no buff found
 */
function extractBuffMetadata(params, level = 1) {
    if (!params) return null;
    
    // Check Param1 through Param10 for BuffValue
    for (let i = 1; i <= 10; i++) {
        const paramString = params[`Param${i}`];
        if (!paramString || typeof paramString !== 'string') continue;
        
        const elements = paramString.split(',').map(e => e.trim());
        if (elements.length < 3) continue;
        
        const [fileType, levelType, baseId] = elements;
        
        // Check if this is a BuffValue parameter
        const dataKey = FILE_TYPE_MAP[fileType.toLowerCase()];
        if (dataKey === 'buffValue' && state.buffValue) {
            let lookupId = baseId;
            
            // Handle LevelUp type
            if (levelType === 'LevelUp') {
                const adjustedId = parseInt(baseId) + (level * 10);
                lookupId = adjustedId.toString();
            }
            
            const buffEntry = state.buffValue[lookupId];
            if (buffEntry && (buffEntry.Time !== undefined || buffEntry.TimeSuperposition !== undefined)) {
                return {
                    time: buffEntry.Time,
                    timeSuperposition: buffEntry.TimeSuperposition
                };
            }
        }
    }
    
    return null;
}

/**
 * Parse and replace parameter placeholders in descriptions
 * Replaces &Param1& through &Param10& with parsed values
 * Also parses element tag patterns like ##빛 속성 표식#1015#
 *
 * @param {string} description - The description with placeholders
 * @param {object} params - Object containing Param1-Param10 fields
 * @param {number} level - Level for LevelUp calculations (default: 1)
 * @param {number} skillLevel - Skill level for DamageNum calculations (default: 1)
 * @param {string} position - The character position (master/assist1/assist2) for HitDamage DamageType lookup
 * @param {boolean} isSpecificPotential - Whether this is a specific potential (Stype 42)
 * @param {number} characterLevelPhase - The character level phase (0-8) for levelTypeData = 4
 * @returns {string} - Description with replaced parameters
 */
function parseDescriptionParams(description, params, level = 1, skillLevel = 1, position = null, isSpecificPotential = false, characterLevelPhase = 8) {
    if (!description || !params) return description;

    // Create cache key from all parameters that affect output
    const paramsHash = Object.keys(params).filter(k => k.startsWith('Param')).map(k => params[k]).join('|');

    // Include actual skill levels from state for accurate caching
    const skillLevelsHash = position && state.skillLevels[position]
        ? JSON.stringify(state.skillLevels[position])
        : '';

    const cacheKey = `${description}_${paramsHash}_${level}_${skillLevel}_${position}_${isSpecificPotential}_${characterLevelPhase}_${state.descriptionMode}_${skillLevelsHash}`;

    // Check cache first
    if (descriptionCache.has(cacheKey)) {
        cacheHits++;
        return descriptionCache.get(cacheKey);
    }

    cacheMisses++;
    let parsedDesc = description;

    // Replace &Param1& through &Param10& with parsed values
    for (let i = 1; i <= 10; i++) {
        const placeholder = `&Param${i}&`;
        const paramString = params[`Param${i}`];

        if (parsedDesc.includes(placeholder) && paramString) {
            const parsed = parseParamValue(paramString, level, skillLevel, position, isSpecificPotential, characterLevelPhase);
            // Wrap the parsed value in a span with styling based on level type and red color flag
            let className = 'param-value';
            if (parsed.useRedColor) {
                className += ' param-red';
            } else if (parsed.levelType === 'NoLevel') {
                className += ' param-no-level';
            }
            const styledValue = `<span class="${className}">${parsed.value}</span>`;
            parsedDesc = parsedDesc.replace(new RegExp(placeholder.replace(/&/g, '&'), 'g'), styledValue);
        }
    }

    // Parse element tag patterns: ##빛 속성 표식#1015#
    parsedDesc = parseElementTags(parsedDesc);

    // Store in cache before returning
    descriptionCache.set(cacheKey, parsedDesc);

    return parsedDesc;
}

/**
 * Parse element tag patterns in descriptions
 * Format: ##ElementName 속성 표식#IconId#
 * Example: ##빛 속성 표식#1015#
 * 
 * @param {string} description - The description with element tags
 * @returns {string} - Description with formatted element tags
 */
function parseElementTags(description) {
    if (!description) return description;
    
    // Element color mapping
    const elementColors = {
        '빛': '#FFD700',    // Yellow/Gold for Light
        '불': '#FF4444',    // Red for Fire
        '바람': '#44FF44',  // Green for Wind
        '물': '#4444FF',    // Blue for Water
        '어둠': '#9944FF',  // Purple for Dark
        '땅': '#8B4513'     // Brown for Earth
    };
    
    // Element icon mapping (including new extended format icons)
    const elementIcons = {
        '1015': 'Icon_ElementTagTrigger_Light',
        '1016': 'Icon_ElementTagTrigger_Fire',
        '1017': 'Icon_ElementTagTrigger_Wind',
        '1018': 'Icon_ElementTagTrigger_Water',
        '1019': 'Icon_ElementTagTrigger_Dark',
        '1020': 'Icon_ElementTagTrigger_Earth',
        // Extended format icons (same icons, different IDs)
        '2016': 'Icon_ElementTagTrigger_Light',  // 광명 (Light)
        '2013': 'Icon_ElementTagTrigger_Fire',   // 성염 (Fire)
        '2017': 'Icon_ElementTagTrigger_Wind',   // 풍식 (Wind)
        '2008': 'Icon_ElementTagTrigger_Water',  // 수류 (Water)
        '2018': 'Icon_ElementTagTrigger_Dark',   // 암영 (Dark)
        '2029': 'Icon_ElementTagTrigger_Earth'   // 지맥 (Earth)
    };
    
    // Pattern 1: ##ElementName 속성 표식: AdditionalName#IconId# (extended format)
    const extendedPattern = /##([가-힣]+)\s*속성\s*표식:\s*([가-힣]+)#(\d+)#/g;
    
    // Pattern 2: ##ElementName 속성 표식#IconId# (basic format)
    const basicPattern = /##([가-힣]+)\s*속성\s*표식#(\d+)#/g;
    
    // First, replace extended format
    let result = description.replace(extendedPattern, (match, elementName, additionalName, iconId) => {
        const color = elementColors[elementName] || '#FFFFFF';
        const iconName = elementIcons[iconId];
        const iconPath = iconName ? `assets/${iconName}.png` : '';
        
        return `<span class="element-tag" style="color: ${color}; font-weight: 600;">
            ${elementName} 속성 표식: ${additionalName}
            ${iconPath ? `<img src="${iconPath}" alt="${elementName}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'">` : ''}
        </span>`;
    });
    
    // Then, replace basic format
    result = result.replace(basicPattern, (match, elementName, iconId) => {
        const color = elementColors[elementName] || '#FFFFFF';
        const iconName = elementIcons[iconId];
        const iconPath = iconName ? `assets/${iconName}.png` : '';
        
        return `<span class="element-tag" style="color: ${color}; font-weight: 600;">
            ${elementName} 속성 표식
            ${iconPath ? `<img src="${iconPath}" alt="${elementName}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'">` : ''}
        </span>`;
    });
    
    return result;
}

// Get skill information for a character
function getCharacterSkills(character, position) {
    const isMaster = position === 'master';

    // Select appropriate skill IDs based on position
    const skillIds = {
        normalAtk: isMaster ? character.data.NormalAtkId : character.data.AssistNormalAtkId,
        skill: isMaster ? character.data.SkillId : character.data.AssistSkillId,
        ultimate: isMaster ? character.data.UltimateId : character.data.AssistUltimateId
    };

    // For assist characters, also add the master skill (SkillId)
    if (!isMaster && character.data.SkillId) {
        skillIds.masterSkill = character.data.SkillId;
    }
    
    // Get skill details from Skill.json
    const skills = {};
    for (const [key, skillId] of Object.entries(skillIds)) {
        if (skillId && state.skills[skillId]) {
            const skill = state.skills[skillId];
            const titleKey = skill.Title;
            const briefKey = skill.BriefDesc;
            const descKey = skill.Desc;
            
            skills[key] = {
                id: skillId,
                data: skill,
                title: titleKey,
                name: state.skillNames[briefKey] || `Skill ${skillId}`,
                briefDesc: briefKey,
                desc: descKey,
                cd: skill.SkillCD || 0,
                maxLevel: skill.MaxLevel || 1,
                icon: skill.Icon || '',
                params: [
                    skill.Param1, skill.Param2, skill.Param3, skill.Param4, skill.Param5,
                    skill.Param6, skill.Param7, skill.Param8, skill.Param9, skill.Param10
                ].filter(p => p !== undefined && p !== null && p !== '')
            };
        }
    }
    
    return skills;
}

// Switch between main tabs (characters, discs, summary)
function switchMainTab(tabName) {
    // Update compact main tab buttons
    document.querySelectorAll('.compact-main-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.compact-main-tab[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Also update old main tab buttons if they exist (for backwards compatibility)
    document.querySelectorAll('.main-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.main-tab-button[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Show/hide position tabs inline based on active main tab
    const positionTabsInline = document.getElementById('position-tabs-inline');
    if (positionTabsInline) {
        if (tabName === 'characters') {
            positionTabsInline.classList.remove('hidden');
        } else {
            positionTabsInline.classList.add('hidden');
        }
    }
    
    // Hide all main tab content
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected main tab content
    const selectedContent = document.getElementById(`main-tab-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
        
        // Trigger content-specific initialization
        if (tabName === 'discs' && typeof renderDiscs === 'function') {
            renderDiscs();
        } else if (tabName === 'summary' && typeof updateSummary === 'function') {
            updateSummary();
        } else if (tabName === 'preset' && typeof window.renderPresets === 'function') {
            window.renderPresets();
        }
    }
}

// Switch between character position tabs (master, assist1, assist2)
function switchTab(tabName) {
    // Update active tab in state
    state.activeTab = tabName;
    
    // Update position tab buttons (compact navigation)
    document.querySelectorAll('.position-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.position-tab[data-position="${tabName}"]`)?.classList.add('active');
    
    // Also update old tab buttons if they exist (for backwards compatibility)
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    const clickedButton = event.target.closest('.tab-button');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // Hide all character slots
    document.querySelectorAll('.character-slot').forEach(slot => {
        slot.classList.remove('active-tab');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active-tab');
    }
}

// Open character selection modal
function openCharacterSelect(position) {
    state.currentPosition = position;
    const modal = document.getElementById('character-modal');
    const searchInput = document.getElementById('character-search');

    // Filter only visible and available characters
    state.characterSelector.allCharacters = Object.entries(state.characters)
        .filter(([id, char]) => char.Visible && char.Available)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([id, char]) => ({
            id,
            char,
            name: state.characterNames[char.Name] || char.Name
        }));

    // Initialize Fuse.js for fuzzy search
    if (typeof Fuse !== 'undefined') {
        state.characterSelector.fuse = new Fuse(state.characterSelector.allCharacters, {
            keys: ['name', 'id'],
            threshold: 0.4,
            includeScore: true
        });
    }

    // Reset filters
    state.characterSelector.selectedElement = 'all';
    if (searchInput) {
        searchInput.value = '';
    }

    // Reset element filter buttons
    document.querySelectorAll('.element-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.element === 'all');
    });

    // Setup search input handler
    if (searchInput) {
        // Remove old event listener if exists
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            renderCharacterGrid(e.target.value);
        });
    }

    // Render initial grid
    renderCharacterGrid('');

    modal.classList.add('active');
}

// Render character grid based on search and filter
function renderCharacterGrid(searchQuery = '') {
    const grid = document.getElementById('character-grid');
    if (!grid) return;

    // Clear existing content
    grid.innerHTML = '';

    let charactersToDisplay = state.characterSelector.allCharacters;

    // Apply element filter
    if (state.characterSelector.selectedElement !== 'all') {
        charactersToDisplay = charactersToDisplay.filter(item =>
            String(item.char.EET) === state.characterSelector.selectedElement
        );
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim() !== '') {
        if (state.characterSelector.fuse) {
            const results = state.characterSelector.fuse.search(searchQuery);
            const searchIds = new Set(results.map(r => r.item.id));
            charactersToDisplay = charactersToDisplay.filter(item => searchIds.has(item.id));
        } else {
            // Fallback to simple string matching
            const query = searchQuery.toLowerCase();
            charactersToDisplay = charactersToDisplay.filter(item =>
                item.name.toLowerCase().includes(query) || item.id.includes(query)
            );
        }
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    if (charactersToDisplay.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-search-state';
        emptyState.innerHTML = '<p>검색 결과가 없습니다</p>';
        fragment.appendChild(emptyState);
    } else {
        charactersToDisplay.forEach(({ id, char, name }) => {
            const charImagePath = `assets/char/avg1_${id}_002.png`;

            // Get star rating from GameEnums
            const rarityInfo = state.gameEnums.itemRarity?.[char.Grade];
            const stars = rarityInfo?.stars || char.Grade;

            // Get element info
            const elementInfo = state.gameEnums.elementType?.[char.EET] || {};

            const item = document.createElement('div');
            item.className = 'character-item';
            item.dataset.action = 'select-character';
            item.dataset.characterId = id;
            item.innerHTML = `
                <div class="character-item-header">
                    <img src="${charImagePath}" alt="${name}" class="character-item-image" onerror="this.style.display='none'">
                    ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="character-element-badge" onerror="this.style.display='none'">` : ''}
                    <div class="character-item-info">
                        <div class="character-item-name">${name}</div>
                        <div class="character-item-id">ID: ${id}</div>
                    </div>
                </div>
                <div class="character-item-id">등급: ${getIcon('star').repeat(stars)}</div>
            `;
            fragment.appendChild(item);
        });
    }

    // Single DOM operation instead of multiple appendChild calls
    grid.appendChild(fragment);
}

// Filter characters by element
function filterCharactersByElement(element) {
    state.characterSelector.selectedElement = element;

    // Update button states
    document.querySelectorAll('.element-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.element === element);
    });

    // Get current search query
    const searchInput = document.getElementById('character-search');
    const searchQuery = searchInput ? searchInput.value : '';

    // Re-render grid
    renderCharacterGrid(searchQuery);
}

// Close character selection modal
function closeCharacterSelect() {
    document.getElementById('character-modal').classList.remove('active');
}

// Remove a character from a position
function removeCharacter(position) {
    // Clear the character from the party
    state.party[position] = null;

    // Clear selected potentials
    state.selectedPotentials[position] = [];

    // Clear potential levels
    state.potentialLevels[position] = {};

    // Clear skill levels
    state.skillLevels[position] = {};

    // Reset character level phase to default
    state.characterLevelPhase[position] = 8;

    // Update the display
    updateCharacterCard(position);
    updatePotentialsDisplay(position);
}

// Select a character
function selectCharacter(characterId) {
    const character = state.characters[characterId];
    const nameKey = character.Name;
    const name = state.characterNames[nameKey] || nameKey;
    
    const position = state.currentPosition;
    
    // Clean up old character data when switching characters
    if (state.party[position] && state.party[position].id !== characterId) {
        // Clear selected potentials
        state.selectedPotentials[position] = [];
        
        // Clear potential levels
        state.potentialLevels[position] = {};
        
        // Clear skill levels
        state.skillLevels[position] = {};
    }
    
    state.party[position] = {
        id: characterId,
        name: name,
        data: character
    };
    
    updateCharacterCard(position);
    updatePotentialsDisplay(position);
    closeCharacterSelect();
}

// Update character card display
function updateCharacterCard(position) {
    const card = document.getElementById(`${position}-card`);
    const character = state.party[position];
    
    if (!character) {
        card.innerHTML = `
            <div class="empty-state">
                <div class="plus-icon">+</div>
                <p>${position === 'master' ? '메인캐릭터 선택' : '지원캐릭터 선택'}</p>
            </div>
        `;
        // Enable click on empty card to select character
        card.style.cursor = 'pointer';
        card.onclick = () => openCharacterSelect(position);
        return;
    }
    
    // Disable click on filled card (we have change/remove buttons instead)
    card.style.cursor = 'default';
    card.onclick = null;
    
    const charImagePath = `assets/char/avg1_${character.id}_002.png`;
    
    // Get star rating from GameEnums
    const rarityInfo = state.gameEnums.itemRarity?.[character.data.Grade];
    const stars = rarityInfo?.stars || character.data.Grade;
    
    // Get element type from GameEnums
    const elementInfo = state.gameEnums.elementType?.[character.data.EET];
    const elementName = elementInfo?.name || character.data.EET;
    const elementIcon = elementInfo?.icon || '';
    
    // Get job class from GameEnums
    const jobClassInfo = state.gameEnums.characterJobClass?.[character.data.Class];
    const jobClassName = jobClassInfo?.name || character.data.Class;
    
    // Get skill information
    const skills = getCharacterSkills(character, position);
    const isMaster = position === 'master';
    const skillLabels = {
        normalAtk: '일반공격',
        skill: isMaster ? '스킬' : '지원',
        ultimate: '필살기',
        masterSkill: '스킬'  // For assist characters showing their master skill
    };
    
    // Initialize skill levels if not set
    if (!state.skillLevels[position]) {
        state.skillLevels[position] = {};
    }
    
    // Get current character level phase
    const currentLevelPhase = state.characterLevelPhase[position] || 8;

    card.innerHTML = `
        <img src="${charImagePath}" alt="${character.name}" class="character-card-image" onerror="this.style.display='none'">
        <div class="character-info">
            <div class="character-action-buttons">
                <button class="change-character-btn" data-action="open-character-select" data-position="${position}">
                    <span class="change-icon">🔄</span>
                    <span>변경</span>
                </button>
                <button class="remove-character-btn" data-action="remove-character" data-position="${position}">
                    <span class="remove-icon">${getIcon('remove')}</span>
                    <span>제거</span>
                </button>
            </div>
            <div class="character-info-header">
                <div class="character-name">${character.name}</div>
                <div class="character-id">ID: ${character.id}</div>
            </div>
            <div class="character-level-phase-selector">
                <label class="level-phase-label">캐릭터 레벨:</label>
                <select class="level-phase-select" data-action="update-character-level-phase" data-position="${position}">
                    <option value="0" ${currentLevelPhase === 0 ? 'selected' : ''}>1+</option>
                    <option value="1" ${currentLevelPhase === 1 ? 'selected' : ''}>10+</option>
                    <option value="2" ${currentLevelPhase === 2 ? 'selected' : ''}>20+</option>
                    <option value="3" ${currentLevelPhase === 3 ? 'selected' : ''}>30+</option>
                    <option value="4" ${currentLevelPhase === 4 ? 'selected' : ''}>40+</option>
                    <option value="5" ${currentLevelPhase === 5 ? 'selected' : ''}>50+</option>
                    <option value="6" ${currentLevelPhase === 6 ? 'selected' : ''}>60+</option>
                    <option value="7" ${currentLevelPhase === 7 ? 'selected' : ''}>70+</option>
                    <option value="8" ${currentLevelPhase === 8 ? 'selected' : ''}>80+</option>
                </select>
            </div>
            <div class="character-stats-enhanced">
                <div class="stat-card stat-grade">
                    <div class="stat-content">
                        <div class="stat-label"><strong>등급</strong></div>
                        <div class="stat-value">${getIcon('star').repeat(stars)}</div>
                    </div>
                </div>
                <div class="stat-card stat-class">
                    <div class="stat-content">
                        <div class="stat-label"><strong>클래스</strong></div>
                        <div class="stat-value">${jobClassName}</div>
                    </div>
                </div>
                <div class="stat-card stat-faction">
                    <div class="stat-content">
                        <div class="stat-label"><strong>세력</strong></div>
                        <div class="stat-value">${character.data.Faction}</div>
                    </div>
                </div>
                <div class="stat-card stat-element">
                    <div class="stat-content">
                        <div class="stat-label"><strong>속성</strong></div>
                        <div class="stat-value">${elementIcon ? `<img src="${elementIcon}" alt="${elementName}" class="element-icon-inline" title="${elementName}" onerror="this.style.display='none'">` : elementName}</div>
                    </div>
                </div>
            </div>
            <div class="character-skills">
                <div class="skills-title">스킬 정보</div>
                ${(isMaster ? ['normalAtk', 'skill', 'ultimate'] : ['normalAtk', 'masterSkill', 'skill', 'ultimate']).map(key => {
                    const skill = skills[key];
                    if (!skill) return '';
                    
                    const iconName = skill.icon ? skill.icon.split('/').pop() : '';
                    const iconPath = iconName ? `assets/skill_icons/${iconName}.png` : '';
                    const currentLevel = state.skillLevels[position][skill.id] || 1;
                    
                    // Check if this skill should have a level selector
                    const hasLevelSelector = key !== 'dodge' && key !== 'specialSkill';
                    
                    // Get element background image
                    const elementId = character.data.EET;
                    const elementBgPath = `assets/skill_icons/skill_btn_b_type_${elementId}.png`;
                    
                    // Get title - use localized version or skill name
                    const titleKey = skill.title || '';
                    const title = state.skillNames[titleKey] || skill.name;
                    
                    // Get description based on mode
                    const descKey = state.descriptionMode === 'brief' ? skill.briefDesc : skill.desc;
                    let description = state.skillNames[descKey] || '';

                    // Get character level phase for this position
                    const charLevelPhase = state.characterLevelPhase[position] || 8;

                    // Parse parameter placeholders in description with skill level
                    description = parseDescriptionParams(description, skill.data, currentLevel, currentLevel, position, false, charLevelPhase);
                    
                    return `
                        <div class="skill-item" data-skill-id="${skill.id}">
                            <div class="skill-icon-wrapper">
                                <img src="${elementBgPath}" alt="" class="skill-icon-bg" onerror="this.style.display='none'">
                                ${iconPath ? `<img src="${iconPath}" alt="${skill.name}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                            </div>
                            <div class="skill-info">
                                <div class="skill-title">${title}</div>
                                ${description ? `<div class="skill-desc">${description}</div>` : ''}
                                <div class="skill-header">
                                    <span class="skill-label">${skillLabels[key]}</span>
                                    ${skill.cd > 0 ? `<span class="skill-label">CD: ${(skill.cd / 10000).toFixed(1)}초</span>` : ''}
                                    ${hasLevelSelector ? `
                                    <div class="skill-level-selector">
                                        <label class="skill-level-label">레벨:</label>
                                        <div class="skill-level-controls">
                                            <button class="level-btn" 
                                                    data-action="update-skill-level"
                                                    data-position="${position}"
                                                    data-skill-id="${skill.id}"
                                                    data-max-level="${skill.maxLevel + SKILL_LEVEL_BONUS}"
                                                    data-delta="-1">−</button>
                                            <input type="text" class="skill-level-input" 
                                                   value="${currentLevel}"
                                                   data-action="update-skill-level"
                                                   data-position="${position}"
                                                   data-skill-id="${skill.id}"
                                                   data-max-level="${skill.maxLevel + SKILL_LEVEL_BONUS}">
                                            <button class="level-btn"
                                                    data-action="update-skill-level"
                                                    data-position="${position}"
                                                    data-skill-id="${skill.id}"
                                                    data-max-level="${skill.maxLevel + SKILL_LEVEL_BONUS}"
                                                    data-delta="1">+</button>
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).filter(html => html).join('')}
            </div>
        </div>
    `;
}

// Update skill level
function updateSkillLevel(position, skillId, value, maxLevel) {
    // maxLevel already includes SKILL_LEVEL_BONUS from the HTML
    const level = Math.max(1, Math.min(parseInt(value) || 1, maxLevel));

    if (!state.skillLevels[position]) {
        state.skillLevels[position] = {};
    }
    state.skillLevels[position][skillId] = level;

    // Re-render to update skill descriptions with new level
    updateCharacterCard(position);

    // Also update potentials display since specific potentials use skill levels
    updatePotentialsDisplay(position);
}

// Update character level phase
function updateCharacterLevelPhase(position, phase) {
    // Validate phase (0-8)
    const validPhase = Math.max(0, Math.min(8, parseInt(phase) || 8));

    if (!state.characterLevelPhase) {
        state.characterLevelPhase = { master: 8, assist1: 8, assist2: 8 };
    }
    state.characterLevelPhase[position] = validPhase;

    // Only update if character exists
    if (!state.party[position]) return;

    // Update skill descriptions without re-rendering the entire card
    updateSkillDescriptions(position);

    // Also update potentials display since they may use character level phase
    updatePotentialsDisplay(position);
}

// Update skill descriptions only (without re-rendering entire card)
function updateSkillDescriptions(position) {
    const character = state.party[position];
    if (!character) return;

    const skills = getCharacterSkills(character, position);
    const isMaster = position === 'master';
    const charLevelPhase = state.characterLevelPhase[position] || 8;

    const skillKeys = isMaster ? ['normalAtk', 'skill', 'ultimate'] : ['normalAtk', 'masterSkill', 'skill', 'ultimate'];

    skillKeys.forEach(key => {
        const skill = skills[key];
        if (!skill) return;

        const currentLevel = state.skillLevels[position]?.[skill.id] || 1;
        const descKey = state.descriptionMode === 'brief' ? skill.briefDesc : skill.desc;
        let description = state.skillNames[descKey] || '';

        // Parse parameter placeholders in description with skill level and character level phase
        description = parseDescriptionParams(description, skill.data, currentLevel, currentLevel, position, false, charLevelPhase);

        // Find the skill description element and update it
        const skillDescElement = document.querySelector(`#${position}-card .skill-item[data-skill-id="${skill.id}"] .skill-desc`);
        if (skillDescElement && description) {
            skillDescElement.innerHTML = description;
        }
    });
}

// Remove character (duplicate - will be called via event delegation)
function removeCharacter(position) {
    state.party[position] = null;

    // Clear all associated data
    state.selectedPotentials[position] = [];
    state.potentialLevels[position] = {};
    state.skillLevels[position] = {};

    // Reset character level phase to default
    state.characterLevelPhase[position] = 8;

    updateCharacterCard(position);
    updatePotentialsDisplay(position);
}

// Toggle potential selection
function togglePotential(potentialId, position) {
    const potential = state.potentials[potentialId];
    if (!potential) return;
    
    const selectedPotentials = state.selectedPotentials[position] || [];
    const index = selectedPotentials.indexOf(potentialId);
    
    if (index > -1) {
        // Remove
        selectedPotentials.splice(index, 1);
        // Also remove the level when deselecting
        if (state.potentialLevels[position]) {
            delete state.potentialLevels[position][potentialId];
        }
    } else {
        // Check if this is a specific potential (Stype === 42 in Item.json)
        const itemData = state.items?.[potentialId];
        const isSpecificPotential = itemData && itemData.Stype === 42;
        
        if (isSpecificPotential) {
            // Count how many specific potentials are already selected
            const selectedSpecificCount = selectedPotentials.filter(id => {
                const item = state.items?.[id];
                return item && item.Stype === 42;
            }).length;
            
            // Only allow 2 specific potentials
            if (selectedSpecificCount >= 2) {
                showError('최대 2개의 캐릭터 전용 잠재력만 선택할 수 있습니다.');
                return;
            }
        }
        
        // Add
        selectedPotentials.push(potentialId);
        // Initialize level to 1 when selecting
        if (!state.potentialLevels[position]) {
            state.potentialLevels[position] = {};
        }
        state.potentialLevels[position][potentialId] = 1;
    }
    
    state.selectedPotentials[position] = selectedPotentials;
    
    // Re-render potentials to update selected state
    updatePotentialsDisplay(position);
}

// Update potential level
function updatePotentialLevel(potentialId, position, newLevel) {
    const potential = state.potentials[potentialId];
    if (!potential) return;
    
    // Calculate actual max level: base 6 + MaxLevel value from data
    const BASE_POTENTIAL_LEVEL = 6;
    const maxLevelBonus = potential.MaxLevel || 0;
    const actualMaxLevel = BASE_POTENTIAL_LEVEL + maxLevelBonus;
    
    // Clamp level between 1 and actualMaxLevel
    const clampedLevel = Math.max(1, Math.min(actualMaxLevel, newLevel));
    
    // Update state
    if (!state.potentialLevels[position]) {
        state.potentialLevels[position] = {};
    }
    state.potentialLevels[position][potentialId] = clampedLevel;
    
    // Re-render potentials to update display
    updatePotentialsDisplay(position);
}

// Validate and sanitize numeric input
function validateNumericInput(value, min, max) {
    // Remove all non-numeric characters except minus sign at start
    let sanitized = value.toString().replace(/[^\d-]/g, '');
    
    // Remove minus signs that aren't at the start
    if (sanitized.indexOf('-') > 0) {
        sanitized = sanitized.replace(/-/g, '');
    }
    
    // Convert to number
    let numValue = parseInt(sanitized);
    
    // If NaN or empty, return min value
    if (isNaN(numValue) || sanitized === '' || sanitized === '-') {
        return min;
    }
    
    // Clamp between min and max
    return Math.max(min, Math.min(max, numValue));
}

// Calculate score for a potential based on its level
function calculatePotentialScore(potentialId, position) {
    const potential = state.potentials[potentialId];
    if (!potential || !potential.BuildScore) return 0;
    
    // Get item data to check if it's a specific potential
    const itemData = state.items?.[potentialId];
    const isSpecificPotential = itemData && itemData.Stype === 42;
    
    if (isSpecificPotential) {
        // Specific potentials always give 180 points
        return 180;
    } else {
        // Normal/common potentials: use level as index into BuildScore array
        const level = state.potentialLevels[position]?.[potentialId] || 1;
        const scoreIndex = level - 1; // Convert 1-based level to 0-based index
        
        // BuildScore array is indexed by level (0-based)
        if (potential.BuildScore[scoreIndex] !== undefined) {
            return potential.BuildScore[scoreIndex];
        }
        
        // Fallback to first score if index is out of bounds
        return potential.BuildScore[0] || 0;
    }
}

// Calculate total character score for a position
function calculateCharacterScore(position) {
    const selectedPotentials = state.selectedPotentials[position] || [];
    let totalScore = 0;
    
    selectedPotentials.forEach(potentialId => {
        totalScore += calculatePotentialScore(potentialId, position);
    });
    
    return totalScore;
}

// Update score display in the slot header
function updateScoreDisplay(position) {
    let scoreDisplay = document.getElementById(`${position}-score-display`);
    
    // Create score display if it doesn't exist
    if (!scoreDisplay) {
        const slotHeader = document.querySelector(`#tab-${position} .slot-header`);
        if (slotHeader) {
            scoreDisplay = document.createElement('div');
            scoreDisplay.id = `${position}-score-display`;
            scoreDisplay.className = 'character-score-display';
            slotHeader.appendChild(scoreDisplay);
        }
    }
    
    if (scoreDisplay) {
        const totalScore = calculateCharacterScore(position);
        scoreDisplay.innerHTML = `<span class="score-label">총 점수:</span> <span class="score-value">${totalScore}</span>`;
    }
}

// Create potential card HTML
function createPotentialCard(potId, position) {
    const potential = state.potentials[potId];
    if (!potential) return '';
    
    // Get the potential name from Item.json using BriefDesc as the key
    const briefDescKey = potential.BriefDesc; // e.g., "Potential.510301.1"
    const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
    const name = itemKey ? (state.itemNames[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
    
    // Get item data for icon and background
    const itemData = state.items?.[potId];
    let backgroundImage = '';
    let iconPath = '';
    
    if (itemData) {
        // Determine background based on Stype and Rarity
        if (itemData.Stype === 42) {
            backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
        } else if (itemData.Stype === 41) {
            if (itemData.Rarity === 1) {
                backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
            } else if (itemData.Rarity === 2) {
                backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
            }
        }
        
        // Get icon path
        if (itemData.Icon) {
            const iconName = itemData.Icon.split('/').pop();
            iconPath = `assets/skill_icons/${iconName}_A.png`;
        }
    }
    
    // Get descriptions from Potential.json (kr)
    const briefKey = `Potential.${potId}.1`;
    const detailedKey = `Potential.${potId}.2`;
    
    // Check if this is a specific potential (Stype === 42)
    const isSpecificPotential = itemData && itemData.Stype === 42;
    
    // Calculate actual max level: base 6 + MaxLevel value from data
    const BASE_POTENTIAL_LEVEL = 6;
    const maxLevelBonus = potential.MaxLevel || 0;
    const actualMaxLevel = BASE_POTENTIAL_LEVEL + maxLevelBonus;
    
    // For specific potentials, use skill level from the character
    // For normal potentials, use potential level
    let currentLevel;
    if (isSpecificPotential) {
        // Get the character's skill level
        const character = state.party[position];
        const isMaster = position === 'master';
        
        // For master: use DamageType to determine which skill (will be handled in parseParamValue)
        // For assist: always use AssistSkillId
        const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
        
        if (character && skillId) {
            currentLevel = state.skillLevels[position]?.[skillId] || 1;
        } else {
            currentLevel = 1;
        }
    } else {
        currentLevel = state.potentialLevels[position]?.[potId] || 1;
    }
    
    let briefDesc = state.potentialNames[briefKey] || '간략한 설명이 없습니다';
    let detailedDesc = state.potentialNames[detailedKey] || '상세한 설명이 없습니다';
    
    // Get skill level for DamageNum parameters
    // For specific potentials, use character's skill level
    // For normal potentials, use the potential's own level
    let skillLevelForParams;
    if (isSpecificPotential) {
        const character = state.party[position];
        const isMaster = position === 'master';
        
        // For master: use DamageType to determine which skill (will be handled in parseParamValue)
        // For assist: always use AssistSkillId
        const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
        
        if (character && skillId) {
            skillLevelForParams = state.skillLevels[position]?.[skillId] || 1;
        } else {
            skillLevelForParams = 1;
        }
    } else {
        // Normal potentials use their own level for DamageNum parameters
        skillLevelForParams = currentLevel;
    }
    
    // Get character level phase for this position
    const charLevelPhase = state.characterLevelPhase[position] || 8;

    // Parse parameter placeholders in descriptions with current level
    briefDesc = parseDescriptionParams(briefDesc, potential, currentLevel, skillLevelForParams, position, isSpecificPotential, charLevelPhase);
    detailedDesc = parseDescriptionParams(detailedDesc, potential, currentLevel, skillLevelForParams, position, isSpecificPotential, charLevelPhase);
    
    // Use the current description mode
    const desc = state.descriptionMode === 'brief' ? briefDesc : detailedDesc;
    
    // Extract buff metadata if present
    const buffMetadata = extractBuffMetadata(potential, currentLevel);
    
    // Get build label from GameEnums
    const buildNumber = potential.Build || 0;
    const buildInfo = state.gameEnums.potentialBuild?.[buildNumber];
    const buildLabel = buildInfo?.name || '';
    
    const isSelected = state.selectedPotentials[position]?.includes(potId);
    
    // Calculate score for this potential if selected
    const score = isSelected ? calculatePotentialScore(potId, position) : 0;
    
    return `
        <div class="potential-card ${isSelected ? 'selected' : ''}" data-build="${buildNumber}">
            ${buildLabel ? `<div class="build-badge">${buildLabel}</div>` : ''}
            ${isSelected ? `<div class="score-badge">점수: ${score}</div>` : ''}
            <div class="potential-card-header" 
                 data-action="toggle-potential" 
                 data-potential-id="${potId}" 
                 data-position="${position}">
                <div class="potential-card-image">
                    ${backgroundImage ? `<img src="${backgroundImage}" alt="" class="potential-bg" onerror="this.style.display='none'">` : ''}
                    ${iconPath ? `<img src="${iconPath}" alt="${name}" class="potential-icon" onerror="this.style.display='none'">` : `<span class="potential-placeholder">${getIcon('target')}</span>`}
                </div>
                <div class="potential-card-info">
                    <div class="potential-card-name">${name}</div>
                    <div class="potential-card-meta">
                        <span>ID: ${potId}</span>
                        ${!isSpecificPotential ? `<span>최대 레벨: ${actualMaxLevel}</span>` : ''}
                    </div>
                </div>
            </div>
            ${isSelected && !isSpecificPotential && actualMaxLevel > 1 ? `
                <div class="potential-level-selector">
                    <div class="potential-level-label">레벨:</div>
                    <div class="potential-level-controls">
                        <button class="level-btn" 
                                data-action="update-potential-level"
                                data-potential-id="${potId}"
                                data-position="${position}"
                                data-max-level="${actualMaxLevel}"
                                data-delta="-1">−</button>
                        <input 
                            type="text" 
                            class="potential-level-input" 
                            value="${currentLevel}"
                            data-action="update-potential-level"
                            data-potential-id="${potId}"
                            data-position="${position}"
                            data-max-level="${actualMaxLevel}"
                        >
                        <button class="level-btn"
                                data-action="update-potential-level"
                                data-potential-id="${potId}"
                                data-position="${position}"
                                data-max-level="${actualMaxLevel}"
                                data-delta="1">+</button>
                    </div>
                </div>
            ` : ''}
            <div class="potential-card-body"
                 data-action="toggle-potential" 
                 data-potential-id="${potId}" 
                 data-position="${position}">
                <div class="potential-card-desc">${desc}</div>
                ${buffMetadata ? `
                    <div class="buff-metadata">
                        ${buffMetadata.time !== undefined ? `
                            <span class="buff-meta-item">
                                <span class="buff-meta-label">지속 시간:</span>
                                <span class="buff-meta-value">${(buffMetadata.time / 10000).toFixed(1)}초</span>
                            </span>
                        ` : ''}
                        ${buffMetadata.timeSuperposition !== undefined ? `
                            <span class="buff-meta-item">
                                <span class="buff-meta-label">지속 갱신방식:</span>
                                <span class="buff-meta-value">${state.gameEnums.timeSuperposition?.[buffMetadata.timeSuperposition]?.name || buffMetadata.timeSuperposition}</span>
                            </span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Toggle description mode
function toggleDescriptionMode() {
    state.descriptionMode = state.descriptionMode === 'brief' ? 'detailed' : 'brief';

    // Clear description cache since mode changed
    clearDescriptionCache();

    // Update all toggle button texts
    const buttons = document.querySelectorAll('.description-toggle');
    const buttonText = state.descriptionMode === 'brief' ? `${getIcon('memo')} 간략히보기` : `${getIcon('summary')} 상세보기`;
    buttons.forEach(button => {
        button.innerHTML = buttonText;
    });

    // Re-render all character cards and potential displays
    if (state.party.master) {
        updateCharacterCard('master');
        updatePotentialsDisplay('master');
    }
    if (state.party.assist1) {
        updateCharacterCard('assist1');
        updatePotentialsDisplay('assist1');
    }
    if (state.party.assist2) {
        updateCharacterCard('assist2');
        updatePotentialsDisplay('assist2');
    }
}

// Update potentials display for a position
function updatePotentialsDisplay(position) {
    const otherContainer = document.getElementById(`${position}-potentials`);
    const specificSection = document.getElementById(`${position}-specific-section`);
    const character = state.party[position];
    
    // Update score display in the slot header
    updateScoreDisplay(position);
    
    otherContainer.innerHTML = '';
    specificSection.innerHTML = '';
    
    if (!character) {
        return;
    }
    
    const charId = character.id;
    const charPotential = state.charPotentials[charId];
    
    if (!charPotential) {
        otherContainer.innerHTML = '<p style="color: var(--text-secondary); padding: 8px; font-size: 0.9rem;">사용 가능한 잠재력이 없습니다</p>';
        return;
    }
    
    // Determine which potentials to show based on position
    const isMaster = position === 'master';
    
    // Get potential IDs
    const specificPotentials = isMaster 
        ? (charPotential.MasterSpecificPotentialIds || [])
        : (charPotential.AssistSpecificPotentialIds || []);
    
    const normalPotentials = isMaster
        ? (charPotential.MasterNormalPotentialIds || [])
        : (charPotential.AssistNormalPotentialIds || []);
    
    const commonPotentials = charPotential.CommonPotentialIds || [];
    
    // Sort all potential arrays by ID
    specificPotentials.sort((a, b) => a - b);
    normalPotentials.sort((a, b) => a - b);
    commonPotentials.sort((a, b) => a - b);
    
    // Display specific potentials in the specific section
    if (specificPotentials.length > 0) {
        specificSection.innerHTML = `
            <div class="potential-section-title">${isMaster ? '마스터' : '어시스트'} 전용 잠재력</div>
            ${specificPotentials.map(potId => createPotentialCard(potId, position)).join('')}
        `;
    }
    
    // Combine normal and common potentials
    const allNormalCommonPotentials = [...normalPotentials, ...commonPotentials];
    
    // Create single section for normal and common potentials
    if (allNormalCommonPotentials.length > 0) {
        const section = document.createElement('div');
        section.className = 'potential-category';
        section.innerHTML = `
            <div class="potential-category-title">${isMaster ? '마스터' : '어시스트'} 일반 및 공용 잠재력</div>
            <div class="normal-common-grid">
                ${allNormalCommonPotentials.map(potId => createPotentialCard(potId, position)).join('')}
            </div>
        `;
        otherContainer.appendChild(section);
    }
}

// Modal click handler with proper cleanup
let characterModalClickHandler = null;

function setupCharacterModalHandler() {
    const characterModal = document.getElementById('character-modal');
    if (!characterModal) return;
    
    // Remove old handler if exists
    if (characterModalClickHandler) {
        window.removeEventListener('click', characterModalClickHandler);
    }
    
    // Create new handler
    characterModalClickHandler = function(event) {
        if (event.target === characterModal) {
            closeCharacterSelect();
        }
    };
    
    window.addEventListener('click', characterModalClickHandler);
}

// Call setup when needed
setupCharacterModalHandler();

// ============================================================================
// EVENT DELEGATION SYSTEM
// ============================================================================

/**
 * Centralized event delegation to replace inline onclick handlers
 * This prevents memory leaks and improves performance
 */
document.addEventListener('DOMContentLoaded', function() {
    // Delegate all clicks on the document
    document.addEventListener('click', function(e) {
        const target = e.target;
        const action = target.dataset.action;
        
        if (!action) {
            // Check if clicked element is inside a button with data-action
            const button = target.closest('[data-action]');
            if (button) {
                handleDelegatedAction(button, e);
            }
            return;
        }
        
        handleDelegatedAction(target, e);
    });
    
    // Delegate input changes
    document.addEventListener('change', function(e) {
        const target = e.target;
        const action = target.dataset.action;
        
        if (action) {
            handleDelegatedAction(target, e);
        }
    });
    
    // Delegate input events for real-time updates
    document.addEventListener('input', function(e) {
        const target = e.target;
        const action = target.dataset.action;
        
        if (action === 'update-potential-level' && target.classList.contains('potential-level-input')) {
            const maxLevel = parseInt(target.dataset.maxLevel);
            target.value = validateNumericInput(target.value, 1, maxLevel);
        }
        
        if (action === 'update-skill-level' && target.classList.contains('skill-level-input')) {
            const maxLevel = parseInt(target.dataset.maxLevel);
            target.value = validateNumericInput(target.value, 1, maxLevel);
        }
    });
});

/**
 * Handle delegated actions based on data-action attribute
 */
function handleDelegatedAction(element, event) {
    const action = element.dataset.action;
    if (!action) return;
    
    switch(action) {
        // Character actions
        case 'open-character-select':
            openCharacterSelect(element.dataset.position);
            break;
            
        case 'select-character':
            selectCharacter(element.dataset.characterId);
            break;
            
        case 'remove-character':
            removeCharacter(element.dataset.position);
            break;
            
        case 'close-character-select':
            closeCharacterSelect();
            break;
            
        // Skill level actions
        case 'update-skill-level':
            {
                const position = element.dataset.position;
                const skillId = parseInt(element.dataset.skillId);
                const maxLevel = parseInt(element.dataset.maxLevel);
                const delta = parseInt(element.dataset.delta || 0);
                const currentLevel = state.skillLevels[position]?.[skillId] || 1;
                
                if (delta !== 0) {
                    // Button click
                    updateSkillLevel(position, skillId, currentLevel + delta, maxLevel);
                } else {
                    // Input change
                    const value = validateNumericInput(element.value, 1, maxLevel);
                    updateSkillLevel(position, skillId, value, maxLevel);
                }
            }
            break;
            
        // Potential actions
        case 'toggle-potential':
            togglePotential(parseInt(element.dataset.potentialId), element.dataset.position);
            break;
            
        case 'update-potential-level':
            {
                const potentialId = parseInt(element.dataset.potentialId);
                const position = element.dataset.position;
                const delta = parseInt(element.dataset.delta || 0);
                const maxLevel = parseInt(element.dataset.maxLevel);
                const currentLevel = state.potentialLevels[position]?.[potentialId] || 1;
                
                if (delta !== 0) {
                    // Button click
                    updatePotentialLevel(potentialId, position, currentLevel + delta);
                } else {
                    // Input change
                    const value = validateNumericInput(element.value, 1, maxLevel);
                    updatePotentialLevel(potentialId, position, value);
                }
            }
            break;
            
        // Description toggle
        case 'toggle-description':
            toggleDescriptionMode();
            break;

        // Character level phase
        case 'update-character-level-phase':
            {
                const position = element.dataset.position;
                const phase = parseInt(element.value);
                updateCharacterLevelPhase(position, phase);
            }
            break;

        default:
            // Unknown action
            break;
    }
}

// Expose functions for inline handlers (until fully migrated to event delegation)
window.filterCharactersByElement = filterCharactersByElement;
