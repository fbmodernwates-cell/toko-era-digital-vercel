const SUPABASE_URL = 'https://msqgmtvbxzhsbleraysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_k3zaTPaPEUr_yLeE-gIJgw_egDCeyFp';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
