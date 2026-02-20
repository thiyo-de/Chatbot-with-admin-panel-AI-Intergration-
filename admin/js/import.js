document.addEventListener('DOMContentLoaded', () => {
    // Shared elements in single page
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const btnImport = document.getElementById('btn-import');

    // Safety check - might run on other tabs
    if (!dropZone || !fileInput || !btnImport) return;

    // UI Handlers
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Parse and Preview
    let parsedData = null;

    function handleDrop(e) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        processFile(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        processFile(file);
    }

    function processFile(file) {
        if (!file || file.type !== 'application/json') {
            alert('Please select a JSON file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Validate structure roughly
                if (!Array.isArray(json) && typeof json === 'object') {
                    // normalize if formatted as { "intents": [...] }
                    parsedData = json.intents || Object.keys(json).map(k => ({ tag: k, ...json[k] }));
                } else if (Array.isArray(json)) {
                    parsedData = json;
                } else {
                    throw new Error('Unknown JSON format');
                }

                document.getElementById('preview-area').classList.remove('hidden');
                document.getElementById('stats-preview').textContent = `Found ${parsedData.length} intents to import.`;
            } catch (err) {
                alert('Invalid JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // Execution
    btnImport.addEventListener('click', async () => {
        if (!parsedData) return;
        const log = document.getElementById('import-log');
        const sb = window.supabaseClient;
        const { data: { user } } = await sb.auth.getUser();

        log.innerHTML = 'Starting import...<br>';
        btnImport.disabled = true;

        const maxQuestions = 9;

        for (const item of parsedData) {
            try {
                // Adapt to common JSON formats
                const slug = item.tag || item.intent || item.name;

                // Normalize Questions
                let questions = item.patterns || item.text || item.questions || [];
                if (typeof questions === 'string') questions = [questions];

                // Normalize Responses/Answers
                let responses = item.responses || item.answers || item.response || item.answer || [];
                if (typeof responses === 'string') responses = [responses];

                if (!slug) {
                    log.innerHTML += `<span style="color:var(--warning-text)">Skipping item without tag/slug</span><br>`;
                    continue;
                }

                // Strict Validation: Must have exactly 9 questions
                if (questions.length !== 9) {
                    log.innerHTML += `<span style="color:var(--warning-text)">Skipping "${slug}": Must have exactly 9 questions (found ${questions.length}).</span><br>`;
                    continue;
                }

                // Strict Validation: Must have at least 1 answer
                if (responses.length === 0) {
                    log.innerHTML += `<span style="color:var(--warning-text)">Skipping "${slug}": Must have at least 1 answer.</span><br>`;
                    continue;
                }

                // 1. Create Intent (Draft)
                // Use slug as name initially
                const { data: intent, error: iErr } = await sb.from('intents').insert({
                    name: slug.replace(/_/g, ' '), // Human readable
                    slug: slug.toLowerCase().replace(/\s+/g, '_'), // Slug
                    status: 'draft',
                    created_by: user.id
                }).select().single();

                if (iErr) {
                    if (iErr.code === '23505') { // Unique violation
                        log.innerHTML += `<span style="color:var(--warning-text)">Skipped duplicate intent: ${slug}</span><br>`;
                    } else {
                        log.innerHTML += `<span style="color:var(--danger-text)">Error creating ${slug}: ${iErr.message}</span><br>`;
                    }
                    continue; // Skip children if parent failed
                }

                // 2. Insert Answer (First one only)
                if (responses.length > 0) {
                    await sb.from('answers').insert({
                        intent_id: intent.id,
                        answer_text: responses[0],
                        is_active: true,
                        created_by: user.id
                    });
                }

                // 3. Insert Questions (Limit 9)
                const questionsToInsert = questions.slice(0, maxQuestions).map((q, idx) => ({
                    intent_id: intent.id,
                    question_text: q,
                    order_index: idx + 1,
                    is_active: true,
                    created_by: user.id
                }));

                if (questionsToInsert.length > 0) {
                    await sb.from('questions').insert(questionsToInsert);
                }

                log.innerHTML += `<span style="color:var(--success-text)">Imported: ${slug}</span><br>`;

            } catch (err) {
                log.innerHTML += `<span style="color:var(--danger-text)">Crash on ${JSON.stringify(item).substring(0, 20)}...</span><br>`;
                console.error(err);
            }
        }

        log.innerHTML += '<strong>Done!</strong>';
        log.scrollTop = log.scrollHeight;

        btnImport.disabled = false;
        btnImport.textContent = 'Import Complete';

        // Refresh stats if dashboard is viewed later
        if (window.fetchStats) window.fetchStats();
    });
});
