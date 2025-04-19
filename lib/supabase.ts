import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = 'https://wdmqrcbqpugngbwqpytz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbXFyY2JxcHVnbmdid3FweXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Nzc5MzksImV4cCI6MjA1ODQ1MzkzOX0.rTwThEgczsKhJBUo6qpABQWFJXqXfrDf3ZV6UYxwudA';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true, // Rafraîchir automatiquement le token
    persistSession: true, // Persister la session dans le stockage local
    detectSessionInUrl: true, // Détecter la session dans l'URL (utile pour les liens magiques ou OAuth)
  },
});