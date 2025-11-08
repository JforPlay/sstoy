// Navigation and Theme Management
(function() {
    'use strict';
    
    // Initialize theme from localStorage or default to dark
    function initTheme() {
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
        
        if (theme === 'light') {
            icon.textContent = '🌙';
            if (text) text.textContent = '다크';
        } else {
            icon.textContent = '☀️';
            if (text) text.textContent = '라이트';
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
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
    
    // Navigation functionality
    function setActiveNavLink() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.navbar-link');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
    
    // Set active link on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setActiveNavLink);
    } else {
        setActiveNavLink();
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
        const icons = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
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
    document.querySelectorAll('.main-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`main-tab-${tabName}`)?.classList.add('active');
    
    // Update summary when switching to summary tab
    if (tabName === 'summary' && typeof updateSummary === 'function') {
        updateSummary();
    }
    
    // Render discs when switching to discs tab
    if (tabName === 'discs' && typeof renderDiscs === 'function') {
        renderDiscs();
    }
}

// Make globally available
window.switchMainTab = switchMainTab;
