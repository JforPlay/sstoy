import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { setCharacterExpression } from './housing-expression';

const models = new Map<string, Promise<THREE.Group>>();

async function checkTextures(gltf: GLTF, id: string): Promise<void> {
  // GLTFLoader can resolve successfully with null textures after a decode error.
  const textures: Array<THREE.Texture | null> = await gltf.parser.getDependencies('texture');
  for (const texture of textures) {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    if (!texture || !image?.width || !image.height) throw new Error(`Incomplete housing texture: ${id}`);
  }
  if (id === 'outdoor') {
    let terrainCount = 0;
    gltf.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh) || !node.name.includes('Terrain01')) return;
      terrainCount++;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some(material => !(material instanceof THREE.MeshStandardMaterial) || !material.map)) {
        throw new Error('Outdoor terrain has no ground texture');
      }
    });
    if (!terrainCount) throw new Error('Outdoor terrain is missing');
  }
}

async function readModel(id: string): Promise<THREE.Group> {
  const url = new URL(`assets/housing/models/${id}.glb`, document.baseURI);
  let bytes: ArrayBuffer | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!bytes) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Housing model ${id}: HTTP ${response.status}`);
        bytes = await response.arrayBuffer();
      }
      const loader = new GLTFLoader();
      if (attempt) {
        // Retry decoding the same file through HTMLImageElement instead of ImageBitmap.
        loader.register(parser => ({
          name: 'HousingTextureFallback',
          beforeRoot: () => {
            parser.textureLoader = new THREE.TextureLoader(parser.options.manager).setCrossOrigin(parser.options.crossOrigin);
            return null;
          },
        }));
      }
      const gltf = await loader.parseAsync(bytes, new URL('.', url).href);
      await checkTextures(gltf, id);
      setCharacterExpression(gltf.scene);
      return gltf.scene;
    } catch (error) {
      if (attempt) throw error;
      console.warn('[Housing] Retrying model with complete textures:', id, error);
    }
  }
  throw new Error(`Housing model unavailable: ${id}`);
}

export function loadHousingModel(id: string): Promise<THREE.Group> {
  let pending = models.get(id);
  if (!pending) {
    pending = readModel(id);
    models.set(id, pending);
    void pending.catch(() => { if (models.get(id) === pending) models.delete(id); });
  }
  return pending;
}
