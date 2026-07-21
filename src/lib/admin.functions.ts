import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Every function in this file performs a privileged, cross-user write
 * (banning a login, changing someone's role, editing another user's
 * data, cancelling a job that isn't the caller's own, etc). Each one
 * independently re-verifies the caller is an admin against user_roles
 * using the caller's own RLS-scoped token before touching the
 * service-role client - never trust a role claim baked into a JWT or
 * passed in from the client.
 */
async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Response("Forbidden: admin role required", { status: 403 });
}

export const adminSetUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; suspended: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Response("You can't suspend your own account", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ban_duration actually blocks login at the auth layer - this is
    // the real enforcement, not just a display flag.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspended ? "87600h" : "none", // ~10 years, or lift the ban
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ is_suspended: data.suspended })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "client" | "fundi" | "admin" }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Response("You can't change your own role", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    // user_roles mirrors profiles.role and is what RLS policies actually
    // check (via has_role()) - keep both in sync in one transaction-ish
    // pair of calls. Replace rather than upsert, since a user has
    // exactly one role at a time in this app's model.
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    if (data.role === "fundi") {
      // Promoting to fundi: make sure a fundis row exists so they show
      // up in fundi-facing queries immediately. Leave them offline/
      // unconfigured until they complete /fundi/setup themselves.
      const { error: fundiError } = await supabaseAdmin
        .from("fundis")
        .upsert(
          { id: data.userId, service: "plumber", is_available: false },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (fundiError) throw new Error(fundiError.message);
    } else {
      // Demoting away from fundi: remove their fundis row entirely
      // rather than leaving a stale one behind.
      const { error: removeError } = await supabaseAdmin
        .from("fundis")
        .delete()
        .eq("id", data.userId);
      if (removeError) throw new Error(removeError.message);
    }

    return { ok: true };
  });

export const adminUpdateFundi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      fundiId: string;
      service?: "plumber" | "electrician" | "carpenter" | "mechanic";
      hourlyRate?: number;
      isAvailable?: boolean;
      lat?: number;
      lng?: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      service?: "plumber" | "electrician" | "carpenter" | "mechanic";
      hourly_rate?: number;
      is_available?: boolean;
      current_lat?: number;
      current_lng?: number;
    } = {};
    if (data.service !== undefined) patch.service = data.service;
    if (data.hourlyRate !== undefined) patch.hourly_rate = data.hourlyRate;
    if (data.isAvailable !== undefined) patch.is_available = data.isAvailable;
    if (data.lat !== undefined) patch.current_lat = data.lat;
    if (data.lng !== undefined) patch.current_lng = data.lng;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("fundis").update(patch).eq("id", data.fundiId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const adminCancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("jobs")
      .update({
        status: "cancelled",
        cancelled_by: context.userId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: data.reason || "Cancelled by admin",
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const adminReassignJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; fundiId: string | null }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.fundiId) {
      const { data: fundi, error: fundiLookupError } = await supabaseAdmin
        .from("fundis")
        .select("id")
        .eq("id", data.fundiId)
        .maybeSingle();
      if (fundiLookupError) throw new Error(fundiLookupError.message);
      if (!fundi) throw new Response("That user isn't a registered fundi", { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("jobs")
      .update({
        fundi_id: data.fundiId,
        status: data.fundiId ? "accepted" : "searching",
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const adminDeleteRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ratingId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ratings").delete().eq("id", data.ratingId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
