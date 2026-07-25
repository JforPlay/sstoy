/**
 * @module app-guide
 * @description Standalone guide database for Score Boss, Joint Drill, and attribute builds.
 */

type GuideTab = 'scoreboss' | 'jointdrill' | 'attribute';

interface ScoreBossControl {
  Id: number;
  StartTime: string;
  EndTime: string;
  LevelGroup: number[];
}

interface ScoreBossLevel {
  Id: number;
  MonsterId: number;
  ScoreBossAbility: number;
  NonDamageScoreGet: number;
}

interface ScoreBossAbility {
  Id: number;
  Name: string;
  Desc: string;
  IconSource: string;
  [key: `Value${number}`]: string | number | undefined;
  [key: `Param${number}`]: string | undefined;
}

interface ScoreBossGetControl {
  Id: number;
  Name: string;
  Desc: string;
  IconSource: string;
  [key: `Value${number}`]: string | number | undefined;
  [key: `Param${number}`]: string | undefined;
}

interface GuideBuild {
  title: string;
  description?: string;
  characters?: string[];
  elements?: string[];
  buildNote?: string;
}

interface BossOverride {
  weakElements?: ElementKey[];
  strongElements?: ElementKey[];
  patterns?: string[];
  summary?: string;
  builds?: GuideBuild[];
}

interface GuideContent {
  scoreBoss?: {
    bosses?: BossOverride[];
  };
  jointDrill?: { builds?: Record<string, GuideBuild[]> };
  attributeBuilds?: GuideBuild[];
}

interface ActiveScoreBossData {
  control: ScoreBossControl;
  levels: ScoreBossLevel[];
  abilities: Record<string, ScoreBossAbility>;
  abilityText: Record<string, string>;
  scoreGetControls: Record<string, ScoreBossGetControl>;
  scoreGetText: Record<string, string>;
}

type ElementKey = 'Water' | 'Fire' | 'Earth' | 'Wind' | 'Light' | 'Dark' | 'Normal';

const DATA_ROOT = 'data';
const GUIDE_CONTENT_FILE = 'GuideContent.json';
const BOSS_NAMES: Record<number, string> = {
  6310180: '광기의 요리사',
  6310190: '하자나',
};
const ELEMENT_ICON_IDS: Record<ElementKey, number> = {
  Water: 1,
  Fire: 2,
  Earth: 3,
  Wind: 4,
  Light: 5,
  Dark: 6,
  Normal: 7,
};
let activeTab: GuideTab = 'scoreboss';
let selectedScoreBossId: number | null = null;
let initialized = false;

// =============================================================================
// DATA LOADING
// =============================================================================

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char] || char));
}

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`${DATA_ROOT}/${file}`);
  if (!response.ok) throw new Error(`Failed to load ${file}`);
  return response.json() as Promise<T>;
}

async function loadGuideContent(): Promise<GuideContent> {
  const response = await fetch(GUIDE_CONTENT_FILE, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${GUIDE_CONTENT_FILE}`);
  return response.json() as Promise<GuideContent>;
}

function getActiveControl(data: Record<string, ScoreBossControl>): ScoreBossControl | undefined {
  const controls = Object.values(data);
  const now = Date.now();
  const activeControl = controls.find((control) => {
    const startTime = Date.parse(control.StartTime);
    const endTime = Date.parse(control.EndTime);
    return startTime <= now && now < endTime;
  });

  return activeControl
    || controls.sort((a, b) => Date.parse(b.EndTime) - Date.parse(a.EndTime))[0];
}

async function loadActiveScoreBoss(): Promise<ActiveScoreBossData | null> {
  const language = window.i18n?.currentLang || 'KR';
  const [controls, levelData, abilities, abilityText, scoreGetControls, scoreGetText] = await Promise.all([
    loadJson<Record<string, ScoreBossControl>>('ScoreBossControl.json'),
    loadJson<Record<string, ScoreBossLevel>>('ScoreBossLevel.json'),
    loadJson<Record<string, ScoreBossAbility>>('ScoreBossAbility.json'),
    loadJson<Record<string, string>>(`${language}/ScoreBossAbility.json`),
    loadJson<Record<string, ScoreBossGetControl>>('ScoreBossGetControl.json'),
    loadJson<Record<string, string>>(`${language}/ScoreBossGetControl.json`),
  ]);

  const control = getActiveControl(controls);
  if (!control) return null;

  const levels = control.LevelGroup
    .map((levelId) => levelData[String(levelId)])
    .filter((level): level is ScoreBossLevel => Boolean(level));

  return { control, levels, abilities, abilityText, scoreGetControls, scoreGetText };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPeriod(control: ScoreBossControl): string {
  return `${formatDate(control.StartTime)} ~ ${formatDate(control.EndTime)}`;
}

function formatAbilityText(template: string, ability: ScoreBossAbility): string {
  return template
    .replace(/&Param(\d+)&/g, (_, index: string) => {
      const paramIndex = Number(index);
      const value = String(ability[`Value${paramIndex}`] ?? '');
      return ability[`Param${paramIndex}`]?.includes(',Pct') ? `${value}%` : value;
    })
    .replace(/<[^>]+>/g, '');
}

// =============================================================================
// BUILD CARDS
// =============================================================================

function renderBuildCard(build: GuideBuild): string {
  const characterTags = (build.characters || [])
    .map((name) => `<span class="guide-tag">${escapeHtml(name)}</span>`)
    .join('');
  const elementTags = (build.elements || [])
    .map((name) => `<span class="guide-tag element">${escapeHtml(name)}</span>`)
    .join('');
  const details = build.buildNote
    ? `<details class="guide-build-details">
        <summary>도자기 빌드 보기</summary>
        <div class="guide-build-detail-body"><p>${escapeHtml(build.buildNote)}</p></div>
      </details>`
    : '';

  return `<article class="guide-build-card">
    <h4>${escapeHtml(build.title)}</h4>
    ${build.description ? `<p class="guide-build-description">${escapeHtml(build.description)}</p>` : ''}
    ${characterTags || elementTags ? `<div class="guide-tags">${elementTags}${characterTags}</div>` : ''}
    ${details}
  </article>`;
}

function renderBuildList(builds: GuideBuild[], emptyText: string): string {
  if (builds.length === 0) return `<div class="guide-empty">${emptyText}</div>`;
  return `<div class="guide-build-list">${builds.map(renderBuildCard).join('')}</div>`;
}

function renderElementIcons(elements: ElementKey[]): string {
  const icons = elements
    .filter((element): element is ElementKey => element in ELEMENT_ICON_IDS)
    .map((element) => {
      const iconId = ELEMENT_ICON_IDS[element];
      return `<img src="assets/common/icon_common_property_${iconId}.png" alt="${element}" title="${element}" class="guide-element-icon">`;
    })
    .join('');

  return icons || '<span class="guide-muted">정보 없음</span>';
}

// =============================================================================
// SCORE BOSS
// =============================================================================

function getBossName(monsterId: number): string {
  return BOSS_NAMES[monsterId] || `Boss ${monsterId}`;
}

function renderBossSelector(levels: ScoreBossLevel[]): string {
  return `<div class="guide-boss-selector" role="tablist" aria-label="연합 토벌 보스 선택">
    ${levels.map((level) => {
      const isSelected = selectedScoreBossId === level.MonsterId;
      return `<button class="guide-boss-selector-button ${isSelected ? 'active' : ''}" data-score-boss-id="${level.MonsterId}" role="tab" aria-selected="${isSelected}">
        ${escapeHtml(getBossName(level.MonsterId))}
      </button>`;
    }).join('')}
  </div>`;
}

function renderBossInfo(level: ScoreBossLevel, activeData: ActiveScoreBossData, override: BossOverride): string {
  const bonusCondition = activeData.scoreGetControls[String(level.NonDamageScoreGet)];
  const bossSkill = activeData.abilities[String(level.ScoreBossAbility)];
  const weakElements = renderElementIcons(override.weakElements || []);
  const strongElements = renderElementIcons(override.strongElements || []);

  const renderDataRow = (
    title: string,
    data: ScoreBossAbility | ScoreBossGetControl | undefined,
    translations: Record<string, string>,
  ): string => {
    if (!data) return '';

    const name = translations[data.Name] || data.Name;
    const description = translations[data.Desc] || data.Desc;
    const iconName = data.IconSource.split('/').pop();
    const icon = iconName
      ? `<img src="assets/scoreboss_icons/${escapeHtml(iconName)}.png" alt="" class="guide-boss-data-image">`
      : '';
    return `<article class="guide-boss-data-row">
      <div class="guide-boss-data-icon">${icon}</div>
      <div>
        <span class="guide-boss-data-label">${title}</span>
        <h4>${escapeHtml(name)}</h4>
        <p>${escapeHtml(formatAbilityText(description, data))}</p>
      </div>
    </article>`;
  };

  return `<div class="guide-boss-info">
    <h3>보스 정보</h3>
    <div class="guide-element-summary">
      <div class="guide-info-row"><strong>약점 속성</strong><div class="guide-element-icons">${weakElements}</div></div>
      <div class="guide-info-row"><strong>강속성</strong><div class="guide-element-icons">${strongElements}</div></div>
    </div>
    ${override.summary ? `<p class="guide-boss-summary">${escapeHtml(override.summary)}</p>` : ''}
    <div class="guide-boss-data-list">
      ${renderDataRow('보너스 조건', bonusCondition, activeData.scoreGetText)}
      ${renderDataRow('보스 스킬', bossSkill, activeData.abilityText)}
    </div>
  </div>`;
}

function renderScoreBoss(activeData: ActiveScoreBossData, content: GuideContent): string {
  if (!activeData.levels.some((level) => level.MonsterId === selectedScoreBossId)) {
    selectedScoreBossId = activeData.levels[0]?.MonsterId || null;
  }

  const level = activeData.levels.find((item) => item.MonsterId === selectedScoreBossId);
  if (!level) return '<div class="guide-empty">진행 중인 연합 토벌 정보를 찾지 못했습니다.</div>';

  const bossIndex = activeData.levels.findIndex((item) => item.Id === level.Id);
  const bossName = getBossName(level.MonsterId);
  const imagePath = `assets/monster/scoreboss_${level.MonsterId}.png`;
  const override = content.scoreBoss?.bosses?.[bossIndex] || {};
  const builds = override.builds || [];

  return `${renderBossSelector(activeData.levels)}
    <section class="guide-boss-detail">
      <div class="guide-boss-overview">
        <div class="guide-boss-image">
          <img src="${imagePath}" alt="${escapeHtml(bossName)}" loading="lazy" onerror="this.closest('.guide-boss-image').classList.add('missing')">
          <span>보스 이미지 준비 중</span>
        </div>
        ${renderBossInfo(level, activeData, override)}
      </div>
      <section class="guide-recommendations">
        <h3>추천 빌드</h3>
        ${renderBuildList(builds, '추천 빌드 준비 중')}
      </section>
    </section>`;
}

// =============================================================================
// PAGE RENDERING
// =============================================================================

function renderGuideTabs(scoreBossPeriod = ''): string {
  const scoreBossStatus = scoreBossPeriod
    ? `<span>진행 중 - ${escapeHtml(scoreBossPeriod)}</span>`
    : '';

  return `<div class="guide-tabs" role="tablist">
    <button class="compact-main-tab guide-tab ${activeTab === 'scoreboss' ? 'active' : ''}" data-guide-tab="scoreboss">
      <i class="fa-solid fa-medal"></i>
      <span class="guide-tab-title">연합 토벌</span>
      ${scoreBossStatus}
    </button>
    <button class="compact-main-tab guide-tab ${activeTab === 'jointdrill' ? 'active' : ''}" data-guide-tab="jointdrill">
      <i class="fa-solid fa-list-check"></i>
      <span class="guide-tab-title">종언의 노래</span>
    </button>
    <button class="compact-main-tab guide-tab ${activeTab === 'attribute' ? 'active' : ''}" data-guide-tab="attribute">
      <i class="fa-solid fa-calculator"></i>
      <span class="guide-tab-title">속성별 빌드</span>
    </button>
  </div>`;
}

export async function renderGuide(): Promise<void> {
  const container = document.getElementById('guide-container');
  if (!container) return;

  container.innerHTML = '<div class="guide-loading">공략 정보를 불러오는 중...</div>';

  try {
    const content = await loadGuideContent();
    let body = '';
    let scoreBossPeriod = '';

    if (activeTab === 'scoreboss') {
      const activeScoreBoss = await loadActiveScoreBoss();
      if (activeScoreBoss) {
        scoreBossPeriod = formatPeriod(activeScoreBoss.control);
        body = renderScoreBoss(activeScoreBoss, content);
      } else {
        body = '<div class="guide-empty">진행 중인 연합 토벌 정보를 찾지 못했습니다.</div>';
      }
    } else if (activeTab === 'jointdrill') {
      body = renderBuildList(content.jointDrill?.builds?.current || [], '진행 중인 종언의 노래 공략이 없습니다.');
    } else {
      body = renderBuildList(content.attributeBuilds || [], '등록된 속성별 빌드가 없습니다.');
    }

    container.innerHTML = `<div class="guide-layout">
      ${renderGuideTabs(scoreBossPeriod)}
      <div class="guide-content">${body}</div>
    </div>`;
  } catch (error) {
    console.error('[Guide] Failed to render guide database:', error);
    container.innerHTML = '<div class="guide-empty">공략 정보를 불러오지 못했습니다.</div>';
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export function init(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLButtonElement>('[data-guide-tab]');
    const bossButton = target.closest<HTMLButtonElement>('[data-score-boss-id]');

    if (tab) {
      activeTab = tab.dataset.guideTab as GuideTab;
      void renderGuide();
      return;
    }

    if (bossButton) {
      selectedScoreBossId = Number(bossButton.dataset.scoreBossId);
      void renderGuide();
    }
  });
}
