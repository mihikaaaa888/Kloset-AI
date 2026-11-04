// Auto-maintained Supabase database type definitions.
// These must stay in sync with the SQL schema in supabase/schema.sql.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          age_range: string | null
          occupation: string | null
          lifestyle: string | null
          style_preferences: string[]
          typical_occasions: string[]
          favourite_colours: string[]
          avoid_colours: string[]
          gender_style_preference: string | null
          recommendation_frequency: string | null
          onboarding_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          age_range?: string | null
          occupation?: string | null
          lifestyle?: string | null
          style_preferences?: string[]
          typical_occasions?: string[]
          favourite_colours?: string[]
          avoid_colours?: string[]
          gender_style_preference?: string | null
          recommendation_frequency?: string | null
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          age_range?: string | null
          occupation?: string | null
          lifestyle?: string | null
          style_preferences?: string[]
          typical_occasions?: string[]
          favourite_colours?: string[]
          avoid_colours?: string[]
          gender_style_preference?: string | null
          recommendation_frequency?: string | null
          onboarding_complete?: boolean
          updated_at?: string
        }
      }
      wardrobe_items: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          subcategory: string | null
          neckline_closure: string | null
          construction: string | null
          image_id: string | null
          image_url: string | null
          image_storage_path: string | null
          image_source: string
          colour: string[]
          material: string | null
          pattern: string | null
          fit: string | null
          formality: string | null
          seasons: string[]
          occasions: string[]
          brand: string | null
          notes: string | null
          is_favourite: boolean
          times_worn: number
          last_worn: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: string
          subcategory?: string | null
          neckline_closure?: string | null
          construction?: string | null
          image_id?: string | null
          image_url?: string | null
          image_storage_path?: string | null
          image_source?: string
          colour?: string[]
          material?: string | null
          pattern?: string | null
          fit?: string | null
          formality?: string | null
          seasons?: string[]
          occasions?: string[]
          brand?: string | null
          notes?: string | null
          is_favourite?: boolean
          times_worn?: number
          last_worn?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          category?: string
          subcategory?: string | null
          neckline_closure?: string | null
          construction?: string | null
          image_id?: string | null
          image_url?: string | null
          image_storage_path?: string | null
          image_source?: string
          colour?: string[]
          material?: string | null
          pattern?: string | null
          fit?: string | null
          formality?: string | null
          seasons?: string[]
          occasions?: string[]
          brand?: string | null
          notes?: string | null
          is_favourite?: boolean
          times_worn?: number
          last_worn?: string | null
          updated_at?: string
        }
      }
      saved_outfits: {
        Row: {
          id: string
          user_id: string
          name: string
          occasion: string | null
          weather: string | null
          mood: string | null
          styling_notes: string | null
          why_it_works: string | null
          generated_at: string
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          occasion?: string | null
          weather?: string | null
          mood?: string | null
          styling_notes?: string | null
          why_it_works?: string | null
          generated_at?: string
          source?: string
          created_at?: string
        }
        Update: {
          name?: string
          occasion?: string | null
          weather?: string | null
          mood?: string | null
          styling_notes?: string | null
          why_it_works?: string | null
        }
      }
      outfit_items: {
        Row: {
          id: string
          outfit_id: string
          item_id: string
          role: string | null
        }
        Insert: {
          id?: string
          outfit_id: string
          item_id: string
          role?: string | null
        }
        Update: {
          role?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
