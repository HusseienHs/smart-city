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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: Json
          created_at: string
          created_by: string | null
          department_id: string | null
          expires_at: string | null
          id: string
          image_path: string | null
          municipality_id: string
          neighborhood_id: string | null
          published_at: string | null
          published_by: string | null
          severity: Database["public"]["Enums"]["announcement_severity"]
          status: Database["public"]["Enums"]["content_status"]
          title: Json
          updated_at: string
        }
        Insert: {
          body: Json
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          image_path?: string | null
          municipality_id: string
          neighborhood_id?: string | null
          published_at?: string | null
          published_by?: string | null
          severity?: Database["public"]["Enums"]["announcement_severity"]
          status?: Database["public"]["Enums"]["content_status"]
          title: Json
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          image_path?: string | null
          municipality_id?: string
          neighborhood_id?: string | null
          published_at?: string | null
          published_by?: string | null
          severity?: Database["public"]["Enums"]["announcement_severity"]
          status?: Database["public"]["Enums"]["content_status"]
          title?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_department_id_municipality_id_fkey"
            columns: ["department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "announcements_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_neighborhood_id_municipality_id_fkey"
            columns: ["neighborhood_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "announcements_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
          municipality_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          municipality_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          municipality_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          municipality_id: string
          name: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          municipality_id: string
          name: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          municipality_id?: string
          name?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          job_title: string | null
          municipality_id: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          municipality_id: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          municipality_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_municipality_id_fkey"
            columns: ["department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "employees_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          auto_route_reports: boolean
          boundary: unknown
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_locale: Database["public"]["Enums"]["app_locale"]
          id: string
          name: Json
          require_completion_photo: boolean
          status: Database["public"]["Enums"]["municipality_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_route_reports?: boolean
          boundary?: unknown
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_locale?: Database["public"]["Enums"]["app_locale"]
          id?: string
          name: Json
          require_completion_photo?: boolean
          status?: Database["public"]["Enums"]["municipality_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_route_reports?: boolean
          boundary?: unknown
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_locale?: Database["public"]["Enums"]["app_locale"]
          id?: string
          name?: Json
          require_completion_photo?: boolean
          status?: Database["public"]["Enums"]["municipality_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      municipality_report_categories: {
        Row: {
          category_id: string
          created_at: string
          default_department_id: string | null
          default_priority: Database["public"]["Enums"]["report_priority"]
          is_enabled: boolean
          municipality_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          default_department_id?: string | null
          default_priority?: Database["public"]["Enums"]["report_priority"]
          is_enabled?: boolean
          municipality_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          default_department_id?: string | null
          default_priority?: Database["public"]["Enums"]["report_priority"]
          is_enabled?: boolean
          municipality_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipality_report_categorie_default_department_id_munici_fkey"
            columns: ["default_department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "municipality_report_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "report_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipality_report_categories_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          boundary: unknown
          created_at: string
          id: string
          is_active: boolean
          municipality_id: string
          name: Json
          updated_at: string
        }
        Insert: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          municipality_id: string
          name: Json
          updated_at?: string
        }
        Update: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          municipality_id?: string
          name?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          municipality_id: string | null
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          municipality_id?: string | null
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          municipality_id?: string | null
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          created_at: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          home_municipality_id: string | null
          home_neighborhood_id: string | null
          id: string
          preferred_locale: Database["public"]["Enums"]["app_locale"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          home_municipality_id?: string | null
          home_neighborhood_id?: string | null
          id: string
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          home_municipality_id?: string | null
          home_neighborhood_id?: string | null
          id?: string
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_municipality_id_fkey"
            columns: ["home_municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_neighborhood_id_home_municipality_id_fkey"
            columns: ["home_neighborhood_id", "home_municipality_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "municipality_id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string
          municipality_id: string
          report_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string
          municipality_id: string
          report_id: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string
          municipality_id?: string
          report_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_municipality_id_fkey"
            columns: ["report_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "report_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_categories: {
        Row: {
          code: string
          created_at: string
          default_visibility: Database["public"]["Enums"]["report_visibility"]
          icon: string | null
          id: string
          is_active: boolean
          name: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["report_visibility"]
          icon?: string | null
          id?: string
          is_active?: boolean
          name: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["report_visibility"]
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      report_comments: {
        Row: {
          author_employee_id: string | null
          author_id: string | null
          body: string
          created_at: string
          from_reporter: boolean
          id: string
          is_internal: boolean
          municipality_id: string
          report_id: string
        }
        Insert: {
          author_employee_id?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          from_reporter?: boolean
          id?: string
          is_internal?: boolean
          municipality_id: string
          report_id: string
        }
        Update: {
          author_employee_id?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          from_reporter?: boolean
          id?: string
          is_internal?: boolean
          municipality_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_author_employee_id_municipality_id_fkey"
            columns: ["author_employee_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "report_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_municipality_id_fkey"
            columns: ["report_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
        ]
      }
      report_confirmations: {
        Row: {
          created_at: string
          municipality_id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          municipality_id: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          municipality_id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_confirmations_report_id_municipality_id_fkey"
            columns: ["report_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "report_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_followers: {
        Row: {
          created_at: string
          municipality_id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          municipality_id: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          municipality_id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_followers_report_id_municipality_id_fkey"
            columns: ["report_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "report_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_status_history: {
        Row: {
          changed_by: string | null
          changed_by_employee_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["report_status"] | null
          id: string
          municipality_id: string
          note: string | null
          note_is_public: boolean
          report_id: string
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          changed_by?: string | null
          changed_by_employee_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: string
          municipality_id: string
          note?: string | null
          note_is_public?: boolean
          report_id: string
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          changed_by?: string | null
          changed_by_employee_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: string
          municipality_id?: string
          note?: string | null
          note_is_public?: boolean
          report_id?: string
          to_status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_changed_by_employee_id_municipality__fkey"
            columns: ["changed_by_employee_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "report_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_municipality_id_fkey"
            columns: ["report_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
        ]
      }
      report_status_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["report_status"]
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["report_status"]
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["report_status"]
          to_status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: []
      }
      report_tracking_counters: {
        Row: {
          last_value: number
          municipality_id: string
          year: number
        }
        Insert: {
          last_value: number
          municipality_id: string
          year: number
        }
        Update: {
          last_value?: number
          municipality_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_tracking_counters_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string | null
          assignee_id: string | null
          category_id: string
          closed_at: string | null
          confirmation_count: number
          created_at: string
          department_id: string | null
          description: string
          duplicate_of_id: string | null
          first_response_at: string | null
          follower_count: number
          id: string
          location: unknown
          location_accuracy_m: number | null
          municipality_id: string
          neighborhood_id: string | null
          priority: Database["public"]["Enums"]["report_priority"]
          public_location: unknown
          rejection_reason:
            | Database["public"]["Enums"]["report_rejection_reason"]
            | null
          reporter_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          status_changed_at: string
          suggested_department_id: string | null
          tracking_number: string
          updated_at: string
          visibility: Database["public"]["Enums"]["report_visibility"]
        }
        Insert: {
          address?: string | null
          assignee_id?: string | null
          category_id: string
          closed_at?: string | null
          confirmation_count?: number
          created_at?: string
          department_id?: string | null
          description: string
          duplicate_of_id?: string | null
          first_response_at?: string | null
          follower_count?: number
          id?: string
          location: unknown
          location_accuracy_m?: number | null
          municipality_id: string
          neighborhood_id?: string | null
          priority?: Database["public"]["Enums"]["report_priority"]
          public_location?: unknown
          rejection_reason?:
            | Database["public"]["Enums"]["report_rejection_reason"]
            | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          status_changed_at?: string
          suggested_department_id?: string | null
          tracking_number: string
          updated_at?: string
          visibility: Database["public"]["Enums"]["report_visibility"]
        }
        Update: {
          address?: string | null
          assignee_id?: string | null
          category_id?: string
          closed_at?: string | null
          confirmation_count?: number
          created_at?: string
          department_id?: string | null
          description?: string
          duplicate_of_id?: string | null
          first_response_at?: string | null
          follower_count?: number
          id?: string
          location?: unknown
          location_accuracy_m?: number | null
          municipality_id?: string
          neighborhood_id?: string | null
          priority?: Database["public"]["Enums"]["report_priority"]
          public_location?: unknown
          rejection_reason?:
            | Database["public"]["Enums"]["report_rejection_reason"]
            | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          status_changed_at?: string
          suggested_department_id?: string | null
          tracking_number?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["report_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_assignee_id_municipality_id_fkey"
            columns: ["assignee_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "report_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_department_id_municipality_id_fkey"
            columns: ["department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_id_municipality_id_fkey"
            columns: ["duplicate_of_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "reports_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_neighborhood_id_municipality_id_fkey"
            columns: ["neighborhood_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_suggested_department_id_municipality_id_fkey"
            columns: ["suggested_department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_user_id: string | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          job_title: string | null
          municipality_id: string
          responded_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_user_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          municipality_id: string
          responded_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_user_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          municipality_id?: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_accepted_user_id_fkey"
            columns: ["accepted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_department_id_municipality_id_fkey"
            columns: ["department_id", "municipality_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "municipality_id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      add_report_attachment: {
        Args: {
          p_kind?: Database["public"]["Enums"]["attachment_kind"]
          p_report_id: string
          p_storage_path: string
        }
        Returns: string
      }
      add_report_comment: {
        Args: { p_body: string; p_is_internal?: boolean; p_report_id: string }
        Returns: string
      }
      assign_report: {
        Args: {
          p_assignee_id?: string
          p_department_id: string
          p_priority?: Database["public"]["Enums"]["report_priority"]
          p_report_id: string
        }
        Returns: undefined
      }
      confirm_report: { Args: { p_report_id: string }; Returns: undefined }
      decline_staff_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      follow_report: { Args: { p_report_id: string }; Returns: undefined }
      get_audit_log: {
        Args: {
          p_before_id?: number
          p_limit?: number
          p_municipality_id: string
        }
        Returns: {
          action: string
          actor_id: string
          actor_kind: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
          municipality_id: string
        }[]
      }
      get_colleagues: {
        Args: { p_municipality_id: string }
        Returns: {
          department_id: string
          employee_id: string
          full_name: string
          job_title: string
          role: Database["public"]["Enums"]["staff_role"]
        }[]
      }
      get_my_report_attachments: {
        Args: { p_report_id: string }
        Returns: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          storage_path: string
        }[]
      }
      get_my_report_comments: {
        Args: { p_report_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          is_mine: boolean
        }[]
      }
      get_my_report_updates: {
        Args: { p_report_id: string }
        Returns: {
          created_at: string
          note: string
          to_status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      get_my_reports: {
        Args: never
        Returns: {
          address: string
          category_code: string
          confirmation_count: number
          created_at: string
          description: string
          id: string
          latitude: number
          longitude: number
          municipality_id: string
          rejection_reason: Database["public"]["Enums"]["report_rejection_reason"]
          resolved_at: string
          status: Database["public"]["Enums"]["report_status"]
          status_changed_at: string
          tracking_number: string
          visibility: Database["public"]["Enums"]["report_visibility"]
        }[]
      }
      get_my_staff_invitations: {
        Args: never
        Returns: {
          department_name: Json
          expires_at: string
          id: string
          municipality_id: string
          municipality_name: Json
          role: Database["public"]["Enums"]["staff_role"]
        }[]
      }
      get_public_reports: {
        Args: {
          p_east: number
          p_limit?: number
          p_municipality_id: string
          p_north: number
          p_south: number
          p_west: number
        }
        Returns: {
          category_code: string
          confirmation_count: number
          id: string
          latitude: number
          longitude: number
          municipality_id: string
          reported_on: string
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      get_report_reporter_contact: {
        Args: { p_report_id: string }
        Returns: {
          full_name: string
          phone: string
        }[]
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      revoke_staff_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_announcement_status: {
        Args: {
          p_announcement_id: string
          p_status: Database["public"]["Enums"]["content_status"]
        }
        Returns: undefined
      }
      set_employee_role: {
        Args: {
          p_department_id: string
          p_employee_id: string
          p_reassign_to?: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: number
      }
      submit_report: {
        Args: {
          p_address?: string
          p_category_code: string
          p_description: string
          p_latitude: number
          p_location_accuracy_m?: number
          p_longitude: number
          p_municipality_id: string
          p_visibility?: Database["public"]["Enums"]["report_visibility"]
        }
        Returns: {
          report_id: string
          tracking_number: string
        }[]
      }
      unconfirm_report: { Args: { p_report_id: string }; Returns: undefined }
      unfollow_report: { Args: { p_report_id: string }; Returns: undefined }
      update_report_status: {
        Args: {
          p_duplicate_of_id?: string
          p_note?: string
          p_note_is_public?: boolean
          p_rejection_reason?: Database["public"]["Enums"]["report_rejection_reason"]
          p_report_id: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      announcement_severity: "info" | "important" | "emergency"
      app_locale: "he" | "ar" | "en"
      attachment_kind: "citizen_photo" | "completion_photo"
      content_status: "draft" | "published" | "archived"
      invitation_status: "pending" | "accepted" | "declined" | "revoked"
      municipality_status: "onboarding" | "active" | "suspended"
      notification_type: "report_status_changed" | "report_comment" | "system"
      report_priority: "low" | "normal" | "high" | "urgent"
      report_rejection_reason:
        | "duplicate"
        | "not_municipal_responsibility"
        | "insufficient_information"
        | "not_found_on_site"
        | "spam_or_abuse"
        | "other"
      report_status:
        | "submitted"
        | "under_review"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
        | "rejected"
      report_visibility: "public" | "private"
      staff_role:
        | "employee"
        | "intake_dispatcher"
        | "department_manager"
        | "municipality_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      announcement_severity: ["info", "important", "emergency"],
      app_locale: ["he", "ar", "en"],
      attachment_kind: ["citizen_photo", "completion_photo"],
      content_status: ["draft", "published", "archived"],
      invitation_status: ["pending", "accepted", "declined", "revoked"],
      municipality_status: ["onboarding", "active", "suspended"],
      notification_type: ["report_status_changed", "report_comment", "system"],
      report_priority: ["low", "normal", "high", "urgent"],
      report_rejection_reason: [
        "duplicate",
        "not_municipal_responsibility",
        "insufficient_information",
        "not_found_on_site",
        "spam_or_abuse",
        "other",
      ],
      report_status: [
        "submitted",
        "under_review",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
        "rejected",
      ],
      report_visibility: ["public", "private"],
      staff_role: [
        "employee",
        "intake_dispatcher",
        "department_manager",
        "municipality_admin",
      ],
    },
  },
} as const
