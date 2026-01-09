import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; // or your existing import

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ✅ older CookieMethods API (most commonly required by typings)
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options, secure: false,});
        },
        remove(name: string, options: any) {
          // Next cookies API removes by setting empty + expired
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },

        // ✅ keep these if your runtime code uses them (harmless, but TS might complain if type is strict)
        // If TS complains about extra props, delete getAll/setAll.
        // getAll() {
        //   return cookieStore.getAll();
        // },
        // setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        //   cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options }));
        // },
      },
    }
  );
}
