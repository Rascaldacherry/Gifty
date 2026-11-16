"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gift,
  Loader2,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "@/components/providers";
import {
  Avatar,
  CheckField,
  EmptyState,
  ErrorState,
  Field,
  PageHeading,
  SectionHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { api, errorText, json } from "@/lib/api";
import { cn, dateLabel, todayISO } from "@/lib/utils";
import type { GiftEvent } from "@/lib/types";

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const currentMonth = () => {
  const date = new Date(todayISO() + "T12:00:00");
  return new Date(date.getFullYear(), date.getMonth(), 1);
};
export default function CalendarPage() {
  const { events, recipients, refresh, user } = useGifty();
  const [month, setMonth] = useState(currentMonth),
    [editor, setEditor] = useState<{ event?: GiftEvent; date: string } | null>(null);
  const firstDay = (month.getDay() + 6) % 7,
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    today = todayISO();
  function eventsOn(day: number) {
    return events.filter((event) => {
      const d = new Date(event.event_date + "T12:00:00");
      if (event.recurring) {
        const last = new Date(month.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getMonth() === month.getMonth() && Math.min(d.getDate(), last) === day;
      }
      return (
        d.getFullYear() === month.getFullYear() &&
        d.getMonth() === month.getMonth() &&
        d.getDate() === day
      );
    });
  }
  const upcoming = events.filter((e) => e.days_until >= 0).slice(0, 6);
  return (
    <>
      <PageHeading
        eyebrow="ДЛЯ ДАТ, КОТОРЫЕ ВАЖНО ПОМНИТЬ"
        title="Поводы быть ближе"
        description="Дни рождения, годовщины и маленькие личные праздники."
        action={
          <Button onClick={() => setEditor({ date: today })}>
            <Plus size={17} />
            Добавить событие
          </Button>
        }
      />
      <div className="calendar-layout">
        <section className="calendar-panel panel">
          <div className="calendar-heading">
            <h2>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</h2>
            <div>
              <Button size="sm" variant="outline" onClick={() => setMonth(currentMonth())}>
                Сегодня
              </Button>
              <button
                className="icon-button"
                aria-label="Предыдущий месяц"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Следующий месяц"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: firstDay }, (_, i) => (
              <div className="calendar-day calendar-day-outside" key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1,
                date = iso(new Date(month.getFullYear(), month.getMonth(), day)),
                dayEvents = eventsOn(day);
              return (
                <div key={day} className={cn("calendar-day", date === today && "calendar-today")}>
                  <button
                    className="calendar-day-number"
                    aria-label={`Добавить событие ${dateLabel(date)}`}
                    onClick={() => setEditor({ date })}
                  >
                    {day}
                  </button>
                  {dayEvents.slice(0, 2).map((event) => (
                    <button
                      key={event.id}
                      className={cn(
                        "calendar-event",
                        event.kind === "birthday"
                          ? "calendar-event-birthday"
                          : "calendar-event-other",
                      )}
                      onClick={() => setEditor({ event, date })}
                      title={event.title}
                    >
                      {event.kind === "birthday" ? (
                        <Gift size={10} />
                      ) : (
                        <span className="status-dot" />
                      )}
                      {event.title.replace("День рождения · ", "")}
                    </button>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="calendar-more">+{dayEvents.length - 2}</span>
                  )}
                </div>
              );
            })}
            {Array.from({ length: (7 - ((firstDay + days) % 7)) % 7 }, (_, i) => (
              <div className="calendar-day calendar-day-outside" key={`end-${i}`} />
            ))}
          </div>
          <div className="calendar-legend">
            <span>
              <i />
              Дни рождения
            </span>
            <span>
              <i />
              Другие поводы
            </span>
            <span>
              <Repeat size={12} />
              Ежегодные события повторяются
            </span>
          </div>
        </section>
        <aside>
          <section className="panel upcoming-panel">
            <SectionHeading title="Ближайшие поводы" />
            {upcoming.length ? (
              upcoming.map((event) => {
                const person = recipients.find((r) => r.id === event.recipient_id);
                return (
                  <div className="calendar-upcoming" key={event.id}>
                    {person ? (
                      <Avatar person={person} size="sm" />
                    ) : (
                      <span className="history-gift-icon">
                        <CalendarDays size={19} />
                      </span>
                    )}
                    <div>
                      <strong>{event.title}</strong>
                      <small>
                        {dateLabel(event.next_date)} ·{" "}
                        {event.days_until === 0 ? "сегодня" : `через ${event.days_until} дн.`}
                      </small>
                      <Link
                        href={`/assistant?recipient=${event.recipient_id || ""}&occasion=${encodeURIComponent(event.title)}`}
                      >
                        Подобрать подарок
                        <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Ждём первый повод"
                text="Добавьте важную дату или день рождения в профиль."
              />
            )}
          </section>
          <div className="reminder-note">
            <Bell size={21} />
            <h3>Забота чуть заранее</h3>
            <p>
              {user?.reminders_enabled
                ? "Напоминания появятся под колокольчиком за указанное в событии число дней."
                : "Напоминания выключены. Включите их в настройках."}
            </p>
            <Link href="/settings" className="text-link">
              Настроить напоминания
              <ChevronRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
      <EventEditor
        key={`${editor?.event?.id || "new"}-${editor?.date}`}
        state={editor}
        onClose={() => setEditor(null)}
        onDone={refresh}
      />
    </>
  );
}
function EventEditor({
  state,
  onClose,
  onDone,
}: {
  state: { event?: GiftEvent; date: string } | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { recipients } = useGifty();
  const event = state?.event;
  const [title, setTitle] = useState(event?.title || ""),
    [date, setDate] = useState(event?.event_date || state?.date || ""),
    [recipient, setRecipient] = useState(event?.recipient_id || ""),
    [kind, setKind] = useState(event?.kind || "custom"),
    [recurring, setRecurring] = useState(event?.recurring || false),
    [reminder, setReminder] = useState(event?.reminder_days ?? 7),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/events${event ? `/${event.id}` : ""}`, {
        method: event ? "PUT" : "POST",
        body: json({
          title,
          event_date: date,
          recipient_id: recipient || null,
          kind,
          recurring,
          reminder_days: reminder,
        }),
      });
      await onDone();
      onClose();
      toast.success(event ? "Событие обновлено" : "Повод добавлен в календарь");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!event) return;
    setBusy(true);
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      await onDone();
      onClose();
      toast("Событие удалено");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!state}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={event ? "Важный повод" : "Новый повод для радости"}
      description="Подготовим подарок заранее"
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label="Название события">
          <Input
            required
            value={title}
            maxLength={140}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, годовщина знакомства"
          />
        </Field>
        <div className="form-grid">
          <Field label="Дата">
            <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Тип события">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="custom">Свой повод</option>
              <option value="birthday">День рождения</option>
              <option value="anniversary">Годовщина</option>
              <option value="holiday">Праздник</option>
            </Select>
          </Field>
        </div>
        <Field label="Связать с человеком">
          <Select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <option value="">Общее событие</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <CheckField title="Повторять каждый год" checked={recurring} onChange={setRecurring} />
        <Field label="Напомнить за столько дней">
          <Input
            type="number"
            min={0}
            max={90}
            required
            value={reminder}
            onChange={(e) => setReminder(Number(e.target.value))}
          />
        </Field>
        {error && <ErrorState message={error} />}
        <div className="dialog-actions">
          {event && (
            <Button
              type="button"
              variant="ghost"
              className="danger-link"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 size={15} />
              Удалить
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 size={15} className="spin" />}Сохранить событие
          </Button>
        </div>
      </form>
    </Modal>
  );
}
