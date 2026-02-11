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
  user_id: string;
}

interface ApprovalResultPayload {
  bookings: Booking[];
  userName: string;
  roomName: string;
  action: 'approved' | 'rejected' | 'expired';
  approverName?: string;
  rejectReason?: string | null;
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
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { bookings, userName, roomName, action, approverName, rejectReason }: ApprovalResultPayload = await req.json();

    console.log("Processing approval result email for:", userName);
    console.log("Action:", action);

    // Get user email from the booking
    const userId = bookings[0]?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No user ID found' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const userEmail = authUsers?.users?.find(u => u.id === userId)?.email;

    if (!userEmail) {
      console.log('User email not found for:', userId);
      return new Response(JSON.stringify({ message: 'User email not found' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format booking details
    const firstBooking = bookings[0];
    const formattedDate = new Date(firstBooking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR');

    const timeSlots = bookings
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(b => `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`)
      .join(', ');

    const isApproved = action === 'approved';
    const isExpired = action === 'expired';

    const statusColor = isApproved ? '#22c55e' : '#ef4444';
    const statusText = isApproved ? 'APROVADA' : isExpired ? 'EXPIRADA' : 'REJEITADA';
    const statusEmoji = isApproved ? '✅' : '❌';
    const headerGradient = isApproved 
      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

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
            background: linear-gradient(135deg, ${headerGradient});
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
          
          .status-badge {
            display: inline-block;
            background: ${statusColor};
            color: white;
            padding: 8px 16px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
            margin: 0 5px;
          }
          
          .details-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
            border-left: 4px solid ${statusColor};
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
          
          .reminder-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-radius: 15px;
            padding: 20px;
            margin: 30px 0;
            border-left: 4px solid #22c55e;
            box-shadow: 0 5px 15px rgba(34,197,94,0.1);
          }
          
          .reminder-card h4 {
            color: #166534;
            font-size: 16px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .reminder-card ul {
            color: #166534;
            font-size: 14px;
            margin: 0;
            padding-left: 20px;
          }
          
          .reminder-card li {
            margin: 8px 0;
          }
          
          .reason-box {
            background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
            border-radius: 15px;
            padding: 20px;
            margin: 30px 0;
            border-left: 4px solid #ef4444;
            box-shadow: 0 5px 15px rgba(239,68,68,0.1);
          }
          
          .reason-box strong {
            color: #991b1b;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }
          
          .reason-box p {
            color: #991b1b;
            font-size: 14px;
            margin: 0;
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
            <h1>${statusEmoji} Reserva ${statusText}</h1>
            <div class="subtitle">${roomName}</div>
          </div>
          
          <div class="content">
            <p class="greeting">Olá, <strong>${userName}</strong>!</p>
            
            <p class="message">
              ${isApproved ? `
                Sua solicitação de reserva do <strong>${roomName}</strong> foi <span class="status-badge">APROVADA</span>! 🎉
                <br><br>
                Você já pode utilizar o espaço conforme agendado.
              ` : isExpired ? `
                Sua solicitação de reserva do <strong>${roomName}</strong> <span class="status-badge">EXPIROU</span>.
                <br><br>
                O prazo de 48 horas para aprovação foi excedido e o horário foi liberado.
                <br>
                Por favor, faça uma nova solicitação se ainda precisar do espaço.
              ` : `
                Infelizmente, sua solicitação de reserva do <strong>${roomName}</strong> foi <span class="status-badge">REJEITADA</span>.
              `}
            </p>

            <div class="details-card">
              <h3>
                <span class="icon">📋</span>
                Detalhes da Reserva
              </h3>
              <div class="detail-row">
                <span class="detail-label">Turma:</span>
                <span class="detail-value">${firstBooking.class_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário(s):</span>
                <span class="detail-value">${timeSlots}</span>
              </div>
              ${approverName && !isExpired ? `
              <div class="detail-row">
                <span class="detail-label">${isApproved ? 'Aprovado por:' : 'Rejeitado por:'}</span>
                <span class="detail-value">${approverName}</span>
              </div>
              ` : ''}
            </div>
            
            ${rejectReason ? `
            <div class="reason-box">
              <strong>
                <span class="icon">❌</span>
                Motivo da rejeição
              </strong>
              <p>${rejectReason}</p>
            </div>
            ` : ''}
            
            ${isApproved ? `
            <div class="reminder-card">
              <h4>
                <span class="icon">📌</span>
                Lembretes importantes
              </h4>
              <ul>
                <li>Chegue no horário agendado</li>
                <li>Verifique os equipamentos antes de sair</li>
                <li>Qualquer problema, entre em contato com o setor responsável</li>
              </ul>
            </div>
            ` : ''}
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
Reserva ${statusText} - ${roomName}

Olá, ${userName}!

${isApproved ? 
  `Sua solicitação de reserva do ${roomName} foi APROVADA!
Você já pode utilizar o espaço conforme agendado.` : 
  isExpired ?
  `Sua solicitação de reserva do ${roomName} EXPIROU.
O prazo de 48 horas para aprovação foi excedido e o horário foi liberado.
Por favor, faça uma nova solicitação se ainda precisar do espaço.` :
  `Infelizmente, sua solicitação de reserva do ${roomName} foi REJEITADA.`
}

📋 Detalhes da Reserva:
Turma: ${firstBooking.class_name}
Data: ${formattedDate}
Horário(s): ${timeSlots}
${approverName && !isExpired ? `${isApproved ? 'Aprovado por:' : 'Rejeitado por:'} ${approverName}` : ''}

${rejectReason ? `❌ Motivo da rejeição:\n${rejectReason}` : ''}

${isApproved ? `📌 Lembretes:
- Chegue no horário agendado
- Verifique os equipamentos antes de sair
- Qualquer problema, entre em contato com o setor responsável` : ''}

---
Este é um e-mail automático do Sistema La Salle 360.
    `.trim();

    const subject = isApproved 
      ? `✅ Reserva Aprovada: ${roomName} - ${formattedDate}`
      : isExpired
      ? `❌ Reserva Expirada: ${roomName} - ${formattedDate}`
      : `❌ Reserva Rejeitada: ${roomName} - ${formattedDate}`;

    await sendGmailEmail([userEmail], subject, emailHtml, textContent);

    console.log(`Result email sent to: ${userEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-approval-result-email-gmail:", error);
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
