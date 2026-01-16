// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// ✅ supabase.ts와 동일한 방식으로 env + fallback 사용
const FALLBACK_URL = "https://vtejlkxltifytyvbeato.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZWpsa3hsdGlmeXR5dmJlYXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTIwMjYsImV4cCI6MjA3ODE4ODAyNn0._Si89F6l15uJ1ms1WbYIRy8X_TFaZPxCjN9GBETBagI";

const url = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

// ✅ admin 세션을 일반 세션과 분리 (핵심)
const ADMIN_STORAGE_KEY = "dg_admin_auth";

export const supabaseAdmin = createClient(url, key, {
  auth: {
    storageKey: ADMIN_STORAGE_KEY,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
