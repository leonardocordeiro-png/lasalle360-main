// Types para as tabelas do Supabase
export interface Database {
  public: {
    Tables: {
      approval_notifications: {
        Row: {
          id: string;
          approver_id: string;
          booking_id: string;
          requester_name: string;
          requester_email: string;
          room_name: string;
          booking_date: string;
          time_slots: string;
          resources: string[];
          observations: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['approval_notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['approval_notifications']['Row']>;
      };
      user_permissions: {
        Row: {
          id: string;
          user_id: string;
          module_name: string;
          can_access: boolean;
          permission_level: 'none' | 'read' | 'write';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_permissions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_permissions']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          type: string;
          related_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
    };
  };
}

// Helper types para remover necessidade de 'as any'
export type ApprovalNotification = Database['public']['Tables']['approval_notifications']['Row'];
export type UserPermission = Database['public']['Tables']['user_permissions']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
