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

  async resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname;

    const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      console.error("[Supabase Auth] Błąd resetu hasła:", error.message);
      return { ok: false, error };
    }

    return { ok: true, data };
  },

  async updatePassword(newPassword) {
    const { data, error } = await window.supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error("[Supabase Auth] Błąd zmiany hasła:", error.message);
      return { ok: false, error };
    }

    return { ok: true, data };
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
      .from("user_company_access")
      .select(`
        can_view,
        can_edit,
        companies (
          id,
          slug,
          short_name,
          name,
          nip,
          regon,
          krs,
          city,
          street,
          building_no,
          postal_code,
          woj,
          organ,
          color,
          owner_label
        )
      `)
      .eq("user_id", user.id)
      .eq("can_view", true);

    if (error) {
      console.error("[Supabase Auth] Błąd pobierania firm:", error.message);
      return [];
    }

    const companies = (data || [])
      .filter(row => row.companies)
      .map(row => ({
        ...row.companies,
        can_view: !!row.can_view,
        can_edit: !!row.can_edit
      }));

    console.log("[Supabase Auth] Firmy użytkownika:", companies);
    return companies;
  }
};