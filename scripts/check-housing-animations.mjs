import { readFile } from 'node:fs/promises';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const folder = new URL('../public/assets/housing/models/', import.meta.url);
const characters = JSON.parse(await readFile(new URL('characters.json', folder), 'utf8'));
let count = 0;
for (const character of Object.values(characters)) {
  if (!character.animation) continue;
  const bytes = await readFile(new URL(`${character.model}.glb`, folder));
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  // Geometry/animation validation runs without a browser image decoder.
  delete doc.images; delete doc.textures; delete doc.samplers;
  for (const material of doc.materials) {
    if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture;
  }
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const binary = bytes.subarray(28 + jsonLength);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.write('JSON', 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length); binHeader.write('BIN\0', 4);
  const rebuilt = Buffer.concat([header, json, binHeader, binary]);
  const gltf = await new GLTFLoader().parseAsync(rebuilt.buffer.slice(rebuilt.byteOffset, rebuilt.byteOffset + rebuilt.byteLength), '');
  if (gltf.animations.length !== 1) throw new Error(`Missing idle animation: ${character.model}`);
  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations[0]).play();
  const samples = [];
  for (const time of [0, gltf.animations[0].duration * .31, gltf.animations[0].duration * .68]) {
    mixer.setTime(time); gltf.scene.updateMatrixWorld(true);
    const points = [];
    gltf.scene.traverse(node => {
      if (!node.isSkinnedMesh || node.name.startsWith('expression_')) return;
      node.skeleton.update();
      for (let index = 0; index < node.geometry.attributes.position.count; index += 37) {
        const point = node.getVertexPosition(index, new Vector3()).applyMatrix4(node.matrixWorld);
        if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`Invalid skin: ${character.model}`);
        points.push(point);
      }
    });
    const bounds = new Box3().setFromPoints(points);
    if (bounds.getSize(new Vector3()).length() > 5) throw new Error(`Exploding skin: ${character.model}`);
    samples.push(points);
  }
  if (!samples[0].some((point, index) => point.distanceTo(samples[1][index]) > .001)) throw new Error(`Static animation: ${character.model}`);
  mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
  console.log(`${character.model}: ${gltf.animations[0].tracks.length} tracks, finite moving vertices`);
  count++;
}
if (!count) throw new Error('No animated housing characters');
console.log(`Verified ${count} original skeletal idle animations.`);
