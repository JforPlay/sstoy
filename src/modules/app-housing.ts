import { fetchJSON } from '../shared/network';
import { showToast } from '../shared/ui';
import { i18n } from '../i18n';
import { encodeHousingShare, decodeHousingShare } from './housing-share';
import { canPlace, canUseFurniture, furnitureKind, fixturePlacement, supportsPlacement, validateLayout } from './housing-layout';
import { HousingScene } from './housing-scene';
import { HousingPreview } from './housing-preview';
import type { Furniture, Layout, Placement, Room, RoomSize, DefaultFurniture } from './housing-layout';

type Item = { Title: string; Desc?: string; Icon?: string };
type HousingCharacter = { characterId: number; model: string; expressions?: number[] };
const storageKey = 'housingLayoutV1';
let furniture: Record<string, Furniture> = {};
let rooms: Record<string, Room> = {};
let sizes: Record<string, RoomSize> = {};
let items: Record<string, Item> = {};
let defaults: DefaultFurniture[] = [];
let names: Record<string, string> = {};
let roomNames: Record<string, string> = {};
let layout: Layout = { version: 1, rooms: {} };
let roomId = '';
let selected = '';
let catalogId = 0;
let category = 0;
let query = '';
let allowOverlap = false;
let showGrid = true;
let characterModel = '';
let characters: Record<string, HousingCharacter> = {};
let characterNames: Record<string, string> = {};
let catalogMode: 'furniture' | 'characters' = 'furniture';
let catalogCharacter = '';
let previewMode: '2d' | '3d' = '3d';
let inspectorPreview: HousingPreview | undefined;
const characterExpressions: Record<string, number> = {};
let wallSide: 'left' | 'right' = 'right';
let wallElevation = 1;
let languageRevision = 0;
let sceneView: HousingScene | undefined;
const furnitureClipboardPrefix = 'sstoy-housing-furniture:';
const history: string[] = [];
const t = (key: string): string => i18n.t(`housing.${key}`);
const esc = (value: string | number): string => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const root = (): HTMLElement => document.getElementById('housing-app')!;
const currentRoom = (): Room => rooms[roomId]!;
const size = (): RoomSize => sizes[currentRoom().RoomSizeType || 0]!;
const placements = (): Placement[] => layout.rooms[roomId] || [];
const fixedFixture = (): Placement | undefined => fixturePlacement(currentRoom(), defaults, furniture, layout.decorations?.[roomId]?.fixture);
const scenePlacements = (): Placement[] => { const fixed = fixedFixture(); return fixed ? [...placements(), fixed] : placements(); };
const isFixed = (p: Placement | undefined): boolean => !!p?.uid.startsWith('fixture-');
const finishId = (kind: 'floor' | 'wall'): number | undefined => layout.decorations?.[roomId]?.[kind] ?? defaults.find(p => p.RoomLayoutId === currentRoom().DefaultLayoutId && furniture[p.FurnitureId] && furnitureKind(furniture[p.FurnitureId]!) === (kind === 'floor' ? 'floorFinish' : 'wallFinish'))?.FurnitureId;
const name = (id: number): string => names[items[id]?.Title || ''] || String(id);
const image = (id: number): string => `assets/housing/item_${id}.png`;
const selectedPlacement = (): Placement | undefined => scenePlacements().find(p => p.uid === selected);
const selectedFurniture = (): Furniture | undefined => furniture[selectedPlacement()?.furnitureId || catalogId];
const availability = (f: Furniture): string => canUseFurniture(f, currentRoom()) ? t(`kind_${furnitureKind(f)}`) : t(f.CanIn.includes(1) ? 'indoorOnly' : 'outdoorOnly');

function status(message: string): void { document.getElementById('housing-status')!.textContent = message; }
function remember(): void { history.push(JSON.stringify(layout)); if (history.length > 40) history.shift(); }
function persist(): boolean {
  try { localStorage.setItem(storageKey, JSON.stringify(layout)); return true; }
  catch { status(t('saveError')); return false; }
}
function commit(): boolean { const saved = persist(); renderBoard(); renderInspector(); return saved; }
function notifyInvalid(): void { status(t('invalidPosition')); }
function undo(): void {
  if (!history.length) return;
  layout = JSON.parse(history.pop()!) as Layout;
  selected = '';
  if (commit()) status(t('updated'));
}

async function loadNames(): Promise<void> {
  const revision = ++languageRevision;
  const lang = i18n.currentLang || 'KR';
  const [newNames, newRoomNames, newCharacterNames] = await Promise.all([
    fetchJSON<Record<string, string>>(`data/${lang}/Item.json`),
    fetchJSON<Record<string, string>>(`data/${lang}/DormRoom.json`),
    fetchJSON<Record<string, string>>(`data/${lang}/Character.json`),
  ]);
  if (revision !== languageRevision) return;
  names = newNames;
  roomNames = newRoomNames;
  characterNames = newCharacterNames;
  render();
}

export async function initHousing(): Promise<void> {
  [furniture, rooms, sizes, items] = await Promise.all([
    fetchJSON<Record<string, Furniture>>('data/DormFurniture.json'),
    fetchJSON<Record<string, Room>>('data/DormRoom.json'),
    fetchJSON<Record<string, RoomSize>>('data/DormRoomSize.json'),
    fetchJSON<Record<string, Item>>('data/Item.json'),
  ]);
  defaults = Object.values(await fetchJSON<Record<string, DefaultFurniture>>('data/DormRoomLayout.json'));
  characters = await fetchJSON<Record<string, HousingCharacter>>('assets/housing/models/characters.json');
  roomId = Object.keys(rooms)[0]!;
  let invalidSavedData = false;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) layout = validateLayout(JSON.parse(saved), furniture, rooms, sizes);
  } catch { invalidSavedData = true; }
  let imported = false;
  let invalidSharedData = false;
  if (location.hash.startsWith('#layout=') || location.hash.startsWith('#h=')) {
    try {
      const decoded = decodeHousingShare(location.hash);
      const shared = validateLayout(decoded.layout, furniture, rooms, sizes);
      // A shared plan is a preview until explicitly saved, preserving the user's local plan.
      layout = shared;
      roomId = decoded.roomId || Object.keys(shared.rooms)[0] || roomId;
      imported = true;
    } catch { invalidSharedData = true; }
  }
  await loadNames();
  if (imported) status(t('sharedPreview'));
  else if (invalidSharedData || invalidSavedData) status(t('importError'));
  window.addEventListener('languageChanged', () => {
    void loadNames().catch(error => { console.error('[Housing]', error); status(t('loadError')); });
  });
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('copy', copyFurniture);
  document.addEventListener('paste', pasteFurniture);
}

function render(): void {
  inspectorPreview?.dispose(); inspectorPreview = undefined;
  sceneView?.dispose(); sceneView = undefined;
  root().setAttribute('aria-busy', 'false');
  root().innerHTML = `
    <div class="housing-toolbar">
      <div class="housing-room-tabs" role="group" aria-label="${esc(t('room'))}">
        ${Object.values(rooms).map(room => `<button class="btn btn-secondary ${String(room.Id) === roomId ? 'active' : ''}" data-room="${room.Id}" aria-pressed="${String(room.Id) === roomId}">${esc(roomNames[room.DefaultName] || room.Id)} · ${room.RoomType ? t('indoor') : t('outdoor')}</button>`).join('')}
      </div>
      <button class="btn btn-secondary" data-action="undo" ${history.length ? '' : 'disabled'}><i class="fa-solid fa-rotate-left"></i>${t('undo')}</button>
      <button class="btn btn-secondary" data-action="save"><i class="fa-solid fa-floppy-disk"></i>${t('save')}</button>
      <button class="btn btn-secondary" data-action="share"><i class="fa-solid fa-link"></i>${t('share')}</button>
      <button class="btn btn-secondary" data-action="export">${t('export')}</button>
      <button class="btn btn-secondary" data-action="import">${t('import')}</button>
      <input type="file" id="housing-file" accept="application/json,.json" hidden>
      <button class="btn btn-danger" data-action="clear">${t('clear')}</button>
    </div>
    <div class="housing-layout">
      <aside class="housing-panel">
        <div class="housing-catalog-tabs" role="group" aria-label="${t('catalogType')}">
          <button class="btn btn-secondary ${catalogMode === 'furniture' ? 'active' : ''}" data-catalog="furniture" aria-pressed="${catalogMode === 'furniture'}">${t('catalog')}</button>
          <button class="btn btn-secondary ${catalogMode === 'characters' ? 'active' : ''}" data-catalog="characters" aria-pressed="${catalogMode === 'characters'}">${t('characterCatalog')}</button>
        </div>
        <h2 id="housing-catalog-heading"></h2>
        <input class="housing-input" id="housing-search" type="search" value="${esc(query)}" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}">
        <div class="housing-filters" role="group" aria-label="${esc(t('category'))}">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(tab => `<button class="btn btn-secondary ${category === tab ? 'active' : ''}" data-category="${tab}" aria-pressed="${category === tab}">${t(`category${tab}`)}</button>`).join('')}
        </div>
        <label class="housing-help"><input id="housing-compatible" type="checkbox"> ${t('compatibleOnly')}</label>
        <div id="housing-catalog" class="housing-catalog"></div>
      </aside>
      <aside class="housing-panel housing-inspector"><h2 id="housing-inspector-heading">${t('details')}</h2><div id="housing-details" class="housing-details"></div><div id="housing-summary" class="housing-summary"></div></aside>
      <section class="housing-panel">
        <div class="housing-board-heading"><h2>${t('floorPlan')}</h2><span>${size().L} × ${size().W}</span></div>
        <div class="housing-board-actions">
          <button class="btn btn-primary" data-action="add" disabled>${t('add')}</button>
          <button class="btn btn-secondary" data-action="rotate" disabled>${t('rotate')}</button>
          <button class="btn btn-danger" data-action="delete" disabled>${t('delete')}</button>
          <button class="btn btn-secondary" data-action="reset-decor">${t('resetDecor')}</button>
        </div>
        <div id="housing-mount-controls" class="housing-mount-controls" hidden></div>
        <div class="housing-board-scroll"><div id="housing-board" class="housing-board ${currentRoom().RoomType ? '' : 'outdoor'}" style="--cols:${size().L};--rows:${size().W}" role="group" aria-label="${esc(t('floorPlan'))}"></div></div>
        <p class="housing-help">${t('instructions')}</p>
        <div class="housing-board-options">
          <label class="housing-help"><input type="checkbox" id="housing-overlap" ${allowOverlap ? 'checked' : ''}> ${t('overlap')}</label>
          <label class="housing-help"><input type="checkbox" id="housing-grid" ${showGrid ? 'checked' : ''}> ${t('showGrid')}</label>
        </div>
        <p class="housing-help">${t('backgroundNote')}</p>
        <div id="housing-share" class="housing-share" hidden><label for="housing-share-url">${t('share')}</label><input id="housing-share-url" class="housing-input" readonly></div>
      </section>
    </div>
    <p class="housing-note">${t('limitation')}</p>`;
  root().onclick = handleClick;
  root().querySelector<HTMLInputElement>('#housing-search')!.oninput = event => {
    query = (event.target as HTMLInputElement).value;
    renderCatalog();
  };
  root().querySelector<HTMLInputElement>('#housing-compatible')!.onchange = renderCatalog;
  root().querySelector<HTMLInputElement>('#housing-overlap')!.onchange = event => { allowOverlap = (event.target as HTMLInputElement).checked; };
  root().querySelector<HTMLInputElement>('#housing-grid')!.onchange = event => {
    showGrid = (event.target as HTMLInputElement).checked;
    renderBoard();
  };
  root().querySelector<HTMLInputElement>('#housing-file')!.onchange = event => void importFile(event);
  renderCatalog();
  renderBoard();
  renderInspector();
}

function renderCatalog(): void {
  const container = document.getElementById('housing-catalog')!;
  const characterMode = catalogMode === 'characters';
  document.getElementById('housing-catalog-heading')!.textContent = `${t(characterMode ? 'characterCatalog' : 'catalog')} (${characterMode ? Object.keys(characters).length : Object.values(furniture).filter(f => !f.NotShow).length})`;
  root().querySelector<HTMLElement>('.housing-filters')!.hidden = characterMode;
  root().querySelector<HTMLInputElement>('#housing-compatible')!.closest('label')!.hidden = characterMode;
  const search = root().querySelector<HTMLInputElement>('#housing-search')!;
  search.placeholder = t(characterMode ? 'characterSearch' : 'search');
  search.setAttribute('aria-label', search.placeholder);
  root().querySelectorAll<HTMLElement>('[data-catalog]').forEach(button => {
    const active = button.dataset.catalog === catalogMode;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  if (characterMode) {
    container.innerHTML = Object.entries(characters).filter(([, c]) => `${characterNames[`Character.${c.characterId}.1`]} ${c.characterId}`.toLowerCase().includes(query.toLowerCase())).map(([skin, c]) =>
      `<button class="housing-furniture ${catalogCharacter === skin ? 'selected' : ''}" data-character="${skin}" aria-label="${esc(characterNames[`Character.${c.characterId}.1`] || c.characterId)}"><img src="assets/char/head_${skin}_S.png" alt="" loading="lazy" draggable="false"><strong>${esc(characterNames[`Character.${c.characterId}.1`] || c.characterId)}</strong><small>3D</small></button>`).join('') || `<p class="housing-help">${t('noResults')}</p>`;
    container.ondragstart = null;
    container.ondblclick = event => {
      const skin = (event.target as HTMLElement).closest<HTMLElement>('[data-character]')?.dataset.character;
      if (skin && characters[skin]) { characterModel = characters[skin]!.model; renderBoard(); renderInspector(); }
    };
    return;
  }
  const compatibleOnly = document.querySelector<HTMLInputElement>('#housing-compatible')?.checked;
  const list = Object.values(furniture).filter(f => !f.NotShow && (!category || f.Tab === category) &&
    (!compatibleOnly || canUseFurniture(f, currentRoom())) && `${name(f.Id)} ${f.Id}`.toLowerCase().includes(query.toLowerCase()));
  container.innerHTML = list.map(f => {
    const supported = canUseFurniture(f, currentRoom());
    const kind = furnitureKind(f);
    const finish = kind === 'wallFinish' || kind === 'floorFinish';
    return `<button class="housing-furniture ${catalogId === f.Id ? 'selected' : ''} ${supported ? '' : 'unavailable'}" data-furniture="${f.Id}" draggable="${supportsPlacement(f, currentRoom()) || (supported && finish)}" aria-label="${esc(name(f.Id))}"${finish ? ` title="${esc(t('finishAction'))}"` : ''}>
      <img src="${image(f.Id)}" alt="" loading="lazy" draggable="false"><strong>${esc(name(f.Id))}</strong><small>${f.L} × ${f.W} · ${availability(f)}</small></button>`;
  }).join('') || `<p class="housing-help">${t('noResults')}</p>`;
  container.ondblclick = event => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-furniture]');
    const f = furniture[Number(card?.dataset.furniture)];
    if (f && (furnitureKind(f) === 'wallFinish' || furnitureKind(f) === 'floorFinish')) addFurniture(f.Id);
  };
  container.ondragstart = event => {
    const card = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-furniture]');
    if (!card?.draggable || !event.dataTransfer) { event.preventDefault(); return; }
    event.dataTransfer.setData('text/plain', card.dataset.furniture!);
    event.dataTransfer.effectAllowed = 'copy';
  };
}

function renderBoard(): void {
  const board = document.getElementById('housing-board')!;
  if (!sceneView) {
    try {
      sceneView = new HousingScene(board, {
        select: uid => {
          catalogMode = 'furniture'; catalogCharacter = ''; renderCatalog();
          selected = uid;
          catalogId = selectedPlacement()?.furnitureId || catalogId;
          renderInspector();
        },
        move: p => moveSelected(p.x, p.y, p.rotation, p.elevation),
        error: id => status(`${t('modelError')} (${id})`),
      });
    } catch (error) { console.error('[Housing 3D]', error); status(t('webglError')); return; }
  }
  const floor = finishId('floor');
  sceneView.update({ indoor: !!currentRoom().RoomType, size: size(), placements: scenePlacements(),
    furniture, selected, floor: floor && furniture[floor]?.NotShow ? undefined : floor, wall: finishId('wall'), grid: showGrid, character: characterModel, expression: characterExpressions[characterModel] || 1 });
  board.ondragover = event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; };
  board.ondrop = event => {
    event.preventDefault();
    const id = Number(event.dataTransfer?.getData('text/plain'));
    const f = furniture[id];
    if (f && (furnitureKind(f) === 'wallFinish' || furnitureKind(f) === 'floorFinish')) {
      addFurniture(id);
      return;
    }
    const wall = furniture[id] && furnitureKind(furniture[id]!) === 'wall' ? wallSide : undefined;
    const point = sceneView?.point(event.clientX, event.clientY, wall);
    if (!point) return;
    addFurniture(id, wall ? (wall === 'left' ? { x: 0, y: point.x } : { x: point.x, y: 0 }) : point);
  };
  const undo = root().querySelector<HTMLButtonElement>('[data-action="undo"]');
  if (undo) undo.disabled = !history.length;
}

function renderInspector(): void {
  inspectorPreview?.dispose(); inspectorPreview = undefined;
  const character = catalogMode === 'characters' ? characters[catalogCharacter] : undefined;
  const f = catalogMode === 'furniture' ? selectedFurniture() : undefined;
  const p = catalogMode === 'furniture' ? selectedPlacement() : undefined;
  const detail = document.getElementById('housing-details')!;
  const compatible = f && canUseFurniture(f, currentRoom());
  const kind = f ? furnitureKind(f) : 'floor';
  const finish = kind === 'floorFinish' || kind === 'wallFinish' || kind === 'fixture';
  document.getElementById('housing-inspector-heading')!.textContent = t(catalogMode === 'characters' ? 'characterDetails' : 'details');
  const modelId = character?.model || (f && !f.NotShow ? String(f.Id) : '');
  const imageUrl = character ? `assets/char/head_${catalogCharacter}_L.png` : f ? image(f.Id) : '';
  const title = character ? characterNames[`Character.${character.characterId}.1`] || String(character.characterId) : f ? name(f.Id) : '';
  const preview = modelId ? `<div class="housing-preview-tabs" role="group" aria-label="${t('previewType')}">
    <button class="btn btn-secondary ${previewMode === '3d' ? 'active' : ''}" data-preview="3d" aria-pressed="${previewMode === '3d'}">3D</button>
    <button class="btn btn-secondary ${previewMode === '2d' ? 'active' : ''}" data-preview="2d" aria-pressed="${previewMode === '2d'}">2D</button></div>
    ${previewMode === '3d' ? `<div id="housing-model-preview" class="housing-model-preview" role="group" aria-label="${esc(title)} 3D"></div><p class="housing-help">${t('previewHelp')}</p>` : `<img class="housing-preview-image" src="${esc(imageUrl)}" alt="${esc(title)}">`}` : '';
  const expressionSelect = character?.expressions?.length ? `<label class="housing-help">${t('expression')}<select class="housing-input" id="housing-expression">${character.expressions.map(id => `<option value="${id}" ${(characterExpressions[character.model] || 1) === id ? 'selected' : ''}>${id === 1 ? t('expressionDefault') : `${t('expression')} ${id}`}</option>`).join('')}</select></label>` : '';
  detail.innerHTML = character ? `${preview}<h3>${esc(title)}</h3>${expressionSelect}<p>${t('characterPreview')}</p><button class="btn btn-primary" data-action="show-character">${t('showCharacter')}</button><button class="btn btn-secondary" data-action="hide-character" ${characterModel ? '' : 'disabled'}>${t('hideCharacter')}</button>` : f ? `${preview}<h3>${esc(name(f.Id))}</h3>
    <p>${f.L} × ${f.W} × ${f.H}<br>${t('collection')}: ${f.CollectionValue || 0}<br>${t('category')}: ${t(`category${f.Tab}`)}${p ? `<br>X ${p.x} · Y ${p.y} · ${p.rotation}°` : ''}</p>
    <p>${esc(names[items[f.Id]?.Desc || ''] || '')}</p>
    <p>${esc(availability(f))}${kind === 'fixture' ? `<br>${t('fixedHint')}` : ''}${kind === 'wall' ? `<br>${t('wallHint')}` : ''}</p>` : `<p class="housing-help">${t(catalogMode === 'characters' ? 'selectCharacter' : 'selectFurniture')}</p>`;
  const previewHost = document.getElementById('housing-model-preview');
  if (previewHost && modelId) {
    try {
      inspectorPreview = new HousingPreview(previewHost, modelId, () => { previewHost.textContent = t('modelError'); });
      if (character) inspectorPreview.setExpression(characterExpressions[character.model] || 1);
    }
    catch (error) { console.error('[Housing preview]', error); previewHost.textContent = t('webglError'); }
  }
  const expressionInput = document.getElementById('housing-expression') as HTMLSelectElement | null;
  if (expressionInput && character) expressionInput.onchange = () => {
    const value = Number(expressionInput.value);
    if (!character.expressions?.includes(value)) return;
    characterExpressions[character.model] = value;
    inspectorPreview?.setExpression(value);
    if (characterModel === character.model) sceneView?.setExpression(value);
  };
  const add = root().querySelector<HTMLButtonElement>('[data-action="add"]')!;
  add.disabled = !compatible || (!finish && placements().length >= 200);
  add.textContent = finish ? t(kind === 'fixture' ? 'replaceFixture' : 'applyFinish') : p ? t('duplicate') : t('add');
  for (const action of ['rotate', 'delete']) root().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled = !p || isFixed(p);
  root().querySelector<HTMLButtonElement>('[data-action="rotate"]')!.textContent = kind === 'wall' ? t('switchWall') : t('rotate');
  root().querySelector<HTMLButtonElement>('[data-action="reset-decor"]')!.disabled = !layout.decorations?.[roomId];
  const mounts = document.getElementById('housing-mount-controls')!;
  mounts.hidden = !f || kind !== 'wall' || !compatible;
  if (!mounts.hidden && f) {
    const side = p?.wall || wallSide;
    const elevation = p?.elevation ?? Math.min(wallElevation, Math.max(0, (size().H || 5) - f.H));
    mounts.innerHTML = `<label>${t('wallSide')}<select class="housing-input" id="housing-wall-side"><option value="left" ${side === 'left' ? 'selected' : ''}>${t('leftWall')}</option><option value="right" ${side === 'right' ? 'selected' : ''}>${t('rightWall')}</option></select></label>
      <label>${t('elevation')}<select class="housing-input" id="housing-wall-height">${Array.from({ length: Math.max(0, (size().H || 5) - f.H) + 1 }, (_, h) => `<option value="${h}" ${h === elevation ? 'selected' : ''}>${h}</option>`).join('')}</select></label>`;
    const update = (): void => {
      const nextSide = (document.getElementById('housing-wall-side') as HTMLSelectElement).value as 'left' | 'right';
      const height = Number((document.getElementById('housing-wall-height') as HTMLSelectElement).value);
      changeWallMount(nextSide, height);
    };
    mounts.querySelectorAll('select').forEach(select => { select.onchange = update; });
  }
  const unique = new Set([...scenePlacements().map(p => p.furnitureId), finishId('wall'), finishId('floor')].filter((id): id is number => id !== undefined));
  const score = [...unique].reduce((sum, id) => sum + (furniture[id]?.CollectionValue || 0), 0);
  document.getElementById('housing-summary')!.innerHTML = `<p>${t('placed')}: ${placements().length} / 200</p><p>${t('unique')}: ${unique.size}</p><p>${t('collection')}: ${score}</p><p class="housing-help">${t('scoreNote')}</p>`;
}

function applyDecoration(f: Furniture): void {
  if (!canUseFurniture(f, currentRoom())) { status(availability(f)); return; }
  const kind = furnitureKind(f);
  const key = kind === 'floorFinish' ? 'floor' : kind === 'wallFinish' ? 'wall' : 'fixture';
  if (key === 'fixture') {
    const replacement = fixturePlacement(currentRoom(), defaults, furniture, f.Id);
    if (!replacement || !canPlace(replacement, scenePlacements(), furniture, size(), allowOverlap)) { notifyInvalid(); return; }
  }
  remember();
  ((layout.decorations ||= {})[roomId] ||= {})[key] = f.Id;
  selected = ''; catalogId = f.Id;
  if (commit()) status(t('applied'));
}

function changeWallMount(side: 'left' | 'right', elevation: number): void {
  const p = selectedPlacement();
  if (p && furnitureKind(furniture[p.furnitureId]!) === 'wall') {
    const offset = p.wall === 'left' ? p.y : p.x;
    const candidate: Placement = { ...p, wall: side, elevation, rotation: side === 'left' ? 90 : 0, x: side === 'left' ? 0 : offset, y: side === 'left' ? offset : 0 };
    if (!canPlace(candidate, scenePlacements(), furniture, size(), allowOverlap)) { notifyInvalid(); renderInspector(); return; }
    remember(); Object.assign(p, candidate);
    wallSide = side; wallElevation = elevation;
    if (commit()) status(t('updated'));
  } else { wallSide = side; wallElevation = elevation; }
}


function addFurniture(id: number, point?: { x: number; y: number }, template?: Placement): void {
  const f = furniture[id];
  if (!f || !canUseFurniture(f, currentRoom())) { status(f ? availability(f) : t('unsupported')); return; }
  const kind = furnitureKind(f);
  if (kind === 'floorFinish' || kind === 'wallFinish' || kind === 'fixture') { applyDecoration(f); return; }
  if (placements().length >= 200) { status(t('limit')); return; }
  const candidate: Placement = { uid: crypto.randomUUID(), furnitureId: id, x: point ? Math.floor(point.x) : 0, y: point ? Math.floor(point.y) : 0, rotation: template?.rotation ?? 0 };
  if (kind === 'wall') {
    candidate.wall = template?.wall || wallSide;
    candidate.elevation = Math.min(template?.elevation ?? wallElevation, Math.max(0, (size().H || 5) - f.H));
    candidate.rotation = candidate.wall === 'left' ? 90 : 0;
    candidate.x = candidate.wall === 'left' ? 0 : Math.max(0, candidate.x);
    candidate.y = candidate.wall === 'right' ? 0 : Math.max(0, candidate.y);
  }
  if (!point) {
    let found = false;
    const maxX = candidate.wall === 'left' ? 1 : size().L;
    const maxY = candidate.wall === 'right' ? 1 : size().W;
    for (let y = 0; y < maxY && !found; y++) for (let x = 0; x < maxX && !found; x++) {
      candidate.x = x; candidate.y = y;
      found = canPlace(candidate, scenePlacements(), furniture, size(), allowOverlap);
    }
    if (!found) { notifyInvalid(); return; }
  }
  if (!canPlace(candidate, scenePlacements(), furniture, size(), allowOverlap)) { notifyInvalid(); return; }
  remember();
  (layout.rooms[roomId] ||= []).push(candidate);
  selected = candidate.uid; catalogId = id;
  if (commit()) status(t('added'));
}

function moveSelected(x: number, y: number, rotation?: number, elevation?: number): void {
  const p = selectedPlacement();
  if (!p || isFixed(p)) return;
  const candidate = { ...p, x, y, rotation: rotation ?? p.rotation };
  if (p.wall) candidate.elevation = elevation ?? p.elevation;
  if (!canPlace(candidate, scenePlacements(), furniture, size(), allowOverlap)) { notifyInvalid(); return; }
  remember(); Object.assign(p, candidate); if (commit()) status(t('updated'));
}


function handleClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!target || target.disabled) return;
  if (target.dataset.catalog) {
    catalogMode = target.dataset.catalog as typeof catalogMode;
    query = ''; root().querySelector<HTMLInputElement>('#housing-search')!.value = '';
    renderCatalog(); renderInspector(); return;
  }
  if (target.dataset.preview) {
    previewMode = target.dataset.preview as typeof previewMode;
    renderInspector(); return;
  }
  if (target.dataset.character) {
    catalogCharacter = target.dataset.character; selected = '';
    root().querySelectorAll<HTMLElement>('[data-character]').forEach(card => card.classList.toggle('selected', card.dataset.character === catalogCharacter));
    renderInspector(); return;
  }
  if (target.dataset.room) {
    roomId = target.dataset.room; selected = ''; render(); return;
  }
  if (target.dataset.category !== undefined) {
    category = Number(target.dataset.category);
    root().querySelectorAll<HTMLElement>('[data-category]').forEach(button => {
      const active = button === target;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    renderCatalog(); return;
  }
  if (target.dataset.furniture) {
    catalogId = Number(target.dataset.furniture); selected = '';
    // Keep the clicked card mounted so the browser can recognize a double-click.
    root().querySelectorAll<HTMLElement>('[data-furniture]').forEach(card => card.classList.toggle('selected', Number(card.dataset.furniture) === catalogId));
    renderBoard(); renderInspector(); return;
  }
  const p = selectedPlacement();
  switch (target.dataset.action) {
    case 'show-character':
      characterModel = characters[catalogCharacter]?.model || ''; renderBoard(); renderInspector(); break;
    case 'hide-character':
      characterModel = ''; renderBoard(); renderInspector(); break;
    case 'add': addFurniture(selectedFurniture()?.Id || 0); break;
    case 'rotate':
      if (p?.wall) changeWallMount(p.wall === 'left' ? 'right' : 'left', p.elevation ?? 1);
      else if (p) moveSelected(p.x, p.y, (p.rotation + 90) % 360);
      break;
    case 'delete':
      if (p && !isFixed(p)) { remember(); layout.rooms[roomId] = placements().filter(item => item.uid !== p.uid); selected = ''; if (commit()) status(t('deleted')); }
      break;
    case 'reset-decor':
      if (layout.decorations?.[roomId]) { remember(); delete layout.decorations[roomId]; selected = ''; if (commit()) status(t('applied')); }
      break;
    case 'undo':
      undo();
      break;
    case 'save':
      if (persist()) { status(t('saved')); showToast(t('saved'), 'success'); }
      else showToast(t('saveError'), 'error');
      break;
    case 'clear':
      if ((placements().length || layout.decorations?.[roomId]) && confirm(t('confirmClear'))) { remember(); layout.rooms[roomId] = []; if (layout.decorations) delete layout.decorations[roomId]; selected = ''; commit(); }
      break;
    case 'share': void share(); break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'sstoy-housing.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); break;
    }
    case 'import': document.getElementById('housing-file')!.click(); break;
  }
}

function copyFurniture(event: ClipboardEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('input,select,textarea,[contenteditable="true"]') || window.getSelection()?.toString()) return;
  const p = selectedPlacement();
  if (!p || isFixed(p) || !event.clipboardData) return;
  event.clipboardData.setData('text/plain', furnitureClipboardPrefix + JSON.stringify({ furnitureId: p.furnitureId, rotation: p.rotation, wall: p.wall, elevation: p.elevation }));
  event.preventDefault();
  status(t('furnitureCopied')); showToast(t('furnitureCopied'), 'success');
}

function pasteFurniture(event: ClipboardEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text.startsWith(furnitureClipboardPrefix)) return;
  event.preventDefault();
  try {
    if (text.length > 1000) throw new Error('Oversized furniture clipboard');
    const data = JSON.parse(text.slice(furnitureClipboardPrefix.length)) as Partial<Placement>;
    if (!data || !Number.isInteger(data.furnitureId) || ![0, 90, 180, 270].includes(data.rotation!) ||
      (data.wall !== undefined && !['left', 'right'].includes(data.wall)) ||
      (data.elevation !== undefined && (!Number.isInteger(data.elevation) || data.elevation < 0))) throw new Error('Invalid furniture clipboard');
    addFurniture(data.furnitureId!, undefined, { uid: 'clipboard', furnitureId: data.furnitureId!, x: 0, y: 0, rotation: data.rotation!, wall: data.wall, elevation: data.elevation });
  } catch { status(t('importError')); }
}

function handleKeyboard(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.altKey || event.shiftKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && history.length) { event.preventDefault(); undo(); }
    return;
  }
  if (event.altKey || !selected || !target.closest('.housing-board')) return;
  const p = selectedPlacement();
  if (!p || isFixed(p)) return;
  const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (delta[event.key]) {
    event.preventDefault(); const [x, y] = delta[event.key]!;
    if (p.wall && y) changeWallMount(p.wall, (p.elevation ?? 1) - y);
    else if (p.wall) moveSelected(p.wall === 'right' ? p.x + x : 0, p.wall === 'left' ? p.y + x : 0);
    else moveSelected(p.x + x, p.y + y);
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault(); if (p.wall) changeWallMount(p.wall === 'left' ? 'right' : 'left', p.elevation ?? 1); else moveSelected(p.x, p.y, (p.rotation + 90) % 360);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); root().querySelector<HTMLButtonElement>('[data-action="delete"]')?.click();
  } else return;
  document.querySelector<HTMLElement>(`[data-placement="${selected}"]`)?.focus({ preventScroll: true });
}

async function share(): Promise<void> {
  const url = `${location.origin}${location.pathname}${encodeHousingShare(layout, roomId)}`;
  const box = document.getElementById('housing-share')!;
  box.hidden = false;
  const input = document.getElementById('housing-share-url') as HTMLInputElement;
  input.value = url;
  try { await navigator.clipboard.writeText(url); status(t('copied')); }
  catch { input.focus(); input.select(); status(t('copyManually')); }
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Oversized file');
    const next = validateLayout(JSON.parse(await file.text()), furniture, rooms, sizes);
    if (!confirm(t('confirmImport'))) return;
    remember(); layout = next; selected = ''; if (commit()) status(t('imported'));
  } catch { status(t('importError')); }
  finally { input.value = ''; }
}
