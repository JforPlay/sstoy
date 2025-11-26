/**
 * Damage Calculator
 * Calculate and visualize damage output for different character builds
 *
 * Features:
 * - Character selection with skill levels
 * - Disc/record configuration
 * - Enemy stats and resistances
 * - Damage breakdown visualization with Chart.js
 */

import '@/shared';
import { i18n } from '@/i18n';
import { showError, showSuccess, debounce } from '@/shared';
import type { ParamParserState } from '@/types';

// Chart.js imports
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartConfiguration
} from 'chart.js';

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// =============================================================================
// STATE & INTERFACES
// =============================================================================

interface DamageCalcState extends ParamParserState {
  // Character data
  characters: Record<string, any>;
  charactersKR: Record<string, any>;
  skills: Record<string, any>;
  skillsKR: Record<string, any>;

  // Damage calculation data
  hitDamage: Record<string, any>;
  effectValue: Record<string, any>;
  buffValue: Record<string, any>;

  // Selected configuration
  selectedCharacterId: string | null;
  selectedSkillId: number | null;
  skillLevel: number;
  characterLevel: number;

  // Enemy configuration
  enemyLevel: number;
  enemyDefense: number;
  enemyResistance: number;

  // Stat modifiers
  baseAtk: number;
  critRate: number;
  critDamage: number;
  elementalBonus: number;

  // Chart instance
  damageChart: Chart | null;
}

const calcState: DamageCalcState = {
  characters: {},
  charactersKR: {},
  skills: {},
  skillsKR: {},
  hitDamage: {},
  effectValue: {},
  buffValue: {},

  selectedCharacterId: null,
  selectedSkillId: null,
  skillLevel: 1,
  characterLevel: 80,

  enemyLevel: 80,
  enemyDefense: 500,
  enemyResistance: 0,

  baseAtk: 1000,
  critRate: 50,
  critDamage: 150,
  elementalBonus: 0,

  damageChart: null,

  // ParamParserState required fields
  gameEnums: {},
  uiText: {},
  onceAdditionalAttributeValue: {},
  scriptParameterValue: {},
  shieldValue: {}
};

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

    const [
      charactersData,
      charactersKRData,
      skillsData,
      skillsKRData,
      hitDamageData,
      effectValueData,
      buffValueData,
      gameEnumsData
    ] = await Promise.all([
      fetch('data/Character.json').then(r => r.json()),
      fetch(`${dataPath}/Character.json`).then(r => r.json()),
      fetch('data/Skill.json').then(r => r.json()),
      fetch(`${dataPath}/Skill.json`).then(r => r.json()),
      fetch('data/HitDamage.json').then(r => r.json()),
      fetch('data/EffectValue.json').then(r => r.json()),
      fetch('data/BuffValue.json').then(r => r.json()),
      fetch('data/GameEnums.json').then(r => r.json())
    ]);

    calcState.characters = charactersData;
    calcState.charactersKR = charactersKRData;
    calcState.skills = skillsData;
    calcState.skillsKR = skillsKRData;
    calcState.hitDamage = hitDamageData;
    calcState.effectValue = effectValueData;
    calcState.buffValue = buffValueData;
    calcState.gameEnums = gameEnumsData;

    console.log('[DmgCalc] Data loaded successfully');
    renderCharacterSelector();

  } catch (error) {
    console.error('[DmgCalc] Error loading data:', error);
    showError?.(window.i18n?.t('messages.error_loading') || 'Error loading data');
  }
}

// =============================================================================
// RENDERING
// =============================================================================

function renderCharacterSelector(): void {
  const container = document.getElementById('character-selector');
  if (!container) return;

  container.innerHTML = '';

  const availableCharacters = Object.values(calcState.characters)
    .filter((char: any) => char.Visible && char.Available)
    .sort((a: any, b: any) => a.Id - b.Id);

  availableCharacters.forEach((char: any) => {
    const charNameKey = `Character.${char.Id}.1`;
    const charName = calcState.charactersKR[charNameKey] || `Character ${char.Id}`;

    if (charName === '???') return;

    const card = document.createElement('div');
    card.className = 'dmg-char-card';
    card.onclick = () => selectCharacter(char.Id);

    card.innerHTML = `
      <img src="assets/char/avg1_${char.Id}_002.png"
           alt="${charName}"
           onerror="this.style.display='none'">
      <div class="dmg-char-name">${charName}</div>
    `;

    container.appendChild(card);
  });
}

function selectCharacter(charId: string): void {
  calcState.selectedCharacterId = charId;
  const char = calcState.characters[charId];

  if (!char) return;

  // Render skill selector
  renderSkillSelector(char);

  // Show calculator panel
  const panel = document.getElementById('calculator-panel');
  if (panel) {
    panel.style.display = 'block';
  }
}

function renderSkillSelector(char: any): void {
  const container = document.getElementById('skill-selector');
  if (!container) return;

  container.innerHTML = '';

  const skills = [
    { id: char.NormalAtkId, label: 'Normal Attack', key: 'normalAtk' },
    { id: char.SkillId, label: 'Skill', key: 'skill' },
    { id: char.UltimateId, label: 'Ultimate', key: 'ultimate' }
  ].filter(s => s.id);

  skills.forEach(({ id, label }) => {
    const skill = calcState.skills[id];
    if (!skill) return;

    const titleKey = skill.Title;
    const skillName = calcState.skillsKR[titleKey] || label;

    const btn = document.createElement('button');
    btn.className = 'skill-select-btn';
    btn.textContent = skillName;
    btn.onclick = () => selectSkill(id);

    container.appendChild(btn);
  });
}

function selectSkill(skillId: number): void {
  calcState.selectedSkillId = skillId;

  // Highlight selected button
  document.querySelectorAll('.skill-select-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event?.target && (event.target as HTMLElement).classList.add('active');

  // Calculate and display damage
  calculateDamage();
}

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================

interface DamageResult {
  baseDamage: number;
  critDamage: number;
  averageDamage: number;
  totalMultiplier: number;
  breakdown: {
    skill: number;
    atk: number;
    element: number;
    crit: number;
  };
}

function calculateDamage(): DamageResult | null {
  if (!calcState.selectedSkillId) return null;

  const skill = calcState.skills[calcState.selectedSkillId];
  if (!skill) return null;

  // TODO: Implement actual damage formula based on game mechanics
  // This is a placeholder calculation

  const skillMultiplier = 2.5; // Get from HitDamage data
  const atkValue = calcState.baseAtk;
  const elementBonus = 1 + (calcState.elementalBonus / 100);
  const defenseMultiplier = calculateDefenseMultiplier(
    calcState.characterLevel,
    calcState.enemyLevel,
    calcState.enemyDefense
  );

  const baseDamage = atkValue * skillMultiplier * elementBonus * defenseMultiplier;
  const critMultiplier = 1 + (calcState.critDamage / 100);
  const critDamage = baseDamage * critMultiplier;

  const critRateDecimal = calcState.critRate / 100;
  const averageDamage = baseDamage * (1 - critRateDecimal) + critDamage * critRateDecimal;

  const result: DamageResult = {
    baseDamage: Math.round(baseDamage),
    critDamage: Math.round(critDamage),
    averageDamage: Math.round(averageDamage),
    totalMultiplier: skillMultiplier * elementBonus * defenseMultiplier,
    breakdown: {
      skill: skillMultiplier,
      atk: atkValue,
      element: elementBonus,
      crit: critMultiplier
    }
  };

  displayDamageResults(result);
  renderDamageChart(result);

  return result;
}

function calculateDefenseMultiplier(charLevel: number, enemyLevel: number, enemyDef: number): number {
  // Placeholder formula - adjust based on actual game mechanics
  const levelDiff = charLevel - enemyLevel;
  const levelMultiplier = 1 + (levelDiff * 0.01);
  const defenseReduction = (charLevel * 100) / ((charLevel * 100) + enemyDef);

  return levelMultiplier * defenseReduction;
}

function displayDamageResults(result: DamageResult): void {
  const container = document.getElementById('damage-results');
  if (!container) return;

  container.innerHTML = `
    <div class="damage-result-card">
      <div class="damage-label">Base Damage</div>
      <div class="damage-value">${result.baseDamage.toLocaleString()}</div>
    </div>
    <div class="damage-result-card highlight">
      <div class="damage-label">Critical Damage</div>
      <div class="damage-value critical">${result.critDamage.toLocaleString()}</div>
    </div>
    <div class="damage-result-card">
      <div class="damage-label">Average Damage</div>
      <div class="damage-value average">${result.averageDamage.toLocaleString()}</div>
    </div>
    <div class="damage-breakdown">
      <h4>Damage Breakdown</h4>
      <div class="breakdown-item">
        <span>Skill Multiplier:</span>
        <span>${(result.breakdown.skill * 100).toFixed(1)}%</span>
      </div>
      <div class="breakdown-item">
        <span>Attack Value:</span>
        <span>${result.breakdown.atk.toLocaleString()}</span>
      </div>
      <div class="breakdown-item">
        <span>Element Bonus:</span>
        <span>${((result.breakdown.element - 1) * 100).toFixed(1)}%</span>
      </div>
      <div class="breakdown-item">
        <span>Crit Multiplier:</span>
        <span>${((result.breakdown.crit - 1) * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;
}

// =============================================================================
// CHART VISUALIZATION
// =============================================================================

function renderDamageChart(result: DamageResult): void {
  const canvas = document.getElementById('damage-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Destroy existing chart
  if (calcState.damageChart) {
    calcState.damageChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Base', 'Critical', 'Average'],
      datasets: [{
        label: 'Damage Output',
        data: [result.baseDamage, result.critDamage, result.averageDamage],
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(239, 68, 68, 0.5)',
          'rgba(34, 197, 94, 0.5)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(239, 68, 68)',
          'rgb(34, 197, 94)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Damage Comparison'
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      }
    }
  };

  calcState.damageChart = new Chart(ctx, config);
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function updateStat(stat: keyof DamageCalcState, value: number): void {
  (calcState as any)[stat] = value;

  // Recalculate damage
  if (calcState.selectedSkillId) {
    calculateDamage();
  }
}

// Export functions for HTML onclick handlers
declare global {
  interface Window {
    updateDmgCalcStat?: (stat: string, value: number) => void;
  }
}

// Wrapper function for HTML onclick handlers (accepts string, validates internally)
window.updateDmgCalcStat = (stat: string, value: number) => {
  // Validate that stat is a valid key
  const validStats: Array<keyof DamageCalcState> = [
    'skillLevel', 'characterLevel', 'enemyLevel', 'enemyDefense',
    'enemyResistance', 'baseAtk', 'critRate', 'critDamage', 'elementalBonus'
  ];

  if (validStats.includes(stat as keyof DamageCalcState)) {
    updateStat(stat as keyof DamageCalcState, value);
  }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();

  // Listen for language changes
  window.addEventListener('languageChanged', async () => {
    console.log('[DmgCalc] Language changed, reloading data');
    await loadData();
  });

  await loadData();
});
