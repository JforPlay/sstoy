// Discs Tab Module
// Handles disc selection and management

(function() {
    'use strict';
    
    // Render discs tab content
    function renderDiscs() {
        const container = document.getElementById('discs-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="discs-layout">
                <div class="discs-info-banner">
                    <div class="banner-icon">💿</div>
                    <div class="banner-content">
                        <h3>음반 시스템</h3>
                        <p>캐릭터의 능력을 강화할 음반을 선택하세요 (개발 중)</p>
                    </div>
                </div>

                <!-- Disc Slots Grid -->
                <div class="disc-slots-grid">
                    ${generateDiscSlots()}
                </div>

                <!-- Disc Set Bonuses -->
                <div class="disc-set-bonuses">
                    <h3>세트 효과</h3>
                    <div class="disc-set-list">
                        <div class="disc-set-item">
                            <span class="disc-set-name">세트 효과 없음</span>
                            <span class="disc-set-count">0/2 or 0/4</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Generate disc slot cards
    function generateDiscSlots() {
        let html = '';
        for (let i = 1; i <= 6; i++) {
            html += `
                <div class="disc-slot-card" onclick="selectDisc(${i})">
                    <div class="disc-slot-header">
                        <span class="disc-slot-number">${i}</span>
                        <span class="disc-slot-name">디스크 슬롯 ${i}</span>
                    </div>
                    <div class="disc-slot-preview">
                        <div class="disc-placeholder">
                            <span class="disc-placeholder-icon">💿</span>
                            <p>디스크 선택</p>
                        </div>
                    </div>
                    <div class="disc-slot-stats">
                        <div class="disc-stat-item">
                            <span class="disc-stat-label">주 옵션:</span>
                            <span class="disc-stat-value">-</span>
                        </div>
                        <div class="disc-stat-item">
                            <span class="disc-stat-label">부 옵션:</span>
                            <span class="disc-stat-value">-</span>
                        </div>
                    </div>
                </div>
            `;
        }
        return html;
    }
    
    // Select disc (placeholder)
    function selectDisc(slot) {
        if (typeof showInfo === 'function') {
            showInfo(`디스크 슬롯 ${slot} - 개발 예정`);
        } else {
            alert(`디스크 슬롯 ${slot} - 개발 예정`);
        }
    }
    
    // Make functions globally available
    window.renderDiscs = renderDiscs;
    window.selectDisc = selectDisc;
    
    // Auto-render on page load if discs tab exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('discs-container')) {
                renderDiscs();
            }
        });
    } else {
        if (document.getElementById('discs-container')) {
            renderDiscs();
        }
    }
})();
