import type { DmgCalcState } from '../types';
import { renderWizard } from './wizard';

/** Main calculator view; each stage reuses the existing calculator panels. */
export function renderDmgCalc(state: DmgCalcState): string {
  return renderWizard(state);
}
