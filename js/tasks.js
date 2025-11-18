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

/**
 * Debounce utility function for performance optimization
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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
        countElement.textContent = `보유: ${owned} / ${total}`;
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
        updateHeaderStats();
        updateRecommendations();
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
        const charIdStr = String(char.Id);
        const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
        const isOwned = tasksState.ownedCharacters.has(char.Id);

        return `
            <div class="ownership-card ${isOwned ? 'owned' : ''}" data-ownership-char-id="${char.Id}">
                <img src="${imagePath}" alt="${name}" class="ownership-card-image" onerror="this.style.display='none'">
                <div class="ownership-card-name">${name}</div>
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
        // Get current language from i18n
        const gameLang = window.i18n?.currentLang || 'KR';
        const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

        console.log(`[Tasks] Loading data for language: ${gameLang}`);

        const [agentData, agentKR, characterData, characterDesData, characterTagKR] = await Promise.all([
            fetch('data/Agent.json').then(r => r.json()),
            fetch(`${dataPath}/Agent.json`).then(r => r.json()),
            fetch('data/Character.json').then(r => r.json()),
            fetch('data/CharacterDes.json').then(r => r.json()),
            fetch(`${dataPath}/CharacterTag.json`).then(r => r.json())
        ]);

        // Filter tasks with Level 70
        tasksState.allTasks = Object.values(agentData).filter(task => task.Level === 70);
        tasksState.taskStrings = agentKR;
        tasksState.tagStrings = characterTagKR;

        // Prepare character data - filter only visible and available characters
        tasksState.characters = Object.values(characterData)
            .filter(char => char.Visible && char.Available);
        tasksState.characterNames = await fetch(`${dataPath}/Character.json`).then(r => r.json());
        tasksState.characterTags = characterDesData;

        // Load ownership from localStorage
        loadOwnership();

        // Clear caches on data reload
        clearLookupCaches();

        renderTasks();
        renderSelectedTasks();
        renderCharacters();
        updateHeaderStats();
        updateTaskPoolCount();
        updateRecommendations();
    } catch (error) {
        console.error('Error loading tasks data:', error);
        showError('데이터를 불러오는데 실패했습니다.');
    }
}

// Update header statistics
function updateHeaderStats() {
    // Update ownership count
    const ownedCountElement = document.getElementById('header-owned-count');
    if (ownedCountElement) {
        const totalChars = tasksState.characters.filter(char => {
            const name = getTranslatedCharacterName(char);
            return name !== '???';
        }).length;
        const ownedChars = tasksState.ownedCharacters.size;
        ownedCountElement.textContent = `보유: ${ownedChars}/${totalChars}`;
    }

    // Update completion count
    const completionElement = document.getElementById('header-completion');
    if (completionElement) {
        let completedTasks = 0;
        tasksState.selectedTasks.forEach(task => {
            const tagCounts = getTagCounts(task);
            const filledSlots = tasksState.filledTagSlots[task.Id] || {};
            const allRequiredFilled = Object.entries(tagCounts.required).every(([tag, count]) => {
                return (filledSlots[tag] || 0) >= count;
            });
            if (allRequiredFilled) completedTasks++;
        });
        completionElement.textContent = `완료: ${completedTasks}/${tasksState.selectedTasks.length}`;
    }
}

// Update task pool count
function updateTaskPoolCount() {
    const countElement = document.getElementById('task-pool-count');
    if (countElement) {
        countElement.textContent = `${tasksState.allTasks.length}개`;
    }
}

// Setup task search functionality
function setupTaskSearch() {
    const searchInput = document.getElementById('task-search');
    if (!searchInput) return;

    // Debounced search function (300ms delay to reduce DOM queries during typing)
    const debouncedSearch = debounce((searchTerm) => {
        const taskCards = document.querySelectorAll('.task-pool-list .task-card');

        taskCards.forEach(card => {
            const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
            const subtitle = card.querySelector('.task-subtitle')?.textContent.toLowerCase() || '';
            const matches = title.includes(searchTerm) || subtitle.includes(searchTerm);
            card.style.display = matches ? '' : 'none';
        });
    }, 300);

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        debouncedSearch(searchTerm);
    });
}

// Show modern confirmation modal
let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');

    if (!modal || !titleEl || !messageEl) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.style.display = 'flex';

    // Store callback for button handlers
    confirmCallback = onConfirm;
}

// Clear all character assignments (keep tasks)
function clearAllAssignments() {
    if (tasksState.selectedTasks.length === 0) return;

    // Count assigned characters
    const assignedCount = Object.values(tasksState.assignedCharacters)
        .flat()
        .filter(id => id).length;

    if (assignedCount === 0) {
        showWarning('배정된 캐릭터가 없습니다.');
        return;
    }

    showConfirm(
        '캐릭터 초기화',
        '모든 캐릭터 배정을 제거하시겠습니까?\n(선택된 의뢰는 유지됩니다)',
        () => {
            // Clear only character assignments, keep tasks
            tasksState.assignedCharacters = {};
            tasksState.filledTagSlots = {};
            tasksState.characterFilledTag = {};

            // Re-initialize for existing tasks
            tasksState.selectedTasks.forEach(task => {
                tasksState.assignedCharacters[task.Id] = [];
                tasksState.filledTagSlots[task.Id] = {};
                tasksState.characterFilledTag[task.Id] = {};
            });

            renderSelectedTasks();
            renderCharacters();
            updateHeaderStats();
            updateRecommendations();
            showSuccess('모든 캐릭터 배정이 초기화되었습니다.');
        }
    );
}

// Update action buttons visibility (clear all + auto-fill)
function updateClearAllButton() {
    const clearBtn = document.getElementById('clear-all-btn');
    const autoFillBtn = document.getElementById('auto-fill-btn');

    const shouldShow = tasksState.selectedTasks.length > 0;

    if (clearBtn) {
        clearBtn.style.display = shouldShow ? '' : 'none';
    }
    if (autoFillBtn) {
        autoFillBtn.style.display = shouldShow ? '' : 'none';
    }
}

// Update recommendations section
function updateRecommendations() {
    const section = document.getElementById('recommendations-section');
    const content = document.getElementById('recommendations-content');

    if (!section || !content) return;

    if (tasksState.selectedTasks.length === 0) {
        section.style.display = 'none';
        return;
    }

    const insights = calculateInsights();
    if (!insights) {
        section.style.display = 'none';
        return;
    }

    const { acquisitionPriority } = insights;

    if (acquisitionPriority.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Show top 5 recommendations for unowned characters
    const topRecommendations = acquisitionPriority.slice(0, 5);
    content.innerHTML = topRecommendations.map(priority => {
        const char = priority.char;
        const name = getTranslatedCharacterName(char);
        const taskCount = priority.tasks.length;
        const totalTags = priority.tasks.reduce((sum, t) => sum + t.canFillTagsCount, 0);

        return `
            <div class="recommendation-item">
                <i class="fa-solid fa-star"></i>
                <strong>${name}</strong>: ${taskCount}개 의뢰에 유용 (${totalTags}개 태그 충족)
            </div>
        `;
    }).join('');
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
    updateHeaderStats();
    updateClearAllButton();
    updateRecommendations();
}

// Render selected tasks
function renderSelectedTasks() {
    const container = document.getElementById('selected-tasks');
    
    if (tasksState.selectedTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state-tasks">
                <div class="empty-state-icon">${getIcon('memo')}</div>
                <div class="empty-state-text">선택된 과제가 없습니다</div>
                <div class="empty-state-hint">옆에서 과제를 선택해주세요</div>
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

    // Pre-calculate values that are same for all characters (PERFORMANCE OPTIMIZATION)
    const activeTaskChars = tasksState.activeTaskId
        ? (tasksState.assignedCharacters[tasksState.activeTaskId] || [])
        : [];

    const activeTask = tasksState.activeTaskId
        ? tasksState.selectedTasks.find(t => t.Id === tasksState.activeTaskId)
        : null;

    const activeTaskData = activeTask ? {
        allTaskTags: [...(activeTask.Tags || []), ...(activeTask.ExtraTags || [])],
        filledSlots: tasksState.filledTagSlots[tasksState.activeTaskId] || {},
        tagCounts: getTagCounts(activeTask)
    } : null;

    // Pre-calculate which characters are assigned to other tasks
    const charsAssignedToOtherTasks = new Set();
    Object.entries(tasksState.assignedCharacters).forEach(([taskId, chars]) => {
        if (!tasksState.activeTaskId || parseInt(taskId) !== tasksState.activeTaskId) {
            chars.forEach(charId => charsAssignedToOtherTasks.add(charId));
        }
    });

    container.innerHTML = validCharacters.map(char => {
        const name = getTranslatedCharacterName(char);
        const tags = getCharacterTags(char.Id);
        const charIdStr = String(char.Id);
        const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
        const isOwned = tasksState.ownedCharacters.has(char.Id);

        // Check if character is assigned to the active task
        const isAssignedToActiveTask = activeTaskChars.includes(char.Id);

        // Check if character is assigned to any other task (now O(1) lookup)
        const isAssignedToOtherTask = charsAssignedToOtherTasks.has(char.Id);

        // Check if character can fill remaining slots in active task
        let canFillRemainingSlots = false;

        if (activeTaskData && !isAssignedToActiveTask) {
            // Check if character can fill any remaining unfilled slots
            canFillRemainingSlots = tags.some(charTag => {
                if (activeTaskData.allTaskTags.includes(charTag)) {
                    const currentFilled = activeTaskData.filledSlots[charTag] || 0;
                    const totalRequired = (activeTaskData.tagCounts.required[charTag] || 0) + (activeTaskData.tagCounts.extra[charTag] || 0);
                    return currentFilled < totalRequired;
                }
                return false;
            });
        }

        // Determine if card should be clickable
        const isClickable = tasksState.selectedTasks.length > 0 && tasksState.activeTaskId && !isAssignedToOtherTask;
        const cursorClass = !isClickable ? 'not-clickable' : '';

        return `
            <div class="character-card-small ${isOwned ? 'owned' : ''} ${isAssignedToActiveTask ? 'selected' : ''} ${isAssignedToOtherTask ? 'disabled' : ''} ${canFillRemainingSlots ? 'highlighted' : ''} ${cursorClass}" data-character-id="${char.Id}">
                <img src="${imagePath}" alt="${name}" class="character-image-small" onerror="this.style.display='none'">
                <div class="character-name-small">${name}</div>
                <div class="character-tags-small">
                    ${tags.slice(0, 2).map(tag => {
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
                const charIdStr = String(char.Id);
                const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
                const charTags = getCharacterTags(char.Id);
                
                // Get task tags for matching
                const task = tasksState.selectedTasks.find(t => t.Id === taskId);
                const taskTags = new Set([...(task?.Tags || []), ...(task?.ExtraTags || [])]);
                
                slots.push(`
                    <div class="character-slot filled">
                        <button class="remove-character-btn" data-remove-char-task="${taskId}" data-remove-char-slot="${i}">×</button>
                        <img src="${imagePath}" alt="${name}" class="slot-image" onerror="this.style.display='none'">
                        <div class="slot-info">
                            <div class="slot-name">${name}</div>
                            <div class="character-slot-tags">
                                ${charTags.slice(0, 2).map(tag => {
                                    const matches = taskTags.has(tag);
                                    const tagName = getTranslatedTagName(tag);
                                    return `<span class="slot-tag ${matches ? 'matches' : ''}">${tagName}</span>`;
                                }).join('')}
                            </div>
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

// Assign character to slot
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
    updateHeaderStats();
    updateRecommendations();
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
    updateHeaderStats();
    updateRecommendations();
}

// ============================================================================
// AUTO-FILL ALGORITHM (global optimizer, 4 tasks x 3 chars)
// ============================================================================

/**
 * Calculate tag rarity across all selected tasks.
 * Rarer tags (fewer characters can cover them) get higher rarity scores.
 */
function calculateTagRarity(tasks, availableChars) {
    const tagRarity = {};

    const allTags = new Set();
    tasks.forEach(task => {
        (task.Tags || []).forEach(tag => allTags.add(tag));
        (task.ExtraTags || []).forEach(tag => allTags.add(tag));
    });

    allTags.forEach(tag => {
        const charCount = availableChars.filter(char => {
            const charTags = getCharacterTags(char.Id);
            return charTags.includes(tag);
        }).length;

        tagRarity[tag] = {
            count: charCount,
            rarity: charCount > 0 ? 1 / charCount : 0
        };
    });

    return tagRarity;
}

/**
 * Pre-computed info for a task used by the optimizer.
 */
function buildTaskInfo(task) {
    const tagCounts = getTagCounts(task);
    // Convert string keys back to numbers to match character tag format
    const requiredTags = Object.keys(tagCounts.required).map(k => parseInt(k, 10));
    const extraTags = Object.keys(tagCounts.extra).map(k => parseInt(k, 10));
    const allTags = Array.from(new Set([...requiredTags, ...extraTags]));

    return {
        task,
        id: task.Id,
        tagCounts,
        requiredTags,
        extraTags,
        allTags
    };
}

/**
 * For a single task, enumerate candidate teams (1~maxCharactersPerTask)
 * of characters that can:
 *  - fully satisfy all required tags
 *  - possibly satisfy all extra tags (extrasFull flag)
 */
// Enumerate good teams (1..maxCharactersPerTask) for a single task
function generateTaskTeams(taskInfo, availableChars, tagRarity) {
    const maxTeamSize = tasksState.maxCharactersPerTask;
    const { task, requiredTags, extraTags, tagCounts } = taskInfo;
    const allTags = [...new Set([...requiredTags, ...extraTags])];

    // Only characters that can help this task at all
    const scoredChars = availableChars
        .map(char => {
            const charTags = getCharacterTags(char.Id);
            const hits = charTags.filter(t => allTags.includes(t));
            if (hits.length === 0) return null;

            // score: more task tags + rarer tags
            const score = hits.reduce((s, tag) => {
                const rarity = tagRarity[tag]?.rarity || 0;
                return s + 1 + rarity;
            }, 0);

            return { char, score };
        })
        .filter(x => x !== null)
        .sort((a, b) => b.score - a.score);

    // Limit to top N to keep combinations manageable
    const MAX_POOL = 12;
    const relevantChars = scoredChars.slice(0, MAX_POOL).map(x => x.char);
    const n = relevantChars.length;
    if (n === 0) {
        return [];
    }

    const teams = [];
    const idxs = [];

    function evaluateTeam(indexes) {
        const team = indexes.map(i => relevantChars[i]);
        const coverage = {};
        const extraCoverage = {};

        team.forEach(char => {
            const charTags = getCharacterTags(char.Id);
            charTags.forEach(tag => {
                if (!allTags.includes(tag)) return;

                const reqNeeded = tagCounts.required[tag] || 0;
                const extraNeeded = tagCounts.extra[tag] || 0;

                if (reqNeeded > 0) {
                    coverage[tag] = (coverage[tag] || 0) + 1;
                } else if (extraNeeded > 0) {
                    extraCoverage[tag] = (extraCoverage[tag] || 0) + 1;
                }
            });
        });

        // Must fully cover all required tags
        for (const tag of requiredTags) {
            const needed = tagCounts.required[tag] || 0;
            const have = coverage[tag] || 0;
            if (have < needed) {
                // Team rejected: can't cover required tag
                return null;
            }
        }

        // Check extras (all-or-nothing per tag)
        let extrasFull = true;
        let extraSlotsCovered = 0;

        for (const tag of extraTags) {
            const extraNeeded = tagCounts.extra[tag] || 0;
            if (!extraNeeded) continue;

            const reqNeeded = tagCounts.required[tag] || 0;
            const totalNeeded = reqNeeded + extraNeeded;
            const have = (coverage[tag] || 0) + (extraCoverage[tag] || 0);

            if (have >= totalNeeded) {
                extraSlotsCovered += extraNeeded;
            } else {
                extrasFull = false;
            }
        }

        // Rarity bonus: rarer required tags covered by this team
        const rarityBonus = requiredTags.reduce((sum, tag) => {
            const rarity = tagRarity[tag]?.rarity || 0;
            return sum + rarity * (tagCounts.required[tag] || 0);
        }, 0);

        return {
            chars: team,
            charIds: team.map(c => c.Id),
            extrasFull,
            extraSlotsCovered,
            size: team.length,
            rarityBonus
        };
    }

    function dfs(start, left, k) {
        if (left === 0) {
            const team = evaluateTeam(idxs);
            if (team) teams.push(team);
            return;
        }
        for (let i = start; i <= n - left; i++) {
            idxs.push(i);
            dfs(i + 1, left - 1, k);
            idxs.pop();
        }
    }

    const limitSize = Math.min(maxTeamSize, n);
    for (let size = 1; size <= limitSize; size++) {
        dfs(0, size, size);
    }

    // best teams first
    teams.sort((a, b) => {
        if (a.extrasFull !== b.extrasFull) return (b.extrasFull ? 1 : 0) - (a.extrasFull ? 1 : 0);
        if (a.extraSlotsCovered !== b.extraSlotsCovered) return b.extraSlotsCovered - a.extraSlotsCovered;
        if (a.rarityBonus !== b.rarityBonus) return b.rarityBonus - a.rarityBonus;
        return a.size - b.size; // prefer smaller teams
    });

    const MAX_TEAMS_PER_TASK = 40;
    return teams.slice(0, MAX_TEAMS_PER_TASK);
}

// Global search over tasks -> team choices
function chooseBestTeams(taskInfos, taskTeams) {
    const taskCount = taskInfos.length;
    const usedCharIds = new Set();

    let bestAssignment = new Array(taskCount).fill(null);
    let bestTasksCompleted = -1;
    let bestExtrasFullTasks = -1;
    let bestTotalExtraSlots = -1;

    function dfs(idx, currentAssignment, tasksCompleted, extrasFullTasks, totalExtraSlots) {
        if (idx === taskCount) {
            if (
                tasksCompleted > bestTasksCompleted ||
                (
                    tasksCompleted === bestTasksCompleted &&
                    (
                        extrasFullTasks > bestExtrasFullTasks ||
                        (
                            extrasFullTasks === bestExtrasFullTasks &&
                            totalExtraSlots > bestTotalExtraSlots
                        )
                    )
                )
            ) {
                bestAssignment = currentAssignment.slice();
                bestTasksCompleted = tasksCompleted;
                bestExtrasFullTasks = extrasFullTasks;
                bestTotalExtraSlots = totalExtraSlots;
            }
            return;
        }

        const teams = taskTeams[idx] || [];

        // Option 1: skip this task
        currentAssignment[idx] = null;
        dfs(idx + 1, currentAssignment, tasksCompleted, extrasFullTasks, totalExtraSlots);

        // Option 2: assign one team
        for (const team of teams) {
            let conflict = false;
            for (const id of team.charIds) {
                if (usedCharIds.has(id)) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) continue;

            team.charIds.forEach(id => usedCharIds.add(id));
            currentAssignment[idx] = team;

            dfs(
                idx + 1,
                currentAssignment,
                tasksCompleted + 1,
                extrasFullTasks + (team.extrasFull ? 1 : 0),
                totalExtraSlots + team.extraSlotsCovered
            );

            team.charIds.forEach(id => usedCharIds.delete(id));
        }
    }

    dfs(0, new Array(taskCount).fill(null), 0, 0, 0);

    return {
        assignment: bestAssignment,
        tasksCompleted: Math.max(0, bestTasksCompleted),
        extrasFullTasks: Math.max(0, bestExtrasFullTasks),
        totalExtraSlots: Math.max(0, bestTotalExtraSlots)
    };
}

/**
 * Assign best partial team for tasks that couldn't be fully completed.
 * Only assigns characters if they can fill remaining required tag slots.
 * Prioritizes rarest tags first.
 */
function assignBestPartialTeam(taskInfo, availableChars, tagRarity) {
    const { requiredTags, tagCounts } = taskInfo;
    const maxSize = tasksState.maxCharactersPerTask;

    // Track how many slots filled for each tag
    const filledSlots = {};
    const selectedChars = [];

    // Sort required tags by rarity (rarest first)
    const sortedRequiredTags = requiredTags
        .map(tag => ({ tag, rarity: tagRarity[tag]?.rarity || 0 }))
        .sort((a, b) => b.rarity - a.rarity);

    // Greedily assign characters, filling rarest tags first
    for (const { tag } of sortedRequiredTags) {
        const needed = tagCounts.required[tag] || 0;
        const filled = filledSlots[tag] || 0;

        // Fill this tag until we have enough or run out of characters
        for (let i = filled; i < needed; i++) {
            if (selectedChars.length >= maxSize) break;

            // Find best available character that has this tag
            const candidates = availableChars.filter(char => {
                // Skip if already selected
                if (selectedChars.some(sc => sc.Id === char.Id)) return false;

                // Check if character has this tag
                const charTags = getCharacterTags(char.Id);
                return charTags.includes(tag);
            });

            if (candidates.length === 0) break; // No more characters for this tag

            // Pick character that fills most OTHER unfilled required tags (greedy optimization)
            const best = candidates.reduce((best, char) => {
                const charTags = getCharacterTags(char.Id);
                const bonusTags = charTags.filter(ct => {
                    if (ct === tag) return false; // Don't count current tag
                    if (!requiredTags.includes(ct)) return false;
                    const needed = tagCounts.required[ct] || 0;
                    const filled = filledSlots[ct] || 0;
                    return filled < needed; // Only count if slot still needed
                }).length;

                const bestBonusTags = getCharacterTags(best.Id).filter(ct => {
                    if (ct === tag) return false;
                    if (!requiredTags.includes(ct)) return false;
                    const needed = tagCounts.required[ct] || 0;
                    const filled = filledSlots[ct] || 0;
                    return filled < needed;
                }).length;

                return bonusTags > bestBonusTags ? char : best;
            }, candidates[0]);

            // Add this character
            selectedChars.push(best);

            // Update filled slots for all tags this character provides
            const charTags = getCharacterTags(best.Id);
            charTags.forEach(ct => {
                if (requiredTags.includes(ct)) {
                    const needed = tagCounts.required[ct] || 0;
                    const filled = filledSlots[ct] || 0;
                    if (filled < needed) {
                        filledSlots[ct] = (filledSlots[ct] || 0) + 1;
                    }
                }
            });
        }
    }

    if (selectedChars.length === 0) return null;

    // Return in team format compatible with applyAutoAssignmentForTask
    return {
        chars: selectedChars,
        charIds: selectedChars.map(c => c.Id),
        extrasFull: false,
        extraSlotsCovered: 0,
        size: selectedChars.length,
        rarityBonus: 0
    };
}

// Apply a chosen team for a single task (compatible with manual state)
function applyAutoAssignmentForTask(taskInfo, team) {
    const { id: taskId, tagCounts, requiredTags, extraTags } = taskInfo;

    if (!tasksState.assignedCharacters[taskId]) {
        tasksState.assignedCharacters[taskId] = [];
    }
    if (!tasksState.filledTagSlots[taskId]) {
        tasksState.filledTagSlots[taskId] = {};
    }
    if (!tasksState.characterFilledTag[taskId]) {
        tasksState.characterFilledTag[taskId] = {};
    }

    const filledSlots = tasksState.filledTagSlots[taskId];
    const tagsFilledByChar = {};

    // 1) Fill required tags first
    requiredTags.forEach(tag => {
        const needed = tagCounts.required[tag] || 0;
        let remaining = needed - (filledSlots[tag] || 0);
        if (remaining <= 0) return;

        for (const char of team.chars) {
            if (remaining <= 0) break;
            const charTags = getCharacterTags(char.Id);
            if (!charTags.includes(tag)) continue;

            const charId = char.Id;
            if (!tagsFilledByChar[charId]) tagsFilledByChar[charId] = [];
            tagsFilledByChar[charId].push(tag);
            filledSlots[tag] = (filledSlots[tag] || 0) + 1;
            remaining--;
        }
    });

    // 2) Then extras, but only if we can fully satisfy that tag
    extraTags.forEach(tag => {
        const extraNeeded = tagCounts.extra[tag] || 0;
        if (!extraNeeded) return;

        const requiredNeeded = tagCounts.required[tag] || 0;
        const totalNeeded = requiredNeeded + extraNeeded;
        let remaining = totalNeeded - (filledSlots[tag] || 0);
        if (remaining <= 0) return;

        // Check if this team *can* reach totalNeeded
        let potential = 0;
        team.chars.forEach(char => {
            const charTags = getCharacterTags(char.Id);
            if (charTags.includes(tag)) potential++;
        });
        if (potential < remaining) return; // can't fully fill -> skip this extra tag

        for (const char of team.chars) {
            if (remaining <= 0) break;
            const charTags = getCharacterTags(char.Id);
            if (!charTags.includes(tag)) continue;

            const charId = char.Id;
            if (!tagsFilledByChar[charId]) tagsFilledByChar[charId] = [];
            tagsFilledByChar[charId].push(tag);
            filledSlots[tag] = (filledSlots[tag] || 0) + 1;
            remaining--;
        }
    });

    // 3) Place characters into slots and record which tags they fill
    const slots = tasksState.assignedCharacters[taskId];

    team.chars.forEach(char => {
        const charId = char.Id;
        const tags = tagsFilledByChar[charId] || [];

        if (tags.length > 0) {
            tasksState.characterFilledTag[taskId][charId] = tags;
        }

        let idx = slots.findIndex(c => !c);
        if (idx === -1) idx = slots.length;
        if (idx < tasksState.maxCharactersPerTask) {
            slots[idx] = charId;
        }
    });
}

/**
 * Auto-fill: global optimization over all selected tasks.
 * - maximizes fully completed tasks
 * - then maximizes tasks with all extras
 * - then maximizes total extra slots
 */
function autoFillCharacters() {
    if (tasksState.selectedTasks.length === 0) {
        showWarning('먼저 의뢰를 선택해주세요.');
        return;
    }

    if (tasksState.ownedCharacters.size === 0) {
        showWarning('먼저 보유한 캐릭터를 설정해주세요.');
        return;
    }

    // Reset assignments
    tasksState.assignedCharacters = {};
    tasksState.filledTagSlots = {};
    tasksState.characterFilledTag = {};

    // Initialize per-task state
    tasksState.selectedTasks.forEach(task => {
        tasksState.assignedCharacters[task.Id] = [];
        tasksState.filledTagSlots[task.Id] = {};
        tasksState.characterFilledTag[task.Id] = {};
    });

    const allOwnedChars = tasksState.characters.filter(char => {
        const name = getTranslatedCharacterName(char);
        return name !== '???' && tasksState.ownedCharacters.has(char.Id);
    });

    if (allOwnedChars.length === 0) {
        showWarning('사용 가능한 보유 캐릭터가 없습니다.');
        return;
    }

    // Build task info and rarity
    const taskInfos = tasksState.selectedTasks.map(buildTaskInfo);
    const tagRarity = calculateTagRarity(tasksState.selectedTasks, allOwnedChars);

    // For each task, get candidate teams
    const taskTeams = taskInfos.map(info =>
        generateTaskTeams(info, allOwnedChars, tagRarity)
    );

    // Global search for best overall combination
    const result = chooseBestTeams(taskInfos, taskTeams);

    const usedCharIds = new Set();

    result.assignment.forEach((team, idx) => {
        if (!team) return;
        const taskInfo = taskInfos[idx];
        applyAutoAssignmentForTask(taskInfo, team);
        team.charIds.forEach(id => usedCharIds.add(id));
    });

    // Fallback: Partially fill tasks that couldn't be completed
    let partiallyFilledCount = 0;
    result.assignment.forEach((team, idx) => {
        if (team) return; // Skip tasks that were fully assigned

        const taskInfo = taskInfos[idx];
        const availableChars = allOwnedChars.filter(char => !usedCharIds.has(char.Id));

        if (availableChars.length > 0) {
            const partialTeam = assignBestPartialTeam(taskInfo, availableChars, tagRarity);
            if (partialTeam && partialTeam.chars.length > 0) {
                applyAutoAssignmentForTask(taskInfo, partialTeam);
                partialTeam.charIds.forEach(id => usedCharIds.add(id));
                partiallyFilledCount++;
            }
        }
    });

    // Update UI
    renderSelectedTasks();
    renderCharacters();
    updateHeaderStats();
    updateClearAllButton();
    updateRecommendations();

    const totalTasks = tasksState.selectedTasks.length;
    const assignedCount = usedCharIds.size;
    const tasksCompleted = result.tasksCompleted;
    const extraTasksCompleted = result.extrasFullTasks;

    let message = '자동 배정 완료!\n';
    message += `- 필수 태그 완전 충족 의뢰: ${tasksCompleted}/${totalTasks}\n`;
    message += `- 추가 태그 완전 충족 의뢰: ${extraTasksCompleted}/${totalTasks}\n`;

    if (partiallyFilledCount > 0) {
        message += `- 부분 배정 의뢰: ${partiallyFilledCount}개 (필수 태그 미충족)\n`;
    }

    message += `- 배정된 캐릭터: ${assignedCount}명`;

    showSuccess(message);
}

// Calculate acquisition priority (unowned characters worth getting)
function calculateInsights() {
    if (tasksState.selectedTasks.length === 0) {
        return null;
    }

    // Calculate acquisition priority for unowned characters
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
        acquisitionPriority: acquisitionPriority.slice(0, 10)
    };
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

    // Clear All Button
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllAssignments);
    }

    // Auto-Fill Button
    const autoFillBtn = document.getElementById('auto-fill-btn');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', autoFillCharacters);
    }

    // Confirmation Modal (set up once to avoid memory leaks)
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
    const confirmModalCancel = document.getElementById('confirm-modal-cancel');

    if (confirmModalConfirm) {
        confirmModalConfirm.addEventListener('click', () => {
            confirmModal.style.display = 'none';
            if (confirmCallback) {
                confirmCallback();
                confirmCallback = null;
            }
        });
    }

    if (confirmModalCancel) {
        confirmModalCancel.addEventListener('click', () => {
            confirmModal.style.display = 'none';
            confirmCallback = null;
        });
    }

    // Close modal on backdrop click
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.style.display = 'none';
                confirmCallback = null;
            }
        });
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await window.i18n.init();

    // Listen for language changes
    window.addEventListener('languageChanged', async (event) => {
        console.log('[Tasks] Language changed, reloading data');
        clearLookupCaches();  // Clear cached translations
        await loadTasksData();
        updateTaskCounter();
        // Re-render all UI components with new translations
        renderTasks();
        renderSelectedTasks();
        renderCharacters();
    });

    await loadTasksData();
    updateTaskCounter();
    setupEventDelegation();
    setupTaskSearch();
    setupKeyboardShortcuts();
});

// Keyboard shortcuts for accessibility
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape key - close modals
        if (e.key === 'Escape') {
            // Close ownership modal
            const ownershipModal = document.getElementById('ownership-modal');
            if (ownershipModal && ownershipModal.style.display === 'flex') {
                ownershipModal.style.display = 'none';
                return;
            }

            // Close confirmation modal
            const confirmModal = document.getElementById('confirm-modal');
            if (confirmModal && confirmModal.style.display === 'flex') {
                confirmModal.style.display = 'none';
                confirmCallback = null;
                return;
            }
        }

        // Enter key - confirm in confirmation modal
        if (e.key === 'Enter') {
            const confirmModal = document.getElementById('confirm-modal');
            if (confirmModal && confirmModal.style.display === 'flex') {
                confirmModal.style.display = 'none';
                if (confirmCallback) {
                    confirmCallback();
                    confirmCallback = null;
                }
                e.preventDefault();
                return;
            }
        }
    });
}
