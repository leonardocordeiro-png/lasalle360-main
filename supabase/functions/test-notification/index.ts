import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Criar notificação de teste
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No authenticated user" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Inserir notificação de teste
    const { data: notification, error } = await supabase
      .from('approval_notifications')
      .insert({
        approver_id: user.id,
        booking_id: 'test-booking-id',
        requester_name: 'Test User',
        room_name: 'Auditório Test',
        time_slots: '08:00 - 09:00',
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating test notification:', error);
      return new Response(JSON.stringify({ error: "Failed to create test notification", details: error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Test notification created:", notification);

    return new Response(JSON.stringify({ 
      success: true, 
      notificationId: notification.id,
      message: "Test notification created successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in test notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
