import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const [file]=process.argv.slice(2);
if(!file)throw new Error('추출한 runtime JSON 경로가 필요합니다.');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const data=await read(file),index=await read('public/data/CombatCharacterIndex.json');
if(JSON.stringify(data.rules)!==JSON.stringify(index.rules))throw new Error('공통 전투 규칙이 변경되었습니다. 전체 여행가 데이터를 함께 갱신해야 합니다.');
const characters=await read('public/data/Character.json'),names=await read('public/data/KR/Character.json');
for(const timing of data.characters){
  if(timing.missingBundles.length||!timing.timelines.length)throw new Error(`전투 에셋 누락: ${timing.id}`);
  const bytes=JSON.stringify(timing),actor=characters[timing.id];
  await writeFile(resolve(root,`public/data/combat/${timing.id}.json`),bytes);
  index.characters[timing.id]={id:timing.id,nameKey:actor.Name,name:names[actor.Name],path:`combat/${timing.id}.json`,
    sha256:createHash('sha256').update(bytes).digest('hex'),timelines:timing.timelines.length,
    missingBundles:timing.missingBundles,readWarnings:timing.readWarnings.length,schemaRecoveries:timing.schemaRecoveries?.length??0};
}
await writeFile(resolve(root,'public/data/CombatCharacterIndex.json'),JSON.stringify(index,null,2));
console.log(`전투 데이터 등록: ${data.characters.map(actor=>actor.id).join(', ')}`);
