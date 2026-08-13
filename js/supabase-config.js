const SUPABASE_URL = 'https://msqgmtvbxzhsbleraysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_k3zaTPaPEUr_yLeE-gIJgw_egDCeyFp';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Also expose client instance via window, so other scripts can access it
// reliably (e.g. store.html, future dynamic pages).
// Note: window.supabase is the SDK module (has createClient method),
// window.supabaseClient is the actual client instance (has .from / .auth).
window.supabaseClient = supabase;

async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
    });
    return { data, error };
}

async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return { data, error };
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}
