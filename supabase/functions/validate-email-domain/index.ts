// Edge Function: validate-email-domain
// Validates that only @lasalle.org.br emails can confirm registration
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  };
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Require webhook secret to mitigate verify_jwt=false
    const expectedSecret = Deno.env.get('AUTH_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized webhook' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // This function will be called by Supabase auth webhooks
    const body = await req.json();
    console.log('Webhook received:', body);

    // Check if it's an email confirmation event
    if (body.type === 'signup' && body.record) {
      const user = body.record;
      const email = user.email;

      console.log('Processing signup for email:', email);

      // Validate that email is from @lasalle.org.br domain
      if (!email || !email.endsWith('@lasalle.org.br')) {
        console.log('Invalid domain for email:', email);
        
        // Delete the user if they don't have a valid domain
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error('Error deleting invalid user:', deleteError);
        }

        return new Response(
          JSON.stringify({ 
            error: 'Apenas emails @lasalle.org.br são permitidos',
            action: 'user_deleted'
          }), 
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Log successful validation
      console.log('Valid domain confirmed for:', email);
      
      // Add audit log
      await supabaseAdmin.from('security_audit_log').insert({
        action: 'email_domain_validated',
        user_id: user.id,
        resource_type: 'auth',
        resource_id: user.id,
        additional_data: { email, domain: '@lasalle.org.br' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in validate-email-domain:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req.headers.get("Origin")), 'Content-Type': 'application/json' },
      }
    );
  }
});