import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { loadExampleCombatTables } = await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-data.ts');
  const { optimizeExampleCycles } = await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-optimizer.ts');
  const tables = await loadExampleCombatTables(async name => JSON.parse(await readFile(`public/data/${name}.json`, 'utf8')));
  const example = JSON.parse(await readFile('public/guides/rotation-example.json', 'utf8'));
  const results = {};
  const controls = JSON.parse(await readFile('public/data/ScoreBossControl.json', 'utf8'));
  const now = Date.now();
  const current = Object.values(controls).filter(row => Date.parse(row.StartTime) <= now && now < Date.parse(row.EndTime))
    .sort((a, b) => Date.parse(b.StartTime) - Date.parse(a.StartTime))[0];
  const targets = current?.LevelGroup || [26, 27];
  for (const boss of targets) {
    results[boss] = optimizeExampleCycles(example, tables, { boss, distance: 2, cinematics: true }, (done, total) => {
      if (done % 10 === 0) console.log(`보스 ${boss}: ${done}/${total}`);
    });
    console.log(`보스 ${boss}`, results[boss].candidates.map(row => ({ score: row.damageScore, damage: row.damage, improvement: row.improvement })));
  }
  await writeFile('reports/rotation-example-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n');
} finally { await server.close(); }
