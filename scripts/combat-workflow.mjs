import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const root=resolve(import.meta.dirname,'..');
const defaultSource='C:/Users/User/.codex/tools/rea/investigations/stella/managed-analysis/decompiled-current';
const tableNames=['Character','KR/Character','Potential','KR/Potential','CharPotential','TalentGroup','Talent','Skill','HitDamage',
  'Buff','BuffValue','Effect','EffectValue','OnceAdditionalAttribute','OnceAdditionalAttributeValue','ScriptParameter','ScriptParameterValue','Monster','MonsterAI'];
const valueTables={Buff:'BuffValue',Effect:'EffectValue',OnceAdditionalAttribute:'OnceAdditionalAttributeValue',ScriptParameter:'ScriptParameterValue'};
export function rolePotentialIds(pool,role){
  if(!['main','support'].includes(role))throw new Error('역할은 main 또는 support입니다.');
  const prefix=role==='main'?'Master':'Assist';
  return [...new Set([...(pool[`${prefix}SpecificPotentialIds`] ?? []),...(pool[`${prefix}NormalPotentialIds`] ?? []),...(pool.CommonPotentialIds ?? [])])].sort((a,b)=>a-b);
}
export function matrixCases(ids,definitions){
  for(const id of ids)if(!Number.isInteger(definitions[id]?.MaxLevel)||definitions[id].MaxLevel<1)throw new Error(`잠재력 ${id} 최대 레벨 데이터 누락`);
  const levels=Object.fromEntries(ids.map(id=>[id,Math.min(6,definitions[id].MaxLevel)]));
  return [{name:'기본',limitBreak:0,potentials:{}},...ids.map(id=>({name:`잠재력 ${id}`,limitBreak:5,potentials:{[id]:levels[id]}})),
    ...Array.from({length:6},(_,limitBreak)=>({name:`전체 잠재력 / ${limitBreak}돌파`,limitBreak,potentials:{...levels}}))];
}
export async function collectSources(sourceRoot,id,tables,role){
  const folders=new Set([join('AIScript/Character',`_${id}01`)]),exactFiles=new Set(),missing=[];
  const characterFolder=join(sourceRoot,'AIScript/Character',`_${id}01`);
  const characterNames=(await readdir(characterFolder)).filter(name=>name.endsWith('.cs'));
  const contents=new Map(await Promise.all(characterNames.map(async name=>[name,await readFile(join(characterFolder,name),'utf8')])));
  const selected=new Set(characterNames.filter(name=>role==='support'?!name.includes('_MainControl'):role==='main'?!name.includes('_Support'):true));
  // Keep explicitly referenced shared/config/base classes even if their file
  // name is associated with the other role; do not read that whole role.
  let changed=true;
  while(changed){changed=false;const combined=[...selected].map(name=>contents.get(name)).join('\n');
    for(const name of characterNames)if(!selected.has(name)&&new RegExp(`\\b${name.slice(0,-3)}\\b`).test(combined)){selected.add(name);changed=true;}}
  const primary=[...selected].map(name=>contents.get(name));
  const numbers=new Set(primary.flatMap(source=>(source.match(/\b\d{5,10}\b/g) ?? []).map(Number)));
  const aiIds=new Set([...numbers].map(number=>tables.Monster[number]?.FAId).filter(Boolean));
  const matching=Object.values(tables.MonsterAI).filter(ai=>String(ai.ComboGroupPath ?? '').startsWith(`Character/${id}01/`));
  // Reusing a model/combo archive does not mean a tower-defense controller
  // participates in this character's raid mechanics. Follow referenced IDs.
  const monsters=matching.filter(ai=>aiIds.has(ai.Id));
  for(const ai of monsters){
    for(const path of [ai.ActionAIPath,ai.IdleAIPath,ai.SpawnAIPath])if(path?.startsWith('AIScript.Monster.')&&!path.startsWith('AIScript.Monster.Common.'))folders.add(dirname(path.replaceAll('.','/')));
    for(const skillId of [ai.SpawnShowSkillId,ai.DieSkillId]){
      const path=tables.Skill[skillId]?.FCPath;
      if(path?.startsWith('AIScript.Monster.Common.'))exactFiles.add(path.replaceAll('.','/')+'.cs');
      else if(path?.startsWith('AIScript.Monster.'))folders.add(dirname(path.replaceAll('.','/')));
    }
  }
  const files=[];
  for(const folder of [...folders].sort()){
    let names;try{names=await readdir(join(sourceRoot,folder));}catch{missing.push(folder);continue;}
    for(const name of names.filter(name=>name.endsWith('.cs')&&(resolve(join(sourceRoot,folder))!==characterFolder||selected.has(name))).sort()){
      const path=join(folder,name),source=await readFile(join(sourceRoot,path),'utf8');
      files.push({path:path.replaceAll('\\','/'),sha256:createHash('sha256').update(source).digest('hex'),source});
    }
  }
  for(const path of exactFiles){
    if(files.some(file=>file.path===path))continue;
    try{const source=await readFile(join(sourceRoot,path),'utf8');files.push({path,sha256:createHash('sha256').update(source).digest('hex'),source});}
    catch{missing.push(path);}
  }
  return {files,missing,monsterControllers:monsters,otherMatchingControllers:matching.filter(ai=>!aiIds.has(ai.Id))};
}
export function referenceInventory(files,tables){
  // Literal matches are evidence candidates, not inferred execution rules.
  const inventory=new Map();
  const indexed=Object.entries(tables).filter(([name])=>!name.includes('/')&&!['Character','CharPotential','TalentGroup','Talent','MonsterAI'].includes(name));
  for(const file of files)for(const [index,line] of file.source.split('\n').entries()){
    for(const match of line.matchAll(/\b\d{5,10}\b/g)){
      const id=Number(match[0]),matches=indexed.filter(([,rows])=>rows[id]).map(([name])=>name);
      if(!matches.length)continue;
      if(!inventory.has(id))inventory.set(id,{id,tables:matches,locations:[]});
      const entry=inventory.get(id),location={file:file.path,line:index+1,text:line.trim()};
      if(!entry.locations.some(item=>item.file===location.file&&item.line===location.line))entry.locations.push(location);
    }
  }
  return [...inventory.values()].sort((a,b)=>a.id-b.id);
}
export function timelineInventory(timing){
  const missing=[],aliases=timing.comboAliases.map(alias=>({...alias,clips:alias.clips.map((id,index)=>{
    const timeline=timing.timelines.find(row=>row.pathId===id);
    if(!timeline){missing.push({tag:alias.tag,source:alias.source,pathId:id});return {pathId:id,missing:true};}
    const group=Number(alias.eventGroups?.[index]?.split(':')[0] ?? 0);
    return {pathId:id,name:timeline.name,duration:timeline.animationDurationSeconds,group,
      events:timeline.events.filter(event=>event.group===group).map(event=>({type:event.type,name:event.name,tag:event.tag,
        hit:event.hitDamageId,start:event.startSeconds,end:event.endSeconds,spEvent:event.skillTriggerForFateCard,
        projectile:event.bulletPrefab?.m_PathID,area:event.areaEffectPrefab?.m_PathID})),phases:timeline.featurePhasesRaw};
  })}));
  return {aliases,missing,weapons:timing.weapons};
}
async function json(path){return JSON.parse(await readFile(path,'utf8'));}
async function save(path,value){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+'\n');}
function outputFor(id,role){return join(root,'reports/combat-work',`${id}-${role}`);}
async function runtimeModules(){
  const {createServer}=await import('vite');
  const server=await createServer({root,configFile:false,server:{middlewareMode:true},appType:'custom'});
  try{return {values:await server.ssrLoadModule('/src/modules/dmgcalc/core/rotation-values.ts'),
    classifier:await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-rule-classifier.ts'),
    registry:await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-adapter-registry.ts')};}
  finally{await server.close();}
}
export async function prepare(id,role,sourceRoot,{restart=false}={}){
  const started=performance.now(),startedAt=new Date().toISOString(),out=outputFor(id,role);
  const tables=Object.fromEntries(await Promise.all(tableNames.map(async name=>[name,await json(join(root,'public/data',`${name}.json`))])));
  const character=tables.Character[id];if(!character||!tables.CharPotential[id])throw new Error(`여행가 ${id} 데이터가 없습니다.`);
  const potentials=rolePotentialIds(tables.CharPotential[id],role),matrix=matrixCases(potentials,tables.Potential);
  const source=await collectSources(sourceRoot,id,tables,role),references=referenceInventory(source.files,tables);
  const timing=await json(join(root,'public/data/combat',`${id}.json`)),timelines=timelineInventory(timing);
  const {values,classifier,registry}=await runtimeModules();
  const allPotentials=Object.values(tables.CharPotential[id]).filter(Array.isArray).flat();
  const context={characterLevel:90,ascension:8,limitBreak:5,potentials:Object.fromEntries(allPotentials.map(id=>[id,Math.min(6,tables.Potential[id].MaxLevel)])),skillSlots:{1:8,2:8,4:8,5:8},notes:{},concertos:{},buildLevel:1};
  const referenceRows=references.map(reference=>({...reference,rows:reference.tables.map(name=>{
    const row=tables[name][reference.id];
    try{
      const value=valueTables[name]?values.getCombatValue(reference.id,tables[name],tables[valueTables[name]],context):row;
      return {table:name,definition:row,value,...(name==='Effect'?{classification:classifier.classifyCombatEffect(row,value)}:{})};
    }catch(error){return {table:name,definition:row,resolutionError:error.message};}
  })}));
  const skillFields=role==='main'?['NormalAtkId','SkillId','UltimateId','DodgeId']:['AssistNormalAtkId','AssistSkillId','AssistUltimateId'];
  const hookInventory=source.files.map(file=>({file:file.path,hooks:[...new Set([...file.source.matchAll(/AddEventListener\("([^"]+)"/g)].map(m=>m[1]))],
    potentialChecks:[...new Set(file.source.match(/(?:HavePersonalPerk|GetPerk|CheckTalentLevel|CheckActorActiveTalentLevel)\([^;\n]+/g) ?? [])]}));
  const api=await readFile(join(root,'src/modules/dmgcalc/core/combat-support-adapter.ts'),'utf8');
  let previous;try{previous=await json(join(out,'session.json'));}catch{}
  const session=restart||!previous?{id,role,startedAt,startedBeforePreparation:true,targetSeconds:600}:previous;
  const packet={warning:'자동 수집·분류 자료입니다. 숫자 참조 후보나 테스트 실행은 고유 메커니즘 구현·정확성의 증명이 아닙니다.',id,role,
    name:tables['KR/Character'][character.Name],sourceRoot,sourceFiles:source.files.map(({source,...file})=>file),missingSourceFolders:source.missing,
    skills:skillFields.map(field=>({field,id:character[field],row:tables.Skill[character[field]]})),
    potentials:potentials.map(id=>({id,row:tables.Potential[id],title:tables['KR/Potential'][tables.Potential[id].BriefDesc],description:tables['KR/Potential'][tables.Potential[id].Desc]})),
    matrix,hookInventory,referenceRows,monsterControllers:source.monsterControllers,otherMatchingControllers:source.otherMatchingControllers,timelines,
    engineApi:api,connected:{main:registry.connectedCombatMains.includes(id),support:registry.connectedCombatSupports.includes(id)},
    preparationSeconds:(performance.now()-started)/1000};
  await save(join(out,'packet.json'),packet);await save(join(out,'session.json'),session);
  await writeFile(join(out,'source.md'),`# ${packet.name} / ${role}\n\n원본 파일 전체. 자동 추출은 실행 의미 해석을 대신하지 않습니다.\n\n`+
    source.files.map(file=>`## ${file.path}\n\n\x60\x60\x60csharp\n${file.source}\n\x60\x60\x60\n`).join('\n'));
  console.log(JSON.stringify({packet:relative(root,join(out,'packet.json')),source:relative(root,join(out,'source.md')),files:source.files.length,potentials:potentials.length,
    matrixCases:matrix.length,missingSourceFolders:source.missing,missingClips:timelines.missing.length,seconds:packet.preparationSeconds}));
  return packet;
}
async function runStep(name,args,out){
  const started=performance.now(),log=[];
  const code=await new Promise((done,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>{log.push(chunk);process.stdout.write(chunk);});
    child.stderr.on('data',chunk=>{log.push(chunk);process.stderr.write(chunk);});
    child.on('error',reject);child.on('close',code=>done(code ?? 1));
  });
  await mkdir(out,{recursive:true});await writeFile(join(out,`${name}.log`),Buffer.concat(log));
  return {name,passed:code===0,exitCode:code,seconds:(performance.now()-started)/1000,command:[process.execPath,...args]};
}
export async function verify(id,role,{test,party}={}){
  const out=outputFor(id,role),session=await json(join(out,'session.json'));
  if(party)process.env.COMBAT_PARTY=party;
  process.env.COMBAT_CHARACTER=String(id);process.env.COMBAT_ROLE=role;
  const matrix='src/modules/dmgcalc/__tests__/combat-character-matrix.test.ts';
  const dedicated=`src/modules/dmgcalc/__tests__/combat-${role==='main'?'main':'support'}-${id}.test.ts`;
  let exists=false;try{exists=(await stat(join(root,dedicated))).isFile();}catch{}
  process.env.COMBAT_MATRIX_COVERED=exists&&(await readFile(join(root,dedicated),'utf8')).includes('// combat-workflow: native-matrix')?'1':'0';
  const tests=[...new Set([matrix,...(exists?[dedicated]:[]),...(test?test.split(','):[])])];
  for(const file of tests)if(!relative(root,resolve(root,file)).replaceAll('\\','/').startsWith('src/'))throw new Error(`테스트 경로 범위 오류: ${file}`);
  const steps=await Promise.all([runStep('typecheck',['node_modules/typescript/bin/tsc','--noEmit'],out),
    runStep('targeted-tests',['node_modules/vitest/vitest.mjs','run',...tests],out)]);
  const elapsedSeconds=(Date.now()-Date.parse(session.startedAt))/1000;
  const report={id,role,checkedAt:new Date().toISOString(),steps,checksPassed:steps.every(s=>s.passed),
    dedicatedTests:tests.filter(file=>file!==matrix),mechanismReviewRequired:true,characterCompletionClaimed:false,
    elapsedSeconds,targetSeconds:session.targetSeconds,withinTarget:elapsedSeconds<=session.targetSeconds,
    preparationTimingIncluded:Boolean(session.startedBeforePreparation),
    timingNote:session.startedBeforePreparation?'준비 명령부터의 실제 경과 시간이며 대기·휴식도 포함됩니다. 목표 초과로 검증을 생략하지 않습니다.':'초기 스크립트 세션: 준비 완료부터의 경과 시간입니다. 자료 준비 시간은 packet.json에 별도 기록되어 있습니다.'};
  await save(join(out,'verification.json'),report);console.log(JSON.stringify(report));
  if(!report.checksPassed)process.exitCode=1;
  return report;
}
export async function finalize(){
  // Call once per implementation batch, not once per character or small edit.
  const out=join(root,'reports/combat-work/batch');
  const steps=[await runStep('typecheck',['node_modules/typescript/bin/tsc','--noEmit'],out)];
  if(steps[0].passed)steps.push(...await Promise.all([runStep('full-tests',['node_modules/vitest/vitest.mjs','run'],out),
    runStep('build',['node_modules/vite/bin/vite.js','build'],out)]));
  const report={checkedAt:new Date().toISOString(),steps,checksPassed:steps.every(s=>s.passed)};
  await save(join(out,'verification.json'),report);if(!report.checksPassed)process.exitCode=1;
}
async function main(){
  const [command,idText,...options]=process.argv.slice(2),flags={};
  for(let i=0;i<options.length;i++){const key=options[i];if(!key.startsWith('--'))throw new Error(`알 수 없는 인수: ${key}`);flags[key.slice(2)]=options[i+1]?.startsWith('--')||!options[i+1]?true:options[++i];}
  if(command==='finalize')return finalize();
  const id=Number(idText),role=flags.role ?? 'main';if(!Number.isInteger(id)||id<=0||!['main','support'].includes(role))throw new Error('사용법: combat:prepare -- 110 --role main / combat:check -- 110 --role main');
  if(command==='prepare')return prepare(id,role,resolve(flags.source ?? process.env.STELLA_MANAGED_SOURCE ?? defaultSource),{restart:Boolean(flags.restart)});
  if(command==='verify')return verify(id,role,{test:flags.test,party:flags.party});
  throw new Error(`알 수 없는 명령: ${command}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error);process.exitCode=1;});
