import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GMAIL_CLIENT_ID = "GOOGLE_CLIENT_ID_REMOVED";
const GMAIL_CLIENT_SECRET = "GOOGLE_CLIENT_SECRET_REMOVED";
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
const GMAIL_USER = "leonardo.cordeiro@lasalle.org.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar se o refresh token está configurado
    if (!GMAIL_REFRESH_TOKEN) {
      return new Response(JSON.stringify({ 
        error: "GMAIL_REFRESH_TOKEN não configurado",
        setup: "Use a função get-gmail-refresh-token para obter o token",
        url: "https://bacqgdjiarwkgkwiqgpa.supabase.co/functions/v1/get-gmail-refresh-token"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Testar obtenção de access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: "Falha ao obter access token",
        details: tokenData
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Criar e-mail de teste
    const boundary = "boundary_" + Date.now();
    const emailMessage = [
      `To: ${GMAIL_USER}`,
      `From: ${GMAIL_USER}`,
      `Subject: 🧪 Teste - Sistema La Salle 360 Gmail API`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `Teste de e-mail - Sistema La Salle 360

Este é um e-mail de teste para verificar se a integração com Gmail API está funcionando corretamente.

Se você recebeu este e-mail, a configuração está OK!

Data: ${new Date().toLocaleString('pt-BR')}
Sistema: La Salle 360
Função: Gmail API Integration Test`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; padding: 20px; border-radius: 5px;">
    <h2 style="color: #28a745; margin-bottom: 20px;">🧪 Teste de E-mail - La Salle 360</h2>
    
    <p>Este é um e-mail de teste para verificar se a integração com Gmail API está funcionando corretamente.</p>
    
    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="color: #155724; margin: 0 0 10px 0;">✅ Sucesso!</h3>
      <p style="margin: 0;">Se você recebeu este e-mail, a configuração da Gmail API está funcionando perfeitamente!</p>
    </div>
    
    <div style="background-color: #ffffff; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
      <h3 style="color: #2d3748; margin-bottom: 15px;">Detalhes do Teste:</h3>
      <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
      <p><strong>Sistema:</strong> La Salle 360</p>
      <p><strong>Função:</strong> Gmail API Integration Test</p>
      <p><strong>Status:</strong> <span style="color: #28a745;">✅ Funcionando</span></p>
    </div>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
    
    <p style="color: #666; font-size: 14px; margin: 0;">
      Este é um e-mail automático de teste do Sistema La Salle 360.<br>
      A integração com Gmail API está pronta para uso!
    </p>
  </div>
</body>
</html>`,
      ``,
      `--${boundary}--`,
    ].join("\n");

    // Codificar mensagem
    const encodedMessage = btoa(unescape(encodeURIComponent(emailMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Enviar e-mail
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
      return new Response(JSON.stringify({ 
        error: "Falha ao enviar e-mail",
        details: errorData
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = await sendResponse.json();

    return new Response(JSON.stringify({ 
      success: true,
      message: "E-mail de teste enviado com sucesso!",
      messageId: result.id,
      recipient: GMAIL_USER,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in test Gmail email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
