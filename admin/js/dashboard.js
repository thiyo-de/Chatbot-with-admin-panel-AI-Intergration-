// Make available globally
window.fetchStats = async function () {
    const sb = window.supabaseClient;

    try {
        // 1. Total Intents
        const { count: total, error: err1 } = await sb
            .from('intents')
            .select('*', { count: 'exact', head: true });

        if (err1) throw err1;

        // 2. Published Intents
        const { count: published, error: err2 } = await sb
            .from('intents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');

        if (err2) throw err2;

        // 3. Draft Intents
        const { count: drafts, error: err3 } = await sb
            .from('intents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'draft');

        if (err3) throw err3;

        // 4. Duplicate Flags (Unresolved)
        const { count: flags, error: err4 } = await sb
            .from('duplicate_flags')
            .select('*', { count: 'exact', head: true })
            .eq('resolution', 'unresolved');

        if (err4) throw err4;

        // Update UI
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        set('stat-total', total);
        set('stat-published', published);
        set('stat-draft', drafts);
        set('stat-flags', flags);

    } catch (err) {
        console.error('Error fetching stats:', err);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    fetchStats();

    // Auth display
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) document.getElementById('user-email').textContent = session.user.email;
    });
});
