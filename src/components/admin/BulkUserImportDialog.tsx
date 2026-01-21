import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUsersCreated: () => void;
}

interface UserRow {
  fullName: string;
  emailPrefix: string;
  password: string;
  rowNumber: number;
}

interface ImportResult {
  success: boolean;
  email: string;
  fullName: string;
  error?: string;
}

export function BulkUserImportDialog({ open, onOpenChange, onUsersCreated }: BulkUserImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<UserRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csvContent = `nome_completo,email_prefixo,senha
João Silva,joao.silva,Senha@123
Maria Santos,maria.santos,Senha@456
Pedro Oliveira,pedro.oliveira,Senha@789`;

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_usuarios_lasalle.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado!",
      description: "Preencha a planilha CSV com os dados dos usuários e faça o upload.",
    });
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    return true;
  };

  const validateEmailPrefix = (prefix: string): boolean => {
    return /^[a-zA-Z0-9._-]+$/.test(prefix) && prefix.length >= 3;
  };

  const parseCSV = (content: string): UserRow[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const users: UserRow[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV with possible quoted fields
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      
      if (parts.length >= 3) {
        users.push({
          fullName: parts[0],
          emailPrefix: parts[1],
          password: parts[2],
          rowNumber: i + 1,
        });
      }
    }
    
    return users;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const content = await file.text();
      const users = parseCSV(content);
      
      if (users.length === 0) {
        toast({
          variant: "destructive",
          title: "Arquivo vazio",
          description: "O arquivo não contém dados de usuários válidos.",
        });
        return;
      }

      // Validate users
      const validatedUsers = users.map(user => {
        const errors: string[] = [];
        
        if (!user.fullName || user.fullName.length < 3) {
          errors.push('Nome inválido');
        }
        if (!validateEmailPrefix(user.emailPrefix)) {
          errors.push('Email inválido');
        }
        if (!validatePassword(user.password)) {
          errors.push('Senha fraca');
        }
        
        return { ...user, errors };
      });

      const hasErrors = validatedUsers.some((u: any) => u.errors?.length > 0);
      
      if (hasErrors) {
        const errorUsers = validatedUsers.filter((u: any) => u.errors?.length > 0);
        toast({
          variant: "destructive",
          title: "Erros encontrados",
          description: `${errorUsers.length} usuário(s) com dados inválidos. Verifique o arquivo.`,
        });
      }

      setParsedUsers(users);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        variant: "destructive",
        title: "Erro ao ler arquivo",
        description: "Não foi possível processar o arquivo. Verifique o formato.",
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startImport = async () => {
    setImporting(true);
    setStep('importing');
    setProgress(0);
    setImportResults([]);

    const results: ImportResult[] = [];
    const total = parsedUsers.length;

    for (let i = 0; i < parsedUsers.length; i++) {
      const user = parsedUsers[i];
      const email = `${user.emailPrefix}@lasalle.org.br`;

      try {
        // Validate before sending
        if (!user.fullName || user.fullName.length < 3) {
          throw new Error('Nome deve ter pelo menos 3 caracteres');
        }
        if (!validateEmailPrefix(user.emailPrefix)) {
          throw new Error('Email inválido');
        }
        if (!validatePassword(user.password)) {
          throw new Error('Senha deve ter 8+ caracteres, maiúscula, minúscula e número');
        }

        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            email,
            password: user.password,
            full_name: user.fullName,
          },
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        results.push({
          success: true,
          email,
          fullName: user.fullName,
        });
      } catch (error: any) {
        results.push({
          success: false,
          email,
          fullName: user.fullName,
          error: error.message || 'Erro desconhecido',
        });
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      setImportResults([...results]);
    }

    setImporting(false);
    setStep('results');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      onUsersCreated();
    }

    toast({
      title: "Importação concluída",
      description: `${successCount} usuário(s) criado(s) com sucesso. ${failCount} erro(s).`,
      variant: failCount > 0 ? "default" : "default",
    });
  };

  const resetDialog = () => {
    setParsedUsers([]);
    setImportResults([]);
    setProgress(0);
    setStep('upload');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Usuários em Lote
          </DialogTitle>
          <DialogDescription>
            Crie múltiplos usuários de uma só vez usando uma planilha CSV.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Faça o upload de um arquivo CSV com os dados dos usuários
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild disabled={loading}>
                  <span>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Selecionar Arquivo
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Formato do arquivo CSV:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>nome_completo</strong> - Nome completo do usuário (mín. 3 caracteres)</li>
                <li>• <strong>email_prefixo</strong> - Parte antes do @lasalle.org.br</li>
                <li>• <strong>senha</strong> - Mín. 8 caracteres, maiúscula, minúscula e número</li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Planilha Modelo
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Usuários encontrados: {parsedUsers.length}</h4>
              <Button variant="ghost" size="sm" onClick={resetDialog}>
                Voltar
              </Button>
            </div>
            
            <ScrollArea className="h-64 rounded-md border p-4">
              <div className="space-y-2">
                {parsedUsers.map((user, index) => {
                  const emailValid = validateEmailPrefix(user.emailPrefix);
                  const passwordValid = validatePassword(user.password);
                  const nameValid = user.fullName.length >= 3;
                  const isValid = emailValid && passwordValid && nameValid;
                  
                  return (
                    <div 
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-md ${
                        isValid ? 'bg-muted/50' : 'bg-destructive/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.emailPrefix}@lasalle.org.br
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!nameValid && (
                          <Badge variant="destructive" className="text-xs">Nome</Badge>
                        )}
                        {!emailValid && (
                          <Badge variant="destructive" className="text-xs">Email</Badge>
                        )}
                        {!passwordValid && (
                          <Badge variant="destructive" className="text-xs">Senha</Badge>
                        )}
                        {isValid && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                Cancelar
              </Button>
              <Button onClick={startImport}>
                Iniciar Importação
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-3" />
              <p className="font-medium">Importando usuários...</p>
              <p className="text-sm text-muted-foreground">
                {importResults.length} de {parsedUsers.length} processados
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 justify-center">
              <div className="text-center">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-2xl font-bold">
                    {importResults.filter(r => r.success).length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="text-2xl font-bold">
                    {importResults.filter(r => !r.success).length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            <ScrollArea className="h-48 rounded-md border p-4">
              <div className="space-y-2">
                {importResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      result.success ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                      {result.error && (
                        <p className="text-xs text-destructive">{result.error}</p>
                      )}
                    </div>
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
