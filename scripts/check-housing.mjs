/** Run with node scripts/check-housing.mjs. Uses the project's TypeScript compiler. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/modules/housing-layout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { footprint, fitsRoom, supportsPlacement, canPlace, validateLayout, fixturePlacement, projectPoint, unprojectPoint, projectedPlacement } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const read = file => JSON.parse(fs.readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'));
const furniture = read('DormFurniture'), rooms = read('DormRoom'), sizes = read('DormRoomSize');
const f = furniture['700002'], room = rooms['701001'], size = sizes['0'];
assert.deepEqual(footprint(f, 0), { L: 1, W: 2 });
assert.deepEqual(footprint(f, 90), { L: 2, W: 1 });
assert(supportsPlacement(f, room));
assert(!supportsPlacement(furniture['720001'], room));
assert(supportsPlacement(furniture['720009'], rooms['701002']));
const wall = { uid: 'wall', furnitureId: 720009, x: 2, y: 0, rotation: 0, wall: 'right', elevation: 1 };
assert(fitsRoom(wall, furniture['720009'], sizes['1']));
assert(!fitsRoom({ ...wall, elevation: 4 }, furniture['720009'], sizes['1']));
assert(!fitsRoom({ ...wall, x: 15 }, furniture['720009'], sizes['1']));
assert(!canPlace({ ...wall, uid: 'wall2' }, [wall], furniture, sizes['1']));
assert(canPlace({ ...wall, uid: 'wall2', wall: 'left', x: 0, y: 2, rotation: 90 }, [wall], furniture, sizes['1']));
const decorated = { version: 1, rooms: { '701002': [wall] }, decorations: { '701002': { wall: 720039, floor: 720040, fixture: 720003 } } };
assert.deepEqual(validateLayout(decorated, furniture, rooms, sizes), decorated);
assert.throws(() => validateLayout({ ...decorated, decorations: { '701002': { floor: 700002 } } }, furniture, rooms, sizes));
assert.throws(() => validateLayout({ ...decorated, rooms: { '701002': [{ ...wall, uid: 'fixture-701002' }] } }, furniture, rooms, sizes));
const fixed = fixturePlacement(room, Object.values(read('DormRoomLayout')), furniture);
assert.equal(fixed.furnitureId, 720011);
assert.equal(fixed.uid, 'fixture-701001');
const first = { uid: 'first', furnitureId: f.Id, x: 0, y: 0, rotation: 0 };
for (const dimensions of Object.values(sizes)) {
  for (const [x, y] of [[0, 0], [dimensions.L, 0], [0, dimensions.W], [dimensions.L, dimensions.W], [3.25, 5.75]]) {
    const screen = projectPoint(x, y, dimensions);
    const grid = unprojectPoint(screen.x, screen.y, dimensions);
    assert(Math.abs(grid.x - x) < 1e-9 && Math.abs(grid.y - y) < 1e-9);
  }
  const a = projectPoint(3, 4, dimensions), b = projectPoint(4, 4, dimensions), c = projectPoint(3, 5, dimensions);
  assert(b.x > a.x && b.y > a.y && c.x < a.x && c.y > a.y);
}
const projected = projectedPlacement(first, f, size);
assert.equal(projected.corners.length, 4);
assert(projected.anchor.y <= projected.depth && projected.width > 0 && projected.height > 0);
assert(projectedPlacement({ ...first, x: 4, y: 4 }, f, size).depth > projected.depth);
assert(projectedPlacement({ ...first, rotation: 90 }, f, size).width > 0);
assert(fitsRoom(first, f, size));
assert(!fitsRoom({ ...first, x: -1 }, f, size));
assert(!fitsRoom({ ...first, y: 19 }, f, size));
assert(!canPlace({ ...first, uid: 'second' }, [first], furniture, size));
assert(canPlace({ ...first, uid: 'second' }, [first], furniture, size, true));
assert(canPlace({ ...first, uid: 'second', x: 1 }, [first], furniture, size));
assert(canPlace(first, [first], furniture, size));
const rug = Object.values(furniture).find(item => item.PutType === 2 && item.CanIn.includes(0));
assert(canPlace({ ...first, uid: 'rug', furnitureId: rug.Id }, [first], furniture, size));
const valid = { version: 1, rooms: { '701001': [first] } };
assert.deepEqual(validateLayout(valid, furniture, rooms, sizes), valid);
for (const bad of [null, {}, { ...valid, version: 2 }, { version: 1, rooms: [] }, { version: 1, rooms: { 'bad': [] } }, { version: 1, rooms: JSON.parse('{"__proto__":[]}') }]) {
  assert.throws(() => validateLayout(bad, furniture, rooms, sizes));
}
for (const p of [{ ...first, furnitureId: 1 }, { ...first, x: 1000 }, { ...first, y: .5 }, { ...first, rotation: 45 }, { ...first, uid: '\" onclick=' }, { ...first, furnitureId: 720001 }]) {
  assert.throws(() => validateLayout({ version: 1, rooms: { '701001': [p] } }, furniture, rooms, sizes));
}
assert.throws(() => validateLayout({ version: 1, rooms: { '701001': [first, first] } }, furniture, rooms, sizes));
assert.throws(() => validateLayout({ version: 1, rooms: { '701001': Array(201).fill(first) } }, furniture, rooms, sizes));
const visible = Object.values(furniture).filter(item => !item.NotShow);
const modelRoot = new URL('../public/assets/housing/models/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', modelRoot), 'utf8'));
for (const id of [...visible.map(item => String(item.Id)), 'outdoor', 'indoor']) {
  const info = manifest.furniture[id] || manifest.scenes[id];
  assert(info && info.nodes > 0 && info.unresolved === 0, `Incomplete model ${id}`);
  const binary = fs.readFileSync(new URL(info.file, modelRoot));
  assert.equal(binary.toString('ascii', 0, 4), 'glTF', `Invalid GLB ${id}`);
  assert.equal(binary.readUInt32LE(4), 2);
  assert.equal(binary.readUInt32LE(8), binary.length);
}
for (const name of ['floor_indoor.png', 'floor_outdoor.png', 'floor_720002.png', 'wall_720001.png', 'wall_720039.png']) assert(fs.existsSync(new URL(`../public/assets/housing/${name}`, import.meta.url)), `Missing surface ${name}`);
for (const item of visible) {
  assert(fs.existsSync(new URL(`../public/assets/housing/item_${item.Id}.png`, import.meta.url)), `Missing icon ${item.Id}`);
  assert(item.L > 0 && item.W > 0 && Array.isArray(item.CanIn));
}
for (const lang of ['ko', 'en', 'jp']) {
  const dictionary = JSON.parse(fs.readFileSync(new URL(`../public/lang/${lang}.json`, import.meta.url), 'utf8'));
  assert(dictionary.nav.housing);
  for (const key of Object.keys(JSON.parse(fs.readFileSync(new URL('../public/lang/ko.json', import.meta.url), 'utf8')).housing)) assert(dictionary.housing[key], `${lang}: ${key}`);
}
console.log(`Housing checks passed: placement, wall mounting, finishes, collisions, import validation, ${visible.length} icons and 3D models, two scenes, three UI languages.`);
