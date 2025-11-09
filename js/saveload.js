// Save/Load System Module
// Handles saving, loading, and sharing build data

(function() {
    'use strict';
    
    const LOCALSTORAGE_KEY = 'sstoy_builds';
    const MAX_SAVED_BUILDS = 20; // Limit saved builds to prevent storage overflow
    const COOLDOWN_MS = 3000; // 3 second cooldown for save and share buttons
    
    // Cooldown tracking
    let saveCooldownEnd = 0;
    let shareCooldownEnd = 0;
    
    // Build state structure
    const buildState = {
        buildTitle: '새로운 빌드',
        buildMemo: ''
    };
    
    // ============================================================================
    // DATA COLLECTION
    // ============================================================================
    
    /**
     * Collect all current build data into a single object
     * @returns {Object} Complete build data
     */
    function collectBuildData() {
        const data = {
            v: '1.0', // version (shortened)
            t: Date.now(), // timestamp (shortened)
            n: buildState.buildTitle, // name (shortened)
            m: buildState.buildMemo, // memo (shortened)
            
            // Character data (shortened keys)
            c: {
                m: collectCharacterData('master'),
                a1: collectCharacterData('assist1'),
                a2: collectCharacterData('assist2')
            },
            
            // Disc data (shortened)
            d: collectDiscData(),
            
            // Notes data (shortened)
            nt: collectNotesData()
        };
        
        return data;
    }
    
    /**
     * Collect character data for a specific position
     * @param {string} position - Position (master, assist1, assist2)
     * @returns {Object|null} Character data or null if no character
     */
    function collectCharacterData(position) {
        const character = window.state?.party?.[position];
        if (!character) return null;
        
        return {
            i: character.id, // id (shortened)
            p: window.state.selectedPotentials[position] || [], // potentials (shortened)
            pl: window.state.potentialLevels[position] || {}, // potential levels (shortened)
            sl: window.state.skillLevels[position] || {}, // skill levels (shortened)
            pm: window.state.potentialMarks?.[position] || {} // potential marks (shortened)
        };
    }
    
    /**
     * Collect disc data
     * @returns {Object} Disc data including selections, limitbreaks, and growth
     */
    function collectDiscData() {
        const discsState = window.discsState;
        if (!discsState) return null;
        
        return {
            s: discsState.selectedDiscs || {}, // selected (shortened)
            l: discsState.discLimitBreaks || {}, // limitbreaks (shortened)
            g: discsState.subDiscLevels || {} // growth (shortened)
        };
    }
    
    /**
     * Collect notes data
     * @returns {Object} Notes data including required and acquired notes
     */
    function collectNotesData() {
        const discsState = window.discsState;
        if (!discsState) return null;
        
        // Convert Set to Array for serialization
        const requiredNotes = Array.from(discsState.requiredNotes || []);
        
        return {
            r: requiredNotes, // required (shortened)
            a: discsState.acquiredNotes || {} // acquired (shortened)
        };
    }
    
    // ============================================================================
    // DATA RESTORATION
    // ============================================================================
    
    /**
     * Restore build data to the application state
     * @param {Object} data - Build data to restore
     */
    async function restoreBuildData(data) {
        if (!data) {
            throw new Error('Invalid build data format');
        }
        
        // Use shortened keys (v2 format)
        const version = data.v;
        const buildTitle = data.n || '새로운 빌드';
        const buildMemo = data.m || '';
        const charactersData = data.c;
        const discsData = data.d;
        const notesData = data.nt;
        
        try {
            // Restore build title and memo
            buildState.buildTitle = buildTitle;
            buildState.buildMemo = buildMemo;
            updateBuildTitleDisplay();
            
            // Restore characters
            if (charactersData) {
                await restoreCharactersData(charactersData);
            }
            
            // Restore discs
            if (discsData) {
                restoreDiscsData(discsData);
            }
            
            // Restore notes
            if (notesData) {
                restoreNotesData(notesData);
            }
            
            // Update all displays
            refreshAllDisplays();
            
            showToast('빌드를 성공적으로 불러왔습니다!', 'success');
        } catch (error) {
            console.error('Error restoring build data:', error);
            throw error;
        }
    }
    
    /**
     * Restore character data for all positions
     * @param {Object} charactersData - Characters data
     */
    async function restoreCharactersData(charactersData) {
        // Position key mapping (shortened keys only)
        const positions = {
            'm': 'master',
            'a1': 'assist1',
            'a2': 'assist2'
        };
        
        for (const [shortKey, position] of Object.entries(positions)) {
            const charData = charactersData[shortKey];
            
            if (charData) {
                const charId = charData.i; // shortened key
                
                if (charId) {
                    // Set character
                    const character = window.state.characters[charId];
                    if (character) {
                        const nameKey = character.Name;
                        const name = window.state.characterNames[nameKey] || nameKey;
                        
                        window.state.party[position] = {
                            id: charId,
                            name: name,
                            data: character
                        };
                        
                        // Restore with shortened keys
                        window.state.selectedPotentials[position] = charData.p || [];
                        window.state.potentialLevels[position] = charData.pl || {};
                        window.state.skillLevels[position] = charData.sl || {};
                        
                        // Restore potential marks
                        if (!window.state.potentialMarks) {
                            window.state.potentialMarks = {};
                        }
                        window.state.potentialMarks[position] = charData.pm || {};
                    }
                }
            } else {
                // Clear position if no character data
                window.state.party[position] = null;
                window.state.selectedPotentials[position] = [];
                window.state.potentialLevels[position] = {};
                window.state.skillLevels[position] = {};
                if (!window.state.potentialMarks) {
                    window.state.potentialMarks = {};
                }
                window.state.potentialMarks[position] = {};
            }
        }
    }
    
    /**
     * Restore disc data
     * @param {Object} discsData - Discs data
     */
    function restoreDiscsData(discsData) {
        const discsState = window.discsState;
        if (!discsState) return;
        
        // Restore with shortened keys
        const selectedDiscs = discsData.s;
        if (selectedDiscs) {
            discsState.selectedDiscs = { ...selectedDiscs };
        }
        
        const limitBreaks = discsData.l;
        if (limitBreaks) {
            discsState.discLimitBreaks = { ...limitBreaks };
        }
        
        const subLevels = discsData.g;
        if (subLevels) {
            discsState.subDiscLevels = { ...subLevels };
        }
    }
    
    /**
     * Restore notes data
     * @param {Object} notesData - Notes data
     */
    function restoreNotesData(notesData) {
        const discsState = window.discsState;
        if (!discsState) return;
        
        // Restore with shortened keys
        const requiredNotes = notesData.r;
        if (requiredNotes) {
            discsState.requiredNotes = new Set(requiredNotes);
        }
        
        const acquiredNotes = notesData.a;
        if (acquiredNotes) {
            discsState.acquiredNotes = { ...acquiredNotes };
        }
    }
    
    /**
     * Refresh all UI displays after data restoration
     */
    function refreshAllDisplays() {
        // Refresh character tab
        const positions = ['master', 'assist1', 'assist2'];
        positions.forEach(position => {
            if (typeof window.updateCharacterCard === 'function') {
                window.updateCharacterCard(position);
            }
            if (typeof window.updatePotentialsDisplay === 'function') {
                window.updatePotentialsDisplay(position);
            }
        });
        
        // Refresh disc tab
        if (typeof window.renderDiscs === 'function') {
            window.renderDiscs();
        }
        
        // Switch to summary tab and refresh it
        if (typeof window.switchMainTab === 'function') {
            window.switchMainTab('summary');
        }
        
        // Refresh summary tab
        if (typeof window.renderSummary === 'function') {
            // Use setTimeout to ensure tab switch completes first
            setTimeout(() => {
                window.renderSummary();
            }, 100);
        }
    }
    
    // ============================================================================
    // LOCAL STORAGE OPERATIONS
    // ============================================================================
    
    /**
     * Save current build to local storage (without compression for reliability)
     */
    function saveToLocalStorage() {
        // Check cooldown
        const now = Date.now();
        if (now < saveCooldownEnd) {
            const remaining = Math.ceil((saveCooldownEnd - now) / 1000);
            showToast(`${remaining}초 후에 다시 시도해주세요.`, 'info');
            return;
        }
        
        try {
            const buildData = collectBuildData();
            
            // Get existing builds
            let builds = getLocalStorageBuilds();
            
            // Add new build at the beginning
            builds.unshift(buildData);
            
            // Limit to MAX_SAVED_BUILDS
            if (builds.length > MAX_SAVED_BUILDS) {
                builds = builds.slice(0, MAX_SAVED_BUILDS);
            }
            
            // Save the entire builds array as plain JSON to localStorage
            const json = JSON.stringify(builds);
            localStorage.setItem(LOCALSTORAGE_KEY, json);
            
            // Use shortened key for display
            const displayTitle = buildData.n || '새로운 빌드';
            showToast(`빌드 "${displayTitle}"을(를) 저장했습니다!`, 'success');
            
            // Set cooldown
            saveCooldownEnd = now + COOLDOWN_MS;
            updateButtonCooldown('save-btn', saveCooldownEnd);
            
            // Refresh load list if modal is open
            if (document.getElementById('load-modal').classList.contains('active')) {
                renderLoadList();
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            showToast('빌드 저장에 실패했습니다.', 'error');
        }
    }
    
    /**
     * Get all saved builds from local storage
     * @returns {Array} Array of saved builds
     */
    function getLocalStorageBuilds() {
        try {
            const json = localStorage.getItem(LOCALSTORAGE_KEY);
            if (!json) return [];
            
            return JSON.parse(json);
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    }
    
    /**
     * Load a build from local storage by index
     * @param {number} index - Build index
     */
    function loadFromLocalStorage(index) {
        try {
            const builds = getLocalStorageBuilds();
            if (index >= 0 && index < builds.length) {
                const buildData = builds[index];
                restoreBuildData(buildData);
                closeLoadModal();
            } else {
                throw new Error('Invalid build index');
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            showToast('빌드 불러오기에 실패했습니다.', 'error');
        }
    }
    
    /**
     * Delete a build from local storage by index
     * @param {number} index - Build index
     */
    function deleteFromLocalStorage(index) {
        try {
            let builds = getLocalStorageBuilds();
            if (index >= 0 && index < builds.length) {
                // Use shortened key (v2 format)
                const deletedTitle = builds[index].n || '제목 없음';
                builds.splice(index, 1);
                
                // Save as plain JSON
                const json = JSON.stringify(builds);
                localStorage.setItem(LOCALSTORAGE_KEY, json);
                
                showToast(`빌드 "${deletedTitle}"을(를) 삭제했습니다.`, 'success');
                renderLoadList();
            }
        } catch (error) {
            console.error('Error deleting from localStorage:', error);
            showToast('빌드 삭제에 실패했습니다.', 'error');
        }
    }
    
    // ============================================================================
    // URL SHARING OPERATIONS
    // ============================================================================
    
    /**
     * Base64 encoding for URLs with URL-safe characters
     * Uses browser's built-in btoa with proper Unicode handling
     */
    function compressToBase64(input) {
        if (!input) return '';

        try {
            // Convert string to UTF-8 bytes, then to base64
            const utf8Bytes = new TextEncoder().encode(input);
            let binary = '';
            utf8Bytes.forEach(byte => {
                binary += String.fromCharCode(byte);
            });

            // Use browser's btoa for base64 encoding
            let base64 = btoa(binary);

            // Convert to URL-safe base64
            // Replace + with - and / with _, remove padding =
            base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            return base64;
        } catch (error) {
            console.error('Compression error:', error);
            return '';
        }
    }

    /**
     * Decompress from URL-safe base64
     * Uses browser's built-in atob with proper Unicode handling
     */
    function decompressFromBase64(input) {
        if (!input) return '';

        try {
            // Convert URL-safe base64 back to standard base64
            let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            // Use browser's atob for base64 decoding
            const binary = atob(base64);

            // Convert binary string to UTF-8 bytes
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            // Decode UTF-8 bytes to string
            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.error('Decompression error:', error);
            return '';
        }
    }
    
    /**
     * Encode build data to URL parameter
     * @returns {string} Encoded URL parameter
     */
    function encodeBuildToURL() {
        try {
            const buildData = collectBuildData();
            
            // Remove memo and timestamp (not needed in URL)
            delete buildData.m; // memo (shortened key)
            delete buildData.buildMemo; // old format
            delete buildData.t; // timestamp (shortened key)
            delete buildData.timestamp; // old format
            
            // Remove empty/null values to reduce size
            function cleanObject(obj) {
                if (obj === null || obj === undefined) return null;
                
                if (Array.isArray(obj)) {
                    const cleaned = obj.filter(v => v !== null && v !== undefined);
                    return cleaned.length > 0 ? cleaned : null;
                } else if (typeof obj === 'object') {
                    const cleaned = {};
                    for (const [key, value] of Object.entries(obj)) {
                        const cleanedValue = cleanObject(value);
                        if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '' && 
                            !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
                            !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)) {
                            cleaned[key] = cleanedValue;
                        }
                    }
                    return Object.keys(cleaned).length > 0 ? cleaned : null;
                }
                return obj;
            }
            
            const cleanedData = cleanObject(buildData) || {};
            
            // Convert to JSON with minimal spacing
            const json = JSON.stringify(cleanedData);
            
            // Use our compression
            const compressed = compressToBase64(json);
            
            return compressed;
        } catch (error) {
            console.error('Error encoding build to URL:', error);
            throw error;
        }
    }
    
    /**
     * Decode build data from URL parameter
     * @param {string} encoded - Encoded URL parameter
     * @returns {Object} Build data
     */
    function decodeBuildFromURL(encoded) {
        try {
            // Decompress
            const json = decompressFromBase64(encoded);
            const buildData = JSON.parse(json);
            
            return buildData;
        } catch (error) {
            console.error('Error decoding build from URL:', error);
            throw error;
        }
    }
    
    /**
     * Generate shareable URL for current build
     * Uses hash fragment (#) instead of query parameter to avoid server-side limits
     */
    function generateShareURL() {
        // Check cooldown
        const now = Date.now();
        if (now < shareCooldownEnd) {
            const remaining = Math.ceil((shareCooldownEnd - now) / 1000);
            showToast(`${remaining}초 후에 다시 시도해주세요.`, 'info');
            return;
        }
        
        try {
            const encoded = encodeBuildToURL();
            // Use hash fragment (#) instead of query parameter (?)
            // Hash fragments are not sent to server and browsers are more lenient with length
            const url = `${window.location.origin}${window.location.pathname}#build=${encoded}`;
            
            // Check URL length (browsers typically support longer URLs with hash fragments)
            if (url.length > 4000) {
                showToast(`⚠️ URL이 너무 깁니다 (${url.length}자). 일부 브라우저에서 작동하지 않을 수 있습니다. 로컬 저장을 권장합니다.`, 'warning');
            }
            
            // Copy to clipboard
            navigator.clipboard.writeText(url).then(() => {
                if (url.length <= 4000) {
                    showToast('공유 링크가 클립보드에 복사되었습니다!', 'success');
                }
                
                // Set cooldown
                shareCooldownEnd = now + COOLDOWN_MS;
                updateButtonCooldown('share-btn', shareCooldownEnd);
            }).catch(() => {
                // Fallback: show URL in a text area
                showShareURLModal(url);
            });
        } catch (error) {
            console.error('Error generating share URL:', error);
            showToast('공유 링크 생성에 실패했습니다.', 'error');
        }
    }
    
    /**
     * Load build from URL parameter
     */
    function loadFromURL() {
        try {
            // Use hash fragment only
            let buildParam = null;
            
            if (window.location.hash && window.location.hash.includes('build=')) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                buildParam = hashParams.get('build');
            }
            
            if (buildParam) {
                const buildData = decodeBuildFromURL(buildParam);
                restoreBuildData(buildData);
                
                // Clear URL hash after loading
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Error loading from URL:', error);
            showToast('URL에서 빌드를 불러오는데 실패했습니다. 링크가 손상되었을 수 있습니다.', 'error');
            // Clear bad URL hash
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    // ============================================================================
    // UI FUNCTIONS
    // ============================================================================
    
    /**
     * Update build title input display
     */
    function updateBuildTitleDisplay() {
        const titleInput = document.getElementById('build-title-input');
        if (titleInput) {
            titleInput.value = buildState.buildTitle;
        }
    }
    
    /**
     * Update build memo textarea display
     */
    function updateBuildMemoDisplay() {
        const memoTextarea = document.getElementById('build-notes');
        if (memoTextarea) {
            memoTextarea.value = buildState.buildMemo;
        }
    }
    
    /**
     * Handle build title change
     */
    function handleBuildTitleChange(event) {
        buildState.buildTitle = event.target.value || '새로운 빌드';
    }
    
    /**
     * Handle build memo change
     */
    function handleBuildMemoChange(event) {
        buildState.buildMemo = event.target.value || '';
    }
    
    /**
     * Open load modal
     */
    function openLoadModal() {
        const modal = document.getElementById('load-modal');
        modal.classList.add('active');
        renderLoadList();
    }
    
    /**
     * Close load modal
     */
    function closeLoadModal() {
        document.getElementById('load-modal').classList.remove('active');
    }
    
    /**
     * Render list of saved builds in load modal
     */
    function renderLoadList() {
        const listContainer = document.getElementById('load-list');
        const builds = getLocalStorageBuilds();
        
        if (builds.length === 0) {
            listContainer.innerHTML = '<p class="empty-state-text">저장된 빌드가 없습니다.</p>';
            return;
        }
        
        listContainer.innerHTML = builds.map((build, index) => {
            // Use shortened keys (v2 format)
            const timestamp = build.t || Date.now();
            const buildTitle = build.n || '제목 없음';
            const buildMemo = build.m || '';
            
            const date = new Date(timestamp);
            const dateStr = date.toLocaleString('ko-KR');
            
            return `
                <div class="load-item">
                    <div class="load-item-info">
                        <div class="load-item-title">${buildTitle}</div>
                        <div class="load-item-meta">
                            <span>저장 시간: ${dateStr}</span>
                            ${buildMemo ? `<span class="has-memo">📝 메모 있음</span>` : ''}
                        </div>
                    </div>
                    <div class="load-item-actions">
                        <button class="load-btn" 
                                data-action="saveload-load-build"
                                data-index="${index}">불러오기</button>
                        <button class="delete-btn"
                                data-action="saveload-delete-build"
                                data-index="${index}">삭제</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Show share URL modal (fallback if clipboard API fails)
     */
    function showShareURLModal(url) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>공유 링크</h2>
                    <button class="close-button" data-action="saveload-close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <p>아래 링크를 복사하여 공유하세요:</p>
                    <textarea class="share-url-textarea" readonly>${url}</textarea>
                    <button class="copy-url-btn" 
                            data-action="saveload-copy-url"
                            data-url="${url}">복사</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Update button with cooldown timer
     */
    function updateButtonCooldown(buttonId, cooldownEnd) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        
        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.ceil((cooldownEnd - now) / 1000);
            
            if (remaining <= 0) {
                button.disabled = false;
                button.style.opacity = '';
                button.style.cursor = '';
                button.innerHTML = originalHTML;
            } else {
                const icon = buttonId === 'save-btn' ? '💾' : '🔗';
                const text = buttonId === 'save-btn' ? '저장' : 'URL 공유';
                button.innerHTML = `
                    <span class="btn-icon">${icon}</span>
                    <span class="btn-text">${text} (${remaining}초)</span>
                `;
                setTimeout(updateTimer, 100);
            }
        };
        
        updateTimer();
    }
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    /**
     * Initialize save/load system
     */
    function initSaveLoadSystem() {
        // Check for URL hash on page load
        const hasBuildParam = window.location.hash && window.location.hash.includes('build=');
        
        if (hasBuildParam) {
            // Wait for all game data to be loaded before restoring
            const checkDataLoaded = setInterval(() => {
                // Check if essential data structures exist
                if (window.state && 
                    window.state.characters && 
                    Object.keys(window.state.characters).length > 0 &&
                    window.discsState &&
                    window.discsState.allDiscs) {
                    
                    clearInterval(checkDataLoaded);
                    
                    // Small delay to ensure all modules are initialized
                    setTimeout(() => {
                        loadFromURL();
                    }, 500);
                }
            }, 100); // Check every 100ms
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkDataLoaded);
            }, 10000);
        }
        
        // Initialize build title display
        updateBuildTitleDisplay();
    }
    
    // ============================================================================
    // EVENT DELEGATION
    // ============================================================================
    
    /**
     * Setup event delegation for saveload module
     */
    function setupSaveLoadEventDelegation() {
        // Delegate clicks on document for modals and buttons
        document.addEventListener('click', function(e) {
            const target = e.target;
            const button = target.closest('[data-action]');
            
            if (!button) return;
            
            const action = button.dataset.action;
            if (action && action.startsWith('saveload-')) {
                handleSaveLoadAction(button, action);
            }
        });
    }
    
    /**
     * Handle delegated saveload actions
     */
    function handleSaveLoadAction(element, action) {
        switch(action) {
            case 'saveload-save':
                saveToLocalStorage();
                break;
                
            case 'saveload-load':
                openLoadModal();
                break;
                
            case 'saveload-share':
                generateShareURL();
                break;
                
            case 'saveload-load-build':
                {
                    const index = parseInt(element.dataset.index);
                    loadFromLocalStorage(index);
                }
                break;
                
            case 'saveload-delete-build':
                {
                    const index = parseInt(element.dataset.index);
                    deleteFromLocalStorage(index);
                }
                break;
                
            case 'saveload-close-modal':
                element.closest('.modal').remove();
                break;
                
            case 'saveload-copy-url':
                {
                    const url = element.dataset.url;
                    navigator.clipboard.writeText(url).then(() => {
                        showToast('URL이 클립보드에 복사되었습니다!', 'success');
                    });
                }
                break;
                
            default:
                break;
        }
    }
    
    // Setup event delegation
    setupSaveLoadEventDelegation();
    
    // Export functions to window
    window.saveToLocalStorage = saveToLocalStorage;
    window.loadBuildFromStorage = loadFromLocalStorage;
    window.deleteBuildFromStorage = deleteFromLocalStorage;
    window.generateShareURL = generateShareURL;
    window.openLoadModal = openLoadModal;
    window.closeLoadModal = closeLoadModal;
    window.handleBuildTitleChange = handleBuildTitleChange;
    window.handleBuildMemoChange = handleBuildMemoChange;
    window.buildState = buildState;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSaveLoadSystem);
    } else {
        initSaveLoadSystem();
    }
})();
