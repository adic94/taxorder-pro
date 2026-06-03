const supabase = window.supabase.createClient(
  window.TAXORDER_SUPABASE.url,
  window.TAXORDER_SUPABASE.anonKey
);

window.supabaseClient = supabase;

console.log("[Supabase] Połączono:", window.TAXORDER_SUPABASE.url);
