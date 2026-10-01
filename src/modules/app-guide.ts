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

interface Activity {
  Id: number;
  ActivityType: number;
  TabBgRes: string;
  StartTime: string;
  EndTime: string;
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

interface Monster {
  FAId: number;
}

interface MonsterSkin {
  MonsterManual: number;
}

interface MonsterManual {
  Name: string;
}

interface JointDrillControl {
  Id: number;
  DrillLevelGroupId: number;
}

interface JointDrillLevel {
  Id: number;
  Difficulty: number;
  DrillLevelGroupId: number;
  BattleTime: number;
  BossId: number;
  BossAffix: number[];
  RecommendLv: number;
  SubName: string;
}

interface JointDrillAffix {
  Id: number;
  Name: string;
  Desc: string;
  Icon: string;
}

interface GuideBuild {
  title: string;
  description?: string;
  characters?: string[];
  elements?: string[];
  buildNote?: string;
  startDate?: string;
  endDate?: string;
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
  bossNames: Record<number, string>;
}

interface ActiveJointDrillData {
  activity: Activity;
  control: JointDrillControl;
  levels: JointDrillLevel[];
  affixes: Record<string, JointDrillAffix>;
  affixText: Record<string, string>;
  levelText: Record<string, string>;
  uiText: Record<string, string>;
  bossNames: Record<number, string>;
}

type ElementKey = 'Water' | 'Fire' | 'Earth' | 'Wind' | 'Light' | 'Dark' | 'Normal';

const DATA_ROOT = 'data';
const GUIDE_CONTENT_FILE = 'GuideContent.json';
const ELEMENT_ICON_IDS: Record<ElementKey, number> = {
  Water: 1,
  Fire: 2,
  Earth: 3,
  Wind: 4,
  Light: 5,
  Dark: 6,
  Normal: 7,
};
const ATTRIBUTE_ELEMENTS: ElementKey[] = ['Water', 'Fire', 'Earth', 'Wind', 'Light', 'Dark', 'Normal'];
let activeTab: GuideTab = 'scoreboss';
let selectedScoreBossId: number | null = null;
let selectedJointDrillLevelId: number | null = null;
let selectedJointDrillAffixId: number | null = null;
let selectedAttributeElement: ElementKey = 'Water';
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

async function loadJson<T>(file: string, fresh = false): Promise<T> {
  const response = await fetch(`${DATA_ROOT}/${file}`, fresh ? { cache: 'no-store' } : undefined);
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
  return controls.find((control) => isWithinEventPeriod(control.StartTime, control.EndTime));
}

function isWithinEventPeriod(startDate?: string, endDate?: string): boolean {
  const now = Date.now();
  const startTime = startDate ? Date.parse(startDate) : Number.NEGATIVE_INFINITY;
  if (Number.isNaN(startTime) || now < startTime) return false;
  if (!endDate) return true;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  end.setHours(24, 0, 0, 0);
  return now < end.getTime();
}

async function loadActiveScoreBoss(): Promise<ActiveScoreBossData | null> {
  const language = window.i18n?.currentLang || 'KR';
  const [controls, levelData, abilities, abilityText, scoreGetControls, scoreGetText, monsters, monsterSkins, monsterManuals, monsterManualText] = await Promise.all([
    loadJson<Record<string, ScoreBossControl>>('ScoreBossControl.json', true),
    loadJson<Record<string, ScoreBossLevel>>('ScoreBossLevel.json', true),
    loadJson<Record<string, ScoreBossAbility>>('ScoreBossAbility.json', true),
    loadJson<Record<string, string>>(`${language}/ScoreBossAbility.json`, true),
    loadJson<Record<string, ScoreBossGetControl>>('ScoreBossGetControl.json', true),
    loadJson<Record<string, string>>(`${language}/ScoreBossGetControl.json`, true),
    loadJson<Record<string, Monster>>('Monster.json'),
    loadJson<Record<string, MonsterSkin>>('MonsterSkin.json'),
    loadJson<Record<string, MonsterManual>>('MonsterManual.json'),
    loadJson<Record<string, string>>(`${language}/MonsterManual.json`),
  ]);

  const control = getActiveControl(controls);
  if (!control) return null;

  const levels = control.LevelGroup
    .map((levelId) => levelData[String(levelId)])
    .filter((level): level is ScoreBossLevel => Boolean(level));

  const bossNames = Object.fromEntries(levels.map((level) => {
    const monster = monsters[String(level.MonsterId)];
    const skin = monster ? monsterSkins[String(monster.FAId)] : undefined;
    const manual = skin ? monsterManuals[String(skin.MonsterManual)] : undefined;
    return [level.MonsterId, manual ? (monsterManualText[manual.Name] || manual.Name) : `Boss ${level.MonsterId}`];
  }));

  return { control, levels, abilities, abilityText, scoreGetControls, scoreGetText, bossNames };
}

async function loadActiveJointDrill(): Promise<ActiveJointDrillData | null> {
  const language = window.i18n?.currentLang || 'KR';
  const [activities, controls, levelData, affixes, affixText, levelText, uiText, monsters, monsterSkins, monsterManuals, monsterManualText] = await Promise.all([
    loadJson<Record<string, Activity>>('Activity.json', true),
    loadJson<Record<string, JointDrillControl>>('JointDrillControl.json', true),
    loadJson<Record<string, JointDrillLevel>>('JointDrillLevel.json', true),
    loadJson<Record<string, JointDrillAffix>>('JointDrillAffix.json', true),
    loadJson<Record<string, string>>(`${language}/JointDrillAffix.json`, true),
    loadJson<Record<string, string>>(`${language}/JointDrillLevel.json`, true),
    loadJson<Record<string, string>>(`${language}/UIText.json`, true),
    loadJson<Record<string, Monster>>('Monster.json'),
    loadJson<Record<string, MonsterSkin>>('MonsterSkin.json'),
    loadJson<Record<string, MonsterManual>>('MonsterManual.json'),
    loadJson<Record<string, string>>(`${language}/MonsterManual.json`),
  ]);
  const activity = Object.values(activities).find((item) => (
    item.ActivityType === 7
    && item.TabBgRes.includes('jointdrill')
    && isWithinEventPeriod(item.StartTime, item.EndTime)
  ));

  if (!activity) return null;
  const control = controls[String(activity.Id)];
  if (!control) return null;

  const levels = Object.values(levelData)
    .filter((level) => level.DrillLevelGroupId === control.DrillLevelGroupId)
    .sort((a, b) => a.Difficulty - b.Difficulty);
  const bossNames = Object.fromEntries(levels.map((level) => {
    const monster = monsters[String(level.BossId)];
    const skin = monster ? monsterSkins[String(monster.FAId)] : undefined;
    const manual = skin ? monsterManuals[String(skin.MonsterManual)] : undefined;
    return [level.BossId, manual ? (monsterManualText[manual.Name] || manual.Name) : `Boss ${level.BossId}`];
  }));

  return { activity, control, levels, affixes, affixText, levelText, uiText, bossNames };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPeriod(period: Pick<ScoreBossControl, 'StartTime' | 'EndTime'>): string {
  return `${formatDate(period.StartTime)} ~ ${formatDate(period.EndTime)}`;
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
  const visibleBuilds = builds.filter((build) => isWithinEventPeriod(build.startDate, build.endDate));
  if (visibleBuilds.length === 0) return `<div class="guide-empty">${emptyText}</div>`;
  return `<div class="guide-build-list">${visibleBuilds.map(renderBuildCard).join('')}</div>`;
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

function getElementLabel(element: ElementKey): string {
  const labelKey = element === 'Normal' ? 'none' : element.toLowerCase();
  return window.i18n?.t(`discdb.${labelKey}`) || element;
}

function renderAttributeBuilds(builds: GuideBuild[]): string {
  const elementBuilds = builds.filter((build) => build.elements?.includes(selectedAttributeElement));
  const elementLabel = getElementLabel(selectedAttributeElement);

  return `<section class="guide-attribute-layout">
    <aside class="guide-attribute-sidebar">
      <div class="guide-attribute-sidebar-header">
        <h3><i class="fa-solid fa-list"></i> 속성 목록</h3>
      </div>
      <div class="guide-attribute-list" role="tablist" aria-label="속성별 빌드 선택">
        ${ATTRIBUTE_ELEMENTS.map((element) => {
          const iconId = ELEMENT_ICON_IDS[element];
          const isSelected = element === selectedAttributeElement;
          return `<button class="guide-attribute-button ${isSelected ? 'active' : ''}" data-guide-attribute="${element}" role="tab" aria-selected="${isSelected}">
            <img src="assets/common/icon_common_property_${iconId}.png" alt="" aria-hidden="true">
            <span>${escapeHtml(getElementLabel(element))}</span>
          </button>`;
        }).join('')}
      </div>
    </aside>
    <div class="guide-attribute-content">
      <h3><img src="assets/common/icon_common_property_${ELEMENT_ICON_IDS[selectedAttributeElement]}.png" alt=""> ${escapeHtml(elementLabel)} 빌드</h3>
      ${renderBuildList(elementBuilds, `등록된 ${elementLabel} 빌드가 없습니다.`)}
    </div>
  </section>`;
}

// =============================================================================
// SCORE BOSS
// =============================================================================

function getBossName(monsterId: number, bossNames: Record<number, string>): string {
  return bossNames[monsterId] || `Boss ${monsterId}`;
}

function renderBossSelector(activeData: ActiveScoreBossData): string {
  return `<div class="guide-boss-selector" role="tablist" aria-label="연합 토벌 보스 선택">
    ${activeData.levels.map((level) => {
      const isSelected = selectedScoreBossId === level.MonsterId;
      return `<button class="guide-boss-selector-button ${isSelected ? 'active' : ''}" data-score-boss-id="${level.MonsterId}" role="tab" aria-selected="${isSelected}">
        ${escapeHtml(getBossName(level.MonsterId, activeData.bossNames))}
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
  const bossName = getBossName(level.MonsterId, activeData.bossNames);
  const imagePath = `assets/monster/scoreboss_${level.MonsterId}.png`;
  const override = content.scoreBoss?.bosses?.[bossIndex] || {};
  const builds = override.builds || [];

  return `${renderBossSelector(activeData)}
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

function getJointDrillDifficultyName(level: JointDrillLevel, uiText: Record<string, string>): string {
  return uiText[`UIText.JointDrill_Difficulty_Name_${level.Difficulty}.1`] || `난이도 ${level.Difficulty}`;
}

function renderJointDrill(activeData: ActiveJointDrillData, content: GuideContent): string {
  if (!activeData.levels.some((level) => level.Id === selectedJointDrillLevelId)) {
    selectedJointDrillLevelId = activeData.levels[0]?.Id || null;
  }

  const level = activeData.levels.find((item) => item.Id === selectedJointDrillLevelId);
  if (!level) return '<div class="guide-empty">종언 난이도 정보를 찾지 못했습니다.</div>';

  const bossName = activeData.bossNames[level.BossId] || `Boss ${level.BossId}`;
  const affixes = level.BossAffix
    .map((affixId) => activeData.affixes[String(affixId)])
    .filter((affix): affix is JointDrillAffix => Boolean(affix));
  if (!affixes.some((affix) => affix.Id === selectedJointDrillAffixId)) {
    selectedJointDrillAffixId = affixes[0]?.Id || null;
  }
  const levelName = activeData.levelText[level.SubName] || level.SubName;
  const builds = content.jointDrill?.builds?.[String(level.Difficulty)] || content.jointDrill?.builds?.current || [];

  return `<section class="guide-jointdrill">
    <section class="guide-jointdrill-header">
      <div>
        <span class="guide-jointdrill-eyebrow"><i class="fa-solid fa-list-check"></i> 종언의 노래</span>
        <h3>${escapeHtml(bossName)}</h3>
        <p>${escapeHtml(levelName)}</p>
      </div>
      <div class="guide-jointdrill-meta">
        <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(formatPeriod(activeData.activity))}</span>
        <span><i class="fa-solid fa-user-group"></i> 권장 레벨 ${escapeHtml(level.RecommendLv)}</span>
        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(level.BattleTime)}초</span>
      </div>
    </section>
    <div class="guide-jointdrill-difficulties" role="tablist" aria-label="종언 난이도 선택">
      ${activeData.levels.map((item) => {
        const selected = item.Id === selectedJointDrillLevelId;
        return `<button class="guide-jointdrill-difficulty ${selected ? 'active' : ''}" data-joint-drill-level-id="${item.Id}" role="tab" aria-selected="${selected}">
          <span>${escapeHtml(getJointDrillDifficultyName(item, activeData.uiText))}</span>
          <small>권장 ${escapeHtml(item.RecommendLv)}</small>
        </button>`;
      }).join('')}
    </div>
    <section class="guide-jointdrill-system">
      <h3>보스 시스템 <span>${affixes.length}개</span></h3>
      <div class="guide-jointdrill-affix-selector" role="tablist" aria-label="보스 시스템 선택">
        ${affixes.map((affix) => {
          const iconName = affix.Icon.split('/').pop() || affix.Icon;
          const name = activeData.affixText[affix.Name] || affix.Name;
          const selected = affix.Id === selectedJointDrillAffixId;
          return `<button class="guide-jointdrill-affix-button ${selected ? 'active' : ''}" data-joint-drill-affix-id="${affix.Id}" role="tab" aria-selected="${selected}">
            <img src="assets/jointdrill/${escapeHtml(iconName)}.png" alt="" loading="lazy">
            <span>${escapeHtml(name)}</span>
          </button>`;
        }).join('')}
      </div>
      ${affixes.map((affix) => {
        const iconName = affix.Icon.split('/').pop() || affix.Icon;
        const name = activeData.affixText[affix.Name] || affix.Name;
        const description = activeData.affixText[affix.Desc] || affix.Desc;
        const selected = affix.Id === selectedJointDrillAffixId;
        return `<article class="guide-jointdrill-affix-detail ${selected ? 'active' : ''}" data-joint-drill-affix-detail-id="${affix.Id}">
          <img src="assets/jointdrill/${escapeHtml(iconName)}.png" alt="" loading="lazy">
          <div><h4>${escapeHtml(name)}</h4><p>${escapeHtml(description)}</p></div>
        </article>`;
      }).join('')}
    </section>
    <section class="guide-recommendations">
      <h3>추천 빌드</h3>
      ${renderBuildList(builds, '등록된 추천 빌드가 없습니다.')}
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

  const scrollY = window.scrollY;
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
      const activeJointDrill = await loadActiveJointDrill();
      body = activeJointDrill
        ? renderJointDrill(activeJointDrill, content)
        : '<div class="guide-empty">진행 중인 종언의 노래가 없습니다.</div>';
    } else {
      body = renderAttributeBuilds(content.attributeBuilds || []);
    }

    container.innerHTML = `<div class="guide-layout">
      ${renderGuideTabs(scoreBossPeriod)}
      <div class="guide-content">${body}</div>
    </div>`;
    requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
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
    const jointDrillButton = target.closest<HTMLButtonElement>('[data-joint-drill-level-id]');
    const jointDrillAffixButton = target.closest<HTMLButtonElement>('[data-joint-drill-affix-id]');
    const attributeButton = target.closest<HTMLButtonElement>('[data-guide-attribute]');

    if (tab) {
      activeTab = tab.dataset.guideTab as GuideTab;
      void renderGuide();
      return;
    }

    if (bossButton) {
      selectedScoreBossId = Number(bossButton.dataset.scoreBossId);
      void renderGuide();
      return;
    }

    if (jointDrillButton) {
      selectedJointDrillLevelId = Number(jointDrillButton.dataset.jointDrillLevelId);
      void renderGuide();
      return;
    }

    if (jointDrillAffixButton) {
      event.preventDefault();
      selectedJointDrillAffixId = Number(jointDrillAffixButton.dataset.jointDrillAffixId);
      const system = jointDrillAffixButton.closest<HTMLElement>('.guide-jointdrill-system');
      system?.querySelectorAll<HTMLButtonElement>('[data-joint-drill-affix-id]').forEach((button) => {
        const selected = button === jointDrillAffixButton;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      system?.querySelectorAll<HTMLElement>('[data-joint-drill-affix-detail-id]').forEach((detail) => {
        detail.classList.toggle('active', Number(detail.dataset.jointDrillAffixDetailId) === selectedJointDrillAffixId);
      });
      return;
    }

    if (attributeButton) {
      selectedAttributeElement = attributeButton.dataset.guideAttribute as ElementKey;
      void renderGuide();
    }
  });
}
