/**
 * ================================
 * Icon System (Font Awesome 6)
 * ================================
 * Centralized icon mapping for consistent usage across the entire application
 * Requires Font Awesome 6 CDN to be loaded in HTML <head>
 */

const ICONS = {
    // Navigation & Core
    logo: 'fa-solid fa-star',
    characterDB: 'fa-solid fa-book',
    pottery: 'fa-solid fa-medal',
    tasks: 'fa-solid fa-clipboard-list',
    resources: 'fa-solid fa-box',
    guide: 'fa-solid fa-book-open',

    // Positions & Characters
    people: 'fa-solid fa-users',
    master: 'fa-solid fa-crown',
    assist: 'fa-solid fa-chess-pawn',

    // Features & Sections
    dating: 'fa-solid fa-heart',
    images: 'fa-solid fa-image',
    archive: 'fa-solid fa-book-bookmark',
    stats: 'fa-solid fa-chart-bar',
    disc: 'fa-solid fa-compact-disc',
    summary: 'fa-solid fa-list-check',
    chat: 'fa-solid fa-message',
    comments: 'fa-solid fa-comments',

    // Actions
    add: 'fa-solid fa-plus',
    remove: 'fa-solid fa-trash-can',
    edit: 'fa-solid fa-pen-to-square',
    save: 'fa-solid fa-floppy-disk',
    copy: 'fa-solid fa-copy',
    share: 'fa-solid fa-share-nodes',
    download: 'fa-solid fa-download',

    // UI Elements
    check: 'fa-solid fa-check',
    close: 'fa-solid fa-xmark',
    target: 'fa-solid fa-bullseye',
    star: 'fa-solid fa-star',
    memo: 'fa-solid fa-note-sticky',
    construction: 'fa-solid fa-triangle-exclamation',

    // Theme
    sun: 'fa-solid fa-sun',
    moon: 'fa-solid fa-moon',

    // Stats Icons
    attack: 'fa-solid fa-sword',
    hp: 'fa-solid fa-heart',
    defense: 'fa-solid fa-shield',
    accuracy: 'fa-solid fa-bullseye',
    critRate: 'fa-solid fa-burst',
    critPower: 'fa-solid fa-bolt',
    toughness: 'fa-solid fa-dumbbell',

    // Misc
    birthday: 'fa-solid fa-cake-candles',
    heartBroken: 'fa-solid fa-heart-crack',

    // Empty States
    emptyClipboard: 'fa-regular fa-clipboard',
    emptyChart: 'fa-solid fa-chart-simple',

    // Status
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-exclamation',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
};

/**
 * Get icon HTML string
 * @param {string} iconName - Key from ICONS object
 * @param {string} additionalClasses - Additional CSS classes
 * @returns {string} HTML string for icon
 */
function getIcon(iconName, additionalClasses = '') {
    const iconClass = ICONS[iconName] || ICONS.star;
    return `<i class="${iconClass} ${additionalClasses}"></i>`;
}

/**
 * Create icon element
 * @param {string} iconName - Key from ICONS object
 * @param {string} additionalClasses - Additional CSS classes
 * @returns {HTMLElement} Icon element
 */
function createIconElement(iconName, additionalClasses = '') {
    const i = document.createElement('i');
    const iconClass = ICONS[iconName] || ICONS.star;
    i.className = `${iconClass} ${additionalClasses}`.trim();
    return i;
}

// Make icon functions globally available
window.ICONS = ICONS;
window.getIcon = getIcon;
window.createIconElement = createIconElement;

// Load Navbar Component
(function() {
    'use strict';

    // Initialize hamburger menu for mobile navigation
    function initHamburgerMenu() {
        const hamburger = document.getElementById('navbar-hamburger');
        const menu = document.getElementById('navbar-menu');

        if (!hamburger || !menu) {
            console.log('[Navbar] Hamburger menu elements not found');
            return;
        }

        // Toggle menu on hamburger click
        hamburger.addEventListener('click', () => {
            menu.classList.toggle('open');

            // Toggle icon between bars and X
            const icon = hamburger.querySelector('i');
            if (menu.classList.contains('open')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking on a link
        const navLinks = menu.querySelectorAll('.navbar-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('open');
                const icon = hamburger.querySelector('i');
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            // Don't close if clicking on language selector or theme toggle
            if (e.target.closest('.language-select') || e.target.closest('.theme-toggle')) {
                return;
            }

            if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('open');
                const icon = hamburger.querySelector('i');
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Initialize navbar components (Jekyll includes navbar at build time)
    function initNavbar() {
        // Initialize theme
        if (typeof window.initTheme === 'function') {
            window.initTheme();
        }

        // Set active nav link
        if (typeof window.setActiveNavLink === 'function') {
            window.setActiveNavLink();
        }

        // Update language selector to match current i18n language
        if (window.i18n && typeof window.i18n.updatePage === 'function') {
            window.i18n.updatePage();
        }

        // Initialize hamburger menu toggle
        initHamburgerMenu();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbar);
    } else {
        initNavbar();
    }
})();

// Navigation and Theme Management
(function() {
    'use strict';
    
    // Initialize theme from localStorage or default to dark
    window.initTheme = function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);
    }
    
    // Set theme
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeToggle(theme);
    }
    
    // Update theme toggle button
    function updateThemeToggle(theme) {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('.theme-icon');
        const text = toggleBtn.querySelector('.theme-toggle-text');

        if (icon) {
            if (theme === 'light') {
                icon.className = `theme-icon ${ICONS.moon}`;
                if (text) {
                    text.setAttribute('data-i18n', 'nav.themeDark');
                    text.textContent = window.i18n ? window.i18n.t('nav.themeDark') : '다크';
                }
            } else {
                icon.className = `theme-icon ${ICONS.sun}`;
                if (text) {
                    text.setAttribute('data-i18n', 'nav.themeLight');
                    text.textContent = window.i18n ? window.i18n.t('nav.themeLight') : '라이트';
                }
            }
        }
    }
    
    // Toggle theme
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }
    
    // Make toggleTheme available globally
    window.toggleTheme = toggleTheme;
    
    // Navigation functionality
    window.setActiveNavLink = function setActiveNavLink() {
        // Get current page filename without extension
        const pathname = window.location.pathname;
        const currentPage = pathname.split('/').pop().replace('.html', '') || 'index';
        const navLinks = document.querySelectorAll('.navbar-link');

        navLinks.forEach(link => {
            const pageName = link.getAttribute('data-page');

            // Match based on data-page attribute
            // For index page, currentPage will be 'index' or empty
            if (pageName === currentPage || (currentPage === 'index' && !pageName)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
})();

// Toast Notification System
(function() {
    'use strict';
    
    // Create toast container if it doesn't exist
    function ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    // Show toast notification
    function showToast(message, type = 'error', duration = 3000) {
        const container = ensureToastContainer();
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Add icon based on type
        const iconMap = {
            error: 'error',
            warning: 'warning',
            success: 'success',
            info: 'info'
        };

        toast.innerHTML = `
            <span class="toast-icon">${getIcon(iconMap[type] || 'info')}</span>
            <span class="toast-message">${message}</span>
        `;
        
        // Add to container
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('toast-show'), 10);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300); // Wait for fade out animation
        }, duration);
    }
    
    // Make showToast available globally
    window.showToast = showToast;
    
    // Override native alert for toast notifications
    window.showError = function(message) {
        showToast(message, 'error');
    };
    
    window.showWarning = function(message) {
        showToast(message, 'warning');
    };
    
    window.showSuccess = function(message) {
        showToast(message, 'success');
    };
    
    window.showInfo = function(message) {
        showToast(message, 'info');
    };
})();

// Main Tab Switching
function switchMainTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.compact-main-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`main-tab-${tabName}`)?.classList.add('active');

    // Show/hide position tabs based on whether characters tab is active
    const positionTabs = document.getElementById('position-tabs-inline');
    if (positionTabs) {
        if (tabName === 'characters') {
            positionTabs.classList.remove('hidden');
        } else {
            positionTabs.classList.add('hidden');
        }
    }

    // Update summary when switching to summary tab
    if (tabName === 'summary' && typeof updateSummary === 'function') {
        updateSummary();
    }

    // Render discs when switching to discs tab
    if (tabName === 'discs' && typeof renderDiscs === 'function') {
        renderDiscs();
    }

    // Render presets when switching to preset tab
    if (tabName === 'preset' && typeof window.renderPresets === 'function') {
        window.renderPresets();
    }
}

// Make globally available
window.switchMainTab = switchMainTab;

// ============================================================================
// POTENTIAL ICON UTILITIES
// ============================================================================

/**
 * Generate potential icon HTML for compact display (summary tab)
 * @param {number} potId - Potential ID
 * @param {string} position - Character position (master/assist1/assist2)
 * @param {number} level - Potential level
 * @param {string} mark - Optional mark badge (필수/다다익선/명함만/후순위)
 * @returns {string} HTML string for potential icon
 */
window.generatePotentialIconHTML = function(potId, position, level, mark = '') {
    if (!window.state?.potentials?.[potId]) return '';

    const potential = window.state.potentials[potId];
    const itemData = window.state.items?.[potId];

    // Get potential name
    const briefDescKey = potential.BriefDesc;
    const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
    const name = itemKey ? (window.state.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;

    // Get icon path
    let iconPath = '';
    if (itemData?.Icon) {
        const iconName = itemData.Icon.split('/').pop();
        iconPath = `assets/skill_icons/${iconName}_A.png`;
    }

    // Determine background image based on Stype
    let backgroundImage = '';
    if (itemData) {
        if (itemData.Stype === 42) {
            backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
        } else if (itemData.Stype === 41) {
            if (itemData.Rarity === 1) {
                backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
            } else if (itemData.Rarity === 2) {
                backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
            }
        }
    }

    // Migrate old mark values to new ones
    let migratedMark = mark;
    if (mark === '권장') migratedMark = '다다익선';
    if (mark === 'Lv.1') migratedMark = '명함만';

    // Generate mark badge HTML
    let markBadgeHTML = '';
    if (migratedMark === '필수') {
        markBadgeHTML = '<span class="pot-mark-badge essential">필수</span>';
    } else if (migratedMark === '다다익선') {
        markBadgeHTML = '<span class="pot-mark-badge recommended">다다익선</span>';
    } else if (migratedMark === '명함만') {
        markBadgeHTML = '<span class="pot-mark-badge level-one">명함만</span>';
    } else if (migratedMark === '후순위') {
        markBadgeHTML = '<span class="pot-mark-badge low-priority">후순위</span>';
    }

    return `
        <div class="potential-icon-card">
            <div class="potential-icon-compact"
                 draggable="true"
                 data-potential-id="${potId}"
                 data-position="${position}">
                ${backgroundImage ? `<img src="${backgroundImage}" alt="" class="pot-bg-img" onerror="this.style.display='none'">` : ''}
                ${iconPath ? `<img src="${iconPath}" alt="${name}" class="pot-icon-img" onerror="this.style.display='none'">` : '<span class="pot-icon-placeholder">✦</span>'}
                <div class="pot-level-badge">Lv.${level}</div>
                ${markBadgeHTML}
            </div>
            <div class="pot-name-label">${name}</div>
        </div>
    `;
};
