"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Dna,
  Gift,
  History,
  Link2,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "@/components/providers";
import {
  Avatar,
  Badge,
  CheckField,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  SectionHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { RecipientEditor } from "@/components/recipient-editor";
import { api, errorText, json } from "@/lib/api";
import type { GiftHistory, Interest, Recipient, SocialImport } from "@/lib/types";
import { dateLabel, todayISO } from "@/lib/utils";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { recipients, loading, refresh } = useGifty();
  const router = useRouter();
  const person = recipients.find((p) => p.id === id);
  const [edit, setEdit] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<GiftHistory[]>([]),
    [imports, setImports] = useState<SocialImport[]>([]),
    [loadError, setLoadError] = useState("");
  async function loadRelated() {
    try {
      const [h, i] = await Promise.all([
        api<GiftHistory[]>(`/gift-history?recipient_id=${id}`),
        api<SocialImport[]>(`/imports?recipient_id=${id}`),
      ]);
      setHistory(h);
      setImports(i);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<GiftHistory[]>(`/gift-history?recipient_id=${id}`),
      api<SocialImport[]>(`/imports?recipient_id=${id}`),
    ])
      .then(([h, i]) => {
        if (active) {
          setHistory(h);
          setImports(i);
        }
      })
      .catch((e) => {
        if (active) setLoadError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (loading && !person) return <Loading />;
  if (!person)
    return (
      <EmptyState
        title="Профиль не найден"
        text="Возможно, он был удалён или относится к другому аккаунту."
        action={
          <Button asChild variant="outline">
            <Link href="/people">К моим людям</Link>
          </Button>
        }
      />
    );
  async function deletePerson() {
    setDeleting(true);
    try {
      await api(`/recipients/${id}`, { method: "DELETE" });
      await refresh();
      router.push("/people");
      toast("Профиль и связанные данные удалены");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <Link href="/people" className="back-link">
        <ChevronLeft size={16} />
        Все ваши люди
      </Link>
      <div className="profile-hero">
        <Avatar person={person} size="xl" />
        <div className="profile-hero-copy">
          <div>
            <Badge tone="purple">{person.relationship_type}</Badge>
            {person.data_basis === "fictional" && <Badge>Вымышленный профиль</Badge>}
          </div>
          <h1>{person.name}</h1>
          <p>
            {person.age ? `${person.age} лет` : person.age_group || "Каждая деталь имеет значение"}
            {person.birthday && (
              <>
                <span>·</span>День рождения {dateLabel(person.birthday)}
              </>
            )}
          </p>
        </div>
        <div className="profile-actions">
          <Button
            variant="outline"
            size="icon"
            aria-label="Редактировать профиль"
            onClick={() => setEdit(true)}
          >
            <Pencil size={17} />
          </Button>
          <Button asChild>
            <Link href={`/assistant?recipient=${id}`}>
              <Sparkles size={16} />
              Подобрать подарок
            </Link>
          </Button>
        </div>
      </div>
      {loadError && <ErrorState message={loadError} retry={() => void loadRelated()} />}
      <div className="profile-layout">
        <div>
          <GiftDNA
            key={person.interests.map((i) => `${i.id}-${i.weight}-${i.confirmed}-${i.name}`).join()}
            person={person}
          />
          <section className="panel profile-panel">
            <SectionHeading
              title="Уже подарено"
              subtitle="Чтобы приятные сюрпризы не повторялись"
              action={
                <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
                  <Plus size={14} />
                  Записать подарок
                </Button>
              }
            />
            {history.length ? (
              <div className="gift-history-list">
                {history.map((item) => (
                  <div key={item.id}>
                    <span className="history-gift-icon">
                      <Gift size={20} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {dateLabel(item.given_on)}
                        {item.notes && ` · ${item.notes}`}
                      </small>
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Удалить запись ${item.title}`}
                      onClick={async () => {
                        try {
                          await api(`/gift-history/${item.id}`, { method: "DELETE" });
                          await loadRelated();
                        } catch (e) {
                          toast.error(errorText(e));
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="История только начинается"
                text="Записывайте подарки — помощник учтёт их в новых подборках."
              />
            )}
          </section>
        </div>
        <aside>
          <section className="panel profile-panel">
            <SectionHeading
              title="Маленькие детали"
              action={
                <button
                  className="icon-button"
                  aria-label="Изменить детали"
                  onClick={() => setEdit(true)}
                >
                  <Pencil size={15} />
                </button>
              }
            />
            <div className="detail-block">
              <h4>ЛЮБИМЫЕ КАТЕГОРИИ</h4>
              <p>{person.favorite_categories.join(", ") || "Пока не указаны"}</p>
            </div>
            <div className="detail-block">
              <h4>ЛЮБИМЫЕ БРЕНДЫ</h4>
              <p>{person.favorite_brands.join(", ") || "Пока не указаны"}</p>
            </div>
            <div className="detail-block">
              <h4>НЕ СТОИТ ДАРИТЬ</h4>
              <p>{person.excluded_categories.join(", ") || "Нет указанных ограничений"}</p>
            </div>
            <div className="detail-block">
              <h4>ВАШИ ЗАМЕТКИ</h4>
              <p className="preserve-whitespace">
                {person.notes || "Здесь можно сохранить важные мелочи."}
              </p>
            </div>
          </section>
          <section className="panel profile-panel import-panel">
            <span className="empty-icon">
              <Upload size={23} />
            </span>
            <h3>Предпочтения из ваших заметок</h3>
            <p>
              Вставьте разрешённый к обработке текст. Мы предложим интересы, а вы решите, что верно.
            </p>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Plus size={15} />
              Импортировать текст
            </Button>
            <small>
              VK и Telegram API не подключены.
              <br />
              Ссылки не сканируются.
            </small>
            {imports.map((item) => (
              <div className="import-record" key={item.id}>
                <Link2 size={14} />
                <span>{item.source_label}</span>
                <button
                  className="icon-button"
                  aria-label={`Удалить импорт ${item.source_label}`}
                  onClick={async () => {
                    try {
                      await api(`/imports/${item.id}`, { method: "DELETE" });
                      await Promise.all([loadRelated(), refresh()]);
                      toast("Исходный текст и его интересы удалены");
                    } catch (e) {
                      toast.error(errorText(e));
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
          <div className="profile-privacy">
            <ShieldCheck size={17} />
            <p>
              Вы управляете данными профиля. Импортированные тексты и предположения можно удалить в
              любой момент.
            </p>
          </div>
          <button className="danger-link" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
            Удалить профиль
          </button>
        </aside>
      </div>
      <RecipientEditor open={edit} onOpenChange={setEdit} recipient={person} />
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        id={id}
        onDone={async () => {
          await Promise.all([loadRelated(), refresh()]);
        }}
      />
      <HistoryModal open={historyOpen} onOpenChange={setHistoryOpen} id={id} onDone={loadRelated} />
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Удалить профиль «${person.name}»?`}
        description="Будут удалены интересы, импорты, события, записи о подарках и подборки этого человека."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Оставить
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void deletePerson()}>
            {deleting && <Loader2 size={15} className="spin" />}Удалить профиль
          </Button>
        </div>
      </Modal>
    </>
  );
}

function GiftDNA({ person }: { person: Recipient }) {
  const { refresh } = useGifty();
  const [interests, setInterests] = useState<Interest[]>(person.interests),
    [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(interests) !== JSON.stringify(person.interests);
  async function save() {
    setSaving(true);
    try {
      for (const original of person.interests) {
        const edited = interests.find((i) => i.id === original.id);
        if (!edited)
          await api(`/recipients/${person.id}/interests/${original.id}`, { method: "DELETE" });
        else if (JSON.stringify(original) !== JSON.stringify(edited))
          await api(`/recipients/${person.id}/interests/${original.id}`, {
            method: "PATCH",
            body: json(edited),
          });
      }
      await refresh();
      toast.success("Gift DNA обновлена");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  function change(index: number, patch: Partial<Interest>) {
    setInterests((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <section className="panel dna-panel">
      <div className="section-heading">
        <div className="dna-heading">
          <span className="dna-icon">
            <Dna size={23} />
          </span>
          <div>
            <h2>Gift DNA</h2>
            <p>То, что делает {person.name} особенным человеком</p>
          </div>
        </div>
        <Badge tone="purple">{interests.filter((i) => i.confirmed).length} интересов</Badge>
      </div>
      <p className="dna-intro">
        Чем выше вес, тем больше внимания этому интересу при подборе. Измените название, подтвердите
        предположения и сохраните.
      </p>
      {interests.length ? (
        <div className="dna-list">
          {interests.map((interest, index) => (
            <div className="dna-item" key={interest.id || index}>
              <div className="dna-item-heading">
                <Input
                  aria-label={`Название интереса ${interest.name}`}
                  className="dna-name"
                  maxLength={80}
                  value={interest.name}
                  onChange={(e) => change(index, { name: e.target.value })}
                />
                <span>{interest.weight}%</span>
                <button
                  className="icon-button"
                  aria-label={`Убрать интерес ${interest.name}`}
                  onClick={() => setInterests((items) => items.filter((_, i) => i !== index))}
                >
                  <X size={13} />
                </button>
              </div>
              <input
                className={`dna-range dna-range-${index % 4}`}
                type="range"
                min={0}
                max={100}
                value={interest.weight}
                aria-label={`Вес интереса ${interest.name}`}
                style={{ "--range": `${interest.weight}%` } as React.CSSProperties}
                onChange={(e) => change(index, { weight: Number(e.target.value) })}
              />
              <div className="dna-source">
                <span
                  className={
                    interest.origin === "inferred" && !interest.confirmed
                      ? "inferred-label"
                      : "confirmed-label"
                  }
                >
                  {interest.origin === "user" ? <Check size={11} /> : <Sparkles size={11} />}{" "}
                  {interest.origin === "user"
                    ? "Указано вами"
                    : interest.confirmed
                      ? "Подтверждено вами"
                      : "Предположение"}
                </span>
                {interest.origin === "inferred" && !interest.confirmed && (
                  <button onClick={() => change(index, { confirmed: true })}>
                    Подтвердить <Check size={11} />
                  </button>
                )}
                <small title={interest.source}>{interest.source}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Dna}
          title="Здесь появится характер подарка"
          text="Добавьте интересы через редактирование профиля или ручной импорт."
        />
      )}
      <div className="dna-footer">
        <span>
          <ShieldCheck size={14} />
          Неподтверждённые интересы не влияют на подбор
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || saving}
        >
          {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}Сохранить DNA
        </Button>
      </div>
    </section>
  );
}

function ImportModal({
  open,
  onOpenChange,
  id,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  id: string;
  onDone: () => Promise<void>;
}) {
  const [source, setSource] = useState("Мои заметки"),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [permission, setPermission] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ inferred_count: number }>("/imports", {
        method: "POST",
        body: json({
          recipient_id: id,
          source_label: source,
          source_url: url || null,
          text,
          permission_to_import: permission,
        }),
      });
      await onDone();
      toast.success(`Предположено интересов: ${result.inferred_count}. Проверьте Gift DNA.`);
      setText("");
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Узнаем об интересах из текста"
      description="Только ручной импорт. Страницы по ссылкам не загружаются."
    >
      <form onSubmit={submit} className="form-stack">
        <Field label="Название источника">
          <Input
            required
            value={source}
            maxLength={200}
            onChange={(e) => setSource(e.target.value)}
          />
        </Field>
        <Field label="Ссылка на источник (необязательно)">
          <Input
            type="url"
            value={url}
            maxLength={500}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Текст с интересами">
          <Textarea
            required
            minLength={3}
            maxLength={10000}
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Любит читать, рисует акварелью и собирает винил…"
          />
        </Field>
        <CheckField
          checked={permission}
          onChange={setPermission}
          title="Источник разрешено использовать"
          description="Есть документированное основание обработки данных получателя и право использовать этот текст. Не добавляю чувствительные сведения."
        />
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={!permission || busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}Предложить
          интересы
        </Button>
      </form>
    </Modal>
  );
}

function HistoryModal({
  open,
  onOpenChange,
  id,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  id: string;
  onDone: () => Promise<void>;
}) {
  const { favorites } = useGifty();
  const [title, setTitle] = useState(""),
    [date, setDate] = useState(todayISO),
    [notes, setNotes] = useState(""),
    [productId, setProductId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/gift-history", {
        method: "POST",
        body: json({
          recipient_id: id,
          title,
          given_on: date,
          notes,
          product_id: productId || null,
        }),
      });
      await onDone();
      onOpenChange(false);
      setTitle("");
      setNotes("");
      toast.success("Запомнили подарок");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Что вы уже дарили?"
      description="Помощник учтёт историю и предложит новые идеи"
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label="Из избранного (необязательно)">
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = favorites.find((f) => f.product.id === e.target.value)?.product;
              if (p) setTitle(p.title);
            }}
          >
            <option value="">Записать свой подарок</option>
            {favorites.map((f) => (
              <option key={f.id} value={f.product.id}>
                {f.product.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Название подарка">
          <Input
            required
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Когда подарили">
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Как отреагировал человек">
          <Textarea
            value={notes}
            rows={3}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Что понравилось?"
          />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="spin" size={15} />}Сохранить в историю
        </Button>
      </form>
    </Modal>
  );
}
