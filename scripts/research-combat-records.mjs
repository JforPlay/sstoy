import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),source=process.argv[2]??'C:/Users/User/.codex/tmp/stella-disc-current';
const read=async n=>JSON.parse(await readFile(resolve(root,`public/data/${n}.json`),'utf8'));
const [discs,items,main,secondary]=await Promise.all(['Disc','Item','MainSkill','SecondarySkill'].map(read));
const records={};
for(const disc of Object.values(discs).filter(d=>d.Visible&&d.Available&&items[d.Id]?.Rarity===1)){
  const fields={},path=disc.SkillScript?resolve(source,`${disc.SkillScript}.decompiled.cs`):null;
  const code=path?await readFile(path,'utf8'):'';
  for(const match of code.matchAll(/private (?:readonly )?(?:static )?(?:readonly )?List<(?:int|FP)>\s+(\w+)\s*=\s*new List<(?:int|FP)>\s*\{([\s\S]*?)\};/g)){
    const text=match[2].replace(/FP\.op_Implicit\(([^)]+)\)/g,'$1');
    if(!/^[\s,\d.\-]+$/.test(text))throw new Error(`Unsupported list ${disc.Id}/${match[1]}`);
    fields[match[1]]=text.split(',').map(s=>Number(s.trim())).filter(Number.isFinite);
  }
  for(const match of code.matchAll(/private (?:const |readonly |static )*(?:int|FP)\s+(\w+)\s*=\s*(?:FP\.op_Implicit\()?(-?[\d.]+)\)?;/g))fields[match[1]]=Number(match[2]);
  for(const dictionary of code.matchAll(/private Dictionary<int, List<int>>\s+(\w+)\s*=\s*new Dictionary<int, List<int>>\s*\{([\s\S]*?)\n\s*\};/g))
    for(const row of dictionary[2].matchAll(/\[(\d+)\]\s*=\s*new List<int>\s*\{([\d\s,]+)\}/g))fields[`${dictionary[1]}_${row[1]}`]=row[2].split(',').map(Number);
  records[disc.Id]={id:disc.Id,element:disc.EET,fields,
    main:Object.values(main).filter(row=>row.GroupId===disc.MainSkillGroupId),
    secondary:Object.values(secondary).filter(row=>[disc.SecondarySkillGroupId1,disc.SecondarySkillGroupId2].includes(row.GroupId)),
    source:path?{type:disc.SkillScript,sha256:createHash('sha256').update(code).digest('hex')}:null};
}
await mkdir(resolve(root,'reports/record-research'),{recursive:true});
await writeFile(resolve(root,'public/data/CombatRecords.json'),JSON.stringify(records));
await writeFile(resolve(root,'reports/record-research/inventory.json'),JSON.stringify(records,null,2));
console.log(`5성 레코드 ${Object.keys(records).length}개 수집`);
