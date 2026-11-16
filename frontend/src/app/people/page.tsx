"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Plus, Search, Sparkles, Users } from "lucide-react";
import { useGifty } from "@/components/providers";
import { Avatar, Badge, EmptyState, Loading, PageHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipientEditor } from "@/components/recipient-editor";
import { dateLabel } from "@/lib/utils";

export default function PeoplePage() {
  const { recipients, loading } = useGifty();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const filtered = recipients.filter((r) =>
    (r.name + " " + r.relationship_type + " " + r.interests.map((i) => i.name).join(" "))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="КАЖДЫЙ ЧЕЛОВЕК — ЦЕЛАЯ ВСЕЛЕННАЯ"
        title="Ваши люди"
        description="Запоминаем маленькие детали, чтобы подарки попадали в самое сердце."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Добавить человека
          </Button>
        }
      />
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <Input
            placeholder="Имя, интерес или отношение…"
            aria-label="Поиск получателей"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="muted">{recipients.length} в вашем кругу</span>
      </div>
      {loading && !recipients.length ? (
        <Loading />
      ) : filtered.length ? (
        <div className="people-grid">
          {filtered.map((person) => (
            <article className="person-card" key={person.id}>
              <Link href={`/people/${person.id}`} className="person-card-main">
                <div className="person-card-top">
                  <Avatar person={person} size="lg" />
                  <Badge>{person.relationship_type}</Badge>
                </div>
                <h2>{person.name}</h2>
                <p className="person-meta">
                  {person.age ? `${person.age} лет` : person.age_group || "Возраст не указан"}
                  {person.birthday && (
                    <>
                      <span>·</span>
                      <CalendarDays size={13} />
                      {dateLabel(person.birthday, { day: "numeric", month: "long" })}
                    </>
                  )}
                </p>
                <div className="person-interests">
                  {person.interests
                    .filter((i) => i.confirmed)
                    .slice(0, 3)
                    .map((interest, i) => (
                      <Badge
                        tone={i === 0 ? "purple" : "neutral"}
                        key={interest.id || interest.name}
                      >
                        {interest.name}
                      </Badge>
                    ))}
                  {!person.interests.some((i) => i.confirmed) && (
                    <span className="muted">Добавьте первые интересы</span>
                  )}
                </div>
                <div className="mini-dna">
                  <span>GIFT DNA</span>
                  <div>
                    {person.interests
                      .filter((i) => i.confirmed)
                      .slice(0, 6)
                      .map((interest, i) => (
                        <i
                          key={interest.id || i}
                          style={{
                            height: `${Math.max(10, interest.weight * 0.35)}px`,
                            opacity: 0.4 + i * 0.1,
                          }}
                        />
                      ))}
                  </div>
                  <ArrowRight size={15} />
                </div>
              </Link>
              <Link href={`/assistant?recipient=${person.id}`} className="person-card-action">
                <Sparkles size={15} />
                Подобрать подарок
                <ArrowRight size={14} />
              </Link>
            </article>
          ))}
          <button className="add-person-card" onClick={() => setOpen(true)}>
            <span className="empty-icon">
              <Plus size={26} />
            </span>
            <h3>Кто ещё вам дорог?</h3>
            <p>Добавьте близкого человека</p>
          </button>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={query ? "Пока никого не нашли" : "С кого начнём?"}
          text={
            query
              ? "Попробуйте другое имя или интерес."
              : "Добавьте близкого человека — и больше не придётся вспоминать, что он любит."
          }
          action={
            !query && (
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} />
                Добавить человека
              </Button>
            )
          }
        />
      )}
      <RecipientEditor open={open} onOpenChange={setOpen} />
    </>
  );
}
