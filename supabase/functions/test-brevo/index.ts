import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = "BREVO_API_KEY_REMOVED";

const handler = async (req: Request): Promise<Response> => {
  try {
    // Teste direto da API Brevo
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Teste de E-mail - La Salle 360</h1>
        <p>Este é um teste de integração com Brevo.</p>
        <p>Se você recebeu este e-mail, a integração está funcionando!</p>
      </body>
      </html>
    `;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Sistema de Agendamentos La Salle",
          email: "leonardo.cordeiro@lasalle.org.br",
        },
        to: [{ email: "leonardo.cordeiro@lasalle.org.br" }],
        subject: "🧪 Teste - Integração Brevo La Salle 360",
        htmlContent: emailHtml,
      }),
    });

    const responseText = await brevoResponse.text();
    
    return new Response(JSON.stringify({ 
      status: brevoResponse.status,
      ok: brevoResponse.ok,
      response: responseText
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
