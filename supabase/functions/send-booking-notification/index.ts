import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

interface BookingNotificationRequest {
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

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require valid JWT and match user email
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

    const { bookings, userEmail, userName }: BookingNotificationRequest = await req.json();
    if (!userEmail || authUser.user.email !== userEmail) {
      return new Response(JSON.stringify({ error: "Forbidden: userEmail mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format booking details for email
    const bookingDetails = bookings.map(booking => {
      const formattedDate = new Date(booking.booking_date).toLocaleDateString('pt-BR');
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; text-align: left;">${booking.class_name}</td>
          <td style="padding: 12px; text-align: center;">${booking.quantity}</td>
          <td style="padding: 12px; text-align: center;">${formattedDate}</td>
          <td style="padding: 12px; text-align: center;">${booking.start_time} - ${booking.end_time}</td>
        </tr>
      `;
    }).join('');

    const emailResponse = await resend.emails.send({
      from: "Sistema de Agendamentos <agendamentos@lasalle.org.br>",
      to: [userEmail],
      subject: "✅ Confirmação de Agendamento - Chromebooks",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmação de Agendamento</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Agendamento Confirmado!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Sistema de Agendamento de Chromebooks</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
            <h2 style="color: #2d3748; margin-bottom: 20px;">Olá, ${userName}!</h2>
            
            <p style="margin-bottom: 20px; font-size: 16px;">
              Seu agendamento de Chromebooks foi <strong>confirmado com sucesso</strong>! 
              Abaixo estão os detalhes dos seus agendamentos:
            </p>

            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 18px;">📋 Detalhes dos Agendamentos</h3>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #edf2f7;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e0;">Turma</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e0;">Qtd.</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e0;">Data</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #cbd5e0;">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  ${bookingDetails}
                </tbody>
              </table>
            </div>

            <div style="background: #e6fffa; border-left: 4px solid #38b2ac; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="color: #2c7a7b; margin: 0 0 10px 0;">📅 Lembrete Importante</h4>
              <p style="margin: 0; color: #2c7a7b;">
                Os eventos também foram automaticamente adicionados ao seu Google Calendar para que você não esqueça!
              </p>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ Importante</h4>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li>Chegue no horário agendado para retirar os equipamentos</li>
                <li>Verifique se todos os Chromebooks estão funcionando antes de sair</li>
                <li>Retorne os equipamentos no horário combinado</li>
                <li>Em caso de problemas, entre em contato conosco imediatamente</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 14px; margin: 0;">
                Este é um email automático. Em caso de dúvidas, entre em contato com a administração.
              </p>
              <p style="color: #718096; font-size: 12px; margin: 10px 0 0 0;">
                Sistema de Agendamentos - Colégio La Salle
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-booking-notification function:", error);
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