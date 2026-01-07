/**
 * Damage Calculator - Manual Input Tab
 * Shows complete breakdown of all stats/buffs affecting damage formula
 * Allows manual overrides of calculated values
 *
 * @module dmgcalc/ui/tabs/manual
 */

import { getState } from '../../core/state';
import { formatStatValue, getStatDisplayName } from '../../core/stats';
import { STAT_CATEGORIES, STAT_CATEGORY_LABELS, DAMAGE_TYPE_TO_BONUS_STAT, DAMAGE_TYPE_TO_CRIT_STAT } from '../../constants';

// =============================================================================
// MANUAL TAB RENDERING
// =============================================================================

/**
 * Renders the Manual Input tab content
 * Shows complete breakdown of all stats and buffs grouped by source
 */
export function renderManualTab(): string {
    const state = getState();

    return `
    <div class="dmgcalc-manual-tab">
      ${renderManualHeader()}
      <div class="manual-tab-content">
        <div class="manual-tab-left">
          ${renderStatsBreakdown()}
          ${renderDamageMultiplierBreakdown()}
        </div>
        <div class="manual-tab-right">
          ${renderBuffsBreakdown()}
          ${renderFormulaReference()}
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// HEADER SECTION
// =============================================================================

function renderManualHeader(): string {
    return `
    <div class="manual-header">
      <div class="manual-header-left">
        <h2>
          <i class="fa-solid fa-sliders"></i>
          스탯 전체 분석
        </h2>
        <p class="manual-subtitle">모든 스탯과 버프의 상세 분석</p>
      </div>
      <div class="manual-header-actions">
        <button class="btn-action" data-action="export-stats">
          <i class="fa-solid fa-download"></i> 내보내기
        </button>
      </div>
    </div>
  `;
}

// =============================================================================
// STATS BREAKDOWN
// =============================================================================

function renderStatsBreakdown(): string {
    const state = getState();

    // Get all categories with their stats
    const categories = Object.entries(STAT_CATEGORIES);

    return `
    <div class="manual-section stats-breakdown-section">
      <div class="section-header">
        <h3>
          <i class="fa-solid fa-chart-bar"></i>
          스탯 상세 분석
        </h3>
        <span class="section-count">${state.stats.size}개 스탯</span>
      </div>
      <div class="section-body">
        ${categories.map(([categoryKey, statKeys]) => renderStatCategory(categoryKey, [...statKeys])).join('')}
      </div>
    </div>
  `;
}

function renderStatCategory(categoryKey: string, statKeys: string[]): string {
    const state = getState();
    const categoryLabel = STAT_CATEGORY_LABELS[categoryKey] || categoryKey;
    const translatedLabel = window.i18n?.t(categoryLabel) || categoryKey;

    // Filter to only stats that have values
    const statsWithValues = statKeys.filter(key => {
        const stat = state.stats.get(key);
        return stat && (stat.total !== 0 || stat.sources.length > 0);
    });

    if (statsWithValues.length === 0) {
        return '';
    }

    return `
    <div class="manual-category">
      <div class="manual-category-header">
        <span class="category-label">${translatedLabel}</span>
        <span class="category-stat-count">${statsWithValues.length}개</span>
      </div>
      <div class="manual-category-stats">
        ${statsWithValues.map(statKey => renderStatDetail(statKey)).join('')}
      </div>
    </div>
  `;
}

function renderStatDetail(statKey: string): string {
    const state = getState();
    const stat = state.stats.get(statKey);

    if (!stat) return '';

    const formattedTotal = formatStatValue(statKey, stat.total);
    const displayName = stat.name || getStatDisplayName(statKey);

    // Group sources by type
    const sourceGroups = groupSourcesByType(stat.sources);

    return `
    <div class="manual-stat-item">
      <div class="manual-stat-header">
        <span class="stat-key">${statKey}</span>
        <span class="stat-display-name">${displayName}</span>
        <span class="stat-total-value">${formattedTotal}</span>
      </div>
      ${stat.sources.length > 0 ? `
        <div class="manual-stat-sources">
          ${renderSourceGroups(statKey, sourceGroups)}
        </div>
      ` : '<div class="no-sources-text">기본값</div>'}
    </div>
  `;
}

type SourceGroups = {
    character: any[];
    mainDisc: any[];
    subDisc: any[];
    potential: any[];
    talent: any[];
    buff: any[];
    other: any[];
};

function groupSourcesByType(sources: any[]): SourceGroups {
    const groups: SourceGroups = {
        character: [],
        mainDisc: [],
        subDisc: [],
        potential: [],
        talent: [],
        buff: [],
        other: []
    };

    sources.forEach(source => {
        const sourceName = source.source.toLowerCase();
        if (sourceName.includes('캐릭터') || sourceName.includes('character')) {
            groups.character.push(source);
        } else if (sourceName.includes('메인') || sourceName.includes('main disc')) {
            groups.mainDisc.push(source);
        } else if (sourceName.includes('서브') || sourceName.includes('sub disc')) {
            groups.subDisc.push(source);
        } else if (sourceName.includes('잠재력') || sourceName.includes('potential')) {
            groups.potential.push(source);
        } else if (sourceName.includes('재능') || sourceName.includes('talent') || sourceName.includes('한계돌파')) {
            groups.talent.push(source);
        } else if (sourceName.includes('버프') || sourceName.includes('buff')) {
            groups.buff.push(source);
        } else {
            groups.other.push(source);
        }
    });

    return groups;
}

function renderSourceGroups(statKey: string, groups: SourceGroups): string {
    const groupLabels: Record<string, { label: string; color: string; icon: string }> = {
        character: { label: '캐릭터 기본', color: '#3b82f6', icon: 'fa-user' },
        mainDisc: { label: '메인 레코드', color: '#8b5cf6', icon: 'fa-compact-disc' },
        subDisc: { label: '서브 레코드', color: '#a855f7', icon: 'fa-compact-disc' },
        potential: { label: '잠재력', color: '#ec4899', icon: 'fa-sparkles' },
        talent: { label: '한계돌파 재능', color: '#f97316', icon: 'fa-arrow-trend-up' },
        buff: { label: '버프', color: '#10b981', icon: 'fa-magic' },
        other: { label: '기타', color: '#6b7280', icon: 'fa-question' }
    };

    const defaultLabel = { label: '기타', color: '#6b7280', icon: 'fa-question' };

    return Object.entries(groups)
        .filter(([, sources]) => sources.length > 0)
        .map(([groupKey, sources]) => {
            const { label, color, icon } = groupLabels[groupKey] ?? defaultLabel;
            const totalValue = sources.reduce((sum, s) => sum + s.value, 0);

            return `
        <div class="source-group-item" style="--source-color: ${color}">
          <div class="source-group-header">
            <i class="fa-solid ${icon}" style="color: ${color}"></i>
            <span class="source-group-label">${label}</span>
            <span class="source-group-total">${formatStatValue(statKey, totalValue)}</span>
          </div>
          ${sources.length > 1 ? `
            <div class="source-group-details">
              ${sources.map(s => `
                <div class="source-detail-row">
                  <span class="source-detail-name">${s.source}</span>
                  <span class="source-detail-value">${formatStatValue(statKey, s.value)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
        }).join('');
}

// =============================================================================
// DAMAGE MULTIPLIER BREAKDOWN
// =============================================================================

function renderDamageMultiplierBreakdown(): string {
    const state = getState();

    // Get damage type specific stats
    const damageTypeStats = Object.entries(DAMAGE_TYPE_TO_BONUS_STAT).map(([type, statKey]) => {
        const typeNum = parseInt(type);
        const critStatKey = DAMAGE_TYPE_TO_CRIT_STAT[typeNum];
        return {
            type: typeNum,
            bonusKey: statKey,
            critKey: critStatKey || null,
            bonusValue: state.stats.get(statKey)?.total || 0,
            critValue: critStatKey ? state.stats.get(critStatKey)?.total || 0 : 0
        };
    });

    const damageTypeNames: Record<number, string> = {
        1: '일반 공격',
        2: '스킬',
        3: '필살기',
        4: '기타',
        5: '마크',
        6: '투사체',
        7: '소환수'
    };

    return `
    <div class="manual-section multiplier-breakdown-section">
      <div class="section-header">
        <h3>
          <i class="fa-solid fa-arrow-trend-up"></i>
          피해 유형별 보너스
        </h3>
      </div>
      <div class="section-body">
        <div class="damage-type-grid">
          ${damageTypeStats.filter(d => d.bonusValue !== 0 || d.critValue !== 0).map(d => `
            <div class="damage-type-card">
              <div class="damage-type-header">
                <span class="damage-type-name">${damageTypeNames[d.type] || `유형 ${d.type}`}</span>
              </div>
              <div class="damage-type-stats">
                <div class="damage-type-stat">
                  <span class="stat-label">피해 증가</span>
                  <span class="stat-value">${d.bonusValue > 0 ? '+' : ''}${(d.bonusValue / 100).toFixed(1)}%</span>
                </div>
                ${d.critValue !== 0 ? `
                  <div class="damage-type-stat">
                    <span class="stat-label">치명타 피해</span>
                    <span class="stat-value">${d.critValue > 0 ? '+' : ''}${(d.critValue / 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('') || '<p class="no-data">피해 유형 보너스 없음</p>'}
        </div>

        <div class="general-multipliers">
          <h4>일반 피해 배율</h4>
          <div class="multiplier-grid">
            ${renderMultiplierItem('GENDMG', '가하는 피해')}
            ${renderMultiplierItem('DMGPLUS', '피해 추가')}
            ${renderMultiplierItem('FINALDMG', '최종 피해')}
            ${renderMultiplierItem('FINALDMGPLUS', '최종 피해 추가')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMultiplierItem(statKey: string, label: string): string {
    const state = getState();
    const stat = state.stats.get(statKey);
    const value = stat?.total || 0;

    // Different formatting for flat vs percentage stats
    const isFlat = statKey.includes('PLUS');
    const formattedValue = isFlat
        ? (value > 0 ? '+' : '') + value.toLocaleString()
        : (value > 0 ? '+' : '') + (value / 100).toFixed(1) + '%';

    return `
    <div class="multiplier-item ${value !== 0 ? 'has-value' : ''}">
      <span class="multiplier-label">${label}</span>
      <span class="multiplier-key">${statKey}</span>
      <span class="multiplier-value">${formattedValue}</span>
    </div>
  `;
}

// =============================================================================
// BUFFS BREAKDOWN
// =============================================================================

function renderBuffsBreakdown(): string {
    const state = getState();

    if (state.buffs.length === 0) {
        return `
      <div class="manual-section buffs-breakdown-section">
        <div class="section-header">
          <h3>
            <i class="fa-solid fa-sparkles"></i>
            활성 버프
          </h3>
          <span class="section-count">0개</span>
        </div>
        <div class="section-body">
          <div class="no-buffs-message">
            <i class="fa-solid fa-info-circle"></i>
            <p>활성화된 버프가 없습니다.</p>
            <p class="hint">잠재력을 선택하면 버프가 표시됩니다.</p>
          </div>
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

    const positionLabels: Record<string, string> = {
        master: '주력',
        assist1: '지원 1',
        assist2: '지원 2'
    };

    const positionColors: Record<string, string> = {
        master: '#3b82f6',
        assist1: '#10b981',
        assist2: '#8b5cf6'
    };

    return `
    <div class="manual-section buffs-breakdown-section">
      <div class="section-header">
        <h3>
          <i class="fa-solid fa-sparkles"></i>
          활성 버프
        </h3>
        <span class="section-count">${state.buffs.length}개</span>
      </div>
      <div class="section-body">
        ${Object.entries(buffsByChar)
            .filter(([, buffs]) => buffs.length > 0)
            .map(([position, buffs]) => `
            <div class="buff-character-group">
              <div class="buff-character-header" style="border-left-color: ${positionColors[position]}">
                <span class="character-position">${positionLabels[position]}</span>
                <span class="buff-count">${buffs.length}개 버프</span>
              </div>
              <div class="buff-list-detailed">
                ${buffs.map(buff => renderBuffDetail(buff)).join('')}
              </div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

function renderBuffDetail(buff: any): string {
    const valueEntries = Object.entries(buff.values).filter(([, v]) => v !== 0);

    return `
    <div class="buff-detail-card ${buff.active ? 'active' : 'inactive'}">
      <div class="buff-detail-header">
        <label class="buff-toggle-label">
          <input
            type="checkbox"
            class="buff-checkbox"
            data-buff-index="${buff.id}"
            ${buff.active ? 'checked' : ''}
          />
          <span class="buff-name">${buff.name}</span>
        </label>
        <span class="buff-category">${buff.category}</span>
      </div>
      ${buff.description ? `<div class="buff-description">${buff.description}</div>` : ''}
      ${valueEntries.length > 0 ? `
        <div class="buff-values-list">
          ${valueEntries.map(([key, value]) => `
            <div class="buff-value-item">
              <span class="buff-value-stat">${key}</span>
              <span class="buff-value-amount">${typeof value === 'number' ? formatStatValue(key, value) : value}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================================================
// FORMULA REFERENCE
// =============================================================================

function renderFormulaReference(): string {
    return `
    <div class="manual-section formula-reference-section">
      <div class="section-header">
        <h3>
          <i class="fa-solid fa-book"></i>
          피해 공식 참조
        </h3>
      </div>
      <div class="section-body">
        <div class="formula-box">
          <h4>기본 피해 공식</h4>
          <div class="formula-text">
            <code>Damage = ((RawDmg × SlotDmg × ElementDmg × GenDmg) + DmgPlus) × EnemyMult × FinalDmg + FinalDmgPlus</code>
          </div>
        </div>

        <div class="formula-terms">
          <h4>용어 설명</h4>
          <div class="term-list">
            <div class="term-item">
              <span class="term-name">RawDmg</span>
              <span class="term-desc">ATK × (스킬배율/100) + 스킬고정피해</span>
            </div>
            <div class="term-item">
              <span class="term-name">SlotDmg</span>
              <span class="term-desc">유형별 피해 증가 (NORMALDMG, SKILLDMG, etc.)</span>
            </div>
            <div class="term-item">
              <span class="term-name">ElementDmg</span>
              <span class="term-desc">속성 효율 (WEE, FEE, SEE, etc.)</span>
            </div>
            <div class="term-item">
              <span class="term-name">GenDmg</span>
              <span class="term-desc">일반 피해 증가 (GENDMG)</span>
            </div>
            <div class="term-item">
              <span class="term-name">EnemyMult</span>
              <span class="term-desc">방어감소 × 저항감소 × 강인도파괴</span>
            </div>
            <div class="term-item">
              <span class="term-name">FinalDmg</span>
              <span class="term-desc">최종 피해 배율 (FINALDMG)</span>
            </div>
          </div>
        </div>

        <div class="formula-crit">
          <h4>치명타 피해</h4>
          <div class="formula-text">
            <code>CritDmg = BaseDmg × (CritPower + SlotCritPower)</code>
          </div>
          <p class="formula-note">SlotCritPower = NORMALCRITPOWER, SKILLCRITPOWER, 등</p>
        </div>
      </div>
    </div>
  `;
}
