import { supabase } from '@/integrations/supabase/client';

// Security audit logging - uses secure database function
export const logSecurityEvent = async (
  action: string,
  resourceType: string,
  resourceId?: string,
  additionalData?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Use the secure database function instead of direct insert
    const { error } = await supabase.rpc('insert_security_audit_log', {
      p_action: action,
      p_user_id: user.id,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_user_agent: navigator.userAgent,
      p_additional_data: additionalData ? JSON.stringify(additionalData) : null
    });

    if (error) {
      console.warn('Failed to log security event:', error);
    }
  } catch (error) {
    // Silent fail for audit logging to not disrupt user experience
    console.warn('Failed to log security event:', error);
  }
};

// Input sanitization
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML/XML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .slice(0, 1000); // Limit length
};

// Rate limiting helper (client-side basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
};

// Email validation with additional security checks
export const isValidLaSalleEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@lasalle\.org\.br$/;
  return emailRegex.test(email) && email.length <= 255;
};

// Password strength validation
export const validatePasswordStrength = (password: string): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  if (password.length < 8) {
    issues.push('Senha deve ter pelo menos 8 caracteres');
  }
  
  if (password.length > 128) {
    issues.push('Senha deve ter menos de 128 caracteres');
  }
  
  if (!/[a-z]/.test(password)) {
    issues.push('Senha deve conter pelo menos uma letra minúscula');
  }
  
  if (!/[A-Z]/.test(password)) {
    issues.push('Senha deve conter pelo menos uma letra maiúscula');
  }
  
  if (!/\d/.test(password)) {
    issues.push('Senha deve conter pelo menos um número');
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    issues.push('Senha deve conter pelo menos um caractere especial (@$!%*?&)');
  }
  
  // Check for common weak patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc/i,
    /admin/i
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      issues.push('Senha contém padrões comuns e inseguros');
      break;
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};