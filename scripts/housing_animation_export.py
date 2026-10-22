"""Preserve Unity SD skinning and its original generic idle clip in a GLB."""
import bisect
import json
import math
import struct
import zlib
import numpy as np
import UnityPy


def stream_curves(stream):
    data = struct.pack('<' + 'I' * len(stream['data']), *stream['data'])
    offset, curves = 0, [[] for _ in range(stream['curveCount'])]
    while offset < len(data):
        time, count = struct.unpack_from('<fi', data, offset)
        offset += 8
        for _ in range(count):
            index, *coefficients = struct.unpack_from('<i4f', data, offset)
            offset += 20
            curves[index].append((time, coefficients))
    return curves


def sample_curve(keys, time):
    index = bisect.bisect_right([k[0] for k in keys], time) - 1
    start, (a, b, c, d) = keys[max(0, index)]
    if not math.isfinite(start):
        return d
    delta = time - start
    return ((a * delta + b) * delta + c) * delta + d


def add_idle_animation(blob, converter, skin_nodes, animation_path, skin):
    if animation_path is None:
        return blob, None
    env = UnityPy.load(str(animation_path))
    clip = next((o.read_typetree() for o in env.objects if o.type.name == 'AnimationClip' and '_Idle_' in o.read().m_Name), None)
    if clip is None:
        return blob, None
    json_size = struct.unpack_from('<I', blob, 12)[0]
    doc = json.loads(blob[20:20 + json_size])
    binary_start = 20 + json_size + 8
    binary = bytearray(blob[binary_start:])

    def accessor(values, component, kind):
        array = np.asarray(values, dtype={5126: '<f4', 5123: '<u2'}[component])
        width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[kind]
        if kind != 'SCALAR' and (array.ndim != 2 or array.shape[1] != width):
            raise ValueError(f'Invalid {kind} accessor shape: {array.shape}')
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        binary.extend(array.tobytes())
        views = doc.setdefault('bufferViews', [])
        views.append(dict(buffer=0, byteOffset=offset, byteLength=array.nbytes))
        accessors = doc.setdefault('accessors', [])
        accessors.append(dict(bufferView=len(views) - 1, componentType=component, count=len(array), type=kind))
        return len(accessors) - 1

    # Resolve animation path hashes relative to the original model prefab root.
    read = lambda pointer: pointer.read()
    key = lambda value: (value.object_reader.assets_file.name, value.object_reader.path_id)
    transforms = list(converter.transforms.values())
    selected = {}
    paths = {}
    for transform in transforms:
        chain, parent = [], transform
        while True:
            chain.append(parent)
            if not parent.m_Father.path_id:
                break
            parent = read(parent.m_Father)
        if read(chain[-1].m_GameObject).m_Name != f'{skin}_model':
            continue
        selected[key(transform)] = transform
        path = '/'.join(read(t.m_GameObject).m_Name for t in reversed(chain[:-1]))
        paths[zlib.crc32(path.encode())] = key(transform)
    nodes = doc['nodes']
    bone_ids = {}
    for bone_key, transform in selected.items():
        p, q, s = transform.m_LocalPosition, transform.m_LocalRotation, transform.m_LocalScale
        bone_ids[bone_key] = len(nodes)
        nodes.append(dict(name=f'bone_{len(bone_ids)}', translation=[-p.x, p.y, p.z], rotation=[q.x, -q.y, -q.z, q.w], scale=[s.x, s.y, s.z]))
    for bone_key, transform in selected.items():
        node = nodes[bone_ids[bone_key]]
        if transform.m_Father.path_id and key(read(transform.m_Father)) in bone_ids:
            nodes[bone_ids[key(read(transform.m_Father))]].setdefault('children', []).append(bone_ids[bone_key])
        else:
            doc['scenes'][doc.get('scene', 0)]['nodes'].append(bone_ids[bone_key])
    for node in nodes[:min(bone_ids.values())]:
        binding = skin_nodes.get(node.get('name'))
        if not binding:
            continue
        skin_index = len(doc.setdefault('skins', []))
        doc['skins'].append(dict(joints=[bone_ids[b] for b in binding['bones']],
                                 inverseBindMatrices=accessor([m.T.reshape(16) for m in binding['inverses']], 5126, 'MAT4')))
        node['skin'] = skin_index
        attributes = doc['meshes'][node['mesh']]['primitives'][0]['attributes']
        indices = np.asarray(binding['indices'])
        weights = np.asarray(binding['weights'])
        indices = np.pad(indices, ((0, 0), (0, 4 - indices.shape[1])))
        weights = np.pad(weights, ((0, 0), (0, 4 - weights.shape[1])))
        weights /= weights.sum(axis=1)[:, None]
        attributes['JOINTS_0'] = accessor(indices, 5123, 'VEC4')
        attributes['WEIGHTS_0'] = accessor(weights, 5126, 'VEC4')
    data = clip['m_MuscleClip']['m_Clip']['data']
    streamed = stream_curves(data['m_StreamedClip'])
    dense = data['m_DenseClip']
    constants = data['m_ConstantClip']['data']
    duration = clip['m_MuscleClip']['m_StopTime'] - clip['m_MuscleClip']['m_StartTime']
    times = np.linspace(0, duration, round(duration * 30) + 1)
    dense_values = np.asarray(dense['m_SampleArray']).reshape((-1, dense['m_CurveCount'])) if dense['m_CurveCount'] else None

    def value(curve, time):
        if curve < len(streamed):
            return sample_curve(streamed[curve], time)
        curve -= len(streamed)
        if curve < dense['m_CurveCount']:
            index = min(len(dense_values) - 1, max(0, round((time - dense['m_BeginTime']) * dense['m_SampleRate'])))
            return dense_values[index, curve]
        return constants[curve - dense['m_CurveCount']]

    animation = dict(name=clip['m_Name'], samplers=[], channels=[])
    time_accessor = accessor(times, 5126, 'SCALAR')
    doc['accessors'][time_accessor].update(min=[0], max=[float(duration)])
    curve = 0
    mapped = 0
    unused_paths = set()
    for binding in clip['m_ClipBindingConstant']['genericBindings']:
        attribute = binding['attribute']
        width = 4 if attribute == 2 else 3 if attribute in (1, 3, 4) else 1
        bone_key = paths.get(binding['path'])
        if binding['typeID'] != 4 or attribute not in (1, 2, 3):
            raise ValueError(f'Unsupported idle animation binding: {binding}')
        if bone_key is None:
            # Clips can include slots present only in the actor/effect prefab.
            # No mesh in this exported model is bound to these absent nodes.
            unused_paths.add(binding['path'])
            curve += width
            continue
        values = np.asarray([[value(curve + slot, time) for slot in range(width)] for time in times])
        if attribute == 1:
            values[:, 0] *= -1
        elif attribute == 2:
            values[:, 1:3] *= -1
            values /= np.linalg.norm(values, axis=1)[:, None]
            for i in range(1, len(values)):
                if np.dot(values[i - 1], values[i]) < 0:
                    values[i] *= -1
        output = accessor(values, 5126, 'VEC4' if width == 4 else 'VEC3')
        animation['channels'].append(dict(sampler=len(animation['samplers']), target=dict(node=bone_ids[bone_key], path={1: 'translation', 2: 'rotation', 3: 'scale'}[attribute])))
        animation['samplers'].append(dict(input=time_accessor, output=output, interpolation='LINEAR'))
        curve += width
        mapped += 1
    doc['animations'] = [animation]
    if mapped < len(clip['m_ClipBindingConstant']['genericBindings']) * .8:
        raise ValueError(f'Too few mapped idle tracks: {skin}/{mapped}')
    doc['buffers'][0]['byteLength'] = len(binary)
    json_bytes = json.dumps(doc, separators=(',', ':')).encode()
    json_bytes += b' ' * (-len(json_bytes) % 4)
    binary += b'\0' * (-len(binary) % 4)
    result = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(json_bytes) + 8 + len(binary))
    result += struct.pack('<I4s', len(json_bytes), b'JSON') + json_bytes
    result += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    return result, dict(name=clip['m_Name'], duration=duration, channels=mapped, unusedPaths=sorted(unused_paths))
