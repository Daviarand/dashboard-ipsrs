/**
 * Database Types Definition — Dashboard IPSRS RS. Soeharto Heerdjan
 *
 * Catatan Arsitektur (Bagian 11.4 IPSRS_DASHBOARD_SPEC.md):
 * File ini ditulis secara manual sesuai skema database Supabase PostgreSQL
 * karena lingkungan pengembangan berjalan tanpa Docker dan tanpa Supabase CLI.
 *
 * Kompatibel penuh dengan `createClient<Database>()` dari `@supabase/supabase-js`.
 * Jika di masa depan CLI resmi digunakan, file ini dapat diperbarui dengan
 * perintah: `supabase gen types typescript --project-id <id> > src/types/database.ts`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      rooms: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      damage_types: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      failure_reasons: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      app_settings: {
        Row: {
          key: string;
          value: string;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      materials: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string | null;
          unit: string;
          min_stock: number;
          current_stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          category?: string | null;
          unit: string;
          min_stock?: number;
          current_stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          category?: string | null;
          unit?: string;
          min_stock?: number;
          current_stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      ticket_counters: {
        Row: {
          period: string;
          last_value: number;
        };
        Insert: {
          period: string;
          last_value?: number;
        };
        Update: {
          period?: string;
          last_value?: number;
        };
        Relationships: [];
      };

      tickets: {
        Row: {
          id: string;
          ticket_no: string;
          room_id: string;
          reporter_name: string;
          reported_at: string;
          description: string;
          damage_type_id: string;
          difficulty: Database["public"]["Enums"]["ticket_difficulty"] | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status: Database["public"]["Enums"]["ticket_status"];
          started_at: string | null;
          finished_at: string | null;
          work_done: string | null;
          reporter_verified: boolean | null;
          verifier_name: string | null;
          duration_minutes: number | null;
          classification: Database["public"]["Enums"]["ticket_classification"] | null;
          failure_reason_id: string | null;
          failure_reason_note: string | null;
          vendor_name: string | null;
          cancel_reason: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_no?: string;
          room_id: string;
          reporter_name: string;
          reported_at: string;
          description: string;
          damage_type_id: string;
          difficulty?: Database["public"]["Enums"]["ticket_difficulty"] | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          status?: Database["public"]["Enums"]["ticket_status"];
          started_at?: string | null;
          finished_at?: string | null;
          work_done?: string | null;
          reporter_verified?: boolean | null;
          verifier_name?: string | null;
          duration_minutes?: number | null;
          classification?: Database["public"]["Enums"]["ticket_classification"] | null;
          failure_reason_id?: string | null;
          failure_reason_note?: string | null;
          vendor_name?: string | null;
          cancel_reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_no?: string;
          room_id?: string;
          reporter_name?: string;
          reported_at?: string;
          description?: string;
          damage_type_id?: string;
          difficulty?: Database["public"]["Enums"]["ticket_difficulty"] | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          status?: Database["public"]["Enums"]["ticket_status"];
          started_at?: string | null;
          finished_at?: string | null;
          work_done?: string | null;
          reporter_verified?: boolean | null;
          verifier_name?: string | null;
          duration_minutes?: number | null;
          classification?: Database["public"]["Enums"]["ticket_classification"] | null;
          failure_reason_id?: string | null;
          failure_reason_note?: string | null;
          vendor_name?: string | null;
          cancel_reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_room_id_fkey";
            columns: ["room_id"];
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_damage_type_id_fkey";
            columns: ["damage_type_id"];
            referencedRelation: "damage_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_failure_reason_id_fkey";
            columns: ["failure_reason_id"];
            referencedRelation: "failure_reasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      ticket_assignments: {
        Row: {
          id: string;
          ticket_id: string;
          user_id: string;
          is_lead: boolean;
          assigned_by: string | null;
          assigned_at: string;
          released_at: string | null;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          user_id: string;
          is_lead?: boolean;
          assigned_by?: string | null;
          assigned_at?: string;
          released_at?: string | null;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          user_id?: string;
          is_lead?: boolean;
          assigned_by?: string | null;
          assigned_at?: string;
          released_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey";
            columns: ["ticket_id"];
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_assignments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      ticket_notes: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_id?: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey";
            columns: ["ticket_id"];
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_notes_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      ticket_status_history: {
        Row: {
          id: string;
          ticket_id: string;
          from_status: Database["public"]["Enums"]["ticket_status"] | null;
          to_status: Database["public"]["Enums"]["ticket_status"];
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          from_status?: Database["public"]["Enums"]["ticket_status"] | null;
          to_status: Database["public"]["Enums"]["ticket_status"];
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          from_status?: Database["public"]["Enums"]["ticket_status"] | null;
          to_status?: Database["public"]["Enums"]["ticket_status"];
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey";
            columns: ["ticket_id"];
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          }
        ];
      };

      ticket_attachments: {
        Row: {
          id: string;
          ticket_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey";
            columns: ["ticket_id"];
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          }
        ];
      };

      stock_movements: {
        Row: {
          id: string;
          material_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          qty_change: number;
          ticket_id: string | null;
          note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          qty_change: number;
          ticket_id?: string | null;
          note?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          type?: Database["public"]["Enums"]["stock_movement_type"];
          qty_change?: number;
          ticket_id?: string | null;
          note?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey";
            columns: ["material_id"];
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_ticket_id_fkey";
            columns: ["ticket_id"];
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          }
        ];
      };

      activity_logs: {
        Row: {
          id: number;
          user_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          user_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          user_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      v_tickets: {
        Row: {
          id: string;
          ticket_no: string;
          room_id: string;
          room_name: string;
          reporter_name: string;
          reported_at: string;
          input_at: string;
          description: string;
          damage_type_id: string;
          damage_type_name: string;
          difficulty: Database["public"]["Enums"]["ticket_difficulty"] | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status: Database["public"]["Enums"]["ticket_status"];
          started_at: string | null;
          finished_at: string | null;
          work_done: string | null;
          reporter_verified: boolean | null;
          verifier_name: string | null;
          duration_minutes: number | null;
          classification: Database["public"]["Enums"]["ticket_classification"] | null;
          failure_reason_id: string | null;
          failure_reason_name: string | null;
          failure_reason_note: string | null;
          vendor_name: string | null;
          cancel_reason: string | null;
          created_by: string;
          updated_at: string;
          is_running: boolean;
          elapsed_minutes: number | null;
          effective_classification: Database["public"]["Enums"]["ticket_classification"] | null;
          is_overdue: boolean;
          is_near_deadline: boolean;
          has_attachment: boolean;
          needs_form_upload: boolean;
          assignees: {
            user_id: string;
            full_name: string;
            is_lead: boolean;
          }[];
          last_note: string | null;
        };
        Relationships: [];
      };

      v_materials: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string | null;
          unit: string;
          min_stock: number;
          current_stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          is_low_stock: boolean;
        };
        Relationships: [];
      };
    };

    Functions: {
      current_role_name: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_teknisi: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_assigned: {
        Args: {
          p_ticket: string;
        };
        Returns: boolean;
      };
      next_ticket_no: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_valid_ticket_transition: {
        Args: {
          p_old: Database["public"]["Enums"]["ticket_status"];
          p_new: Database["public"]["Enums"]["ticket_status"];
        };
        Returns: boolean;
      };
      f_tickets: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: Database["public"]["Views"]["v_tickets"]["Row"][];
      };
      rpc_dashboard_summary: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          total: number;
          running: number;
          finished: number;
          laksana: number;
          gagal_laksana: number;
          laksana_pct: number;
          avg_duration_minutes: number;
          median_duration_minutes: number;
        }[];
      };
      rpc_rooms_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          room_id: string;
          room_name: string;
          total: number;
          running: number;
          finished: number;
        }[];
      };
      rpc_staff_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          user_id: string;
          full_name: string;
          total: number;
          finished: number;
          avg_duration_minutes: number;
        }[];
      };
      rpc_materials_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          material_id: string;
          code: string;
          name: string;
          unit: string;
          used_qty: number;
          ticket_count: number;
          current_stock: number;
          min_stock: number;
        }[];
      };
      rpc_duration_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          group_type: string;
          group_name: string;
          ticket_count: number;
          avg_minutes: number;
          median_minutes: number;
        }[];
      };
      rpc_damage_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          damage_type_id: string;
          damage_type_name: string;
          total: number;
        }[];
      };
      rpc_damage_trend: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          month: string;
          damage_type_name: string;
          total: number;
        }[];
      };
      rpc_laksana_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_basis?: string;
        };
        Returns: {
          classification: string;
          failure_reason_name: string | null;
          total: number;
        }[];
      };
      rpc_change_status: {
        Args: {
          p_ticket_id: string;
          p_new_status: Database["public"]["Enums"]["ticket_status"];
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["tickets"]["Row"];
      };
      rpc_reopen_ticket: {
        Args: {
          p_ticket_id: string;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["tickets"]["Row"];
      };
      rpc_finish_ticket: {
        Args: {
          p_ticket_id: string;
          p_started_at: string;
          p_finished_at: string;
          p_work_done: string;
          p_reporter_verified: boolean;
          p_verifier_name: string;
          p_failure_reason_id?: string | null;
          p_failure_reason_note?: string | null;
          p_vendor_name?: string | null;
          p_materials?: Json;
        };
        Returns: Database["public"]["Tables"]["tickets"]["Row"];
      };
    };

    Enums: {
      user_role: "admin" | "teknisi";
      ticket_priority: "urgent" | "tinggi" | "sedang" | "rendah";
      ticket_status:
        | "baru"
        | "ditugaskan"
        | "dikerjakan"
        | "menunggu_material"
        | "selesai"
        | "dibatalkan";
      ticket_classification: "laksana" | "gagal_laksana";
      ticket_difficulty: "low" | "medium" | "hard";
      stock_movement_type: "masuk" | "keluar" | "koreksi";
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
