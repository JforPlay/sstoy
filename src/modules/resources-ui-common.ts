/**
 * Resources Module - UI Common
 */

import { resourcesState, saveResourcesState, MATERIAL_GROUPS } from './resources-state';
import type { Item, MaterialGroup } from './resources-types';
import { getCharactersUsingItem, getDiscsUsingItem } from './resources-calc';
import { Modal } from '../shared/ui-components';

let myMaterialsModal: Modal | null = null;

export function showLoadingState(show: boolean): void {
  let loader = document.getElementById('resources-loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'resources-loader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-icon">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
        <p class="spinner-text">${window.i18n?.t('resources.loadingData') || '데이터를 불러오는 중...'}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

export function switchResourceTab(tabName: string, onGlanceTab?: () => void): void {
  document.querySelectorAll('.resources-tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector(`.resources-tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  document.querySelectorAll('.resources-tab-content').forEach((content) => {
    content.classList.remove('active');
  });
  document.getElementById(`resources-tab-${tabName}`)?.classList.add('active');

  if (tabName === 'glance' && onGlanceTab) {
    onGlanceTab();
  }
}

export function createResourceItemElement(
  item: Item,
  netQty: number,
  requiredQty: number,
  ownedQty: number,
  itemId: string
): HTMLElement {
  const itemName = resourcesState.itemNames[item.Title || ''] || item.Title || '';
  const rarity = item.Rarity || 1;
  const bgImage = `assets/items/rare_item_a_${6 - rarity}.png`;

  let iconPath = '';
  if (item.Icon) {
    iconPath = `assets/items/${item.Icon.split('/').pop()}.png`;
  } else if (itemId) {
    iconPath = `assets/items/item_${itemId}.png`;
  }

  const charactersUsing = itemId ? getCharactersUsingItem(itemId) : [];
  const discsUsing = itemId ? getDiscsUsingItem(itemId) : [];

  const div = document.createElement('div');
  div.className = 'resource-item';
  if (netQty <= 0 && requiredQty > 0) {
    div.classList.add('completed');
    div.title = (window.i18n?.t('resources.tooltipComplete') || '완료!\n필요: ${required}\n보유: ${owned}')
      .replace('${required}', requiredQty.toLocaleString())
      .replace('${owned}', ownedQty.toLocaleString());
  } else {
    div.title = (window.i18n?.t('resources.tooltipRequired') || '필요: ${required}\n보유: ${owned}')
      .replace('${required}', requiredQty.toLocaleString())
      .replace('${owned}', ownedQty.toLocaleString());
  }

  let characterIconsHTML = '';
  const totalIcons = charactersUsing.length + discsUsing.length;

  if (totalIcons > 0) {
    const maxVisible = 3;
    const visibleCharacters = charactersUsing.slice(0, Math.min(maxVisible, charactersUsing.length));
    const visibleDiscs = discsUsing.slice(0, Math.max(0, maxVisible - charactersUsing.length));
    const remaining = totalIcons - visibleCharacters.length - visibleDiscs.length;

    characterIconsHTML = `
      <div class="character-icons-overlay">
        ${visibleCharacters
          .map(
            (char) => `
          <img src="assets/char/avg1_${char.id}_002.png"
               class="character-icon-small"
               alt="${char.name}"
               title="${char.name}"
               loading="lazy"
               onerror="this.style.display='none'">
        `
          )
          .join('')}
        ${visibleDiscs
          .map((disc) => {
            let discIconPath = '';
            if (disc.data.DiscBg) {
              const fileId = disc.data.DiscBg.split('/').pop();
              discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
            }
            return `
            <img src="${discIconPath}"
                 class="character-icon-small"
                 alt="${disc.name}"
                 title="${disc.name}"
                 loading="lazy"
                 onerror="this.style.display='none'">
          `;
          })
          .join('')}
        ${remaining > 0 ? `<div class="character-icons-more" title="${remaining}개 더">+${remaining}</div>` : ''}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="resource-item-icon-wrapper">
      <img src="${bgImage}" class="resource-item-bg" alt="" loading="lazy" onerror="this.style.display='none'">
      <img src="${iconPath}" class="resource-item-icon" alt="${itemName}" loading="lazy" onerror="this.style.display='none'">
      ${characterIconsHTML}
    </div>
    <div class="resource-item-name">${itemName}</div>
    <div class="resource-item-qty">×${netQty.toLocaleString()}</div>
  `;

  if (netQty <= 0) {
    div.style.display = 'none';
  }

  return div;
}

export function openMyMaterialsModal(): void {
  if (!myMaterialsModal) {
    myMaterialsModal = new Modal('my-materials-modal');
  }

  const content = document.getElementById('my-materials-content');
  if (!content) return;

  content.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const createMaterialInput = (itemId: string): string => {
    const item = resourcesState.items[itemId];
    if (!item) return '';
    const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
    const itemName = resourcesState.itemNames[item.Title as string] || item.Title;
    const iconFile = item.Icon ? (item.Icon as string).split('/').pop() : '';
    const iconPath = `assets/items/${iconFile}.png`;
    const bgImage = `assets/items/rare_item_a_${6 - (item.Rarity || 1)}.png`;

    return `<div class="owned-material-item">
      <div class="resource-item-icon-wrapper">
        <img src="${bgImage}" class="resource-item-bg" alt="" loading="lazy" onerror="this.style.display='none'">
        <img src="${iconPath}" class="resource-item-icon" alt="${itemName}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="resource-item-name">${itemName}</div>
      <input type="number" class="owned-material-input" value="${ownedQty}" min="0" oninput="window.updateOwnedMaterial('${itemId}', this.value)" placeholder="0"/>
    </div>`;
  };

  const sections: Record<string, MaterialGroup[]> = {
    [window.i18n?.t('resources.advanceItemsCharacter') || 'Advance Items (Character)']: MATERIAL_GROUPS.advance || [],
    [window.i18n?.t('resources.advanceItemsDisc') || 'Advance Items (Disc)']: MATERIAL_GROUPS.discAdvance || [],
    [window.i18n?.t('resources.skillEnhanceItems') || 'Skill Enhancement Items']: MATERIAL_GROUPS.skill || [],
  };

  for (const [title, groups] of Object.entries(sections)) {
    const section = document.createElement('div');
    section.className = 'owned-material-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'owned-material-grid';

    groups.forEach((group) => {
      const groupRow = document.createElement('div');
      groupRow.className = 'owned-material-group-row';
      group.items.forEach((itemId) => {
        const div = document.createElement('div');
        div.innerHTML = createMaterialInput(String(itemId));
        groupRow.appendChild(div.firstElementChild as HTMLElement);
      });
      grid.appendChild(groupRow);
    });

    section.appendChild(grid);
    fragment.appendChild(section);
  }

  content.appendChild(fragment);
  myMaterialsModal.open();
}

export function closeMyMaterialsModal(renderCallback: () => void): void {
  if (myMaterialsModal) {
    myMaterialsModal.close();
  }
  renderCallback();
}

export function updateOwnedMaterial(itemId: string, quantity: string): void {
  const numQty = parseInt(quantity);
  if (isNaN(numQty) || numQty <= 0) {
    delete resourcesState.ownedMaterials[itemId];
  } else {
    resourcesState.ownedMaterials[itemId] = numQty;
  }
  saveResourcesState();
}
