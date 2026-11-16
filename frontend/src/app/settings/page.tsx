"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  Download,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "@/components/providers";
import {
  Badge,
  CheckField,
  ErrorState,
  Field,
  Loading,
  PageHeading,
  SectionHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { api, errorText, json } from "@/lib/api";
import type { User } from "@/lib/types";

const defaults: Record<string, number> = {
  interests: 0.35,
  budget: 0.2,
  occasion: 0.1,
  originality: 0.15,
  practicality: 0.1,
  novelty: 0.1,
};
const labels: Record<string, string> = {
  interests: "Совпадение с интересами",
  budget: "Соответствие бюджету",
  occasion: "Соответствие поводу",
  originality: "Оригинальность",
  practicality: "Практичность",
  novelty: "Новизна подарка",
};
export default function SettingsPage() {
  const { user } = useGifty();
  return user ? <SettingsForm key={user.id} user={user} /> : <Loading />;
}
function SettingsForm({ user }: { user: User }) {
  const { setUser, integrations } = useGifty();
  const [name, setName] = useState(user.name),
    [aiConsent, setAIConsent] = useState(user.external_ai_consent),
    [speechConsent, setSpeechConsent] = useState(user.speech_consent),
    [reminders, setReminders] = useState(user.reminders_enabled),
    [weights, setWeights] = useState({ ...defaults, ...user.weights }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleting, setDeleting] = useState(false),
    [exporting, setExporting] = useState(false);
  async function save(e?: FormEvent, onboarding = user.onboarding_completed) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await api<User>("/settings", {
        method: "PUT",
        body: json({
          name,
          external_ai_consent: aiConsent,
          speech_consent: speechConsent,
          reminders_enabled: reminders,
          weights,
          onboarding_completed: onboarding,
        }),
      });
      setUser(updated);
      toast.success("Настройки сохранены");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setExporting(true);
    try {
      const data = await api<unknown>("/account/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "gifty-data.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Экспорт данных готов");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setExporting(false);
    }
  }
  async function removeAccount() {
    setDeleting(true);
    try {
      await api("/account", { method: "DELETE", body: json({ confirmation }) });
      setUser(null);
      toast("Аккаунт и его данные удалены");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ВАШЕ ПРОСТРАНСТВО, ВАШИ ПРАВИЛА"
        title="Настройки и забота о данных"
        description="Настройте помощника под себя. Вы решаете, что сохранять и чем делиться."
      />
      <div className="settings-layout">
        <form className="settings-main" onSubmit={save}>
          <section className="panel settings-panel">
            <SectionHeading title="Давайте называть вас по имени" />
            <div className="form-grid">
              <Field label="Ваше имя">
                <Input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Электронная почта">
                <Input disabled value={user.email} />
              </Field>
            </div>
            {user.is_demo && (
              <p className="field-hint">
                Это отдельный демоаккаунт. Для постоянного входа по паролю создайте обычный аккаунт.
              </p>
            )}
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <ShieldCheck size={22} />
              <div>
                <h2>Конфиденциальность</h2>
                <p>Внешняя обработка выключена по умолчанию</p>
              </div>
            </div>
            <CheckField
              checked={aiConsent}
              onChange={setAIConsent}
              title="Разрешить отправку запросов внешнему ИИ"
              description="Только при подключённом провайдере и отдельном выборе в чате. Передаются текст запроса, подтверждённые интересы, бюджет и повод. Не добавляйте чувствительные данные."
            />
            <CheckField
              checked={speechConsent}
              onChange={setSpeechConsent}
              title="Разрешить распознавание голоса в SpeechKit"
              description="При записи аудио передаётся Yandex SpeechKit. Текст всегда можно проверить перед отправкой в чат. Записи не сохраняются в базе."
            />
            <div className="settings-info">
              <LockKeyhole size={16} />
              <p>
                Разрешение пользователя не включает внешнюю обработку на сервере и не заменяет
                проверку оснований обработки данных получателей. Данные о здоровье и другие
                чувствительные сведения в MVP не поддерживаются.
              </p>
            </div>
            <Link href="/privacy" className="text-link">
              Политика конфиденциальности
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <Bell size={22} />
              <div>
                <h2>Напоминания о важном</h2>
                <p>Чтобы было время на маленький сюрприз</p>
              </div>
            </div>
            <CheckField
              checked={reminders}
              onChange={setReminders}
              title="Показывать уведомления внутри приложения"
              description="Напоминаем под колокольчиком. Срок задаётся отдельно для каждого события. Email и push не отправляются."
            />
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <SlidersHorizontal size={22} />
              <div>
                <h2>Что важнее в подарке?</h2>
                <p>Веса критериев для вашей системы рекомендаций</p>
              </div>
            </div>
            <div className="weight-settings">
              {Object.entries(labels).map(([key, label]) => (
                <label key={key}>
                  <span>
                    {label}
                    <strong>{Math.round(weights[key] * 100)}</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(weights[key] * 100)}
                    aria-label={label}
                    onChange={(e) =>
                      setWeights((current) => ({ ...current, [key]: Number(e.target.value) / 100 }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className="field-hint">
              Веса нормируются автоматически. Это внутренние расчётные оценки, а не объективный
              рейтинг качества товаров. Бюджет и запреты всегда действуют независимо от весов.
            </p>
            <button
              type="button"
              className="text-link reset-weights"
              onClick={() => setWeights(defaults)}
            >
              Вернуть стандартные веса
            </button>
          </section>
          {error && <ErrorState message={error} />}
          <div className="settings-save">
            <Button
              size="lg"
              type="submit"
              disabled={busy || !Object.values(weights).some((v) => v > 0)}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}Сохранить
              настройки
            </Button>
          </div>
        </form>
        <aside className="settings-aside">
          <section className="panel settings-panel integrations-panel">
            <div className="settings-section-title">
              <KeyRound size={22} />
              <div>
                <h2>Подключения</h2>
                <p>Ключи хранятся только на сервере</p>
              </div>
            </div>
            {[
              {
                name: "AI Gift Assistant",
                icon: Sparkles,
                connected: integrations?.ai_connected,
                detail: integrations?.ai_connected
                  ? integrations.ai_provider
                  : "Локальный деморежим",
              },
              {
                name: "Yandex SpeechKit",
                icon: Mic,
                connected: integrations?.speech_connected,
                detail: "Голосовой ввод",
              },
              ...Object.entries(
                integrations?.catalogs || {
                  Ozon: false,
                  Wildberries: false,
                  "Яндекс Маркет": false,
                },
              ).map(([name, connected]) => ({
                name,
                icon: KeyRound,
                connected,
                detail: "Разрешённый экспорт каталога",
              })),
              {
                name: "VK и Telegram",
                icon: ShieldCheck,
                connected: false,
                detail: "Доступен ручной импорт текста",
              },
            ].map((item) => (
              <div className="integration-item" key={item.name}>
                <item.icon size={18} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.detail}</small>
                </span>
                <Badge tone={item.connected ? "green" : "neutral"}>
                  {item.connected ? "Подключён" : "Не подключён"}
                </Badge>
              </div>
            ))}
            <p className="field-hint">
              Работа с API и каталогами настраивается оператором. Seller API не используется для
              поиска по всему рынку.
            </p>
          </section>
          <section className="panel settings-panel">
            <h2>Ваши данные</h2>
            <p className="muted settings-data-copy">
              Профили, подборки, переписки, избранное и события можно выгрузить одним JSON-файлом.
            </p>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={exporting}
              onClick={() => void exportData()}
            >
              {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              Экспортировать данные
            </Button>
            <button
              className="text-link settings-tour"
              disabled={busy}
              onClick={() => void save(undefined, false)}
            >
              Ещё раз пройти знакомство
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="settings-delete">
            <Trash2 size={20} />
            <h3>Удаление аккаунта</h3>
            <p>Удалим аккаунт и связанные данные из действующей базы. Действие необратимо.</p>
            <Button variant="outline" className="danger-link" onClick={() => setDeleteOpen(true)}>
              Удалить мой аккаунт
            </Button>
          </section>
        </aside>
      </div>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Удалить всё пространство?"
        description="Аккаунт, профили, импорты, история, избранное и события будут удалены без возможности восстановления."
      >
        <Field label="Для подтверждения введите УДАЛИТЬ">
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="УДАЛИТЬ"
            autoComplete="off"
          />
        </Field>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Оставить аккаунт
          </Button>
          <Button
            variant="destructive"
            disabled={confirmation !== "УДАЛИТЬ" || deleting}
            onClick={() => void removeAccount()}
          >
            {deleting && <Loader2 size={15} className="spin" />}Удалить все данные
          </Button>
        </div>
      </Modal>
    </>
  );
}
