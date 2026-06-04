window.TaxOrderAuth = {
  async login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("[Supabase Auth] Błąd logowania:", error.message);
      return { ok: false, error };
    }

    console.log("[Supabase Auth] Zalogowano:", data.user.email);
    return { ok: true, user: data.user, session: data.session };
  },

  async logout() {
    await window.supabaseClient.auth.signOut();
    console.log("[Supabase Auth] Wylogowano");
  },

  async getSession() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      console.error("[Supabase Auth] Błąd sesji:", error.message);
      return null;
    }
    return data.session;
  },

  async getMyCompanies() {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      console.warn("[Supabase Auth] Brak zalogowanego użytkownika");
      return [];
    }

    const { data, error } = await window.supabaseClient
      .from("company_users")
      .select("role, companies(*)")
      .eq("user_id", user.id);

    if (error) {
      console.error("[Supabase Auth] Błąd pobierania firm:", error.message);
      return [];
    }

    console.log("[Supabase Auth] Firmy użytkownika:", data);
    return data;
  }
};
