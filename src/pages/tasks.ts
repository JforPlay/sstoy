/**
 * Tasks Page Module
 * Handles task assignment optimization matching characters to missions
 */

// Import shared utilities first (auto-initializes)
import '@/shared';
import { debounce, showError, showWarning, showSuccess, createEmptyState } from '@/shared';
import '@/i18n';
import { saveToLocalStorage, loadFromLocalStorage } from '@/utils/storage';

import type { CharacterData } from '@/types';

// =============================================================================
// INTERFACES
// =============================================================================

interface Task {
  Id: number;
  Level: number;
  Note: string;
  Name: string;
  Tags?: number[];
  ExtraTags?: number[];
  RewardPreview1?: string;
}

interface CharacterDesData {
  Tag?: number[];
  [key: string]: unknown;
}

interface TagCounts {
  required: Record<number, number>;
  extra: Record<number, number>;
}

interface Team {
  chars: CharacterData[];
  charIds: number[];
  extrasFull: boolean;
  extraSlotsCovered: number;
  extraCoverageByTag: Record<number, number>;
  baseCoverageByTag: Record<number, number>;
  size: number;
  rarityBonus: number;
}

interface TaskInfo {
  task: Task;
  id: number;
  tagCounts: TagCounts;
  requiredTags: number[];
  extraTags: number[];
  allTags: number[];
}

interface TasksState {
  allTasks: Task[];
  selectedTasks: Task[];
  characters: CharacterData[];
  characterNames: Record<string, string>;
  characterTags: Record<number, CharacterDesData>;
  taskStrings: Record<string, string>;
  tagStrings: Record<string, string>;
  maxTasks: number;
  maxCharactersPerTask: number;
  assignedCharacters: Record<number, (number | null)[]>;
  filledTagSlots: Record<number, Record<number, number>>;
  characterFilledTag: Record<number, Record<number, number[]>>;
  activeTaskId: number | null;
  ownedCharacters: Set<number>;
  characterFilter: 'all' | 'owned' | 'not-owned';
  insightsPanelCollapsed: boolean;
}

interface LookupCache {
  taskTitles: Map<string, string>;
  taskSubtitles: Map<string, string>;
  characterNames: Map<number, string>;
  tagNames: Map<number, string>;
  characterTags: Map<number, number[]>;
  taskTagCounts: Map<number, TagCounts>;
}

// =============================================================================
// STATE
// =============================================================================

const tasksState: TasksState = {
  allTasks: [],
  selectedTasks: [],
  characters: [],
  characterNames: {},
  characterTags: {},
  taskStrings: {},
  tagStrings: {},
  maxTasks: 4,
  maxCharactersPerTask: 3,
  assignedCharacters: {},
  filledTagSlots: {},
  characterFilledTag: {},
  activeTaskId: null,
  ownedCharacters: new Set(),
  characterFilter: 'all',
  insightsPanelCollapsed: true,
};

const lookupCache: LookupCache = {
  taskTitles: new Map(),
  taskSubtitles: new Map(),
  characterNames: new Map(),
  tagNames: new Map(),
  characterTags: new Map(),
  taskTagCounts: new Map(),
};

let confirmCallback: (() => void) | null = null;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getTagCounts(task: Task): TagCounts {
  const cacheKey = task.Id;
  if (lookupCache.taskTagCounts.has(cacheKey)) {
    return lookupCache.taskTagCounts.get(cacheKey)!;
  }

  const requiredTagCounts: Record<number, number> = {};
  const extraTagCounts: Record<number, number> = {};

  (task.Tags || []).forEach((tag) => {
    requiredTagCounts[tag] = (requiredTagCounts[tag] || 0) + 1;
  });

  (task.ExtraTags || []).forEach((tag) => {
    extraTagCounts[tag] = (extraTagCounts[tag] || 0) + 1;
  });

  const result = { required: requiredTagCounts, extra: extraTagCounts };
  lookupCache.taskTagCounts.set(cacheKey, result);
  return result;
}

function getTranslatedTaskTitle(task: Task): string {
  const cacheKey = `title_${task.Id}`;
  if (lookupCache.taskTitles.has(cacheKey)) {
    return lookupCache.taskTitles.get(cacheKey)!;
  }
  const title = tasksState.taskStrings[task.Note] || task.Note;
  lookupCache.taskTitles.set(cacheKey, title);
  return title;
}

function getTranslatedTaskSubtitle(task: Task): string {
  const cacheKey = `subtitle_${task.Id}`;
  if (lookupCache.taskSubtitles.has(cacheKey)) {
    return lookupCache.taskSubtitles.get(cacheKey)!;
  }
  const subtitle = tasksState.taskStrings[task.Name] || task.Name;
  lookupCache.taskSubtitles.set(cacheKey, subtitle);
  return subtitle;
}

function getTranslatedCharacterName(char: CharacterData): string {
  const cacheKey = parseInt(char.Id);
  if (lookupCache.characterNames.has(cacheKey)) {
    return lookupCache.characterNames.get(cacheKey)!;
  }
  const nameKey = char.Name as string;
  const name = tasksState.characterNames[nameKey] || nameKey;
  lookupCache.characterNames.set(cacheKey, name);
  return name;
}

function getTranslatedTagName(tag: number): string {
  if (lookupCache.tagNames.has(tag)) {
    return lookupCache.tagNames.get(tag)!;
  }
  const tagName = tasksState.tagStrings[`CharacterTag.${tag}.1`] || String(tag);
  lookupCache.tagNames.set(tag, tagName);
  return tagName;
}

function getCharacterTags(charId: number): number[] {
  if (lookupCache.characterTags.has(charId)) {
    return lookupCache.characterTags.get(charId)!;
  }
  const charDesData = tasksState.characterTags[charId];
  const tags = charDesData?.Tag || [];
  lookupCache.characterTags.set(charId, tags);
  return tags;
}

function canCharacterFillTag(charId: number, taskId: number, tag: number): boolean {
  const charTags = getCharacterTags(charId);
  if (!charTags.includes(tag)) return false;

  const task = tasksState.selectedTasks.find((t) => t.Id === taskId);
  if (!task) return false;

  const allTaskTags = [...(task.Tags || []), ...(task.ExtraTags || [])];
  if (!allTaskTags.includes(tag)) return false;

  const filledSlots = tasksState.filledTagSlots[taskId] || {};
  const tagCounts = getTagCounts(task);
  const currentFilled = filledSlots[tag] || 0;
  const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);

  return currentFilled < totalRequired;
}

function clearLookupCaches(): void {
  lookupCache.taskTitles.clear();
  lookupCache.taskSubtitles.clear();
  lookupCache.characterNames.clear();
  lookupCache.tagNames.clear();
  lookupCache.characterTags.clear();
  lookupCache.taskTagCounts.clear();
}

// =============================================================================
// OWNERSHIP MANAGEMENT
// =============================================================================

function loadOwnership(): void {
  const ownedArray = loadFromLocalStorage<number[]>('tasksOwnedCharacters');
  if (ownedArray) {
    tasksState.ownedCharacters = new Set(ownedArray);
  }
}

function saveOwnership(): void {
  const ownedArray = Array.from(tasksState.ownedCharacters);
  saveToLocalStorage('tasksOwnedCharacters', ownedArray);
}

function toggleOwnership(charId: number): void {
  if (tasksState.ownedCharacters.has(charId)) {
    tasksState.ownedCharacters.delete(charId);
  } else {
    tasksState.ownedCharacters.add(charId);
  }
  saveOwnership();
}

function selectAllOwned(): void {
  const validCharacters = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???';
  });
  validCharacters.forEach((char) => tasksState.ownedCharacters.add(parseInt(char.Id)));
  saveOwnership();
  renderOwnershipGrid();
  updateOwnershipCount();
}

function deselectAllOwned(): void {
  tasksState.ownedCharacters.clear();
  saveOwnership();
  renderOwnershipGrid();
  updateOwnershipCount();
}

function updateOwnershipCount(): void {
  const total = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???';
  }).length;
  const owned = tasksState.ownedCharacters.size;
  const countElement = document.getElementById('ownership-count');
  if (countElement) {
    countElement.textContent = `보유: ${owned} / ${total}`;
  }
}

// =============================================================================
// MODAL FUNCTIONS
// =============================================================================

function openOwnershipModal(): void {
  const modal = document.getElementById('ownership-modal');
  if (modal) {
    modal.style.display = 'flex';
    renderOwnershipGrid();
    updateOwnershipCount();
  }
}

function closeOwnershipModal(): void {
  const modal = document.getElementById('ownership-modal');
  if (modal) {
    modal.style.display = 'none';
    renderCharacters();
    updateHeaderStats();
    updateRecommendations();
  }
}

function showConfirm(title: string, message: string, onConfirm: () => void): void {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const messageEl = document.getElementById('confirm-modal-message');

  if (!modal || !titleEl || !messageEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.style.display = 'flex';
  confirmCallback = onConfirm;
}

// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================

function renderOwnershipGrid(): void {
  const container = document.getElementById('ownership-grid');
  if (!container) return;

  const validCharacters = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???';
  });

  container.innerHTML = validCharacters
    .map((char) => {
      const name = getTranslatedCharacterName(char);
      const charIdStr = String(char.Id);
      const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
      const isOwned = tasksState.ownedCharacters.has(parseInt(char.Id));

      return `
      <div class="ownership-card ${isOwned ? 'owned' : ''}" data-ownership-char-id="${char.Id}">
        <img src="${imagePath}" alt="${name}" class="ownership-card-image" loading="lazy" onerror="this.style.display='none'">
        <div class="ownership-card-name">${name}</div>
      </div>
    `;
    })
    .join('');
}

function setCharacterFilter(filter: 'all' | 'owned' | 'not-owned'): void {
  tasksState.characterFilter = filter;
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    const btnEl = btn as HTMLElement;
    btn.classList.toggle('active', btnEl.dataset.filter === filter);
  });
  renderCharacters();
}

function updateHeaderStats(): void {
  const ownedCountElement = document.getElementById('header-owned-count');
  if (ownedCountElement) {
    const totalChars = tasksState.characters.filter((char) => {
      const name = getTranslatedCharacterName(char);
      return name !== '???';
    }).length;
    const ownedChars = tasksState.ownedCharacters.size;
    ownedCountElement.textContent = `보유: ${ownedChars}/${totalChars}`;
  }

  const completionElement = document.getElementById('header-completion');
  if (completionElement) {
    let completedTasks = 0;
    tasksState.selectedTasks.forEach((task) => {
      const tagCounts = getTagCounts(task);
      const filledSlots = tasksState.filledTagSlots[task.Id] || {};
      const allRequiredFilled = Object.entries(tagCounts.required).every(([tag, count]) => {
        return (filledSlots[parseInt(tag)] || 0) >= count;
      });
      if (allRequiredFilled) completedTasks++;
    });
    completionElement.textContent = `완료: ${completedTasks}/${tasksState.selectedTasks.length}`;
  }
}

function updateTaskPoolCount(): void {
  const countElement = document.getElementById('task-pool-count');
  if (countElement) {
    countElement.textContent = `${tasksState.allTasks.length}개`;
  }
}

function updateTaskCounter(): void {
  const counter = document.getElementById('task-counter');
  if (counter) {
    counter.textContent = `${tasksState.selectedTasks.length}/${tasksState.maxTasks}`;
  }
}

function updateClearAllButton(): void {
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

function updateRecommendations(): void {
  const section = document.getElementById('recommendations-section');
  const content = document.getElementById('recommendations-content');

  if (!section || !content) return;

  if (tasksState.selectedTasks.length === 0) {
    section.style.display = 'none';
    return;
  }

  const insights = calculateInsights();
  if (!insights || insights.acquisitionPriority.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const topRecommendations = insights.acquisitionPriority.slice(0, 5);

  content.innerHTML = topRecommendations
    .map((priority) => {
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
    })
    .join('');
}

function renderTasks(): void {
  const container = document.getElementById('tasks-list');
  if (!container) return;

  if (tasksState.allTasks.length === 0) {
    container.innerHTML = createEmptyState('tasks', window.i18n?.t('tasks.noTasks') || '과제가 없습니다');
    return;
  }

  container.innerHTML = tasksState.allTasks
    .map((task) => {
      const title = getTranslatedTaskTitle(task);
      const subtitle = getTranslatedTaskSubtitle(task);
      const isSelected = tasksState.selectedTasks.some((t) => t.Id === task.Id);
      const isDisabled = !isSelected && tasksState.selectedTasks.length >= tasksState.maxTasks;

      let rewardIconHtml = '';
      if (task.RewardPreview1) {
        try {
          const rewardData = JSON.parse(task.RewardPreview1) as number[][];
          const firstReward = rewardData?.[0];
          if (firstReward && firstReward.length > 0) {
            const itemId = firstReward[0];
            if (itemId !== undefined) {
              const iconPath = `assets/items/item_${itemId}.png`;
              rewardIconHtml = `
              <div class="task-reward-icon-wrapper">
                <img src="${iconPath}" alt="Reward Icon" class="task-reward-icon" loading="lazy" onerror="this.style.display='none'">
              </div>
            `;
            }
          }
        } catch (e) {
          console.error('Error parsing RewardPreview1 for task', task.Id, e);
        }
      }

      return `
      <div class="task-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
           data-task-id="${task.Id}">
        <div class="task-header">
          <div class="task-info-text">
            <div class="task-title">${title}</div>
            <div class="task-subtitle">${subtitle}</div>
          </div>
          ${rewardIconHtml}
        </div>
        ${
          (task.Tags || []).length > 0
            ? `
        <div class="task-tags-row">
          <div class="task-tags-label">필수</div>
          <div class="task-tags">
            ${(task.Tags || [])
              .map((tag) => {
                const tagName = getTranslatedTagName(tag);
                return `<span class="task-tag required"><span class="tag-icon">${window.getIcon?.('star') || ''}</span>${tagName}</span>`;
              })
              .join('')}
          </div>
        </div>
        `
            : ''
        }
        ${
          (task.ExtraTags || []).length > 0
            ? `
        <div class="task-tags-row">
          <div class="task-tags-label">추가</div>
          <div class="task-tags">
            ${(task.ExtraTags || [])
              .map((tag) => {
                const tagName = getTranslatedTagName(tag);
                return `<span class="task-tag extra"><span class="tag-icon">✨</span>${tagName}</span>`;
              })
              .join('')}
          </div>
        </div>
        `
            : ''
        }
      </div>
    `;
    })
    .join('');
}

function renderSelectedTasks(): void {
  const container = document.getElementById('selected-tasks');
  if (!container) return;

  if (tasksState.selectedTasks.length === 0) {
    container.innerHTML = `
      ${createEmptyState('memo', window.i18n?.t('tasks.noSelectedTasks') || '선택된 과제가 없습니다')}
    `.replace('</div>', '<div class="empty-state-hint">옆에서 과제를 선택해주세요</div></div>');
    return;
  }

  container.innerHTML = tasksState.selectedTasks
    .map((task) => {
      const title = getTranslatedTaskTitle(task);
      const subtitle = getTranslatedTaskSubtitle(task);
      const tagCounts = getTagCounts(task);
      const filledTagSlots = tasksState.filledTagSlots[task.Id] || {};
      const uniqueRequiredTags = [...new Set(task.Tags || [])];
      const uniqueExtraTags = [...new Set(task.ExtraTags || [])];

      const requiredTags = uniqueRequiredTags.map((tag) => ({
        id: tag,
        name: getTranslatedTagName(tag),
      }));

      const extraTags = uniqueExtraTags.map((tag) => ({
        id: tag,
        name: getTranslatedTagName(tag),
      }));

      const assignedChars = tasksState.assignedCharacters[task.Id] || [];
      const isActive = tasksState.activeTaskId === task.Id;

      return `
      <div class="selected-task-card ${isActive ? 'active' : ''}" data-selected-task-id="${task.Id}">
        <div class="selected-task-header">
          <div class="selected-task-info">
            <div class="selected-task-title">${title}</div>
            <div class="selected-task-subtitle">${subtitle}</div>
          </div>
          <div class="selected-task-actions">
            ${isActive ? '<span class="task-active-badge">캐릭터 선택 중</span>' : ''}
            <button class="remove-task-btn" data-remove-task-id="${task.Id}">×</button>
          </div>
        </div>

        <div class="assigned-characters" data-task-slots="${task.Id}">
          ${renderCharacterSlots(task.Id, assignedChars)}
        </div>

        <div class="task-requirements">
          ${
            requiredTags.length > 0
              ? `
            <div class="requirement-group">
              <div class="requirement-label">필수 태그</div>
              <div class="requirement-tags">
                ${requiredTags
                  .map((tag) => {
                    const required = tagCounts.required[tag.id] || 0;
                    const totalFilled = filledTagSlots[tag.id] || 0;
                    const filled = Math.min(totalFilled, required);
                    const isFilled = filled >= required;
                    return `<span class="requirement-tag required ${isFilled ? 'filled' : ''}">${tag.name} (${filled}/${required})</span>`;
                  })
                  .join('')}
              </div>
            </div>
          `
              : ''
          }
          ${
            extraTags.length > 0
              ? `
            <div class="requirement-group">
              <div class="requirement-label">추가 태그</div>
              <div class="requirement-tags">
                ${extraTags
                  .map((tag) => {
                    const required = tagCounts.required[tag.id] || 0;
                    const extra = tagCounts.extra[tag.id] || 0;
                    const totalFilled = filledTagSlots[tag.id] || 0;
                    const filledExtra = Math.max(0, totalFilled - required);
                    const isFilled = filledExtra > 0;
                    return `<span class="requirement-tag extra ${isFilled ? 'filled' : ''}">${tag.name} (${filledExtra}/${extra})</span>`;
                  })
                  .join('')}
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');
}

function renderCharacterSlots(taskId: number, assignedChars: (number | null)[]): string {
  const slots: string[] = [];
  for (let i = 0; i < tasksState.maxCharactersPerTask; i++) {
    const charId = assignedChars[i];
    if (charId) {
      const char = tasksState.characters.find((c) => parseInt(c.Id) === charId);
      if (char) {
        const name = getTranslatedCharacterName(char);
        const charIdStr = String(char.Id);
        const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
        const charTags = getCharacterTags(parseInt(char.Id));
        const task = tasksState.selectedTasks.find((t) => t.Id === taskId);
        const taskTags = new Set([...(task?.Tags || []), ...(task?.ExtraTags || [])]);

        slots.push(`
          <div class="character-slot filled">
            <button class="remove-character-btn" data-remove-char-task="${taskId}" data-remove-char-slot="${i}">×</button>
            <img src="${imagePath}" alt="${name}" class="slot-image" loading="lazy" onerror="this.style.display='none'">
            <div class="slot-info">
              <div class="slot-name">${name}</div>
              <div class="character-slot-tags">
                ${charTags
                  .slice(0, 2)
                  .map((tag) => {
                    const matches = taskTags.has(tag);
                    const tagName = getTranslatedTagName(tag);
                    return `<span class="slot-tag ${matches ? 'matches' : ''}">${tagName}</span>`;
                  })
                  .join('')}
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

function renderCharacters(): void {
  const container = document.getElementById('characters-list');
  if (!container) return;

  let validCharacters = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???';
  });

  if (tasksState.characterFilter === 'owned') {
    validCharacters = validCharacters.filter((char) =>
      tasksState.ownedCharacters.has(parseInt(char.Id))
    );
  } else if (tasksState.characterFilter === 'not-owned') {
    validCharacters = validCharacters.filter(
      (char) => !tasksState.ownedCharacters.has(parseInt(char.Id))
    );
  }

  if (tasksState.activeTaskId) {
    const activeTask = tasksState.selectedTasks.find((t) => t.Id === tasksState.activeTaskId);
    if (activeTask) {
      const filledSlots = tasksState.filledTagSlots[tasksState.activeTaskId] || {};
      const tagCounts = getTagCounts(activeTask);
      const allTaskTags = [...(activeTask.Tags || []), ...(activeTask.ExtraTags || [])];
      const activeTaskChars = tasksState.assignedCharacters[tasksState.activeTaskId] || [];

      const characterFillableScores = new Map<number, number>();

      validCharacters.forEach((char) => {
        const charTags = getCharacterTags(parseInt(char.Id));
        const canFillCount = charTags.filter((tag) => {
          if (allTaskTags.includes(tag)) {
            const currentFilled = filledSlots[tag] || 0;
            const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
            return currentFilled < totalRequired;
          }
          return false;
        }).length;
        characterFillableScores.set(parseInt(char.Id), canFillCount);
      });

      validCharacters.sort((a, b) => {
        const aAssigned = activeTaskChars.includes(parseInt(a.Id)) ? 1 : 0;
        const bAssigned = activeTaskChars.includes(parseInt(b.Id)) ? 1 : 0;
        if (aAssigned !== bAssigned) return bAssigned - aAssigned;

        const aOwned = tasksState.ownedCharacters.has(parseInt(a.Id)) ? 1 : 0;
        const bOwned = tasksState.ownedCharacters.has(parseInt(b.Id)) ? 1 : 0;
        if (aOwned !== bOwned) return bOwned - aOwned;

        const aScore = characterFillableScores.get(parseInt(a.Id)) || 0;
        const bScore = characterFillableScores.get(parseInt(b.Id)) || 0;
        return bScore - aScore;
      });
    }
  } else {
    validCharacters.sort((a, b) => {
      const aOwned = tasksState.ownedCharacters.has(parseInt(a.Id)) ? 1 : 0;
      const bOwned = tasksState.ownedCharacters.has(parseInt(b.Id)) ? 1 : 0;
      return bOwned - aOwned;
    });
  }

  if (validCharacters.length === 0) {
    container.innerHTML = createEmptyState('people', window.i18n?.t('tasks.noCharacters') || '캐릭터가 없습니다');
    return;
  }

  const activeTaskChars = tasksState.activeTaskId
    ? tasksState.assignedCharacters[tasksState.activeTaskId] || []
    : [];

  const activeTask = tasksState.activeTaskId
    ? tasksState.selectedTasks.find((t) => t.Id === tasksState.activeTaskId)
    : null;

  const activeTaskData = activeTask
    ? {
        allTaskTags: [...(activeTask.Tags || []), ...(activeTask.ExtraTags || [])],
        filledSlots: tasksState.filledTagSlots[tasksState.activeTaskId!] || {},
        tagCounts: getTagCounts(activeTask),
      }
    : null;

  const charsAssignedToOtherTasks = new Set<number>();
  Object.entries(tasksState.assignedCharacters).forEach(([taskId, chars]) => {
    if (!tasksState.activeTaskId || parseInt(taskId) !== tasksState.activeTaskId) {
      chars.forEach((charId) => {
        if (charId) charsAssignedToOtherTasks.add(charId);
      });
    }
  });

  container.innerHTML = validCharacters
    .map((char) => {
      const name = getTranslatedCharacterName(char);
      const tags = getCharacterTags(parseInt(char.Id));
      const charIdStr = String(char.Id);
      const imagePath = `assets/char/avg1_${charIdStr}_002.png`;
      const isOwned = tasksState.ownedCharacters.has(parseInt(char.Id));
      const isAssignedToActiveTask = activeTaskChars.includes(parseInt(char.Id));
      const isAssignedToOtherTask = charsAssignedToOtherTasks.has(parseInt(char.Id));

      let canFillRemainingSlots = false;
      if (activeTaskData && !isAssignedToActiveTask) {
        canFillRemainingSlots = tags.some((charTag) => {
          if (activeTaskData.allTaskTags.includes(charTag)) {
            const currentFilled = activeTaskData.filledSlots[charTag] || 0;
            const totalRequired =
              (activeTaskData.tagCounts.required[charTag] || 0) +
              (activeTaskData.tagCounts.extra[charTag] || 0);
            return currentFilled < totalRequired;
          }
          return false;
        });
      }

      const isClickable =
        tasksState.selectedTasks.length > 0 && tasksState.activeTaskId && !isAssignedToOtherTask;
      const cursorClass = !isClickable ? 'not-clickable' : '';

      return `
      <div class="character-card-small ${isOwned ? 'owned' : ''} ${isAssignedToActiveTask ? 'selected' : ''} ${isAssignedToOtherTask ? 'disabled' : ''} ${canFillRemainingSlots ? 'highlighted' : ''} ${cursorClass}" data-character-id="${char.Id}">
        <img src="${imagePath}" alt="${name}" class="character-image-small" loading="lazy" onerror="this.style.display='none'">
        <div class="character-name-small">${name}</div>
        <div class="character-tags-small">
          ${tags
            .slice(0, 2)
            .map((tag) => {
              const tagName = getTranslatedTagName(tag);
              let isMatching = false;
              if (tasksState.activeTaskId && !isAssignedToActiveTask) {
                isMatching = canCharacterFillTag(parseInt(char.Id), tasksState.activeTaskId, tag);
              }
              return `<span class="character-tag-badge ${isMatching ? 'matching' : ''}">${tagName}</span>`;
            })
            .join('')}
        </div>
      </div>
    `;
    })
    .join('');
}

// =============================================================================
// TASK OPERATIONS
// =============================================================================

function toggleTaskSelection(taskId: number): void {
  const task = tasksState.allTasks.find((t) => t.Id === taskId);
  if (!task) return;

  const index = tasksState.selectedTasks.findIndex((t) => t.Id === taskId);

  if (index > -1) {
    tasksState.selectedTasks.splice(index, 1);
    delete tasksState.assignedCharacters[taskId];
    delete tasksState.filledTagSlots[taskId];
    delete tasksState.characterFilledTag[taskId];

    if (tasksState.activeTaskId === taskId) {
      tasksState.activeTaskId = null;
    }
  } else {
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

function selectTask(taskId: number): void {
  if (tasksState.activeTaskId === taskId) {
    tasksState.activeTaskId = null;
  } else {
    tasksState.activeTaskId = taskId;
  }
  renderSelectedTasks();
  renderCharacters();
}

function clearAllAssignments(): void {
  if (tasksState.selectedTasks.length === 0) return;

  const assignedCount = Object.values(tasksState.assignedCharacters)
    .flat()
    .filter((id) => id).length;

  if (assignedCount === 0) {
    showWarning('배정된 캐릭터가 없습니다.');
    return;
  }

  showConfirm('캐릭터 초기화', '모든 캐릭터 배정을 제거하시겠습니까?\n(선택된 의뢰는 유지됩니다)', () => {
    tasksState.assignedCharacters = {};
    tasksState.filledTagSlots = {};
    tasksState.characterFilledTag = {};

    tasksState.selectedTasks.forEach((task) => {
      tasksState.assignedCharacters[task.Id] = [];
      tasksState.filledTagSlots[task.Id] = {};
      tasksState.characterFilledTag[task.Id] = {};
    });

    renderSelectedTasks();
    renderCharacters();
    updateHeaderStats();
    updateRecommendations();
    showSuccess('모든 캐릭터 배정이 초기화되었습니다.');
  });
}

// =============================================================================
// CHARACTER ASSIGNMENT
// =============================================================================

function onCharacterClick(charId: number): void {
  if (tasksState.selectedTasks.length === 0) {
    showWarning('먼저 과제를 선택해주세요. 위에서 최대 4개의 과제를 선택할 수 있습니다.');
    return;
  }

  if (!tasksState.activeTaskId) {
    const firstTask = tasksState.selectedTasks[0];
    tasksState.activeTaskId = firstTask?.Id || null;
    renderSelectedTasks();
    renderCharacters();
    return;
  }

  const activeTask = tasksState.selectedTasks.find((t) => t.Id === tasksState.activeTaskId);
  const taskTitle = getTranslatedTaskTitle(activeTask!);
  const assignedChars = tasksState.assignedCharacters[tasksState.activeTaskId] || [];
  const assignedIndex = assignedChars.findIndex((c) => c === charId);

  if (assignedIndex >= 0) {
    removeCharacterFromTask(tasksState.activeTaskId, assignedIndex);
    return;
  }

  const nonNullChars = assignedChars.filter((c) => c !== null && c !== undefined);
  if (nonNullChars.length >= tasksState.maxCharactersPerTask) {
    showError(
      `"${taskTitle}" 과제의 모든 캐릭터 슬롯(${tasksState.maxCharactersPerTask}개)이 가득 찼습니다. 캐릭터를 제거한 후 다시 시도하세요.`
    );
    return;
  }

  const isAssignedElsewhere = Object.entries(tasksState.assignedCharacters).some(
    ([taskId, chars]) => {
      return parseInt(taskId) !== tasksState.activeTaskId && chars.includes(charId);
    }
  );

  if (isAssignedElsewhere) {
    const char = tasksState.characters.find((c) => parseInt(c.Id) === charId);
    const charName = getTranslatedCharacterName(char!);
    showError(`${charName}는 이미 다른 과제에 할당되어 있습니다. 각 캐릭터는 하나의 과제에만 할당할 수 있습니다.`);
    return;
  }

  const char = tasksState.characters.find((c) => parseInt(c.Id) === charId);
  const charTags = getCharacterTags(charId);
  const taskTags = [...(activeTask?.Tags || []), ...(activeTask?.ExtraTags || [])];
  const matchingTags = charTags.filter((charTag) => taskTags.includes(charTag));

  if (matchingTags.length === 0) {
    const charTagNames = charTags.map((tag) => getTranslatedTagName(tag)).join(', ');
    const requiredTagNames = (activeTask?.Tags || []).map((tag) => getTranslatedTagName(tag)).join(', ');
    showError(
      `${getTranslatedCharacterName(char!)}는 이 과제의 태그와 일치하지 않습니다.\n\n캐릭터 태그: ${charTagNames}\n필요한 태그: ${requiredTagNames}`
    );
    return;
  }

  const filledSlots = tasksState.filledTagSlots[tasksState.activeTaskId] || {};
  const tagCounts = getTagCounts(activeTask!);

  const tagsCanFill = matchingTags.filter((charTag) => {
    const currentFilled = filledSlots[charTag] || 0;
    const totalRequired = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
    return currentFilled < totalRequired;
  });

  if (tagsCanFill.length === 0) {
    const matchingTagNames = matchingTags
      .map((tag) => {
        const tagName = getTranslatedTagName(tag);
        const filled = filledSlots[tag] || 0;
        const total = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
        return `${tagName} (${filled}/${total})`;
      })
      .join(', ');
    showWarning(
      `${getTranslatedCharacterName(char!)}의 태그는 이미 모두 채워졌습니다.\n\n일치하는 태그: ${matchingTagNames}\n\n다른 캐릭터를 선택하거나 기존 캐릭터를 제거해주세요.`
    );
    return;
  }

  const emptySlotIndex = assignedChars.findIndex((c) => !c);
  const slotIndex = emptySlotIndex >= 0 ? emptySlotIndex : assignedChars.length;
  assignCharacterToSlot(tasksState.activeTaskId, slotIndex, charId);
}

function assignCharacterToSlot(taskId: number, slotIndex: number, charId: number): void {
  const assignedChars = tasksState.assignedCharacters[taskId] || [];
  if (assignedChars.includes(charId)) {
    showError('이 캐릭터는 이미 이 과제에 할당되어 있습니다.');
    return;
  }

  if (!tasksState.assignedCharacters[taskId]) {
    tasksState.assignedCharacters[taskId] = [];
  }
  if (!tasksState.filledTagSlots[taskId]) {
    tasksState.filledTagSlots[taskId] = {};
  }
  if (!tasksState.characterFilledTag[taskId]) {
    tasksState.characterFilledTag[taskId] = {};
  }

  const charTags = getCharacterTags(charId);
  const task = tasksState.selectedTasks.find((t) => t.Id === taskId);
  const allTaskTags = [...(task?.Tags || []), ...(task?.ExtraTags || [])];
  const tagCounts = getTagCounts(task!);
  const filledSlots = tasksState.filledTagSlots[taskId];
  const tagsToFill: number[] = [];

  for (const charTag of charTags) {
    if (allTaskTags.includes(charTag)) {
      const currentFilled = filledSlots[charTag] || 0;
      const totalRequired = (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
      if (currentFilled < totalRequired) {
        tagsToFill.push(charTag);
      }
    }
  }

  const filledTagsList: number[] = [];
  if (tagsToFill.length > 0) {
    const sortedTags = tagsToFill.sort((a, b) => {
      const aIsRequired = (tagCounts.required[a] || 0) > 0;
      const bIsRequired = (tagCounts.required[b] || 0) > 0;
      if (aIsRequired && !bIsRequired) return -1;
      if (!aIsRequired && bIsRequired) return 1;
      return 0;
    });

    for (const tag of sortedTags) {
      const currentFilled = filledSlots[tag] || 0;
      const totalRequired = (tagCounts.required[tag] || 0) + (tagCounts.extra[tag] || 0);
      if (currentFilled < totalRequired) {
        filledSlots[tag] = currentFilled + 1;
        filledTagsList.push(tag);
      }
    }

    tasksState.characterFilledTag[taskId][charId] = filledTagsList;
  }

  tasksState.assignedCharacters[taskId][slotIndex] = charId;
  renderSelectedTasks();
  renderCharacters();
  updateHeaderStats();
  updateRecommendations();
}

function removeCharacterFromTask(taskId: number, slotIndex: number): void {
  if (tasksState.assignedCharacters[taskId]) {
    const charId = tasksState.assignedCharacters[taskId][slotIndex];

    if (charId) {
      const filledTags = tasksState.characterFilledTag[taskId]?.[charId];

      if (filledTags) {
        const filledSlots = tasksState.filledTagSlots[taskId] || {};
        const tagsArray = Array.isArray(filledTags) ? filledTags : [filledTags];

        for (const tag of tagsArray) {
          if (filledSlots?.[tag] && filledSlots[tag] > 0) {
            filledSlots[tag]--;
          }
        }

        if (tasksState.characterFilledTag?.[taskId]) {
          delete tasksState.characterFilledTag[taskId][charId];
        }
      }
    }

    tasksState.assignedCharacters[taskId][slotIndex] = null;

    const assignedChars = tasksState.assignedCharacters?.[taskId];
    if (assignedChars) {
      while (
        assignedChars.length > 0 &&
        !assignedChars[assignedChars.length - 1]
      ) {
        assignedChars.pop();
      }
    }
  }

  renderSelectedTasks();
  renderCharacters();
  updateHeaderStats();
  updateRecommendations();
}

// =============================================================================
// AUTO-FILL ALGORITHM
// =============================================================================

function calculateTagRarity(
  tasks: Task[],
  availableChars: CharacterData[]
): Record<number, { count: number; rarity: number }> {
  const tagRarity: Record<number, { count: number; rarity: number }> = {};
  const allTags = new Set<number>();

  tasks.forEach((task) => {
    (task.Tags || []).forEach((tag) => allTags.add(tag));
    (task.ExtraTags || []).forEach((tag) => allTags.add(tag));
  });

  allTags.forEach((tag) => {
    const charCount = availableChars.filter((char) => {
      const charTags = getCharacterTags(parseInt(char.Id));
      return charTags.includes(tag);
    }).length;

    tagRarity[tag] = {
      count: charCount,
      rarity: charCount > 0 ? 1 / charCount : 0,
    };
  });

  return tagRarity;
}

function buildTaskInfo(task: Task): TaskInfo {
  const tagCounts = getTagCounts(task);
  const requiredTags = Object.keys(tagCounts.required).map((k) => parseInt(k, 10));
  const extraTags = Object.keys(tagCounts.extra).map((k) => parseInt(k, 10));
  const allTags = Array.from(new Set([...requiredTags, ...extraTags]));

  return {
    task,
    id: task.Id,
    tagCounts,
    requiredTags,
    extraTags,
    allTags,
  };
}

function buildRemainingTaskInfo(task: Task): TaskInfo | null {
  const baseCounts = getTagCounts(task);
  const filledSlots = tasksState.filledTagSlots[task.Id] || {};

  const remainingRequired: Record<number, number> = {};
  const remainingExtra: Record<number, number> = {};

  Object.entries(baseCounts.required).forEach(([tagStr, count]) => {
    const tag = parseInt(tagStr, 10);
    const filled = filledSlots[tag] || 0;
    const needed = Math.max(0, count - filled);
    if (needed > 0) {
      remainingRequired[tag] = needed;
    }
  });

  Object.entries(baseCounts.extra).forEach(([tagStr, extraCount]) => {
    const tag = parseInt(tagStr, 10);
    const requiredCount = baseCounts.required[tag] || 0;
    const filled = filledSlots[tag] || 0;
    const extraCovered = Math.max(0, filled - requiredCount);
    const extraNeeded = Math.max(0, extraCount - extraCovered);
    if (extraNeeded > 0) {
      remainingExtra[tag] = extraNeeded;
    }
  });

  const requiredTags = Object.keys(remainingRequired).map((k) => parseInt(k, 10));
  const extraTags = Object.keys(remainingExtra).map((k) => parseInt(k, 10));
  const allTags = Array.from(new Set([...requiredTags, ...extraTags]));

  if (requiredTags.length === 0 && extraTags.length === 0) return null;

  return {
    task,
    id: task.Id,
    tagCounts: { required: remainingRequired, extra: remainingExtra },
    requiredTags,
    extraTags,
    allTags,
  };
}

function isTaskBaseComplete(task: Task): boolean {
  const tagCounts = getTagCounts(task);
  const filledSlots = tasksState.filledTagSlots[task.Id] || {};
  return Object.entries(tagCounts.required).every(([tagStr, needed]) => {
    const tag = parseInt(tagStr, 10);
    return (filledSlots[tag] || 0) >= needed;
  });
}

function buildGlobalExtraDemand(): Record<number, number> {
  const demand: Record<number, number> = {};

  tasksState.selectedTasks.forEach((task) => {
    const remaining = buildRemainingTaskInfo(task);
    if (!remaining) return;

    Object.entries(remaining.tagCounts.extra).forEach(([tagStr, count]) => {
      const tag = parseInt(tagStr, 10);
      demand[tag] = (demand[tag] || 0) + count;
    });
  });

  return demand;
}

function calculateGlobalExtraNeedFromInfos(taskInfos: TaskInfo[]): Record<number, number> {
  const need: Record<number, number> = {};
  taskInfos.forEach((info) => {
    Object.entries(info.tagCounts.extra).forEach(([tagStr, count]) => {
      const tag = parseInt(tagStr, 10);
      need[tag] = (need[tag] || 0) + count;
    });
  });
  return need;
}

function generateTaskTeams(
  taskInfo: TaskInfo,
  availableChars: CharacterData[],
  tagRarity: Record<number, { count: number; rarity: number }>,
  globalExtraNeed: Record<number, number>
): Team[] {
  const maxTeamSize = tasksState.maxCharactersPerTask;
  const { requiredTags, extraTags, tagCounts } = taskInfo;
  const allTags = [...new Set([...requiredTags, ...extraTags])];

  const scoredChars = availableChars
    .map((char) => {
      const charTags = getCharacterTags(parseInt(char.Id));
      const hits = charTags.filter((t) => allTags.includes(t));
      if (hits.length === 0) return null;

      const score = hits.reduce((s, tag) => {
        const rarity = tagRarity[tag]?.rarity || 0;
        return s + 1 + rarity;
      }, 0);

      return { char, score };
    })
    .filter((x): x is { char: CharacterData; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  const MAX_POOL = 12;
  const relevantChars = scoredChars.slice(0, MAX_POOL).map((x) => x.char);
  const n = relevantChars.length;
  if (n === 0) return [];

  const teams: Team[] = [];
  const idxs: number[] = [];

  function evaluateTeam(indexes: number[]): Team | null {
    const team = indexes.map((i) => relevantChars[i]);
    const coverage: Record<number, number> = {};
    const extraCoverage: Record<number, number> = {};
    const baseCoverageByTag: Record<number, number> = {};
    const extraCoverageByTag: Record<number, number> = {};

    team.forEach((char) => {
      if (!char) return;
      const charTags = getCharacterTags(parseInt(char.Id));
      charTags.forEach((tag) => {
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

    for (const tag of requiredTags) {
      const needed = tagCounts.required[tag] || 0;
      const have = coverage[tag] || 0;
      baseCoverageByTag[tag] = Math.min(needed, have);
      if (have < needed) return null;
    }

    let extrasFull = true;
    let extraSlotsCovered = 0;
    let globalExtraGain = 0;

    for (const tag of extraTags) {
      const extraNeeded = tagCounts.extra[tag] || 0;
      if (!extraNeeded) continue;

      const reqNeeded = tagCounts.required[tag] || 0;
      const totalNeeded = reqNeeded + extraNeeded;
      const have = (coverage[tag] || 0) + (extraCoverage[tag] || 0);
      const availableForExtra = Math.max(0, have - reqNeeded);
      const coveredExtra = Math.min(extraNeeded, availableForExtra);
      if (coveredExtra > 0) {
        extraCoverageByTag[tag] = coveredExtra;
      }
      const globalNeed = globalExtraNeed[tag] || 0;
      const demandGain = Math.min(coveredExtra, Math.max(0, globalNeed));
      globalExtraGain += demandGain;

      if (have >= totalNeeded) {
        extraSlotsCovered += extraNeeded;
      } else {
        extrasFull = false;
        extraSlotsCovered += coveredExtra;
      }
    }

    const rarityBonus = requiredTags.reduce((sum, tag) => {
      const rarity = tagRarity[tag]?.rarity || 0;
      return sum + rarity * (tagCounts.required[tag] || 0);
    }, 0);

    let wastedExtras = 0;
    extraTags.forEach((tag) => {
      const reqNeeded = tagCounts.required[tag] || 0;
      const extraNeeded = tagCounts.extra[tag] || 0;
      const have = (coverage[tag] || 0) + (extraCoverage[tag] || 0);
      const totalNeeded = reqNeeded + extraNeeded;
      if (have > totalNeeded) {
        wastedExtras += have - totalNeeded;
      }
    });

    return {
      chars: team.filter((c): c is CharacterData => c !== undefined),
      charIds: team.filter((c): c is CharacterData => c !== undefined).map((c) => parseInt(c.Id)),
      extrasFull,
      extraSlotsCovered,
      extraCoverageByTag,
      baseCoverageByTag,
      size: team.length,
      rarityBonus: rarityBonus + globalExtraGain * 0.01 - wastedExtras * 10,
    };
  }

  function dfs(start: number, left: number): void {
    if (left === 0) {
      const team = evaluateTeam(idxs);
      if (team) teams.push(team);
      return;
    }
    for (let i = start; i <= n - left; i++) {
      idxs.push(i);
      dfs(i + 1, left - 1);
      idxs.pop();
    }
  }

  const limitSize = Math.min(maxTeamSize, n);
  for (let size = 1; size <= limitSize; size++) {
    dfs(0, size);
  }

  teams.sort((a, b) => {
    if (a.extrasFull !== b.extrasFull) return (b.extrasFull ? 1 : 0) - (a.extrasFull ? 1 : 0);
    if (a.extraSlotsCovered !== b.extraSlotsCovered)
      return b.extraSlotsCovered - a.extraSlotsCovered;
    if (a.rarityBonus !== b.rarityBonus) return b.rarityBonus - a.rarityBonus;
    return a.size - b.size;
  });

  return teams.slice(0, 40);
}

function chooseBestTeams(
  taskInfos: TaskInfo[],
  taskTeams: Team[][]
): {
  assignment: (Team | null)[];
  tasksCompleted: number;
  extrasFullTasks: number;
  totalExtraSlots: number;
} {
  const taskCount = taskInfos.length;
  const usedCharIds = new Set<number>();
  const globalExtraNeed: Record<number, number> = {};

  taskInfos.forEach((info) => {
    Object.entries(info.tagCounts.extra).forEach(([tagStr, count]) => {
      const tag = parseInt(tagStr, 10);
      globalExtraNeed[tag] = (globalExtraNeed[tag] || 0) + count;
    });
  });

  let bestAssignment: (Team | null)[] = new Array(taskCount).fill(null);
  let bestTasksCompleted = -1;
  let bestExtrasFullTasks = -1;
  let bestTotalExtraSlots = -1;

  function dfs(
    idx: number,
    currentAssignment: (Team | null)[],
    tasksCompleted: number,
    extrasFullTasks: number,
    totalExtraSlots: number,
    currentExtraCovered: Record<number, number>
  ): void {
    if (idx === taskCount) {
      if (
        tasksCompleted > bestTasksCompleted ||
        (tasksCompleted === bestTasksCompleted &&
          (extrasFullTasks > bestExtrasFullTasks ||
            (extrasFullTasks === bestExtrasFullTasks && totalExtraSlots > bestTotalExtraSlots)))
      ) {
        bestAssignment = currentAssignment.slice();
        bestTasksCompleted = tasksCompleted;
        bestExtrasFullTasks = extrasFullTasks;
        bestTotalExtraSlots = totalExtraSlots;
      }
      return;
    }

    const teams = taskTeams[idx] || [];

    currentAssignment[idx] = null;
    dfs(idx + 1, currentAssignment, tasksCompleted, extrasFullTasks, totalExtraSlots, currentExtraCovered);

    for (const team of teams) {
      let conflict = false;
      for (const id of team.charIds) {
        if (usedCharIds.has(id)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      team.charIds.forEach((id) => usedCharIds.add(id));
      currentAssignment[idx] = team;

      const nextExtraCovered = { ...currentExtraCovered };
      let addedExtra = 0;
      Object.entries(team.extraCoverageByTag || {}).forEach(([tagStr, cover]) => {
        const tag = parseInt(tagStr, 10);
        const need = globalExtraNeed[tag] || 0;
        const already = nextExtraCovered[tag] || 0;
        const canAdd = Math.min(cover, Math.max(0, need - already));
        if (canAdd > 0) {
          nextExtraCovered[tag] = already + canAdd;
          addedExtra += canAdd;
        }
      });

      dfs(
        idx + 1,
        currentAssignment,
        tasksCompleted + 1,
        extrasFullTasks + (team.extrasFull ? 1 : 0),
        totalExtraSlots + addedExtra,
        nextExtraCovered
      );

      team.charIds.forEach((id) => usedCharIds.delete(id));
    }
  }

  dfs(0, new Array(taskCount).fill(null), 0, 0, 0, {});

  return {
    assignment: bestAssignment,
    tasksCompleted: Math.max(0, bestTasksCompleted),
    extrasFullTasks: Math.max(0, bestExtrasFullTasks),
    totalExtraSlots: Math.max(0, bestTotalExtraSlots),
  };
}

function greedilyCompleteRemainingTasks(
  taskInfos: TaskInfo[],
  availableChars: CharacterData[],
  tagRarity: Record<number, { count: number; rarity: number }>,
  globalExtraNeed: Record<number, number>
): Array<{ taskInfo: TaskInfo; team: Team }> {
  if (taskInfos.length === 0 || availableChars.length === 0) return [];

  const taskTeams = taskInfos.map((info) =>
    generateTaskTeams(info, availableChars, tagRarity, globalExtraNeed)
  );
  if (taskTeams.every((teams) => teams.length === 0)) return [];

  const result = chooseBestTeams(taskInfos, taskTeams);
  const assignments: Array<{ taskInfo: TaskInfo; team: Team }> = [];

  result.assignment.forEach((team, idx) => {
    if (!team) return;
    const taskInfo = taskInfos[idx];
    if (taskInfo) assignments.push({ taskInfo, team });
  });

  return assignments;
}

function assignBestPartialTeam(
  taskInfo: TaskInfo,
  availableChars: CharacterData[],
  tagRarity: Record<number, { count: number; rarity: number }>,
  globalExtraDemand: Record<number, number>
): Team | null {
  const { requiredTags, extraTags, tagCounts } = taskInfo;
  const maxSize = tasksState.maxCharactersPerTask;
  const remainingRequired: Record<number, number> = { ...tagCounts.required };
  const remainingExtra: Record<number, number> = { ...tagCounts.extra };
  const selectedChars: CharacterData[] = [];

  function pickBestCandidate(): CharacterData | null {
    let bestChar: CharacterData | null = null;
    let bestScore = -1;
    let bestRequiredHits = -1;

    availableChars.forEach((char) => {
      if (selectedChars.some((sc) => sc.Id === char.Id)) return;

      const charTags = getCharacterTags(parseInt(char.Id));
      const seenTags = new Set<number>();
      let requiredHits = 0;
      let extraHits = 0;
      let rarityBonus = 0;

      charTags.forEach((tag) => {
        if (seenTags.has(tag)) return;
        seenTags.add(tag);

        if (remainingRequired[tag] > 0) {
          requiredHits++;
          rarityBonus += tagRarity[tag]?.rarity || 0;
        } else if (remainingExtra[tag] > 0) {
          extraHits++;
          rarityBonus += (tagRarity[tag]?.rarity || 0) * 0.5;
        }
      });

      if (requiredHits === 0) return;

      const futureValue = charTags.reduce((sum, tag) => {
        if (remainingRequired[tag] > 0) return sum + 2;
        if (remainingExtra[tag] > 0) return sum + 1;
        return sum;
      }, 0);

      const externalExtraPenalty = charTags.reduce((sum, tag) => {
        if (remainingExtra[tag] > 0) return sum;
        if (globalExtraDemand[tag] > 0) return sum + 1;
        return sum;
      }, 0);

      const score = requiredHits * 3 + extraHits + rarityBonus - futureValue * 0.01 - externalExtraPenalty * 0.5;
      if (
        score > bestScore ||
        (score === bestScore && requiredHits > bestRequiredHits)
      ) {
        bestScore = score;
        bestRequiredHits = requiredHits;
        bestChar = char;
      }
    });

    return bestChar;
  }

  while (selectedChars.length < maxSize) {
    const candidate = pickBestCandidate();
    if (!candidate) break;

    selectedChars.push(candidate);

    const seenTags = new Set<number>();
    const charTags = getCharacterTags(parseInt(candidate.Id));
    charTags.forEach((tag) => {
      if (seenTags.has(tag)) return;
      seenTags.add(tag);

      if (remainingRequired[tag] > 0) {
        remainingRequired[tag]--;
      } else if (remainingExtra[tag] > 0) {
        remainingExtra[tag]--;
      }
    });

    const requiredComplete = requiredTags.every((tag) => (remainingRequired[tag] || 0) <= 0);
    if (requiredComplete) break;
  }

  if (selectedChars.length === 0) return null;

  const requiredComplete = requiredTags.every((tag) => (remainingRequired[tag] || 0) <= 0);
  const extraSlotsCovered = extraTags.reduce((sum, tag) => {
    const needed = tagCounts.extra[tag] || 0;
    const remaining = remainingExtra[tag] || 0;
    return sum + Math.max(0, needed - remaining);
  }, 0);
  const extrasComplete = extraTags.every((tag) => (remainingExtra[tag] || 0) <= 0);
  const extraCoverageByTag: Record<number, number> = {};
  extraTags.forEach((tag) => {
    const covered = (tagCounts.extra[tag] || 0) - (remainingExtra[tag] || 0);
    if (covered > 0) {
      extraCoverageByTag[tag] = covered;
    }
  });

  return {
    chars: selectedChars,
    charIds: selectedChars.map((c) => parseInt(c.Id)),
    extrasFull: requiredComplete && extrasComplete,
    extraSlotsCovered,
    extraCoverageByTag,
    size: selectedChars.length,
    rarityBonus: 0,
  };
}

function applyAutoAssignmentForTask(taskInfo: TaskInfo, team: Team): void {
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
  const tagsFilledByChar: Record<number, number[]> = {};

  requiredTags.forEach((tag) => {
    const needed = tagCounts.required[tag] || 0;
    let remaining = needed - (filledSlots[tag] || 0);
    if (remaining <= 0) return;

    for (const char of team.chars) {
      if (remaining <= 0) break;
      const charTags = getCharacterTags(parseInt(char.Id));
      if (!charTags.includes(tag)) continue;

      const charId = parseInt(char.Id);
      if (!tagsFilledByChar[charId]) tagsFilledByChar[charId] = [];
      tagsFilledByChar[charId].push(tag);
      filledSlots[tag] = (filledSlots[tag] || 0) + 1;
      remaining--;
    }
  });

  extraTags.forEach((tag) => {
    const extraNeeded = tagCounts.extra[tag] || 0;
    if (!extraNeeded) return;

    const requiredNeeded = tagCounts.required[tag] || 0;
    const totalNeeded = requiredNeeded + extraNeeded;
    let remaining = totalNeeded - (filledSlots[tag] || 0);
    if (remaining <= 0) return;

    let potential = 0;
    team.chars.forEach((char) => {
      const charTags = getCharacterTags(parseInt(char.Id));
      if (charTags.includes(tag)) potential++;
    });
    if (potential < remaining) return;

    for (const char of team.chars) {
      if (remaining <= 0) break;
      const charTags = getCharacterTags(parseInt(char.Id));
      if (!charTags.includes(tag)) continue;

      const charId = parseInt(char.Id);
      if (!tagsFilledByChar[charId]) tagsFilledByChar[charId] = [];
      tagsFilledByChar[charId].push(tag);
      filledSlots[tag] = (filledSlots[tag] || 0) + 1;
      remaining--;
    }
  });

  const slots = tasksState.assignedCharacters?.[taskId];
  if (!slots) return;

  team.chars.forEach((char) => {
    const charId = parseInt(char.Id);
    const tags = tagsFilledByChar[charId] || [];

    if (tags.length > 0) {
      if (!tasksState.characterFilledTag[taskId]) {
        tasksState.characterFilledTag[taskId] = {};
      }
      tasksState.characterFilledTag[taskId][charId] = tags;
    }

    let idx = slots.findIndex((c) => !c);
    if (idx === -1) idx = slots.length;
    if (idx < tasksState.maxCharactersPerTask) {
      slots[idx] = charId;
    }
  });
}

function calculateCompletionStats(
  taskInfos: TaskInfo[]
): { tasksCompleted: number; extrasFullTasks: number; partiallyFilledTasks: number } {
  let tasksCompleted = 0;
  let extrasFullTasks = 0;
  let partiallyFilledTasks = 0;

  taskInfos.forEach((info) => {
    const filledSlots = tasksState.filledTagSlots[info.id] || {};
    const assignedSlots = tasksState.assignedCharacters[info.id] || [];
    const hasAssignments =
      assignedSlots.some((slot) => slot !== null && slot !== undefined) ||
      Object.keys(filledSlots).length > 0;

    const baseComplete = info.requiredTags.every((tag) => {
      const needed = info.tagCounts.required[tag] || 0;
      return (filledSlots[tag] || 0) >= needed;
    });

    if (baseComplete) {
      tasksCompleted++;
      const extrasComplete = info.extraTags.every((tag) => {
        const totalNeeded = (info.tagCounts.required[tag] || 0) + (info.tagCounts.extra[tag] || 0);
        return (filledSlots[tag] || 0) >= totalNeeded;
      });
      if (extrasComplete) extrasFullTasks++;
    } else if (hasAssignments) {
      partiallyFilledTasks++;
    }
  });

  return { tasksCompleted, extrasFullTasks, partiallyFilledTasks };
}

function autoFillCharacters(): void {
  if (tasksState.selectedTasks.length === 0) {
    showWarning('먼저 의뢰를 선택해주세요.');
    return;
  }

  if (tasksState.ownedCharacters.size === 0) {
    showWarning('먼저 보유한 캐릭터를 설정해주세요.');
    return;
  }

  tasksState.assignedCharacters = {};
  tasksState.filledTagSlots = {};
  tasksState.characterFilledTag = {};

  tasksState.selectedTasks.forEach((task) => {
    tasksState.assignedCharacters[task.Id] = [];
    tasksState.filledTagSlots[task.Id] = {};
    tasksState.characterFilledTag[task.Id] = {};
  });

  const allOwnedChars = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???' && tasksState.ownedCharacters.has(parseInt(char.Id));
  });

  if (allOwnedChars.length === 0) {
    showWarning('사용 가능한 보유 캐릭터가 없습니다.');
    return;
  }

  const taskInfos = tasksState.selectedTasks.map(buildTaskInfo).filter((info): info is TaskInfo => info !== undefined);
  const globalExtraNeed = calculateGlobalExtraNeedFromInfos(taskInfos);
  const tagRarity = calculateTagRarity(tasksState.selectedTasks, allOwnedChars);
  const taskTeams = taskInfos.map((info) =>
    generateTaskTeams(info, allOwnedChars, tagRarity, globalExtraNeed)
  );
  const result = chooseBestTeams(taskInfos, taskTeams);
  const usedCharIds = new Set<number>();
  const greedyCompletedTaskIds = new Set<number>();

  result.assignment.forEach((team, idx) => {
    if (!team) return;
    const taskInfo = taskInfos[idx];
    if (!taskInfo) return;
    applyAutoAssignmentForTask(taskInfo, team);
    team.charIds.forEach((id) => usedCharIds.add(id));
  });

  const remainingTaskInfos = taskInfos.filter((_, idx) => !result.assignment[idx]);
  const remainingChars = allOwnedChars.filter((char) => !usedCharIds.has(parseInt(char.Id)));
  const remainingGlobalExtraNeed = calculateGlobalExtraNeedFromInfos(remainingTaskInfos);
  const greedyAssignments = greedilyCompleteRemainingTasks(
    remainingTaskInfos,
    remainingChars,
    tagRarity,
    remainingGlobalExtraNeed
  );

  greedyAssignments.forEach(({ taskInfo, team }) => {
    applyAutoAssignmentForTask(taskInfo, team);
    team.charIds.forEach((id) => usedCharIds.add(id));
    greedyCompletedTaskIds.add(taskInfo.id);
  });

  const stillAvailableChars = allOwnedChars.filter((char) => !usedCharIds.has(parseInt(char.Id)));
  const remainingBaseTasks = tasksState.selectedTasks.filter((task) => !isTaskBaseComplete(task));
  const remainingBaseInfos = remainingBaseTasks
    .map((task) => buildRemainingTaskInfo(task))
    .filter((info): info is TaskInfo => info !== null);

  if (remainingBaseInfos.length > 0 && stillAvailableChars.length > 0) {
    const baseGlobalExtraNeed = calculateGlobalExtraNeedFromInfos(remainingBaseInfos);
    const remainingTeams = remainingBaseInfos.map((info) =>
      generateTaskTeams(info, stillAvailableChars, tagRarity, baseGlobalExtraNeed)
    );
    const remainingResult = chooseBestTeams(remainingBaseInfos, remainingTeams);

    remainingResult.assignment.forEach((team, idx) => {
      if (!team) return;
      const taskInfo = remainingBaseInfos[idx];
      applyAutoAssignmentForTask(taskInfo, team);
      team.charIds.forEach((id) => usedCharIds.add(id));
      greedyCompletedTaskIds.add(taskInfo.id);
    });
  }

  taskInfos.forEach((taskInfo, idx) => {
    if (result.assignment[idx]) return;
    if (greedyCompletedTaskIds.has(taskInfo.id)) return;

    const availableChars = allOwnedChars.filter((char) => !usedCharIds.has(parseInt(char.Id)));
    if (!taskInfo || availableChars.length === 0) return;

    const globalExtraDemand = buildGlobalExtraDemand();
    const partialTeam = assignBestPartialTeam(taskInfo, availableChars, tagRarity, globalExtraDemand);
    if (partialTeam && partialTeam.chars.length > 0) {
      applyAutoAssignmentForTask(taskInfo, partialTeam);
      partialTeam.charIds.forEach((id) => usedCharIds.add(id));
    }
  });

  renderSelectedTasks();
  renderCharacters();
  updateHeaderStats();
  updateClearAllButton();
  updateRecommendations();

  const completionStats = calculateCompletionStats(taskInfos);
  const totalTasks = tasksState.selectedTasks.length;
  const assignedCount = usedCharIds.size;
  const tasksCompleted = completionStats.tasksCompleted;
  const extraTasksCompleted = completionStats.extrasFullTasks;

  let message = '자동 배정 완료!\n';
  message += `- 필수 태그 완전 충족 의뢰: ${tasksCompleted}/${totalTasks}\n`;
  message += `- 추가 태그 완전 충족 의뢰: ${extraTasksCompleted}/${totalTasks}\n`;

  if (completionStats.partiallyFilledTasks > 0) {
    message += `- 부분 배정 의뢰: ${completionStats.partiallyFilledTasks}개 (필수 태그 미충족)\n`;
  }

  message += `- 배정된 캐릭터: ${assignedCount}명`;
  showSuccess(message);
}

// =============================================================================
// INSIGHTS
// =============================================================================

function calculateInsights(): {
  acquisitionPriority: Array<{
    charId: number;
    char: CharacterData;
    valueScore: number;
    tasks: Array<{
      taskId: number;
      task: Task;
      canFillTagsCount: number;
      requiredTagsCount: number;
      extraTagsCount: number;
    }>;
  }>;
} | null {
  if (tasksState.selectedTasks.length === 0) return null;

  const acquisitionPriority: Array<{
    charId: number;
    char: CharacterData;
    valueScore: number;
    tasks: Array<{
      taskId: number;
      task: Task;
      canFillTagsCount: number;
      requiredTagsCount: number;
      extraTagsCount: number;
    }>;
  }> = [];

  const unownedCharacters = tasksState.characters.filter((char) => {
    const name = getTranslatedCharacterName(char);
    return name !== '???' && !tasksState.ownedCharacters.has(parseInt(char.Id));
  });

  unownedCharacters.forEach((char) => {
    const charTags = getCharacterTags(parseInt(char.Id));
    let valueScore = 0;
    const valueTasks: Array<{
      taskId: number;
      task: Task;
      canFillTagsCount: number;
      requiredTagsCount: number;
      extraTagsCount: number;
    }> = [];

    tasksState.selectedTasks.forEach((task) => {
      const tagCounts = getTagCounts(task);
      const filledSlots = tasksState.filledTagSlots[task.Id] || {};
      const requiredTags = task.Tags || [];
      const extraTags = task.ExtraTags || [];

      const canFillRequiredTags: number[] = [];
      const canFillExtraTags: number[] = [];

      charTags.forEach((charTag) => {
        const inRequired = requiredTags.filter((t) => t === charTag).length;
        if (inRequired > 0) {
          const currentFilled = filledSlots[charTag] || 0;
          const totalRequired = tagCounts.required[charTag] || 0;
          if (currentFilled < totalRequired) {
            canFillRequiredTags.push(charTag);
          }
        }

        const inExtra = extraTags.filter((t) => t === charTag).length;
        if (inExtra > 0) {
          const currentFilled = filledSlots[charTag] || 0;
          const totalNeeded =
            (tagCounts.required[charTag] || 0) + (tagCounts.extra[charTag] || 0);
          if (currentFilled < totalNeeded) {
            canFillExtraTags.push(charTag);
          }
        }
      });

      const canFillCount = canFillRequiredTags.length + canFillExtraTags.length;

      if (canFillCount > 0) {
        const taskScore = canFillExtraTags.length * 3 + canFillRequiredTags.length * 1;
        valueScore += taskScore;
        valueTasks.push({
          taskId: task.Id,
          task: task,
          canFillTagsCount: canFillCount,
          requiredTagsCount: canFillRequiredTags.length,
          extraTagsCount: canFillExtraTags.length,
        });
      }
    });

    if (valueScore > 0) {
      acquisitionPriority.push({
        charId: parseInt(char.Id),
        char: char,
        valueScore: valueScore,
        tasks: valueTasks,
      });
    }
  });

  acquisitionPriority.sort((a, b) => b.valueScore - a.valueScore);

  return {
    acquisitionPriority: acquisitionPriority.slice(0, 10),
  };
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadTasksData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

    console.log(`[Tasks] Loading data for language: ${gameLang}`);

    const [agentData, agentKR, characterData, characterDesData, characterTagKR] = await Promise.all(
      [
        fetch('data/Agent.json').then((r) => r.json()),
        fetch(`${dataPath}/Agent.json`).then((r) => r.json()),
        fetch('data/Character.json').then((r) => r.json()),
        fetch('data/CharacterDes.json').then((r) => r.json()),
        fetch(`${dataPath}/CharacterTag.json`).then((r) => r.json()),
      ]
    );

    tasksState.allTasks = (Object.values(agentData) as Task[]).filter((task) => task.Level === 70);
    tasksState.taskStrings = agentKR;
    tasksState.tagStrings = characterTagKR;
    tasksState.characters = (Object.values(characterData) as CharacterData[]).filter(
      (char) => char.Visible && char.Available
    );
    tasksState.characterNames = await fetch(`${dataPath}/Character.json`).then((r) => r.json());
    tasksState.characterTags = characterDesData;

    loadOwnership();
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

// =============================================================================
// EVENT HANDLING
// =============================================================================

function setupTaskSearch(): void {
  const searchInput = document.getElementById('task-search') as HTMLInputElement | null;
  if (!searchInput) return;

  const debouncedSearch = debounce((...args: unknown[]) => {
    const searchTerm = args[0] as string;
    const taskCards = document.querySelectorAll('.task-pool-list .task-card');

    taskCards.forEach((card) => {
      const cardEl = card as HTMLElement;
      const title = card.querySelector('.task-title')?.textContent?.toLowerCase() || '';
      const subtitle = card.querySelector('.task-subtitle')?.textContent?.toLowerCase() || '';
      const matches = title.includes(searchTerm) || subtitle.includes(searchTerm);
      cardEl.style.display = matches ? '' : 'none';
    });
  }, 300);

  searchInput.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const searchTerm = target.value.toLowerCase().trim();
    debouncedSearch(searchTerm);
  });
}

function setupEventDelegation(): void {
  const tasksContainer = document.getElementById('tasks-list');
  if (tasksContainer) {
    tasksContainer.addEventListener('click', (e) => {
      const taskCard = (e.target as HTMLElement).closest('.task-card');
      if (taskCard && !taskCard.classList.contains('disabled')) {
        const taskId = parseInt((taskCard as HTMLElement).dataset.taskId || '');
        if (!isNaN(taskId)) {
          toggleTaskSelection(taskId);
        }
      }
    });
  }

  const selectedContainer = document.getElementById('selected-tasks');
  if (selectedContainer) {
    selectedContainer.addEventListener('click', (e) => {
      const removeBtn = (e.target as HTMLElement).closest('.remove-task-btn');
      if (removeBtn) {
        e.stopPropagation();
        const taskId = parseInt((removeBtn as HTMLElement).dataset.removeTaskId || '');
        if (!isNaN(taskId)) {
          toggleTaskSelection(taskId);
        }
        return;
      }

      const removeCharBtn = (e.target as HTMLElement).closest('.remove-character-btn');
      if (removeCharBtn) {
        e.stopPropagation();
        const taskId = parseInt((removeCharBtn as HTMLElement).dataset.removeCharTask || '');
        const slotIndex = parseInt((removeCharBtn as HTMLElement).dataset.removeCharSlot || '');
        if (!isNaN(taskId) && !isNaN(slotIndex)) {
          removeCharacterFromTask(taskId, slotIndex);
        }
        return;
      }

      const emptySlot = (e.target as HTMLElement).closest('.character-slot:not(.filled)');
      if (emptySlot) {
        const taskId = parseInt((emptySlot as HTMLElement).dataset.addCharTask || '');
        if (!isNaN(taskId)) {
          tasksState.activeTaskId = taskId;
          renderSelectedTasks();
          renderCharacters();
        }
        return;
      }

      const taskCard = (e.target as HTMLElement).closest('.selected-task-card');
      if (taskCard) {
        const taskId = parseInt((taskCard as HTMLElement).dataset.selectedTaskId || '');
        if (!isNaN(taskId)) {
          selectTask(taskId);
        }
      }
    });
  }

  const charactersContainer = document.getElementById('characters-list');
  if (charactersContainer) {
    charactersContainer.addEventListener('click', (e) => {
      const charCard = (e.target as HTMLElement).closest('.character-card-small');
      if (
        charCard &&
        !charCard.classList.contains('disabled') &&
        !charCard.classList.contains('not-clickable')
      ) {
        const charId = parseInt((charCard as HTMLElement).dataset.characterId || '');
        if (!isNaN(charId)) {
          onCharacterClick(charId);
        }
      }
    });
  }

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

  const ownershipGrid = document.getElementById('ownership-grid');
  if (ownershipGrid) {
    ownershipGrid.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.ownership-card');
      if (card) {
        const charId = parseInt((card as HTMLElement).dataset.ownershipCharId || '');
        if (!isNaN(charId)) {
          toggleOwnership(charId);
          renderOwnershipGrid();
          updateOwnershipCount();
        }
      }
    });
  }

  const ownershipModal = document.getElementById('ownership-modal');
  if (ownershipModal) {
    ownershipModal.addEventListener('click', (e) => {
      if (e.target === ownershipModal) {
        closeOwnershipModal();
      }
    });
  }

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter as 'all' | 'owned' | 'not-owned';
      if (filter) {
        setCharacterFilter(filter);
      }
    });
  });

  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllAssignments);
  }

  const autoFillBtn = document.getElementById('auto-fill-btn');
  if (autoFillBtn) {
    autoFillBtn.addEventListener('click', autoFillCharacters);
  }

  const confirmModal = document.getElementById('confirm-modal');
  const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
  const confirmModalCancel = document.getElementById('confirm-modal-cancel');

  if (confirmModalConfirm) {
    confirmModalConfirm.addEventListener('click', () => {
      if (confirmModal) confirmModal.style.display = 'none';
      if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
      }
    });
  }

  if (confirmModalCancel) {
    confirmModalCancel.addEventListener('click', () => {
      if (confirmModal) confirmModal.style.display = 'none';
      confirmCallback = null;
    });
  }

  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        confirmModal.style.display = 'none';
        confirmCallback = null;
      }
    });
  }
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ownershipModal = document.getElementById('ownership-modal');
      if (ownershipModal && ownershipModal.style.display === 'flex') {
        ownershipModal.style.display = 'none';
        return;
      }

      const confirmModal = document.getElementById('confirm-modal');
      if (confirmModal && confirmModal.style.display === 'flex') {
        confirmModal.style.display = 'none';
        confirmCallback = null;
        return;
      }
    }

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

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initTasksPage(): Promise<void> {
  if (typeof window.initTheme === 'function') {
    window.initTheme();
  }

  await window.i18n?.init();

  window.addEventListener('languageChanged', async () => {
    console.log('[Tasks] Language changed, reloading data');
    clearLookupCaches();
    await loadTasksData();
    updateTaskCounter();
    renderTasks();
    renderSelectedTasks();
    renderCharacters();
  });

  await loadTasksData();
  updateTaskCounter();
  setupEventDelegation();
  setupTaskSearch();
  setupKeyboardShortcuts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTasksPage);
} else {
  initTasksPage();
}

export { loadTasksData };

