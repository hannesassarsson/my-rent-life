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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience_scope: string
          body: string
          building_id: string | null
          category: string
          created_at: string
          id: string
          is_pinned: boolean
          is_published: boolean
          organization_id: string
          property_id: string | null
          published_at: string | null
          title: string
          unit_ids: string[] | null
        }
        Insert: {
          audience_scope?: string
          body: string
          building_id?: string | null
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          organization_id: string
          property_id?: string | null
          published_at?: string | null
          title: string
          unit_ids?: string[] | null
        }
        Update: {
          audience_scope?: string
          body?: string
          building_id?: string | null
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          organization_id?: string
          property_id?: string | null
          published_at?: string | null
          title?: string
          unit_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_by_name: string | null
          created_at: string
          ends_at: string
          id: string
          organization_id: string
          resource_id: string
          starts_at: string
          status: string
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          booked_by_name?: string | null
          created_at?: string
          ends_at: string
          id?: string
          organization_id: string
          resource_id: string
          starts_at: string
          status?: string
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          booked_by_name?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          organization_id?: string
          resource_id?: string
          starts_at?: string
          status?: string
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          floors: number | null
          id: string
          name: string
          organization_id: string
          property_id: string
        }
        Insert: {
          floors?: number | null
          id?: string
          name: string
          organization_id: string
          property_id: string
        }
        Update: {
          floors?: number | null
          id?: string
          name?: string
          organization_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          agreement_note: string | null
          category: string | null
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          organization_id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          agreement_note?: string | null
          category?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          organization_id: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          agreement_note?: string | null
          category?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_kind: string
          file_size: string | null
          id: string
          organization_id: string
          property_id: string | null
          storage_path: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_kind?: string
          file_size?: string | null
          id?: string
          organization_id: string
          property_id?: string | null
          storage_path?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_kind?: string
          file_size?: string | null
          id?: string
          organization_id?: string
          property_id?: string | null
          storage_path?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          inspector_name: string | null
          kind: string
          note: string | null
          organization_id: string
          scheduled_at: string | null
          status: string
          unit_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          inspector_name?: string | null
          kind?: string
          note?: string | null
          organization_id: string
          scheduled_at?: string | null
          status?: string
          unit_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          inspector_name?: string | null
          kind?: string
          note?: string | null
          organization_id?: string
          scheduled_at?: string | null
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_comments: {
        Row: {
          author_name: string
          author_role: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          organization_id: string
          request_id: string
        }
        Insert: {
          author_name: string
          author_role?: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          organization_id: string
          request_id: string
        }
        Update: {
          author_name?: string
          author_role?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_events: {
        Row: {
          created_at: string
          id: string
          label: string
          organization_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          organization_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          organization_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_projects: {
        Row: {
          budget: number | null
          created_at: string
          id: string
          note: string | null
          organization_id: string
          property_id: string | null
          status: string
          title: string
          year: number
        }
        Insert: {
          budget?: number | null
          created_at?: string
          id?: string
          note?: string | null
          organization_id: string
          property_id?: string | null
          status?: string
          title: string
          year: number
        }
        Update: {
          budget?: number | null
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          property_id?: string | null
          status?: string
          title?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assignee_name: string | null
          category: string
          contractor_id: string | null
          created_at: string
          description: string | null
          id: string
          is_urgent: boolean
          organization_id: string
          priority: Database["public"]["Enums"]["request_priority"]
          reported_by: string | null
          reporter_name: string | null
          resolved_at: string | null
          room: string | null
          status: Database["public"]["Enums"]["request_status"]
          ticket_number: number
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          category: string
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_urgent?: boolean
          organization_id: string
          priority?: Database["public"]["Enums"]["request_priority"]
          reported_by?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          ticket_number?: number
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          category?: string
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_urgent?: boolean
          organization_id?: string
          priority?: Database["public"]["Enums"]["request_priority"]
          reported_by?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          ticket_number?: number
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          attendee_name: string | null
          created_at: string
          id: string
          meeting_id: string
          organization_id: string
          status: string
          user_id: string
        }
        Insert: {
          attendee_name?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          organization_id: string
          status?: string
          user_id: string
        }
        Update: {
          attendee_name?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          organization_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          created_at: string
          id: string
          location: string | null
          meeting_type: string
          motions: string | null
          organization_id: string
          protocol_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          id?: string
          location?: string | null
          meeting_type?: string
          motions?: string | null
          organization_id: string
          protocol_url?: string | null
          starts_at: string
          title: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          id?: string
          location?: string | null
          meeting_type?: string
          motions?: string | null
          organization_id?: string
          protocol_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          organization_id: string
          request_id: string | null
          resident_user_id: string | null
          sender_name: string
          sender_role: string
          sender_user_id: string | null
          subject: string | null
          thread_key: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          organization_id: string
          request_id?: string | null
          resident_user_id?: string | null
          sender_name: string
          sender_role?: string
          sender_user_id?: string | null
          subject?: string | null
          thread_key: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          request_id?: string | null
          resident_user_id?: string | null
          sender_name?: string
          sender_role?: string
          sender_user_id?: string | null
          subject?: string | null
          thread_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          organization_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_type: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_type?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_type?: string
          slug?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          kind: string
          organization_id: string
          paid_at: string | null
          period: string
          status: string
          unit_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          kind?: string
          organization_id: string
          paid_at?: string | null
          period: string
          status?: string
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          kind?: string
          organization_id?: string
          paid_at?: string | null
          period?: string
          status?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          build_year: number | null
          city: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          postal_code: string | null
        }
        Insert: {
          address: string
          build_year?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          postal_code?: string | null
        }
        Update: {
          address?: string
          build_year?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      residencies: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          move_in_date: string | null
          organization_id: string
          phone: string | null
          resident_name: string
          status: string
          tenure: Database["public"]["Enums"]["tenure_type"]
          unit_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          move_in_date?: string | null
          organization_id: string
          phone?: string | null
          resident_name: string
          status?: string
          tenure?: Database["public"]["Enums"]["tenure_type"]
          unit_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          move_in_date?: string | null
          organization_id?: string
          phone?: string | null
          resident_name?: string
          status?: string
          tenure?: Database["public"]["Enums"]["tenure_type"]
          unit_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residencies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          cancel_hours: number
          days_ahead: number
          icon: string | null
          id: string
          is_active: boolean
          kind: string
          location: string | null
          max_active_bookings: number
          name: string
          open_from: string
          open_to: string
          organization_id: string
          property_id: string | null
          slot_minutes: number
        }
        Insert: {
          cancel_hours?: number
          days_ahead?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          location?: string | null
          max_active_bookings?: number
          name: string
          open_from?: string
          open_to?: string
          organization_id: string
          property_id?: string | null
          slot_minutes?: number
        }
        Update: {
          cancel_hours?: number
          days_ahead?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          location?: string | null
          max_active_bookings?: number
          name?: string
          open_from?: string
          open_to?: string
          organization_id?: string
          property_id?: string | null
          slot_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string
          balcony: boolean
          building_id: string
          floor: number | null
          id: string
          key_count: number
          monthly_amount: number | null
          object_number: string | null
          organization_id: string
          parking: string | null
          rooms: number | null
          size_sqm: number | null
          status: string
          storage: string | null
          tenure: Database["public"]["Enums"]["tenure_type"]
          unit_number: string
        }
        Insert: {
          address: string
          balcony?: boolean
          building_id: string
          floor?: number | null
          id?: string
          key_count?: number
          monthly_amount?: number | null
          object_number?: string | null
          organization_id: string
          parking?: string | null
          rooms?: number | null
          size_sqm?: number | null
          status?: string
          storage?: string | null
          tenure?: Database["public"]["Enums"]["tenure_type"]
          unit_number: string
        }
        Update: {
          address?: string
          balcony?: boolean
          building_id?: string
          floor?: number | null
          id?: string
          key_count?: number
          monthly_amount?: number | null
          object_number?: string | null
          organization_id?: string
          parking?: string | null
          rooms?: number | null
          size_sqm?: number | null
          status?: string
          storage?: string | null
          tenure?: Database["public"]["Enums"]["tenure_type"]
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      current_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org: string; _user_id: string }
        Returns: boolean
      }
      is_org_staff: {
        Args: { _org: string; _user_id: string }
        Returns: boolean
      }
      my_unit_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "org_admin"
        | "property_manager"
        | "board_member"
        | "staff"
        | "contractor"
        | "resident"
      request_priority: "low" | "normal" | "high" | "urgent"
      request_status:
        | "new"
        | "received"
        | "assigned"
        | "booked"
        | "in_progress"
        | "resolved"
        | "closed"
      tenure_type: "owned" | "rented"
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
      app_role: [
        "super_admin",
        "org_admin",
        "property_manager",
        "board_member",
        "staff",
        "contractor",
        "resident",
      ],
      request_priority: ["low", "normal", "high", "urgent"],
      request_status: [
        "new",
        "received",
        "assigned",
        "booked",
        "in_progress",
        "resolved",
        "closed",
      ],
      tenure_type: ["owned", "rented"],
    },
  },
} as const
