import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type ShopMembership = {
  shop_id: string;
  role: "owner" | "manager" | "staff";
  shops: {
    id: string;
    name: string;
    slug: string;
    whatsapp: string | null;
    description: string | null;
    logo_url: string | null;
    theme: any;
    target_margin: number;
    is_approved: boolean;
  };
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  shops: ShopMembership[];
  currentShop: ShopMembership | null;
  setCurrentShopId: (id: string) => void;
  signOut: () => Promise<void>;
  refreshShops: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "jm_current_shop_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with the same initial state on server and client to avoid hydration
  // mismatches. We hydrate auth from localStorage/Supabase only after mount.
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [shops, setShops] = useState<ShopMembership[]>([]);
  const [currentShopId, setCurrentShopIdState] = useState<string | null>(null);

  const setCurrentShopId = (id: string) => {
    setCurrentShopIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const loadShops = async (userId: string, preferredShopId?: string | null) => {
    const { data, error } = await supabase
      .from("shop_members")
      .select("shop_id, role, shops(id, name, slug, whatsapp, description, logo_url, theme, target_margin, is_approved)")
      .eq("user_id", userId);
    if (error) {
      console.error("loadShops error", error);
      setShops([]);
      return;
    }
    const memberships = (data ?? []) as unknown as ShopMembership[];
    setShops(memberships);
    if (memberships.length === 0) {
      setCurrentShopIdState(null);
      return;
    }

    const nextShopId = memberships.some((m) => m.shop_id === preferredShopId)
      ? preferredShopId!
      : memberships[0].shop_id;

    setCurrentShopIdState(nextShopId);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, nextShopId);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedShopId = localStorage.getItem(STORAGE_KEY);
    if (storedShopId) setCurrentShopIdState(storedShopId);

    let resolved = false;
    let lastSessionUserId: string | null | undefined;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    };

    const syncSession = (newSession: Session | null) => {
      setSession(newSession);
      finish();

      const userId = newSession?.user?.id;
      if (lastSessionUserId === userId) return;
      lastSessionUserId = userId;

      if (newSession?.user) {
        void loadShops(newSession.user.id, storedShopId);
      } else {
        setShops([]);
        setCurrentShopIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    // Safety net — never hang on the loader
    const timeout = setTimeout(finish, 800);

    // 1. Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      syncSession(newSession);
    });

    // 2. Then check existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: existing } }) => {
        syncSession(existing);
      })
      .catch(finish);

    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const currentShop = shops.find((s) => s.shop_id === currentShopId) ?? shops[0] ?? null;

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        shops,
        currentShop,
        setCurrentShopId,
        signOut: async () => {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
        },
        refreshShops: async () => {
          if (session?.user) await loadShops(session.user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
