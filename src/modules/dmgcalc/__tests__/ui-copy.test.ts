import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('calculator copy',()=>{
  it('keeps guidance direct and free of replacement disclaimers',()=>{
    const language=JSON.parse(readFileSync('public/lang/ko.json','utf8'));
    const text=[JSON.stringify(language.dmgcalc),...[
      'ui/cycle-panel.ts','ui/badge-panel.ts','core/combat-example-model.ts','core/combat-optimizer.ts',
    ].map(path=>readFileSync(`src/modules/dmgcalc/${path}`,'utf8'))].join('\n');
    expect(text).not.toMatch(/대체하지|임의 계수|검사하는 화면|검증되지 않은|자동으로 만점을|선택을 무시하지/);
    expect(text).toContain('계산 기준');
    expect(text).toContain('계산 오류:');
  });
});
