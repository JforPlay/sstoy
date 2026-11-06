import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
const root=resolve(import.meta.dirname,'..');
const sourceRoot=process.env.STELLA_MANAGED_SOURCE || 'C:/Users/User/.codex/tools/rea/investigations/stella/managed-analysis/decompiled-current';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {reviewedBreakthroughRules}=await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-breakthrough-rules.ts');
  const mismatches=[],references=[];
  for(const [id,rules] of Object.entries(reviewedBreakthroughRules)) {
    const folder=join(sourceRoot,'AIScript/Character',`_${id}01`);
    const files=await Promise.all((await readdir(folder)).filter(file=>file.endsWith('.cs')).map(async file=>({file,source:await readFile(join(folder,file),'utf8')})));
    const monsterRoot=join(sourceRoot,'AIScript/Monster');
    for(const entry of (await readdir(monsterRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&entry.name.startsWith(`_${id}0`))) {
      const directory=join(monsterRoot,entry.name);
      for(const file of (await readdir(directory)).filter(file=>file.endsWith('.cs')))files.push({file:`Monster/${entry.name}/${file}`,source:await readFile(join(directory,file),'utf8')});
    }
    for(const rule of rules)for(const match of (rule.when?.toString() ?? '').matchAll(/combatTagHash\(["']([^"']+)["']/g)) {
      const tag=match[1],evidence=files.filter(file=>file.source.includes(JSON.stringify(tag))).map(file=>file.file);
      const entry={character:Number(id),rule:rule.id,tag,evidence};
      references.push(entry);if(!evidence.length)mismatches.push(entry);
    }
  }
  await writeFile(join(root,'reports/combat-tag-references.json'),JSON.stringify({warning:'Literal-reference audit, not a proof of event ordering or runtime coverage.',references,mismatches},null,2));
  console.log(JSON.stringify({characters:Object.keys(reviewedBreakthroughRules).length,references:references.length,mismatches}));
  if(mismatches.length)process.exitCode=1;
} finally {await server.close();}
