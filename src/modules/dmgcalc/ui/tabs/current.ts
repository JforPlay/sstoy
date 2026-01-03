/**
 * Damage Calculator - Current Build Tab
 * Displays damage calculations for the current build
 *
 * @module dmgcalc/ui/tabs/current
 */

import { getState } from '../../core/state';
import { getStatsByCategory, formatStatValue } from '../../core/stats';
import { STAT_CATEGORY_LABELS } from '../../constants';

// =============================================================================
// CURRENT TAB RENDERING
// =============================================================================

/**
 * Renders the Current Build tab content
 * This is the main damage calculator view showing:
 * - Skill damage cards (Normal Attack, Skill, Ultimate)
 * - Stat breakdown
 * - Active buffs
 * - Enemy configuration
 */
export function renderCurrentTab(): string {
  const state = getState();

  return `
    <div class="dmgcalc-current-tab">
      ${renderHeader()}
      <div class="dmgcalc-main-content">
        <div class="dmgcalc-left-column">
          ${renderSkillCards()}
          ${renderCharacterContribution()}
        </div>
        <div class="dmgcalc-right-column">
          ${renderConfigurationPanel()}
          ${renderDetailedStatsPanel()}
        </div>
      </div>
      ${renderPlaceholderInfo()}
    </div>
  `;
}

// =============================================================================
// HEADER SECTION
// =============================================================================

function renderHeader(): string {
  return `
    <div class="dmgcalc-header">
      <div class="dmgcalc-header-left">
        <h2>🧮 Damage Calculator</h2>
        <p class="dmgcalc-subtitle">Build-integrated damage analysis</p>
      </div>
      <div class="dmgcalc-header-actions">
        <button class="btn-action" data-action="recalculate">
          <i class="fa-solid fa-rotate"></i> 재계산
        </button>
        <button class="btn-action" data-action="export-csv">
          <i class="fa-solid fa-download"></i> CSV 내보내기
        </button>
      </div>
    </div>
  `;
}

// =============================================================================
// SKILL CARDS SECTION
// =============================================================================

function renderSkillCards(): string {
  const state = getState();

  return `
    <div class="dmgcalc-skill-cards">
      ${state.results.normalAtk ? renderSkillCard('normalAtk', state.results.normalAtk) : ''}
      ${state.results.skill ? renderSkillCard('skill', state.results.skill) : ''}
      ${state.results.ultimate ? renderSkillCard('ultimate', state.results.ultimate) : ''}
    </div>
  `;
}

function renderSkillCard(skillType: string, result: any): string {
  const skillNames: Record<string, string> = {
    normalAtk: '일반 공격',
    skill: '스킬',
    ultimate: '필살기'
  };

  const skillColors: Record<string, string> = {
    normalAtk: '#3b82f6',  // Blue
    skill: '#8b5cf6',      // Purple
    ultimate: '#ec4899'    // Pink
  };

  return `
    <div class="dmgcalc-skill-card" style="border-left-color: ${skillColors[skillType]}">
      <div class="skill-card-header">
        ${result.parameterData?.skillIcon ? `
          <img src="assets/skill_icons/${result.parameterData.skillIcon}.webp"
               alt="${result.skillName}"
               class="skill-icon"
               onerror="this.src='assets/skill_icons/${result.parameterData.skillIcon}.png'"
               loading="eager">
        ` : ''}
        <h3>${result.skillName || skillNames[skillType] || skillType}</h3>
        <span class="skill-level">Lv.${result.skillLevel}</span>
      </div>

      ${result.parameterData?.skillDesc ? `
        <div class="skill-description">
          ${result.parameterData.skillDesc}
        </div>
      ` : ''}

      <div class="skill-card-body">
        <div class="damage-summary">
          <div class="damage-row">
            <span class="damage-label">기본 피해:</span>
            <span class="damage-value">${result.totalBaseDamage.toLocaleString()}</span>
          </div>
          <div class="damage-row">
            <span class="damage-label">크리티컬 피해:</span>
            <span class="damage-value">${result.totalCritDamage.toLocaleString()}</span>
          </div>
          <div class="damage-row highlight">
            <span class="damage-label">평균 피해:</span>
            <span class="damage-value">${result.totalAverageDamage.toLocaleString()}</span>
          </div>
        </div>

        ${result.hitDamages && result.hitDamages.length > 0 ? `
          <div class="hit-damages-section">
            <h4 class="section-title">타격 상세 (${result.hitDamages.length}회)</h4>
            <div class="hit-damages-grid">
              ${result.hitDamages.map((hit: any, index: number) => `
                <div class="hit-card">
                  <div class="hit-card-header">
                    <div class="hit-header-left">
                      ${hit.elementType ? `
                        <img src="assets/icon_common_property_${hit.elementType}.png"
                             alt="Element"
                             class="hit-element-icon"
                             onerror="this.style.display='none'"
                             loading="lazy">
                      ` : ''}
                      <span class="hit-index">Hit ${index + 1}</span>
                    </div>
                    <span class="hit-percent">${hit.skillPercent.toFixed(1)}%</span>
                  </div>
                  <div class="hit-card-body">
                    <div class="hit-stat-row">
                      <span class="hit-stat-label">기본</span>
                      <span class="hit-stat-value">${hit.baseDamage.toLocaleString()}</span>
                    </div>
                    <div class="hit-stat-row">
                      <span class="hit-stat-label">크리</span>
                      <span class="hit-stat-value">${hit.critDamage.toLocaleString()}</span>
                    </div>
                    <div class="hit-stat-row hit-highlight">
                      <span class="hit-stat-label">평균</span>
                      <span class="hit-stat-value">${hit.averageDamage.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${result.breakdown ? renderDamageBreakdown(skillType, result.breakdown) : ''}
      </div>
    </div>
  `;
}

/**
 * Render comprehensive damage breakdown
 * Shows all calculation steps and multipliers
 */
function renderDamageBreakdown(skillType: string, breakdown: any): string {
  const breakdownId = `breakdown-${skillType}`;

  return `
    <div class="breakdown-section">
      <button class="breakdown-toggle" data-breakdown-id="${breakdownId}">
        <i class="fa-solid fa-chevron-right breakdown-toggle-icon"></i>
        <h4 class="section-title">피해 계산 상세</h4>
        <span class="breakdown-toggle-hint">펼치기</span>
      </button>

      <div id="${breakdownId}" class="breakdown-content" style="display: none;">
        <!-- Base Stats -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-chart-simple"></i>
            기본 스탯
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">공격력 (ATK)</span>
              <span class="breakdown-value">${breakdown.atk.toLocaleString()}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">치명타율</span>
              <span class="breakdown-value">${(breakdown.critRate / 100).toFixed(2)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">치명타 피해</span>
              <span class="breakdown-value">${(breakdown.critPower / 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <!-- Skill Multipliers -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            스킬 배율
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">스킬 배율 (%)</span>
              <span class="breakdown-value">${(breakdown.skillPercent / 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">스킬 추가 피해</span>
              <span class="breakdown-value">${breakdown.skillAbs > 0 ? '+' + breakdown.skillAbs.toLocaleString() : breakdown.skillAbs}</span>
            </div>
          </div>
        </div>

        <!-- Damage Multipliers -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-arrow-trend-up"></i>
            피해 증폭
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">스킬 위력 증가</span>
              <span class="breakdown-value">×${breakdown.skillIntensity.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.skillIntensity - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">특성 위력 증가</span>
              <span class="breakdown-value">×${breakdown.perkIntensity.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.perkIntensity - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">유형 피해 증가</span>
              <span class="breakdown-value">×${breakdown.slotDmg.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.slotDmg - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">원소 피해 증가</span>
              <span class="breakdown-value">×${breakdown.elementDmg.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.elementDmg - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">일반 피해 증가</span>
              <span class="breakdown-value">×${breakdown.generalDmg.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.generalDmg - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">피해 추가</span>
              <span class="breakdown-value">${breakdown.dmgPlus > 0 ? '+' + breakdown.dmgPlus.toLocaleString() : breakdown.dmgPlus}</span>
            </div>
          </div>
        </div>

        <!-- Crit Multipliers -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-burst"></i>
            치명타 증폭
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">유형별 치명타 피해</span>
              <span class="breakdown-value">${breakdown.slotCritDmg > 0 ? '+' + (breakdown.slotCritDmg / 100).toFixed(1) : breakdown.slotCritDmg}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">총 치명타 배율</span>
              <span class="breakdown-value">${((breakdown.critPower + breakdown.slotCritDmg) / 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <!-- Enemy Multipliers -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-skull"></i>
            적 저항
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">방어력 감소</span>
              <span class="breakdown-value">×${breakdown.defAmend.toFixed(3)}</span>
              <span class="breakdown-penalty">${((1 - breakdown.defAmend) * 100).toFixed(1)}% 감소</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">저항력 감소</span>
              <span class="breakdown-value">×${breakdown.erAmend.toFixed(3)}</span>
              <span class="breakdown-penalty">${((1 - breakdown.erAmend) * 100).toFixed(1)}% 감소</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">강인도 파괴</span>
              <span class="breakdown-value">×${breakdown.resilienceBreakDmg.toFixed(1)}</span>
              <span class="breakdown-bonus">${breakdown.resilienceBreakDmg > 1 ? '+' + ((breakdown.resilienceBreakDmg - 1) * 100).toFixed(0) + '%' : ''}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">종합 적 배율</span>
              <span class="breakdown-value">×${breakdown.enemyMultiplier.toFixed(3)}</span>
            </div>
          </div>
        </div>

        <!-- Final Multipliers -->
        <div class="breakdown-category">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-star"></i>
            최종 증폭
          </h5>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">최종 피해 증가</span>
              <span class="breakdown-value">×${breakdown.finalDmg.toFixed(3)}</span>
              <span class="breakdown-bonus">${((breakdown.finalDmg - 1) * 100).toFixed(1)}%</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">최종 피해 추가</span>
              <span class="breakdown-value">${breakdown.finalDmgPlus > 0 ? '+' + breakdown.finalDmgPlus.toLocaleString() : breakdown.finalDmgPlus}</span>
            </div>
          </div>
        </div>

        <!-- Calculation Steps -->
        <div class="breakdown-category breakdown-calculation-steps">
          <h5 class="breakdown-category-title">
            <i class="fa-solid fa-calculator"></i>
            계산 과정
          </h5>
          <div class="calculation-steps">
            <div class="calculation-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <div class="step-label">원시 피해 (Raw Damage)</div>
                <div class="step-formula">ATK × 스킬배율 + 스킬추가</div>
                <div class="step-value">${breakdown.rawDamage.toLocaleString()}</div>
              </div>
            </div>

            <div class="calculation-arrow">
              <i class="fa-solid fa-arrow-down"></i>
            </div>

            <div class="calculation-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <div class="step-label">증폭된 피해 (Amplified Damage)</div>
                <div class="step-formula">원시 × (스킬위력 × 특성위력 × 유형피해 × 원소피해 × 일반피해) + 피해추가</div>
                <div class="step-value">${breakdown.amplifiedDamage.toLocaleString()}</div>
              </div>
            </div>

            <div class="calculation-arrow">
              <i class="fa-solid fa-arrow-down"></i>
            </div>

            <div class="calculation-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <div class="step-label">적 저항 적용 (Enemy Reduction)</div>
                <div class="step-formula">증폭 × (방어력감소 × 저항력감소 × 강인도파괴)</div>
                <div class="step-result">= 증폭 × ${breakdown.enemyMultiplier.toFixed(3)}</div>
              </div>
            </div>

            <div class="calculation-arrow">
              <i class="fa-solid fa-arrow-down"></i>
            </div>

            <div class="calculation-step calculation-step-final">
              <div class="step-number">4</div>
              <div class="step-content">
                <div class="step-label">최종 피해 (Final Damage)</div>
                <div class="step-formula">(적용 × 최종피해증가) + 최종피해추가</div>
                <div class="step-value step-value-final">
                  <span class="final-label">기본:</span>
                  <span class="final-number">${Math.floor(breakdown.amplifiedDamage * breakdown.enemyMultiplier * breakdown.finalDmg + breakdown.finalDmgPlus).toLocaleString()}</span>
                </div>
                <div class="step-value step-value-final">
                  <span class="final-label">치명타:</span>
                  <span class="final-number">${Math.floor(breakdown.amplifiedDamage * breakdown.enemyMultiplier * breakdown.finalDmg * ((breakdown.critPower + breakdown.slotCritDmg) / 10000) + breakdown.finalDmgPlus).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// CHARACTER CONTRIBUTION BREAKDOWN
// =============================================================================

/**
 * Calculate and render character contribution breakdown
 * Shows how much each party member (master, assist1, assist2) contributes to stats
 */
function renderCharacterContribution(): string {
  const state = getState();

  // Calculate contributions from each character
  const contributions = calculateCharacterContributions();

  // Check if we have any support characters
  const hasSupports = contributions.assist1.totalValue > 0 || contributions.assist2.totalValue > 0;

  if (!hasSupports) {
    // Don't show the section if there are no support characters
    return '';
  }

  return `
    <div class="dmgcalc-character-contribution">
      <div class="contribution-header">
        <h3 class="contribution-title">
          <i class="fa-solid fa-users"></i>
          파티 기여도
        </h3>
        <p class="contribution-subtitle">각 캐릭터의 스탯 기여도</p>
      </div>

      <div class="contribution-cards">
        ${renderContributionCard('master', contributions.master, contributions.totalValue)}
        ${contributions.assist1.totalValue > 0 ? renderContributionCard('assist1', contributions.assist1, contributions.totalValue) : ''}
        ${contributions.assist2.totalValue > 0 ? renderContributionCard('assist2', contributions.assist2, contributions.totalValue) : ''}
      </div>

      ${hasSupports ? renderContributionDetails(contributions) : ''}
    </div>
  `;
}

/**
 * Calculate total stat contributions from each character
 */
interface CharacterContribution {
  character: string;
  characterName: string;
  totalValue: number;
  percentage: number;
  statBreakdown: { statKey: string; statName: string; value: number }[];
}

function calculateCharacterContributions(): {
  master: CharacterContribution;
  assist1: CharacterContribution;
  assist2: CharacterContribution;
  totalValue: number;
} {
  const state = getState();

  const masterContrib: CharacterContribution = {
    character: 'master',
    characterName: getCharacterName('master'),
    totalValue: 0,
    percentage: 0,
    statBreakdown: []
  };

  const assist1Contrib: CharacterContribution = {
    character: 'assist1',
    characterName: getCharacterName('assist1'),
    totalValue: 0,
    percentage: 0,
    statBreakdown: []
  };

  const assist2Contrib: CharacterContribution = {
    character: 'assist2',
    characterName: getCharacterName('assist2'),
    totalValue: 0,
    percentage: 0,
    statBreakdown: []
  };

  const statBreakdown = {
    master: new Map<string, number>(),
    assist1: new Map<string, number>(),
    assist2: new Map<string, number>()
  };

  // Aggregate contributions from all stats
  state.stats.forEach((stat, statKey) => {
    stat.sources.forEach(source => {
      if (source.character) {
        const pos = source.character;
        const currentValue = statBreakdown[pos].get(statKey) || 0;
        statBreakdown[pos].set(statKey, currentValue + source.value);

        if (pos === 'master') masterContrib.totalValue += source.value;
        if (pos === 'assist1') assist1Contrib.totalValue += source.value;
        if (pos === 'assist2') assist2Contrib.totalValue += source.value;
      }
    });
  });

  const totalValue = masterContrib.totalValue + assist1Contrib.totalValue + assist2Contrib.totalValue;

  // Calculate percentages
  if (totalValue > 0) {
    masterContrib.percentage = (masterContrib.totalValue / totalValue) * 100;
    assist1Contrib.percentage = (assist1Contrib.totalValue / totalValue) * 100;
    assist2Contrib.percentage = (assist2Contrib.totalValue / totalValue) * 100;
  }

  // Build stat breakdown arrays
  masterContrib.statBreakdown = Array.from(statBreakdown.master.entries())
    .map(([statKey, value]) => ({
      statKey,
      statName: state.stats.get(statKey)?.name || statKey,
      value
    }))
    .filter(s => s.value > 0);

  assist1Contrib.statBreakdown = Array.from(statBreakdown.assist1.entries())
    .map(([statKey, value]) => ({
      statKey,
      statName: state.stats.get(statKey)?.name || statKey,
      value
    }))
    .filter(s => s.value > 0);

  assist2Contrib.statBreakdown = Array.from(statBreakdown.assist2.entries())
    .map(([statKey, value]) => ({
      statKey,
      statName: state.stats.get(statKey)?.name || statKey,
      value
    }))
    .filter(s => s.value > 0);

  return {
    master: masterContrib,
    assist1: assist1Contrib,
    assist2: assist2Contrib,
    totalValue
  };
}

/**
 * Render a single character contribution card
 */
function renderContributionCard(
  position: 'master' | 'assist1' | 'assist2',
  contrib: CharacterContribution,
  totalValue: number
): string {
  const positionLabels = {
    master: '주력',
    assist1: '지원 1',
    assist2: '지원 2'
  };

  const positionColors = {
    master: '#3b82f6',   // Blue
    assist1: '#10b981',  // Green
    assist2: '#8b5cf6'   // Purple
  };

  const percentage = contrib.percentage.toFixed(1);
  const barWidth = Math.min(contrib.percentage, 100);

  return `
    <div class="contribution-card" data-position="${position}">
      <div class="contribution-card-header">
        <div class="contribution-char-info">
          <span class="contribution-position" style="color: ${positionColors[position]}">
            ${positionLabels[position]}
          </span>
          <span class="contribution-char-name">${contrib.characterName}</span>
        </div>
        <span class="contribution-percentage" style="color: ${positionColors[position]}">
          ${percentage}%
        </span>
      </div>
      <div class="contribution-bar-container">
        <div class="contribution-bar" style="width: ${barWidth}%; background-color: ${positionColors[position]}"></div>
      </div>
      <div class="contribution-stats-summary">
        <span class="contribution-stat-count">${contrib.statBreakdown.length}개 스탯 제공</span>
      </div>
    </div>
  `;
}

/**
 * Render detailed contribution breakdown
 */
function renderContributionDetails(contributions: any): string {
  const supportContribs = [
    contributions.assist1.totalValue > 0 ? contributions.assist1 : null,
    contributions.assist2.totalValue > 0 ? contributions.assist2 : null
  ].filter(Boolean);

  if (supportContribs.length === 0) {
    return '';
  }

  return `
    <div class="contribution-details">
      <div class="contribution-details-header" data-action="toggle-contribution-details">
        <i class="fa-solid fa-chevron-right details-chevron"></i>
        <span>지원 캐릭터 상세 (클릭하여 펼치기)</span>
      </div>
      <div class="contribution-details-body" style="display: none;">
        ${supportContribs.map(contrib => `
          <div class="contribution-detail-section">
            <h4 class="contribution-detail-title">
              ${contrib.character === 'assist1' ? '지원 1' : '지원 2'}: ${contrib.characterName}
            </h4>
            <div class="contribution-detail-stats">
              ${contrib.statBreakdown.slice(0, 5).map((stat: any) => `
                <div class="contribution-stat-item">
                  <span class="contribution-stat-name">${stat.statName}</span>
                  <span class="contribution-stat-value">+${formatStatValue(stat.statKey, stat.value)}</span>
                </div>
              `).join('')}
              ${contrib.statBreakdown.length > 5 ? `
                <div class="contribution-stat-item more-stats">
                  <span class="contribution-stat-name">...그 외 ${contrib.statBreakdown.length - 5}개</span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Get character name for a position
 */
function getCharacterName(position: 'master' | 'assist1' | 'assist2'): string {
  const character = window.state?.party?.[position];

  if (!character || typeof character === 'string') {
    return position === 'master' ? '주력 캐릭터' :
           position === 'assist1' ? '지원 캐릭터 1' :
           '지원 캐릭터 2';
  }

  const charId = (character as any).id;

  // Try to get name from window.state.characterNames
  if (window.state?.characterNames?.[charId]) {
    return window.state.characterNames[charId];
  }

  // Fallback to character ID
  return `캐릭터 ${charId}`;
}

// =============================================================================
// CONFIGURATION PANEL
// =============================================================================

/**
 * Render configuration panel with buff toggles and enemy settings
 */
function renderConfigurationPanel(): string {
  const state = getState();

  return `
    <div class="dmgcalc-panel config-panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <i class="fa-solid fa-sliders"></i>
          설정
        </h3>
      </div>
      <div class="panel-body">
        ${renderEnemyConfiguration()}
        ${renderBuffToggles()}
      </div>
    </div>
  `;
}

/**
 * Render enemy configuration inputs
 */
function renderEnemyConfiguration(): string {
  const state = getState();
  const { level, defense, resistance, toughness } = state.enemy;
  const isToughnessBroken = toughness === 0;

  return `
    <div class="config-section">
      <h4 class="config-section-title">
        <i class="fa-solid fa-skull"></i>
        적 설정
      </h4>
      <div class="config-inputs">
        <div class="config-input-group">
          <label class="config-label" for="enemy-level">레벨</label>
          <input
            type="number"
            id="enemy-level"
            class="config-input enemy-level-input"
            value="${level}"
            min="1"
            max="100"
            data-enemy-prop="level"
          />
        </div>
        <div class="config-input-group">
          <label class="config-label" for="enemy-defense">방어력 (DEF)</label>
          <input
            type="number"
            id="enemy-defense"
            class="config-input enemy-defense-input"
            value="${defense}"
            min="0"
            max="5000"
            step="10"
            data-enemy-prop="defense"
          />
          <small class="config-hint">기본: 500 (50% 감소)</small>
        </div>
        <div class="config-input-group">
          <label class="config-label" for="enemy-resistance">속성 저항 (RES)</label>
          <input
            type="number"
            id="enemy-resistance"
            class="config-input enemy-resistance-input"
            value="${resistance}"
            min="-500"
            max="2500"
            step="50"
            data-enemy-prop="resistance"
          />
          <small class="config-hint">기본: 750 (60% 감소)</small>
        </div>
        <div class="config-input-group config-checkbox-group">
          <label class="config-checkbox-label">
            <input
              type="checkbox"
              id="enemy-toughness-broken"
              class="config-checkbox enemy-toughness-checkbox"
              ${isToughnessBroken ? 'checked' : ''}
              data-config="enemy-toughness-broken"
            />
            <span>강인도 파괴 (150% 피해)</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render buff toggles
 * Shows buffs collected from all characters' potentials
 */
function renderBuffToggles(): string {
  const state = getState();

  if (!state.buffs || state.buffs.length === 0) {
    return `
      <div class="config-section">
        <h4 class="config-section-title">
          <i class="fa-solid fa-sparkles"></i>
          버프
        </h4>
        <div class="buff-toggles-empty">
          <p class="placeholder-text">
            버프 없음 - 잠재력을 선택하세요
          </p>
        </div>
      </div>
    `;
  }

  // Group buffs by character
  const buffsByChar: Record<string, typeof state.buffs> = {
    master: [],
    assist1: [],
    assist2: []
  };

  state.buffs.forEach(buff => {
    const char = buff.character || 'master';
    if (buffsByChar[char]) {
      buffsByChar[char].push(buff);
    }
  });

  return `
    <div class="config-section">
      <h4 class="config-section-title">
        <i class="fa-solid fa-sparkles"></i>
        버프 (${state.buffs.length})
      </h4>
      <div class="buff-toggles">
        ${renderBuffGroup(buffsByChar.master || [], '주력')}
        ${(buffsByChar.assist1 && buffsByChar.assist1.length > 0) ? renderBuffGroup(buffsByChar.assist1, '지원1') : ''}
        ${(buffsByChar.assist2 && buffsByChar.assist2.length > 0) ? renderBuffGroup(buffsByChar.assist2, '지원2') : ''}
      </div>
    </div>
  `;
}

/**
 * Render a group of buffs for a character
 */
function renderBuffGroup(buffs: any[], label: string): string {
  if (buffs.length === 0) return '';

  const state = getState();

  return `
    <div class="buff-group">
      <div class="buff-group-label">${label}</div>
      ${buffs.map((buff, index) => `
        <label class="buff-toggle-item">
          <input
            type="checkbox"
            class="buff-checkbox"
            data-buff-index="${state.buffs.indexOf(buff)}"
            ${buff.active ? 'checked' : ''}
          />
          <span class="buff-name">${buff.name}</span>
          ${buff.description ? `<span class="buff-desc">${buff.description}</span>` : ''}
        </label>
      `).join('')}
    </div>
  `;
}

// =============================================================================
// DETAILED STATS PANEL
// =============================================================================

/**
 * Render detailed stats panel with category grouping
 */
function renderDetailedStatsPanel(): string {
  const statsByCategory = getStatsByCategory();

  // Filter damage-related categories
  const relevantCategories = (['core', 'offense', 'elemental', 'special'] as const)
    .filter(category => {
      const categoryStats = statsByCategory.get(category);
      return categoryStats && categoryStats.size > 0;
    });

  if (relevantCategories.length === 0) {
    return '';
  }

  return `
    <div class="dmgcalc-panel stats-panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <i class="fa-solid fa-chart-bar"></i>
          스탯 상세
        </h3>
      </div>
      <div class="panel-body">
        ${relevantCategories.map(category => {
          const stats = statsByCategory.get(category);
          if (!stats) return '';

          const categoryLabel = STAT_CATEGORY_LABELS[category] || category;
          const translatedLabel = window.i18n?.t(categoryLabel) || categoryLabel;

          return `
            <div class="stats-category-section">
              <div class="stats-category-header" data-action="toggle-category" data-category="${category}">
                <i class="fa-solid fa-chevron-down category-chevron"></i>
                <span class="category-name">${translatedLabel}</span>
                <span class="category-count">(${stats.size})</span>
              </div>
              <div class="stats-category-body" data-category-body="${category}">
                ${Array.from(stats.entries()).map(([statKey, stat]) => {
                  const formattedValue = formatStatValue(statKey, stat.total);
                  return `
                    <div class="stat-row" data-action="toggle-stat-sources" data-stat="${statKey}">
                      <div class="stat-row-header">
                        <span class="stat-name">${stat.name}</span>
                        <span class="stat-value">${formattedValue}</span>
                        <i class="fa-solid fa-chevron-right stat-chevron"></i>
                      </div>
                      <div class="stat-row-sources" data-stat-sources="${statKey}" style="display: none;">
                        ${renderStatSourcesCompact(statKey, stat)}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Render compact stat sources for detailed panel
 */
function renderStatSourcesCompact(statKey: string, stat: any): string {
  if (!stat.sources || stat.sources.length === 0) {
    return '<p class="no-sources">소스 없음</p>';
  }

  // Group sources by type
  const charSources = stat.sources.filter((s: any) => s.source.includes('캐릭터'));
  const mainDiscSources = stat.sources.filter((s: any) => s.source.includes('메인 레코드'));
  const subDiscSources = stat.sources.filter((s: any) => s.source.includes('서브 레코드'));
  const potSources = stat.sources.filter((s: any) => s.source.includes('잠재력'));
  const buffSources = stat.sources.filter((s: any) => s.source.includes('버프'));

  return `
    <div class="stat-sources-compact">
      ${charSources.length > 0 ? `
        <div class="source-row">
          <span class="source-type">캐릭터:</span>
          <span class="source-values">
            ${charSources.map((s: any) => formatStatValue(statKey, s.value)).join(', ')}
          </span>
        </div>
      ` : ''}
      ${mainDiscSources.length > 0 ? `
        <div class="source-row">
          <span class="source-type">메인 레코드:</span>
          <span class="source-values">
            ${formatStatValue(statKey, mainDiscSources.reduce((sum: number, s: any) => sum + s.value, 0))}
          </span>
        </div>
      ` : ''}
      ${subDiscSources.length > 0 ? `
        <div class="source-row">
          <span class="source-type">서브 레코드:</span>
          <span class="source-values">
            ${formatStatValue(statKey, subDiscSources.reduce((sum: number, s: any) => sum + s.value, 0))}
          </span>
        </div>
      ` : ''}
      ${potSources.length > 0 ? `
        <div class="source-row">
          <span class="source-type">잠재력:</span>
          <span class="source-values">
            ${potSources.map((s: any) => formatStatValue(statKey, s.value)).join(', ')}
          </span>
        </div>
      ` : ''}
      ${buffSources.length > 0 ? `
        <div class="source-row">
          <span class="source-type">버프:</span>
          <span class="source-values">
            ${buffSources.map((s: any) => formatStatValue(statKey, s.value)).join(', ')}
          </span>
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================================================
// STAT SOURCES DISPLAY
// =============================================================================

/**
 * Render detailed stat sources breakdown
 * Groups stats by category and shows all sources (character, discs, potentials, buffs)
 */
function renderStatSources(): string {
  const statsByCategory = getStatsByCategory();

  // Filter out empty categories and defense/other (not relevant for damage calc)
  const relevantCategories = (['core', 'offense', 'elemental', 'special'] as const)
    .filter(category => {
      const categoryStats = statsByCategory.get(category);
      return categoryStats && categoryStats.size > 0;
    });

  if (relevantCategories.length === 0) {
    return '';
  }

  return `
    <div class="stat-sources-section">
      <h5 class="stat-sources-title">📋 스탯 상세 내역</h5>
      ${relevantCategories.map(category => {
        const stats = statsByCategory.get(category);
        if (!stats) return '';

        const categoryLabel = STAT_CATEGORY_LABELS[category] || category;
        const translatedLabel = window.i18n?.t(categoryLabel) || categoryLabel;

        return `
          <div class="stat-category-group">
            <div class="stat-category-header">${translatedLabel}</div>
            <div class="stat-list">
              ${Array.from(stats.entries()).map(([statKey, stat]) => {
                const totalValue = stat.total;
                const formattedValue = formatStatValue(statKey, totalValue);

                // Group sources by type
                const charSources = stat.sources.filter((s: any) => s.source.includes('캐릭터'));
                const mainDiscSources = stat.sources.filter((s: any) => s.source.includes('메인 레코드'));
                const subDiscSources = stat.sources.filter((s: any) => s.source.includes('서브 레코드'));
                const potSources = stat.sources.filter((s: any) => s.source.includes('잠재력'));
                const buffSources = stat.sources.filter((s: any) => s.source.includes('버프'));

                return `
                  <div class="stat-item-detailed">
                    <div class="stat-item-header">
                      <span class="stat-item-name">${stat.name}</span>
                      <span class="stat-item-value">${formattedValue}</span>
                    </div>
                    ${stat.sources.length > 0 ? `
                      <div class="stat-item-sources">
                        ${charSources.length > 0 ? `
                          <div class="source-group">
                            <span class="source-group-label">캐릭터:</span>
                            ${charSources.map((s: any) => {
                              const sourceValue = formatStatValue(statKey, s.value);
                              return `<span class="source-item char-source">${sourceValue}</span>`;
                            }).join(' ')}
                          </div>
                        ` : ''}
                        ${mainDiscSources.length > 0 ? `
                          <div class="source-group">
                            <span class="source-group-label">메인 레코드:</span>
                            <span class="source-item disc-source">
                              ${formatStatValue(statKey, mainDiscSources.reduce((sum: number, s: any) => sum + s.value, 0))}
                            </span>
                          </div>
                        ` : ''}
                        ${subDiscSources.length > 0 ? `
                          <div class="source-group">
                            <span class="source-group-label">서브 레코드:</span>
                            <span class="source-item disc-source">
                              ${formatStatValue(statKey, subDiscSources.reduce((sum: number, s: any) => sum + s.value, 0))}
                            </span>
                          </div>
                        ` : ''}
                        ${potSources.length > 0 ? `
                          <div class="source-group">
                            <span class="source-group-label">잠재력:</span>
                            ${potSources.map((s: any) => {
                              const sourceValue = formatStatValue(statKey, s.value);
                              return `<span class="source-item pot-source">${sourceValue}</span>`;
                            }).join(' ')}
                          </div>
                        ` : ''}
                        ${buffSources.length > 0 ? `
                          <div class="source-group">
                            <span class="source-group-label">버프:</span>
                            ${buffSources.map((s: any) => {
                              const sourceValue = formatStatValue(statKey, s.value);
                              return `<span class="source-item buff-source">${sourceValue}</span>`;
                            }).join(' ')}
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// =============================================================================
// PLACEHOLDER INFO (Temporary)
// =============================================================================

function renderPlaceholderInfo(): string {
  const state = getState();

  return `
    <div class="dmgcalc-placeholder-info">
      <div class="info-card">
        <h4>📊 Status</h4>
        <p><strong>Core refactoring:</strong> ✅ Complete</p>
        <p><strong>Enum-based stats:</strong> ✅ Complete</p>
        <p><strong>Stats aggregated:</strong> ${state.stats.size}</p>
        <p><strong>Skills calculated:</strong> ${Object.keys(state.results).length}</p>
      </div>

      <div class="info-card">
        <h4>🎯 Next Steps</h4>
        <ul>
          <li>✅ Tab navigation structure</li>
          <li>✅ Enum-based stat system (Req #4)</li>
          <li>⏳ Full party potentials (Req #1)</li>
          <li>⏳ Buff management UI</li>
          <li>⏳ Enemy configuration UI</li>
          <li>⏳ Limit Break graph (Req #2)</li>
          <li>⏳ Build comparison (Req #3)</li>
        </ul>
      </div>
    </div>
  `;
}
