import { createResponsiveImage } from '@/shared/dom';
import type { CycleSearchResult } from '../core/combat-optimizer';
import { getEnemyPresets } from '../core/enemies';
import { GameData, getCharacterName } from '@/shared/game-data';
import { getState } from '../core/state';
import { captureCombatInput } from '../core/combat-input';
import {combatActionName} from '../core/combat-action-labels';
export {combatActionName} from '../core/combat-action-labels';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const number = (value: number) => Math.floor(value).toLocaleString('ko-KR');
const ui = { busy: false, done: 0, total: 37, boss: 27, cinematics: true, candidate: 0, technicalCount: 0,
  error: '', result: null as CycleSearchResult | null };
let worker: Worker | null = null;
let lastInputSignature = '';
const currentInput = () => captureCombatInput(getState(), window.state, window.discsState, GameData.characters ?? {});

export function renderCyclePanel(): string {
  let input: ReturnType<typeof currentInput> | null = null;
  try { input = currentInput(); } catch { /* Empty parties are shown as empty, never replaced. */ }
  const signature = JSON.stringify(input);
  if (signature !== lastInputSignature) {
    worker?.terminate(); worker = null; ui.busy = false; ui.result = null; ui.error = '';
    lastInputSignature = signature;
  }
  const partyOrder = input?.actors.map(actor => String(actor.id)) ?? [];
  const actionName=(action:string)=>combatActionName(action,partyOrder[0]);
  const actorNames: Record<string, string> = Object.fromEntries(partyOrder.map(id => [id, getCharacterName(id)]));
  const currentTargets = getEnemyPresets();
  const targets = currentTargets.length ? currentTargets : [{ id: 26, name: '난폭한 헤비크랩' }, { id: 27, name: '심층의 주인' }];
  if (!targets.some(target => target.id === ui.boss)) { ui.boss = targets[0]!.id; ui.result = null; }
  const result = ui.result, candidate = result?.candidates[ui.candidate];
  const technical = result ? Math.min(result.technical.maximum, ui.technicalCount * result.technical.once) : 0;
  return `<section id="dmgcalc-cycle" class="dmgcalc-panel dmgcalc-cycle">
    <h3 class="dmgcalc-disc-group-title">180초 연합 토벌 사이클 <small>현재 설정 · 예측</small></h3>
    <p class="dmgcalc-help">위에서 설정한 파티·잠재력·레코드·소리·배지를 사용합니다. 설정을 바꾸면 이전 결과는 지워집니다. 검증되지 않은 전투 규칙은 다른 덱으로 대체하지 않고 알려드립니다.</p>
    <div class="dmgcalc-cycle-party">${(input?.actors ?? []).map((actor, index) => `<span>${createResponsiveImage(`assets/char/avg1_${actor.id}_002.png`, escape(actorNames[actor.id]!), 'dmgcalc-cycle-portrait')}<span>${escape(actorNames[actor.id]!)}<small>${index ? '지원' : '메인'} · Lv.${actor.level} · 돌파 ${actor.limitBreak}</small></span></span>`).join('')}</div>
    <div class="dmgcalc-actions">
      <label>대상 <select data-cycle-setting="boss" ${ui.busy ? 'disabled' : ''}>${targets.map(target => `<option value="${target.id}" ${ui.boss === target.id ? 'selected' : ''}>${escape(target.name)}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-cycle-setting="cinematics" ${ui.cinematics ? 'checked' : ''} ${ui.busy ? 'disabled' : ''}> 궁극기 연출 켬</label>
      <button class="btn btn-primary" data-action="cycle-search" ${ui.busy || !input ? 'disabled' : ''}>${ui.busy ? `비교 중 ${ui.done} / ${ui.total}` : '180초 사이클 비교'}</button>
      ${ui.busy ? '<button class="btn btn-secondary" data-action="cycle-cancel">중지</button>' : ''}
      ${result ? '<button class="btn btn-secondary" data-action="cycle-download">계산 결과 저장</button>' : ''}
    </div>
    <p class="dmgcalc-help">${currentTargets.length ? '현재 시즌의 보스를 데이터에서 자동으로 불러왔습니다.' : '진행 중인 시즌이 없어 이전 시즌의 보스로 계산합니다.'}</p>
    ${ui.busy ? `<progress max="${ui.total}" value="${ui.done}" aria-label="사이클 비교 진행률"></progress>` : ''}
    ${ui.error ? `<p role="alert" class="dmgcalc-scope-note">계산을 완료하지 못했습니다: ${escape(ui.error)}</p>` : ''}
    ${candidate && result ? `<div class="dmgcalc-actions" aria-label="사이클 후보">${result.candidates.map((row, index) => `<button class="btn ${index === ui.candidate ? 'btn-primary' : 'btn-secondary'}" data-action="cycle-candidate" data-index="${index}" aria-pressed="${index === ui.candidate}">후보 ${index + 1} · ${number(row.damageScore)}점</button>`).join('')}</div>
      <div class="dmgcalc-key-stats"><div><span>딜 점수</span><strong>${number(candidate.damageScore)}</strong></div><div><span>즉시 사용 대비</span><strong>${candidate.improvement >= 0 ? '+' : ''}${number(candidate.improvement)}점</strong></div><div><span>기술 포함 예상 점수</span><strong>${number(candidate.damageScore + technical)}</strong></div></div>
      <div class="dmgcalc-actions"><label>기술 조건 성공 <select data-cycle-setting="technicalCount">${Array.from({ length: Math.floor(result.technical.maximum / result.technical.once) + 1 }, (_, n) => `<option value="${n}" ${n === ui.technicalCount ? 'selected' : ''}>${n}회 · ${number(n * result.technical.once)}점</option>`).join('')}</select></label><span class="dmgcalc-help">회피 등 실전 결과를 입력합니다. 자동으로 만점을 가산하지 않습니다.</span></div>
      <p class="dmgcalc-help">${escape(result.technical.description)}</p>
      <p class="dmgcalc-help">총 피해 ${number(candidate.damage)} · 피해 ÷ ${number(result.switchRate)}의 내림값이 딜 점수 · ${result.tested}개 전략 비교 · 보스 ${candidate.bossLevel}레벨 도달</p>
      <p class="dmgcalc-help">${escape(candidate.name)}. 대기값은 메인 스킬까지 남은 시간이 이 범위일 때 사용을 보류하는 조건입니다.</p>
      <div class="dmgcalc-cycle-timeline" aria-label="180초 스킬 시간표">${partyOrder.map(actor => `<div class="dmgcalc-cycle-lane"><span>${escape(actorNames[actor]!)}</span><div>${candidate.casts.filter(cast => cast.action.startsWith(actor + ':')).map(cast => `<i style="left:${cast.time / result.duration * 100}%" class="${cast.action.includes('ultimate') ? 'is-ultimate' : ''}" title="${cast.time.toFixed(2)}초 · ${actionName(cast.action)}"></i>`).join('')}</div></div>`).join('')}<div class="dmgcalc-cycle-scale"><span>0초</span><span>60초</span><span>120초</span><span>180초</span></div></div>
      <details><summary>사용 시각 · SP · 횟수 확인</summary><p class="dmgcalc-help">일반 공격은 틈마다 자동으로 실행합니다. 아래 표는 직접 입력하는 스킬만 표시합니다.</p><div class="dmgcalc-cycle-table"><table><thead><tr><th>시각</th><th>여행가</th><th>행동</th><th>사용 전 SP</th><th>필요 SP</th></tr></thead><tbody>${candidate.casts.map(cast => `<tr><td>${cast.time.toFixed(2)}초</td><td>${actorNames[cast.action.split(':')[0]!]}</td><td>${actionName(cast.action)}</td><td>${cast.sp.toFixed(2)}</td><td>${cast.requiredSp || '—'}</td></tr>`).join('')}</tbody></table></div><p class="dmgcalc-help">${Object.entries(candidate.counts).filter(([action])=>partyOrder.includes(action.split(':')[0]!)).map(([action, count]) => `${actorNames[action.split(':')[0]!]} ${actionName(action)} ${count}회`).join(' · ')}</p></details>
      <details><summary>적용 조건 · 검증 범위</summary>${result.assumptions.map(line => `<p class="dmgcalc-help">${escape(line)}</p>`).join('')}<p class="dmgcalc-help">빌드 등급 ${result.buildRank} · 적용 소리 ${Object.entries(result.notes).map(([id, count]) => `${id}: ${count}`).join(' / ')}</p></details>` : `<p class="dmgcalc-help">${input ? '계산 시작 시 현재 설정을 읽습니다. 결과 저장 파일에도 실제 입력값이 포함됩니다.' : '먼저 메인 여행가와 파티를 설정해 주세요.'}</p>`}
  </section>`;
}

function refresh() {
  const current = document.getElementById('dmgcalc-cycle');
  if (current) current.outerHTML = renderCyclePanel();
}
export function handleCycleAction(action: string, element: HTMLElement): boolean {
  if (!action.startsWith('cycle-')) return false;
  if (action === 'cycle-search' && !ui.busy) {
    let input: ReturnType<typeof currentInput>;
    try { input = currentInput(); } catch (error) { ui.error = error instanceof Error ? error.message : String(error); refresh(); return true; }
    lastInputSignature = JSON.stringify(input);
    ui.busy = true; ui.done = 0; ui.error = ''; ui.result = null; ui.candidate = 0; ui.technicalCount = 0;
    worker = new Worker(new URL('../combat-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (event.data.type === 'progress') { ui.done = event.data.done; ui.total = event.data.total; }
      else if (event.data.type === 'result') { ui.result = event.data.result; ui.busy = false; worker?.terminate(); worker = null; }
      else { ui.error = event.data.message; ui.busy = false; worker?.terminate(); worker = null; }
      refresh();
    };
    worker.onerror = event => { ui.error = event.message || '계산 작업 오류'; ui.busy = false; worker?.terminate(); worker = null; refresh(); };
    worker.postMessage({ base: document.baseURI, input, options: { boss: ui.boss, distance: 2, cinematics: ui.cinematics } });
  } else if (action === 'cycle-cancel') { worker?.terminate(); worker = null; ui.busy = false; }
  else if (action === 'cycle-candidate') ui.candidate = Number(element.dataset.index);
  else if (action === 'cycle-download' && ui.result) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ui.result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '연합토벌-180초-사이클.json'; link.click(); URL.revokeObjectURL(url);
  }
  refresh(); return true;
}
export function handleCycleSetting(target: HTMLElement): boolean {
  const setting = target.dataset.cycleSetting;
  if (!setting) return false;
  if (setting === 'technicalCount') ui.technicalCount = Number((target as HTMLSelectElement).value);
  else if (!ui.busy) {
    if (setting === 'boss') ui.boss = Number((target as HTMLSelectElement).value);
    if (setting === 'cinematics') ui.cinematics = (target as HTMLInputElement).checked;
    ui.result = null;
  }
  refresh(); return true;
}
