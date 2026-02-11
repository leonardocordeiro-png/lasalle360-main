import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GMAIL_CLIENT_ID = "GOOGLE_CLIENT_ID_REMOVED";
const GMAIL_CLIENT_SECRET = "GOOGLE_CLIENT_SECRET_REMOVED";
const REDIRECT_URI = "http://localhost:3000/oauth/callback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle OAuth callback
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`
        <html>
          <body>
            <h1>Erro na Autenticação</h1>
            <p>Erro: ${error}</p>
            <p>Feche esta janela e tente novamente.</p>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code) {
      return new Response("Código não encontrado", { status: 400 });
    }

    try {
      // Trocar code por refresh token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GMAIL_CLIENT_ID,
          client_secret: GMAIL_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      const refreshToken = tokenData.refresh_token;

      if (!refreshToken) {
        return new Response(`
          <html>
            <body>
              <h1>Refresh Token não obtido</h1>
              <p>Por favor, certifique-se de que você incluiu "access_type=offline" e "prompt=consent" na URL de autorização.</p>
              <p>Refresh Token obtido: ${JSON.stringify(tokenData, null, 2)}</p>
            </body>
          </html>
        `, {
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #28a745;">✅ Autenticação Concluída!</h1>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h2>Próximos Passos:</h2>
              <ol>
                <li>Copie o Refresh Token abaixo:</li>
                <li>Vá para o painel do Supabase</li>
                <li>Settings → Edge Functions</li>
                <li>Adicione a variável de ambiente: <strong>GMAIL_REFRESH_TOKEN</strong></li>
                <li>Cole o valor copiado</li>
              </ol>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px;">
              <h3>🔑 Refresh Token (copie este valor):</h3>
              <textarea readonly style="width: 100%; height: 80px; font-family: monospace; padding: 10px; border: 1px solid #ddd; border-radius: 3px;">${refreshToken}</textarea>
              <button onclick="navigator.clipboard.writeText('${refreshToken}')" style="background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; margin-top: 10px;">📋 Copiar Token</button>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <h3>✅ Importante:</h3>
              <ul>
                <li>Guarde este token em local seguro</li>
                <li>Não compartilhe com ninguém</li>
                <li>O token não expira, mas pode ser revogado</li>
                <li>Após configurar, a função de e-mail estará pronta</li>
              </ul>
            </div>
            
            <script>
              // Auto-select text when clicking
              document.querySelector('textarea').addEventListener('click', function() {
                this.select();
              });
            </script>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" },
      });

    } catch (error: any) {
      return new Response(`
        <html>
          <body>
            <h1>Erro ao obter token</h1>
            <p>Erro: ${error.message}</p>
            <p>Feche esta janela e tente novamente.</p>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" },
      });
    }
  }

  // Mostrar página de autorização
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GMAIL_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=https://www.googleapis.com/auth/gmail.send&` +
    `access_type=offline&` +
    `prompt=consent`;

  return new Response(`
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h1>🔧 Configurar Gmail API - La Salle 360</h1>
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>📧 Para obter o Refresh Token:</h2>
          <ol>
            <li>Clique no botão abaixo</li>
            <li>Faça login com: <strong>leonardo.cordeiro@lasalle.org.br</strong></li>
            <li>Permita o acesso ao Gmail</li>
            <li>Copie o Refresh Token gerado</li>
            <li>Configure no Supabase</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${authUrl}" 
             style="display: inline-block; background-color: #4285f4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
            🔐 Autorizar Acesso ao Gmail
          </a>
        </div>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px;">
          <h3>⚠️ Importante:</h3>
          <ul>
            <li>Use apenas o e-mail: <strong>leonardo.cordeiro@lasalle.org.br</strong></li>
            <li>Esta autorização é necessária apenas uma vez</li>
            <li>O token permite enviar e-mails em nome do sistema</li>
            <li>Guarde o token em local seguro</li>
          </ul>
        </div>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" },
  });
};

serve(handler);
