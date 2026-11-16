"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Gift,
  Heart,
  History,
  Home,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { api, errorText, json } from "@/lib/api";
import type { User } from "@/lib/types";
import { cn, dateLabel } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./ui/dialog";
import { Avatar, Badge, ErrorState, Loading, Logo } from "./shared";
import { useGifty } from "./providers";

const navigation = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/people", label: "Мои люди", icon: Users },
  { href: "/assistant", label: "Подобрать подарок", icon: Sparkles },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/calendar", label: "Календарь событий", icon: CalendarDays },
  { href: "/history", label: "История подборок", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, authLoading, error, refresh, events, recipients, requests, logout } = useGifty();
  const pathname = usePathname(),
    router = useRouter();
  const [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [help, setHelp] = useState(false),
    [query, setQuery] = useState("");
  const isPublic = pathname === "/login" || pathname === "/privacy";
  useEffect(() => {
    if (!authLoading && !user && !isPublic) router.replace("/login");
  }, [authLoading, user, isPublic, router]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (isPublic) return <>{children}</>;
  if (authLoading || !user)
    return (
      <div className="boot-screen">
        <Logo />
        <Loading />
        {error && <ErrorState message={error} retry={() => window.location.reload()} />}
      </div>
    );
  const active = navigation.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  const pending = user.reminders_enabled
    ? events.filter((e) => e.days_until >= 0 && e.days_until <= e.reminder_days)
    : [];
  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  });
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={cn("sidebar", mobile && "sidebar-open")}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-close"
            aria-label="Закрыть меню"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="nav-caption">ВАШ КРУГ ЗАБОТЫ</p>
        <nav className="main-nav" aria-label="Основная навигация">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobile(false)}
              aria-current={active?.href === item.href ? "page" : undefined}
              className={cn("nav-item", active?.href === item.href && "nav-item-active")}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.href === "/people" && recipients.length > 0 && (
                <span className="nav-count">{recipients.length}</span>
              )}
              {item.href === "/assistant" && <span className="nav-ai">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Gift size={24} strokeWidth={1.5} />
          </span>
          <h3>Внимание — лучший подарок</h3>
          <p>А найти к нему что-то особенное поможем мы.</p>
          <Link href="/assistant" onClick={() => setMobile(false)}>
            Давайте подберём <ArrowRight size={14} />
          </Link>
        </div>
        <div className="sidebar-utility">
          <Link
            href="/settings"
            onClick={() => setMobile(false)}
            className={cn("nav-item", pathname === "/settings" && "nav-item-active")}
          >
            <Settings2 size={19} strokeWidth={1.7} />
            Настройки
          </Link>
          <button
            className="nav-item"
            onClick={() => {
              setHelp(true);
              setMobile(false);
            }}
          >
            <CircleHelp size={19} strokeWidth={1.7} />О сервисе
          </button>
        </div>
        <div className="sidebar-profile">
          <Link href="/settings" className="profile-link">
            <Avatar person={{ name: user.name, avatar: "peach" }} size="sm" />
            <span>
              <strong>{user.name}</strong>
              <small>{user.is_demo ? "Демоаккаунт" : "Личное пространство"}</small>
            </span>
          </Link>
          <button
            className="icon-button"
            title="Выйти"
            aria-label="Выйти из аккаунта"
            onClick={() => void logout().catch((e) => toast.error(errorText(e)))}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-muted">Моё пространство</span>
            <ChevronRight className="breadcrumb-chevron" size={14} />
            <span className="breadcrumb-current">
              {active?.label || (pathname === "/settings" ? "Настройки" : "Профиль получателя")}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Поиск"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span>Найти что-нибудь</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-date">{today}</span>
            <button
              className="icon-button notification-button"
              aria-label="Уведомления"
              onClick={() => setNotifications(true)}
            >
              <Bell size={20} strokeWidth={1.7} />
              {pending.length > 0 && <span className="notification-dot" />}
            </button>
          </div>
        </header>
        <main className="main-content" id="main">
          {error && <ErrorState message={error} retry={() => void refresh()} />}
          <div className="page-enter" key={pathname}>
            {children}
          </div>
        </main>
        <footer className="app-footer">
          <span>Дарить — значит быть ближе.</span>
          <Link href="/privacy">
            <ShieldCheck size={13} />
            Конфиденциальность
          </Link>
          <span>
            Сделано с заботой <Heart size={12} />
          </span>
        </footer>
      </div>
      <Onboarding />
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Найдём в вашем пространстве"
        description="Поиск по людям и сохранённым подборкам"
      >
        <div className="search-input">
          <Search size={20} />
          <Input
            autoFocus
            placeholder="Имя, повод или пожелание…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="search-results">
          {recipients
            .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
            .map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSearchOpen(false);
                  router.push(`/people/${r.id}`);
                }}
              >
                <Avatar person={r} size="sm" />
                <span>
                  {r.name}
                  <small>{r.relationship_type}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          {requests
            .filter((r) =>
              (r.recipient_name + r.occasion + r.prompt)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 4)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSearchOpen(false);
                  router.push(`/assistant?request=${r.id}`);
                }}
              >
                <span className="search-result-icon">
                  <Gift size={20} />
                </span>
                <span>
                  {r.occasion} · {r.recipient_name}
                  <small>Подборка · {r.recommendations.length} идей</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          {query &&
            !recipients.some((r) => r.name.toLowerCase().includes(query.toLowerCase())) &&
            !requests.some((r) =>
              (r.recipient_name + r.occasion + r.prompt)
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <p className="muted text-center">По вашему запросу ничего не нашлось</p>}
        </div>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Маленькие напоминания"
        description="Чтобы важные даты не проходили незаметно"
      >
        {pending.length ? (
          pending.map((event) => (
            <div className="notification-item" key={event.id}>
              <span className="empty-icon">
                <CalendarDays size={22} />
              </span>
              <div>
                <strong>{event.title}</strong>
                <p>
                  {dateLabel(event.next_date)} ·{" "}
                  {event.days_until === 0 ? "сегодня" : `через ${event.days_until} дн.`}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNotifications(false);
                  router.push(
                    `/assistant?recipient=${event.recipient_id || ""}&occasion=${encodeURIComponent(event.title)}`,
                  );
                }}
              >
                Подобрать
              </Button>
            </div>
          ))
        ) : (
          <div className="empty-state compact">
            <Check size={30} />
            <h3>Всё спокойно</h3>
            <p>
              {user.reminders_enabled
                ? "Сообщим здесь, когда приблизится важное событие."
                : "Напоминания выключены. Включить их можно в настройках."}
            </p>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setNotifications(false);
            router.push("/calendar");
          }}
        >
          Открыть календарь
          <ArrowRight size={16} />
        </Button>
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="Приятно познакомиться, это Gifty"
        description="Ваш помощник в поиске подарков со смыслом"
      >
        <div className="prose-small">
          <p>
            Сохраните интересы близких, выберите повод и бюджет. Помощник предложит идеи и объяснит,
            почему они могут подойти.
          </p>
          <p>
            В деморежиме используются вымышленные профили, условные цены и иллюстрации. Кнопка
            магазина открывает поиск по названию идеи.
          </p>
          <p>
            Чат, профили, избранное и календарь сохраняются в базе данных вашего аккаунта. Без
            подключённых API данные обрабатываются локально.
          </p>
          <Link href="/privacy" className="text-link" onClick={() => setHelp(false)}>
            О данных и конфиденциальности
            <ArrowRight size={15} />
          </Link>
        </div>
      </Modal>
    </div>
  );
}

function Onboarding() {
  const { user, setUser } = useGifty();
  const [step, setStep] = useState(0),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const cards = [
    {
      icon: Users,
      title: "Сначала — ваши люди",
      text: "Сохраните, чем увлекаются близкие. Gift DNA поможет собрать всё самое важное в одном профиле.",
    },
    {
      icon: Sparkles,
      title: "Расскажите о поводе",
      text: "Выберите получателя, задайте бюджет и поделитесь пожеланиями. Можно быстро получить идеи или обсудить детали с помощником.",
    },
    {
      icon: Heart,
      title: "Сохраните то самое",
      text: "Добавляйте идеи в избранное, собирайте наборы и возвращайтесь к подборкам. Мы напомним о ближайших поводах.",
    },
  ];
  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await api<User>("/settings", {
        method: "PUT",
        body: json({ ...user, onboarding_completed: true }),
      });
      setUser(updated);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  const card = cards[step];
  return (
    <Modal
      open={!!user && !user.onboarding_completed}
      onOpenChange={(value) => {
        if (!value) void finish();
      }}
      title="Подарки начинаются с внимания"
      description="Три простых шага к маленькому «это так про меня»"
      className="onboarding-modal"
    >
      <div className="onboarding-art">
        <card.icon size={46} strokeWidth={1.3} />
        <span className="onboarding-orbit">
          <Heart size={18} />
        </span>
        <span className="onboarding-orbit second">
          <Gift size={20} />
        </span>
      </div>
      <div className="onboarding-copy">
        <Badge tone="purple">ШАГ {step + 1} ИЗ 3</Badge>
        <h3>{card.title}</h3>
        <p>{card.text}</p>
      </div>
      {error && <ErrorState message={error} />}
      <div className="onboarding-footer">
        <div className="step-dots">
          {cards.map((_, i) => (
            <button
              key={i}
              aria-label={`Шаг ${i + 1}`}
              className={i === step ? "active" : ""}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <Button onClick={() => (step < 2 ? setStep(step + 1) : void finish())} disabled={saving}>
          {step === 2 ? "Начать дарить" : "Дальше"}
          <ArrowRight size={16} />
        </Button>
      </div>
      <button className="onboarding-skip" disabled={saving} onClick={() => void finish()}>
        Пропустить знакомство
      </button>
    </Modal>
  );
}
