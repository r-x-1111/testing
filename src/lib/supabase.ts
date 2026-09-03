import { createClient } from '@supabase/supabase-js';

// Hardcoding directly into the initialization to bypass broken environment variables entirely
export const supabase = createClient(
  "https://supabase.co", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykeyplaceholder"
);