"use client";
import { useState, type FormEvent } from "react";
import { Bookmark, Check, Gift, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "./providers";
import { Badge, DemoNotice, EmptyState, ErrorState, Field, SectionHeading } from "./shared";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { api, errorText, json } from "@/lib/api";
import type { Collection } from "@/lib/types";
import { rub } from "@/lib/utils";

const themes = [
  { id: "cozy", name: "Уютный вечер", description: "Истории, тепло и аромат чая", art: "tea" },
  {
    id: "creative",
    name: "Время творить",
    description: "Для вдохновения и новых идей",
    art: "paint",
  },
  { id: "wellness", name: "Забота о себе", description: "Маленькие полезные ритуалы", art: "yoga" },
  {
    id: "travel",
    name: "Навстречу миру",
    description: "Для новых дорог и впечатлений",
    art: "bottle",
  },
];
export function GiftSets() {
  const { recipients, collections, refresh } = useGifty();
  const [theme, setTheme] = useState("cozy"),
    [recipient, setRecipient] = useState(""),
    [budget, setBudget] = useState(5000),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = themes.find((t) => t.id === theme)!;
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<Collection>("/collections", {
        method: "POST",
        body: json({
          recipient_id: recipient || null,
          budget,
          theme,
          title: `Набор «${selected.name}»`,
        }),
      });
      await refresh();
      toast.success("Набор собран в вашем бюджете");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sets-intro panel">
        <div>
          <Badge tone="purple">
            <Sparkles size={12} />
            МАЛЕНЬКИЕ ИСТОРИИ
          </Badge>
          <h2>Подарки, которым хорошо вместе</h2>
          <p>
            Выберите настроение — соберём несколько вещей в один тёплый жест.
            <br />
            Общая сумма всегда остаётся в вашем бюджете.
          </p>
        </div>
        <img src="/products/tea.svg" alt="Иллюстрация чайного набора" />
      </div>
      <form onSubmit={create}>
        <div className="theme-grid">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`theme-card ${theme === t.id ? "selected" : ""}`}
            >
              <img src={`/products/${t.art}.svg`} alt="" />
              <span>
                <strong>{t.name}</strong>
                <small>{t.description}</small>
              </span>
              <span className="radio-indicator" />
            </button>
          ))}
        </div>
        <div className="set-create-bar panel">
          <Field label="Кому подарим">
            <Select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">Без профиля</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Бюджет всего набора, ₽">
            <Input
              type="number"
              required
              min={100}
              max={1000000}
              value={budget || ""}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Gift size={17} />}Собрать набор
          </Button>
        </div>
      </form>
      {error && <ErrorState message={error} />}
      <SectionHeading
        title="Ваши подарочные наборы"
        subtitle="Заменяйте детали, сохраняйте целую историю"
      />
      {collections.length ? (
        <div className="collections-grid">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Gift}
          title="История ещё не собрана"
          text="Выберите тему и бюджет — первый набор появится здесь."
        />
      )}
      <DemoNotice />
    </>
  );
}
export function CollectionCard({ collection }: { collection: Collection }) {
  const { refresh } = useGifty();
  const [pending, setPending] = useState(false);
  async function mutate(path: string, method: string, body?: unknown) {
    setPending(true);
    try {
      await api(path, { method, body: body ? json(body) : undefined });
      await refresh();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="collection-card panel">
      <div className="collection-title">
        <span className="empty-icon">
          <Gift size={22} />
        </span>
        <div>
          <h3>{collection.title}</h3>
          <span>
            {collection.items.length} идеи · бюджет {rub(collection.budget)}
          </span>
        </div>
        <button
          className="icon-button"
          disabled={pending}
          aria-label={`Удалить ${collection.title}`}
          onClick={() => void mutate(`/collections/${collection.id}`, "DELETE")}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="collection-items">
        {collection.items.map((item) => (
          <div key={item.id}>
            <img src={item.product.image_url} alt={item.product.title} />
            <span>
              <a
                href={item.product.product_url || item.product.search_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.product.title} ↗
              </a>
              <small>
                {rub(item.product.price_rub)} ·{" "}
                {item.product.source === "mock" ? "демо" : item.product.marketplace}
              </small>
            </span>
            <button
              className="icon-button"
              disabled={pending}
              aria-label={`Заменить ${item.product.title}`}
              onClick={() =>
                void mutate(`/collections/${collection.id}/items/${item.id}/replace`, "POST")
              }
            >
              <RefreshCw size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="collection-total">
        <span>
          Весь набор<strong>{rub(collection.total)}</strong>
        </span>
        <Badge tone="green">В пределах бюджета</Badge>
      </div>
      <Button
        variant={collection.saved ? "secondary" : "outline"}
        className="w-full"
        disabled={pending}
        onClick={() =>
          void mutate(`/collections/${collection.id}`, "PATCH", { saved: !collection.saved })
        }
      >
        {pending ? (
          <Loader2 size={15} className="spin" />
        ) : collection.saved ? (
          <Check size={15} />
        ) : (
          <Bookmark size={15} />
        )}{" "}
        {collection.saved ? "Набор сохранён" : "Сохранить весь набор"}
      </Button>
    </article>
  );
}
