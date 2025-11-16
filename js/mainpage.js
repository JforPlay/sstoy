let patchNotesLoaded = false;

async function loadPatchNotes() {
    if (patchNotesLoaded) return;

    try {
        const response = await fetch('patchnotes.json');
        const patchNotes = await response.json();

        const modalBody = document.querySelector('.patch-modal-body');
        modalBody.innerHTML = patchNotes.map(entry => `
            <div class="patch-entry">
                <div class="patch-version">${entry.version}</div>
                <div class="patch-date">${entry.date}</div>
                <div class="patch-changes">
                    ${entry.changes.map(change => `
                        <h4>${change.category}</h4>
                        <ul>
                            ${change.items.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    `).join('')}
                </div>
            </div>
        `).join('');

        patchNotesLoaded = true;
    } catch (error) {
        console.error('Failed to load patch notes:', error);
        document.querySelector('.patch-modal-body').innerHTML =
            '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">패치 노트를 불러오는데 실패했습니다.</p>';
    }
}

async function openPatchNotesModal() {
    await loadPatchNotes();
    document.getElementById('patch-notes-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePatchNotesModal() {
    document.getElementById('patch-notes-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('patch-notes-modal');
    if (event.target === modal) {
        closePatchNotesModal();
    }
}

// Close modal with ESC key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closePatchNotesModal();
    }
});
