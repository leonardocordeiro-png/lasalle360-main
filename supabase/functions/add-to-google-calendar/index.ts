import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GoogleCalendarRequest {
  bookings: Array<{
    id: string;
    class_name: string;
    quantity: number;
    booking_date: string;
    start_time: string;
    end_time: string;
    full_name: string;
  }>;
  userEmail: string;
  userName: string;
}

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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
};

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require valid Authorization: Bearer <JWT>
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { bookings, userEmail, userName }: GoogleCalendarRequest = await req.json();

    // Enforce least privilege: only allow creating calendar events for the authenticated user's email
    if (!userEmail || authUser.user.email !== userEmail) {
      return new Response(
        JSON.stringify({ error: "Forbidden: userEmail must match the authenticated user's email" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Google OAuth token from environment
    const googleAccessToken = Deno.env.get("GOOGLE_ACCESS_TOKEN");
    const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!googleAccessToken || !googleRefreshToken || !googleClientId || !googleClientSecret) {
      console.error("Missing Google OAuth credentials");
      return new Response(
        JSON.stringify({ 
          error: "Google Calendar integration not configured. Please contact administrator." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Function to refresh access token if needed
    const refreshAccessToken = async () => {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: googleRefreshToken,
          client_id: googleClientId,
          client_secret: googleClientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh Google access token");
      }

      const data = await response.json();
      return data.access_token;
    };

    // Create calendar events for each booking
    const calendarEvents = [];
    let accessToken = googleAccessToken;

    for (const booking of bookings) {
      const startDateTime = new Date(`${booking.booking_date}T${booking.start_time}:00`);
      const endDateTime = new Date(`${booking.booking_date}T${booking.end_time}:00`);

      const event = {
        summary: `📱 Agendamento Chromebooks - ${booking.class_name}`,
        description: `
Agendamento de Chromebooks confirmado!

🏫 Turma: ${booking.class_name}
📱 Quantidade: ${booking.quantity} Chromebooks
👤 Responsável: ${userName}
📧 Email: ${userEmail}

⚠️ Lembrete: Chegue no horário para retirar os equipamentos e retorne conforme combinado.

Sistema de Agendamentos - Colégio La Salle
        `.trim(),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        attendees: [
          {
            email: userEmail,
            displayName: userName,
          }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 }, // 30 minutes before
            { method: "email", minutes: 60 }, // 1 hour before
          ],
        },
        location: "Colégio La Salle - Setor de TI",
        colorId: "2", // Green color for confirmed events
      };

      try {
        let response = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );

        // If token expired, refresh and retry
        if (response.status === 401) {
          console.log("Access token expired, refreshing...");
          accessToken = await refreshAccessToken();
          
          response = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(event),
            }
          );
        }

        if (!response.ok) {
          const errorData = await response.text();
          console.error("Failed to create calendar event:", errorData);
          throw new Error(`Failed to create calendar event: ${response.status}`);
        }

        const eventData = await response.json();
        calendarEvents.push(eventData);
        console.log(`Calendar event created successfully for booking ${booking.id}`);

      } catch (eventError) {
        console.error(`Error creating calendar event for booking ${booking.id}:`, eventError);
        // Continue with other events even if one fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        events_created: calendarEvents.length,
        total_bookings: bookings.length,
        events: calendarEvents 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in add-to-google-calendar function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(req.headers.get("Origin")) },
      }
    );
  }
};

serve(handler);