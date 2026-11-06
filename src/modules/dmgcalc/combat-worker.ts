import { assetURL } from '@/shared/asset-url';
import { loadExampleCombatTables } from './core/combat-data';
import { optimizeExampleCycles } from './core/combat-optimizer';
import type { ExampleCombatOptions } from './core/combat-example-model';
import type { LiveCombatInput } from './core/combat-live-build';
import type { CombatBuildExample } from './core/combat-build';

self.onmessage = async (event: MessageEvent<{ base: string; options: ExampleCombatOptions; input: LiveCombatInput }>) => {
  try {
    const read = async (path: string) => {
      const response = await fetch(new URL(assetURL(path), event.data.base));
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    };
    if (!event.data.input) throw new Error('화면의 파티 설정이 전달되지 않았습니다.');
    const tables = await loadExampleCombatTables(name => read(`data/${name}.json`), event.data.input.actors.map(actor => actor.id));
    const input = event.data.input;
    const example: CombatBuildExample = { potentialPreset: '', durationSeconds: 180, notes: 'concertoMinimum',
      badgeOptions: input.badgeOptions, characters: input.actors.map(actor => ({ id: actor.id, limitBreak: actor.limitBreak })),
      records: input.records, concertos: [], live: input };
    const result = optimizeExampleCycles(example, tables, event.data.options,
      (done, total) => self.postMessage({ type: 'progress', done, total }));
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
