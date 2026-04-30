export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          created_at?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string | null
        }
      }
      project_members: {
        Row: {
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer' | null
        }
        Insert: {
          project_id: string
          user_id: string
          role?: 'owner' | 'editor' | 'viewer' | null
        }
        Update: {
          project_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer' | null
        }
      }
      forms: {
        Row: {
          id: string
          draft_schema: Json
          status: 'draft' | 'published' | 'archived' | null
          project_id: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          draft_schema?: Json
          status?: 'draft' | 'published' | 'archived' | null
          project_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          draft_schema?: Json
          status?: 'draft' | 'published' | 'archived' | null
          project_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      form_versions: {
        Row: {
          id: string
          form_id: string
          title: string
          content: Json
          version: number
          created_at: string | null
        }
        Insert: {
          id?: string
          form_id: string
          title: string
          content: Json
          version: number
          created_at?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          title?: string
          content?: Json
          version?: number
          created_at?: string | null
        }
      }
      form_members: {
        Row: {
          form_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer' | 'submitter' | null
        }
        Insert: {
          form_id: string
          user_id: string
          role?: 'owner' | 'editor' | 'viewer' | 'submitter' | null
        }
        Update: {
          form_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer' | 'submitter' | null
        }
      }
      submissions: {
        Row: {
          id: string
          form_id: string
          form_version_id: string
          submitted_by: string | null
          data: Json
          filled_at: string | null
          synced_at: string | null
        }
        Insert: {
          id?: string
          form_id: string
          form_version_id: string
          submitted_by?: string | null
          data: Json
          filled_at?: string | null
          synced_at?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          form_version_id?: string
          submitted_by?: string | null
          data?: Json
          filled_at?: string | null
          synced_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
