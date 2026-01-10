/**
 * @module app-summary
 * @description Build Summary Module - Displays complete party overview with build stats and Star Tower integration
 *
 * **Features:**
 * - Character Summary: Portrait, name, skills with level badges, potential display with marks
 * - Disc Summary: Main/sub discs with skills, limit breaks, phase levels, note contributions
 * - Build Stats: Total score, build level (1-10), potential count
 * - Star Tower Q&A: Searchable answer sheet modal for Star Tower questions
 * - Build Notes: Local-only memo field for build documentation
 *
 * **Architecture:**
 * - Event delegation for all modal interactions (Star Tower modal, potential marking)
 * - Drag-and-drop potential reordering with visual placeholders
 * - Build level calculation from StarTowerBuildRank.json based on total score
 *
 * @see {@link https://github.com/JforPlay/sstoy} - Project Repository
 */

import { fetchJSON, log, onLanguageChange, createResponsiveImage } from '../shared';
import { GameData } from '../shared/game-data';
import { generatePotentialIconHTML } from '../shared/ui-components';
import type { DiscSlotId, Position, PotentialMark, CharacterData } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface BuildRankEntry {
  Level: number;
  MinGrade: number;
  [key: string]: unknown;
}

interface BuildLevelInfo {
  level: number;
  minGrade: number;
}

interface NoteInfo {
  id: string;
  name: string;
  icon: string;
  total: number;
}

// Global functions declarations
// Note: getIcon is available on window object

// =============================================================================
// STATE
// =============================================================================

let buildRankData: Record<string, BuildRankEntry> | null = null;

// Cleanup function for document-level event listeners
let starTowerListenerCleanup: (() => void) | null = null;

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadBuildRankData(): Promise<Record<string, BuildRankEntry> | null> {
  if (buildRankData) return buildRankData;

  try {
    buildRankData = await fetchJSON<Record<string, BuildRankEntry>>('data/StarTowerBuildRank.json');
    return buildRankData;
  } catch (error) {
    console.error('Failed to load build rank data:', error);
    return null;
  }
}

// =============================================================================
// BUILD LEVEL CALCULATION
// =============================================================================

function calculateBuildLevel(totalScore: number): BuildLevelInfo {
  if (!buildRankData) return { level: 1, minGrade: 0 };

  let highestLevel = 1;
  let highestMinGrade = 0;

  Object.values(buildRankData).forEach((rank) => {
    const minGrade = rank.MinGrade || 0;
    if (totalScore >= minGrade && rank.Level > highestLevel) {
      highestLevel = rank.Level;
      highestMinGrade = minGrade;
    }
  });

  return { level: highestLevel, minGrade: highestMinGrade };
}

// =============================================================================
// SUMMARY CARD GENERATION
// =============================================================================

function generateSummaryCard(position: Position, title: string, badgeClass: string): string {
  const character = window.state?.party?.[position];

  if (!character) {
    return `
      <div class="summary-card ${position === 'master' ? 'master-summary' : 'assist-summary'}">
        <div class="summary-card-body">
          <div class="summary-character-preview">
            <div class="summary-empty-state">
              <p>${window.i18n?.t('builder.selectCharacter') || 'Please select a character'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const charId = character.id;
  const charName = character.name;
  const charData = character.data;

  return `
    <div class="summary-card ${position === 'master' ? 'master-summary' : 'assist-summary'}">
      <div class="summary-card-body">
        <div class="summary-character-preview">
          <div class="summary-character-info">
            <div class="summary-char-basic">
              ${createResponsiveImage(`assets/char/avg1_${charId}_002.png`, charName, 'summary-char-image')}
              <div class="summary-char-name-section">
                <div class="summary-card-badge ${badgeClass}">${title}</div>
                <div class="summary-char-name">${charName}</div>
                ${generateSkillsSummaryCompact(charData, position)}
              </div>
            </div>
            ${generatePotentialsSummary(position)}
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// SKILLS SUMMARY
// =============================================================================

function generateSkillsSummaryCompact(charData: CharacterData, position: Position): string {
  const isMaster = position === 'master';

  interface SkillMap {
    key: keyof CharacterData;
    label: string;
  }

  const skillMapping: SkillMap[] = isMaster
    ? [
        { key: 'NormalAtkId', label: window.i18n?.t('summary.normalAtk') || 'Normal' },
        { key: 'SkillId', label: window.i18n?.t('summary.skill') || 'Skill' },
        { key: 'UltimateId', label: window.i18n?.t('summary.ultimate') || 'Ultimate' },
      ]
    : [{ key: 'AssistSkillId', label: window.i18n?.t('summary.assist') || 'Assist' }];

  let html = '<div class="summary-skills-inline">';

  skillMapping.forEach(({ key, label }) => {
    const skillId = charData[key] as number | undefined;
    if (skillId && GameData.skills?.[skillId]) {
      const level = window.state?.skillLevels?.[position]?.[skillId] || 1;
      html += `<div class="skill-badge-inline">${label} Lv.${level}</div>`;
    }
  });

  html += '</div>';
  return html;
}

// =============================================================================
// POTENTIALS SUMMARY
// =============================================================================

function generatePotentialsSummary(position: Position): string {
  const selectedPotentials = window.state?.selectedPotentials?.[position] || [];

  if (selectedPotentials.length === 0) {
    return `<div class="summary-potentials">
      <div class="summary-section-label">${window.i18n?.t('builder.potentials') || 'Potentials'}: 0</div>
      <p style="color: var(--text-secondary); font-size: 0.85rem; padding: 8px;">${window.i18n?.t('builder.noPotentialsSelected') || 'No potentials selected'}</p>
    </div>`;
  }

  const specificPots: number[] = [];
  const normalCommonPots: number[] = [];

  selectedPotentials.forEach((potId) => {
    const itemData = GameData.items?.[potId];
    if (itemData && itemData.Stype === 42) {
      specificPots.push(potId);
    } else {
      normalCommonPots.push(potId);
    }
  });

  let totalPotentialLevels = 0;
  selectedPotentials.forEach((potId) => {
    const itemData = GameData.items?.[potId];
    const isSpecificPotential = itemData && itemData.Stype === 42;

    if (isSpecificPotential) {
      totalPotentialLevels += 1;
    } else {
      const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
      totalPotentialLevels += level;
    }
  });

  if (!window.state.potentialMarks) {
    window.state.potentialMarks = {} as Record<Position, Record<number, PotentialMark>>;
  }
  if (!window.state.potentialMarks[position]) {
    window.state.potentialMarks[position] = {};
  }

  let html = `<div class="summary-potentials">
    <div class="summary-section-label-row">
      <span>${window.i18n?.t('builder.potentials') || 'Potentials'}: ${totalPotentialLevels}</span>
      <span class="potential-hint">${window.i18n?.t('builder.potentialHint') || 'Click: Change priority | Drag: Reorder'}</span>
    </div>`;

  if (specificPots.length > 0) {
    html += `<div class="summary-potential-icons-grid specific-pots-grid" data-position="${position}" data-section="specific">`;

    specificPots.forEach((potId) => {
      const level = 1;
      const mark = window.state.potentialMarks[position][potId] || '';

      html += `<div class="potential-icon-wrapper" data-section="specific">
        <div data-action="summary-cycle-potential-mark"
             data-position="${position}"
             data-potential-id="${potId}">`;

      html += generatePotentialIconHTML(potId, position, level, mark as PotentialMark);

      html += `</div></div>`;
    });

    html += '</div>';
  }

  if (normalCommonPots.length > 0) {
    html += `<div class="summary-potential-icons-grid" data-position="${position}" data-section="normal">`;

    normalCommonPots.forEach((potId) => {
      const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
      const mark = window.state.potentialMarks[position][potId] || '';

      html += `<div class="potential-icon-wrapper" data-section="normal">
        <div data-action="summary-cycle-potential-mark"
             data-position="${position}"
             data-potential-id="${potId}">`;

      html += generatePotentialIconHTML(potId, position, level, mark as PotentialMark);

      html += `</div></div>`;
    });

    html += '</div>';
  }

  html += '</div>';
  return html;
}

// =============================================================================
// DISCS SECTION
// =============================================================================

function generateAllDiscsSection(): string {
  if (!window.discsState) {
    return `<p style="color: var(--text-secondary); padding: 1rem;">${window.i18n?.t('messages.loading') || 'Loading...'}</p>`;
  }

  const mainSlots: DiscSlotId[] = ['main1', 'main2', 'main3'];
  const subSlots: DiscSlotId[] = ['sub1', 'sub2', 'sub3'];

  const hasMainDiscs = mainSlots.some((slotId) => window.discsState.selectedDiscs?.[slotId]);
  const hasSubDiscs = subSlots.some((slotId) => window.discsState.selectedDiscs?.[slotId]);

  let html = '';

  // Column 1: Main Discs
  html += '<div class="summary-disc-column">';
  html += `<h3 class="summary-section-title">${window.i18n?.t('summary.mainDiscs') || '🎵 Main Discs'}</h3>`;

  if (hasMainDiscs) {
    mainSlots.forEach((slotId) => {
      const disc = window.discsState.selectedDiscs?.[slotId];
      if (!disc) {
        html += `<div class="summary-disc-card empty">${window.i18n?.t('summary.emptySlot') || 'Empty Slot'}</div>`;
        return;
      }

      const discName = window.discsState.discNames?.[disc.Id] || (window.i18n?.t('summary.disc') || 'Disc');
      const limitBreak = window.discsState.discLimitBreaks?.[slotId] || 1;

      const item = window.discsState.itemData?.[disc.Id];
      let iconPath = '';
      if (item && item.Icon) {
        const parts = item.Icon.split('/');
        const iconName = parts[parts.length - 1];
        iconPath = `assets/disc_icons/${iconName}.png`;
      }

      const mainSkillId = disc.MainSkillGroupId
        ? `${disc.MainSkillGroupId}${String(limitBreak).padStart(2, '0')}`
        : null;
      const mainSkill = mainSkillId ? window.discsState.mainSkillData?.[mainSkillId] : null;
      const mainSkillName = mainSkill
        ? window.discsState.mainSkillKRData?.[mainSkill.Name || ''] ||
          mainSkill.Name ||
          (window.i18n?.t('summary.melody') || 'Melody')
        : '';

      const secondarySkills: Array<{ name: string; level: number }> = [];
      if (disc.SecondarySkillGroupId1 || disc.SecondarySkillGroupId2) {
        const noteLevels: Record<string, number> = {};
        const notesFromDiscs = window.calculateNotesFromSubDiscs ? window.calculateNotesFromSubDiscs() : {};
        const acquiredNotes = window.discsState.acquiredNotes || {};

        Object.keys({ ...notesFromDiscs, ...acquiredNotes }).forEach((noteId) => {
          noteLevels[noteId] = (notesFromDiscs[noteId] || 0) + (acquiredNotes[noteId] || 0);
        });

        [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].forEach((groupId) => {
          if (!groupId) return;

          for (let level = 9; level >= 1; level--) {
            const skillId = String(groupId) + String(level).padStart(2, '0');
            const skill = window.discsState.secondarySkillData?.[skillId];

            if (skill) {
              if (skill.NeedSubNoteSkills) {
                try {
                  const requirements = JSON.parse(skill.NeedSubNoteSkills) as Record<string, number>;
                  const requirementsMet = Object.entries(requirements).every(
                    ([noteId, requiredLevel]) => {
                      const currentLevel = noteLevels[noteId] || 0;
                      return currentLevel >= requiredLevel;
                    }
                  );

                  if (requirementsMet) {
                    const skillName =
                      window.discsState.secondarySkillKRData?.[skill.Name || ''] ||
                      skill.Name ||
                      (window.i18n?.t('summary.harmony') || 'Harmony');
                    secondarySkills.push({ name: skillName, level: skill.Level || level });
                    break;
                  }
                } catch {
                  // Silent fail
                }
              } else if (level === 1) {
                const skillName =
                  window.discsState.secondarySkillKRData?.[skill.Name || ''] ||
                  skill.Name ||
                  (window.i18n?.t('summary.harmony') || 'Harmony');
                secondarySkills.push({ name: skillName, level: 1 });
                break;
              }
            }
          }
        });
      }

      html += `
        <div class="summary-disc-card">
          <div class="disc-card-icon-row">
            ${iconPath ? createResponsiveImage(iconPath, discName, 'disc-card-icon') : `<div class="disc-card-icon-placeholder">${window.getIcon?.('disc') || ''}</div>`}
            <div class="disc-card-info">
              <div class="disc-card-name">${discName}</div>
              <div class="disc-card-lb">${window.i18n?.t('summary.breakthrough') || 'Breakthrough'} ${limitBreak}</div>
            </div>
          </div>
          <div class="disc-skills-badges">${mainSkillName ? `<span class="disc-skill-badge main" title="${mainSkillName}">${window.i18n?.t('summary.melody') || 'Melody'} Lv.${limitBreak}</span>` : ''}
            ${secondarySkills.map((s) => `<span class="disc-skill-badge secondary" title="${s.name}">${window.i18n?.t('summary.harmony') || 'Harmony'} Lv.${s.level}</span>`).join('')}
          </div>
        </div>
      `;
    });
  } else {
    html += `<p style="color: var(--text-secondary); padding: 1rem;">${window.i18n?.t('summary.noMainDiscs') || 'No main discs selected'}</p>`;
  }

  html += '</div>';

  // Column 2: Sub Discs
  html += '<div class="summary-disc-column">';
  html += `<h3 class="summary-section-title">${window.i18n?.t('summary.subDiscs') || '🎶 Sub Discs'}</h3>`;

  if (hasSubDiscs) {
    subSlots.forEach((slotId) => {
      const disc = window.discsState.selectedDiscs?.[slotId];
      if (!disc) {
        html += `<div class="summary-disc-card empty">${window.i18n?.t('summary.emptySlot') || 'Empty Slot'}</div>`;
        return;
      }

      const discName = window.discsState.discNames?.[disc.Id] || (window.i18n?.t('summary.disc') || 'Disc');
      const subDiscLevel = (slotId.startsWith('sub') ? window.discsState.subDiscLevels?.[slotId as 'sub1' | 'sub2' | 'sub3'] : 0) || 0;
      const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
      const phaseLabel = phaseLabelMap[subDiscLevel] || '1+';

      const item = window.discsState.itemData?.[disc.Id];
      let iconPath = '';
      if (item && item.Icon) {
        const parts = item.Icon.split('/');
        const iconName = parts[parts.length - 1];
        iconPath = `assets/disc_icons/${iconName}.png`;
      }

      const lookupId = String((disc.SubNoteSkillGroupId || 0) * 100 + subDiscLevel);
      const phaseData = window.discsState.subNoteSkillPromoteData?.[lookupId];
      let notesInfo = '';

      if (phaseData && phaseData.SubNoteSkills) {
        try {
          const noteContributions = JSON.parse(phaseData.SubNoteSkills) as Record<string, number>;
          notesInfo = Object.entries(noteContributions)
            .map(([noteId, count]) => {
              const noteData = window.discsState.subNoteSkillData?.[noteId];
              if (!noteData) return '';
              const noteName =
                window.discsState.subNoteSkillKRData?.[noteData.Name || ''] || noteData.Name || '';
              return `<div class="sub-disc-note-item">${noteName} +${count}</div>`;
            })
            .filter((i) => i)
            .join('');
        } catch {
          // Silent fail
        }
      }

      html += `
        <div class="summary-disc-card sub-disc">
          <div class="disc-card-icon-row">
            ${iconPath ? createResponsiveImage(iconPath, discName, 'disc-card-icon') : `<div class="disc-card-icon-placeholder">${window.getIcon?.('disc') || ''}</div>`}
            <div class="disc-card-info">
              <div class="disc-card-name">${discName}</div>
              <div class="disc-card-lb">${window.i18n?.t('summary.level') || 'Level'} ${phaseLabel}</div>
            </div>
          </div>
          ${notesInfo ? `<div class="sub-disc-notes">${notesInfo}</div>` : ''}
        </div>
      `;
    });
  } else {
    html += `<p style="color: var(--text-secondary); padding: 1rem;">${window.i18n?.t('summary.noSubDiscs') || 'No sub discs selected'}</p>`;
  }

  html += '</div>';

  // Column 3: Notes
  html += '<div class="summary-disc-column notes-column">';
  html += `<h3 class="summary-section-title">${window.i18n?.t('summary.notes') || '🎼 Notes'}</h3>`;
  html += generateNotesSummary();
  html += '</div>';

  return html;
}

// =============================================================================
// NOTES SUMMARY
// =============================================================================

function generateNotesSummary(): string {
  if (!window.discsState || !window.discsState.subNoteSkillData) {
    return `<p style="color: var(--text-secondary); padding: 1rem;">${window.i18n?.t('summary.noteDataLoading') || 'Loading note data...'}</p>`;
  }

  const notesFromDiscs = window.calculateNotesFromSubDiscs ? window.calculateNotesFromSubDiscs() : {};
  const acquiredNotes = window.discsState.acquiredNotes || {};
  const requiredNotes = window.discsState.requiredNotes || new Set<string>();

  const allNoteIds = new Set([...Object.keys(notesFromDiscs), ...Object.keys(acquiredNotes)]);

  const usedNotes: NoteInfo[] = [];
  const unusedNotes: NoteInfo[] = [];

  allNoteIds.forEach((noteId) => {
    const fromDiscs = notesFromDiscs[noteId] || 0;
    const acquired = acquiredNotes[noteId] || 0;
    const total = fromDiscs + acquired;

    if (total === 0) return;

    const noteData = window.discsState.subNoteSkillData[noteId];
    if (!noteData) return;

    const krName = window.discsState.subNoteSkillKRData?.[noteData.Name || ''] || noteData.Name || '';

    let iconPath = '';
    if (noteData.Icon) {
      const parts = noteData.Icon.split('/');
      const iconName = parts[parts.length - 1];
      iconPath = `assets/${iconName}_S.png`;
    }

    const noteInfo: NoteInfo = {
      id: noteId,
      name: krName,
      icon: iconPath,
      total,
    };

    if (requiredNotes.has(noteId)) {
      usedNotes.push(noteInfo);
    } else {
      unusedNotes.push(noteInfo);
    }
  });

  if (usedNotes.length === 0 && unusedNotes.length === 0) {
    return `<p style="color: var(--text-secondary); padding: 1rem;">${window.i18n?.t('summary.noActiveNotes') || 'No active notes'}</p>`;
  }

  let html = '<div class="summary-notes-compact-container">';

  if (usedNotes.length > 0) {
    html += `<div class="notes-compact-subsection">
      <h4 class="notes-compact-title used">${window.i18n?.t('summary.usedNotes') || '📌 Used Notes'}</h4>
      <div class="notes-compact-grid">`;

    usedNotes.forEach((note) => {
      html += `
        <div class="note-compact-card used" title="${note.name}">
          ${note.icon ? createResponsiveImage(note.icon, note.name, 'note-compact-icon') : '<div class="note-compact-icon-placeholder">🎵</div>'}
          <div class="note-compact-level">${note.total}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  if (unusedNotes.length > 0) {
    html += `<div class="notes-compact-subsection">
      <h4 class="notes-compact-title unused">${window.i18n?.t('summary.unusedNotes') || '💤 Unused Notes'}</h4>
      <div class="notes-compact-grid">`;

    unusedNotes.forEach((note) => {
      html += `
        <div class="note-compact-card unused" title="${note.name}">
          ${note.icon ? createResponsiveImage(note.icon, note.name, 'note-compact-icon') : '<div class="note-compact-icon-placeholder">🎵</div>'}
          <div class="note-compact-level">${note.total}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// BUILD STATS
// =============================================================================

function generateBuildStats(): string {
  let totalCharacterScore = 0;
  (['master', 'assist1', 'assist2'] as Position[]).forEach((pos) => {
    if (window.calculateCharacterScore) {
      totalCharacterScore += window.calculateCharacterScore(pos);
    }
  });

  let totalDiscScore = 0;
  if (window.calculateDiscScore) {
    totalDiscScore = window.calculateDiscScore();
  }

  const totalScore = totalCharacterScore + totalDiscScore;

  const buildInfo = calculateBuildLevel(totalScore);
  const buildLevel = buildInfo.level;
  const buildIconPath = `assets/buildrank/BuildRank_${buildLevel}.png`;

  let totalPotentialLevels = 0;
  (['master', 'assist1', 'assist2'] as Position[]).forEach((pos) => {
    const selectedPotentials = window.state?.selectedPotentials?.[pos] || [];

    selectedPotentials.forEach((potId) => {
      const itemData = GameData.items?.[potId];
      const isSpecificPotential = itemData && itemData.Stype === 42;

      if (isSpecificPotential) {
        totalPotentialLevels += 1;
      } else {
        const level = window.state?.potentialLevels?.[pos]?.[potId] || 1;
        totalPotentialLevels += level;
      }
    });
  });

  return `
    <div class="build-stat-card highlight build-level-card">
      <div class="build-level-icon-container">
        ${createResponsiveImage(buildIconPath, `Build Level ${buildLevel}`, 'build-level-icon')}
      </div>
      <div class="build-stat-info">
        <span class="build-stat-label">${window.i18n?.t('builder.buildLevel') || 'Build Level'}</span>
        <span class="build-stat-value large">Lv.${buildLevel}</span>
      </div>
    </div>
    <div class="build-stat-card highlight">
      <div class="build-stat-icon">${window.getIcon?.('star') || ''}</div>
      <div class="build-stat-info">
        <span class="build-stat-label">${window.i18n?.t('builder.totalScore') || 'Total Score'}</span>
        <span class="build-stat-value large">${totalScore}</span>
      </div>
    </div>
    <div class="build-stat-card">
      <div class="build-stat-icon">${window.getIcon?.('critPower') || ''}</div>
      <div class="build-stat-info">
        <span class="build-stat-label">${window.i18n?.t('builder.totalPotentials') || 'Total Potentials'}</span>
        <span class="build-stat-value">${totalPotentialLevels}</span>
      </div>
    </div>
  `;
}

// =============================================================================
// STAR TOWER Q&A
// =============================================================================

interface StarTowerQA {
  question: string;
  answer: string;
}

const STAR_TOWER_QA_DATA: StarTowerQA[] = [
  {
    question: '음...... 별의 탑이 가장 좋아하는 숫자는 뭘까?',
    answer: '3? 항상 그렇게 선택했으니까......',
  },
  {
    question: '몇시까지 버텨야 \'밤샘\' 이라고 생각해?',
    answer: '12시?',
  },
  {
    question: '자, 시험이야. 2의 10제곱은 얼마일까?',
    answer: '1024?',
  },
  {
    question: '자, 시험이야. 정육면체는 몇 개의 면이 있을까?',
    answer: '6개?',
  },
  {
    question: '한번 맞혀봐...... 난 어떤 여행자와의 대화를 더 좋아할까?',
    answer: '큰 꿈을 가진 사람.',
  },
  {
    question: '\'큰 뜻을 품는다\'는건 뭐라고 생각해?',
    answer: '계획을 잘 세우고, 실행해야 해.',
  },
  {
    question: '욕망에 충실하다는건...... 어떤 걸 말하는 것 같아?',
    answer: '현재를 즐기자!',
  },
  {
    question: '자, 시험이야. 한 옥타브엔 몇 개의 음이 있을까?',
    answer: '12개?',
  },
  {
    question: '한번 맞혀봐. 난 어떤 여행가를 더 좋아할까?',
    answer: '욕망에 충실한 사람.',
  },
  {
    question: '뭘 먹는 게 건강에 더 좋을까?',
    answer: '야채를 많이 먹으라고?',
  },
  {
    question: '이 중에서 어떤 게 건강에 좋을까?',
    answer: '균형적인 음식?',
  },
  {
    question: '이 중에서 어떤 걸 줄이는 게 건강에 좋을까?',
    answer: '오래 앉아 있지 말라고?',
  },
];

function generateStarTowerQA(): string {
  return STAR_TOWER_QA_DATA.map(
    (qa, index) => `
    <div class="star-tower-qa-item" data-index="${index}">
      <div class="star-tower-question">
        <span class="qa-icon">Q.</span>
        <span class="qa-text">${qa.question}</span>
      </div>
      <div class="star-tower-answer">
        <span class="qa-icon">A)</span>
        <span class="qa-text">${qa.answer}</span>
      </div>
    </div>
  `
  ).join('');
}

function openStarTowerModal(): void {
  const modal = document.getElementById('star-tower-modal');
  if (modal) {
    modal.style.display = 'flex';
    const searchInput = document.getElementById('star-tower-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    filterStarTowerQA('');
  }
}

function closeStarTowerModal(): void {
  const modal = document.getElementById('star-tower-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function filterStarTowerQA(searchTerm: string): void {
  const items = document.querySelectorAll('.star-tower-qa-item');
  const normalizedSearch = searchTerm.toLowerCase().trim();

  items.forEach((item) => {
    const index = parseInt(item.getAttribute('data-index') || '0', 10);
    const qa = STAR_TOWER_QA_DATA[index];

    if (!qa) {
      (item as HTMLElement).style.display = 'none';
      return;
    }

    const questionMatch = qa.question.toLowerCase().includes(normalizedSearch);
    const answerMatch = qa.answer.toLowerCase().includes(normalizedSearch);

    if (normalizedSearch === '' || questionMatch || answerMatch) {
      (item as HTMLElement).style.display = 'block';
    } else {
      (item as HTMLElement).style.display = 'none';
    }
  });
}

// =============================================================================
// MAIN RENDER
// =============================================================================

/**
 * Render the complete build summary tab
 *
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Generates full summary HTML including:
 * 1. Build info section (name input, save/load/share buttons)
 * 2. Party overview cards (master + 2 assists) with skills and potentials
 * 3. Discs and notes section (main discs, sub discs, note summary)
 * 4. Build stats panel (build level icon, total score, potential count)
 * 5. Build notes textarea (local-only memo)
 * 6. Star Tower Q&A modal (hidden until opened)
 *
 * @example
 * ```typescript
 * await renderSummary();
 * // Summary tab now displays complete build overview
 * ```
 */
export async function renderSummary(): Promise<void> {
  const container = document.getElementById('summary-container');
  if (!container) return;

  await loadBuildRankData();

  const htmlContent = `
    <div class="summary-layout">
      <!-- Build Info Section -->
      <div class="build-info-section">
        <div class="build-info-header">
          <div class="build-title-wrapper">
            <label class="build-title-label">${window.i18n?.t('builder.buildName') || 'Build Name'}</label>
            <input
              type="text"
              id="build-title-input"
              class="build-title-input"
              placeholder="${window.i18n?.t('builder.buildNamePlaceholder') || 'Enter build name...'}"
              oninput="handleBuildTitleChange(event)"
              value="${window.buildState?.buildTitle || (window.i18n?.t('builder.newBuild') || 'New Build')}"
            />
          </div>

          <div class="save-load-actions">
            <button class="save-btn" data-action="saveload-save" id="save-btn">
              <span class="btn-icon">💾</span>
              <span class="btn-text">${window.i18n?.t('common.save') || 'Save'}</span>
            </button>
            <button class="load-btn-main" data-action="saveload-load">
              <span class="btn-icon">📂</span>
              <span class="btn-text">${window.i18n?.t('common.load') || 'Load'}</span>
            </button>
            <button class="share-btn" data-action="saveload-share" id="share-btn">
              <span class="btn-icon">🔗</span>
              <span class="btn-text">${window.i18n?.t('builder.urlShare') || 'URL Share'}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Party Overview Cards -->
      <div class="summary-section">
        <div class="summary-section-header-row">
          <h3 class="summary-section-title">${window.getIcon?.('people') || ''} ${window.i18n?.t('builder.characters') || 'Characters'}</h3>
          <button class="star-tower-btn">
            <span class="btn-icon">⭐</span>
            <span class="btn-text">별의 탑 정답지</span>
          </button>
        </div>
        <div class="summary-cards-grid">
          ${generateSummaryCard('master', `${window.getIcon?.('master') || ''} ${window.i18n?.t('builder.master') || 'Master'}`, 'master-badge')}
          ${generateSummaryCard('assist1', `${window.getIcon?.('assist') || ''} ${window.i18n?.t('builder.assist1') || 'Assist 1'}`, 'assist-badge')}
          ${generateSummaryCard('assist2', `${window.getIcon?.('assist') || ''} ${window.i18n?.t('builder.assist2') || 'Assist 2'}`, 'assist-badge')}
        </div>
      </div>

      <!-- Discs and Notes Section -->
      <div class="summary-section">
        <div class="discs-notes-container">
          ${generateAllDiscsSection()}
        </div>
      </div>

      <!-- Build Stats Summary -->
      <div class="build-stats-panel">
        <h3>${window.i18n?.t('builder.partyStats') || 'Party Stats'}</h3>
        <div class="build-stats-grid" id="build-stats-grid">
          ${generateBuildStats()}
        </div>
      </div>

      <!-- Quick Notes -->
      <div class="build-notes-panel">
        <h3>${window.i18n?.t('builder.buildNotes') || 'Build Notes'} <span class="memo-hint">${window.i18n?.t('builder.memoHint') || '(Local save only)'}</span></h3>
        <textarea
          class="build-notes-textarea"
          id="build-notes"
          placeholder="${window.i18n?.t('builder.buildMemoPlaceholder') || 'Write notes about this build...'}"
          oninput="handleBuildMemoChange(event)"
        ></textarea>
      </div>
    </div>

    <!-- Star Tower Q&A Modal -->
    <div id="star-tower-modal" class="star-tower-modal">
      <div class="star-tower-modal-content">
        <div class="star-tower-modal-header">
          <h2>⭐ 별의 탑 정답지</h2>
          <button class="star-tower-close">&times;</button>
        </div>
        <div class="star-tower-search">
          <input type="text" id="star-tower-search" placeholder="질문 검색...">
        </div>
        <div class="star-tower-qa-list" id="star-tower-qa-list">
          ${generateStarTowerQA()}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = htmlContent;
  loadBuildNotes();
}

// =============================================================================
// POTENTIAL MARKING
// =============================================================================

/**
 * Cycle through potential priority marks on click
 *
 * @param {Position} position - Character position (master/assist1/assist2)
 * @param {number} potId - Potential ID to mark
 * @returns {void}
 *
 * @description
 * Mark cycle: none → essential (필수) → recommended (다다익선) → minimum (명함만) → low (후순위) → none
 * - Handles legacy mark migration (Korean → English keys)
 * - Updates state and re-renders summary
 *
 * @example
 * ```typescript
 * cyclePotentialMark('master', 10101); // Cycles mark for potential 10101
 * ```
 */
export function cyclePotentialMark(position: Position, potId: number): void {
  if (!window.state.potentialMarks) {
    window.state.potentialMarks = {} as Record<Position, Record<number, PotentialMark>>;
  }
  if (!window.state.potentialMarks[position]) {
    window.state.potentialMarks[position] = {};
  }

  const currentMark = window.state.potentialMarks[position][potId] || '';

  const markValues: PotentialMark[] = [null, 'essential', 'recommended', 'minimum', 'low'];
  const legacyMap: Record<string, PotentialMark> = {
    '': null,
    '필수': 'essential',
    '다다익선': 'recommended',
    '권장': 'recommended',
    '명함만': 'minimum',
    'Lv.1': 'minimum',
    '후순위': 'low',
  };

  let migratedMark = legacyMap[currentMark as string] ?? (currentMark as PotentialMark);
  let currentIndex = markValues.indexOf(migratedMark);
  if (currentIndex === -1) currentIndex = 0;

  const nextIndex = (currentIndex + 1) % markValues.length;
  window.state.potentialMarks[position][potId] = markValues[nextIndex]!;

  updateSummary();
}

// =============================================================================
// BUILD NOTES
// =============================================================================

export function saveBuildNotes(): void {
  const notes = (document.getElementById('build-notes') as HTMLTextAreaElement | null)?.value || '';
  localStorage.setItem('stella-sora-build-notes', notes);
}

function loadBuildNotes(): void {
  const notes = localStorage.getItem('stella-sora-build-notes') || '';
  const textarea = document.getElementById('build-notes') as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.value = notes;
  }
}

// =============================================================================
// UPDATE SUMMARY
// =============================================================================

export function updateSummary(): void {
  renderSummary();
}

// =============================================================================
// EVENT DELEGATION
// =============================================================================

function setupSummaryEventDelegation(): void {
  const summaryContainer = document.getElementById('main-tab-summary');
  if (!summaryContainer) return;

  summaryContainer.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;

    if (!button) return;

    const action = button.dataset.action;
    if (action === 'summary-cycle-potential-mark') {
      const position = button.dataset.position as Position;
      const potentialId = parseInt(button.dataset.potentialId!, 10);
      cyclePotentialMark(position, potentialId);
    }
  });

  setupPotentialDragAndDrop(summaryContainer);
  setupStarTowerModalEvents();
}

function setupStarTowerModalEvents(): void {
  // Clean up previous listeners if any
  if (starTowerListenerCleanup) {
    starTowerListenerCleanup();
  }

  // Event delegation for modal interactions
  const clickHandler = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;

    // Open modal button
    if (target.closest('.star-tower-btn')) {
      openStarTowerModal();
      return;
    }

    // Close modal button
    if (target.closest('.star-tower-close')) {
      closeStarTowerModal();
      return;
    }

    // Close modal when clicking outside
    const modal = document.getElementById('star-tower-modal');
    if (modal && modal.style.display === 'flex' && target === modal) {
      closeStarTowerModal();
    }
  };

  // Search input for filtering QA items
  const inputHandler = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (target.id === 'star-tower-search') {
      filterStarTowerQA((target as HTMLInputElement).value);
    }
  };

  // Close modal on ESC key
  const keyHandler = (e: KeyboardEvent): void => {
    const modal = document.getElementById('star-tower-modal');
    if (modal && modal.style.display === 'flex' && e.key === 'Escape') {
      closeStarTowerModal();
    }
  };

  document.addEventListener('click', clickHandler);
  document.addEventListener('input', inputHandler);
  document.addEventListener('keydown', keyHandler);

  // Store cleanup function
  starTowerListenerCleanup = () => {
    document.removeEventListener('click', clickHandler);
    document.removeEventListener('input', inputHandler);
    document.removeEventListener('keydown', keyHandler);
  };
}

function setupPotentialDragAndDrop(container: HTMLElement): void {
  let draggedElement: HTMLElement | null = null;
  let sourcePosition: Position | null = null;
  let sourcePotentialId: number | null = null;
  let sourceSection: string | null = null;
  let placeholder: HTMLElement | null = null;
  let lastTargetWrapper: HTMLElement | null = null;
  let lastInsertBefore = false;

  container.addEventListener('dragstart', (e: DragEvent) => {
    const potIcon = (e.target as HTMLElement).closest('.potential-icon-compact') as HTMLElement | null;
    if (!potIcon) return;

    draggedElement = (e.target as HTMLElement).closest('.potential-icon-wrapper');
    if (!draggedElement) return;

    sourcePotentialId = parseInt(potIcon.dataset.potentialId!, 10);
    sourcePosition = potIcon.dataset.position as Position;
    sourceSection = draggedElement.dataset.section || null;

    draggedElement.classList.add('dragging');

    placeholder = document.createElement('div');
    placeholder.className = 'potential-drop-placeholder';
    placeholder.dataset.placeholder = 'true';

    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/html', draggedElement.innerHTML);
  });

  container.addEventListener('dragend', () => {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
    lastTargetWrapper = null;
  });

  container.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    if (!draggedElement || !placeholder) return;

    const targetWrapper = (e.target as HTMLElement).closest('.potential-icon-wrapper') as HTMLElement | null;
    if (!targetWrapper) return;

    const targetSection = targetWrapper.dataset.section;

    if (sourceSection !== targetSection) {
      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      lastTargetWrapper = null;
      return;
    }

    const targetGrid = targetWrapper.closest('.summary-potential-icons-grid');
    if (!targetGrid) return;

    if (targetWrapper === draggedElement) return;

    const rect = targetWrapper.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midpoint;

    lastTargetWrapper = targetWrapper;
    lastInsertBefore = insertBefore;

    if (insertBefore) {
      targetWrapper.parentNode!.insertBefore(placeholder, targetWrapper);
    } else {
      targetWrapper.parentNode!.insertBefore(placeholder, targetWrapper.nextSibling);
    }

    e.dataTransfer!.dropEffect = 'move';
  });

  container.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    if (!draggedElement) return;

    let targetWrapper = (e.target as HTMLElement).closest('.potential-icon-wrapper') as HTMLElement | null;
    const insertBefore = lastInsertBefore;

    if (!targetWrapper && lastTargetWrapper) {
      targetWrapper = lastTargetWrapper;
    }

    if (!targetWrapper || targetWrapper === draggedElement) {
      draggedElement = null;
      sourcePotentialId = null;
      sourcePosition = null;
      sourceSection = null;
      lastTargetWrapper = null;
      return;
    }

    const targetPotIcon = targetWrapper.querySelector('.potential-icon-compact') as HTMLElement | null;
    if (!targetPotIcon) {
      draggedElement = null;
      sourcePotentialId = null;
      sourcePosition = null;
      sourceSection = null;
      lastTargetWrapper = null;
      return;
    }

    const targetPosition = targetPotIcon.dataset.position as Position;
    const targetPotentialId = parseInt(targetPotIcon.dataset.potentialId!, 10);
    const targetSection = targetWrapper.dataset.section;

    if (sourcePosition !== targetPosition || sourceSection !== targetSection) {
      draggedElement = null;
      sourcePotentialId = null;
      sourcePosition = null;
      sourceSection = null;
      lastTargetWrapper = null;
      return;
    }

    reorderPotentialsWithDirection(sourcePosition!, sourcePotentialId!, targetPotentialId, insertBefore);

    draggedElement = null;
    sourcePotentialId = null;
    sourcePosition = null;
    sourceSection = null;
    lastTargetWrapper = null;
  });
}

function reorderPotentialsWithDirection(
  position: Position,
  sourcePotId: number,
  targetPotId: number,
  insertBefore: boolean
): void {
  if (!window.state?.selectedPotentials?.[position]) return;

  const potentials = window.state.selectedPotentials[position];
  const sourceIndex = potentials.indexOf(sourcePotId);
  const targetIndex = potentials.indexOf(targetPotId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  potentials.splice(sourceIndex, 1);

  const newTargetIndex = potentials.indexOf(targetPotId);

  if (insertBefore) {
    potentials.splice(newTargetIndex, 0, sourcePotId);
  } else {
    potentials.splice(newTargetIndex + 1, 0, sourcePotId);
  }

  updateSummary();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export function init(): void {
  setupSummaryEventDelegation();
  log('[App-Summary] Initialized');
}

if (typeof window !== 'undefined') {
  window.renderSummary = renderSummary;
  window.updateSummary = updateSummary;
  window.saveBuildNotes = saveBuildNotes;
  window.cyclePotentialMark = cyclePotentialMark;
  // Star tower modal functions now handled by event delegation
}

onLanguageChange(async () => {
  log('[App-Summary] Language changed, re-rendering summary');
  const summaryContainer = document.getElementById('summary-container');
  if (summaryContainer && summaryContainer.innerHTML) {
    await renderSummary();
  }
});

export default {
  renderSummary,
  updateSummary,
  saveBuildNotes,
  cyclePotentialMark,
};
