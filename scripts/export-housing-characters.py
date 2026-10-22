"""Export SD characters with selectable facial sets, original skinning and idle clips."""
import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path
import numpy as np

sys.dont_write_bytecode = True
from housing_animation_export import add_idle_animation
spec = importlib.util.spec_from_file_location('housing_export', Path(__file__).with_name('export-housing-models.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


class CharacterConverter(base.Converter):
    def __init__(self, env, files, skin, facial=None, expression=None):
        super().__init__(env, files)
        self.skin = skin
        if facial is not None:
            self._facial_file = facial.assets_file
            facial = facial.read_typetree()
        self.facial = facial
        self.expression = expression
        self.morphs = {}
        self.overrides = {}
        self.allowed = set()
        self.skin_nodes = {}
        if expression is not None:
            def ptr(field):
                return base.PPtr(**facial[field], assetsfile=self.facial_file)
            config_reader = base.read(ptr('configData')).object_reader
            config = config_reader.read_typetree()
            def material(field, fallback=None):
                value = expression.get(field) or {}
                if not value.get('m_PathID') and fallback:
                    value = config[fallback]
                return base.PPtr(**value, assetsfile=config_reader.assets_file)
            def add(role, blend='', materials=None):
                renderer = base.read(ptr(role))
                if not renderer:
                    return
                k = base.key(renderer)
                self.allowed.add(k)
                self.morphs[k] = blend
                if materials:
                    self.overrides[k] = materials(renderer)
            face_role = 'blankFaceRenderer' if expression['useBlankFace'] else 'faceRenderer'
            def face_materials(renderer):
                result = list(renderer.m_Materials)
                slot = 0 if expression['useBlankFace'] else config['faceRendererFaceSlot']
                result[slot] = material('faceMaterial', 'defaultBlankFaceMaterial' if expression['useBlankFace'] else 'defaultFaceMaterial')
                return result
            add(face_role, expression['faceBlendShapeName'], face_materials)
            add('eyebrowRenderer', expression['eyebrowBlendShapeName'])
            add('mouthRenderer', materials=lambda renderer: [material('mouthMaterial', 'defaultMouthMaterial')])
            if expression['enableSpecialEye']:
                role = 'specialEyeMirrorRenderer' if expression['eyeUseMirror'] else 'specialEyeRenderer'
                add(role, materials=lambda renderer: [material('eyeMaterial')])
            if expression['enableBlush']:
                role = 'blushMirrorRenderer' if expression['blushUseMirror'] else 'blushRenderer'
                add(role, materials=lambda renderer: [material('blushMaterial')])

    @property
    def facial_file(self):
        return self._facial_file

    def renderer_allowed(self, renderer, go):
        if self.expression is not None:
            return base.key(renderer) in self.allowed
        return super().renderer_allowed(renderer, go) and not re.match(r'^(face|eyebrow|eye|mouth|rouge)', go.m_Name, re.I)

    def enabled(self, transform):
        return True if self.expression is not None else super().enabled(transform)

    def prepare_renderer(self, renderer):
        replacement = self.overrides.get(base.key(renderer))
        if replacement:
            renderer.m_Materials = replacement
        return renderer

    def model_matrix(self, transform):
        root = transform
        while base.read(root.m_Father):
            root = base.read(root.m_Father)
        go = base.read(root.m_GameObject)
        if not go or go.m_Name != f'{self.skin}_model':
            return None
        return self.world(transform)

    def mesh_positions(self, handler, mesh, renderer, transform):
        points = super().mesh_positions(handler, mesh, renderer, transform)
        blend = self.morphs.get(base.key(renderer))
        if blend:
            shapes = mesh.m_Shapes
            channel = next((c for c in shapes.channels if c.name == blend), None)
            if channel is None:
                raise ValueError(f'Missing facial blend shape: {self.skin}/{blend}')
            shape = shapes.shapes[channel.frameIndex]
            for vertex in shapes.vertices[shape.firstVertex:shape.firstVertex + shape.vertexCount]:
                points[vertex.index] += [vertex.vertex.x, vertex.vertex.y, vertex.vertex.z]
        if not getattr(renderer, 'm_Bones', None) or not handler.m_BoneWeights:
            return points
        # Unity's renderer-local skin matrices, frozen at the prefab's default pose.
        inverse = np.linalg.inv(self.world(transform))
        matrices = []
        for bone, bind in zip(renderer.m_Bones, mesh.m_BindPose):
            matrix = np.array([[getattr(bind, f'e{r}{c}') for c in range(4)] for r in range(4)])
            matrices.append(inverse @ self.world(base.read(bone)) @ matrix)
        indices = np.asarray(handler.m_BoneIndices, dtype=int)
        weights = np.asarray(handler.m_BoneWeights)
        points4 = np.column_stack([points, np.ones(len(points))])
        result = np.zeros_like(points4)
        for slot in range(weights.shape[1]):
            result += np.einsum('nij,nj->ni', np.asarray(matrices)[indices[:, slot]], points4) * weights[:, slot, None]
        return result[:, :3].astype(np.float32)

    def node_created(self, name, renderer, transform, handler):
        if getattr(renderer, 'm_Bones', None) and handler.m_BoneWeights:
            bones = [base.read(b) for b in renderer.m_Bones]
            world = self.mirror @ self.world(transform) @ self.mirror
            inverses = [np.linalg.inv(self.mirror @ self.world(b) @ self.mirror) @ world for b in bones]
            self.skin_nodes[name] = dict(indices=handler.m_BoneIndices, weights=handler.m_BoneWeights,
                                         bones=[base.key(b) for b in bones], inverses=inverses)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skin', default='16201')
    parser.add_argument('--character', type=int, default=162)
    parser.add_argument('--all', action='store_true', help='Export every installed SD character prefab')
    args = parser.parse_args()
    site = Path(__file__).resolve().parents[1]
    roots = [Path(r'C:\YostarGames\StellaSora_KR\Persistent_Store\AssetBundles'),
             Path(r'C:\YostarGames\StellaSora_KR\StellaSora_Data\StreamingAssets\InstallResource')]
    paths = {}
    for root in reversed(roots):
        for path in root.glob('char_sd_*.unity3d'):
            skin = path.stem.removeprefix('char_sd_')
            if skin.isdigit() and (args.all or skin == args.skin):
                paths[skin] = path
    if not paths:
        raise ValueError('No matching installed SD character prefabs')
    print('Indexing character dependencies...', flush=True)
    index = base.cab_index(roots)
    target = site / 'public/assets/housing/models'
    manifest_path = target / 'characters.json'
    manifest = json.loads(manifest_path.read_text('utf-8')) if manifest_path.exists() else {}
    for skin, path in sorted(paths.items()):
        env, files, missing = base.load_environment(path, index)
        converter = CharacterConverter(env, files, skin)
        scene, stats = converter.convert()
        facial = next(obj for assets in files for obj in assets.objects.values()
                      if obj.type.name == 'MonoBehaviour' and 'configData' in obj.read_typetree()
                      and base.read(obj.read().m_GameObject).m_Name == f'{skin}_model')
        facial_tree = facial.read_typetree()
        config = base.read(base.PPtr(**facial_tree['configData'], assetsfile=facial.assets_file)).object_reader.read_typetree()
        expressions = []
        skin_nodes = dict(converter.skin_nodes)
        for expression in config['entries']:
            face_converter = CharacterConverter(env, files, skin, facial, expression)
            face_scene, face_stats = face_converter.convert()
            for node in face_scene.graph.nodes_geometry:
                transform, geometry = face_scene.graph[node]
                scene.add_geometry(face_scene.geometry[geometry], node_name=f"expression_{expression['id']}_{node}",
                                   geom_name=f"expression_{expression['id']}_{geometry}", transform=transform)
                if node in face_converter.skin_nodes:
                    skin_nodes[f"expression_{expression['id']}_{node}"] = face_converter.skin_nodes[node]
            expressions.append(expression['id'])
        stats.update(nodes=len(scene.graph.nodes_geometry), geometry=len(scene.geometry), bounds=scene.bounds.tolist())
        if missing or converter.unresolved:
            raise ValueError(f'Incomplete character {skin} dependencies: {missing}, {stats}')
        filename = f'character-{skin}.glb'
        animation_path = next((root / f'char_sd_{skin}_animations.unity3d' for root in roots if (root / f'char_sd_{skin}_animations.unity3d').exists()), None)
        blob, animation = add_idle_animation(scene.export(file_type='glb'), converter, skin_nodes, animation_path, skin)
        (target / filename).write_bytes(blob)
        manifest[skin] = dict(characterId=int(skin[:-2]) if args.all else args.character, model=f'character-{skin}', expressions=expressions, animation=animation, **stats)
        print(filename, json.dumps(stats), flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), 'utf-8')


if __name__ == '__main__':
    main()
