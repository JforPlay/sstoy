// Simple i18n system for Stella Sora Tools
// Supports 4 game languages (KR, JP, EN, CN) with 2 UI languages (KR, EN)

const i18n = {
    currentLang: 'KR',  // Game data language (KR, JP, EN, CN)
    uiLang: 'ko',       // UI language (ko, en)
    translations: {},

    // Mapping: game data language -> UI language
    // KR uses Korean UI, all others use English UI
    getUILang(gameLang) {
        return gameLang === 'KR' ? 'ko' : 'en';
    },

    // Get data folder path based on game language
    getDataPath(gameLang) {
        return `data/${gameLang}`;
    },

    async init(lang = null) {
        // Load from localStorage or default to KR
        this.currentLang = lang || localStorage.getItem('gameLang') || 'KR';
        this.uiLang = this.getUILang(this.currentLang);

        await this.loadUILanguage(this.uiLang);
        this.updatePage();

        console.log(`[i18n] Initialized: Game=${this.currentLang}, UI=${this.uiLang}`);
    },

    async loadUILanguage(uiLang) {
        try {
            const response = await fetch(`js/lang/${uiLang}.json`);
            this.translations = await response.json();
            console.log(`[i18n] Loaded UI language: ${uiLang}`);
        } catch (error) {
            console.error(`[i18n] Failed to load UI language: ${uiLang}`, error);
            // Fallback to Korean
            if (uiLang !== 'ko') {
                await this.loadUILanguage('ko');
            }
        }
    },

    // Get translation by key (supports nested keys like "nav.home")
    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }

        return value || key;
    },

    // Update all elements with i18n attributes
    updatePage() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // Update language selector
        const selector = document.getElementById('language-select');
        if (selector) {
            selector.value = this.currentLang;
        }
    },

    async setLanguage(gameLang) {
        this.currentLang = gameLang;
        this.uiLang = this.getUILang(gameLang);

        // Save to localStorage
        localStorage.setItem('gameLang', gameLang);

        // Load new UI language if it changed
        await this.loadUILanguage(this.uiLang);

        // Update page
        this.updatePage();

        // Trigger custom event for modules to reload data
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: {
                gameLang: gameLang,
                uiLang: this.uiLang,
                dataPath: this.getDataPath(gameLang)
            }
        }));

        console.log(`[i18n] Language changed: Game=${gameLang}, UI=${this.uiLang}`);
    },

    // Get current language info
    getLanguageInfo() {
        return {
            gameLang: this.currentLang,
            uiLang: this.uiLang,
            dataPath: this.getDataPath(this.currentLang)
        };
    }
};

// Make i18n globally accessible
window.i18n = i18n;
