/**
 * Damage Calculator Module - Sophisticated build-integrated damage analysis
 *
 * Features:
 * - Reads from app build state (characters, potentials, discs)
 * - Calculates damage for master character skills (Normal ATK, Skill, Ultimate)
 * - Aggregates stats from all sources (base, potentials, discs, buffs)
 * - Groups buffs/effects with individual components
 * - Toggle system for conditional buffs
 * - Manual stat adjustment inputs
 * - CSV export functionality
 */

import type { Position, CharacterState, ParamParserState } from '@/types';
import { parseParamValue } from '@/modules/param-parser';
import { showSuccess, showError } from '@/shared';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface StatSource {
  source: string;
  value: number;
  active: boolean; // Can be toggled
}

interface AggregatedStat {
  name: string;
  baseValue: number;
  sources: StatSource[];
  manualAdjustment: number;
  total: number;
}

interface BuffSource {
  id: string;
  name: string;
  description: string;
  values: Record<string, number>;
  active: boolean;
  category: 'potential' | 'disc' | 'other';
}

interface SkillDamageResult {
  skillName: string;
  skillLevel: number;
  baseDamage: number;
  critDamage: number;
  averageDamage: number;
  breakdown: {
    skillMultiplier: number;
    atk: number;
    critRate: number;
    critDamage: number;
    elementalBonus: number;
    damageBonus: number;
    defenseMultiplier: number;
  };
}

interface DamageCalcState {
  // Aggregated stats
  stats: Map<string, AggregatedStat>;

  // Buff tracking
  buffs: BuffSource[];

  // Enemy configuration
  enemy: {
    level: number;
    defense: number;
    resistance: number;
    toughness: number;
  };

  // Calculation results
  results: {
    normalAtk?: SkillDamageResult;
    skill?: SkillDamageResult;
    ultimate?: SkillDamageResult;
  };

  // Manual adjustments enabled
  manualMode: boolean;
}

const dmgCalcState: DamageCalcState = {
  stats: new Map(),
  buffs: [],
  enemy: {
    level: 80,
    defense: 500,
    resistance: 0,
    toughness: 100
  },
  results: {},
  manualMode: false
};

// Stat categories for organized display
const STAT_CATEGORIES = {
  core: ['Atk', 'Hp', 'Def'],
  offense: ['CritRate', 'CritPower', 'HitRate'],
  elemental: ['WEE', 'FEE', 'SEE', 'AEE', 'LEE', 'DEE'],
  special: ['ToughnessDamageAdjust', 'DamageBonus', 'FinalDamageBonus']
};

const STAT_NAMES: Record<string, string> = {
  'Atk': '공격력',
  'Hp': '생명력',
  'Def': '방어력',
  'HitRate': '명중률',
  'CritRate': '치명타 확률',
  'CritPower': '치명타 피해',
  'ToughnessDamageAdjust': '강인도 데미지',
  'WEE': '물 원소 강화',
  'FEE': '불 원소 강화',
  'SEE': '땅 원소 강화',
  'AEE': '바람 원소 강화',
  'LEE': '빛 원소 강화',
  'DEE': '어둠 원소 강화',
  'DamageBonus': '데미지 증가',
  'FinalDamageBonus': '최종 데미지 증가'
};

// =============================================================================
// STAT AGGREGATION
// =============================================================================

function initializeStats(): void {
  dmgCalcState.stats.clear();

  // Initialize all stat categories
  Object.values(STAT_CATEGORIES).flat().forEach(statKey => {
    dmgCalcState.stats.set(statKey, {
      name: STAT_NAMES[statKey] || statKey,
      baseValue: 0,
      sources: [],
      manualAdjustment: 0,
      total: 0
    });
  });
}

function aggregateStatsFromBuild(): void {
  if (!window.state) return;

  initializeStats();

  const masterChar = window.state.party?.master;
  if (!masterChar || typeof masterChar === 'string') return;

  // 1. Base character stats
  aggregateBaseStats(masterChar);

  // 2. Stats from potentials
  aggregatePotentialStats();

  // 3. Stats from discs
  aggregateDiscStats();

  // 4. Calculate totals
  calculateStatTotals();
}

function aggregateBaseStats(character: any): void {
  // Get character base stats from Attribute data
  const charId = character.id;
  const level = window.state?.characterLevelPhase?.master || 0;
  const levelPhases = [1, 10, 20, 30, 40, 50, 60, 70, 80];
  const actualLevel = levelPhases[level] || 1;

  // This would need Attribute.json data
  // For now, placeholder - you'll need to implement actual stat lookup
  addStatSource('Atk', '기본 스탯', 500, true);
  addStatSource('Hp', '기본 스탯', 5000, true);
  addStatSource('Def', '기본 스탯', 200, true);
  addStatSource('CritRate', '기본 스탯', 5, true);
  addStatSource('CritPower', '기본 스탯', 150, true);
}

function aggregatePotentialStats(): void {
  if (!window.state?.selectedPotentials?.master) return;

  const masterPotentials = window.state.selectedPotentials.master;

  // Process each selected potential
  masterPotentials.forEach(potId => {
    if (!potId) return;

    const level = window.state?.potentialLevels?.master?.[potId] || 1;
    const potential = window.state?.potentials?.[potId];

    if (!potential) return;

    const potentialName = getPotentialName(String(potId));

    // Parse potential effects and extract stat bonuses
    // This is a placeholder - actual implementation needs to parse
    // potential descriptions and extract stat modifiers

    // Example: If potential gives +10% ATK
    // addStatSource('Atk', `잠재력: ${potentialName}`, atkBonus, true);
  });
}

function aggregateDiscStats(): void {
  if (!window.discsState?.selectedDiscs) return;

  const mainDiscs = ['main1', 'main2', 'main3'] as const;
  const subDiscs = ['sub1', 'sub2', 'sub3'] as const;

  // Main disc stats
  mainDiscs.forEach(slotId => {
    const disc = window.discsState?.selectedDiscs?.[slotId];
    if (!disc) return;

    const limitBreak = window.discsState?.discLimitBreaks?.[slotId] || 1;
    const discName = getDiscName(disc.Id);

    // Add stats from disc
    // Placeholder - actual implementation needs disc stat data
    // addStatSource('Atk', `레코드: ${discName}`, atkBonus, true);
  });

  // Sub disc stats
  subDiscs.forEach(slotId => {
    const disc = window.discsState?.selectedDiscs?.[slotId];
    if (!disc) return;

    const phase = window.discsState?.subDiscLevels?.[slotId] || 0;
    const discName = getDiscName(disc.Id);

    // Add stats from sub disc
    // addStatSource('Atk', `서브 레코드: ${discName}`, atkBonus, true);
  });
}

function addStatSource(statKey: string, source: string, value: number, active: boolean): void {
  const stat = dmgCalcState.stats.get(statKey);
  if (!stat) return;

  stat.sources.push({ source, value, active });
}

function calculateStatTotals(): void {
  dmgCalcState.stats.forEach((stat, key) => {
    const activeSourcesTotal = stat.sources
      .filter(s => s.active)
      .reduce((sum, s) => sum + s.value, 0);

    stat.total = stat.baseValue + activeSourcesTotal + stat.manualAdjustment;
  });
}

// =============================================================================
// BUFF AGGREGATION
// =============================================================================

function aggregateBuffs(): void {
  dmgCalcState.buffs = [];

  // Buffs from potentials
  if (window.state?.selectedPotentials?.master) {
    window.state.selectedPotentials.master.forEach(potId => {
      if (!potId) return;

      const potential = window.state?.potentials?.[potId];
      if (!potential) return;

      // Extract buffs from potential description
      // This needs actual parsing logic
      const buffInfo = extractBuffsFromPotential(String(potId));
      if (buffInfo) {
        dmgCalcState.buffs.push({
          id: `pot_${potId}`,
          name: getPotentialName(String(potId)),
          description: buffInfo.description,
          values: buffInfo.values,
          active: true,
          category: 'potential'
        });
      }
    });
  }

  // Buffs from discs
  // Similar logic for disc buffs
}

function extractBuffsFromPotential(potId: string): { description: string; values: Record<string, number> } | null {
  // Placeholder - needs actual implementation
  // Parse potential description to extract conditional buffs
  return null;
}

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================

function calculateSkillDamage(skillType: 'normal' | 'skill' | 'ultimate'): SkillDamageResult | null {
  if (!window.state?.party?.master) return null;

  const masterChar = window.state.party.master;
  if (typeof masterChar === 'string') return null;

  const charData = masterChar.data;
  let skillId: number | null = null;
  let skillName = '';

  // Get skill ID based on type
  switch (skillType) {
    case 'normal':
      skillId = charData.NormalAtkId as number;
      skillName = '일반 공격';
      break;
    case 'skill':
      skillId = charData.SkillId as number;
      skillName = '스킬';
      break;
    case 'ultimate':
      skillId = charData.UltimateId as number;
      skillName = '필살기';
      break;
  }

  if (!skillId) return null;

  const skillLevel = window.state.skillLevels?.master?.[skillId] || 1;

  // Get skill damage multiplier from HitDamage data
  const skillMultiplier = getSkillMultiplier(skillId, skillLevel);

  // Get aggregated stats
  const atk = dmgCalcState.stats.get('Atk')?.total || 0;
  const critRate = dmgCalcState.stats.get('CritRate')?.total || 0;
  const critDamage = dmgCalcState.stats.get('CritPower')?.total || 150;
  const elementalBonus = getElementalBonus(charData.EET);
  const damageBonus = dmgCalcState.stats.get('DamageBonus')?.total || 0;

  // Calculate defense multiplier
  const charLevel = getLevelFromPhase(window.state.characterLevelPhase?.master || 0);
  const defenseMultiplier = calculateDefenseMultiplier(
    charLevel,
    dmgCalcState.enemy.level,
    dmgCalcState.enemy.defense
  );

  // Calculate resistance multiplier
  const resistanceMultiplier = 1 - (dmgCalcState.enemy.resistance / 100);

  // Base damage formula
  const baseDamage = atk * (skillMultiplier / 100) * (1 + elementalBonus / 100) *
                     (1 + damageBonus / 100) * defenseMultiplier * resistanceMultiplier;

  // Critical damage
  const critMultiplier = critDamage / 100;
  const critDmg = baseDamage * critMultiplier;

  // Average damage (accounting for crit rate)
  const critRateDecimal = Math.min(100, Math.max(0, critRate)) / 100;
  const avgDamage = baseDamage * (1 - critRateDecimal) + critDmg * critRateDecimal;

  return {
    skillName,
    skillLevel,
    baseDamage: Math.round(baseDamage),
    critDamage: Math.round(critDmg),
    averageDamage: Math.round(avgDamage),
    breakdown: {
      skillMultiplier,
      atk,
      critRate,
      critDamage,
      elementalBonus,
      damageBonus,
      defenseMultiplier
    }
  };
}

function getSkillMultiplier(skillId: number, level: number): number {
  // Placeholder - needs actual HitDamage lookup
  // This should read from window.state.hitDamage
  return 250; // 250% multiplier as example
}

function getElementalBonus(elementType: number): number {
  const elementStats = ['WEE', 'FEE', 'SEE', 'AEE', 'LEE', 'DEE'];
  if (elementType >= 1 && elementType <= 6) {
    const statKey = elementStats[elementType - 1];
    if (statKey) {
      return dmgCalcState.stats.get(statKey)?.total || 0;
    }
  }
  return 0;
}

function getLevelFromPhase(phase: number): number {
  const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80];
  return levels[phase] || 1;
}

function calculateDefenseMultiplier(charLevel: number, enemyLevel: number, enemyDef: number): number {
  // Simplified defense formula - adjust based on actual game mechanics
  const levelDiff = charLevel - enemyLevel;
  const levelMult = 1 + (levelDiff * 0.01);
  const defReduction = (charLevel * 100) / ((charLevel * 100) + enemyDef);
  return levelMult * defReduction;
}

function calculateAllDamage(): void {
  dmgCalcState.results = {
    normalAtk: calculateSkillDamage('normal') || undefined,
    skill: calculateSkillDamage('skill') || undefined,
    ultimate: calculateSkillDamage('ultimate') || undefined
  };
}

// =============================================================================
// CSV EXPORT
// =============================================================================

function exportToCSV(): void {
  const rows: string[][] = [];

  // Header
  rows.push(['Damage Calculator Export']);
  rows.push(['Date', new Date().toISOString()]);
  rows.push([]);

  // Character info
  const masterChar = window.state?.party?.master;
  if (masterChar && typeof masterChar !== 'string') {
    const charName = getCharacterName(masterChar.id);
    rows.push(['Character', charName]);
    rows.push([]);
  }

  // Stats section
  rows.push(['=== Stats ===']);
  rows.push(['Stat', 'Base', 'From Sources', 'Manual Adj', 'Total']);

  dmgCalcState.stats.forEach((stat, key) => {
    const sourcesTotal = stat.sources
      .filter(s => s.active)
      .reduce((sum, s) => sum + s.value, 0);

    rows.push([
      stat.name,
      stat.baseValue.toString(),
      sourcesTotal.toString(),
      stat.manualAdjustment.toString(),
      stat.total.toString()
    ]);

    // Detailed sources
    stat.sources.filter(s => s.active).forEach(source => {
      rows.push(['  ' + source.source, '', source.value.toString(), '', '']);
    });
  });

  rows.push([]);

  // Buffs section
  rows.push(['=== Active Buffs ===']);
  rows.push(['Name', 'Category', 'Description']);

  dmgCalcState.buffs.filter(b => b.active).forEach(buff => {
    rows.push([buff.name, buff.category, buff.description]);
  });

  rows.push([]);

  // Damage results
  rows.push(['=== Damage Results ===']);
  rows.push(['Skill', 'Level', 'Base DMG', 'Crit DMG', 'Avg DMG']);

  Object.values(dmgCalcState.results).forEach(result => {
    if (result) {
      rows.push([
        result.skillName,
        result.skillLevel.toString(),
        result.baseDamage.toLocaleString(),
        result.critDamage.toLocaleString(),
        result.averageDamage.toLocaleString()
      ]);
    }
  });

  rows.push([]);

  // Damage breakdown
  rows.push(['=== Damage Breakdown ===']);
  Object.values(dmgCalcState.results).forEach(result => {
    if (result) {
      rows.push([result.skillName]);
      rows.push(['Skill Multiplier', result.breakdown.skillMultiplier + '%']);
      rows.push(['ATK', result.breakdown.atk.toString()]);
      rows.push(['Crit Rate', result.breakdown.critRate + '%']);
      rows.push(['Crit Damage', result.breakdown.critDamage + '%']);
      rows.push(['Elemental Bonus', result.breakdown.elementalBonus + '%']);
      rows.push(['Damage Bonus', result.breakdown.damageBonus + '%']);
      rows.push(['Defense Multiplier', result.breakdown.defenseMultiplier.toFixed(3)]);
      rows.push([]);
    }
  });

  // Convert to CSV string
  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  // Download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const charName = getCharacterName(window.state?.party?.master?.id || 'unknown');
  link.setAttribute('href', url);
  link.setAttribute('download', `damage_calc_${charName}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess?.('CSV 파일이 다운로드되었습니다');
}

// =============================================================================
// UI RENDERING
// =============================================================================

function renderDamageCalculator(): void {
  const container = document.getElementById('main-tab-dmgcalc');
  if (!container) return;

  // Check if master character is selected
  if (!window.state?.party?.master || typeof window.state.party.master === 'string') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-calculator"></i></div>
        <div class="empty-state-text">메인 캐릭터를 먼저 선택해주세요</div>
      </div>
    `;
    return;
  }

  // Aggregate data
  aggregateStatsFromBuild();
  aggregateBuffs();
  calculateAllDamage();

  container.innerHTML = `
    <div class="dmgcalc-container">
      <div class="dmgcalc-header">
        <h2><i class="fa-solid fa-calculator"></i> 데미지 계산기 (넣을 기능들 배치/테스트 중, 현재 수치는 전부 더미데이터임)</h2>
        <div class="dmgcalc-actions">
          <button class="btn-recalculate" onclick="window.recalculateDamage()">
            <i class="fa-solid fa-rotate"></i> 재계산
          </button>
          <button class="btn-export-csv" onclick="window.exportDamageCSV()">
            <i class="fa-solid fa-file-csv"></i> CSV 내보내기
          </button>
          <button class="btn-toggle-manual" onclick="window.toggleManualMode()">
            <i class="fa-solid fa-sliders"></i> ${dmgCalcState.manualMode ? '자동 모드' : '수동 모드'}
          </button>
        </div>
      </div>

      <div class="dmgcalc-grid">
        <!-- Left: Stats & Buffs -->
        <div class="dmgcalc-sidebar">
          ${renderStatsSection()}
          ${renderBuffsSection()}
          ${renderEnemySection()}
        </div>

        <!-- Right: Damage Results -->
        <div class="dmgcalc-main">
          ${renderDamageResults()}
        </div>
      </div>
    </div>
  `;
}

function renderStatsSection(): string {
  let html = '<div class="dmgcalc-section stats-section">';
  html += '<h3><i class="fa-solid fa-chart-bar"></i> 스탯 집계</h3>';

  Object.entries(STAT_CATEGORIES).forEach(([categoryKey, stats]) => {
    const categoryNames: Record<string, string> = {
      core: '기본 스탯',
      offense: '공격 스탯',
      elemental: '원소 강화',
      special: '특수 스탯'
    };

    html += `<div class="stat-category">`;
    html += `<h4>${categoryNames[categoryKey]}</h4>`;
    html += `<div class="stat-list">`;

    stats.forEach(statKey => {
      const stat = dmgCalcState.stats.get(statKey);
      if (!stat) return;

      html += `
        <div class="stat-item" data-stat="${statKey}">
          <div class="stat-header" onclick="window.toggleStatDetails('${statKey}')">
            <span class="stat-name">${stat.name}</span>
            <span class="stat-total">${stat.total.toLocaleString()}</span>
            <i class="fa-solid fa-chevron-down stat-expand-icon"></i>
          </div>
          <div class="stat-details hidden">
            ${stat.sources.map(source => `
              <div class="stat-source">
                <label>
                  <input type="checkbox"
                         ${source.active ? 'checked' : ''}
                         onchange="window.toggleStatSource('${statKey}', '${source.source}', this.checked)">
                  <span class="source-name">${source.source}</span>
                  <span class="source-value">+${source.value}</span>
                </label>
              </div>
            `).join('')}
            ${dmgCalcState.manualMode ? `
              <div class="stat-manual">
                <label>
                  <span>수동 조정:</span>
                  <input type="number"
                         value="${stat.manualAdjustment}"
                         onchange="window.setManualStatAdjustment('${statKey}', parseFloat(this.value))">
                </label>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += '</div>';
  return html;
}

function renderBuffsSection(): string {
  let html = '<div class="dmgcalc-section buffs-section">';
  html += '<h3><i class="fa-solid fa-sparkles"></i> 버프 & 효과</h3>';

  if (dmgCalcState.buffs.length === 0) {
    html += '<div class="empty-buffs">활성화된 버프가 없습니다</div>';
  } else {
    html += '<div class="buff-list">';

    dmgCalcState.buffs.forEach((buff, index) => {
      html += `
        <div class="buff-item ${buff.active ? 'active' : ''}">
          <label class="buff-toggle">
            <input type="checkbox"
                   ${buff.active ? 'checked' : ''}
                   onchange="window.toggleBuff(${index}, this.checked)">
            <div class="buff-info">
              <div class="buff-name">${buff.name}</div>
              <div class="buff-category">${buff.category}</div>
              <div class="buff-desc">${buff.description}</div>
            </div>
          </label>
        </div>
      `;
    });

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderEnemySection(): string {
  return `
    <div class="dmgcalc-section enemy-section">
      <h3><i class="fa-solid fa-skull"></i> 적 설정</h3>
      <div class="enemy-inputs">
        <div class="input-group">
          <label>레벨</label>
          <input type="number" value="${dmgCalcState.enemy.level}" min="1" max="100"
                 onchange="window.setEnemyLevel(parseInt(this.value))">
        </div>
        <div class="input-group">
          <label>방어력</label>
          <input type="number" value="${dmgCalcState.enemy.defense}" min="0"
                 onchange="window.setEnemyDefense(parseInt(this.value))">
        </div>
        <div class="input-group">
          <label>저항 (%)</label>
          <input type="number" value="${dmgCalcState.enemy.resistance}" min="-100" max="100"
                 onchange="window.setEnemyResistance(parseInt(this.value))">
        </div>
      </div>
    </div>
  `;
}

function renderDamageResults(): string {
  let html = '<div class="damage-results">';

  const skills = [
    { key: 'normalAtk', icon: 'hand-fist', name: '일반 공격' },
    { key: 'skill', icon: 'wand-magic-sparkles', name: '스킬' },
    { key: 'ultimate', icon: 'burst', name: '필살기' }
  ];

  skills.forEach(({ key, icon, name }) => {
    const result = dmgCalcState.results[key as keyof typeof dmgCalcState.results];

    html += `
      <div class="damage-card">
        <div class="damage-card-header">
          <i class="fa-solid fa-${icon}"></i>
          <h3>${result?.skillName || name}</h3>
          ${result ? `<span class="skill-level">Lv.${result.skillLevel}</span>` : ''}
        </div>
        ${result ? `
          <div class="damage-summary">
            <div class="damage-value base">
              <div class="label">기본 데미지</div>
              <div class="value">${result.baseDamage.toLocaleString()}</div>
            </div>
            <div class="damage-value crit">
              <div class="label">치명타 데미지</div>
              <div class="value critical">${result.critDamage.toLocaleString()}</div>
            </div>
            <div class="damage-value avg">
              <div class="label">평균 데미지</div>
              <div class="value average">${result.averageDamage.toLocaleString()}</div>
            </div>
          </div>
          <div class="damage-breakdown">
            <h4>상세 분석</h4>
            <div class="breakdown-grid">
              <div class="breakdown-item">
                <span>스킬 배율:</span>
                <span>${result.breakdown.skillMultiplier}%</span>
              </div>
              <div class="breakdown-item">
                <span>공격력:</span>
                <span>${result.breakdown.atk.toLocaleString()}</span>
              </div>
              <div class="breakdown-item">
                <span>치명타 확률:</span>
                <span>${result.breakdown.critRate.toFixed(1)}%</span>
              </div>
              <div class="breakdown-item">
                <span>치명타 피해:</span>
                <span>${result.breakdown.critDamage}%</span>
              </div>
              <div class="breakdown-item">
                <span>원소 강화:</span>
                <span>${result.breakdown.elementalBonus}%</span>
              </div>
              <div class="breakdown-item">
                <span>데미지 증가:</span>
                <span>${result.breakdown.damageBonus}%</span>
              </div>
              <div class="breakdown-item">
                <span>방어 배율:</span>
                <span>×${result.breakdown.defenseMultiplier.toFixed(3)}</span>
              </div>
            </div>
          </div>
        ` : `
          <div class="empty-result">스킬 정보 없음</div>
        `}
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getCharacterName(charId: string): string {
  if (!window.state?.characterNames) return charId;
  return window.state.characterNames[`Character.${charId}.1`] || charId;
}

function getPotentialName(potId: string): string {
  const numId = parseInt(potId, 10);
  if (isNaN(numId)) return potId;

  const potential = window.state?.potentials?.[numId];
  if (!potential) return potId;

  // Get the name key from the potential's Name field
  const nameKey = (potential as any).Name;
  if (!nameKey || !window.state?.potentialNames) return potId;

  return window.state.potentialNames[nameKey] || potId;
}

function getDiscName(discId: number): string {
  if (!window.discsState?.discNames) return discId.toString();
  return window.discsState.discNames[discId] || discId.toString();
}

// =============================================================================
// WINDOW EXPORTS
// =============================================================================

declare global {
  interface Window {
    renderDamageCalculator?: () => void;
    recalculateDamage?: () => void;
    exportDamageCSV?: () => void;
    toggleManualMode?: () => void;
    toggleStatDetails?: (statKey: string) => void;
    toggleStatSource?: (statKey: string, sourceName: string, active: boolean) => void;
    setManualStatAdjustment?: (statKey: string, value: number) => void;
    toggleBuff?: (index: number, active: boolean) => void;
    setEnemyLevel?: (level: number) => void;
    setEnemyDefense?: (defense: number) => void;
    setEnemyResistance?: (resistance: number) => void;
  }
}

window.renderDamageCalculator = renderDamageCalculator;
window.recalculateDamage = () => {
  renderDamageCalculator();
  showSuccess?.('재계산 완료');
};
window.exportDamageCSV = exportToCSV;

window.toggleManualMode = () => {
  dmgCalcState.manualMode = !dmgCalcState.manualMode;
  renderDamageCalculator();
};

window.toggleStatDetails = (statKey: string) => {
  const statItem = document.querySelector(`[data-stat="${statKey}"]`);
  if (!statItem) return;

  const details = statItem.querySelector('.stat-details');
  const icon = statItem.querySelector('.stat-expand-icon');

  if (details && icon) {
    details.classList.toggle('hidden');
    icon.classList.toggle('rotated');
  }
};

window.toggleStatSource = (statKey: string, sourceName: string, active: boolean) => {
  const stat = dmgCalcState.stats.get(statKey);
  if (!stat) return;

  const source = stat.sources.find(s => s.source === sourceName);
  if (source) {
    source.active = active;
    calculateStatTotals();
    calculateAllDamage();
    renderDamageCalculator();
  }
};

window.setManualStatAdjustment = (statKey: string, value: number) => {
  const stat = dmgCalcState.stats.get(statKey);
  if (stat) {
    stat.manualAdjustment = value || 0;
    calculateStatTotals();
    calculateAllDamage();
    renderDamageCalculator();
  }
};

window.toggleBuff = (index: number, active: boolean) => {
  if (dmgCalcState.buffs[index]) {
    dmgCalcState.buffs[index]!.active = active;
    // Buffs would modify stat sources - re-aggregate
    aggregateStatsFromBuild();
    calculateAllDamage();
    renderDamageCalculator();
  }
};

window.setEnemyLevel = (level: number) => {
  dmgCalcState.enemy.level = Math.max(1, Math.min(100, level));
  calculateAllDamage();
  renderDamageCalculator();
};

window.setEnemyDefense = (defense: number) => {
  dmgCalcState.enemy.defense = Math.max(0, defense);
  calculateAllDamage();
  renderDamageCalculator();
};

window.setEnemyResistance = (resistance: number) => {
  dmgCalcState.enemy.resistance = Math.max(-100, Math.min(100, resistance));
  calculateAllDamage();
  renderDamageCalculator();
};

export { renderDamageCalculator, dmgCalcState };
