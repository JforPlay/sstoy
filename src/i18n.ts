/**
 * Internationalization (i18n) Module
 *
 * Supports 4 game languages (KR, JP, EN, CN) with 2 UI languages (ko, en)
 * - KR uses Korean UI
 * - JP, EN, CN use English UI
 */

import type { GameLanguage, UILanguage, I18n } from '@/types';
import { fetchJSON, log } from '@/shared';

// =============================================================================
// TYPES
// =============================================================================

type TranslationValue = string | Record<string, string | Record<string, string>>;
type Translations = Record<string, TranslationValue>;

interface LanguageChangeDetail {
  gameLang: GameLanguage;
  uiLang: UILanguage;
  dataPath: string;
}

// =============================================================================
// I18N IMPLEMENTATION
// =============================================================================

class I18nManager implements I18n {
  currentLang: GameLanguage = 'KR';
  uiLang: UILanguage = 'ko';
  translations: Translations = {};

  /**
   * Map game language to UI language
   * KR uses Korean UI, all others use English UI
   */
  getUILang(gameLang: GameLanguage = this.currentLang): UILanguage {
    return gameLang === 'KR' ? 'ko' : 'en';
  }

  /**
   * Get data folder path for a language
   */
  getDataPath(gameLang: GameLanguage = this.currentLang): string {
    return `data/${gameLang}`;
  }

  /**
   * Initialize the i18n system
   */
  async init(lang?: GameLanguage | null): Promise<void> {
    // Load from localStorage or use provided/default
    const storedLang = localStorage.getItem('gameLang') as GameLanguage | null;
    this.currentLang = lang ?? storedLang ?? 'KR';
    this.uiLang = this.getUILang(this.currentLang);

    await this.loadUILanguage(this.uiLang);
    this.updatePage();

    log(`[i18n] Initialized: Game=${this.currentLang}, UI=${this.uiLang}`);
  }

  /**
   * Load UI language file
   */
  private async loadUILanguage(uiLang: UILanguage): Promise<void> {
    // Use import.meta.env.BASE_URL for Vite compatibility
    const base = import.meta.env.BASE_URL || '/';
    const langPath = `${base}lang/${uiLang}.json`.replace(/\/+/g, '/');

    try {
      this.translations = await fetchJSON<Translations>(langPath);
      log(`[i18n] Loaded UI language: ${uiLang} from ${langPath}`);
    } catch (error) {
      console.error(`[i18n] Failed to load UI language: ${uiLang} from ${langPath}`, error);

      // Fallback to Korean
      if (uiLang !== 'ko') {
        await this.loadUILanguage('ko');
      }
    }
  }

  /**
   * Get translation by key (supports nested keys like "nav.home")
   */
  t(key: string): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (typeof value !== 'object' || value === null) {
        value = undefined;
        break;
      }
      value = value[k];
    }

    return typeof value === 'string' ? value : key;
  }

  /**
   * Update all elements with i18n attributes
   */
  updatePage(): void {
    // Update text content
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Update placeholders
    document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    // Update titles
    document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = this.t(key);
      }
    });

    // Update language selector
    const selector = document.getElementById('language-select') as HTMLSelectElement | null;
    if (selector) {
      selector.value = this.currentLang;
    }

    // Remove loading class for smooth fade-in
    document.documentElement.classList.remove('i18n-loading');
  }

  /**
   * Change the current language
   */
  async setLanguage(gameLang: GameLanguage): Promise<void> {
    this.currentLang = gameLang;
    this.uiLang = this.getUILang(gameLang);

    // Persist to localStorage
    localStorage.setItem('gameLang', gameLang);

    // Load new UI language if changed
    await this.loadUILanguage(this.uiLang);

    // Update page
    this.updatePage();

    // Dispatch custom event for modules to reload data
    const detail: LanguageChangeDetail = {
      gameLang,
      uiLang: this.uiLang,
      dataPath: this.getDataPath(gameLang),
    };

    window.dispatchEvent(
      new CustomEvent('languageChanged', { detail })
    );

    log(`[i18n] Language changed: Game=${gameLang}, UI=${this.uiLang}`);
  }

  /**
   * Get current language info
   */
  getLanguageInfo(): LanguageChangeDetail {
    return {
      gameLang: this.currentLang,
      uiLang: this.uiLang,
      dataPath: this.getDataPath(this.currentLang),
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const i18n = new I18nManager();

// Make globally accessible for legacy code
if (typeof window !== 'undefined') {
  window.i18n = i18n;
}

export default i18n;
