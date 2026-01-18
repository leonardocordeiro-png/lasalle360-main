import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { signInSchema, type SignInFormData } from '@/lib/validationSchemas';
import { logSecurityEvent, checkRateLimit } from '@/lib/securityUtils';
import lasalleReal from '@/assets/Lasalle_real.png';

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' }
  });

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (data: SignInFormData) => {
    const rateKey = `login:${data.email}`;
    if (!checkRateLimit(rateKey, 5, 300000)) {
      toast({ variant: "destructive", title: "Muitas tentativas", description: "Aguarde alguns minutos antes de tentar novamente." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (!error) {
        await logSecurityEvent('user_login_success', 'auth', data.email);
        navigate('/');
      } else {
        await logSecurityEvent('user_login_failed', 'auth', data.email);
      }
    } catch (error) {
      await logSecurityEvent('user_login_error', 'auth', data.email);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (!error) {
        await logSecurityEvent('user_google_login_success', 'auth');
      } else {
        await logSecurityEvent('user_google_login_failed', 'auth');
      }
    } catch (error) {
      await logSecurityEvent('user_google_login_error', 'auth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex h-[600px] w-full max-w-5xl rounded-2xl overflow-hidden border bg-card">
        {/* Coluna da imagem (desktop) */}
        <div className="w-1/2 hidden md:block">
          <img
            className="h-full w-full object-cover"
            src={lasalleReal}
            alt="La Salle"
          />
        </div>

        {/* Coluna do formulário */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
          <div className="md:w-96 w-80 flex flex-col items-center justify-center">
            {/* Título do aplicativo */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">LaSalle 360</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gestão completa, olhar Lasallista.</p>

            <p className="text-sm text-muted-foreground mt-3 text-center">Bem-vindo de volta!</p>

            {/* Google */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mt-8 bg-gray-500/10 hover:bg-gray-500/20 text-foreground h-12 rounded-full"
              variant="ghost"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <img
                  src="https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/login/googleLogo.svg"
                  alt="googleLogo"
                  className="h-6 w-6 md:h-7 md:w-7"
                />
              )}
              <span className="ml-2">Entrar com Google</span>
            </Button>

            {/* Divisor */}
            <div className="flex items-center gap-4 w-full my-5">
              <div className="w-full h-px bg-gray-300/90 dark:bg-gray-700" />
              <p className="w-full text-nowrap text-sm text-muted-foreground text-center">
                ou entre com e-mail
              </p>
              <div className="w-full h-px bg-gray-300/90 dark:bg-gray-700" />
            </div>

            {/* Formulário de Login */}
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(handleLogin)} className="w-full">
                <FormField
                  control={signInForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="sr-only">E-mail</FormLabel>
                      <FormControl>
                        <div className="flex items-center w-full bg-transparent border border-gray-300/60 h-12 rounded-full overflow-hidden pl-6 gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="seu.nome@lasalle.org.br"
                            className="bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm w-full h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="w-full mt-6">
                      <FormLabel className="sr-only">Senha</FormLabel>
                      <FormControl>
                        <div className="flex items-center w-full bg-transparent border border-gray-300/60 h-12 rounded-full overflow-hidden pl-6 gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Senha"
                            className="bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm w-full h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="w-full flex items-center justify-between mt-8 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <input className="h-5 w-5" type="checkbox" id="rememberMe" />
                    <label className="text-sm" htmlFor="rememberMe">Lembrar de mim</label>
                  </div>
                  <a className="text-sm underline" href="#">Esqueceu a senha?</a>
                </div>

                <Button
                  type="submit"
                  className="mt-8 w-full h-11 rounded-full text-white bg-indigo-500 hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Entrando...' : 'Login'}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Apenas e-mails @lasalle.org.br são permitidos.
                  <br />
                  Entre em contato com o administrador para criar uma conta.
                </p>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}