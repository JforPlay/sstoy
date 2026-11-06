"""Export combat combo event data read-only from locally installed Unity bundles.

This preserves fixed-point raw values. It does not equate animation lengths with
skill lock time or infer hit damage from visual events.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import UnityPy
from client_bundle_manifest import ClientBundleManifest

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--game', type=Path, default=Path('C:/YostarGames/StellaSora_KR'))
parser.add_argument('--characters', nargs='+', type=int, default=[162, 115, 107])
parser.add_argument('--all-visible', action='store_true', help='Export every released, visible character from the site data')
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'reports/combat-timings.json')
parser.add_argument('--runtime-output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/data/CombatTimings.json')
args = parser.parse_args()
if args.all_visible:
    characters_path = Path(__file__).resolve().parents[1] / 'public/data/Character.json'
    characters = json.loads(characters_path.read_text(encoding='utf-8-sig'))
    args.characters = sorted(int(row['Id']) for row in characters.values() if row.get('Visible') and row.get('Available'))
roots = [args.game / 'Persistent_Store/AssetBundles', args.game / 'StellaSora_Data/StreamingAssets/InstallResource']
manifest = ClientBundleManifest(args.game)
report = {'warning': 'Source event data, not a verified battle simulation. Derived times use configured playSpeed only; runtime attack speed, script changes, projectile travel and event-type semantics still require verification. Animation duration is not skill lock time.', 'characters': []}
fixed = lambda value: value['_serializedValue'] / 4294967296 if isinstance(value, dict) and '_serializedValue' in value else None
shared_source = manifest.select('adventure.unity3d')
for obj in UnityPy.load(str(shared_source)).objects:
    if obj.type.name != 'MonoBehaviour':
        continue
    tree = obj.read_typetree()
    if 'TriggerElementMarkCD' in tree:
        report['rules'] = {key: fixed(tree[key]) if isinstance(tree[key], dict) else tree[key] for key in [
            'TriggerElementMarkCD', 'BuffId_Glimmer', 'EnergyReduceTime', 'Combat_MinJumpDuration',
            'ToughnessBrokenState_BuffId', 'ToughnessBroken_RecoverTime', 'ToughnessProtectTime',
            'Combat_HitboxDamageImmuneDuration', 'Combat_HitboxContinuousDamageDetectInterval']}
        report['rulesSource'] = {'file': str(shared_source), 'sha256': hashlib.sha256(shared_source.read_bytes()).hexdigest(), 'pathId': str(obj.path_id)}
        break
if 'rules' not in report:
    raise RuntimeError('Shared combat configuration not found; do not fall back to source defaults')
def preserve_pointers(value):
    if isinstance(value, dict):
        return {key: str(item) if key == 'm_PathID' else preserve_pointers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [preserve_pointers(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value

def character_bundle(character, suffix):
    names = [f'char_{character}01_{suffix}.unity3d']
    # The installed 114 release uses the singular filename. This is the same
    # character's real config bundle, not data substituted from another actor.
    if suffix == 'configs':
        names.append(f'char_{character}01_config.unity3d')
    if suffix.endswith('_monster'):
        names.append(f'char_{character}01_{suffix.replace("_monster", "monster")}.unity3d')
    return next((source for name in names if (source := manifest.select(name, optional=True)) is not None), None)

def script_identity(obj, header):
    pointer = header.get('m_Script', {})
    if pointer.get('m_FileID', 0) != 0:
        return None
    script = obj.assets_file.objects.get(int(pointer.get('m_PathID', 0)))
    if not script or script.type.name != 'MonoScript':
        return None
    data = script.read_typetree(check_read=False)
    return (data.get('m_AssemblyName'), data.get('m_Namespace'), data.get('m_ClassName'))

# Some historical bundles preserve only the MonoBehaviour header typetree but
# still contain the complete payload. Reuse a schema only for the identical
# assembly/namespace/class. Strict read-size checks are mandatory on recovery.
# No field values or character parameters are copied from the schema donor.
schema_catalog = {}
schema_signatures = set()
schema_sources = set()
for character in args.characters:
    for suffix in ['combos', 'configs', 'weapons']:
        source = character_bundle(character, suffix)
        if source is not None:
            schema_sources.add(source)
for root in roots:
    for pattern in ['*weapons*.unity3d', 'char_*_combos*.unity3d', 'adventure*.unity3d']:
        for candidate in root.glob(pattern):
            source=manifest.select(candidate.name, optional=True)
            if source is not None:
                schema_sources.add(source)
for source in sorted(schema_sources):
    environment = UnityPy.load(str(source))
    for obj in environment.objects:
            if obj.type.name != 'MonoBehaviour':
                continue
            try:
                tree = obj.read_typetree()
                if len(tree) <= 4:
                    continue
                identity = script_identity(obj, tree)
                if identity is None or not identity[2]:
                    continue
                node = obj._get_typetree_node()
                layout = [(field.m_Level, field.m_Type, field.m_Name, field.m_ByteSize, field.m_MetaFlag, field.m_Version) for field in node.traverse()]
                signature = (identity, hashlib.sha256(json.dumps(layout).encode()).hexdigest())
                if signature in schema_signatures:
                    continue
                schema_signatures.add(signature)
                schema_catalog.setdefault(identity, []).append((node, str(source), str(obj.path_id), signature[1]))
            except (ValueError, TypeError, KeyError):
                continue
print(f'Loaded {len(schema_signatures)} exact-class serialization schemas', flush=True)

for character in args.characters:
    entry = {'id': character, 'bundles': []}
    entry['entities'] = []
    entity_source = manifest.select(f'char_{character}01.unity3d', optional=True)
    if entity_source is not None:
        entity_env = UnityPy.load(str(entity_source))
        for obj in entity_env.objects:
            if obj.type.name != 'MonoBehaviour':
                continue
            header = obj.read_typetree(check_read=False)
            identity = script_identity(obj, header)
            if identity is None or identity[2] not in ('FlowerEntity', 'ScatteringDartsEntity'):
                continue
            tree = obj.read_typetree(check_read=True)
            parent = obj.assets_file.objects.get(int(tree['m_GameObject']['m_PathID']))
            parent_tree = parent.read_typetree() if parent is not None else {}
            entry['entities'].append({'name': parent_tree.get('m_Name'), 'type': identity[2],
                                      'pathId': str(obj.path_id), 'data': preserve_pointers(tree)})
        if entry['entities']:
            entry['bundles'].append({'source': str(entity_source), 'kind': 'entities',
                                    'sha256': hashlib.sha256(entity_source.read_bytes()).hexdigest(), 'objects': []})
    suffixes = ['combos', 'configs', 'animations', 'weapons']
    optional_suffixes = ['combos_monster', 'configs_monster', 'animations_monster', 'weapons_monster']
    # Summons are not consistently named "monster" (for example the real
    # 156 penguin doll combo bundle). Discover only combat sub-bundles in the
    # active manifest, not unrelated skin/model/texture archives.
    prefix = f'char_{character}01_'
    optional_suffixes.extend(name[len(prefix):-len('.unity3d')]
                             for name in manifest.entries
                             if name.startswith(prefix) and name.endswith('.unity3d')
                             and any(name[len(prefix):].startswith(kind + '_')
                                     for kind in ('combos', 'configs', 'animations', 'weapons')))
    optional_suffixes = sorted(set(optional_suffixes))
    suffixes.extend(suffix for suffix in optional_suffixes if character_bundle(character, suffix) is not None)
    for suffix in suffixes:
        filename = f'char_{character}01_{suffix}.unity3d'
        source = character_bundle(character, suffix)
        if source is None:
            entry['bundles'].append({'filename': filename, 'missing': True})
            continue
        bundle = {'source': str(source), 'kind': suffix, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'objects': []}
        for obj in UnityPy.load(str(source)).objects:
            if obj.type.name not in ['MonoBehaviour', 'AnimationClip', 'MonoScript', 'GameObject',
                                     'Transform', 'SphereCollider', 'CapsuleCollider', 'BoxCollider']:
                continue
            try:
                tree = obj.read_typetree()
            except ValueError as error:
                if obj.type.name not in ['MonoScript', 'MonoBehaviour']:
                    raise RuntimeError(f'{source.name} pathId={obj.path_id} type={obj.type.name}: {error}') from error
                # Older records may only carry a MonoBehaviour header tree.
                # Preserve their bytes/hash and mark the record incomplete;
                # never infer its omitted fields from another character.
                tree = obj.read_typetree(check_read=False)
                raw = obj.get_raw_data()
                recovered = None
                identity = script_identity(obj, tree) if obj.type.name == 'MonoBehaviour' else None
                valid_schemas = []
                for node, schema_source, schema_path, schema_hash in schema_catalog.get(identity, []):
                    try:
                        candidate = obj.read_typetree(nodes=node, check_read=True)
                        valid_schemas.append((candidate, schema_source, schema_path, schema_hash))
                    except (ValueError, TypeError, KeyError, EOFError):
                        continue
                if valid_schemas:
                    decoded_forms = {json.dumps(candidate, sort_keys=True) for candidate, *_ in valid_schemas}
                    if len(decoded_forms) == 1:
                        recovered, schema_source, schema_path, schema_hash = valid_schemas[0]
                        bundle.setdefault('schemaRecoveries', []).append({'pathId': str(obj.path_id), 'class': identity,
                            'rawSize': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest(),
                            'schemaSource': schema_source, 'schemaPathId': schema_path, 'schemaSha256': schema_hash,
                            'equivalentLayouts': len(valid_schemas)})
                    else:
                        bundle.setdefault('ambiguousSchemas', []).append({'pathId': str(obj.path_id), 'class': identity,
                            'schemas': [schema_hash for *_, schema_hash in valid_schemas]})
                if recovered is not None:
                    tree = recovered
                else:
                    bundle.setdefault('readWarnings', []).append({'pathId': str(obj.path_id), 'type': obj.type.name, 'error': str(error),
                        'rawSize': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'rawHex': raw.hex()})
            if obj.type.name == 'AnimationClip':
                muscle = tree.get('m_MuscleClip', {})
                exported = {key: tree.get(key) for key in ['m_Name', 'm_SampleRate', 'm_Events', 'm_Legacy']}
                exported['startTime'] = muscle.get('m_StartTime')
                exported['stopTime'] = muscle.get('m_StopTime')
            else:
                exported = tree
            bundle['objects'].append({'pathId': str(obj.path_id), 'type': obj.type.name, 'data': preserve_pointers(exported)})
        entry['bundles'].append(bundle)
    report['characters'].append(entry)
    print(f'Exported character {character} ({len(report["characters"])}/{len(args.characters)})', flush=True)
    all_objects = {obj['pathId']: obj for bundle in entry['bundles'] for obj in bundle.get('objects', [])}
    entry['weapons'] = []
    for bundle in entry['bundles']:
        if not bundle.get('kind', '').startswith('weapons'):
            continue
        for obj in bundle.get('objects', []):
            if obj['type'] != 'GameObject':
                continue
            components = []
            for component in obj['data'].get('m_Component', []):
                pointer = component.get('component', component)
                resolved = all_objects.get(str(pointer.get('m_PathID')))
                if not resolved:
                    continue
                tree = resolved['data']
                if resolved['type'] in ['Transform', 'SphereCollider', 'CapsuleCollider', 'BoxCollider']:
                    components.append({'type': resolved['type'], 'data': tree})
                    continue
                if resolved['type'] != 'MonoBehaviour':
                    continue
                script = all_objects.get(str(tree.get('m_Script', {}).get('m_PathID')))
                components.append({'type': script['data'].get('m_ClassName', script['data'].get('m_Name')) if script else None,
                                   'data': tree})
            if any(component['type'] not in ['Transform', 'SphereCollider', 'CapsuleCollider', 'BoxCollider'] for component in components):
                entry['weapons'].append({'name': obj['data']['m_Name'], 'pathId': obj['pathId'], 'components': components})
    animations = {obj['pathId']: obj['data'] for bundle in entry['bundles'] for obj in bundle.get('objects', []) if obj['type'] == 'AnimationClip'}
    entry['timelines'] = []
    entry['comboAliases'] = []
    entry['reloadClips'] = []
    for bundle in entry['bundles']:
        for obj in bundle.get('objects', []):
            group = obj['data']
            if 'reloadAnimClip' in group:
                # Reload is not an action-tag alias. Preserve the native
                # default/alternate pointers rather than guessing by name.
                entry['reloadClips'].append({
                    'group': obj['pathId'],
                    'default': str(group['reloadAnimClip']['m_PathID']),
                    'alternates': [str(clip['m_PathID']) for clip in group.get('reloadAnimClip_Other', [])]})
            for combo in obj['data'].get('combos', []):
                entry['comboAliases'].append({'tag': combo['actionTag'], 'source': Path(bundle['source']).name, 'group':obj['pathId'], 'keys': combo.get('requestKeys', []), 'useKeys': bool(combo.get('useActionKeys')),
                    'skillType': combo.get('comboSkillType'), 'clipMode':combo.get('comboClipMode',0),
                    'eventGroups':[clip.get('eventGroupTag','0') for clip in combo.get('compositeComboClips',[])],
                    'clips': [str(clip['comboClip']['m_PathID']) for clip in combo.get('compositeComboClips', [])]})
    for bundle in entry['bundles']:
        for obj in bundle.get('objects', []):
            tree = obj['data']
            if 'animationLength' not in tree:
                continue
            length = fixed(tree['animationLength'])
            speed = fixed(tree['playSpeed'])
            animation = animations.get(str(tree.get('animationClip', {}).get('m_PathID')))
            duration = animation.get('stopTime') if animation else None
            matched = duration is not None and abs(length - duration) < 0.00001
            events = []
            event_groups=[(0,tree.get('comboEventSkins',[]))]
            if tree.get('enableExtraEventGroup'):
                event_groups.extend((index+1,group.get('ComboEventSkins',[])) for index,group in enumerate(tree.get('EventGroups',[])))
            for group,skins in event_groups:
              for skin in skins:
                for index, event in enumerate(skin.get('comboEvents', [])):
                    normalized = event.get('activeNormalizedTimeRange', {})
                    start = fixed(normalized.get('x'))
                    end = fixed(normalized.get('y'))
                    geometry_fields = ('hitBoxShape', 'hitBoxWidth', 'hitBoxLength', 'hitBoxRadius', 'hitBoxInnerRadius',
                                       'hitBoxAngle', 'hitBoxConfigureWithGameData', 'hitBoxRotation', 'hitBoxOffset', 'hitBoxOffsetY',
                                       'offsetFollowActor', 'lockHitBoxTransformOnEnd', 'hitBoxRotationOnEnd', 'hitBoxOffsetOnEnd',
                                       'enableHitBoxCurveMotion', 'hitBoxCurveMotionControlPoint1', 'hitBoxCurveMotionControlPoint2',
                                       'areaWithActorScale')
                    geometry = {key: event[key] for key in geometry_fields if key in event} if event.get('type') == 1 else None
                    events.append({'skinId': skin.get('skinId'), 'index': index, 'type': event.get('type'), 'group':group,
                                   'playOnceInLoopMode':event.get('playOnceInLoopMode',False),
                                   'clipPreconditionType':event.get('clipPreconditionType',0),'preconditionClip':event.get('preconditionClip'),
                                   'name': event.get('name'), 'tag': event.get('tag'),
                                   'hitDamageId': event.get('hitDamageId'), 'hitFlags': event.get('hitFlags', 0),
                                   'hitFeatureData': event.get('hitFeatureData'), 'buffIds': event.get('buffIds'),
                                   'bulletCount': event.get('bulletCount'), 'reduceAmmoCount':event.get('reduceAmmoCount',0), 'toTeam': event.get('toTeam'), 'shieldId':event.get('shiledID',0),
                                   'triggerFateCardTheme':event.get('triggerFateCardTheme',False),
                                   'normalAttackTriggerForFateCard':event.get('normalAttackTriggerForFateCard',False),
                                   'dodgeTriggerForFateCard':event.get('dodgeTriggerForFateCard',False),
                                   'skillTriggerForFateCard':event.get('skillTriggerForFateCard',False),
                                   'ultimateTriggerForFateCard':event.get('ultimateTriggerForFateCard',False),
                                   'startSeconds': start * length / speed if speed and start is not None else None,
                                   'endSeconds': end * length / speed if speed and end is not None else None,
                                   'damageDetectIntervalSeconds': fixed(event.get('damageDetectInterval')),
                                   'damageImmuneDurationSeconds': fixed(event.get('damageImmuneDuration')),
                                   'bulletPrefab': event.get('bulletPrefab'), 'areaEffectPrefab': event.get('AreaEffectPrefab'),
                                   **({'hitGeometryRaw': geometry} if geometry else {})})
            motion = {}
            if tree.get('enableRootMotion'):
                motion.update({key: tree[key] for key in ('enableRootMotion', 'rootMotionCheckDistance', 'rootMotionCheckDistanceLimitUp',
                                                         'rootMotionSides', 'rootMotionVertical', 'rootMotionForward', 'rootMotionMultiplier') if key in tree})
            if tree.get('enableRootMotionRotate'):
                motion.update({key: tree[key] for key in ('enableRootMotionRotate', 'rootMotionRotateQuaternionX', 'rootMotionRotateQuaternionY',
                                                         'rootMotionRotateQuaternionZ', 'rootMotionRotateQuaternionW') if key in tree})
            entry['timelines'].append({'name': tree['m_Name'], 'source': bundle['source'], 'pathId': obj['pathId'],
                                       'animationDurationSeconds': length, 'playSpeed': speed,
                                       'sourceAnimationDurationSeconds': duration,
                                       'fixedPointScaleVerifiedAgainstAnimation': matched,
                                       'phaseRangeRaw': tree.get('comboPhaseRange'),
                                       'events': events, 'featurePhasesRaw': tree.get('featurePhases', []),
                                       **({'rootMotionRaw': motion} if motion else {})})
args.output.parent.mkdir(parents=True, exist_ok=True)
report['clientManifest']=manifest.provenance()
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
runtime = {'warning': report['warning'], 'rules': report['rules'], 'rulesSource': report['rulesSource'], 'clientManifest':report['clientManifest'], 'characters': [{
    'id': char['id'], 'comboAliases': char['comboAliases'], 'reloadClips': char['reloadClips'], 'timelines': char['timelines'], 'weapons': char['weapons'], 'entities': char['entities'],
    'sources': [{'file': Path(b['source']).name, 'sha256': b['sha256']} for b in char['bundles'] if 'source' in b],
    'readWarnings': [{'pathId': warning['pathId'], 'type': warning['type'], 'error': warning['error']} for b in char['bundles'] for warning in b.get('readWarnings', [])],
    'schemaRecoveries': [recovery for b in char['bundles'] for recovery in b.get('schemaRecoveries', [])],
    'missingBundles': [b['filename'] for b in char['bundles'] if b.get('missing')]
} for char in report['characters']]}
args.runtime_output.parent.mkdir(parents=True, exist_ok=True)
args.runtime_output.write_text(json.dumps(runtime, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
print(json.dumps({'output': str(args.output), 'characters': [{'id': char['id'], 'objects': sum(len(b.get('objects', [])) for b in char['bundles']),
    'timelines': len(char['timelines']), 'animationMatched': sum(t['fixedPointScaleVerifiedAgainstAnimation'] for t in char['timelines'])} for char in report['characters']]}, ensure_ascii=False))
