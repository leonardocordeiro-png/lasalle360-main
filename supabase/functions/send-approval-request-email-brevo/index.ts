import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "leonardo.cordeiro@lasalle.org.br";
const SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Sistema de Agendamentos La Salle";

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

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
}

interface ApprovalRequest {
  bookings: Booking[];
  userName: string;
  userEmail: string;
  roomName: string;
  resources?: string[];
  observations?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookings, userName, userEmail, roomName, resources, observations }: ApprovalRequest = await req.json();

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "No bookings provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active approvers
    const { data: approvers, error: approversError } = await supabase
      .from("room_booking_approvers")
      .select("user_id, is_active")
      .eq("is_active", true);

    if (approversError) {
      console.error("Error fetching approvers:", approversError);
      return new Response(JSON.stringify({ error: "Failed to fetch approvers" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!approvers || approvers.length === 0) {
      console.log("No active approvers found");
      return new Response(JSON.stringify({ message: "No approvers to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get approver emails from profiles
    const approverUserIds = approvers.map(a => a.user_id);
    const { data: approverProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("user_id", approverUserIds);

    if (profilesError) {
      console.error("Error fetching approver profiles:", profilesError);
    }

    const approverEmails = approverProfiles?.map(p => p.email).filter(Boolean) || [];

    if (approverEmails.length === 0) {
      console.log("No approver emails found");
      return new Response(JSON.stringify({ message: "No approver emails found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format booking details
    const firstBooking = bookings[0];
    const formattedDate = new Date(firstBooking.booking_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const timeSlots = bookings.map(b => `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`).join(', ');
    const resourcesText = resources && resources.length > 0 
      ? `<p style="margin: 8px 0;"><strong>Recursos solicitados:</strong> ${resources.join(', ')}</p>` 
      : '';
    const observationsText = observations 
      ? `<p style="margin: 8px 0;"><strong>Observações:</strong> ${observations}</p>` 
      : '';

    // Versão texto plano para clientes de e-mail que não suportam HTML
    const textContent = `
Nova Solicitação de Reserva - ${roomName}

Olá!

${userName} solicitou uma reserva do ${roomName} e está aguardando sua aprovação.

DETALHES DA SOLICITAÇÃO:
Solicitante: ${userName}
E-mail: ${userEmail}
Turma: ${firstBooking.class_name}
Data: ${formattedDate}
Horários: ${timeSlots}
${resources ? `Recursos: ${resources.join(', ')}` : ''}
${observations ? `Observações: ${observations}` : ''}

PRAZO DE APROVAÇÃO:
Por favor, aprova ou rejeite esta solicitação em até 48 horas.

ACESSE O SISTEMA:
https://lasalle360.vercel.app

---
Este é um e-mail automático do Sistema de Agendamentos La Salle.
Por favor, não responda a este e-mail.
    `.trim();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nova Solicitação de Aprovação</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Lista de desinscrição para evitar spam -->
        <div style="display:none;max-height:0px;overflow:hidden;">
          Sistema de Agendamentos La Salle - Notificação automática de aprovação
          Nova solicitação de reserva ${roomName} aguardando aprovação
          ${userName} ${userEmail} ${firstBooking.class_name} ${formattedDate}
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Nova Solicitação de Reserva</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 14px;">Aguardando sua aprovação</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <p style="margin-bottom: 20px;">Olá!</p>
          
          <p style="margin-bottom: 20px;">
            <strong>${userName}</strong> solicitou uma reserva do <strong>${roomName}</strong> e está aguardando sua aprovação.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 18px;">📋 Detalhes da Solicitação</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>Solicitante:</strong></td>
                <td style="padding: 8px 0;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>E-mail:</strong></td>
                <td style="padding: 8px 0;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Turma:</strong></td>
                <td style="padding: 8px 0;">${firstBooking.class_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Data:</strong></td>
                <td style="padding: 8px 0;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Horários:</strong></td>
                <td style="padding: 8px 0;">${timeSlots}</td>
              </tr>
            </table>
            
            ${resourcesText}
            ${observationsText}
          </div>

          <div style="background: #e6fffa; border-left: 4px solid #38b2ac; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="color: #2c7a7b; margin: 0 0 10px 0;">⏰ Prazo de Aprovação</h4>
            <p style="margin: 0; color: #2c7a7b;">
              Por favor, aprove ou rejeite esta solicitação em até 48 horas.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://lasalle360.vercel.app" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Acessar Sistema de Aprovações
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Este é um e-mail automático do Sistema de Agendamentos La Salle.
            </p>
            <p style="color: #718096; font-size: 12px; margin: 10px 0 0 0;">
              Por favor, não responda a este e-mail.
            </p>
            <p style="color: #718096; font-size: 10px; margin: 5px 0 0 0;">
              <a href="https://lasalle360.vercel.app" style="color: #718096;">Sistema de Agendamentos La Salle</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Brevo API com melhorias anti-spam
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: approverEmails.map(email => ({ 
          email,
          name: email.split('@')[0] // Nome personalizado do destinatário
        })),
        subject: `[La Salle 360] Nova solicitação de reserva - ${roomName}`,
        htmlContent: emailHtml,
        textContent: textContent, // Adiciona versão texto
        headers: {
          "X-Mailer": "La Salle 360 Sistema de Agendamentos",
          "X-Priority": "3", // Prioridade normal
          "Reply-To": SENDER_EMAIL,
        },
        // Tags para melhor rastreamento
        tags: ["agendamento", "aprovacao", roomName.toLowerCase().replace(/\s+/g, '-')],
      }),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.text();
      console.error("Brevo API error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to send email via Brevo", details: errorData }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const brevoData = await brevoResponse.json();
    console.log("Email sent successfully via Brevo:", brevoData);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: brevoData.messageId,
      recipients: approverEmails.length 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-approval-request-email-brevo:", error);
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
