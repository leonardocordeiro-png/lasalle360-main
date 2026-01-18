import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with the caller's JWT to check admin privileges
    const supabaseWithAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authUserData } = await supabaseWithAuth.auth.getUser();
    const caller = authUserData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin using the has_role function
    const { data: isAdmin, error: adminErr } = await supabaseWithAuth.rpc('has_role', { 
      _user_id: caller.id,
      _role: 'admin'
    });
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    console.log(`Attempting comprehensive data deletion for user_id: ${user_id}`);

    // Helper to handle deletion and return specific error
    const deleteAndCheck = async (table: string, query: any, errorMessage: string) => {
      const { error } = await query;
      if (error) {
        console.error(`Error deleting from ${table} for user ${user_id}:`, error);
        throw new Error(`${errorMessage}: ${error.message}`);
      }
      console.log(`Successfully deleted from ${table} for user ${user_id}.`);
    };

    // --- Start comprehensive cleanup in application tables ---

    // 1. Get user's councils first, as many tables depend on them
    let userCouncils: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('class_councils')
        .select('id')
        .or(`created_by.eq.${user_id},approved_by.eq.${user_id}`);
      if (error) throw error;
      userCouncils = data || [];
    } catch (error: any) {
      console.error(`Error fetching user councils for user ${user_id}:`, error);
      throw new Error(`Erro ao buscar conselhos do usuário: ${error.message}`);
    }
    const councilIds = userCouncils.map(c => c.id);

    // 2. Get student IDs from these councils
    let userCouncilStudents: any[] = [];
    if (councilIds.length > 0) {
      try {
        const { data, error } = await supabaseAdmin
          .from('council_students')
          .select('id')
          .in('council_id', councilIds);
        if (error) throw error;
        userCouncilStudents = data || [];
      } catch (error: any) {
        console.error(`Error fetching council students for user ${user_id}:`, error);
        throw new Error(`Erro ao buscar alunos dos conselhos: ${error.message}`);
      }
    }
    const studentIds = userCouncilStudents.map(s => s.id);

    // Deletions in reverse dependency order (children first)
    // Council-related tables
    if (studentIds.length > 0) {
      await deleteAndCheck(
        'council_grades',
        supabaseAdmin.from('council_grades').delete().in('council_student_id', studentIds),
        'Erro ao excluir notas dos conselhos'
      );
    }
    if (councilIds.length > 0) {
      await deleteAndCheck(
        'council_actions',
        supabaseAdmin.from('council_actions').delete().in('council_id', councilIds),
        'Erro ao excluir ações dos conselhos'
      );
      await deleteAndCheck(
        'council_signatures',
        supabaseAdmin.from('council_signatures').delete().in('council_id', councilIds),
        'Erro ao excluir assinaturas dos conselhos'
      );
      await deleteAndCheck(
        'council_students',
        supabaseAdmin.from('council_students').delete().in('council_id', councilIds),
        'Erro ao excluir alunos dos conselhos'
      );
    }
    // Delete signatures directly linked to user_id (if any not covered by council_id)
    await deleteAndCheck(
      'council_signatures (user_id)',
      supabaseAdmin.from('council_signatures').delete().eq('signed_by', user_id),
      'Erro ao excluir assinaturas diretas do usuário'
    );
    if (councilIds.length > 0) {
      await deleteAndCheck(
        'class_councils',
        supabaseAdmin.from('class_councils').delete().or(`created_by.eq.${user_id},approved_by.eq.${user_id}`),
        'Erro ao excluir conselhos de classe'
      );
    }

    // Other tables directly referencing auth.users
    await deleteAndCheck(
      'chromebook_bookings',
      supabaseAdmin.from('chromebook_bookings').delete().eq('user_id', user_id),
      'Erro ao excluir agendamentos de chromebooks'
    );
    await deleteAndCheck(
      'room_bookings',
      supabaseAdmin.from('room_bookings').delete().eq('user_id', user_id),
      'Erro ao excluir agendamentos de salas'
    );
    await deleteAndCheck(
      'chromebook_loans',
      supabaseAdmin.from('chromebook_loans').delete().or(`created_by.eq.${user_id},returned_by.eq.${user_id}`),
      'Erro ao excluir empréstimos de chromebooks'
    );
    await deleteAndCheck(
      'it_equipment',
      supabaseAdmin.from('it_equipment').delete().eq('created_by', user_id),
      'Erro ao excluir equipamentos de TI'
    );
    await deleteAndCheck(
      'class_planning',
      supabaseAdmin.from('class_planning').delete().eq('created_by', user_id),
      'Erro ao excluir planejamento de turmas'
    );
    await deleteAndCheck(
      'user_permissions',
      supabaseAdmin.from('user_permissions').delete().or(`user_id.eq.${user_id},created_by.eq.${user_id}`),
      'Erro ao excluir permissões do usuário'
    );
    await deleteAndCheck(
      'user_roles',
      supabaseAdmin.from('user_roles').delete().or(`user_id.eq.${user_id},granted_by.eq.${user_id}`),
      'Erro ao excluir papéis do usuário'
    );
    await deleteAndCheck(
      'school_planning_audit_log',
      supabaseAdmin.from('school_planning_audit_log').delete().eq('user_id', user_id),
      'Erro ao excluir logs de planejamento escolar'
    );
    await deleteAndCheck(
      'security_audit_log',
      supabaseAdmin.from('security_audit_log').delete().eq('user_id', user_id),
      'Erro ao excluir logs de segurança'
    );
    await deleteAndCheck(
      'profiles',
      supabaseAdmin.from('profiles').delete().eq('user_id', user_id),
      'Erro ao excluir perfil do usuário'
    );

    // --- End comprehensive cleanup ---

    // Finally, delete the auth user
    const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (delUserErr) {
      console.error(`Final error deleting auth user ${user_id}:`, delUserErr);
      throw new Error(`Erro final ao excluir usuário de autenticação: ${delUserErr.message}`);
    }

    console.log(`User ${user_id} and all related data deleted successfully.`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Unexpected error in delete-user function:', e);
    return new Response(JSON.stringify({ error: 'Não foi possível excluir o usuário.', details: e.message || String(e) }), {
      status: 500,
      headers: { ...buildCorsHeaders(req.headers.get("Origin")), 'Content-Type': 'application/json' },
    });
  }
});