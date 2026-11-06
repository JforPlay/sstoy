import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const sourceRoot=process.env.STELLA_MANAGED_SOURCE || 'C:/Users/User/.codex/tools/rea/investigations/stella/managed-analysis/decompiled-current';
const characters=JSON.parse(await readFile(join(root,'public/data/Character.json'),'utf8'));
const gate=/CheckTalentLevel\s*\(|CheckActorActiveTalentLevel\s*\(/;
function blockEnd(source,start) {
  let depth=0,state='code';
  for(let index=start;index<source.length;index++) {
    const char=source[index],next=source[index+1];
    if(state==='line'){if(char==='\n')state='code';continue;}
    if(state==='comment'){if(char==='*'&&next==='/'){state='code';index++;}continue;}
    if(state==='string'||state==='char') {
      if(char==='\\'){index++;continue;}
      if(char===(state==='string'?'"':"'"))state='code';
      continue;
    }
    if(char==='/'&&next==='/'){state='line';index++;continue;}
    if(char==='/'&&next==='*'){state='comment';index++;continue;}
    if(char==='"'){state='string';continue;}
    if(char==="'"){state='char';continue;}
    if(char==='{')depth++;
    if(char==='}'&&--depth===0)return index+1;
  }
  throw new Error('Unbalanced native method');
}
const result=[];
for(const actor of Object.values(characters).filter(row=>row.Visible&&row.Available).sort((a,b)=>a.Id-b.Id)) {
  const folder=join(sourceRoot,'AIScript/Character',`_${actor.Id}01`),files=[];
  for(const name of (await readdir(folder)).filter(name=>name.endsWith('.cs')).sort()) {
    const source=await readFile(join(folder,name),'utf8');
    if(!gate.test(source))continue;
    const declarations=source.split('\n').filter(line=>/^\t(?:public|private|protected|internal)\s.*=/.test(line)&&!line.includes('=>')).map(line=>line.trim());
    const tokens=[...new Set(declarations.flatMap(line=>[...line.matchAll(/\b\w*(?:_[mMtTfF][1-5]|[Tt]alent)\w*\b/g)].map(match=>match[0])))];
    const reference=tokens.length?new RegExp(`\\b(?:${tokens.join('|')})\\b`):null;
    const methods=[];
    for(const match of source.matchAll(/^\t(?:public|private|protected|internal) [^\r\n;=]+\([^\r\n]*\)\s*\r?\n\t\{/gm)) {
      const open=source.indexOf('{',match.index),end=blockEnd(source,open),body=source.slice(match.index,end);
      if(gate.test(body)||reference?.test(body)||new RegExp(`\\b${actor.Id}96\\d+\\b`).test(body))methods.push({line:source.slice(0,match.index).split('\n').length,signature:body.split('\n')[0].trim(),source:body});
    }
    if(!methods.length)throw new Error(`Unextracted breakthrough source ${actor.Id}/${name}`);
    files.push({name,sha256:createHash('sha256').update(source).digest('hex'),declarations,methods});
  }
  if(!files.length)throw new Error(`Missing breakthrough evidence ${actor.Id}`);
  result.push({id:actor.Id,files});
}
await mkdir(join(root,'reports'),{recursive:true});
await writeFile(join(root,'reports/combat-breakthrough-evidence.json'),JSON.stringify({warning:'Source evidence only; extraction does not prove runtime implementation.',characters:result},null,2));
console.log(JSON.stringify({characters:result.length,files:result.reduce((n,actor)=>n+actor.files.length,0),methods:result.reduce((n,actor)=>n+actor.files.reduce((n,file)=>n+file.methods.length,0),0)}));
