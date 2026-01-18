import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const buildCorsHeaders = (origin: string | null) => {
  const allowed = Deno.env.get("ALLOWED_ORIGINS") || "*";
  const allowOrigin =
    allowed === "*"
      ? "*"
      : origin && allowed.split(",").map((o) => o.trim()).includes(origin)
      ? origin
      : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

interface LoanReturnNotification {
  loanId: string;
  borrowerName: string;
  chromebookNumber: string;
  returnedBy: string;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require JWT and check permission level
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseWithAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authUser } = await supabaseWithAuth.auth.getUser();
    if (!authUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check: user must have write access to loans_management
    const { data: hasWrite, error: permErr } = await supabaseWithAuth.rpc("user_has_permission_level", {
      p_user_id: authUser.user.id,
      p_module_name: "loans_management",
      p_required_level: "write",
    });
    if (permErr || !hasWrite) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { loanId, borrowerName, chromebookNumber, returnedBy }: LoanReturnNotification = await req.json();

    // Use service role only after permission check for limited operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar equipe de TI (admins ou users com permissão IT)
    const { data: itTeam } = await supabaseAdmin
      .from("user_permissions")
      .select("user_id, profiles!inner(email, full_name)")
      .eq("module_name", "admin_it_equipment")
      .eq("permission_level", "write");

    console.log(`Loan ${loanId} returned by ${returnedBy}. Equipment: ${chromebookNumber}, Borrower: ${borrowerName}`);
    console.log(`IT team to notify:`, itTeam);

    // Atualizar flag de notificação enviada (could also be done via supabaseWithAuth due to RLS)
    await supabaseAdmin
      .from("chromebook_loans")
      .update({ notification_sent: true })
      .eq("id", loanId);

    // TODO: Implementar envio de email via Resend quando necessário
    // Exemplo:
    // await resend.emails.send({
    //   from: 'TI La Salle <ti@lasalle.org.br>',
    //   to: itTeam.map(t => t.profiles.email),
    //   subject: `Chromebook ${chromebookNumber} devolvido`,
    //   html: `O Chromebook ${chromebookNumber} foi devolvido por ${borrowerName}.`
    // });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "IT team notified",
        notifiedCount: itTeam?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...buildCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" } }
    );
  }
});