"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Heart, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { api, errorText, json } from "@/lib/api";
import type { User } from "@/lib/types";
import { useGifty } from "@/components/providers";
import { ErrorState, Field, Logo } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HeroArt } from "@/components/hero-art";

export default function LoginPage() {
  const { user, setUser, authLoading } = useGifty();
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [demoBusy, setDemoBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [privacy, setPrivacy] = useState(false);
  useEffect(() => {
    if (user && !authLoading) router.replace("/");
  }, [user, authLoading, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<User>(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: json({ name, email, password, privacy_accepted: privacy }),
      });
      setUser(result);
      router.replace("/");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setDemoBusy(true);
    setError("");
    try {
      setUser(await api<User>("/auth/demo", { method: "POST" }));
      router.replace("/");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDemoBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-form-side">
        <Logo />
        <div className="auth-form-wrap">
          <span className="eyebrow">ДЛЯ ЛЮДЕЙ, КОТОРЫЕ ВАМ ВАЖНЫ</span>
          <h1>
            {register ? "Начнём с знакомства" : "Рады снова видеть"}
            <span className="auth-title-dot">.</span>
          </h1>
          <p className="auth-description">
            {register
              ? "Создайте своё пространство заботы и хороших идей."
              : "Ваши люди, их интересы и те самые подарки — всё здесь."}
          </p>
          <div className="segmented-control auth-tabs">
            <button
              onClick={() => {
                setRegister(false);
                setError("");
              }}
              className={!register ? "active" : ""}
            >
              Войти
            </button>
            <button
              onClick={() => {
                setRegister(true);
                setError("");
              }}
              className={register ? "active" : ""}
            >
              Создать аккаунт
            </button>
          </div>
          <form className="form-stack" onSubmit={submit}>
            {register && (
              <Field label="Как к вам обращаться">
                <Input
                  required
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Ваше имя"
                />
              </Field>
            )}
            <Field label="Электронная почта">
              <Input
                required
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.ru"
              />
            </Field>
            <Field label="Пароль" hint={register ? "Не менее 10 символов" : ""}>
              <span className="password-input">
                <Input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={register ? "Придумайте надёжный пароль" : "Ваш пароль"}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </Field>
            {register && (
              <label className="privacy-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                />
                <span>
                  Я ознакомился с{" "}
                  <Link href="/privacy" target="_blank">
                    политикой конфиденциальности
                  </Link>{" "}
                  и принимаю условия обработки данных аккаунта.
                </span>
              </label>
            )}
            {error && <ErrorState message={error} />}
            <Button size="lg" type="submit" className="w-full" disabled={busy || demoBusy}>
              {busy ? <Loader2 size={18} className="spin" /> : null}
              {register ? "Создать аккаунт" : "Войти в своё пространство"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-divider">
            <span />
            или просто познакомиться
            <span />
          </div>
          <Button
            variant="outline"
            size="lg"
            className="w-full demo-login"
            disabled={busy || demoBusy}
            onClick={() => void demo()}
          >
            {demoBusy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}Попробовать
            демо
          </Button>
          <p className="auth-footnote">
            Отдельный демоаккаунт с вымышленными людьми.
            <br />
            Без API-ключей и передачи данных внешнему ИИ.
          </p>
        </div>
        <div className="auth-bottom">
          <span>© {new Date().getFullYear()} Gifty AI</span>
          <Link href="/privacy">
            <ShieldCheck size={13} />
            Ваши данные под защитой
          </Link>
        </div>
      </section>
      <section className="auth-story-side">
        <span className="auth-story-kicker">
          <Heart size={14} />
          БЛИЖЕ К ТЕМ, КТО БЛИЗОК
        </span>
        <h2>
          Не просто подарок.
          <br />
          <span>«Я тебя знаю».</span>
        </h2>
        <p>
          Для подруги, которая рисует по ночам.
          <br />
          Для папы, у которого «всё есть».
          <br />
          Для каждого вашего человека.
        </p>
        <HeroArt className="auth-hero-art" />
        <div className="auth-story-caption">
          <span className="caption-line" />
          <p>
            Меньше поисков.
            <br />
            <strong>Больше тёплых моментов.</strong>
          </p>
        </div>
        <span className="auth-story-corner">с заботой, gifty.</span>
      </section>
    </div>
  );
}
