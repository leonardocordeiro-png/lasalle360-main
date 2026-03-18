export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_levels: {
        Row: {
          color_code: string
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color_code: string
          created_at?: string
          display_order: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color_code?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities_audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      activities_calendars: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          school_year_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          school_year_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          school_year_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_calendars_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          calendar_id: string
          created_at: string
          created_by: string | null
          description: string
          event_date: string
          event_time: string | null
          id: string
          location: string
          materials: string | null
          observations: string | null
          responsibles: string
          shift: Database["public"]["Enums"]["day_shift_enum"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          created_by?: string | null
          description: string
          event_date: string
          event_time?: string | null
          id?: string
          location: string
          materials?: string | null
          observations?: string | null
          responsibles: string
          shift?: Database["public"]["Enums"]["day_shift_enum"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string
          materials?: string | null
          observations?: string | null
          responsibles?: string
          shift?: Database["public"]["Enums"]["day_shift_enum"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "activities_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_notifications: {
        Row: {
          approver_id: string
          booking_date: string
          booking_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          observations: string | null
          requester_email: string
          requester_name: string
          resources: string[] | null
          room_name: string
          time_slots: string
        }
        Insert: {
          approver_id: string
          booking_date: string
          booking_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          observations?: string | null
          requester_email: string
          requester_name: string
          resources?: string[] | null
          room_name: string
          time_slots: string
        }
        Update: {
          approver_id?: string
          booking_date?: string
          booking_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          observations?: string | null
          requester_email?: string
          requester_name?: string
          resources?: string[] | null
          room_name?: string
          time_slots?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "room_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_blocks: {
        Row: {
          block_date: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          reason: string
          reserved_for: string | null
          resource_type: string
          start_time: string
          updated_at: string
        }
        Insert: {
          block_date: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          reason: string
          reserved_for?: string | null
          resource_type: string
          start_time: string
          updated_at?: string
        }
        Update: {
          block_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          reason?: string
          reserved_for?: string | null
          resource_type?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      chromebook_bookings: {
        Row: {
          booking_date: string
          class_name: string
          created_at: string
          end_time: string
          full_name: string
          id: string
          quantity: number
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          class_name: string
          created_at?: string
          end_time: string
          full_name: string
          id?: string
          quantity: number
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          class_name?: string
          created_at?: string
          end_time?: string
          full_name?: string
          id?: string
          quantity?: number
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chromebook_inventory: {
        Row: {
          created_at: string
          date: string
          id: string
          total_available: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          total_available?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          total_available?: number
          updated_at?: string
        }
        Relationships: []
      }
      chromebook_loans: {
        Row: {
          borrower_name: string
          borrower_type: string
          chromebook_number: string
          class_name: string | null
          created_at: string | null
          created_by: string
          equipment_id: string | null
          equipment_ids: string[] | null
          equipment_type: Database["public"]["Enums"]["equipment_type_loan"]
          expected_return_date: string | null
          id: string
          loan_date: string
          notification_sent: boolean | null
          observations: string | null
          pickup_time: string
          quantity: number
          responsible_teacher: string | null
          return_time: string | null
          returned_at: string | null
          returned_by: string | null
          returned_equipment_ids: string[] | null
          returned_quantity: number | null
          status: Database["public"]["Enums"]["loan_status"]
          updated_at: string | null
        }
        Insert: {
          borrower_name: string
          borrower_type: string
          chromebook_number: string
          class_name?: string | null
          created_at?: string | null
          created_by: string
          equipment_id?: string | null
          equipment_ids?: string[] | null
          equipment_type: Database["public"]["Enums"]["equipment_type_loan"]
          expected_return_date?: string | null
          id?: string
          loan_date: string
          notification_sent?: boolean | null
          observations?: string | null
          pickup_time: string
          quantity?: number
          responsible_teacher?: string | null
          return_time?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_equipment_ids?: string[] | null
          returned_quantity?: number | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string | null
        }
        Update: {
          borrower_name?: string
          borrower_type?: string
          chromebook_number?: string
          class_name?: string | null
          created_at?: string | null
          created_by?: string
          equipment_id?: string | null
          equipment_ids?: string[] | null
          equipment_type?: Database["public"]["Enums"]["equipment_type_loan"]
          expected_return_date?: string | null
          id?: string
          loan_date?: string
          notification_sent?: boolean | null
          observations?: string | null
          pickup_time?: string
          quantity?: number
          responsible_teacher?: string | null
          return_time?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_equipment_ids?: string[] | null
          returned_quantity?: number | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chromebook_loans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chromebook_loans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      class_councils: {
        Row: {
          academic_level: Database["public"]["Enums"]["academic_level_enum"]
          approved_at: string | null
          approved_by: string | null
          council_date: string
          created_at: string
          created_by: string
          display_order: number | null
          grade_class: string
          id: string
          school_year_id: string
          status: Database["public"]["Enums"]["council_status_enum"]
          trimester: Database["public"]["Enums"]["trimester_enum"]
          updated_at: string
        }
        Insert: {
          academic_level: Database["public"]["Enums"]["academic_level_enum"]
          approved_at?: string | null
          approved_by?: string | null
          council_date: string
          created_at?: string
          created_by: string
          display_order?: number | null
          grade_class: string
          id?: string
          school_year_id: string
          status?: Database["public"]["Enums"]["council_status_enum"]
          trimester: Database["public"]["Enums"]["trimester_enum"]
          updated_at?: string
        }
        Update: {
          academic_level?: Database["public"]["Enums"]["academic_level_enum"]
          approved_at?: string | null
          approved_by?: string | null
          council_date?: string
          created_at?: string
          created_by?: string
          display_order?: number | null
          grade_class?: string
          id?: string
          school_year_id?: string
          status?: Database["public"]["Enums"]["council_status_enum"]
          trimester?: Database["public"]["Enums"]["trimester_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_councils_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      class_planning: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number | null
          grade_series_id: string
          id: string
          new_students: number
          notes: string | null
          re_enrolled_students: number
          scenario_name: string
          school_year_id: string
          shift: string
          total_classes: number
          transferred_students: number
          updated_at: string
          vacancies_per_class: number
          waiting_list: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          grade_series_id: string
          id?: string
          new_students?: number
          notes?: string | null
          re_enrolled_students?: number
          scenario_name?: string
          school_year_id: string
          shift: string
          total_classes: number
          transferred_students?: number
          updated_at?: string
          vacancies_per_class: number
          waiting_list?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          grade_series_id?: string
          id?: string
          new_students?: number
          notes?: string | null
          re_enrolled_students?: number
          scenario_name?: string
          school_year_id?: string
          shift?: string
          total_classes?: number
          transferred_students?: number
          updated_at?: string
          vacancies_per_class?: number
          waiting_list?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_planning_grade_series_id_fkey"
            columns: ["grade_series_id"]
            isOneToOne: false
            referencedRelation: "grade_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_planning_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      complementary_programs: {
        Row: {
          color_code: string
          created_at: string
          enrolled_students: number
          id: string
          program_name: string
          school_year_id: string
          total_vacancies: number
          updated_at: string
          waiting_list: number
        }
        Insert: {
          color_code: string
          created_at?: string
          enrolled_students?: number
          id?: string
          program_name: string
          school_year_id: string
          total_vacancies: number
          updated_at?: string
          waiting_list?: number
        }
        Update: {
          color_code?: string
          created_at?: string
          enrolled_students?: number
          id?: string
          program_name?: string
          school_year_id?: string
          total_vacancies?: number
          updated_at?: string
          waiting_list?: number
        }
        Relationships: [
          {
            foreignKeyName: "complementary_programs_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      council_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type_enum"]
          council_id: string
          created_at: string
          description: string | null
          id: string
          student_names: string | null
          trimester: Database["public"]["Enums"]["trimester_enum"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type_enum"]
          council_id: string
          created_at?: string
          description?: string | null
          id?: string
          student_names?: string | null
          trimester: Database["public"]["Enums"]["trimester_enum"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type_enum"]
          council_id?: string
          created_at?: string
          description?: string | null
          id?: string
          student_names?: string | null
          trimester?: Database["public"]["Enums"]["trimester_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_actions_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "class_councils"
            referencedColumns: ["id"]
          },
        ]
      }
      council_grades: {
        Row: {
          council_student_id: string
          created_at: string
          grade_status: Database["public"]["Enums"]["grade_status_enum"] | null
          id: string
          observations: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          council_student_id: string
          created_at?: string
          grade_status?: Database["public"]["Enums"]["grade_status_enum"] | null
          id?: string
          observations?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          council_student_id?: string
          created_at?: string
          grade_status?: Database["public"]["Enums"]["grade_status_enum"] | null
          id?: string
          observations?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_grades_council_student_id_fkey"
            columns: ["council_student_id"]
            isOneToOne: false
            referencedRelation: "council_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "council_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      council_signatures: {
        Row: {
          council_id: string
          id: string
          role: Database["public"]["Enums"]["signature_role_enum"]
          signature_data: string | null
          signed_at: string
          signed_by: string
        }
        Insert: {
          council_id: string
          id?: string
          role: Database["public"]["Enums"]["signature_role_enum"]
          signature_data?: string | null
          signed_at?: string
          signed_by: string
        }
        Update: {
          council_id?: string
          id?: string
          role?: Database["public"]["Enums"]["signature_role_enum"]
          signature_data?: string | null
          signed_at?: string
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_signatures_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "class_councils"
            referencedColumns: ["id"]
          },
        ]
      }
      council_students: {
        Row: {
          council_id: string
          created_at: string
          display_order: number
          id: string
          student_name: string
          student_number: number
          updated_at: string
        }
        Insert: {
          council_id: string
          created_at?: string
          display_order: number
          id?: string
          student_name: string
          student_number: number
          updated_at?: string
        }
        Update: {
          council_id?: string
          created_at?: string
          display_order?: number
          id?: string
          student_name?: string
          student_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_students_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "class_councils"
            referencedColumns: ["id"]
          },
        ]
      }
      council_subjects: {
        Row: {
          academic_level: Database["public"]["Enums"]["academic_level_enum"]
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          subject_code: string
          subject_name: string
          updated_at: string
        }
        Insert: {
          academic_level: Database["public"]["Enums"]["academic_level_enum"]
          created_at?: string
          display_order: number
          id?: string
          is_active?: boolean
          subject_code: string
          subject_name: string
          updated_at?: string
        }
        Update: {
          academic_level?: Database["public"]["Enums"]["academic_level_enum"]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          subject_code?: string
          subject_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      grade_series: {
        Row: {
          academic_level_id: string
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          academic_level_id: string
          created_at?: string
          display_order: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          academic_level_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_series_academic_level_id_fkey"
            columns: ["academic_level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      it_equipment: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          description: string | null
          equipment_number: number
          equipment_type: string
          id: string
          id_number: string | null
          mac_address: string | null
          model: string
          patrimony: string
          responsible: string
          sector: string
          serial_number: string
          status: Database["public"]["Enums"]["equipment_status"]
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_number?: never
          equipment_type: string
          id?: string
          id_number?: string | null
          mac_address?: string | null
          model: string
          patrimony: string
          responsible: string
          sector: string
          serial_number: string
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_number?: never
          equipment_type?: string
          id?: string
          id_number?: string | null
          mac_address?: string | null
          model?: string
          patrimony?: string
          responsible?: string
          sector?: string
          serial_number?: string
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_blocked: boolean
          last_login: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_blocked?: boolean
          last_login?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_blocked?: boolean
          last_login?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      room_booking_approvers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      room_bookings: {
        Row: {
          approval_deadline: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          booking_date: string
          class_name: string
          created_at: string
          end_time: string
          full_name: string
          id: string
          observations: string | null
          resources: Json | null
          room_type: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_deadline?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_date: string
          class_name: string
          created_at?: string
          end_time: string
          full_name: string
          id?: string
          observations?: string | null
          resources?: Json | null
          room_type: string
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_deadline?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_date?: string
          class_name?: string
          created_at?: string
          end_time?: string
          full_name?: string
          id?: string
          observations?: string | null
          resources?: Json | null
          room_type?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_planning_audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      school_years: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          additional_data: Json | null
          created_at: string | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          additional_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          additional_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          created_by: string | null
          id: string
          module_name: string
          permission_level: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          module_name: string
          permission_level?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          module_name?: string
          permission_level?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      it_equipment_safe_view: {
        Row: {
          brand: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          equipment_number: number | null
          equipment_type: string | null
          id: string | null
          id_number: string | null
          mac_address: string | null
          model: string | null
          patrimony: string | null
          responsible: string | null
          sector: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"] | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_number?: number | null
          equipment_type?: string | null
          id?: string | null
          id_number?: never
          mac_address?: never
          model?: string | null
          patrimony?: string | null
          responsible?: string | null
          sector?: string | null
          serial_number?: never
          status?: Database["public"]["Enums"]["equipment_status"] | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_number?: number | null
          equipment_type?: string | null
          id?: string | null
          id_number?: never
          mac_address?: never
          model?: string | null
          patrimony?: string | null
          responsible?: string | null
          sector?: string | null
          serial_number?: never
          status?: Database["public"]["Enums"]["equipment_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      loans_safe_view: {
        Row: {
          borrower_name: string | null
          borrower_type: string | null
          chromebook_number: string | null
          class_name: string | null
          created_at: string | null
          created_by: string | null
          equipment_id: string | null
          equipment_type:
            | Database["public"]["Enums"]["equipment_type_loan"]
            | null
          expected_return_date: string | null
          id: string | null
          loan_date: string | null
          notification_sent: boolean | null
          observations: string | null
          pickup_time: string | null
          quantity: number | null
          responsible_teacher: string | null
          return_time: string | null
          returned_at: string | null
          returned_by: string | null
          status: Database["public"]["Enums"]["loan_status"] | null
        }
        Insert: {
          borrower_name?: never
          borrower_type?: string | null
          chromebook_number?: never
          class_name?: never
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          equipment_type?:
            | Database["public"]["Enums"]["equipment_type_loan"]
            | null
          expected_return_date?: string | null
          id?: string | null
          loan_date?: string | null
          notification_sent?: boolean | null
          observations?: string | null
          pickup_time?: string | null
          quantity?: number | null
          responsible_teacher?: never
          return_time?: string | null
          returned_at?: string | null
          returned_by?: string | null
          status?: Database["public"]["Enums"]["loan_status"] | null
        }
        Update: {
          borrower_name?: never
          borrower_type?: string | null
          chromebook_number?: never
          class_name?: never
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          equipment_type?:
            | Database["public"]["Enums"]["equipment_type_loan"]
            | null
          expected_return_date?: string | null
          id?: string | null
          loan_date?: string | null
          notification_sent?: boolean | null
          observations?: string | null
          pickup_time?: string | null
          quantity?: number | null
          responsible_teacher?: never
          return_time?: string | null
          returned_at?: string | null
          returned_by?: string | null
          status?: Database["public"]["Enums"]["loan_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "chromebook_loans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chromebook_loans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_return_chromebook_bookings: { Args: never; Returns: undefined }
      check_booking_availability: {
        Args: {
          p_booking_date: string
          p_end_time: string
          p_exclude_booking_id?: string
          p_quantity: number
          p_start_time: string
          p_user_id?: string
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_attempts?: number
          p_window_ms?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_time: number
        }[]
      }
      get_chromebook_day_usage: {
        Args: { p_date: string }
        Returns: {
          available: number
          total_inventory: number
          used_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_security_audit_log: {
        Args: {
          p_action: string
          p_additional_data?: Json
          p_ip_address?: unknown
          p_resource_id?: string
          p_resource_type?: string
          p_session_id?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      user_has_module_access: {
        Args: { p_module_name: string; p_user_id: string }
        Returns: boolean
      }
      user_has_permission_level: {
        Args: {
          p_module_name: string
          p_required_level: string
          p_user_id: string
        }
        Returns: boolean
      }
      validate_it_equipment_import: {
        Args: {
          p_brand: string
          p_equipment_type: string
          p_mac_address: string
          p_model: string
          p_patrimony: string
          p_responsible: string
          p_sector: string
          p_serial_number: string
          p_status: string
        }
        Returns: string
      }
    }
    Enums: {
      academic_level_enum: "EM" | "EFII"
      action_type_enum:
        | "pais_chamados"
        | "soe_acompanhar"
        | "sct_chamar"
        | "destaques"
      app_role: "admin" | "moderator" | "user" | "coordinator"
      council_status_enum: "draft" | "in_progress" | "completed" | "approved"
      day_shift_enum: "morning" | "afternoon" | "night"
      equipment_status: "ATIVO" | "DEFEITO" | "EMPRESTIMO" | "EM_USO"
      equipment_type_loan: "professor" | "aluno" | "colaborador"
      grade_status_enum: "AP" | "REC" | "-"
      loan_status: "em_uso" | "devolvido" | "atrasado"
      signature_role_enum: "prof_reg" | "sse" | "soe" | "sct" | "scp"
      trimester_enum: "1" | "2" | "3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      academic_level_enum: ["EM", "EFII"],
      action_type_enum: [
        "pais_chamados",
        "soe_acompanhar",
        "sct_chamar",
        "destaques",
      ],
      app_role: ["admin", "moderator", "user", "coordinator"],
      council_status_enum: ["draft", "in_progress", "completed", "approved"],
      day_shift_enum: ["morning", "afternoon", "night"],
      equipment_status: ["ATIVO", "DEFEITO", "EMPRESTIMO", "EM_USO"],
      equipment_type_loan: ["professor", "aluno", "colaborador"],
      grade_status_enum: ["AP", "REC", "-"],
      loan_status: ["em_uso", "devolvido", "atrasado"],
      signature_role_enum: ["prof_reg", "sse", "soe", "sct", "scp"],
      trimester_enum: ["1", "2", "3"],
    },
  },
} as const
