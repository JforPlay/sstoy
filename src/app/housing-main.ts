import '../shared';
import { i18n } from '../i18n';
import { initGlobalHeader } from '../shared/ui-components';
import { initLanguageChangeListener } from '../shared/events';
import { initHousing } from '../modules/app-housing';

(async () => {
  if (document.readyState === 'loading') {
    await new Promise<void>(resolve => document.addEventListener('DOMContentLoaded', () => resolve()));
  }
  await i18n.init();
  initLanguageChangeListener();
  initGlobalHeader('housing');
  await initHousing();
})().catch(error => {
  console.error('[Housing]', error);
  const app = document.getElementById('housing-app');
  if (app) { app.textContent = i18n.t('housing.loadError'); app.setAttribute('aria-busy', 'false'); }
});
