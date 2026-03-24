/**
 * Skill Cards — Right Content Area
 *
 * Renders three skill damage cards (Normal Attack, Skill, Ultimate),
 * each with a header showing the skill info and total average damage,
 * followed by a hit-by-hit breakdown table.
 *
 * @module dmgcalc/ui/skill-cards
 */

import type { DmgCalcState, SkillType, SkillDamageResult, HitResult } from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Color accent per skill type */
const SKILL_COLORS: Record<SkillType, string> = {
  normalAtk: '#ff9800',
  skill: '#2196f3',
  ultimate: '#e91e63',
};

/** Readable labels per skill type */
const SKILL_LABELS: Record<SkillType, string> = {
  normalAtk: 'Normal Attack',
  skill: 'Skill',
  ultimate: 'Ultimate',
};

/** Ordered list for rendering */
const SKILL_ORDER: SkillType[] = ['normalAtk', 'skill', 'ultimate'];

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Render all three skill cards stacked vertically.
 */
export function renderSkillCards(state: DmgCalcState): string {
  return SKILL_ORDER
    .map((type) => renderSkillCard(type, state.results[type], state.skillLevels[type]))
    .join('');
}

// =============================================================================
// SINGLE SKILL CARD
// =============================================================================

function renderSkillCard(
  type: SkillType,
  result: SkillDamageResult | null,
  level: number,
): string {
  const color = SKILL_COLORS[type];

  const levelStepper = renderLevelStepper(type, level);

  if (!result) {
    return `
      <div class="skill-card skill-card--${type}" style="--skill-accent:${color};">
        <div class="skill-card-header">
          <div class="skill-card-icon-placeholder" style="background:${color};"></div>
          <div>
            <div class="skill-card-name">${SKILL_LABELS[type]}</div>
            ${levelStepper}
          </div>
          <div class="skill-card-total">&mdash;</div>
        </div>
        <div class="hit-table-body">
          <table class="hit-table">
            <thead>
              <tr><th>Hit</th><th>DMG%</th><th>Base</th><th>Crit</th><th>Avg</th></tr>
            </thead>
            <tbody>
              <tr><td colspan="5" class="hit-table-empty">No data</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  const totalFormatted = result.totalAvgDmg.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const iconHtml = renderSkillIcon(result.skillIcon, color);

  const hitRows = result.hits
    .map((hit) => renderHitRow(hit))
    .join('');

  // Summary row
  const totalBaseFormatted = result.totalBaseDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const totalCritFormatted = result.totalCritDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const totalAvgFormatted = result.totalAvgDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return `
    <div class="skill-card skill-card--${type}" style="--skill-accent:${color};">
      <div class="skill-card-header">
        ${iconHtml}
        <div>
          <div class="skill-card-name">${result.skillName}</div>
          ${levelStepper}
        </div>
        <div class="skill-card-total">${totalFormatted}</div>
      </div>
      <div class="hit-table-body">
        <table class="hit-table">
          <thead>
            <tr><th>Hit</th><th>DMG%</th><th>Base</th><th>Crit</th><th>Avg</th></tr>
          </thead>
          <tbody>
            ${hitRows}
          </tbody>
          <tfoot>
            <tr class="hit-table-total">
              <td>Total</td>
              <td></td>
              <td>${totalBaseFormatted}</td>
              <td>${totalCritFormatted}</td>
              <td>${totalAvgFormatted}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

// =============================================================================
// SKILL LEVEL STEPPER
// =============================================================================

/**
 * Render a small inline stepper for adjusting skill level.
 */
function renderLevelStepper(type: SkillType, level: number): string {
  return `
    <div class="skill-card-level-stepper">
      <button class="skill-level-btn" data-action="skill-level-down" data-skill-type="${type}" title="Decrease level">&minus;</button>
      <span class="skill-card-level">Lv.${level}</span>
      <button class="skill-level-btn" data-action="skill-level-up" data-skill-type="${type}" title="Increase level">+</button>
    </div>
  `;
}

// =============================================================================
// HIT ROW
// =============================================================================

function renderHitRow(hit: HitResult): string {
  const dmgPercent = hit.damagePercent.toFixed(1) + '%';
  const base = hit.baseDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const crit = hit.critDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const avg = hit.avgDmg.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return `
    <tr>
      <td>${hit.hitIndex + 1}</td>
      <td>${dmgPercent}</td>
      <td>${base}</td>
      <td>${crit}</td>
      <td>${avg}</td>
    </tr>
  `;
}

// =============================================================================
// SKILL ICON
// =============================================================================

/**
 * Render a skill icon image or a colored circle fallback.
 *
 * The skillIcon string from Skill.json looks like "Icon/Skill/T_Skill_103_01".
 * We attempt to resolve it to an asset path; if that fails visually the
 * colored circle placeholder is already inline via CSS background.
 */
function renderSkillIcon(skillIcon: string, color: string): string {
  if (!skillIcon) {
    return `<div class="skill-card-icon-placeholder" style="background:${color};"></div>`;
  }

  // Convert Icon path to an img src — assets live under assets/skill_icons/ with .png extension
  // e.g. "10301_Normal" → "assets/skill_icons/10301_Normal.png"
  const imgSrc = `assets/skill_icons/${skillIcon}.png`;

  return `
    <img class="skill-card-icon"
         src="${imgSrc}"
         alt=""
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
    ><div class="skill-card-icon-placeholder" style="background:${color};display:none;"></div>
  `;
}
