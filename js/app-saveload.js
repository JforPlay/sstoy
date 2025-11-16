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

    /**
     * Migrate old potential mark values to new ones
     * @param {string} position - Character position (master/assist1/assist2)
     */
    function migratePotentialMarks(position) {
        if (!window.state.potentialMarks || !window.state.potentialMarks[position]) {
            return;
        }

        const marks = window.state.potentialMarks[position];
        for (const potId in marks) {
            const mark = marks[potId];
            // Migrate old values to new ones
            if (mark === '권장') {
                marks[potId] = '다다익선';
            } else if (mark === 'Lv.1') {
                marks[potId] = '명함만';
            }
        }
    }

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

        // Filter out default level-1 skills (keep only non-default levels)
        const skillLevels = {};
        const rawSkillLevels = window.state.skillLevels[position] || {};
        Object.keys(rawSkillLevels).forEach(skillId => {
            const level = rawSkillLevels[skillId];
            if (level && level !== 1) {
                skillLevels[skillId] = level;
            }
        });

        // Filter out default level-1 potentials (keep only non-default levels)
        // Note: We keep the potential ID in 'p' array, just don't save level if it's 1
        const potentialLevels = {};
        const rawPotentialLevels = window.state.potentialLevels[position] || {};
        Object.keys(rawPotentialLevels).forEach(potId => {
            const level = rawPotentialLevels[potId];
            if (level && level !== 1) {
                potentialLevels[potId] = level;
            }
        });

        // Filter out empty potential marks
        const potentialMarks = {};
        const rawPotentialMarks = window.state.potentialMarks?.[position] || {};
        Object.keys(rawPotentialMarks).forEach(potId => {
            const mark = rawPotentialMarks[potId];
            if (mark && mark !== '') {
                potentialMarks[potId] = mark;
            }
        });

        return {
            i: character.id, // id (shortened)
            p: window.state.selectedPotentials[position] || [], // potentials (shortened)
            pl: potentialLevels, // potential levels (only non-1)
            sl: skillLevels, // skill levels (only non-1)
            pm: potentialMarks // potential marks (only non-empty)
        };
    }
    
    /**
     * Collect disc data
     * @returns {Object} Disc data including selections, limitbreaks, and growth
     */
    function collectDiscData() {
        const discsState = window.discsState;
        if (!discsState) return null;

        // Extract only disc IDs (not full disc objects!)
        // This is a MAJOR size optimization - we were saving entire objects with 10+ properties
        const selectedDiscIds = {};
        const rawSelectedDiscs = discsState.selectedDiscs || {};
        Object.keys(rawSelectedDiscs).forEach(slotId => {
            const disc = rawSelectedDiscs[slotId];
            if (disc && disc.Id) {
                selectedDiscIds[slotId] = disc.Id; // Save ONLY the ID, not the whole object
            }
        });

        // Filter out default limit breaks (level 1)
        const limitBreaks = {};
        const rawLimitBreaks = discsState.discLimitBreaks || {};
        Object.keys(rawLimitBreaks).forEach(slotId => {
            const level = rawLimitBreaks[slotId];
            if (level && level !== 1) {
                limitBreaks[slotId] = level;
            }
        });

        // Filter out default sub disc levels (level 0)
        const subDiscLevels = {};
        const rawSubLevels = discsState.subDiscLevels || {};
        Object.keys(rawSubLevels).forEach(slotId => {
            const level = rawSubLevels[slotId];
            if (level && level !== 0) {
                subDiscLevels[slotId] = level;
            }
        });

        return {
            s: selectedDiscIds, // selected disc IDs ONLY (not full objects!)
            l: limitBreaks, // limitbreaks (only non-1)
            g: subDiscLevels // growth (only non-0)
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

        // Filter out zero-count acquired notes
        const acquiredNotes = {};
        const rawAcquiredNotes = discsState.acquiredNotes || {};
        Object.keys(rawAcquiredNotes).forEach(noteId => {
            const count = rawAcquiredNotes[noteId];
            if (count && count > 0) {
                acquiredNotes[noteId] = count;
            }
        });

        return {
            r: requiredNotes, // required (shortened)
            a: acquiredNotes // acquired (only non-zero)
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

            // Log what data is being restored
            const hasSkills = charactersData && (charactersData.m?.sl || charactersData.a1?.sl || charactersData.a2?.sl);
            const hasNotes = !!notesData;
            console.log(`[Restore] Build "${buildTitle}" - Skills: ${hasSkills ? 'Included' : 'Defaults to Lv.1'}, Notes: ${hasNotes ? 'Included' : 'Recalculated'}`);

            // Restore characters
            if (charactersData) {
                await restoreCharactersData(charactersData);
            }

            // Restore discs (always call to clear old state even if no discs)
            restoreDiscsData(discsData);

            // Restore notes (or clear if not included)
            restoreNotesData(notesData);

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

                        // Restore selected potentials
                        const selectedPotentials = charData.p || [];
                        window.state.selectedPotentials[position] = selectedPotentials;

                        // Restore potential levels (fill missing with level 1)
                        const savedPotentialLevels = charData.pl || {};
                        const potentialLevels = {};
                        selectedPotentials.forEach(potId => {
                            // If level was saved, use it; otherwise default to 1
                            potentialLevels[potId] = savedPotentialLevels[potId] || 1;
                        });
                        window.state.potentialLevels[position] = potentialLevels;

                        // Restore skill levels (fill missing with level 1)
                        // Note: URL shares don't include skill levels (to save space)
                        // so they default to 1 and can be adjusted manually
                        const savedSkillLevels = charData.sl || {};
                        const skillLevels = {};

                        // Get all skill IDs for this character
                        const isMaster = position === 'master';
                        const skillKeys = isMaster
                            ? ['NormalAtkId', 'SkillId', 'UltimateId', 'DodgeId', 'SpecialSkillId']
                            : ['AssistSkillId'];

                        skillKeys.forEach(key => {
                            const skillId = character[key];
                            if (skillId) {
                                // If level was saved, use it; otherwise default to 1
                                skillLevels[skillId] = savedSkillLevels[skillId] || 1;
                            }
                        });
                        window.state.skillLevels[position] = skillLevels;

                        // Restore potential marks
                        if (!window.state.potentialMarks) {
                            window.state.potentialMarks = {};
                        }
                        window.state.potentialMarks[position] = charData.pm || {};

                        // Migrate old mark values to new ones
                        migratePotentialMarks(position);
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
     * @param {Object} discsData - Discs data (can be null/undefined to clear all discs)
     */
    function restoreDiscsData(discsData) {
        const discsState = window.discsState;
        if (!discsState) return;

        // Initialize with all expected slots set to null (important for proper overwrites)
        const selectedDiscs = {
            main1: null,
            main2: null,
            main3: null,
            sub1: null,
            sub2: null,
            sub3: null
        };

        // Restore selected discs by looking up full disc objects from IDs
        // If discsData is null/undefined, savedData will be empty and all slots remain null
        const savedData = discsData?.s || {};

        Object.keys(savedData).forEach(slotId => {
            const data = savedData[slotId];

            if (!data) return;

            // Handle both old format (full object) and new format (ID only)
            let discId;
            if (typeof data === 'number') {
                // New format: just the ID
                discId = data;
            } else if (typeof data === 'object' && data.Id) {
                // Old format: full disc object (backward compatibility)
                console.log(`[Restore] Converting old format disc object to ID for ${slotId}`);
                discId = data.Id;
            } else {
                console.warn(`[Restore] Invalid disc data for ${slotId}:`, data);
                return;
            }

            // Look up the full disc object from allDiscs array using the ID
            // allDiscs is an array, not an object, so we need to use .find()
            const fullDiscObject = discsState.allDiscs?.find(d => d.Id === discId);
            if (fullDiscObject) {
                selectedDiscs[slotId] = fullDiscObject;
            } else {
                console.warn(`[Restore] Disc ID ${discId} not found in allDiscs array (total discs: ${discsState.allDiscs?.length || 0})`);
            }
        });

        discsState.selectedDiscs = selectedDiscs;

        // Initialize limit breaks with all slots (important for proper overwrites)
        const limitBreaks = {
            main1: 1,
            main2: 1,
            main3: 1
        };

        // Restore limit breaks from saved data
        // If discsData is null/undefined, savedLimitBreaks will be empty and defaults are used
        const savedLimitBreaks = discsData?.l || {};
        Object.keys(selectedDiscs).forEach(slotId => {
            // Main discs: use saved value or default to 1
            if (slotId.startsWith('main')) {
                limitBreaks[slotId] = savedLimitBreaks[slotId] || 1;
            }
        });
        discsState.discLimitBreaks = limitBreaks;

        // Initialize sub disc levels with all slots (important for proper overwrites)
        const subLevels = {
            sub1: 0,
            sub2: 0,
            sub3: 0
        };

        // Restore sub disc levels from saved data
        // If discsData is null/undefined, savedSubLevels will be empty and defaults are used
        const savedSubLevels = discsData?.g || {};
        Object.keys(selectedDiscs).forEach(slotId => {
            // Sub discs: use saved value or default to 0
            if (slotId.startsWith('sub')) {
                subLevels[slotId] = savedSubLevels[slotId] || 0;
            }
        });
        discsState.subDiscLevels = subLevels;
    }
    
    /**
     * Restore notes data
     * Notes may be missing from URL shares (to save space)
     * @param {Object} notesData - Notes data (may be undefined for URL shares)
     */
    function restoreNotesData(notesData) {
        const discsState = window.discsState;
        if (!discsState) return;

        if (!notesData) {
            // Notes not included in URL (to save space)
            // Clear any existing notes - they will be recalculated from discs
            discsState.requiredNotes = new Set();
            discsState.acquiredNotes = {};
            return;
        }

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

        // Recalculate required notes from selected main discs
        // This must be done before rendering discs/summary
        if (typeof window.updateRequiredNotes === 'function') {
            window.updateRequiredNotes();
            console.log('[Restore] Recalculated required notes from main discs');
        }

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
     * Save current build to local storage (with LZ-String compression)
     * Local storage keeps ALL data: skills, notes, timestamps, memos
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

            // Compress and save the entire builds array to localStorage
            const json = JSON.stringify(builds);
            const compressed = LZString.compress(json);
            localStorage.setItem(LOCALSTORAGE_KEY, compressed);

            // Log compression stats
            const compressionRatio = ((1 - compressed.length / json.length) * 100).toFixed(1);
            console.log(`[LocalStorage] Saved ${builds.length} builds: ${json.length} → ${compressed.length} chars (${compressionRatio}% reduction)`);

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
     * Handles both compressed (new) and uncompressed (old) formats
     * @returns {Array} Array of saved builds
     */
    function getLocalStorageBuilds() {
        try {
            const data = localStorage.getItem(LOCALSTORAGE_KEY);
            if (!data) return [];

            // Try to decompress first (new format)
            try {
                const decompressed = LZString.decompress(data);
                if (decompressed) {
                    return JSON.parse(decompressed);
                }
            } catch (e) {
                // Not compressed, try as plain JSON
            }

            // Fallback to plain JSON (old format - backward compatibility)
            return JSON.parse(data);
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

                // Save compressed
                const json = JSON.stringify(builds);
                const compressed = LZString.compress(json);
                localStorage.setItem(LOCALSTORAGE_KEY, compressed);

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
     * Compress string using LZ-String with URL-safe encoding
     * This provides much better compression than base64 (60-80% size reduction)
     * @param {string} input - String to compress
     * @returns {string} Compressed and URL-safe string
     */
    function compressToBase64(input) {
        if (!input) return '';
        return LZString.compressToEncodedURIComponent(input);
    }

    /**
     * Decompress URL-safe LZ-String compressed data
     * @param {string} input - Compressed string
     * @returns {string} Decompressed original string
     */
    function decompressFromBase64(input) {
        if (!input) return '';
        return LZString.decompressFromEncodedURIComponent(input) || '';
    }
    
    /**
     * Encode build data to URL parameter
     * For URL sharing, we only keep: character IDs, potentials, discs, and build metadata
     * Skills and notes are excluded to reduce URL size (can be set manually after loading)
     * @returns {string} Encoded URL parameter
     */
    function encodeBuildToURL() {
        try {
            const buildData = collectBuildData();

            // Remove metadata not needed in URL (only for local storage)
            // Keep build title (n) for sharing
            delete buildData.m; // memo (shortened key)
            delete buildData.buildMemo; // old format
            delete buildData.t; // timestamp (shortened key)
            delete buildData.timestamp; // old format

            // Remove skill levels (not needed in URL - defaults to 1 on load)
            if (buildData.c) {
                if (buildData.c.m) delete buildData.c.m.sl;
                if (buildData.c.a1) delete buildData.c.a1.sl;
                if (buildData.c.a2) delete buildData.c.a2.sl;
            }

            // Remove notes data (can be recalculated from discs)
            delete buildData.nt;

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

            // Log compression stats with detailed breakdown
            const compressionRatio = ((1 - compressed.length / json.length) * 100).toFixed(1);
            console.log(`[Compression] Original JSON: ${json.length} chars → Compressed: ${compressed.length} chars (${compressionRatio}% reduction)`);
            console.log(`[Data saved] Characters: ${cleanedData.c ? 'Yes' : 'No'}, Discs: ${cleanedData.d ? Object.keys(cleanedData.d.s || {}).length : 0}, Potentials: ${cleanedData.c?.m?.p?.length || 0}+${cleanedData.c?.a1?.p?.length || 0}+${cleanedData.c?.a2?.p?.length || 0}`);

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
            // With LZ-String compression + excluding skills/notes, URLs should be very short
            console.log(`[Share] URL length: ${url.length} characters (includes: characters, potentials, discs)`);
            console.log(`[Share] Excluded to save space: skill levels (default to Lv.1), notes (recalculated)`);

            if (url.length > 4000) {
                showToast(`⚠️ URL이 너무 깁니다 (${url.length}자). 일부 브라우저에서 작동하지 않을 수 있습니다. 로컬 저장을 권장합니다.`, 'warning');
            }

            // Copy to clipboard
            navigator.clipboard.writeText(url).then(() => {
                if (url.length <= 4000) {
                    showToast('공유 링크가 클립보드에 복사되었습니다! (스킬은 Lv.1로 설정됩니다)', 'success');
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
                            ${buildMemo ? `<span class="has-memo">${getIcon('memo')} 메모 있음</span>` : ''}
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
    // PRESET BUILDS
    // ============================================================================

    /**
     * Load preset builds from JSON file
     * @returns {Promise<Object>} Preset builds data
     */
    async function loadPresetBuilds() {
        try {
            const response = await fetch('PresetBuilds.json');
            const presetData = await response.json();
            return presetData;
        } catch (error) {
            console.error('Error loading preset builds:', error);
            return { presets: [], categories: {} };
        }
    }

    /**
     * Load a preset build by hash
     * @param {string} buildHash - The compressed build hash from URL
     * @param {string} presetTitle - Title of the preset (for display)
     */
    function loadPresetBuild(buildHash, presetTitle) {
        try {
            if (!buildHash) {
                showToast('프리셋 빌드 데이터가 없습니다.', 'error');
                return;
            }

            // Decode the build from hash (same as URL loading)
            const buildData = decodeBuildFromURL(buildHash);
            restoreBuildData(buildData);

            showToast(`프리셋 "${presetTitle}"을(를) 불러왔습니다!`, 'success');
        } catch (error) {
            console.error('Error loading preset build:', error);
            showToast('프리셋 불러오기에 실패했습니다.', 'error');
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
    window.loadPresetBuilds = loadPresetBuilds;
    window.loadPresetBuild = loadPresetBuild;
    window.buildState = buildState;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSaveLoadSystem);
    } else {
        initSaveLoadSystem();
    }
})();
