"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast, Toaster } from "sonner";
import { api, APIError, errorText } from "@/lib/api";
import type {
  User,
  Recipient,
  Favorite,
  GiftRequest,
  GiftEvent,
  Collection,
  Integrations,
  Product,
} from "@/lib/types";

interface Store {
  user: User | null;
  setUser: (u: User | null) => void;
  authLoading: boolean;
  loading: boolean;
  error: string;
  recipients: Recipient[];
  favorites: Favorite[];
  requests: GiftRequest[];
  events: GiftEvent[];
  collections: Collection[];
  integrations: Integrations | null;
  refresh: () => Promise<void>;
  toggleFavorite: (p: Product) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<Store | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [loadedUserId, setLoadedUserId] = useState("");
  const userId = user?.id || "";
  const [recipients, setRecipients] = useState<Recipient[]>([]),
    [favorites, setFavorites] = useState<Favorite[]>([]),
    [requests, setRequests] = useState<GiftRequest[]>([]),
    [events, setEvents] = useState<GiftEvent[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [integrations, setIntegrations] = useState<Integrations | null>(null);
  const activeUser = useRef<User | null>(null);
  const setUser = useCallback((next: User | null) => {
    if (next?.id !== activeUser.current?.id) {
      setRecipients([]);
      setFavorites([]);
      setRequests([]);
      setEvents([]);
      setCollections([]);
      setIntegrations(null);
      setLoadedUserId("");
      setError("");
      setLoading(false);
    }
    activeUser.current = next;
    setUserState(next);
  }, []);
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof APIError) || e.status !== 401) setError(errorText(e));
      })
      .finally(() => setAuthLoading(false));
    const expire = () => {
      setUser(null);
      toast.error("Сессия истекла. Войдите снова.");
    };
    window.addEventListener("gifty:session-expired", expire);
    return () => window.removeEventListener("gifty:session-expired", expire);
  }, [setUser]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, f, h, e, c, i] = await Promise.all([
        api<Recipient[]>("/recipients"),
        api<Favorite[]>("/favorites"),
        api<GiftRequest[]>("/requests"),
        api<GiftEvent[]>("/events"),
        api<Collection[]>("/collections"),
        api<Integrations>("/integrations"),
      ]);
      if (activeUser.current?.id !== userId) return;
      setRecipients(r);
      setFavorites(f);
      setRequests(h);
      setEvents(e);
      setCollections(c);
      setIntegrations(i);
      setLoadedUserId(userId);
    } catch (e) {
      if (activeUser.current?.id === userId) setError(errorText(e));
    } finally {
      if (activeUser.current?.id === userId) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([
      api<Recipient[]>("/recipients"),
      api<Favorite[]>("/favorites"),
      api<GiftRequest[]>("/requests"),
      api<GiftEvent[]>("/events"),
      api<Collection[]>("/collections"),
      api<Integrations>("/integrations"),
    ])
      .then(([r, f, h, e, c, i]) => {
        if (active) {
          setRecipients(r);
          setFavorites(f);
          setRequests(h);
          setEvents(e);
          setCollections(c);
          setIntegrations(i);
          setLoadedUserId(userId);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
          setLoadedUserId(userId);
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const toggleFavorite = useCallback(
    async (product: Product) => {
      const owner = activeUser.current?.id;
      const exists = favorites.some((f) => f.product.id === product.id);
      try {
        if (exists) {
          await api(`/favorites/${product.id}`, { method: "DELETE" });
          if (activeUser.current?.id !== owner) return;
          setFavorites((current) => current.filter((f) => f.product.id !== product.id));
          toast("Убрали из избранного");
        } else {
          const favorite = await api<Favorite>(`/favorites/${product.id}`, { method: "PUT" });
          if (activeUser.current?.id !== owner) return;
          setFavorites((current) =>
            current.some((f) => f.product.id === product.id) ? current : [favorite, ...current],
          );
          toast.success("Сохранили в избранное");
        }
      } catch (e) {
        toast.error(errorText(e));
      }
    },
    [favorites],
  );
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  };
  const ready = !!user && loadedUserId === user.id;
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        authLoading,
        loading: loading || (!!user && !ready),
        error,
        recipients: ready ? recipients : [],
        favorites: ready ? favorites : [],
        requests: ready ? requests : [],
        events: ready ? events : [],
        collections: ready ? collections : [],
        integrations: ready ? integrations : null,
        refresh,
        toggleFavorite,
        logout,
      }}
    >
      {children}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ className: "gifty-toast" }}
      />
    </Context.Provider>
  );
}
export function useGifty() {
  const context = useContext(Context);
  if (!context) throw new Error("Providers missing");
  return context;
}
