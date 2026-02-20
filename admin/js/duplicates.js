window.fetchDuplicates = async function () {
    const sb = window.supabaseClient;
    const container = document.getElementById('duplicate-list');
    if (!container) return; // Tab not loaded

    const { data: flags, error } = await sb
        .from('duplicate_flags')
        .select(`
            *,
            source_intent:source_intent_id (name),
            source_question:source_question_id (question_text),
            matched_intent:matched_intent_id (name),
            matched_question:matched_question_id (question_text)
        `)
        .eq('resolution', 'unresolved');

    if (error) {
        console.error(error);
        container.innerHTML = `<p style="color:var(--danger)">Error loading duplicates.</p>`;
        return;
    }

    if (!flags || flags.length === 0) {
        container.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No duplicates detected. Great job! 🎉</p>`;
        return;
    }

    container.innerHTML = '';
    flags.forEach(flag => {
        const item = document.createElement('div');
        item.className = 'card';
        item.style.marginBottom = '0'; // Grid handles gap
        item.style.padding = '1rem';

        const similarityPercent = (flag.similarity * 100).toFixed(1) + '%';
        const isHigh = flag.similarity > 0.9;
        const badgeClass = isHigh ? 'badge-danger' : 'badge-warning';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                <span class="badge ${badgeClass}">${similarityPercent} Match</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Draft Question</strong>
                    <div style="font-weight: 500; font-size: 0.95rem;">"${flag.source_question?.question_text}"</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Intent: ${flag.source_intent?.name}</div>
                </div>
                <div style="border-left: 1px solid var(--border); padding-left: 1rem;">
                    <strong style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Existing Match</strong>
                    <div style="font-weight: 500; font-size: 0.95rem;">"${flag.matched_question?.question_text}"</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Intent: ${flag.matched_intent?.name}</div>
                </div>
            </div>

            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="resolveFlag('${flag.id}', 'ignored')">Ignore</button>
                <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="resolveFlag('${flag.id}', 'deleted')">Delete Draft Question</button>
            </div>
        `;
        container.appendChild(item);
    });
};

window.resolveFlag = async (id, resolution) => {
    const sb = window.supabaseClient;

    // 1. Update flag resolution
    const { error } = await sb.from('duplicate_flags').update({ resolution }).eq('id', id);
    if (error) return alert('Error updating flag');

    // 2. If 'deleted', HARD DELETE the source question
    if (resolution === 'deleted') {
        const { data: flag } = await sb.from('duplicate_flags').select('source_question_id').eq('id', id).single();
        if (flag) {
            // Hard Delete
            await sb.from('questions').delete().eq('id', flag.source_question_id);
        }
    }

    // Refresh
    fetchDuplicates();
    fetchStats(); // Update dashboard count
};

window.scanNow = async () => {
    const btn = document.getElementById('scan-btn');
    const dashBtn = document.getElementById('dash-scan-btn');

    // Reuse Log Modal
    const logModal = document.getElementById('log-modal');
    const logContainer = document.getElementById('publish-logs');
    const closeBtn = document.getElementById('modal-close-btn');

    logModal.classList.remove('hidden');
    closeBtn.classList.add('hidden');
    logContainer.innerHTML = '<div>🔍 Starting Duplicate Scan...</div>';

    const log = (msg, color = '#10b981') => {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        div.style.color = color;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    };

    const setBtn = (txt, dis) => {
        if (btn) { btn.textContent = txt; btn.disabled = dis; }
        if (dashBtn) { dashBtn.textContent = txt; dashBtn.disabled = dis; }
    };

    setBtn('Scanning...', true);

    try {
        log('Requesting scan from Analysis Engine...');
        const res = await fetch(`${API_BASE_URL}/api/scan-duplicates`, {
            method: 'POST'
        });
        const data = await res.json();

        if (data.success) {
            log(`✅ Scan Complete!`);
            log(`📄 Drafts Checked: ${data.draftsChecked}`);
            log(`🚩 New Flags Found: ${data.flagsCreated}`);

            if (data.flagsCreated > 0) {
                log(`⚠️ Check the list below for details.`, '#f59e0b');
            } else {
                log(`✨ Clean! No new duplicates.`, '#3b82f6');
            }

            fetchDuplicates();
            fetchStats();
        } else {
            log(`❌ Scan Failed: ${data.details || 'Unknown error'}`, '#ef4444');
        }
    } catch (e) {
        console.error(e);
        log(`❌ Connection Error: ${e.message}`, '#ef4444');
    } finally {
        setBtn('🔄 Scan Now', false);
        closeBtn.classList.remove('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // fetchDuplicates called by Tab/Switch
    // But we can lazy load it when tab is clicked
});
