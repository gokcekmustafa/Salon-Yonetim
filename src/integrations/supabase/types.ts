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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          salon_id: string | null
          scheduled_at: string | null
          sender_type: string
          sender_user_id: string
          target_salon_ids: string[] | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          salon_id?: string | null
          scheduled_at?: string | null
          sender_type?: string
          sender_user_id: string
          target_salon_ids?: string[] | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          salon_id?: string | null
          scheduled_at?: string | null
          sender_type?: string
          sender_user_id?: string
          target_salon_ids?: string[] | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string
          end_time: string
          id: string
          notes: string | null
          room_id: string | null
          salon_id: string
          service_id: string
          session_status: string
          staff_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id: string
          end_time: string
          id?: string
          notes?: string | null
          room_id?: string | null
          salon_id: string
          service_id: string
          session_status?: string
          staff_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          room_id?: string | null
          salon_id?: string
          service_id?: string
          session_status?: string
          staff_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          salon_id: string | null
          salon_name: string | null
          target_id: string | null
          target_label: string | null
          target_type: string
          user_id: string
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          salon_id?: string | null
          salon_name?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type: string
          user_id: string
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          salon_id?: string | null
          salon_name?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
          user_id?: string
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_boxes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          payment_method: string
          salon_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          payment_method?: string
          salon_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          payment_method?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_boxes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          cash_box_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          payment_method: string
          salon_id: string
          transaction_date: string
          type: string
        }
        Insert: {
          amount: number
          cash_box_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          payment_method?: string
          salon_id: string
          transaction_date?: string
          type?: string
        }
        Update: {
          amount?: number
          cash_box_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          payment_method?: string
          salon_id?: string
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_cash_box_id_fkey"
            columns: ["cash_box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      company_registration_requests: {
        Row: {
          address: string
          birth_date: string | null
          city: string
          company_name: string
          company_phone: string
          company_phone_secondary: string | null
          created_at: string
          district: string
          email: string
          full_name: string
          id: string
          identity_number: string
          identity_type: string
          neighborhood: string
          notes: string | null
          personal_phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          roles: string[]
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          address: string
          birth_date?: string | null
          city: string
          company_name: string
          company_phone: string
          company_phone_secondary?: string | null
          created_at?: string
          district: string
          email: string
          full_name: string
          id?: string
          identity_number: string
          identity_type: string
          neighborhood: string
          notes?: string | null
          personal_phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          address?: string
          birth_date?: string | null
          city?: string
          company_name?: string
          company_phone?: string
          company_phone_secondary?: string | null
          created_at?: string
          district?: string
          email?: string
          full_name?: string
          id?: string
          identity_number?: string
          identity_type?: string
          neighborhood?: string
          notes?: string | null
          personal_phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          name: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          name: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          name?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contracts: {
        Row: {
          contract_payment_type: string
          created_at: string
          created_by: string
          customer_id: string
          filled_data: Json
          id: string
          installment_count: number | null
          installment_id: string | null
          notes: string | null
          salon_id: string
          signed_date: string | null
          status: string
          template_id: string | null
          template_name: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          contract_payment_type?: string
          created_at?: string
          created_by: string
          customer_id: string
          filled_data?: Json
          id?: string
          installment_count?: number | null
          installment_id?: string | null
          notes?: string | null
          salon_id: string
          signed_date?: string | null
          status?: string
          template_id?: string | null
          template_name: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          contract_payment_type?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          filled_data?: Json
          id?: string
          installment_count?: number | null
          installment_id?: string | null
          notes?: string | null
          salon_id?: string
          signed_date?: string | null
          status?: string
          template_id?: string | null
          template_name?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contracts_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          assigned_staff_id: string | null
          birth_date: string | null
          branch_id: string | null
          created_at: string
          customer_type: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          salon_id: string
          secondary_phone: string | null
          source_detail: string | null
          source_type: string | null
          tc_kimlik_no: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_staff_id?: string | null
          birth_date?: string | null
          branch_id?: string | null
          created_at?: string
          customer_type?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          salon_id: string
          secondary_phone?: string | null
          source_detail?: string | null
          source_type?: string | null
          tc_kimlik_no?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_staff_id?: string | null
          birth_date?: string | null
          branch_id?: string | null
          created_at?: string
          customer_type?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          salon_id?: string
          secondary_phone?: string | null
          source_detail?: string | null
          source_type?: string | null
          tc_kimlik_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_id: string
          installment_number: number
          is_paid: boolean
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          salon_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_id: string
          installment_number?: number
          is_paid?: boolean
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          salon_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_id?: string
          installment_number?: number
          is_paid?: boolean
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          id: string
          installment_count: number
          notes: string | null
          salon_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          installment_count?: number
          notes?: string | null
          salon_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          installment_count?: number
          notes?: string | null
          salon_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          note_type: string
          salon_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          note_type?: string
          salon_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          note_type?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_staff_id: string | null
          converted_customer_id: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes_summary: string | null
          phone: string | null
          salon_id: string
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes_summary?: string | null
          phone?: string | null
          salon_id: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes_summary?: string | null
          phone?: string | null
          salon_id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          id: string
          message_template: string | null
          reminder_hours_before: number
          salon_id: string
          sms_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          message_template?: string | null
          reminder_hours_before?: number
          salon_id: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          message_template?: string | null
          reminder_hours_before?: number
          salon_id?: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          announcement_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          salon_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          salon_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          salon_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          branch_id: string | null
          created_at: string
          id: string
          payment_date: string
          payment_type: string
          salon_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          payment_date?: string
          payment_type?: string
          salon_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          payment_date?: string
          payment_type?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_staff_permissions: {
        Row: {
          can_manage_announcements: boolean
          can_manage_data: boolean
          can_manage_popups: boolean
          can_manage_salons: boolean
          can_manage_settings: boolean
          can_manage_users: boolean
          can_view_audit_logs: boolean
          can_view_reports: boolean
          created_at: string
          id: string
          is_helper: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_announcements?: boolean
          can_manage_data?: boolean
          can_manage_popups?: boolean
          can_manage_salons?: boolean
          can_manage_settings?: boolean
          can_manage_users?: boolean
          can_view_audit_logs?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          is_helper?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_announcements?: boolean
          can_manage_data?: boolean
          can_manage_popups?: boolean
          can_manage_salons?: boolean
          can_manage_settings?: boolean
          can_manage_users?: boolean
          can_view_audit_logs?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          is_helper?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      popup_announcements: {
        Row: {
          created_at: string
          created_by: string
          duration_seconds: number
          id: string
          is_active: boolean
          link_label: string | null
          link_url: string | null
          message: string
          salon_id: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          message: string
          salon_id?: string | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          message?: string
          salon_id?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "popup_announcements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_views: {
        Row: {
          id: string
          popup_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          popup_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          popup_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "popup_views_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "popup_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          salon_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          salon_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          appointment_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          payment_method: string
          product_id: string
          quantity: number
          salon_id: string
          sold_by: string
          total_price: number
          unit_price: number
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string
          product_id: string
          quantity?: number
          salon_id: string
          sold_by: string
          total_price: number
          unit_price: number
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string
          product_id?: string
          quantity?: number
          salon_id?: string
          sold_by?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          is_active: boolean
          min_stock_alert: number
          name: string
          purchase_price: number
          sale_price: number
          salon_id: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock_alert?: number
          name: string
          purchase_price?: number
          sale_price?: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock_alert?: number
          name?: string
          purchase_price?: number
          sale_price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          room_number: string | null
          salon_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          room_number?: string | null
          salon_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          room_number?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_members: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          salon_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          salon_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          salon_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_salon_members_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_navigation_preferences: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          item_key: string
          salon_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          item_key: string
          salon_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          item_key?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salon_permissions: {
        Row: {
          can_add_branches: boolean
          can_delete_leads: boolean
          can_manage_announcements: boolean
          can_manage_appointments: boolean
          can_manage_customers: boolean
          can_manage_leads: boolean
          can_manage_online_booking: boolean
          can_manage_payments: boolean
          can_manage_popups: boolean
          can_manage_services: boolean
          can_manage_staff: boolean
          can_view_dashboard: boolean
          created_at: string
          id: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          can_add_branches?: boolean
          can_delete_leads?: boolean
          can_manage_announcements?: boolean
          can_manage_appointments?: boolean
          can_manage_customers?: boolean
          can_manage_leads?: boolean
          can_manage_online_booking?: boolean
          can_manage_payments?: boolean
          can_manage_popups?: boolean
          can_manage_services?: boolean
          can_manage_staff?: boolean
          can_view_dashboard?: boolean
          created_at?: string
          id?: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          can_add_branches?: boolean
          can_delete_leads?: boolean
          can_manage_announcements?: boolean
          can_manage_appointments?: boolean
          can_manage_customers?: boolean
          can_manage_leads?: boolean
          can_manage_online_booking?: boolean
          can_manage_payments?: boolean
          can_manage_popups?: boolean
          can_manage_services?: boolean
          can_manage_staff?: boolean
          can_view_dashboard?: boolean
          created_at?: string
          id?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_permissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          online_booking_active: boolean
          owner_user_id: string | null
          phone: string | null
          slug: string
          subscription_expires_at: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          online_booking_active?: boolean
          owner_user_id?: string | null
          phone?: string | null
          slug: string
          subscription_expires_at?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          online_booking_active?: boolean
          owner_user_id?: string | null
          phone?: string | null
          slug?: string
          subscription_expires_at?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          salon_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          salon_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sales: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          payment_method: string
          quantity: number
          salon_id: string
          service_id: string
          sold_by: string
          staff_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          quantity?: number
          salon_id: string
          service_id: string
          sold_by: string
          staff_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          quantity?: number
          salon_id?: string
          service_id?: string
          sold_by?: string
          staff_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string
          duration: number
          id: string
          is_active: boolean
          name: string
          price: number
          salon_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          duration: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          salon_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          salon_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          salon_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_details: {
        Row: {
          address: string | null
          birth_date: string | null
          bonus_rate: number | null
          bonus_type: string | null
          created_at: string | null
          department: string | null
          email: string | null
          experiences: string[] | null
          gender: string | null
          id: string
          offered_services: string[] | null
          payment_period: string | null
          permissions: Json | null
          profile_photo_url: string | null
          reward_description: string | null
          salary_notes: string | null
          salon_id: string
          secondary_phone: string | null
          staff_id: string
          start_date: string | null
          surname: string | null
          tc_no: string | null
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          bonus_rate?: number | null
          bonus_type?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          experiences?: string[] | null
          gender?: string | null
          id?: string
          offered_services?: string[] | null
          payment_period?: string | null
          permissions?: Json | null
          profile_photo_url?: string | null
          reward_description?: string | null
          salary_notes?: string | null
          salon_id: string
          secondary_phone?: string | null
          staff_id: string
          start_date?: string | null
          surname?: string | null
          tc_no?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          bonus_rate?: number | null
          bonus_type?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          experiences?: string[] | null
          gender?: string | null
          id?: string
          offered_services?: string[] | null
          payment_period?: string | null
          permissions?: Json | null
          profile_photo_url?: string | null
          reward_description?: string | null
          salary_notes?: string | null
          salon_id?: string
          secondary_phone?: string | null
          staff_id?: string
          start_date?: string | null
          surname?: string | null
          tc_no?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_details_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_details_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payments: {
        Row: {
          amount: number
          cash_box_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          payment_date: string
          payment_method: string
          payment_type: string
          salon_id: string
          staff_id: string
        }
        Insert: {
          amount: number
          cash_box_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          payment_date?: string
          payment_method?: string
          payment_type?: string
          salon_id: string
          staff_id: string
        }
        Update: {
          amount?: number
          cash_box_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          payment_date?: string
          payment_method?: string
          payment_type?: string
          salon_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payments_cash_box_id_fkey"
            columns: ["cash_box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          created_at: string
          id: string
          monthly_salary: number
          salon_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_salary?: number
          salon_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_salary?: number
          salon_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_rooms: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          room_number: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          room_number?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          room_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      standard_services: {
        Row: {
          category_name: string
          created_at: string
          duration: number
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          duration?: number
          id?: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          duration?: number
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          product_id: string
          quantity: number
          salon_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          product_id: string
          quantity: number
          salon_id: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          product_id?: string
          quantity?: number
          salon_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          message: string
          priority: string
          salon_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          message: string
          priority?: string
          salon_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          priority?: string
          salon_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          ticket_id: string
          user_id: string
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          ticket_id: string
          user_id: string
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
          user_id?: string
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_online_status: {
        Row: {
          id: string
          is_online: boolean
          last_seen_at: string
          salon_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean
          last_seen_at?: string
          salon_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean
          last_seen_at?: string
          salon_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_online_status_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passwords: {
        Row: {
          id: string
          password_plain: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          password_plain: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          password_plain?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_branch: {
        Args: { _branch_id: string; _salon_id: string }
        Returns: boolean
      }
      check_salon_permission: {
        Args: { _permission: string; _salon_id: string }
        Returns: boolean
      }
      delete_customer_cascade: {
        Args: { _customer_id: string; _salon_id: string }
        Returns: Json
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_staff_branch: {
        Args: { _salon_id: string; _user_id: string }
        Returns: string
      }
      get_user_salon_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_username_available: {
        Args: { _username: string }
        Returns: boolean
      }
      is_salon_admin: {
        Args: { _salon_id: string; _user_id: string }
        Returns: boolean
      }
      is_salon_member: {
        Args: { _salon_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "salon_admin" | "staff"
      lead_status:
        | "new"
        | "contacted"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      subscription_plan: "free" | "starter" | "professional" | "enterprise"
      ticket_status: "pending" | "in_progress" | "resolved"
      ticket_type: "support" | "suggestion" | "complaint"
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
      app_role: ["super_admin", "salon_admin", "staff"],
      lead_status: [
        "new",
        "contacted",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      subscription_plan: ["free", "starter", "professional", "enterprise"],
      ticket_status: ["pending", "in_progress", "resolved"],
      ticket_type: ["support", "suggestion", "complaint"],
    },
  },
} as const
