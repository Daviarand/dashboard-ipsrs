// ============================================================================
// Edge Function: admin-manage-users
// Dashboard IPSRS RS. Soeharto Heerdjan
// Sumber: IPSRS_DASHBOARD_SPEC.md §5.3
//
// CARA MEN-DEPLOY LEWAT SUPABASE DASHBOARD:
// 1. Buka Supabase Dashboard -> Edge Functions
// 2. Klik "Deploy a new function" -> pilih "Via Editor" (tulis di browser)
// 3. Beri nama function: admin-manage-users
// 4. Salin seluruh isi file ini, lalu tempel ke editor Supabase
// 5. Pastikan opsi "Enforce JWT Verification" tetap aktif (ON)
// 6. Klik "Deploy"
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_EMAIL_DOMAIN = "ipsrs.local";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
    return errorResponse("Origin tidak diizinkan", 403);
  }

  // Tangani preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Metode permintaan tidak didukung", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const emailDomain = Deno.env.get("LOGIN_EMAIL_DOMAIN") || DEFAULT_EMAIL_DOMAIN;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return errorResponse("Konfigurasi server belum lengkap", 500);
    }

    // 1. Verifikasi JWT pemanggil
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Sesi login tidak valid. Silakan login kembali.", 401);
    }

    // Client dengan service role key untuk operasi admin
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validasi token pemanggil
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !callerUser) {
      return errorResponse("Sesi login kedaluwarsa atau tidak valid", 401);
    }

    // Pastikan pemanggil adalah admin aktif
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return errorResponse("Akses ditolak. Tindakan ini hanya boleh dilakukan oleh Admin aktif.", 403);
    }

    // Parse request body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Format data permintaan tidak valid", 400);
    }

    const { action } = body;

    // ------------------------------------------------------------------------
    // AKSI: create (tambah akun teknisi baru)
    // ------------------------------------------------------------------------
    if (action === "create") {
      const { username, full_name, password } = body;

      if (!username || typeof username !== "string") {
        return errorResponse("Username wajib diisi", 400);
      }
      const cleanUsername = username.trim().toLowerCase();

      // Validasi format username (sesuai constraint DB: 3-30 karakter, huruf kecil, angka, ., _, -)
      if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
        return errorResponse("Username harus berupa 3-30 karakter (huruf kecil, angka, titik, garis bawah, atau strip)", 400);
      }

      if (!full_name || typeof full_name !== "string" || full_name.trim().length === 0) {
        return errorResponse("Nama lengkap wajib diisi", 400);
      }

      if (!password || typeof password !== "string" || password.length < 8) {
        return errorResponse("Kata sandi minimal 8 karakter", 400);
      }

      // Cek apakah username sudah dipakai di profiles
      const { data: existingUser } = await adminClient
        .from("profiles")
        .select("id")
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return errorResponse("Username sudah digunakan oleh akun lain", 409);
      }

      const email = `${cleanUsername}@${emailDomain}`;

      // Buat user di Supabase Auth
      const { data: authUser, error: createAuthError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim(), username: cleanUsername },
      });

      if (createAuthError || !authUser.user) {
        console.error("Auth createUser error:", createAuthError);
        if (createAuthError?.code === "email_exists" || createAuthError?.code === "user_already_exists") {
          return errorResponse("Username sudah digunakan oleh akun lain", 409);
        }
        return errorResponse("Gagal membuat akun autentikasi", 500);
      }

      // Buat profil di public.profiles (role teknisi)
      const { error: insertProfileError } = await adminClient
        .from("profiles")
        .insert({
          id: authUser.user.id,
          username: cleanUsername,
          full_name: full_name.trim(),
          role: "teknisi",
          is_active: true,
        });

      if (insertProfileError) {
        console.error("Profile insert error:", insertProfileError);
        // Rollback auth user bila insert profile gagal
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return errorResponse("Gagal menyimpan profil pengguna ke database", 500);
      }

      return jsonResponse({
        ok: true,
        data: {
          id: authUser.user.id,
          username: cleanUsername,
          full_name: full_name.trim(),
          role: "teknisi",
        },
      });
    }

    // ------------------------------------------------------------------------
    // AKSI: reset_password
    // ------------------------------------------------------------------------
    if (action === "reset_password") {
      const { user_id, new_password } = body;

      if (!user_id || typeof user_id !== "string") {
        return errorResponse("User ID wajib diisi", 400);
      }

      if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
        return errorResponse("Kata sandi baru minimal 8 karakter", 400);
      }

      const { error: resetError } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (resetError) {
        console.error("Reset password error:", resetError);
        return errorResponse("Gagal memperbarui kata sandi", 500);
      }

      return jsonResponse({ ok: true });
    }

    // ------------------------------------------------------------------------
    // AKSI: set_active (aktifkan / nonaktifkan pengguna)
    // ------------------------------------------------------------------------
    if (action === "set_active") {
      const { user_id, is_active } = body;

      if (!user_id || typeof user_id !== "string") {
        return errorResponse("User ID wajib diisi", 400);
      }

      if (typeof is_active !== "boolean") {
        return errorResponse("Status aktif harus bernilai boolean", 400);
      }

      // Cek apakah target adalah admin terakhir yang aktif
      const { data: targetProfile, error: targetError } = await adminClient
        .from("profiles")
        .select("role, is_active")
        .eq("id", user_id)
        .single();

      if (targetError || !targetProfile) {
        return errorResponse("Akun pengguna tidak ditemukan", 404);
      }

      if (targetProfile && targetProfile.role === "admin" && !is_active) {
        const { count: adminCount } = await adminClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("is_active", true);

        if ((adminCount || 0) <= 1) {
          return errorResponse("Minimal harus ada satu admin aktif", 400);
        }
      }

      // Update profil di database
      const { error: updateProfileError } = await adminClient
        .from("profiles")
        .update({ is_active })
        .eq("id", user_id);

      if (updateProfileError) {
        console.error("Update profile active error:", updateProfileError);
        return errorResponse("Gagal memperbarui status aktif profil", 400);
      }

      // Ban atau unban di Supabase Auth
      // Ban 100 tahun jika dinonaktifkan, atau 'none' jika diaktifkan kembali
      const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: is_active ? "none" : "876000h",
      });

      if (banError) {
        console.error("Auth ban/unban error:", banError);
        const { error: rollbackError } = await adminClient
          .from("profiles")
          .update({ is_active: targetProfile.is_active })
          .eq("id", user_id);
        if (rollbackError) console.error("Profile rollback failed after Auth update error:", rollbackError);
        return errorResponse("Gagal memperbarui status akun", 500);
      }

      return jsonResponse({ ok: true });
    }

    return errorResponse(`Aksi "${action}" tidak dikenali`, 400);
  } catch (err: unknown) {
    console.error("Unhandled error in admin-manage-users:", err);
    return errorResponse("Terjadi kesalahan internal pada server", 500);
  }
});
