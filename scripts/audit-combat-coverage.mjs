import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import {createServer} from 'vite';
const root = resolve(import.meta.dirname, '..');
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
let connectedCombatMains,connectedCombatSupports;
try {({connectedCombatMains,connectedCombatSupports}=await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-adapter-registry.ts'));}
finally {await server.close();}
const read = async name => JSON.parse(await readFile(join(root, 'public/data', `${name}.json`), 'utf8'));
const [characters, skills, names, timings] = await Promise.all([read('Character'), read('Skill'), read('KR/Character'),
  readFile(join(root, 'reports/AllCharacterCombatTimings.json'), 'utf8').then(JSON.parse)]);
const sourceRoot = process.env.STELLA_MANAGED_SOURCE || 'C:/Users/User/.codex/tools/rea/investigations/stella/managed-analysis/decompiled-current';
const output = join(root, 'public/data/combat');
await mkdir(output, { recursive: true });
const catalog = { rules: timings.rules, rulesSource: timings.rulesSource,
  clientManifest:timings.clientManifest ? {file:timings.clientManifest.file,sha256:timings.clientManifest.sha256,metadata:timings.clientManifest.metadata} : undefined,
  characters: {} };
const audit = [];
const released=Object.values(characters).filter(row=>row.Visible&&row.Available).sort((a,b)=>a.Grade-b.Grade||a.Id-b.Id);
for (const character of released) {
  const timing = timings.characters.find(row => row.id === character.Id);
  if (!timing) throw new Error(`Missing extracted character ${character.Id}`);
  const file = `${character.Id}.json`;
  const bytes = JSON.stringify(timing);
  await writeFile(join(output, file), bytes);
  const roles = {};
  for (const field of ['NormalAtkId', 'SkillId', 'UltimateId', 'AssistNormalAtkId', 'AssistSkillId', 'AssistUltimateId']) {
    const skill = skills[character[field]];
    const sourcePath = skill?.FCPath ? `${skill.FCPath.replaceAll('.', '/')}.cs` : null;
    let source = null;
    if (sourcePath) try { source = await readFile(join(sourceRoot, sourcePath), 'utf8'); } catch {}
    roles[field] = { skillId: skill?.Id ?? null, class: skill?.FCPath ?? null, sourceAvailable: source !== null,
      sourceSha256: source === null ? null : createHash('sha256').update(source).digest('hex'),
      potentialChecks: source?.match(/(?:HavePersonalPerk|GetPerk|GetPerkLv)\([^)]*\)/g) ?? [],
      customEvents: source?.match(/(?:Equals|==)\s*\(?"[^"]+"/g) ?? [] };
  }
  const actorSourcePath = join(sourceRoot, 'AIScript/Character', `_${character.Id}01`);
  let files = [];
  try { files = (await readdir(actorSourcePath)).filter(file => file.endsWith('.cs')); } catch {}
  const branchSources = [];
  for (const file of files) {
    const source = await readFile(join(actorSourcePath, file), 'utf8');
    const branches = source.match(/CheckActorActiveTalentLevel\([^)]*\)|(?:perk|Perk|talent|Talent|buff|Buff|once|Once)[\w_]*\s*=\s*\d+/g) ?? [];
    if (branches.length) branchSources.push({ file, sha256: createHash('sha256').update(source).digest('hex'), branches });
  }
  catalog.characters[character.Id] = { id: character.Id, nameKey: character.Name, name: names[character.Name], path: `combat/${file}`,
    sha256: createHash('sha256').update(bytes).digest('hex'), timelines: timing.timelines.length,
    missingBundles: timing.missingBundles, readWarnings: timing.readWarnings.length,schemaRecoveries:timing.schemaRecoveries?.length ?? 0 };
  audit.push({ id: character.Id, name: names[character.Name], stars:character.Grade===1?5:character.Grade===2?4:3,roles, branchSources,
    extracted: catalog.characters[character.Id], runtimeStatus: [...connectedCombatMains,...connectedCombatSupports].includes(character.Id) ? 'partial-script-adapter' : 'script-adapter-required',
    runtimeRoles:{main:connectedCombatMains.includes(character.Id) ? 'partial' : 'required',support:connectedCombatSupports.includes(character.Id) ? 'partial' : 'required'} });
}
await writeFile(join(root, 'public/data/CombatCharacterIndex.json'), JSON.stringify(catalog, null, 2));
await writeFile(join(root, 'reports/combat-character-coverage.json'), JSON.stringify({
  warning: 'Extracted assets and source availability do not establish runtime implementation or correctness.', characters: audit,
}, null, 2));
console.log(JSON.stringify({ released: audit.length, roles: audit.reduce((n, actor) => n + Object.keys(actor.roles).length, 0),
  missingRoleSources: audit.flatMap(actor => Object.entries(actor.roles).filter(([, role]) => !role.sourceAvailable).map(([role]) => `${actor.id}/${role}`)),
  missingBundles: audit.flatMap(actor => actor.extracted.missingBundles.map(bundle => `${actor.id}/${bundle}`)) }));
