// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// ✅ 임시 폴백(환경변수 못 읽을 때 사용) — 나중에 지워도 됨
const FALLBACK_URL = 'https://vtejlkxltifytyvbeato.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZWpsa3hsdGlmeXR5dmJlYXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTIwMjYsImV4cCI6MjA3ODE4ODAyNn0._Si89F6l15uJ1ms1WbYIRy8X_TFaZPxCjN9GBETBagI';

const url = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

// 디버그용: 실제로 env가 읽혔는지 확인
console.log('ENV CHECK', {
  urlFromEnv: (import.meta as any).env?.VITE_SUPABASE_URL,
  keyFromEnv: !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY,
});

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
