import { parseParamValue } from './param-parser';
import type { ParamParserState } from '../types';

/** Newer boss tables reference BuffValue/EffectValue instead of duplicating
 * Value1..n on the ability row. Reuse the site's existing parameter parser. */
export function formatGuideAbilityText(template: string, ability: Record<string, any>, state: ParamParserState): string {
  return template.replace(/&Param(\d+)&/g, (_, index: string) => {
    const direct = ability[`Value${index}`];
    const param = ability[`Param${index}`] as string | undefined;
    if (direct !== undefined) return String(direct) + (param?.includes(',Pct') ? '%' : '');
    if (!param) return '?';
    return String(parseParamValue(param, 1, 1, null, state).value);
  }).replace(/<[^>]+>/g, '');
}
