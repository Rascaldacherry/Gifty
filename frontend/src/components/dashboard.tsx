"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Gift,
  Heart,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useGifty } from "./providers";
import { Avatar, Badge, EmptyState, Loading, PageHeading, SectionHeading } from "./shared";
import { Button } from "./ui/button";
import { HeroArt } from "./hero-art";
import { RecipientEditor } from "./recipient-editor";
import { ProductCard } from "./product-card";
import { rub } from "@/lib/utils";

export function Dashboard() {
  const { user, recipients, events, requests, favorites, loading } = useGifty();
  const [addPerson, setAddPerson] = useState(false);
  const upcoming = events.filter((e) => e.days_until >= 0).slice(0, 3),
    next = upcoming[0];
  const inspiration = requests[0]?.recommendations.slice(0, 4) || [];
  return (
    <>
      <PageHeading
        eyebrow="ХОРОШИЙ ПОДАРОК НАЧИНАЕТСЯ С ВНИМАНИЯ"
        title={`Привет, ${user?.name.split(" ")[0] || "друг"} ☀`}
        description="Пусть у ваших близких будет ещё один повод улыбнуться."
        action={
          <Badge tone="green">
            <span className="status-dot" />
            Ваше пространство подарков
          </Badge>
        }
      />
      <div className="dashboard-top">
        <motion.section
          className="hero-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <Sparkles size={14} />
              НЕМНОГО МАГИИ, МНОГО ЗАБОТЫ
            </span>
            <h2>
              Тот самый подарок.
              <br />
              <span>Для ваших людей.</span>
            </h2>
            <p>
              Знаем, как сложно выбрать. Поможем найти
              <br className="desktop-break" /> то, что расскажет о ваших чувствах.
            </p>
            <Button asChild size="lg">
              <Link href="/assistant">
                <WandSparkles size={17} />
                Подобрать подарок
                <ArrowRight size={17} />
              </Link>
            </Button>
            <div className="hero-footnote">
              <span className="tiny-avatars">
                <i>А</i>
                <i>М</i>
                <i>С</i>
              </span>
              <span>Вдохновляемся тем, что любят ваши близкие</span>
            </div>
          </div>
          <HeroArt className="hero-illustration" />
        </motion.section>
        <section className="upcoming-card">
          <div className="section-heading">
            <h2>Скоро повод</h2>
            <Link href="/calendar" className="icon-button" aria-label="Все события">
              <CalendarDays size={18} />
            </Link>
          </div>
          {upcoming.length ? (
            upcoming.map((event, i) => {
              const person = recipients.find((r) => r.id === event.recipient_id);
              return (
                <Link
                  href={`/assistant?recipient=${event.recipient_id || ""}&occasion=${encodeURIComponent(event.title)}`}
                  key={event.id}
                  className="upcoming-row"
                >
                  <div className={`date-tile date-tile-${i}`}>
                    <strong>{new Date(event.next_date + "T12:00:00").getDate()}</strong>
                    <span>
                      {new Date(event.next_date + "T12:00:00")
                        .toLocaleDateString("ru-RU", { month: "short" })
                        .replace(".", "")}
                    </span>
                  </div>
                  <div>
                    <h3>{person?.name || event.title}</h3>
                    <p>
                      {person
                        ? event.kind === "birthday"
                          ? "День рождения"
                          : event.title
                        : "Время для подарков"}
                    </p>
                    <small>
                      {event.days_until === 0 ? "Уже сегодня" : `Через ${event.days_until} дн.`}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              );
            })
          ) : (
            <div className="upcoming-empty">
              <CalendarDays size={30} />
              <p>Добавьте важную дату — и начнём готовить сюрприз.</p>
              <Link className="text-link" href="/calendar">
                Добавить событие
                <Plus size={14} />
              </Link>
            </div>
          )}
          <div className="upcoming-footer">
            <span className="status-dot" />
            {next ? "Самое время придумать что-то приятное" : "Для самых важных поводов"}
          </div>
        </section>
      </div>
      <section className="dashboard-section">
        <SectionHeading
          title="Ваши люди"
          subtitle="Их интересы — наша отправная точка"
          href="/people"
          link="Все люди"
        />
        {loading && !recipients.length ? (
          <Loading />
        ) : (
          <div className="people-strip">
            {recipients.slice(0, 4).map((person) => (
              <Link key={person.id} href={`/people/${person.id}`} className="person-mini">
                <Avatar person={person} size="md" />
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.relationship_type}
                    {person.age ? ` · ${person.age}` : ""}
                  </p>
                  <span>
                    {person.interests
                      .filter((i) => i.confirmed)
                      .slice(0, 2)
                      .map((i) => i.name)
                      .join(" · ") || "Добавьте интересы"}
                  </span>
                </div>
                <ChevronRight size={14} />
              </Link>
            ))}
            <button className="add-person-tile" onClick={() => setAddPerson(true)}>
              <span>
                <Plus size={21} />
              </span>
              Добавить
              <br />
              человека
            </button>
            {!recipients.length && (
              <p className="people-empty-copy">
                Начните с близкого человека.
                <br />
                Мы запомним, что делает его особенным.
              </p>
            )}
          </div>
        )}
      </section>
      <section className="dashboard-section">
        <SectionHeading
          title="Продолжим с того, что нравится"
          subtitle="Вдохновение для ваших ближайших подарков"
          href={inspiration.length ? `/assistant?request=${requests[0].id}` : "/assistant"}
          link={inspiration.length ? "Вся подборка" : "Начать подбор"}
        />
        {inspiration.length ? (
          <>
            <div className="product-grid dashboard-products">
              {inspiration.map((item) => (
                <ProductCard key={item.id} product={item.product} score={item.score} compact />
              ))}
            </div>
            <p className="subtle-caption">
              <span className="status-dot" />
              Демокаталог · цены и иллюстрации условные, ссылки ведут на поиск
            </p>
          </>
        ) : (
          <EmptyState
            icon={Gift}
            title="Хорошие идеи уже рядом"
            text="Расскажите о человеке и поводе — соберём первую подборку."
            action={
              <Button asChild>
                <Link href="/assistant">
                  Подобрать подарок
                  <Sparkles size={16} />
                </Link>
              </Button>
            }
          />
        )}
      </section>
      <div className="dashboard-bottom">
        <section className="saved-card">
          <SectionHeading title="Сохранено с любовью" href="/favorites" link="В избранное" />
          {favorites.length ? (
            <div className="saved-list">
              {favorites.slice(0, 2).map((favorite) => (
                <Link key={favorite.id} href="/favorites" className="saved-row">
                  <span className="saved-product-art">
                    <img src={favorite.product.image_url} alt="" />
                  </span>
                  <span>
                    <strong>{favorite.product.title}</strong>
                    <small>{rub(favorite.product.price_rub)} · демо</small>
                  </span>
                  <Heart size={17} fill="currentColor" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="small-empty">
              <Heart size={25} />
              <p>Сохраняйте идеи, к которым хочется вернуться.</p>
            </div>
          )}
        </section>
        <section className="gift-set-promo">
          <span className="set-promo-icon">
            <Gift size={29} strokeWidth={1.4} />
          </span>
          <div>
            <Badge tone="purple">GIFT SETS</Badge>
            <h2>Один подарок — целая история</h2>
            <p>
              Книга, чай и немного уюта. Соберите набор,
              <br />в котором всё складывается.
            </p>
            <Link href="/assistant?tab=sets" className="text-link">
              Создать подарочный набор
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="set-promo-art">
            <img src="/products/tea.svg" alt="" />
            <img src="/products/candle.svg" alt="" />
          </div>
        </section>
      </div>
      <RecipientEditor open={addPerson} onOpenChange={setAddPerson} />
    </>
  );
}
