import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações
const GMAIL_CLIENT_ID = "GOOGLE_CLIENT_ID_REMOVED";
const GMAIL_CLIENT_SECRET = "GOOGLE_CLIENT_SECRET_REMOVED";
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
const GMAIL_USER = "leonardo.cordeiro@lasalle.org.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Função para enviar e-mail via Gmail API
async function sendGmailEmail(to: string[], subject: string, htmlContent: string, textContent: string) {
  try {
    // 1. Obter access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to get access token");
    }

    // 2. Criar mensagem MIME
    const boundary = "boundary_" + Date.now();
    const emailMessage = [
      `To: ${to.join(", ")}`,
      `From: ${GMAIL_USER}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textContent,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
    ].join("\n");

    // 3. Codificar mensagem em base64url
    const encodedMessage = btoa(unescape(encodeURIComponent(emailMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 4. Enviar e-mail via Gmail API
    const sendResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    });

    if (!sendResponse.ok) {
      const errorData = await sendResponse.text();
      throw new Error(`Gmail API error: ${errorData}`);
    }

    const result = await sendResponse.json();
    return result;
  } catch (error) {
    console.error("Error sending Gmail email:", error);
    throw error;
  }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

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

    // Buscar aprovadores de ambas as fontes: room_booking_approvers e user_permissions
    const { data: roomApprovers, error: roomApproversError } = await supabase
      .from("room_booking_approvers")
      .select("user_id")
      .eq("is_active", true);

    const { data: permissionApprovers, error: permissionApproversError } = await supabase
      .from("user_permissions")
      .select("user_id")
      .eq("module_name", "auditorio")
      .eq("can_access", true);

    // Combinar e remover duplicados
    const allApproverIds = new Set();
    
    if (roomApprovers && !roomApproversError) {
      roomApprovers.forEach((a: any) => allApproverIds.add(a.user_id));
    }
    
    if (permissionApprovers && !permissionApproversError) {
      permissionApprovers.forEach((a: any) => allApproverIds.add(a.user_id));
    }

    if (allApproverIds.size === 0) {
      return new Response(JSON.stringify({ error: "No approvers found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Buscar e-mails dos aprovadores
    const approverUserIds = Array.from(allApproverIds) as string[];
    const { data: approverProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("user_id", approverUserIds);

    const approverEmails = approverProfiles?.map((p: any) => p.email).filter(Boolean) || [];

    if (approverEmails.length === 0) {
      return new Response(JSON.stringify({ error: "No approver emails found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Formatar detalhes da reserva
    const firstBooking = bookings[0];
    const formattedDate = new Date(firstBooking.booking_date).toLocaleDateString('pt-BR');
    const timeSlots = bookings.map((b: any) => `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`).join(', ');

    // Criar HTML do e-mail
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #f8f9fa;
            padding: 20px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          
          .header {
            padding: 40px 30px;
            text-align: center;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
          }
          
          .header h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          
          .header .subtitle {
            color: rgba(255,255,255,0.9);
            font-size: 16px;
            font-weight: 300;
          }
          
          .content {
            padding: 40px 30px;
            background: white;
          }
          
          .greeting {
            font-size: 18px;
            color: #2c3e50;
            margin-bottom: 20px;
          }
          
          .message {
            font-size: 16px;
            color: #5a6c7d;
            margin-bottom: 30px;
            line-height: 1.7;
          }
          
          .details-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
            border-left: 4px solid #667eea;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
          }
          
          .details-card h3 {
            color: #2c3e50;
            font-size: 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0,0,0,0.05);
          }
          
          .detail-row:last-child {
            border-bottom: none;
          }
          
          .detail-label {
            font-weight: 600;
            color: #5a6c7d;
            font-size: 14px;
          }
          
          .detail-value {
            font-weight: 500;
            color: #2c3e50;
            font-size: 14px;
            text-align: right;
          }
          
          .deadline-card {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border-radius: 15px;
            padding: 20px;
            margin: 30px 0;
            border-left: 4px solid #f39c12;
            box-shadow: 0 5px 15px rgba(243,156,18,0.1);
          }
          
          .deadline-card h4 {
            color: #856404;
            font-size: 16px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .deadline-card p {
            color: #856404;
            font-size: 14px;
            margin: 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 15px 30px;
            text-decoration: none !important;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 30px 0;
            box-shadow: 0 10px 25px rgba(102,126,234,0.3);
            transition: all 0.3s ease;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(102,126,234,0.4);
            color: white !important;
            text-decoration: none !important;
          }
          
          .footer {
            padding: 30px;
            text-align: center;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }
          
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 5px 0;
          }
          
          .icon {
            width: 20px;
            height: 20px;
            display: inline-block;
          }
          
          @media (max-width: 600px) {
            .container {
              margin: 10px;
              border-radius: 15px;
            }
            
            .header, .content {
              padding: 30px 20px;
            }
            
            .detail-row {
              flex-direction: column;
              gap: 5px;
            }
            
            .detail-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏛️ Nova Solicitação de Reserva</h1>
            <div class="subtitle">Auditório La Salle</div>
          </div>
          
          <div class="content">
            <p class="greeting">Olá, aprovador!</p>
            
            <p class="message">
              <strong>${userName}</strong> solicitou uma reserva do <strong>Auditório</strong> e está aguardando sua aprovação. Por favor, revise os detalhes abaixo e tome uma decisão.
            </p>

            <div class="details-card">
              <h3>
                <span class="icon">📋</span>
                Detalhes da Solicitação
              </h3>
              <div class="detail-row">
                <span class="detail-label">Solicitante:</span>
                <span class="detail-value">${userName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${userEmail}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Turma:</span>
                <span class="detail-value">${firstBooking.class_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horários:</span>
                <span class="detail-value">${timeSlots}</span>
              </div>
              ${resources && resources.length > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Recursos:</span>
                <span class="detail-value">${resources.map(r => r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ')).join(', ')}</span>
              </div>
              ` : ''}
              ${observations ? `
              <div class="detail-row">
                <span class="detail-label">Observações:</span>
                <span class="detail-value">${observations}</span>
              </div>
              ` : ''}
            </div>

            <div class="deadline-card">
              <h4>
                <span class="icon">⏰</span>
                Prazo de Aprovação
              </h4>
              <p>Por favor, aprova ou rejeite esta solicitação em até 48 horas.</p>
            </div>

            <div style="text-align: center;">
              <a href="https://lasalle360.vercel.app/" class="cta-button">
                🚀 Acessar Sistema
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Este é um e-mail automático do Sistema La Salle 360</p>
            <p>Por favor, não responda a este e-mail</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
https://lasalle360.vercel.app/

---
Este é um e-mail automático do Sistema de Agendamentos La Salle.
Por favor, não responda a este e-mail.
    `.trim();

    // Enviar e-mails para todos os aprovadores
    const results = [];
    for (const email of approverEmails) {
      try {
        const result = await sendGmailEmail([email], `La Salle 360 - Nova Solicitacao de Reserva - Auditorio`, emailHtml, textContent);
        results.push({ email, success: true, messageId: result.id });
      } catch (error: any) {
        results.push({ email, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in Gmail email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
