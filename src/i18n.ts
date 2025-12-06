/**
 * Internationalization (i18n) System
 *
 * Manages language switching and translation updates across the entire application.
 * Supports 4 game data languages (KR, JP, EN, CN) with 3 UI languages (Korean, Japanese, English).
 *
 * Key Features:
 * - Dual-layer i18n: Game data language + UI text language
 * - Automatic DOM update via data-i18n attributes
 * - LocalStorage persistence for user preferences
 * - Custom event system for language change notifications
 * - Fallback handling for missing translations
 * - Lazy loading of UI language files
 *
 * Language Mapping:
 * - KR → Korean UI (ko.json) + Korean game data
 * - JP → Japanese UI (jp.json) + Japanese game data
 * - EN → English UI (en.json) + English game data
 * - CN → English UI (en.json) + Chinese game data (fallback UI until cn.json available)
 *
 * Usage Pattern:
 * 1. Page loads → i18n.init() loads language from localStorage
 * 2. User changes language → i18n.setLanguage('JP')
 * 3. New UI file loads if needed (ko.json → en.json)
 * 4. DOM updates automatically via data-i18n attributes
 * 5. 'languageChanged' event fired for modules to reload data
 *
 * @module i18n
 * @see {@link shared/data-loader} For loading language-specific game data
 * @see {@link types/index} For GameLanguage and UILanguage types
 */

import type { GameLanguage, UILanguage, I18n } from './types';
import { fetchJSON, log } from './shared';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Translation value type (supports nested structures)
 */
type TranslationValue = string | Record<string, string | Record<string, string>>;

/**
 * Translation dictionary loaded from JSON files
 */
type Translations = Record<string, TranslationValue>;

/**
 * Event detail payload for languageChanged event
 *
 * @interface LanguageChangeDetail
 */
interface LanguageChangeDetail {
  gameLang: GameLanguage;
  uiLang: UILanguage;
  dataPath: string;
}

// =============================================================================
// I18N MANAGER
// =============================================================================

/**
 * I18nManager class handling all translation and language switching
 *
 * Singleton pattern - one instance manages app-wide i18n state.
 * Access via `window.i18n` for global availability.
 *
 * @class I18nManager
 * @implements {I18n}
 */
class I18nManager implements I18n {
  /** Currently active game data language (KR, JP, EN, CN) */
  currentLang: GameLanguage = 'KR';

  /** Currently active UI text language (ko, en) */
  uiLang: UILanguage = 'ko';

  /** Loaded UI translations from lang/{uiLang}.json */
  translations: Translations = {};

  /**
   * Maps game language to corresponding UI language
   *
   * Mapping:
   * - KR → Korean UI (ko.json)
   * - JP → Japanese UI (jp.json)
   * - EN → English UI (en.json)
   * - CN → English UI (en.json) - fallback until cn.json is available
   *
   * @param gameLang - Game language to map (defaults to current)
   * @returns UI language code (ko, jp, or en)
   */
  getUILang(gameLang: GameLanguage = this.currentLang): UILanguage {
    switch (gameLang) {
      case 'KR':
        return 'ko';
      case 'JP':
        return 'jp';
      case 'EN':
      case 'CN':
      default:
        return 'en';
    }
  }

  /**
   * Gets data folder path for a language
   *
   * Used by data-loader to construct paths to language-specific JSON files.
   *
   * @param gameLang - Game language (defaults to current)
   * @returns Path string (e.g., 'data/KR', 'data/JP')
   */
  getDataPath(gameLang: GameLanguage = this.currentLang): string {
    return `data/${gameLang}`;
  }

  /**
   * Initializes the i18n system on app startup
   *
   * Loads language preference from localStorage, loads corresponding UI
   * language file, and updates page translations.
   *
   * Priority Order:
   * 1. Provided lang parameter
   * 2. localStorage 'gameLang' value
   * 3. Default to 'KR'
   *
   * Should be called once during app initialization before loading game data.
   *
   * @param lang - Optional language to force (overrides localStorage)
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * // In app entry point
   * await i18n.init();
   * await loadCoreData();
   * ```
   */
  async init(lang?: GameLanguage | null): Promise<void> {
    // Load from localStorage or use provided/default
    const storedLang = localStorage.getItem('gameLang') as GameLanguage | null;
    this.currentLang = lang ?? storedLang ?? 'KR';
    
    // Ensure default is persisted if nothing was stored
    if (!storedLang && !lang) {
      localStorage.setItem('gameLang', 'KR');
    }

    this.uiLang = this.getUILang(this.currentLang);

    await this.loadUILanguage(this.uiLang);
    this.updatePage();

    log(`[i18n] Initialized: Game=${this.currentLang}, UI=${this.uiLang}`);
  }

  /**
   * Loads UI language file from lang/ directory
   *
   * Fetches ko.json or en.json and populates translations object.
   * Falls back to Korean if English fails to load.
   *
   * @param uiLang - UI language code (ko or en)
   * @returns Promise that resolves when file is loaded
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
   * Gets translated string by key with dot notation support
   *
   * Supports nested key access: 'nav.home', 'builder.marks.essential'
   * Returns key itself if translation not found (graceful degradation).
   *
   * @param key - Translation key with dot notation
   * @returns Translated string or original key if not found
   *
   * @example
   * ```typescript
   * const title = i18n.t('builder.title');
   * // Returns: "도자기 공방" (KR) or "Pottery Workshop" (EN)
   *
   * const notFound = i18n.t('missing.key');
   * // Returns: "missing.key" (fallback)
   * ```
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
   * Updates all DOM elements with i18n attributes
   *
   * Scans for data-i18n, data-i18n-placeholder, and data-i18n-title attributes
   * and replaces content with translated text. Also updates language selector
   * dropdown and removes loading class for fade-in animation.
   *
   * Automatically called after language changes and during initialization.
   *
   * @example
   * ```html
   * <!-- HTML before updatePage() -->
   * <h1 data-i18n="builder.title">Loading...</h1>
   * <input data-i18n-placeholder="common.search" placeholder="Loading...">
   *
   * <!-- HTML after updatePage() with KR language -->
   * <h1 data-i18n="builder.title">도자기 공방</h1>
   * <input data-i18n-placeholder="common.search" placeholder="검색">
   * ```
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
   * Changes the current language and reloads UI
   *
   * Complete language switching process:
   * 1. Update currentLang and uiLang
   * 2. Persist to localStorage
   * 3. Load new UI language file if UI language changed
   * 4. Update all DOM elements with new translations
   * 5. Fire 'languageChanged' event for modules to reload game data
   *
   * Modules listening to 'languageChanged' should:
   * - Call loadLanguageData() with new language
   * - Re-render UI with new localized data
   *
   * @param gameLang - New game language (KR, JP, EN, CN)
   * @returns Promise that resolves when language change is complete
   *
   * @example
   * ```typescript
   * // User selects Japanese
   * await i18n.setLanguage('JP');
   * // UI switches to English, game data switches to Japanese
   *
   * // Listen for changes in modules
   * window.addEventListener('languageChanged', (e) => {
   *   const { gameLang, dataPath } = e.detail;
   *   await loadLanguageData(gameLang, ['Character.json', 'Skill.json']);
   *   renderCharacters();
   * });
   * ```
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
   * Gets current language configuration
   *
   * Returns complete language state including game language, UI language,
   * and data path. Useful for modules that need language context.
   *
   * @returns Language configuration object
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
// SINGLETON EXPORT
// =============================================================================

/**
 * Global i18n singleton instance
 *
 * Exported for both ES6 imports and window.i18n access.
 * Modules should import this instance rather than creating new ones.
 *
 * @example
 * ```typescript
 * // ES6 import
 * import { i18n } from './i18n';
 *
 * // Global access (for debugging, legacy code)
 * window.i18n.t('builder.title');
 * console.info(window.i18n.currentLang); // 'KR'
 * ```
 */
export const i18n = new I18nManager();

// Make globally accessible for debugging and legacy compatibility
if (typeof window !== 'undefined') {
  window.i18n = i18n;
}

export default i18n;
