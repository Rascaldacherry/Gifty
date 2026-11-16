"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, History, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "@/components/providers";
import { Avatar, Badge, EmptyState, Loading, PageHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { api, errorText } from "@/lib/api";
import { dateLabel, rub } from "@/lib/utils";
import type { GiftRequest } from "@/lib/types";

export default function HistoryPage() {
  const { requests, recipients, loading, refresh } = useGifty();
  const [query, setQuery] = useState(""),
    [recipient, setRecipient] = useState("all"),
    [target, setTarget] = useState<GiftRequest | null>(null),
    [deleting, setDeleting] = useState(false);
  const filtered = requests.filter(
    (r) =>
      (r.recipient_name + r.occasion + r.prompt).toLowerCase().includes(query.toLowerCase()) &&
      (recipient === "all" || r.recipient_id === recipient),
  );
  async function remove() {
    if (!target) return;
    setDeleting(true);
    try {
      await api(`/requests/${target.id}`, { method: "DELETE" });
      await refresh();
      setTarget(null);
      toast("Подборка удалена");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ХОРОШИЕ ИДЕИ НЕ ТЕРЯЮТСЯ"
        title="История ваших поисков"
        description="Вернитесь к разговору, вспомните идеи и продолжите с того же места."
        action={
          <Button asChild>
            <Link href="/assistant">
              <Sparkles size={16} />
              Новая подборка
            </Link>
          </Button>
        }
      />
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск подборок"
            placeholder="Имя, повод или пожелание…"
          />
        </div>
        <Select
          aria-label="Фильтр по получателю"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        >
          <option value="all">Все ваши люди</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      {loading && !requests.length ? (
        <Loading />
      ) : filtered.length ? (
        <div className="request-list">
          {filtered.map((request) => {
            const person = recipients.find((r) => r.id === request.recipient_id);
            return (
              <article key={request.id} className="request-card panel">
                <div className="request-summary">
                  <Avatar person={person || { name: request.recipient_name, avatar: "lavender" }} />
                  <div>
                    <div className="request-title">
                      <h2>
                        {request.occasion} · {request.recipient_name}
                      </h2>
                      <Badge tone="purple">
                        {request.provider === "demo" ? "Демо" : request.provider}
                      </Badge>
                    </div>
                    <p>
                      {dateLabel(request.created_at, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      <span>·</span>до {rub(request.budget)}
                      <span>·</span>
                      {request.recommendations.length} идей
                    </p>
                    {request.prompt && <blockquote>{request.prompt}</blockquote>}
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Удалить подборку ${request.occasion}`}
                    onClick={() => setTarget(request)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="request-preview">
                  {request.recommendations.slice(0, 4).map((item) => (
                    <div key={item.id}>
                      <img src={item.product.image_url} alt={item.product.title} />
                      <span>{item.product.title}</span>
                    </div>
                  ))}
                  <Button variant="secondary" asChild>
                    <Link href={`/assistant?request=${request.id}`}>
                      Продолжить подбор
                      <ArrowRight size={15} />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title={
            query || recipient !== "all" ? "Ничего не нашлось" : "У каждого подарка будет история"
          }
          text={
            query || recipient !== "all"
              ? "Попробуйте изменить поиск."
              : "Все подборки автоматически сохраняются здесь — вместе с объяснениями и перепиской."
          }
          action={
            <Button asChild>
              <Link href="/assistant">
                Начать первую подборку
                <ArrowRight size={15} />
              </Link>
            </Button>
          }
        />
      )}
      <Modal
        open={!!target}
        onOpenChange={(v) => {
          if (!v) setTarget(null);
        }}
        title="Удалить эту подборку?"
        description="Переписка и рекомендации будут удалены. Подарки в избранном останутся."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setTarget(null)}>
            Оставить
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {deleting && <Loader2 size={15} className="spin" />}Удалить подборку
          </Button>
        </div>
      </Modal>
    </>
  );
}
