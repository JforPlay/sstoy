import '../shared';
import { i18n } from '../i18n';
import { initGlobalHeader } from '../shared/ui-components';
import { initLanguageChangeListener } from '../shared/events';
import * as appGuide from '../modules/app-guide';

(async () => {
  if (document.readyState === 'loading') {
    await new Promise<void>((resolve) => document.addEventListener('DOMContentLoaded', () => resolve()));
  }
  await i18n.init();
  initLanguageChangeListener();
  initGlobalHeader('guide');
  appGuide.init();
  await appGuide.renderGuide();
  document.addEventListener('languageChanged', () => void appGuide.renderGuide());
})().catch((error) => console.error('[GuideMain] Failed to initialize:', error));
