// Tasks Page State
const tasksState = {
    allTasks: [],
    selectedTasks: [],
    characters: [],
    characterNames: {},
    characterTags: {},
    taskStrings: {},
    tagStrings: {},
    maxTasks: 4,
    maxCharactersPerTask: 3,
    // taskId -> [charId1, charId2, charId3]
    assignedCharacters: {},
    // Track which tags are filled for each task: taskId -> { tagId: count }
    filledTagSlots: {},
    // Track which tags each character is filling: taskId -> { charId: [tagIds] }
    characterFilledTag: {},
    // Currently selected task for character assignment
    activeTaskId: null,
    // Character ownership tracking
    ownedCharacters: new Set(),
    // Character filter: 'all', 'owned', 'not-owned'
    characterFilter: 'all',
    // Insights panel state
    insightsPanelCollapsed: true
};

// Lookup Caches (Priority 2: Performance)
const lookupCache = {
    taskTitles: new Map(),
    taskSubtitles: new Map(),
    characterNames: new Map(),
    tagNames: new Map(),
    characterTags: new Map(),
    taskTagCounts: new Map()
};

// Utility Functions (Priority 3: Extract duplicate logic)
function getTagCounts(task) {
    const cacheKey = task.Id;
    if (lookupCache.taskTagCounts.has(cacheKey)) {
        return lookupCache.taskTagCounts.get(cacheKey);
    }
    
    const requiredTagCounts = {};
    const extraTagCounts = {};
    
    (task.Tags || []).forEach(tag => {
        requiredTagCounts[tag] = (requiredTagCounts[tag] || 0) + 1;
    });
    
    (task.ExtraTags || []).forEach(tag => {
        extraTagCounts[tag] = (extraTagCounts[tag] || 0) + 1;
    });
    
    const result = { required: requiredTagCounts, extra: extraTagCounts };
    lookupCache.taskTagCounts.set(cacheKey, result);
    return result;
}

function getTranslatedTaskTitle(task) {
    const cacheKey = `title_${task.Id}`;
    if (lookupCache.taskTitles.has(cacheKey)) {
        return lookupCache.taskTitles.get(cacheKey);
    }
    const title = tasksState.taskStrings[task.Note] || task.Note;
    lookupCache.taskTitles.set(cacheKey, title);
    return title;
}

function getTranslatedTaskSubtitle(task) {
    const cacheKey = `subtitle_${task.Id}`;
    if (lookupCache.taskSubtitles.has(cacheKey)) {
        return lookupCache.taskSubtitles.get(cacheKey);
    }
    const subtitle = tasksState.taskStrings[task.Name] || task.Name;
    lookupCache.taskSubtitles.set(cacheKey, subtitle);
    return subtitle;
}

function getTranslatedCharacterName(char) {
    const cacheKey = char.Id;
    if (lookupCache.characterNames.has(cacheKey)) {
        return lookupCache.characterNames.get(cacheKey);
    }
    const nameKey = char.Name;
    const name = tasksState.characterNames[nameKey] || nameKey;
    lookupCache.characterNames.set(cacheKey, name);
    return name;
}

function getTranslatedTagName(tag) {
    const cacheKey = tag;
    if (lookupCache.tagNames.has(cacheKey)) {
        return lookupCache.tagNames.get(cacheKey);
    }
    const tagName = tasksState.tagStrings[`CharacterTag.${tag}.1`] || tag;
    lookupCache.tagNames.set(cacheKey, tagName);
    return tagName;
}

function getCharacterTags(charId) {
    const cacheKey = charId;
    if (lookupCache.characterTags.has(cacheKey)) {
        return lookupCache.characterTags.get(cacheKey);
    }
    const charDesData = tasksState.characterTags[charId];
    const tags = charDesData?.Tag || [];
    lookupCache.characterTags.set(cacheKey, tags);
    return tags;
}

function canCharacterFillTag(charId, taskId, tag) {
    const charTags = getCharacterTags(charId);
    if (!charTags.includes(tag)) return false;
    
    const task = tasksState.selectedTasks.find(t => t.Id === taskId);
    if (!task) return false;
    
    const allTaskTags = [...(task.Tags || []), ...(task.ExtraTags || [])];
    if (!allTaskTags.includes(tag)) return false;
    
    const filledSlots = tasksState.filledTagSlots[taskId] || {};
    const tagCounts = getTagCounts(task);
    const currentFilled = filledSlots[tag] || 0;
    const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
    
    return currentFilled < totalRequired;
}

function clearLookupCaches() {
    lookupCache.taskTitles.clear();
    lookupCache.taskSubtitles.clear();
    lookupCache.characterNames.clear();
    lookupCache.tagNames.clear();
    lookupCache.characterTags.clear();
    lookupCache.taskTagCounts.clear();
}

// Character Ownership Management
function loadOwnership() {
    try {
        const saved = localStorage.getItem('tasksOwnedCharacters');
        if (saved) {
            const ownedArray = JSON.parse(saved);
            tasksState.ownedCharacters = new Set(ownedArray);
        }
    } catch (error) {
        console.error('Error loading ownership:', error);
    }
}

function saveOwnership() {
    try {
        const ownedArray = Array.from(tasksState.ownedCharacters);
        localStorage.setItem('tasksOwnedCharacters', JSON.stringify(ownedArray));
    } catch (error) {
        console.error('Error saving ownership:', error);
    }
}

function toggleOwnership(charId) {
    if (tasksState.ownedCharacters.has(charId)) {
        tasksState.ownedCharacters.delete(charId);
    } else {
        tasksState.ownedCharacters.add(charId);
    }
    saveOwnership();
}

function selectAllOwned() {
    const validCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???';
    });
    validCharacters.forEach(char => tasksState.ownedCharacters.add(char.Id));
    saveOwnership();
    renderOwnershipGrid();
    updateOwnershipCount();
}

function deselectAllOwned() {
    tasksState.ownedCharacters.clear();
    saveOwnership();
    renderOwnershipGrid();
    updateOwnershipCount();
}

function updateOwnershipCount() {
    const total = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???';
    }).length;
    const owned = tasksState.ownedCharacters.size;
    const countElement = document.getElementById('ownership-count');
    if (countElement) {
        countElement.textContent = `소유: ${owned} / ${total}`;
    }
}

// Ownership Modal Functions
function openOwnershipModal() {
    const modal = document.getElementById('ownership-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        renderOwnershipGrid();
        updateOwnershipCount();
    }
}

function closeOwnershipModal() {
    const modal = document.getElementById('ownership-modal');
    if (modal) {
        modal.style.display = 'none';
        // Re-render characters to show ownership changes
        renderCharacters();
        renderInsights();
    }
}

function renderOwnershipGrid() {
    const container = document.getElementById('ownership-grid');
    if (!container) return;

    const validCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???';
    });

    container.innerHTML = validCharacters.map(char => {
        const name = getTranslatedCharacterName(char);
        const imagePath = `assets/char/avg1_${char.Id}_002.png`;
        const isOwned = tasksState.ownedCharacters.has(char.Id);

        return `
            <div class="ownership-card ${isOwned ? 'owned' : ''}" data-ownership-char-id="${char.Id}">
                <img src="${imagePath}" alt="${name}" class="ownership-card-image" onerror="this.style.display='none'">
                <div class="ownership-card-name">${name}</div>
                <div class="ownership-card-id">ID: ${char.Id}</div>
            </div>
        `;
    }).join('');
}

// Character Filter Functions
function setCharacterFilter(filter) {
    tasksState.characterFilter = filter;

    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderCharacters();
}

// Load all required data
async function loadTasksData() {
    try {
        const [agentData, agentKR, characterData, characterDesData, characterTagKR] = await Promise.all([
            fetch('data/Agent.json').then(r => r.json()),
            fetch('data/kr/Agent.json').then(r => r.json()),
            fetch('data/Character.json').then(r => r.json()),
            fetch('data/CharacterDes.json').then(r => r.json()),
            fetch('data/kr/CharacterTag.json').then(r => r.json())
        ]);

        // Filter tasks with Level 70
        tasksState.allTasks = Object.values(agentData).filter(task => task.Level === 70);
        tasksState.taskStrings = agentKR;
        tasksState.tagStrings = characterTagKR;

        // Prepare character data
        tasksState.characters = Object.values(characterData);
        tasksState.characterNames = await fetch('data/kr/Character.json').then(r => r.json());
        tasksState.characterTags = characterDesData;

        // Load ownership from localStorage
        loadOwnership();

        // Clear caches on data reload
        clearLookupCaches();

        renderTasks();
        renderCharacters();
        renderInsights();
    } catch (error) {
        console.error('Error loading tasks data:', error);
        showError('데이터를 불러오는데 실패했습니다.');
    }
}

// Render tasks list
function renderTasks() {
    const container = document.getElementById('tasks-list');
    
    if (tasksState.allTasks.length === 0) {
        container.innerHTML = `<div class="empty-state-tasks"><div class="empty-state-icon">${getIcon('tasks')}</div><div class="empty-state-text">과제가 없습니다</div></div>`;
        return;
    }

    container.innerHTML = tasksState.allTasks.map(task => {
        const title = getTranslatedTaskTitle(task);
        const subtitle = getTranslatedTaskSubtitle(task);
        const isSelected = tasksState.selectedTasks.some(t => t.Id === task.Id);
        const isDisabled = !isSelected && tasksState.selectedTasks.length >= tasksState.maxTasks;
        
        return `
            <div class="task-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                 data-task-id="${task.Id}">
                <div class="task-header">
                    <div class="task-title">${title}</div>
                    <div class="task-subtitle">${subtitle}</div>
                </div>
                ${(task.Tags || []).length > 0 ? `
                <div class="task-tags-row">
                    <div class="task-tags-label">필수</div>
                    <div class="task-tags">
                        ${(task.Tags || []).map(tag => {
                            const tagName = getTranslatedTagName(tag);
                            return `<span class="task-tag required"><span class="tag-icon">${getIcon('star')}</span>${tagName}</span>`;
                        }).join('')}
                    </div>
                </div>
                ` : ''}
                ${(task.ExtraTags || []).length > 0 ? `
                <div class="task-tags-row">
                    <div class="task-tags-label">추가</div>
                    <div class="task-tags">
                        ${(task.ExtraTags || []).map(tag => {
                            const tagName = getTranslatedTagName(tag);
                            return `<span class="task-tag extra"><span class="tag-icon">✨</span>${tagName}</span>`;
                        }).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Toggle task selection
function toggleTaskSelection(taskId) {
    const task = tasksState.allTasks.find(t => t.Id === taskId);
    if (!task) return;

    const index = tasksState.selectedTasks.findIndex(t => t.Id === taskId);
    
    if (index > -1) {
        // Remove task and its assigned characters
        tasksState.selectedTasks.splice(index, 1);
        delete tasksState.assignedCharacters[taskId];
        delete tasksState.filledTagSlots[taskId];
        delete tasksState.characterFilledTag[taskId];
        
        // If removing the active task, clear active state
        if (tasksState.activeTaskId === taskId) {
            tasksState.activeTaskId = null;
        }
    } else {
        // Add task if under limit
        if (tasksState.selectedTasks.length >= tasksState.maxTasks) {
            showWarning(`최대 ${tasksState.maxTasks}개의 과제만 선택할 수 있습니다.`);
            return;
        }
        tasksState.selectedTasks.push(task);
        tasksState.assignedCharacters[taskId] = [];
        tasksState.filledTagSlots[taskId] = {};
        tasksState.characterFilledTag[taskId] = {};
    }

    renderTasks();
    renderSelectedTasks();
    renderCharacters();
    updateTaskCounter();
    renderInsights();
}

// Render selected tasks
function renderSelectedTasks() {
    const container = document.getElementById('selected-tasks');
    
    if (tasksState.selectedTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state-tasks">
                <div class="empty-state-icon">${getIcon('memo')}</div>
                <div class="empty-state-text">선택된 과제가 없습니다</div>
                <div class="empty-state-hint">위에서 과제를 선택해주세요</div>
            </div>
        `;
        return;
    }

    container.innerHTML = tasksState.selectedTasks.map(task => {
        const title = getTranslatedTaskTitle(task);
        const subtitle = getTranslatedTaskSubtitle(task);
        
        // Get tag counts using utility function first
        const tagCounts = getTagCounts(task);
        const filledTagSlots = tasksState.filledTagSlots[task.Id] || {};
        
        // Get unique required and extra tag names
        const uniqueRequiredTags = [...new Set(task.Tags || [])];
        const uniqueExtraTags = [...new Set(task.ExtraTags || [])];
        
        const requiredTags = uniqueRequiredTags.map(tag => ({
            id: tag,
            name: getTranslatedTagName(tag)
        }));
        
        const extraTags = uniqueExtraTags.map(tag => ({
            id: tag,
            name: getTranslatedTagName(tag)
        }));

        // Get assigned characters for this task
        const assignedChars = tasksState.assignedCharacters[task.Id] || [];

        const isActive = tasksState.activeTaskId === task.Id;
        
        return `
            <div class="selected-task-card ${isActive ? 'active' : ''}" data-selected-task-id="${task.Id}">
                <div class="selected-task-header">
                    <div class="selected-task-info">
                        <div class="selected-task-title">${title}</div>
                        <div class="selected-task-subtitle">${subtitle}</div>
                    </div>
                    <button class="remove-task-btn" data-remove-task-id="${task.Id}">
                        ×
                    </button>
                </div>
                
                <div class="assigned-characters-portraits">
                    ${renderAssignedCharacterPortraits(assignedChars)}
                </div>
                
                <div class="assigned-characters" data-task-slots="${task.Id}">
                    ${renderCharacterSlots(task.Id, assignedChars)}
                </div>
                
                <div class="task-requirements">
                    ${requiredTags.length > 0 ? `
                        <div class="requirement-group">
                            <div class="requirement-label">필수 태그</div>
                            <div class="requirement-tags">
                                ${requiredTags.map(tag => {
                                    const required = tagCounts.required[tag.id] || 0;
                                    const totalFilled = filledTagSlots[tag.id] || 0;
                                    const filled = Math.min(totalFilled, required);
                                    const isFilled = filled >= required;
                                    return `<span class="requirement-tag required ${isFilled ? 'filled' : ''}">${tag.name} (${filled}/${required})</span>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${extraTags.length > 0 ? `
                        <div class="requirement-group">
                            <div class="requirement-label">추가 태그</div>
                            <div class="requirement-tags">
                                ${extraTags.map(tag => {
                                    const required = tagCounts.required[tag.id] || 0;
                                    const extra = tagCounts.extra[tag.id] || 0;
                                    const totalFilled = filledTagSlots[tag.id] || 0;
                                    // Extra tags only count after required tags are filled
                                    const filledExtra = Math.max(0, totalFilled - required);
                                    const isFilled = filledExtra > 0;
                                    return `<span class="requirement-tag extra ${isFilled ? 'filled' : ''}">${tag.name} (${filledExtra}/${extra})</span>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Update task counter
function updateTaskCounter() {
    const counter = document.getElementById('task-counter');
    if (counter) {
        counter.textContent = `${tasksState.selectedTasks.length}/${tasksState.maxTasks}`;
    }
}

// Render characters
function renderCharacters() {
    const container = document.getElementById('characters-list');

    // Filter out characters with "???" as name
    let validCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???';
    });

    // Apply ownership filter
    if (tasksState.characterFilter === 'owned') {
        validCharacters = validCharacters.filter(char => tasksState.ownedCharacters.has(char.Id));
    } else if (tasksState.characterFilter === 'not-owned') {
        validCharacters = validCharacters.filter(char => !tasksState.ownedCharacters.has(char.Id));
    }

    // If a task is active, sort characters by tag matching
    if (tasksState.activeTaskId) {
        const activeTask = tasksState.selectedTasks.find(t => t.Id === tasksState.activeTaskId);
        if (activeTask) {
            // Get remaining unfilled tags
            const filledSlots = tasksState.filledTagSlots[tasksState.activeTaskId] || {};
            const tagCounts = getTagCounts(activeTask);
            const allTaskTags = [...(activeTask.Tags || []), ...(activeTask.ExtraTags || [])];
            const activeTaskChars = tasksState.assignedCharacters[tasksState.activeTaskId] || [];

            // Pre-calculate fillable counts for better performance
            const characterFillableScores = new Map();

            validCharacters.forEach(char => {
                const charTags = getCharacterTags(char.Id);
                const canFillCount = charTags.filter(tag => {
                    if (allTaskTags.includes(tag)) {
                        const currentFilled = filledSlots[tag] || 0;
                        const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
                        return currentFilled < totalRequired;
                    }
                    return false;
                }).length;
                characterFillableScores.set(char.Id, canFillCount);
            });

            // Sort by: assigned to active task first, then ownership, then fillable score
            validCharacters.sort((a, b) => {
                const aAssigned = activeTaskChars.includes(a.Id) ? 1 : 0;
                const bAssigned = activeTaskChars.includes(b.Id) ? 1 : 0;
                if (aAssigned !== bAssigned) return bAssigned - aAssigned;

                const aOwned = tasksState.ownedCharacters.has(a.Id) ? 1 : 0;
                const bOwned = tasksState.ownedCharacters.has(b.Id) ? 1 : 0;
                if (aOwned !== bOwned) return bOwned - aOwned;

                const aScore = characterFillableScores.get(a.Id) || 0;
                const bScore = characterFillableScores.get(b.Id) || 0;
                return bScore - aScore;
            });
        }
    } else {
        // No active task - just sort by ownership
        validCharacters.sort((a, b) => {
            const aOwned = tasksState.ownedCharacters.has(a.Id) ? 1 : 0;
            const bOwned = tasksState.ownedCharacters.has(b.Id) ? 1 : 0;
            return bOwned - aOwned;
        });
    }
    
    if (validCharacters.length === 0) {
        container.innerHTML = `<div class="empty-state-tasks"><div class="empty-state-icon">${getIcon('people')}</div><div class="empty-state-text">캐릭터가 없습니다</div></div>`;
        return;
    }

    container.innerHTML = validCharacters.map(char => {
        const name = getTranslatedCharacterName(char);
        const tags = getCharacterTags(char.Id);
        const imagePath = `assets/char/avg1_${char.Id}_002.png`;
        const isOwned = tasksState.ownedCharacters.has(char.Id);

        // Check if character is assigned to the active task
        let isAssignedToActiveTask = false;
        if (tasksState.activeTaskId) {
            const activeTaskChars = tasksState.assignedCharacters[tasksState.activeTaskId] || [];
            isAssignedToActiveTask = activeTaskChars.includes(char.Id);
        }

        // Check if character is assigned to any other task
        const isAssignedToOtherTask = Object.entries(tasksState.assignedCharacters).some(([taskId, chars]) => {
            return (!tasksState.activeTaskId || parseInt(taskId) !== tasksState.activeTaskId) && chars.includes(char.Id);
        });

        // Check if character can fill remaining slots in active task
        let canFillRemainingSlots = false;

        if (tasksState.activeTaskId && !isAssignedToActiveTask) {
            const activeTask = tasksState.selectedTasks.find(t => t.Id === tasksState.activeTaskId);
            if (activeTask) {
                const allTaskTags = [...(activeTask.Tags || []), ...(activeTask.ExtraTags || [])];
                const filledSlots = tasksState.filledTagSlots[tasksState.activeTaskId] || {};
                const tagCounts = getTagCounts(activeTask);

                // Check if character can fill any remaining unfilled slots
                canFillRemainingSlots = tags.some(charTag => {
                    if (allTaskTags.includes(charTag)) {
                        const currentFilled = filledSlots[charTag] || 0;
                        const totalRequired = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
                        return currentFilled < totalRequired;
                    }
                    return false;
                });
            }
        }

        // Determine if card should be clickable
        const isClickable = tasksState.selectedTasks.length > 0 && tasksState.activeTaskId && !isAssignedToOtherTask;
        const cursorClass = !isClickable ? 'not-clickable' : '';

        return `
            <div class="character-card-small ${isOwned ? 'owned' : ''} ${isAssignedToActiveTask ? 'selected' : ''} ${isAssignedToOtherTask ? 'disabled' : ''} ${canFillRemainingSlots ? 'highlighted' : ''} ${cursorClass}" data-character-id="${char.Id}">
                <img src="${imagePath}" alt="${name}" class="character-image-small" onerror="this.style.display='none'">
                <div class="character-name-small">${name}</div>
                <div class="character-id-small">ID: ${char.Id}</div>
                <div class="character-tags-small">
                    ${tags.map(tag => {
                        const tagName = getTranslatedTagName(tag);
                        // Highlight tags that can fill remaining slots
                        let isMatching = false;
                        if (tasksState.activeTaskId && !isAssignedToActiveTask) {
                            isMatching = canCharacterFillTag(char.Id, tasksState.activeTaskId, tag);
                        }
                        return `<span class="character-tag-badge ${isMatching ? 'matching' : ''}">${tagName}</span>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Render assigned character portraits (small version in task card header area)
function renderAssignedCharacterPortraits(assignedChars) {
    if (!assignedChars || assignedChars.length === 0 || assignedChars.every(c => !c)) {
        return '<div class="portraits-empty">할당된 캐릭터 없음</div>';
    }
    
    return assignedChars.filter(c => c).map(charId => {
        const char = tasksState.characters.find(c => c.Id === charId);
        if (!char) return '';
        
        const name = getTranslatedCharacterName(char);
        const imagePath = `assets/char/avg1_${char.Id}_002.png`;
        
        return `
            <div class="assigned-portrait" title="${name}">
                <img src="${imagePath}" alt="${name}" onerror="this.style.display='none'">
            </div>
        `;
    }).join('');
}

// Select a task for character assignment
function selectTask(taskId) {
    if (tasksState.activeTaskId === taskId) {
        // Deselect if clicking the same task
        tasksState.activeTaskId = null;
    } else {
        tasksState.activeTaskId = taskId;
    }
    renderSelectedTasks();
    renderCharacters();
    renderInsights();
}

// Render character slots for a task
function renderCharacterSlots(taskId, assignedChars) {
    const slots = [];
    for (let i = 0; i < tasksState.maxCharactersPerTask; i++) {
        const charId = assignedChars[i];
        if (charId) {
            const char = tasksState.characters.find(c => c.Id === charId);
            if (char) {
                const name = getTranslatedCharacterName(char);
                const imagePath = `assets/char/avg1_${char.Id}_002.png`;
                const charTags = getCharacterTags(char.Id);
                
                // Get task tags for matching
                const task = tasksState.selectedTasks.find(t => t.Id === taskId);
                const taskTags = new Set([...(task?.Tags || []), ...(task?.ExtraTags || [])]);
                
                slots.push(`
                    <div class="character-slot filled">
                        <button class="remove-character-btn" data-remove-char-task="${taskId}" data-remove-char-slot="${i}">×</button>
                        <img src="${imagePath}" alt="${name}" class="slot-image" onerror="this.style.display='none'">
                        <div class="slot-name">${name}</div>
                        <div class="slot-id">ID: ${char.Id}</div>
                        <div class="character-slot-tags">
                            ${charTags.map(tag => {
                                const matches = taskTags.has(tag);
                                const tagName = getTranslatedTagName(tag);
                                return `<span class="slot-tag ${matches ? 'matches' : ''}">${tagName}</span>`;
                            }).join('')}
                        </div>
                    </div>
                `);
            }
        } else {
            slots.push(`
                <div class="character-slot" data-add-char-task="${taskId}" data-add-char-slot="${i}">
                    <div class="slot-placeholder">+</div>
                    <div class="slot-text">캐릭터 추가</div>
                </div>
            `);
        }
    }
    return slots.join('');
}

// Handle character click
function onCharacterClick(charId) {
    // If no tasks selected, just show info
    if (tasksState.selectedTasks.length === 0) {
        showWarning('먼저 과제를 선택해주세요. 위에서 최대 4개의 과제를 선택할 수 있습니다.');
        return;
    }
    
    // If no active task, show message to select a task
    if (!tasksState.activeTaskId) {
        showWarning('캐릭터를 추가할 과제를 먼저 선택해주세요. 선택된 과제 카드를 클릭하세요.');
        return;
    }
    
    const activeTask = tasksState.selectedTasks.find(t => t.Id === tasksState.activeTaskId);
    const taskTitle = getTranslatedTaskTitle(activeTask);
    
    // Check if character is already assigned to the active task
    const assignedChars = tasksState.assignedCharacters[tasksState.activeTaskId] || [];
    const assignedIndex = assignedChars.findIndex(c => c === charId);
    
    if (assignedIndex >= 0) {
        // Character is already assigned to this task - remove it (deselect)
        removeCharacterFromTask(tasksState.activeTaskId, assignedIndex);
        return;
    }
    
    // Check if all slots are full first
    const nonNullChars = assignedChars.filter(c => c !== null && c !== undefined);
    if (nonNullChars.length >= tasksState.maxCharactersPerTask) {
        showError(`"${taskTitle}" 과제의 모든 캐릭터 슬롯(${tasksState.maxCharactersPerTask}개)이 가득 찼습니다. 캐릭터를 제거한 후 다시 시도하세요.`);
        return;
    }
    
    // Check if character is assigned to any other task (should be disabled)
    const isAssignedElsewhere = Object.entries(tasksState.assignedCharacters).some(([taskId, chars]) => {
        return parseInt(taskId) !== tasksState.activeTaskId && chars.includes(charId);
    });
    
    if (isAssignedElsewhere) {
        const char = tasksState.characters.find(c => c.Id === charId);
        const charName = getTranslatedCharacterName(char);
        showError(`${charName}는 이미 다른 과제에 할당되어 있습니다. 각 캐릭터는 하나의 과제에만 할당할 수 있습니다.`);
        return;
    }
    
    // Get character info
    const char = tasksState.characters.find(c => c.Id === charId);
    const charName = getTranslatedCharacterName(char);
    const charTags = getCharacterTags(charId);
    
    // Get task tags
    const taskTags = [...(activeTask?.Tags || []), ...(activeTask?.ExtraTags || [])];
    const requiredTags = activeTask?.Tags || [];
    
    // Check if character has any matching tags
    const matchingTags = charTags.filter(charTag => taskTags.includes(charTag));
    
    if (matchingTags.length === 0) {
        const charTagNames = charTags.map(tag => getTranslatedTagName(tag)).join(', ');
        const requiredTagNames = requiredTags.map(tag => getTranslatedTagName(tag)).join(', ');
        showError(`${charName}는 이 과제의 태그와 일치하지 않습니다.\n\n캐릭터 태그: ${charTagNames}\n필요한 태그: ${requiredTagNames}`);
        return;
    }
    
    // Check if character can fill any remaining slots
    const filledSlots = tasksState.filledTagSlots[tasksState.activeTaskId] || {};
    const tagCounts = getTagCounts(activeTask);
    
    // Find which tags this character can fill (only unfilled slots)
    const tagsCanFill = matchingTags.filter(charTag => {
        const currentFilled = filledSlots[charTag] || 0;
        const totalRequired = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
        return currentFilled < totalRequired;
    });
    
    if (tagsCanFill.length === 0) {
        const matchingTagNames = matchingTags.map(tag => {
            const tagName = getTranslatedTagName(tag);
            const filled = filledSlots[tag] || 0;
            const total = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
            return `${tagName} (${filled}/${total})`;
        }).join(', ');
        showWarning(`${charName}의 태그는 이미 모두 채워졌습니다.\n\n일치하는 태그: ${matchingTagNames}\n\n다른 캐릭터를 선택하거나 기존 캐릭터를 제거해주세요.`);
        return;
    }
    
    // All checks passed - assign character
    const emptySlotIndex = assignedChars.findIndex(c => !c);
    const slotIndex = emptySlotIndex >= 0 ? emptySlotIndex : assignedChars.length;
    assignCharacterToSlot(tasksState.activeTaskId, slotIndex, charId);
}

// Assign character to slot (internal function)
function assignCharacterToSlot(taskId, slotIndex, charId) {
    // Check if character is already assigned to this task
    const assignedChars = tasksState.assignedCharacters[taskId] || [];
    if (assignedChars.includes(charId)) {
        showError('이 캐릭터는 이미 이 과제에 할당되어 있습니다.');
        return;
    }
    
    // Initialize arrays if needed
    if (!tasksState.assignedCharacters[taskId]) {
        tasksState.assignedCharacters[taskId] = [];
    }
    if (!tasksState.filledTagSlots[taskId]) {
        tasksState.filledTagSlots[taskId] = {};
    }
    if (!tasksState.characterFilledTag[taskId]) {
        tasksState.characterFilledTag[taskId] = {};
    }
    
    // Get character tags
    const charTags = getCharacterTags(charId);
    
    // Get task tags with counts
    const task = tasksState.selectedTasks.find(t => t.Id === taskId);
    const allTaskTags = [...(task?.Tags || []), ...(task?.ExtraTags || [])];
    const tagCounts = getTagCounts(task);
    
    // Find which tags this character can fill (only unfilled slots)
    const filledSlots = tasksState.filledTagSlots[taskId];
    const tagsToFill = [];
    
    for (const charTag of charTags) {
        if (allTaskTags.includes(charTag)) {
            const currentFilled = filledSlots[charTag] || 0;
            const totalRequired = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
            
            if (currentFilled < totalRequired) {
                tagsToFill.push(charTag);
            }
        }
    }
    
    // Update filled tag counts - character fills ALL matching tags
    const filledTagsList = [];
    if (tagsToFill.length > 0) {
        // Sort tags to prioritize required tags first
        const sortedTags = tagsToFill.sort((a, b) => {
            const aIsRequired = (tagCounts.required[a] || 0) > 0;
            const bIsRequired = (tagCounts.required[b] || 0) > 0;
            if (aIsRequired && !bIsRequired) return -1;
            if (!aIsRequired && bIsRequired) return 1;
            return 0;
        });
        
        // Fill each tag that needs filling
        for (const tag of sortedTags) {
            const currentFilled = filledSlots[tag] || 0;
            const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
            
            if (currentFilled < totalRequired) {
                filledSlots[tag] = currentFilled + 1;
                filledTagsList.push(tag);
            }
        }
        
        // Store which tags this character is filling (multiple tags possible)
        tasksState.characterFilledTag[taskId][charId] = filledTagsList;
    }
    
    // Assign character to slot
    tasksState.assignedCharacters[taskId][slotIndex] = charId;

    renderSelectedTasks();
    renderCharacters();
    renderInsights();
}

// Remove character from task
function removeCharacterFromTask(taskId, slotIndex) {
    if (tasksState.assignedCharacters[taskId]) {
        const charId = tasksState.assignedCharacters[taskId][slotIndex];
        
        if (charId) {
            // Get which tags this character was filling (can be multiple)
            const filledTags = tasksState.characterFilledTag[taskId]?.[charId];
            
            if (filledTags) {
                // Decrement the tag counts for all tags this character was filling
                const filledSlots = tasksState.filledTagSlots[taskId] || {};
                
                // Handle both single tag (old format) and multiple tags (new format)
                const tagsArray = Array.isArray(filledTags) ? filledTags : [filledTags];
                
                for (const tag of tagsArray) {
                    if (filledSlots[tag] > 0) {
                        filledSlots[tag]--;
                    }
                }
                
                // Remove the tracking entry
                delete tasksState.characterFilledTag[taskId][charId];
            }
        }
        
        // Remove character from slot
        tasksState.assignedCharacters[taskId][slotIndex] = null;

        // Remove null values from end
        while (tasksState.assignedCharacters[taskId].length > 0 &&
               !tasksState.assignedCharacters[taskId][tasksState.assignedCharacters[taskId].length - 1]) {
            tasksState.assignedCharacters[taskId].pop();
        }
    }
    renderSelectedTasks();
    renderCharacters();
    renderInsights();
}

// Insights Panel Functions
function toggleInsightsPanel() {
    const panel = document.getElementById('insights-panel');
    if (panel) {
        tasksState.insightsPanelCollapsed = !tasksState.insightsPanelCollapsed;
        panel.classList.toggle('collapsed', tasksState.insightsPanelCollapsed);
    }
}

function initInsightsPanel() {
    const panel = document.getElementById('insights-panel');
    if (panel) {
        // Start collapsed
        panel.classList.add('collapsed');
        tasksState.insightsPanelCollapsed = true;
    }
}

function calculateInsights() {
    if (tasksState.selectedTasks.length === 0) {
        return null;
    }

    // 1. Completion Status
    let totalRequiredTags = 0;
    let totalFilledTags = 0;
    let completedTasks = 0;

    tasksState.selectedTasks.forEach(task => {
        const tagCounts = getTagCounts(task);
        const filledSlots = tasksState.filledTagSlots[task.Id] || {};

        Object.entries(tagCounts.required).forEach(([tag, count]) => {
            totalRequiredTags += count;
            totalFilledTags += Math.min(filledSlots[tag] || 0, count);
        });

        // Check if all required tags are filled
        const allRequiredFilled = Object.entries(tagCounts.required).every(([tag, count]) => {
            return (filledSlots[tag] || 0) >= count;
        });
        if (allRequiredFilled) completedTasks++;
    });

    // 2. Missing Tag Fillers (owned characters that can fill gaps)
    const missingTagFillers = [];
    const allAssignedCharIds = new Set();
    Object.values(tasksState.assignedCharacters).forEach(chars => {
        chars.forEach(id => allAssignedCharIds.add(id));
    });

    // Build a map for each character: total tag satisfactions and unique tags
    const characterFillScores = new Map();

    const validCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???' && tasksState.ownedCharacters.has(char.Id);
    });

    validCharacters.forEach(char => {
        if (!allAssignedCharIds.has(char.Id)) {
            const charTags = getCharacterTags(char.Id);
            let totalTagSatisfactions = 0; // Count every tag match including duplicates
            let extraTagSatisfactions = 0;
            let uniqueTagsCount = 0;
            const tasksMatched = [];
            const uniqueTags = new Set();

            tasksState.selectedTasks.forEach(task => {
                const tagCounts = getTagCounts(task);
                const filledSlots = tasksState.filledTagSlots[task.Id] || {};
                const requiredTags = task.Tags || [];
                const extraTags = task.ExtraTags || [];

                const canFillRequired = [];
                const canFillExtra = [];

                // Check required tags
                charTags.forEach(charTag => {
                    const inRequired = requiredTags.filter(t => t === charTag).length;
                    if (inRequired > 0) {
                        const currentFilled = filledSlots[charTag] || 0;
                        const totalRequired = tagCounts.required[charTag] || 0;
                        if (currentFilled < totalRequired) {
                            // Count each unfilled slot
                            const unfilled = totalRequired - currentFilled;
                            for (let i = 0; i < unfilled; i++) {
                                canFillRequired.push(charTag);
                                totalTagSatisfactions++;
                            }
                            uniqueTags.add(charTag);
                        }
                    }
                });

                // Check extra tags (higher priority)
                charTags.forEach(charTag => {
                    const inExtra = extraTags.filter(t => t === charTag).length;
                    if (inExtra > 0) {
                        const currentFilled = filledSlots[charTag] || 0;
                        const totalRequired = (tagCounts.required[charTag] || 0);
                        const totalExtra = (tagCounts.extra[charTag] || 0);
                        const totalNeeded = totalRequired + totalExtra;
                        if (currentFilled < totalNeeded) {
                            // Count each unfilled extra slot
                            const unfilled = totalNeeded - currentFilled;
                            for (let i = 0; i < unfilled; i++) {
                                canFillExtra.push(charTag);
                                totalTagSatisfactions++;
                                extraTagSatisfactions++;
                            }
                            uniqueTags.add(charTag);
                        }
                    }
                });

                if (canFillRequired.length > 0 || canFillExtra.length > 0) {
                    tasksMatched.push({
                        taskId: task.Id,
                        task: task,
                        requiredTags: canFillRequired,
                        extraTags: canFillExtra
                    });
                }
            });

            uniqueTagsCount = uniqueTags.size;

            if (totalTagSatisfactions > 0) {
                characterFillScores.set(char.Id, {
                    charId: char.Id,
                    char: char,
                    totalTagSatisfactions: totalTagSatisfactions,
                    extraTagSatisfactions: extraTagSatisfactions,
                    uniqueTagsCount: uniqueTagsCount,
                    tasksMatched: tasksMatched
                });
            }
        }
    });

    // Convert to array and sort by: extra tags first, then total satisfactions
    characterFillScores.forEach(score => {
        missingTagFillers.push(score);
    });

    missingTagFillers.sort((a, b) => {
        // Prioritize extra tags
        if (a.extraTagSatisfactions !== b.extraTagSatisfactions) {
            return b.extraTagSatisfactions - a.extraTagSatisfactions;
        }
        // Then total satisfactions
        return b.totalTagSatisfactions - a.totalTagSatisfactions;
    });

    // 3. MVP Characters (characters that can satisfy multiple tasks)
    const mvpCharacters = [];
    const mvpValidCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???' && tasksState.ownedCharacters.has(char.Id);
    });

    mvpValidCharacters.forEach(char => {
        if (!allAssignedCharIds.has(char.Id)) {
            const charTags = getCharacterTags(char.Id);
            let matchedTasksCount = 0;
            let totalTagSatisfactions = 0;
            let extraTagSatisfactions = 0;
            const matchedTasks = [];
            const uniqueTags = new Set();

            tasksState.selectedTasks.forEach(task => {
                const requiredTags = task.Tags || [];
                const extraTags = task.ExtraTags || [];
                let taskMatched = false;
                let taskTagSatisfactions = 0;
                let taskExtraTagSatisfactions = 0;

                // Count required tags (all instances)
                charTags.forEach(charTag => {
                    const requiredMatches = requiredTags.filter(t => t === charTag).length;
                    if (requiredMatches > 0) {
                        taskTagSatisfactions += requiredMatches;
                        totalTagSatisfactions += requiredMatches;
                        taskMatched = true;
                        uniqueTags.add(charTag);
                    }
                });

                // Count extra tags (all instances, higher priority)
                charTags.forEach(charTag => {
                    const extraMatches = extraTags.filter(t => t === charTag).length;
                    if (extraMatches > 0) {
                        taskTagSatisfactions += extraMatches;
                        taskExtraTagSatisfactions += extraMatches;
                        totalTagSatisfactions += extraMatches;
                        extraTagSatisfactions += extraMatches;
                        taskMatched = true;
                        uniqueTags.add(charTag);
                    }
                });

                if (taskMatched) {
                    matchedTasksCount++;
                    matchedTasks.push({
                        taskId: task.Id,
                        task: task,
                        tagSatisfactions: taskTagSatisfactions,
                        extraTagSatisfactions: taskExtraTagSatisfactions
                    });
                }
            });

            if (matchedTasksCount >= 2) {
                mvpCharacters.push({
                    charId: char.Id,
                    char: char,
                    matchedTasksCount: matchedTasksCount,
                    totalTagSatisfactions: totalTagSatisfactions,
                    extraTagSatisfactions: extraTagSatisfactions,
                    uniqueTagsCount: uniqueTags.size,
                    tasks: matchedTasks
                });
            }
        }
    });

    // Sort by: tasks matched first, then extra tags, then total satisfactions
    mvpCharacters.sort((a, b) => {
        if (a.matchedTasksCount !== b.matchedTasksCount) {
            return b.matchedTasksCount - a.matchedTasksCount;
        }
        if (a.extraTagSatisfactions !== b.extraTagSatisfactions) {
            return b.extraTagSatisfactions - a.extraTagSatisfactions;
        }
        return b.totalTagSatisfactions - a.totalTagSatisfactions;
    });

    // 4. Acquisition Priority (unowned characters that would be valuable)
    const acquisitionPriority = [];
    const unownedCharacters = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???' && !tasksState.ownedCharacters.has(char.Id);
    });

    unownedCharacters.forEach(char => {
        const charTags = getCharacterTags(char.Id);
        let valueScore = 0;
        const valueTasks = [];

        tasksState.selectedTasks.forEach(task => {
            const tagCounts = getTagCounts(task);
            const filledSlots = tasksState.filledTagSlots[task.Id] || {};
            const requiredTags = task.Tags || [];
            const extraTags = task.ExtraTags || [];

            // Separate required and extra tags this character can fill
            const canFillRequiredTags = [];
            const canFillExtraTags = [];

            charTags.forEach(charTag => {
                // Check required tags
                const inRequired = requiredTags.filter(t => t === charTag).length;
                if (inRequired > 0) {
                    const currentFilled = filledSlots[charTag] || 0;
                    const totalRequired = tagCounts.required[charTag] || 0;
                    if (currentFilled < totalRequired) {
                        canFillRequiredTags.push(charTag);
                    }
                }

                // Check extra tags
                const inExtra = extraTags.filter(t => t === charTag).length;
                if (inExtra > 0) {
                    const currentFilled = filledSlots[charTag] || 0;
                    const totalNeeded = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
                    if (currentFilled < totalNeeded) {
                        canFillExtraTags.push(charTag);
                    }
                }
            });

            const canFillCount = canFillRequiredTags.length + canFillExtraTags.length;

            if (canFillCount > 0) {
                // Weighted scoring: Extra tags × 3, Required tags × 1
                const taskScore = (canFillExtraTags.length * 3) + (canFillRequiredTags.length * 1);
                valueScore += taskScore;
                valueTasks.push({
                    taskId: task.Id,
                    task: task,
                    canFillTagsCount: canFillCount,
                    requiredTagsCount: canFillRequiredTags.length,
                    extraTagsCount: canFillExtraTags.length
                });
            }
        });

        if (valueScore > 0) {
            acquisitionPriority.push({
                charId: char.Id,
                char: char,
                valueScore: valueScore,
                tasks: valueTasks
            });
        }
    });

    // Sort by value score
    acquisitionPriority.sort((a, b) => b.valueScore - a.valueScore);

    return {
        completionStatus: {
            totalRequiredTags,
            totalFilledTags,
            completedTasks,
            totalTasks: tasksState.selectedTasks.length,
            completionPercentage: totalRequiredTags > 0 ? Math.round((totalFilledTags / totalRequiredTags) * 100) : 0
        },
        missingTagFillers: missingTagFillers.slice(0, 10),
        mvpCharacters: mvpCharacters.slice(0, 10),
        acquisitionPriority: acquisitionPriority.slice(0, 10)
    };
}

function renderInsights() {
    const container = document.getElementById('insights-body');
    if (!container) return;

    const insights = calculateInsights();

    if (!insights || tasksState.selectedTasks.length === 0) {
        container.innerHTML = `
            <div class="insight-empty">
                과제를 선택하면 인사이트가 표시됩니다.
            </div>
        `;
        return;
    }

    const { completionStatus, missingTagFillers, mvpCharacters, acquisitionPriority } = insights;

    container.innerHTML = `
        <!-- Completion Status -->
        <div class="insight-section">
            <div class="insight-title">
                <i class="fa-solid fa-chart-pie"></i> 완료 상태
            </div>
            <div class="completion-stats">
                <div class="stat-card">
                    <div class="stat-value">${completionStatus.completedTasks}/${completionStatus.totalTasks}</div>
                    <div class="stat-label">완료된 과제</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completionStatus.totalFilledTags}/${completionStatus.totalRequiredTags}</div>
                    <div class="stat-label">필수 태그</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionStatus.completionPercentage}%"></div>
            </div>
        </div>

        <!-- MVP Characters -->
        <div class="insight-section">
            <div class="insight-title">
                <i class="fa-solid fa-star"></i> MVP 캐릭터
            </div>
            ${mvpCharacters.length > 0 ? mvpCharacters.map(mvp => {
                const char = mvp.char;
                const name = getTranslatedCharacterName(char);
                const imagePath = `assets/char/avg1_${char.Id}_002.png`;
                const detailText = mvp.extraTagSatisfactions > 0
                    ? `추가 ${mvp.extraTagSatisfactions}개 / 총 ${mvp.totalTagSatisfactions}개 태그`
                    : `${mvp.totalTagSatisfactions}개 태그 만족`;
                return `
                    <div class="insight-item">
                        <img src="${imagePath}" alt="${name}" class="insight-item-image" onerror="this.style.display='none'">
                        <div class="insight-item-info">
                            <div class="insight-item-name">${name}</div>
                            <div class="insight-item-detail">${detailText}</div>
                        </div>
                        <div class="insight-item-badge">${mvp.matchedTasksCount}개 과제</div>
                    </div>
                `;
            }).join('') : '<div class="insight-empty">해당 캐릭터가 없습니다</div>'}
        </div>

        <!-- Acquisition Priority -->
        <div class="insight-section">
            <div class="insight-title">
                <i class="fa-solid fa-shopping-cart"></i> 획득/육성 추천
            </div>
            ${acquisitionPriority.length > 0 ? acquisitionPriority.map(acq => {
                const char = acq.char;
                const name = getTranslatedCharacterName(char);
                const imagePath = `assets/char/avg1_${char.Id}_002.png`;
                return `
                    <div class="insight-item">
                        <img src="${imagePath}" alt="${name}" class="insight-item-image" onerror="this.style.display='none'">
                        <div class="insight-item-info">
                            <div class="insight-item-name">${name}</div>
                            <div class="insight-item-detail">${acq.tasks.length}개 과제에 필요</div>
                        </div>
                        <div class="insight-item-badge">가치 ${acq.valueScore}</div>
                    </div>
                `;
            }).join('') : '<div class="insight-empty">모든 태그가 채워졌습니다</div>'}
        </div>
    `;
}

// Helper functions for notifications
function showWarning(message) {
    if (window.showToast) {
        window.showToast(message, 'warning');
    } else {
        alert(message);
    }
}

function showError(message) {
    if (window.showToast) {
        window.showToast(message, 'error');
    } else {
        alert('오류: ' + message);
    }
}

function showSuccess(message) {
    if (window.showToast) {
        window.showToast(message, 'success');
    } else {
        alert(message);
    }
}

// Event Delegation Setup (Priority 1: Memory leak fix)
function setupEventDelegation() {
    // Delegation for tasks list
    const tasksContainer = document.getElementById('tasks-list');
    if (tasksContainer) {
        tasksContainer.addEventListener('click', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard && !taskCard.classList.contains('disabled')) {
                const taskId = parseInt(taskCard.dataset.taskId);
                if (!isNaN(taskId)) {
                    toggleTaskSelection(taskId);
                }
            }
        });
    }

    // Delegation for selected tasks
    const selectedContainer = document.getElementById('selected-tasks');
    if (selectedContainer) {
        selectedContainer.addEventListener('click', (e) => {
            // Handle remove button
            const removeBtn = e.target.closest('.remove-task-btn');
            if (removeBtn) {
                e.stopPropagation();
                const taskId = parseInt(removeBtn.dataset.removeTaskId);
                if (!isNaN(taskId)) {
                    toggleTaskSelection(taskId);
                }
                return;
            }

            // Handle remove character button
            const removeCharBtn = e.target.closest('.remove-character-btn');
            if (removeCharBtn) {
                e.stopPropagation();
                const taskId = parseInt(removeCharBtn.dataset.removeCharTask);
                const slotIndex = parseInt(removeCharBtn.dataset.removeCharSlot);
                if (!isNaN(taskId) && !isNaN(slotIndex)) {
                    removeCharacterFromTask(taskId, slotIndex);
                }
                return;
            }

            // Handle empty slot click
            const emptySlot = e.target.closest('.character-slot:not(.filled)');
            if (emptySlot) {
                const taskId = parseInt(emptySlot.dataset.addCharTask);
                const task = tasksState.selectedTasks.find(t => t.Id === taskId);
                const taskTitle = getTranslatedTaskTitle(task);

                if (tasksState.activeTaskId !== taskId) {
                    showWarning(`이 과제 카드를 먼저 선택한 후, 아래 캐릭터 목록에서 캐릭터를 클릭하세요.`);
                } else {
                    showWarning(`아래 캐릭터 목록에서 "${taskTitle}"에 추가할 캐릭터를 선택하세요.`);
                }
                return;
            }

            // Handle task card selection
            const taskCard = e.target.closest('.selected-task-card');
            if (taskCard) {
                const taskId = parseInt(taskCard.dataset.selectedTaskId);
                if (!isNaN(taskId)) {
                    selectTask(taskId);
                }
            }
        });
    }

    // Delegation for characters list
    const charactersContainer = document.getElementById('characters-list');
    if (charactersContainer) {
        charactersContainer.addEventListener('click', (e) => {
            const charCard = e.target.closest('.character-card-small');
            if (charCard && !charCard.classList.contains('disabled') && !charCard.classList.contains('not-clickable')) {
                const charId = parseInt(charCard.dataset.characterId);
                if (!isNaN(charId)) {
                    onCharacterClick(charId);
                }
            }
        });
    }

    // Ownership Modal Controls
    const manageOwnershipBtn = document.getElementById('manage-ownership-btn');
    if (manageOwnershipBtn) {
        manageOwnershipBtn.addEventListener('click', openOwnershipModal);
    }

    const closeOwnershipBtn = document.getElementById('close-ownership-modal');
    if (closeOwnershipBtn) {
        closeOwnershipBtn.addEventListener('click', closeOwnershipModal);
    }

    const selectAllBtn = document.getElementById('select-all-owned');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllOwned);
    }

    const deselectAllBtn = document.getElementById('deselect-all-owned');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllOwned);
    }

    // Ownership grid delegation
    const ownershipGrid = document.getElementById('ownership-grid');
    if (ownershipGrid) {
        ownershipGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.ownership-card');
            if (card) {
                const charId = parseInt(card.dataset.ownershipCharId);
                if (!isNaN(charId)) {
                    toggleOwnership(charId);
                    renderOwnershipGrid();
                    updateOwnershipCount();
                }
            }
        });
    }

    // Click outside ownership modal to close
    const ownershipModal = document.getElementById('ownership-modal');
    if (ownershipModal) {
        ownershipModal.addEventListener('click', (e) => {
            if (e.target === ownershipModal) {
                closeOwnershipModal();
            }
        });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            if (filter) {
                setCharacterFilter(filter);
            }
        });
    });

    // Insights Panel Toggle
    const insightsToggle = document.getElementById('insights-toggle');
    if (insightsToggle) {
        insightsToggle.addEventListener('click', toggleInsightsPanel);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadTasksData();
    updateTaskCounter();
    setupEventDelegation();
    initInsightsPanel();
});
