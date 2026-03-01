import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'create' | 'update' | 'delete' | 'login' | 'logout' 
  | 'block' | 'unblock' | 'grant_role' | 'revoke_role'
  | 'grant_permission' | 'revoke_permission' | 'config_change'
  | 'bulk_delete' | 'reset_data' | 'export' | 'import'
  | 'status_change' | 'approve' | 'cancel' | 'data_access';

export type AuditModule = 
  | 'users' | 'it_equipment' | 'inventory' | 'system_settings'
  | 'council' | 'school_planning' | 'calendar_blocks' 
  | 'permissions' | 'bookings' | 'auth' | 'security';

export interface AuditLogEntry {
  action: AuditAction;
  module: AuditModule;
  description: string;
  resourceId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  metadata?: Record<string, any>;
}

export const auditLog = async (entry: AuditLogEntry): Promise<void> => {
  try {
    console.log('🔍 Starting audit log for:', entry);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ Audit log failed: No authenticated user');
      return;
    }

    console.log('✅ User authenticated:', user.id);

    const additionalData: Record<string, any> = {
      module: entry.module,
      description: entry.description,
      timestamp: new Date().toISOString(),
    };

    if (entry.oldData) additionalData.old_data = entry.oldData;
    if (entry.newData) additionalData.new_data = entry.newData;
    if (entry.metadata) additionalData.metadata = entry.metadata;

    const actionString = `${entry.module}_${entry.action}`;

    console.log('🔍 Audit Log Debug:', {
      actionString,
      module: entry.module,
      action: entry.action,
      description: entry.description,
      resourceId: entry.resourceId,
      userId: user.id,
      additionalData
    });

    // Use RPC function only
    const { data, error } = await supabase.rpc('insert_security_audit_log', {
      p_action: actionString,
      p_user_id: user.id,
      p_resource_type: entry.module,
      p_resource_id: entry.resourceId || null,
      p_user_agent: navigator.userAgent,
      p_additional_data: JSON.stringify(additionalData),
    });

    console.log('🔍 RPC Response:', { data, error });

    if (error) {
      console.error('❌ Audit log RPC error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Audit log RPC success:', data);
    }
  } catch (error) {
    console.warn('❌ Audit log failed (non-blocking):', error);
    console.error('Exception details:', JSON.stringify(error, null, 2));
  }
};

// Test function to create council audit logs
export const testCouncilAuditLog = async () => {
  console.log('🧪 Testing council audit log...');
  try {
    await auditLog({
      action: 'data_access',
      module: 'council',
      description: 'TESTE - Dados do conselho acessados: 161M - 1º Trimestre',
      resourceId: 'test-council-id',
      metadata: { 
        grade_class: '161M', 
        trimester: '1', 
        academic_level: 'EFII',
        access_type: 'view',
        test: true
      }
    });
    console.log('✅ Test council audit log completed');
  } catch (error) {
    console.error('❌ Test council audit log failed:', error);
  }
};
