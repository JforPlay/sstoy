/**
 * Damage Calculator - Limit Break Comparison Tab
 * Visual analysis of damage progression across LB 0-5
 *
 * @module dmgcalc/ui/tabs/limitbreak
 */

import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { getState } from '../../core/state';
import type { LimitBreakAnalysis, SkillType } from '../../types';

// Register Chart.js components
Chart.register(...registerables);

// =============================================================================
// LIMIT BREAK TAB RENDERING
// =============================================================================

/**
 * Renders the Limit Break Comparison tab content
 */
export function renderLimitbreakTab(): string {
  const state = getState();
  const analysis = state.limitbreak;
  const selectedSkill = analysis?.selectedSkill || analysis?.skillType || 'skill';
  const isLoading = analysis?.loading || false;

  return `
    <div class="dmgcalc-limitbreak-tab">
      ${renderHeader()}

      ${renderSkillSelector(selectedSkill)}

      ${isLoading ? renderLoadingState() : ''}
      ${analysis && !isLoading ? renderAnalysisResults(analysis) : ''}
      ${!analysis && !isLoading ? renderEmptyState() : ''}
    </div>
  `;
}

// =============================================================================
// HEADER SECTION
// =============================================================================

function renderHeader(): string {
  return `
    <div class="limitbreak-header">
      <div class="limitbreak-header-left">
        <h2><i class="fa-solid fa-chart-line"></i> 한계돌파 분석</h2>
        <p class="limitbreak-subtitle">한계돌파 레벨별 피해 증가량 비교</p>
      </div>
      <div class="limitbreak-header-actions">
        <button class="btn-action" data-action="analyze-limitbreak">
          <i class="fa-solid fa-play"></i> 분석 시작
        </button>
      </div>
    </div>
  `;
}

// =============================================================================
// SKILL SELECTOR
// =============================================================================

function renderSkillSelector(selectedSkill: SkillType): string {
  const skills: Array<{ id: SkillType; label: string; icon: string }> = [
    { id: 'normalAtk', label: '일반 공격', icon: 'fa-hand-fist' },
    { id: 'skill', label: '스킬', icon: 'fa-wand-magic-sparkles' },
    { id: 'ultimate', label: '필살기', icon: 'fa-burst' }
  ];

  return `
    <div class="skill-selector-section">
      <h3 class="section-label">분석할 스킬 선택</h3>
      <div class="skill-selector-buttons">
        ${skills.map(skill => `
          <button
            class="skill-selector-btn ${selectedSkill === skill.id ? 'active' : ''}"
            data-action="select-lb-skill"
            data-skill="${skill.id}">
            <i class="fa-solid ${skill.icon}"></i>
            <span>${skill.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// =============================================================================
// ANALYSIS RESULTS
// =============================================================================

function renderAnalysisResults(analysis: LimitBreakAnalysis): string {
  return `
    <div class="limitbreak-results">
      ${renderChart(analysis)}
      ${renderDataTable(analysis)}
      ${renderInsights(analysis)}
    </div>
  `;
}

/**
 * Render Chart.js line chart
 */
function renderChart(analysis: LimitBreakAnalysis): string {
  return `
    <div class="limitbreak-chart-section">
      <h3 class="section-title">
        <i class="fa-solid fa-chart-line"></i>
        피해 증가 그래프
      </h3>
      <div class="chart-container">
        <canvas id="limitbreak-chart"></canvas>
      </div>
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-color" style="background: #6366f1;"></span>
          <span class="legend-label">총 피해 (평균)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #10b981;"></span>
          <span class="legend-label">스탯 기여도</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #f59e0b;"></span>
          <span class="legend-label">버프 기여도</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render data table with breakdown by LB level
 */
function renderDataTable(analysis: LimitBreakAnalysis): string {
  return `
    <div class="limitbreak-table-section">
      <h3 class="section-title">
        <i class="fa-solid fa-table"></i>
        상세 데이터
      </h3>
      <div class="limitbreak-table-container">
        <table class="limitbreak-table">
          <thead>
            <tr>
              <th>한계돌파</th>
              <th>레벨</th>
              <th>총 피해</th>
              <th>증가율</th>
              <th>스탯 기여</th>
              <th>버프 기여</th>
            </tr>
          </thead>
          <tbody>
            ${analysis.dataPoints.map((dp, index) => `
              <tr class="${index === 0 ? 'baseline-row' : ''}">
                <td class="lb-level">LB ${dp.limitBreak}</td>
                <td class="char-level">Lv.${dp.level}</td>
                <td class="total-damage">${(dp.totalDamage || 0).toLocaleString()}</td>
                <td class="percent-gain ${(dp.percentGain || 0) > 0 ? 'positive' : ''}">
                  ${(dp.percentGain || 0) > 0 ? '+' : ''}${(dp.percentGain || 0).toFixed(1)}%
                </td>
                <td class="stats-contrib">${(dp.statsContribution || 0).toLocaleString()}</td>
                <td class="buffs-contrib">${(dp.buffsContribution || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render insights and recommendations
 */
function renderInsights(analysis: LimitBreakAnalysis): string {
  const dataPoints = analysis.dataPoints;
  if (!dataPoints || dataPoints.length === 0) {
    return '<div class="limitbreak-insights-section"><p>No data available</p></div>';
  }

  const baseline = dataPoints[0];
  const maxLB = dataPoints[dataPoints.length - 1];

  if (!maxLB) {
    return '<div class="limitbreak-insights-section"><p>No data available</p></div>';
  }

  // Calculate total gain from LB 0 to LB 5
  const totalGain = maxLB.percentGain || 0;

  // Find biggest single-level jump
  let biggestJump = { from: 0, to: 1, gain: 0 };
  for (let i = 1; i < dataPoints.length; i++) {
    const curr = dataPoints[i];
    const prev = dataPoints[i - 1];
    if (!curr || !prev) continue;

    const gain = (curr.totalDamage || 0) - (prev.totalDamage || 0);
    if (gain > biggestJump.gain) {
      biggestJump = {
        from: prev.limitBreak,
        to: curr.limitBreak,
        gain
      };
    }
  }

  // Calculate efficiency (gain per LB level)
  // Total of 5 limit break steps (LB 1-5)
  const avgGainPerLevel = totalGain / 5;

  return `
    <div class="limitbreak-insights-section">
      <h3 class="section-title">
        <i class="fa-solid fa-lightbulb"></i>
        분석 결과
      </h3>
      <div class="insights-grid">
        <div class="insight-card">
          <div class="insight-icon">
            <i class="fa-solid fa-arrow-trend-up"></i>
          </div>
          <div class="insight-content">
            <div class="insight-label">전체 증가량</div>
            <div class="insight-value">+${totalGain.toFixed(1)}%</div>
            <div class="insight-desc">LB 0 → LB 5</div>
          </div>
        </div>

        <div class="insight-card">
          <div class="insight-icon">
            <i class="fa-solid fa-rocket"></i>
          </div>
          <div class="insight-content">
            <div class="insight-label">최대 점프</div>
            <div class="insight-value">LB ${biggestJump.from} → ${biggestJump.to}</div>
            <div class="insight-desc">+${biggestJump.gain.toLocaleString()} 피해</div>
          </div>
        </div>

        <div class="insight-card">
          <div class="insight-icon">
            <i class="fa-solid fa-chart-simple"></i>
          </div>
          <div class="insight-content">
            <div class="insight-label">평균 효율</div>
            <div class="insight-value">+${avgGainPerLevel.toFixed(1)}%</div>
            <div class="insight-desc">레벨당 평균 증가</div>
          </div>
        </div>

        <div class="insight-card">
          <div class="insight-icon">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div class="insight-content">
            <div class="insight-label">스탯 vs 버프</div>
            <div class="insight-value">
              ${(maxLB.statsContribution || 0).toLocaleString()} : ${(maxLB.buffsContribution || 0).toLocaleString()}
            </div>
            <div class="insight-desc">LB 5 기준</div>
          </div>
        </div>
      </div>

      <div class="recommendation-box">
        <h4><i class="fa-solid fa-star"></i> 추천</h4>
        <p>${generateRecommendation(analysis)}</p>
      </div>
    </div>
  `;
}

/**
 * Generate personalized recommendation based on analysis
 */
function generateRecommendation(analysis: LimitBreakAnalysis): string {
  const lastDataPoint = analysis.dataPoints[analysis.dataPoints.length - 1];
  if (!lastDataPoint) {
    return '데이터가 부족하여 추천을 생성할 수 없습니다.';
  }

  const totalGain = lastDataPoint.percentGain || 0;

  if (totalGain > 50) {
    return '한계돌파가 피해 증가에 큰 영향을 미칩니다. 가능한 한 높은 레벨까지 돌파하는 것을 권장합니다.';
  } else if (totalGain > 30) {
    return '한계돌파로 인한 피해 증가가 적당합니다. 우선순위에 따라 돌파를 진행하세요.';
  } else {
    return '이 캐릭터는 한계돌파보다 다른 요소(버프, 장비 등)가 더 중요할 수 있습니다.';
  }
}

// =============================================================================
// LOADING & EMPTY STATES
// =============================================================================

function renderLoadingState(): string {
  return `
    <div class="limitbreak-loading">
      <div class="spinner"></div>
      <p>한계돌파 분석 중...</p>
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <div class="limitbreak-empty">
      <i class="fa-solid fa-chart-line empty-icon"></i>
      <h3>분석을 시작하세요</h3>
      <p>위에서 스킬을 선택하고 "분석 시작" 버튼을 클릭하세요.</p>
      <p class="empty-hint">
        <i class="fa-solid fa-info-circle"></i>
        분석은 현재 빌드 기준으로 LB 0-5의 피해를 계산합니다.
      </p>
    </div>
  `;
}

// =============================================================================
// CHART INITIALIZATION
// =============================================================================

let chartInstance: Chart | null = null;

/**
 * Initialize Chart.js chart after HTML is rendered
 * Call this after the limitbreak tab is rendered with analysis results
 */
export function initializeLimitBreakChart(): void {
  const canvas = document.getElementById('limitbreak-chart') as HTMLCanvasElement | null;
  if (!canvas) {
    return; // Canvas not in DOM yet
  }

  const state = getState();
  const analysis = state.limitbreak;
  if (!analysis || !analysis.chartData || analysis.dataPoints.length === 0) {
    return; // No data to display
  }

  // Destroy existing chart instance if any
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Prepare data for Chart.js
  const labels = analysis.dataPoints.map(dp => `LB ${dp.limitBreak}`);
  const totalDamageData = analysis.dataPoints.map(dp => dp.totalDamage || 0);
  const percentGainData = analysis.dataPoints.map(dp => dp.percentGain || 0);

  // Create Chart.js configuration
  const config: ChartConfiguration = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '총 피해 (평균)',
          data: totalDamageData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: '증가율 (%)',
          data: percentGainData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;

              // TypeScript null check
              if (value === null || value === undefined) {
                return `${label}: N/A`;
              }

              if (context.datasetIndex === 0) {
                // Total damage - format with commas
                return `${label}: ${value.toLocaleString()}`;
              } else {
                // Percent gain - format as percentage
                return `${label}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
              }
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '총 피해'
          },
          ticks: {
            callback: function(value) {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '증가율 (%)'
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function(value) {
              if (typeof value === 'number') {
                return `${value >= 0 ? '+' : ''}${value}%`;
              }
              return value;
            }
          }
        }
      }
    }
  };

  // Create the chart
  chartInstance = new Chart(canvas, config);
  console.log('[DmgCalc] Limit break chart initialized', { dataPoints: analysis.dataPoints.length });
}
