import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const sourceRepo = process.env.STELLA_DATA_REPO || resolve(root, '../../StellaSoraData');
const revision = execFileSync('git', ['-C', sourceRepo, 'rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
const files = ['Config', 'Buff', 'Effect', 'OnceAdditionalAttribute', 'ScriptParameter', 'AttributeLimit', 'AttributeSetLimit', 'Shield'];
const sources = [];
for (const name of files) {
  const bytes = execFileSync('git', ['-C', sourceRepo, 'show', `${revision}:KR/bin/${name}.json`], { maxBuffer: 40_000_000 });
  JSON.parse(bytes.toString('utf8'));
  await writeFile(resolve(root, 'public/data', `${name}.json`), bytes);
  sources.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
// AreaEffectEntity.GetOwnerScale reads the default skin's model scale, not
// collider scale. Keep this alongside the other exported combat rule tables.
const skinBytes=execFileSync('git',['-C',sourceRepo,'show',`${revision}:KR/bin/CharacterSkin.json`],{maxBuffer:40_000_000});
const skins=JSON.parse(skinBytes.toString('utf8'));
const characters=JSON.parse(await readFile(resolve(root,'public/data/Character.json'),'utf8'));
const actorScales=Object.fromEntries(Object.values(characters).flatMap(character=>{
  const skin=skins[character.DefaultSkinId];
  return skin?[[character.Id,skin.ModelScale/10000]]:[];
}));
await writeFile(resolve(root,'public/data/CombatActorScales.json'),JSON.stringify(actorScales,null,2)+'\n');
sources.push({name:'CharacterSkin',sha256:createHash('sha256').update(skinBytes).digest('hex')});
const example = JSON.parse(await readFile(resolve(root, 'public/guides/rotation-example.json'), 'utf8'));
const script = JSON.parse(await readFile(resolve(root, 'public/data/ScriptParameter.json'), 'utf8'));
const values = JSON.parse(await readFile(resolve(root, 'public/data/ScriptParameterValue.json'), 'utf8'));
const perkLevels = { 516243: 6 };
const sample = script[16243002];
const sampleRow = values[sample.Id + perkLevels[sample.LevelData] * 10];
if (sample?.levelTypeData !== 1 || !sampleRow) throw new Error('Missing level-linked SP regeneration');
const manifest = { revision, sources, durationSeconds: example.durationSeconds, verifiedSample: { parameter: sample.Id, potential: sample.LevelData, level: 6, spPerTick: sampleRow.CommonData / 10000 } };
await writeFile(resolve(root, 'reports/rotation-data-sources.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
