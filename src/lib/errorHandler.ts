export type DatabaseError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

/**
 * Mapeia erros de banco de dados para mensagens amigáveis ao usuário
 */
export const mapDatabaseError = (error: DatabaseError): string => {
  // Log completo apenas no console (dev mode)
  if (process.env.NODE_ENV === 'development') {
    console.error('Database error:', error);
  }

  // Mapeamento de códigos PostgreSQL
  const errorMap: Record<string, string> = {
    // Constraint violations
    '23505': 'Este registro já existe no sistema.',
    '23503': 'Não foi possível completar a operação devido a dependências.',
    '23514': 'Os dados fornecidos violam as regras do sistema.',
    
    // Permission errors
    '42501': 'Você não tem permissão para realizar esta ação.',
    'PGRST301': 'Você não tem permissão para acessar este recurso.',
    
    // Data validation
    '22001': 'Um ou mais campos excederam o tamanho máximo permitido.',
    '22003': 'Valor numérico fora do intervalo permitido.',
    '22007': 'Data ou horário inválido.',
    
    // RLS violations
    'PGRST116': 'Você não tem permissão para visualizar estes dados.',
    
    // Custom exceptions
    'P0001': 'Operação não permitida. Verifique os dados e tente novamente.',
  };

  // Verificar código do erro
  if (error.code && errorMap[error.code]) {
    return errorMap[error.code];
  }

  // Verificar mensagens específicas
  if (error.message) {
    if (error.message.includes('violates row-level security')) {
      return 'Você não tem permissão para acessar este recurso.';
    }
    if (error.message.includes('duplicate key')) {
      return 'Este registro já existe no sistema.';
    }
    if (error.message.includes('foreign key')) {
      return 'Não foi possível completar a operação devido a dependências.';
    }
    if (error.message.includes('permission denied')) {
      return 'Você não tem permissão para realizar esta ação.';
    }
    if (error.message.includes('Unauthorized')) {
      return 'Acesso não autorizado.';
    }
    if (error.message.includes('too long')) {
      return 'Um ou mais campos excederam o tamanho máximo.';
    }
    if (error.message.includes('invalid characters')) {
      return 'Alguns caracteres não são permitidos neste campo.';
    }
    if (error.message.includes('already on loan')) {
      return 'Este equipamento já está emprestado.';
    }
  }

  // Erro genérico (não expõe detalhes internos)
  return 'Não foi possível completar a operação. Por favor, tente novamente.';
};

/**
 * Loga erro no sistema de auditoria
 */
export const logErrorToAudit = async (
  error: unknown,
  context: string,
  additionalData?: Record<string, any>
) => {
  try {
    const { logSecurityEvent } = await import('@/lib/securityUtils');
    await logSecurityEvent(
      'error_occurred',
      context,
      undefined,
      {
        error: error instanceof Error ? error.message : String(error),
        ...additionalData
      }
    );
  } catch (auditError) {
    console.warn('Failed to log error to audit:', auditError);
  }
};

/**
 * Handler completo de erro com toast
 */
export const handleDatabaseError = async (
  error: unknown,
  context: string,
  toast: (options: any) => void,
  customMessage?: string
) => {
  const dbError = error as DatabaseError;
  const userMessage = customMessage || mapDatabaseError(dbError);
  
  toast({
    title: "Erro",
    description: userMessage,
    variant: "destructive",
  });

  // Log para auditoria (não bloqueia UI)
  await logErrorToAudit(error, context);
};
