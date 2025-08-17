"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    SAFEVOICE_CONFIG?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof window !== "undefined" ? window.SAFEVOICE_CONFIG?.supabaseUrl : "")) as string;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof window !== "undefined" ? window.SAFEVOICE_CONFIG?.supabaseAnonKey : "")) as string;

  // Avoid initializing during server build without envs
  if (!url || !anon) {
    if (typeof window === "undefined") {
      // Return a typed placeholder that will never be used on the server during build
      return (null as unknown) as SupabaseClient;
    }
    throw new Error("Supabase env vars are missing");
  }

  cachedClient = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        "x-client-info": "thesafevoice-web-next",
      },
    },
  });
  return cachedClient;
}


