/**
 * Main Layout Renderer for Damage Calculator
 *
 * Renders Layout A: left sidebar (300px) + right content area (flexible).
 * The sidebar contains the build panel.
 * The main area contains skill damage cards.
 * Below the main layout is a full-width buff section.
 *
 * @module dmgcalc/ui/renderer
 */

import { renderBuildPanel } from './build-panel';
import { renderBuffPanel, renderStatSummary } from './buff-panel';
import { renderSkillCards } from './skill-cards';
import type { DmgCalcState } from '../types';
import { ELEMENT_TYPE_TO_STAT, DAMAGE_TYPE_TO_BONUS_STAT } from '../constants';

// =============================================================================
// MAIN RENDERER
// =============================================================================

/**
 * Render the full damage calculator UI.
 *
 * When no master character is selected, shows an empty-state placeholder
 * prompting the user to pick a character first.
 *
 * @param state - Current DmgCalcState snapshot
 * @returns HTML string for the entire dmgcalc view
 */
function renderDebugPanel(state: DmgCalcState): string {
  const charData = state.masterCharId ? (window as any).GameData?.characters?.[state.masterCharId] as any : null;
  const eet = charData?.EET ?? 0;
  const elementKey = ELEMENT_TYPE_TO_STAT[eet] || 'N/A';

  // Key stats
  const statKeys = ['Atk', 'Def', 'Hp', 'CritRate', 'CritPower',
    'NORMALDMG', 'SKILLDMG', 'ULTRADMG', 'OTHERDMG', 'MARKDMG',
    'GENDMG', 'DMGPLUS', 'FINALDMG', 'FINALDMGPLUS',
    'WEE', 'FEE', 'SEE', 'AEE', 'LEE', 'DEE'];

  const statRows = statKeys.map(key => {
    const stat = state.stats.get(key);
    if (!stat) return `<tr><td>${key}</td><td colspan="3" style="color:#666">not in map</td></tr>`;
    const sources = stat.sources.map(s => `${s.name}: ${s.value}${s.active ? '' : ' (OFF)'}`).join(', ');
    return `<tr><td>${key}</td><td>${stat.baseValue}</td><td>${stat.total}</td><td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;">${sources || 'none'}</td></tr>`;
  }).join('');

  // Buff summary
  const toggleable = state.buffs.filter(b => !b.nonToggleable);
  const nonToggleable = state.buffs.filter(b => b.nonToggleable);

  const buffRows = toggleable.map(b => {
    const effects = b.statEffects.map(e => `${e.key}:${e.value}`).join(', ');
    return `<tr><td>${b.active ? 'ON' : 'OFF'}</td><td>${b.sourceName || b.name}</td><td>${effects || 'none'}</td></tr>`;
  }).join('');

  // Enemy multipliers
  const def = state.enemy.def;
  const effDef = Math.max(0, def);
  const defAmend = 1 - (effDef * 40) / (effDef * 32 + 24000);
  const res = state.enemy.res;
  let resistAmend = 0;
  if (res > 0) {
    if (res <= 250) { const t = res/250; resistAmend = 0.25 * t * t; }
    else if (res <= 750) { const t = (res-251)/(750-251); resistAmend = 0.35 + 0.25 * t * t; }
    else { const c = Math.min(res, 2000); const t = (c-751)/(2000-751); resistAmend = 0.9 + 0.09 * t * t; }
  }
  const erAmend = 1 - resistAmend;

  // Skill hit details
  const skillDebug = (['normalAtk', 'skill', 'ultimate'] as const).map(st => {
    const r = state.results[st];
    if (!r) return `<div><strong>${st}</strong>: no data</div>`;
    const hitDetails = r.hits.map(h =>
      `Hit ${h.hitIndex}: pct=${h.damagePercent.toFixed(1)}% base=${h.baseDmg} crit=${h.critDmg} avg=${h.avgDmg} dmgType=${h.damageType} elemType=${h.elementType}`
    ).join('<br>');
    return `<div style="margin-top:0.5rem"><strong>${st}</strong> (${r.skillName}): total avg=${r.totalAvgDmg.toLocaleString()}<br>${hitDetails}</div>`;
  }).join('');

  return `
    <div style="margin-top:0.5rem">
      <strong>Character:</strong> ${state.masterCharId} | <strong>Level:</strong> ${state.masterLevel} | <strong>LB:</strong> ${state.limitBreak} | <strong>EET:</strong> ${eet} (${elementKey})
    </div>
    <div style="margin-top:0.5rem">
      <strong>Enemy:</strong> DEF=${def} (defAmend=${defAmend.toFixed(4)}) | RES=${res} (erAmend=${erAmend.toFixed(4)}) | Broken=${state.enemy.toughnessBroken}
    </div>
    <table style="margin-top:0.5rem;border-collapse:collapse;width:100%">
      <thead><tr><th style="text-align:left;border-bottom:1px solid #333;padding:2px 6px">Stat</th><th style="border-bottom:1px solid #333;padding:2px 6px">Base</th><th style="border-bottom:1px solid #333;padding:2px 6px">Total</th><th style="text-align:left;border-bottom:1px solid #333;padding:2px 6px">Sources</th></tr></thead>
      <tbody>${statRows}</tbody>
    </table>
    <div style="margin-top:0.5rem">
      <strong>Toggleable Buffs (${toggleable.length}):</strong>
      <table style="border-collapse:collapse;width:100%;margin-top:4px">
        <tbody>${buffRows || '<tr><td>none</td></tr>'}</tbody>
      </table>
    </div>
    <div style="margin-top:0.5rem"><strong>Non-toggleable entries:</strong> ${nonToggleable.length} (potential stats + LB talent bonuses, display only)</div>
    <div style="margin-top:0.5rem">
      <strong>Skill Damage Breakdown:</strong>
      ${skillDebug}
    </div>
  `;
}

export function renderDmgCalc(state: DmgCalcState): string {
  if (!state.masterCharId) {
    return `<div class="dmgcalc-empty">
      <i class="fa-solid fa-calculator" style="font-size:2rem;margin-bottom:1rem;opacity:0.3;"></i>
      <p>Select a character in the Characters tab to use the damage calculator.</p>
    </div>`;
  }

  return `
    <div class="dmgcalc-container-inner">
      <div class="dmgcalc-layout">
        <aside class="dmgcalc-sidebar">
          ${renderBuildPanel(state)}
        </aside>
        <main class="dmgcalc-main">
          ${renderSkillCards(state)}
        </main>
      </div>
      <section class="dmgcalc-buffs-section">
        ${renderBuffPanel(state)}
      </section>
      <section class="dmgcalc-buffs-section">
        ${renderStatSummary(state)}
      </section>
      <details class="dmgcalc-debug" style="margin-top:1rem;background:#111;padding:1rem;border-radius:8px;font-size:0.75rem;color:#aaa;">
        <summary style="cursor:pointer;color:#e0e0e0;font-weight:600;">Debug: Stat Values & Calculation Trace</summary>
        ${renderDebugPanel(state)}
      </details>
    </div>
  `;
}
