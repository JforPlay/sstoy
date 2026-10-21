"""Convert local Unity housing assets to GLB. No game process or network access.

Requires UnityPy, numpy, trimesh and Pillow. Original game files are read-only.
"""
from __future__ import annotations
import argparse
import io
import json
import lzma
import re
import struct
from pathlib import Path
import numpy as np
import trimesh
import UnityPy
import lz4.block
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler
from UnityPy.classes.PPtr import PPtr


def cstring(stream):
    data = bytearray()
    while True:
        char = stream.read(1)
        if not char or char == b'\0':
            return data.decode('utf-8', 'replace')
        data.extend(char)


def bundle_nodes(path):
    """Read only the UnityFS directory, not all of the mesh/texture data."""
    with path.open('rb') as stream:
        if cstring(stream) != 'UnityFS':
            return []
        version = struct.unpack('>I', stream.read(4))[0]
        cstring(stream)
        cstring(stream)
        total, compressed, original, flags = struct.unpack('>QIII', stream.read(20))
        if version >= 7:
            stream.seek((stream.tell() + 15) // 16 * 16)
        if flags & 128:
            stream.seek(total - compressed)
        raw = stream.read(compressed)
        compression = flags & 63
        if compression in (2, 3):
            raw = lz4.block.decompress(raw, uncompressed_size=original)
        elif compression == 1:
            raw = lzma.decompress(raw)
        directory = io.BytesIO(raw)
        directory.seek(16)
        blocks = struct.unpack('>I', directory.read(4))[0]
        directory.seek(blocks * 10, 1)
        count = struct.unpack('>I', directory.read(4))[0]
        names = []
        for _ in range(count):
            directory.read(20)
            names.append(cstring(directory).lower())
        return names


def cab_index(roots):
    index = {}
    for root in reversed(roots):
        for path in root.glob('*.unity3d'):
            try:
                for name in bundle_nodes(path):
                    index[name] = path
            except (ValueError, struct.error, EOFError, lz4.block.LZ4BlockError):
                continue
    return index


def load_environment(path, index):
    env = UnityPy.load(str(path))
    target_files = list(env.assets)
    seen = set()
    missing = set()
    while True:
        pending = []
        for assets in list(env.assets):
            for external in assets.externals:
                name = external.path.split('/')[-1].lower()
                if name in seen or name in env.cabs:
                    continue
                seen.add(name)
                dependency = index.get(name)
                if dependency:
                    pending.append(dependency)
                elif name.startswith('cab-'):
                    missing.add(name)
        if not pending:
            break
        for dependency in dict.fromkeys(pending):
            env.load_file(str(dependency))
    return env, target_files, missing


def key(value):
    reader = value.object_reader
    return (reader.assets_file.name, reader.path_id)


def read(pointer):
    if not pointer or not pointer.path_id:
        return None
    try:
        return pointer.read()
    except (FileNotFoundError, KeyError, ValueError):
        return None


class Converter:
    def __init__(self, env, files, texture_limit=1024, prefab=False):
        self.env, self.files = env, files
        self.texture_limit = texture_limit
        self.prefab = prefab
        self.transforms, self.filters, self.worlds, self.active = {}, {}, {}, {}
        self.materials, self.geometries = {}, {}
        self.unresolved = 0
        self.scene = trimesh.Scene()
        self.mirror = np.diag([-1., 1., 1., 1.])
        for assets in files:
            for obj in assets.objects.values():
                if obj.type.name == 'Transform':
                    value = obj.read()
                    go = read(value.m_GameObject)
                    if go:
                        self.transforms[key(go)] = value
                elif obj.type.name == 'MeshFilter':
                    value = obj.read()
                    go = read(value.m_GameObject)
                    if go:
                        self.filters[key(go)] = value

    def world(self, transform):
        k = key(transform)
        if k in self.worlds:
            return self.worlds[k]
        p, q, scale = transform.m_LocalPosition, transform.m_LocalRotation, transform.m_LocalScale
        matrix = trimesh.transformations.quaternion_matrix([q.w, q.x, q.y, q.z])
        matrix[:3, :3] = matrix[:3, :3] @ np.diag([scale.x, scale.y, scale.z])
        matrix[:3, 3] = [p.x, p.y, p.z]
        parent = read(transform.m_Father)
        if parent:
            matrix = self.world(parent) @ matrix
        self.worlds[k] = matrix
        return matrix

    def enabled(self, transform):
        k = key(transform)
        if k in self.active:
            return self.active[k]
        go = read(transform.m_GameObject)
        parent = read(transform.m_Father)
        enabled = bool(go and go.m_IsActive and (not parent or self.enabled(parent)))
        if go and any(token in go.m_Name.lower() for token in ['collider', 'dot_line', 'navicut', 'interactive_root', '_col', 't_fur_cut', 'soundeffect', 'fx_dorm', 'local fog']):
            enabled = False
        self.active[k] = enabled
        return enabled

    def model_matrix(self, transform):
        if not self.prefab:
            return self.world(transform)
        parent, model_root, root = transform, None, transform
        while parent:
            root = parent
            go = read(parent.m_GameObject)
            if go and go.m_Name in ('==model_root==', '==bubble_root=='):
                model_root = parent
            parent = read(parent.m_Father)
        # Bundles also contain editor-preview meshes outside the actual prefab.
        if model_root is None:
            return None
        return np.linalg.inv(self.world(root)) @ self.world(transform)

    def terrain_texture(self, textures, source):
        def texture_image(entry):
            if not entry:
                return None
            texture = read(PPtr(**entry['m_Texture'], assetsfile=source.object_reader.assets_file))
            return texture.image.convert('RGBA') if texture else None
        control = texture_image(textures.get('_Control'))
        if control is None:
            return None
        resolution = 2048
        # Control-map alpha is a fourth weight, not transparency. RGBA resize would
        # premultiply away RGB weights where alpha is zero.
        weights = np.stack([np.asarray(channel.resize((resolution, resolution), Image.Resampling.BILINEAR), dtype=np.float32) for channel in control.split()], axis=2) / 255
        weights /= np.maximum(weights.sum(axis=2, keepdims=True), .001)
        result = np.zeros((resolution, resolution, 3), dtype=np.float32)
        coords = (np.arange(resolution) + .5) / resolution
        for channel in range(4):
            entry = textures.get(f'_Splat{channel + 1}')
            image = texture_image(entry)
            if image is None:
                raise ValueError(f'Missing terrain layer {channel + 1} in {source.m_Name}')
            pixels = np.asarray(image, dtype=np.float32)[:, :, :3]
            scale, offset = entry['m_Scale'], entry['m_Offset']
            u = ((coords * scale['x'] + offset['x']) % 1 * image.width).astype(int)
            v = (((1 - coords) * scale['y'] + offset['y']) % 1 * image.height).astype(int)
            sample = pixels[(image.height - 1 - v)[:, None], u[None, :]]
            result += sample * weights[:, :, channel:channel + 1]
        return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))

    def material(self, pointer):
        source = read(pointer)
        if source is None:
            return trimesh.visual.material.PBRMaterial(name='default', baseColorFactor=[200, 210, 190, 255], roughnessFactor=1, metallicFactor=0)
        k = key(source)
        if k in self.materials:
            return self.materials[k]
        tree = source.object_reader.read_typetree()
        saved = tree.get('m_SavedProperties', {})
        textures = dict(saved.get('m_TexEnvs', []))
        colors = dict(saved.get('m_Colors', []))
        floats = dict(saved.get('m_Floats', []))
        image = None
        if '_Control' in textures and '_Splat1' in textures:
            image = self.terrain_texture(textures, source)
        for name in ['_BaseMap', '_MainTex', '_Albedo', '_Diffuse', '_ColorMap', '_GrassColorMap', '_GrassColormap']:
            entry = textures.get(name)
            if not entry:
                continue
            ptr = entry['m_Texture']
            texture = read(PPtr(**ptr, assetsfile=source.object_reader.assets_file))
            if texture and hasattr(texture, 'image'):
                image = texture.image.convert('RGBA')
                image.thumbnail((self.texture_limit, self.texture_limit))
                break
        color = colors.get('_BaseColor', colors.get('_Color', dict(r=1, g=1, b=1, a=1)))
        rgba = [int(np.clip(color[c], 0, 1) * 255) for c in 'rgba']
        # Shader tint is retained; game-specific lighting is approximated in the web viewer.
        alpha = 'BLEND' if rgba[3] < 250 else 'MASK' if image is not None and image.mode == 'RGBA' and image.getextrema()[3][0] < 250 else 'OPAQUE'
        mat = trimesh.visual.material.PBRMaterial(name=source.m_Name, baseColorTexture=image,
            baseColorFactor=rgba, roughnessFactor=1, metallicFactor=0, doubleSided=True,
            alphaMode=alpha, alphaCutoff=max(.05, floats.get('_Cutoff', .35)))
        self.materials[k] = mat
        return mat

    def mesh_positions(self, handler, mesh, renderer, transform):
        return np.array(handler.m_Vertices, dtype=np.float32)[:, :3]

    def prepare_renderer(self, renderer):
        return renderer

    def renderer_allowed(self, renderer, go):
        return renderer.m_Enabled and go

    def convert(self):
        duplicate = set()
        nodes = 0
        for assets in self.files:
            for obj in assets.objects.values():
                if obj.type.name not in ('MeshRenderer', 'SkinnedMeshRenderer'):
                    continue
                renderer = self.prepare_renderer(obj.read())
                go = read(renderer.m_GameObject)
                if not go or not self.renderer_allowed(renderer, go):
                    continue
                if not self.prefab and go.m_Name in ('Sphere', 'Cylinder', 'Cylinder (2)'):
                    continue
                transform, mesh_filter = self.transforms.get(key(go)), self.filters.get(key(go))
                skinned = obj.type.name == 'SkinnedMeshRenderer'
                if not transform or (not mesh_filter and not skinned) or not self.enabled(transform):
                    continue
                model_matrix = self.model_matrix(transform)
                if model_matrix is None:
                    continue
                matrix = self.mirror @ model_matrix @ self.mirror
                if abs(np.linalg.det(matrix[:3, :3])) < 1e-9:
                    continue
                mesh = read(renderer.m_Mesh if skinned else mesh_filter.m_Mesh)
                if not mesh:
                    if mesh_filter and mesh_filter.m_Mesh.path_id:
                        self.unresolved += 1
                    continue
                handler = MeshHandler(mesh)
                handler.process()
                if not handler.m_Vertices:
                    continue
                positions = self.mesh_positions(handler, mesh, renderer, transform)
                positions[:, 0] *= -1
                uv = np.array(handler.m_UV0, dtype=np.float32)[:, :2] if handler.m_UV0 else None
                normals = np.array(handler.m_Normals, dtype=np.float32)[:, :3] if handler.m_Normals else None
                if normals is not None:
                    normals[:, 0] *= -1
                # Unity texture origin is bottom-left. trimesh's GLTF exporter flips V on export.
                for sub, triangles in enumerate(handler.get_triangles()):
                    if not triangles:
                        continue
                    material_pointer = renderer.m_Materials[min(sub, len(renderer.m_Materials) - 1)] if renderer.m_Materials else None
                    material_id = (material_pointer.file_id, material_pointer.path_id) if material_pointer else (0, 0)
                    signature = (key(mesh), sub, material_id, matrix.round(6).tobytes())
                    if signature in duplicate:
                        continue
                    duplicate.add(signature)
                    geometry_key = str((key(mesh), sub, str(key(read(material_pointer))) if read(material_pointer) else 'default'))
                    if geometry_key not in self.scene.geometry:
                        faces = np.array(triangles, dtype=np.int64)[:, ::-1]
                        visual = trimesh.visual.TextureVisuals(uv=uv, material=self.material(material_pointer))
                        geometry = trimesh.Trimesh(vertices=positions, faces=faces, vertex_normals=normals, visual=visual, process=False)
                        self.scene.geometry[geometry_key] = geometry
                    self.scene.graph.update(frame_to=f'{go.m_Name}_{nodes}', matrix=matrix, geometry=geometry_key)
                    nodes += 1
        if not nodes:
            raise ValueError('No renderable geometry')
        return self.scene, dict(nodes=nodes, geometry=len(self.scene.geometry), materials=len(self.materials), unresolved=self.unresolved,
            bounds=self.scene.bounds.tolist())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--install', type=Path, default=Path(r'C:\YostarGames\StellaSora_KR\StellaSora_Data\StreamingAssets\InstallResource'))
    parser.add_argument('--bundles', type=Path, default=Path(r'C:\YostarGames\StellaSora_KR\Persistent_Store\AssetBundles'))
    parser.add_argument('--ids', nargs='*', type=int)
    parser.add_argument('--scenes', action='store_true')
    args = parser.parse_args()
    roots = [args.bundles, args.install]
    print('Indexing Unity bundle directories...', flush=True)
    index = cab_index(roots)
    print(f'Indexed {len(index)} internal files.', flush=True)
    target = args.site / 'public/assets/housing/models'
    target.mkdir(parents=True, exist_ok=True)
    manifest_path = target / 'manifest.json'
    manifest = json.loads(manifest_path.read_text('utf-8')) if manifest_path.exists() else dict(furniture={}, scenes={})
    data = json.loads((args.site / 'public/data/DormFurniture.json').read_text('utf-8'))
    bundles = {}
    for root in reversed(roots):
        for path in root.glob('fur_*.unity3d'):
            match = re.search(r'_(7[012]\d{4})_', path.name)
            if match:
                bundles[int(match[1])] = path
    requests = [(str(item['Id']), bundles[item['Id']], 'furniture') for item in data.values()
        if not item.get('NotShow') and item['Id'] in bundles and (args.ids is None or item['Id'] in args.ids)]
    if args.scenes:
        for name, bundle in [('outdoor', 'dormlevel_001_out_01.unity3d'), ('indoor', 'dormlevel_001_in_01.unity3d')]:
            path = next((root / bundle for root in roots if (root / bundle).exists()), None)
            if path:
                requests.append((name, path, 'scenes'))
    errors = []
    for name, path, group in requests:
        try:
            env, files, missing = load_environment(path, index)
            if group == 'scenes':
                companion = path.with_name(path.stem + '_assets.unity3d')
                if companion.exists():
                    before = set(id(f) for f in env.assets)
                    env.load_file(str(companion))
                    files += [f for f in env.assets if id(f) not in before]
            converter = Converter(env, files, prefab=group == 'furniture')
            scene, stats = converter.convert()
            filename = f'{name}.glb'
            (target / filename).write_bytes(scene.export(file_type='glb'))
            manifest[group][name] = dict(file=filename, source=path.name, missingBundles=sorted(missing), **stats)
            print(name, json.dumps(stats), 'missing bundles', len(missing), flush=True)
        except Exception as error:
            errors.append((name, str(error)))
            print('ERROR', name, repr(error), flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), 'utf-8')
    if errors:
        raise SystemExit(f'{len(errors)} conversions failed: {errors}')


if __name__ == '__main__':
    main()
