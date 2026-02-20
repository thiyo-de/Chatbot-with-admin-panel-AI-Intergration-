// Intents CRUD
let currentIntentId = null;
let selectedIntents = new Set();

document.addEventListener('DOMContentLoaded', () => {
    // If we land on intents tab, fetch (or lazy load).
    // For now, let fetchIntents be called by switchTab.
    // generateQuestionInputs called when modal opens or init.
});

// 1. Fetch List
window.fetchIntents = async function () {
    const sb = window.supabaseClient;
    const search = document.getElementById('search-input')?.value || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';

    let query = sb
        .from('intents')
        .select(`
            *,
            questions:questions(count),
            answers:answers(count)
        `)
        .order('updated_at', { ascending: false });

    if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }

    if (search) {
        query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching intents:', error);
        alert('Error loading intents: ' + error.message);
        return;
    }

    const tbody = document.getElementById('intent-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    selectedIntents.clear();
    updateBulkToolbar();

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:var(--text-secondary);">No intents found.</td></tr>`;
        return;
    }

    data.forEach(intent => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';

        const qCount = intent.questions ? intent.questions[0].count : 0;
        const aCount = intent.answers ? intent.answers[0].count : 0;

        const isReady = (qCount === 9 && aCount === 1);
        let statusBadge = '';

        if (intent.status === 'published') {
            statusBadge = '<span class="badge badge-published">Published</span>';
        } else {
            statusBadge = isReady
                ? '<span class="badge badge-draft" style="background:#e0f2fe; color:#0369a1;">Ready</span>'
                : `<span class="badge badge-draft" style="background:#fee2e2; color:#b91c1c;">Incomplete (${qCount}/9 Q)</span>`;
        }

        const dateStr = new Date(intent.updated_at).toLocaleDateString();

        tr.innerHTML = `
            <td style="padding: 1rem 0.5rem; text-align: center;">
                <input type="checkbox" class="intent-checkbox" value="${intent.id}" onchange="toggleSelection('${intent.id}')">
            </td>
            <td style="padding: 1rem 0.5rem; font-weight: 500;">
                <a href="#" onclick="editIntent('${intent.id}'); return false;" style="color:var(--text-primary); text-decoration:none: hover:underline;">${intent.name}</a>
            </td>
            <td style="padding: 1rem 0.5rem;">${statusBadge}</td>
            <td style="padding: 1rem 0.5rem; color: var(--text-secondary);">v${intent.version}</td>
            <td style="padding: 1rem 0.5rem; color: var(--text-secondary);">${dateStr}</td>
            <td style="padding: 1rem 0.5rem; text-align: right;">
                <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="editIntent('${intent.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteIntent('${intent.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteIntent = async (id) => {
    if (!confirm('Are you sure you want to delete this intent? This action cannot be undone.')) return;

    const sb = window.supabaseClient;
    const { error } = await sb.from('intents').delete().eq('id', id);

    if (error) {
        alert('Error deleting: ' + error.message);
    } else {
        fetchIntents();
        fetchStats();
    }
};

// Bulk Selection
window.toggleSelection = (id) => {
    if (selectedIntents.has(id)) selectedIntents.delete(id);
    else selectedIntents.add(id);
    updateBulkToolbar();
};

window.toggleSelectAll = (source) => {
    const checkboxes = document.querySelectorAll('.intent-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = source.checked;
        if (source.checked) selectedIntents.add(cb.value);
        else selectedIntents.delete(cb.value);
    });
    updateBulkToolbar();
};

function updateBulkToolbar() {
    const toolbar = document.getElementById('bulk-toolbar');
    const checkedCount = selectedIntents.size;

    if (checkedCount > 0) {
        toolbar.classList.remove('hidden');
        document.getElementById('selected-count').innerText = `${checkedCount} selected`;
    } else {
        toolbar.classList.add('hidden');
    }
}

// Bulk Publish
window.publishSelected = async () => {
    if (selectedIntents.size === 0) return;
    if (!confirm(`Publish ${selectedIntents.size} items?`)) return;
    await performBulkPublish(Array.from(selectedIntents));
};

window.deleteSelected = async () => {
    if (selectedIntents.size === 0) return;
    if (!confirm(`Are you sure you want to DELETE ${selectedIntents.size} items? This cannot be undone.`)) return;

    const sb = window.supabaseClient;
    const ids = Array.from(selectedIntents);

    // Hard delete
    const { error } = await sb.from('intents').delete().in('id', ids);

    if (error) {
        alert('Error deleting items: ' + error.message);
    } else {
        fetchIntents();
        fetchStats();
    }
};

window.publishAllDrafts = async () => {
    if (!confirm('Are you sure you want to PUBLISH ALL Drafts?')) return;
    const sb = window.supabaseClient;
    const { data, error } = await sb.from('intents').select('id').eq('status', 'draft');
    if (error || !data) return alert('Error fetching drafts');
    if (data.length === 0) return alert('No drafts to publish');

    await performBulkPublish(data.map(d => d.id));
};

window.publishIntent = async () => {
    const saved = await window.saveDraft();
    if (!saved) return; // Stop if validation failed

    if (!currentIntentId) return alert('Error: Could not save draft.');
    if (!confirm('Are you sure you want to PUBLISH?')) return;

    await performBulkPublish([currentIntentId]);
    closeEditor();
};

async function performBulkPublish(ids) {
    // Show Logs Modal
    const logModal = document.getElementById('log-modal');
    const logContainer = document.getElementById('publish-logs');
    const closeBtn = document.getElementById('modal-close-btn');

    logModal.classList.remove('hidden');
    closeBtn.classList.add('hidden'); // Hide close button initially
    logContainer.innerHTML = '<div>🚀 Starting Publish Job (Batched)...</div>';

    // Estimate time: ~1.5s per intent (9 questions * 0.15s) - still might be slow
    // We'll batch 1 intent at a time to avoid timeout and 429 rate limit
    const BATCH_SIZE = 1;
    const batches = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    // Add 3s per intent for rate limit
    const estTime = Math.ceil(ids.length * 4); // 4s per intent safety
    const div = document.createElement('div');
    div.textContent = `⏱️ Approx. time: ${Math.ceil(estTime / 60)} minutes (${batches.length} batches)`;
    div.style.color = '#60a5fa'; // Blue-ish
    div.style.marginBottom = '1rem';
    logContainer.appendChild(div);

    const log = (msg, color = '#10b981') => {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        div.style.color = color;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    };

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
        const batchIds = batches[i];
        log(`Processing Batch ${i + 1}/${batches.length} (${batchIds.length} items)...`, '#fbbf24');

        try {
            // Updated URL to localhost in previous step
            const res = await fetch(`${API_BASE_URL}/api/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentIds: batchIds })
            });

            if (!res.ok) throw new Error(`Server status ${res.status}`);

            const data = await res.json();

            if (data.success) {
                totalSuccess += data.results?.success || 0;
                totalFailed += data.results?.failed || 0;
                log(`  ✅ Batch ${i + 1} Done. (Success: ${data.results?.success || 0})`);

                // CHECK FOR SERVER SIDE ABORT
                if (data.results?.aborted) {
                    log(`  🛑 Job Aborted by Server (Rate Limit/Error). Stopping...`, '#fbbf24');
                    break; // STOP FRONTEND LOOP
                }

            } else {
                log(`  ❌ Batch ${i + 1} Failed: ${data.message}`, '#ef4444');
                totalFailed += batchIds.length;

                // ALSO STOP IF CRITICAL ERROR (like 500 or 403 reflected in success: false)
                break;
            }

        } catch (err) {
            log(`  ❌ Error Batch ${i + 1}: ${err.message}`, '#ef4444');
            totalFailed += batchIds.length;
            // Stop on network error
            break;
        }

        // Wait 3 seconds to avoid rate limiting
        await new Promise(r => setTimeout(r, 3000));
    }

    log('--- JOB FINISHED ---');
    log(`Total Success: ${totalSuccess}`);
    log(`Total Failed: ${totalFailed}`);

    if (totalSuccess > 0) {
        fetchStats();
        fetchIntents(); // Refresh list to update status badges
    }
    closeBtn.classList.remove('hidden');
}


// Editor Mechanics
window.generateQuestionInputs = () => {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
        const div = document.createElement('div');
        div.className = 'question-item';
        div.innerHTML = `
            <input type="text" id="q-${i}" placeholder="Variation ${i}..." style="width:100%">
            <button class="btn btn-outline" onclick="clearQ(${i})" style="position: absolute; right: 8px; top: 4px; padding: 0.2rem 0.5rem; font-size: 0.7rem; color: #ef4444; border:none;" title="Clear">✕</button>
        `;
        container.appendChild(div);
    }
};

window.clearQ = (i) => {
    document.getElementById(`q-${i}`).value = '';
};

window.openEditor = () => {
    currentIntentId = null;
    document.getElementById('intent-form').reset();
    document.getElementById('intent-id').value = '';
    generateQuestionInputs();

    document.getElementById('save-status').textContent = '';
    document.getElementById('editor-modal').classList.remove('hidden');
};

window.closeEditor = () => {
    document.getElementById('editor-modal').classList.add('hidden');
    // fetchIntents(); // Removed auto-refresh to prevent jarring UX
};

window.editIntent = async (id) => {
    currentIntentId = id;
    const sb = window.supabaseClient;
    const { data: intent } = await sb.from('intents').select('*').eq('id', id).single();
    if (!intent) return;

    const { data: questions } = await sb.from('questions').select('*').eq('intent_id', id).order('order_index');
    const { data: answers } = await sb.from('answers').select('*').eq('intent_id', id).eq('is_active', true);

    document.getElementById('intent-id').value = intent.id;
    document.getElementById('intent-name').value = intent.name;

    if (answers && answers.length > 0) {
        document.getElementById('intent-answer').value = answers[0].answer_text;
    } else {
        document.getElementById('intent-answer').value = '';
    }

    generateQuestionInputs();
    // Fill values
    if (questions) {
        questions.forEach((q, idx) => {
            const inputIndex = q.order_index || (idx + 1);
            if (inputIndex <= 9) {
                const input = document.getElementById(`q-${inputIndex}`);
                if (input) input.value = q.question_text;
            }
        });
    }

    document.getElementById('editor-modal').classList.remove('hidden');
    document.getElementById('save-status').textContent = '';
};

window.saveDraft = async () => {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return alert('Not logged in');

    const statusSpan = document.getElementById('save-status');
    statusSpan.textContent = 'Saving...';
    statusSpan.style.color = 'var(--text-secondary)';

    try {
        const name = document.getElementById('intent-name').value;
        const answerText = document.getElementById('intent-answer').value;
        let intentId = currentIntentId;

        // Validation
        if (!name || !answerText) throw new Error("Name and Answer are required.");

        // 9 Questions Validation
        for (let i = 1; i <= 9; i++) {
            const qVal = document.getElementById(`q-${i}`).value.trim();
            if (!qVal) throw new Error(`All 9 questions are mandatory. Question ${i} is missing.`);
        }

        if (!intentId) {
            const { data, error } = await sb.from('intents').insert({
                name: name,
                slug: name.toLowerCase().replace(/\s+/g, '_'),
                status: 'draft',
                created_by: user.id
            }).select().single();
            if (error) throw error;
            intentId = data.id;
            currentIntentId = intentId;
        } else {
            const { error } = await sb.from('intents').update({
                name: name,
                slug: name.toLowerCase().replace(/\s+/g, '_'),
                status: 'draft' // Always revert to draft on edit
            }).eq('id', intentId);
            if (error) throw error;
        }

        // Answer
        const { data: existingAnswers } = await sb.from('answers').select('id').eq('intent_id', intentId);
        if (answerText.trim()) {
            if (existingAnswers && existingAnswers.length > 0) {
                await sb.from('answers').update({ answer_text: answerText }).eq('id', existingAnswers[0].id);
            } else {
                await sb.from('answers').insert({
                    intent_id: intentId,
                    answer_text: answerText,
                    is_active: true,
                    created_by: user.id
                });
            }
        }

        // Questions
        const { data: existingQuestions } = await sb.from('questions').select('*').eq('intent_id', intentId);
        const map = {};
        existingQuestions?.forEach(q => map[q.order_index] = q.id);

        for (let i = 1; i <= 9; i++) {
            const val = document.getElementById(`q-${i}`).value.trim();
            const qId = map[i];

            if (val) {
                if (qId) {
                    await sb.from('questions').update({ question_text: val }).eq('id', qId);
                } else {
                    await sb.from('questions').insert({
                        intent_id: intentId,
                        question_text: val,
                        order_index: i,
                        is_active: true,
                        created_by: user.id
                    });
                }
            } else if (qId) {
                // Hard Delete empty questions (Though validation prevents this reaching here for empty ones)
                await sb.from('questions').delete().eq('id', qId);
            }
        }

        statusSpan.textContent = 'Draft Saved';
        statusSpan.style.color = 'var(--success-text)';

        fetchIntents(); // Refresh list background
        fetchStats();

        return true; // Success

    } catch (err) {
        console.error(err);
        statusSpan.textContent = 'Error: ' + err.message;
        statusSpan.style.color = 'var(--danger-text)';
        return false; // Failure
    }
};
