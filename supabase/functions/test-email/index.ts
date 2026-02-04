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
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Sistema de Agendamentos La Salle",
          email: "noreply@brevo.com",
        },
        to: [{ 
          email: "leonardo.cordeiro@lasalle.org.br",
          name: "Leonardo"
        }],
        subject: "[TESTE] Sistema La Salle 360 - Teste de E-mail",
        htmlContent: `
          <h2>Teste de E-mail - La Salle 360</h2>
          <p>Este é um e-mail de teste para verificar se a entrega está funcionando.</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Status:</strong> ✅ Funcionando</p>
          <hr>
          <p><small>Sistema de Agendamentos La Salle</small></p>
        `,
        textContent: "Teste de E-mail - La Salle 360\n\nEste é um e-mail de teste para verificar se a entrega está funcionando.",
      }),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.text();
      return new Response(JSON.stringify({ error: "Failed to send test email", details: errorData }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await brevoResponse.json();
    console.log("Test email sent successfully:", result);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: result.messageId,
      message: "Test email sent to leonardo.cordeiro@lasalle.org.br"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in test email:", error);
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
