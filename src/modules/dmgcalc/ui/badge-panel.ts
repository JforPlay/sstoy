import { GameData, getCharacterName } from '@/shared/game-data';
import { badgeGroupKey, decodeBadgeAttribute, decodeBadgeSp, getBadgeGroups, getBadgeUnlockLevel, getBadgeOwnerLevel, getBadgePotentialId, type BadgeAttribute } from '../core/badges';
import { getStatDisplayName } from '../core/enums';
import { getState } from '../core/state';
import type { DmgCalcState } from '../types';

const t = (key: string) => window.i18n?.t(`dmgcalc.${key}`) || key;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Attribute quality, not the badge item's own rarity. In the data 4 is the
// lowest value and 1 the highest (e.g. crit chance 5 / 6.3 / 7.5 / 15%).
const BADGE_GRADES: Record<number, string> = { 4: 'green', 3: 'blue', 2: 'gold', 1: 'rainbow' };
function gradeName(row: BadgeAttribute): string {
  return t(`badgeGrade${BADGE_GRADES[row.Rarity]?.replace(/^./, char => char.toUpperCase()) || 'Unknown'}`);
}

function optionLabel(row: BadgeAttribute, slot: number): string {
  const sp = decodeBadgeSp(row);
  if (sp) return sp.main ? '메인 SP 획득 효율' : '지원 SP 획득 효율';
  if (row.AttrType === 7) return GameData.uiText?.[`UIText.Char_Skill_Type_${row.AttrTypeFirstSubtype}.1`] || ['','일반 공격','메인 스킬','지원 스킬','필살기'][row.AttrTypeFirstSubtype!]!;
  if (row.AttrType === 99) {
    const id = getBadgePotentialId(row, slot);
    return GameData.itemsKR?.[String(GameData.items?.[id!]?.Title || `Item.${id}.1`)] || `잠재력 ${id}`;
  }
  const decoded = decodeBadgeAttribute(row)!;
  return `${getStatDisplayName(decoded.key)}${decoded.isPercentage ? ' (%)' : ''}`;
}

function valueLabel(row: BadgeAttribute): string {
  const sp = decodeBadgeSp(row);
  if (sp) return `${Number((sp.value * 100).toFixed(2))}%`;
  if ([7, 99].includes(row.AttrType)) return `+${row.Value} Lv.`;
  const decoded = decodeBadgeAttribute(row)!;
  const flat = ['Atk', 'Def', 'Hp', 'Penetrate', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP'].includes(decoded.key) && !decoded.isPercentage;
  const value = flat ? `${decoded.value}` : `${Number((decoded.value / 100).toFixed(2))}%`;
  return value;
}

export function renderBadgePanel(state: DmgCalcState): string {
  return `<div class="dmgcalc-panel">
    <div class="dmgcalc-panel-title">${t('badges')}</div>
    <p class="dmgcalc-help">${t('badgeHelp')}</p>
    <div class="dmgcalc-badge-party-grid">${(['master', 'assist1', 'assist2'] as const).map((position, partyIndex) => {
      const character = window.state?.party?.[position];
      const name = character && typeof character !== 'string' ? getCharacterName(String(character.id)) : t('emptyCharacter');
      const portrait = character && typeof character !== 'string' ? `assets/char/avg1_${character.id}_002.png` : undefined;
      return `<section class="dmgcalc-badge-character"><h3>${portrait ? `<img src="${portrait}" alt="">` : '<i class="fa-solid fa-user" aria-hidden="true"></i>'}<span><small>${t(position)}</small>${escape(name)}</span></h3>
      ${state.badgeOptions.slice(partyIndex * 3, partyIndex * 3 + 3).map((ids, localSlot) => {
      const slot = partyIndex * 3 + localSlot;
      const groups = getBadgeGroups(slot);
      const locked = getBadgeOwnerLevel(slot) < getBadgeUnlockLevel(slot);
      return `<fieldset class="dmgcalc-badge-slot" ${locked ? 'disabled' : ''}>
        <legend><span>${t('badges')} ${localSlot + 1}</span><small>Lv.${getBadgeUnlockLevel(slot)}</small></legend>
        ${Array.from({ length: 4 }, (_, index) => {
          const id = ids[index] || 0;
          const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute;
          const group = row ? badgeGroupKey(row) : '';
          const values = groups.get(group) ?? [];
          const grade = row ? BADGE_GRADES[row.Rarity] || 'unknown' : 'unknown';
          return `<details class="dmgcalc-badge-row is-${grade}">
            <summary title="${t('badgeOption')}"><span class="dmgcalc-affix-quality">${row ? gradeName(row) : String(index + 1).padStart(2, '0')}</span><span class="dmgcalc-affix-name">${row ? escape(optionLabel(row, slot)) : t('badgeOption')}</span><strong>${row ? valueLabel(row) : '—'}</strong><i class="fa-solid fa-pen" aria-hidden="true"></i></summary>
            <div class="dmgcalc-affix-editor">
            <button type="button" class="dmgcalc-badge-picker-trigger" data-action="badge-group-open" data-slot="${slot}" data-index="${index}" aria-haspopup="dialog">${row ? escape(optionLabel(row, slot)) : t('badgeOption')}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <div class="dmgcalc-badge-value" role="group" aria-label="${t('badgeValue')}">
              ${values.filter((value, i, all) => all.findIndex(other => other.Rarity === value.Rarity && other.Value === value.Value) === i).map(value => `<button type="button" class="dmgcalc-affix-choice is-${BADGE_GRADES[value.Rarity]}" data-action="badge-value-pick" data-slot="${slot}" data-index="${index}" data-id="${value.Id}" aria-pressed="${value.Value === row.Value && value.Rarity === row.Rarity}" title="${gradeName(value)}">${gradeName(value)}<strong>${valueLabel(value)}</strong></button>`).join('')}
            </div>
            </div>
          </details>`;
        }).join('')}
      </fieldset>`;
    }).join('')}</section>`;
    }).join('')}</div>
    <p class="dmgcalc-help">80 배지: 스킬 레벨 상승 · 90 배지: 보유 잠재력 레벨 상승<br>능력치는 각 캐릭터에, SP 획득 효율은 사이클 계산에 적용됩니다.</p>
  </div>`;
}

/** The native select popup cannot lay its options out in columns. Keep the
 * equipped rows unchanged and show only the available option TYPES in a grid. */
export function openBadgeOptionPicker(slot: number, index: number, select: (id: number) => void): void {
  document.getElementById('dmgcalc-badge-picker')?.remove();
  const active = document.activeElement as HTMLElement | null;
  const selectedId = getState().badgeOptions[slot]?.[index];
  const selectedRow = GameData.charGemAttrValue[String(selectedId)] as BadgeAttribute | undefined;
  const selectedGroup = selectedRow ? badgeGroupKey(selectedRow) : '';
  const groups = [...getBadgeGroups(slot)];
  const dialog = document.createElement('dialog');
  dialog.id = 'dmgcalc-badge-picker';
  dialog.className = 'dmgcalc-badge-picker';
  dialog.setAttribute('aria-labelledby', 'dmgcalc-badge-picker-title');
  dialog.innerHTML = `<div class="modal-header"><h2 id="dmgcalc-badge-picker-title">${t('badgeOption')}</h2><button type="button" class="close-btn" data-picker-close aria-label="닫기">×</button></div>
    <div class="modal-body"><input type="search" class="dmgcalc-badge-picker-search" placeholder="옵션 검색" aria-label="배지 옵션 검색">
    <div class="dmgcalc-badge-picker-grid">${groups.map(([key, rows]) => {
      const row = rows[0]!;
      return `<button type="button" data-picker-id="${row.Id}" aria-pressed="${key === selectedGroup}">${escape(optionLabel(row, slot))}</button>`;
    }).join('')}</div><p class="dmgcalc-help" data-picker-empty hidden>일치하는 옵션이 없습니다.</p></div>`;
  dialog.addEventListener('close', () => { dialog.remove(); if (active?.isConnected) active.focus(); }, { once: true });
  dialog.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-picker-close]') || target === dialog) { dialog.close(); return; }
    const choice = target.closest<HTMLElement>('[data-picker-id]');
    if (choice) { const id = Number(choice.dataset.pickerId); dialog.close(); select(id); }
  });
  dialog.querySelector('input')!.addEventListener('input', event => {
    const query = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase();
    let count = 0;
    dialog.querySelectorAll<HTMLElement>('[data-picker-id]').forEach(button => {
      button.hidden = !button.textContent!.toLocaleLowerCase().includes(query);
      if (!button.hidden) count++;
    });
    dialog.querySelector<HTMLElement>('[data-picker-empty]')!.hidden = count > 0;
  });
  document.body.append(dialog);
  dialog.showModal();
}
