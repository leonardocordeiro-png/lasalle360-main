import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ChromebookBooking {
  class_name: string;
  quantity: number;
  booking_date: string;
  start_time: string;
  end_time: string;
}

interface RoomBooking {
  class_name: string;
  room_name: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  observations?: string;
}

interface ConsolidatedBookingRequest {
  chromebooks?: ChromebookBooking[];
  rooms?: RoomBooking[];
  userEmail: string;
  userName: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require JWT and match userEmail
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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

    const { chromebooks, rooms, userEmail, userName }: ConsolidatedBookingRequest = await req.json();
    if (!userEmail || authUser.user.email !== userEmail) {
      return new Response(JSON.stringify({ error: "Forbidden: userEmail mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Processing consolidated booking email for:", userEmail);
    console.log("Chromebooks:", chromebooks?.length || 0);
    console.log("Rooms:", rooms?.length || 0);

    let emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .section { background: #f9f9f9; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
            .chromebook-title { color: #2563eb; }
            .room-title { color: #059669; }
            .booking-item { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #667eea; }
            .booking-detail { margin: 5px 0; }
            .label { font-weight: bold; color: #555; }
            .reminder { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .reminder-title { color: #856404; font-weight: bold; margin-bottom: 10px; }
            .reminder-list { margin: 10px 0 0 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Agendamento(s) Confirmado(s)</h1>
              <p>Sistema de Agendamentos La Salle</p>
            </div>
            
            <div style="padding: 20px; background: white;">
              <p>Olá, <strong>${userName}</strong>!</p>
              <p>Seus agendamentos foram confirmados com sucesso!</p>
    `;

    // Chromebooks Section
    if (chromebooks && chromebooks.length > 0) {
      const groupedByDate = chromebooks.reduce((acc, booking) => {
        if (!acc[booking.booking_date]) {
          acc[booking.booking_date] = [];
        }
        acc[booking.booking_date].push(booking);
        return acc;
      }, {} as Record<string, ChromebookBooking[]>);

      emailContent += `
        <div class="section">
          <div class="section-title chromebook-title">
            💻 CHROMEBOOKS (${chromebooks.length} agendamento${chromebooks.length > 1 ? 's' : ''})
          </div>
      `;

      Object.keys(groupedByDate).sort().forEach(date => {
        const bookings = groupedByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        bookings.forEach(booking => {
          const formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR');
          emailContent += `
            <div class="booking-item">
              <div class="booking-detail"><span class="label">Turma:</span> ${booking.class_name}</div>
              <div class="booking-detail"><span class="label">Quantidade:</span> ${booking.quantity} Chromebook${booking.quantity > 1 ? 's' : ''}</div>
              <div class="booking-detail"><span class="label">Data:</span> ${formattedDate}</div>
              <div class="booking-detail"><span class="label">Horário:</span> ${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}</div>
            </div>
          `;
        });
      });

      emailContent += `</div>`;
    }

    // Rooms Section
    if (rooms && rooms.length > 0) {
      const groupedByDate = rooms.reduce((acc, booking) => {
        if (!acc[booking.booking_date]) {
          acc[booking.booking_date] = [];
        }
        acc[booking.booking_date].push(booking);
        return acc;
      }, {} as Record<string, RoomBooking[]>);

      const roomTypeLabel = rooms[0].room_type === 'auditorio' ? 'AUDITÓRIO' : 'LABORATÓRIO';
      const roomIcon = rooms[0].room_type === 'auditorio' ? '🏫' : '🔬';

      emailContent += `
        <div class="section">
          <div class="section-title room-title">
            ${roomIcon} ${roomTypeLabel} (${rooms.length} agendamento${rooms.length > 1 ? 's' : ''})
          </div>
      `;

      Object.keys(groupedByDate).sort().forEach(date => {
        const bookings = groupedByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        bookings.forEach(booking => {
          const formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR');
          emailContent += `
            <div class="booking-item" style="border-left-color: #059669;">
              <div class="booking-detail"><span class="label">Turma:</span> ${booking.class_name}</div>
              <div class="booking-detail"><span class="label">Local:</span> ${booking.room_name}</div>
              <div class="booking-detail"><span class="label">Data:</span> ${formattedDate}</div>
              <div class="booking-detail"><span class="label">Horário:</span> ${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}</div>
              ${booking.observations ? `<div class="booking-detail"><span class="label">Observações:</span> ${booking.observations}</div>` : ''}
            </div>
          `;
        });
      });

      emailContent += `</div>`;
    }

    emailContent += `
              <div class="reminder">
                <div class="reminder-title">⚠️ LEMBRETES IMPORTANTES:</div>
                <ul class="reminder-list">
                  <li>Chegue no horário agendado</li>
                  <li>Verifique os equipamentos antes de sair</li>
                  ${chromebooks ? '<li>Retorne os Chromebooks no horário combinado</li>' : ''}
                  <li>Qualquer problema, entre em contato com o setor de TI/TE</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Este é um e-mail automático. Para dúvidas ou alterações, acesse o sistema de agendamentos.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const totalBookings = (chromebooks?.length || 0) + (rooms?.length || 0);
    const subject = totalBookings === 1 
      ? 'Confirmação de Agendamento - La Salle'
      : `Confirmação de ${totalBookings} Agendamentos - La Salle`;

    const emailResponse = await resend.emails.send({
      from: "Sistema de Agendamentos La Salle <onboarding@resend.dev>",
      to: [userEmail],
      subject: subject,
      html: emailContent,
    });

    console.log("Consolidated email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-consolidated-booking-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(req.headers.get("Origin")) },
      }
    );
  }
};

serve(handler);