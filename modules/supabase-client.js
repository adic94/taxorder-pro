(function () {
  if (!window.supabase) {
    console.error("[Supabase] Brak biblioteki supabase-js");
    return;
  }

  if (!window.TAXORDER_SUPABASE) {
    console.error("[Supabase] Brak config/supabase-config.js");
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    window.TAXORDER_SUPABASE.url,
    window.TAXORDER_SUPABASE.anonKey
  );

  console.log("[Supabase] Połączono:", window.TAXORDER_SUPABASE.url);
})();
