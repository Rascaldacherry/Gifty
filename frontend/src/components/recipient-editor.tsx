"use client";
import { useState, type FormEvent } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Recipient, Interest } from "@/lib/types";
import { api, errorText, json } from "@/lib/api";
import { todayISO } from "@/lib/utils";
import { useGifty } from "./providers";
import { Avatar, ErrorState, Field } from "./shared";
import { Modal } from "./ui/dialog";
import { Input, Select, Textarea } from "./ui/input";
import { Button } from "./ui/button";

const colors = ["lavender", "peach", "sage", "sky", "rose", "sand"];
const split = (text: string) =>
  text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
export function RecipientEditor({
  open,
  onOpenChange,
  recipient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipient?: Recipient;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={recipient ? "Чуть больше о близком" : "Добавим вашего человека"}
      description="Сохраните то, что поможет выбрать особенный подарок"
      className="wide-modal"
    >
      <RecipientForm
        key={`${recipient?.id || "new"}-${open}`}
        recipient={recipient}
        onDone={() => onOpenChange(false)}
      />
    </Modal>
  );
}
function RecipientForm({ recipient, onDone }: { recipient?: Recipient; onDone: () => void }) {
  const { refresh } = useGifty();
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(recipient?.name || ""),
    [avatar, setAvatar] = useState(recipient?.avatar || "lavender"),
    [relationship, setRelationship] = useState(recipient?.relationship_type || "Друг"),
    [birthday, setBirthday] = useState(recipient?.birthday || ""),
    [age, setAge] = useState(recipient?.age?.toString() || ""),
    [ageGroup, setAgeGroup] = useState(recipient?.age_group || ""),
    [notes, setNotes] = useState(recipient?.notes || ""),
    [basis, setBasis] = useState(recipient?.data_basis || "fictional");
  const [interests, setInterests] = useState<Interest[]>(
      recipient?.interests.filter((i) => i.origin === "user") || [],
    ),
    [interest, setInterest] = useState("");
  const [categories, setCategories] = useState(recipient?.favorite_categories.join(", ") || ""),
    [brands, setBrands] = useState(recipient?.favorite_brands.join(", ") || ""),
    [excluded, setExcluded] = useState(recipient?.excluded_categories.join(", ") || "");
  function addInterest() {
    const names = split(interest);
    setInterests((current) =>
      [
        ...current,
        ...names
          .filter((n) => !current.some((i) => i.name.toLowerCase() === n.toLowerCase()))
          .map((n) => ({
            name: n,
            weight: 70,
            origin: "user" as const,
            source: "Указано пользователем",
            confirmed: true,
          })),
      ].slice(0, 40),
    );
    setInterest("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const pending = split(interest)
        .filter((n) => !interests.some((i) => i.name.toLowerCase() === n.toLowerCase()))
        .map((n) => ({
          name: n,
          weight: 70,
          origin: "user",
          source: "Указано пользователем",
          confirmed: true,
        }));
      await api(`/recipients${recipient ? `/${recipient.id}` : ""}`, {
        method: recipient ? "PUT" : "POST",
        body: json({
          name,
          avatar,
          relationship_type: relationship,
          birthday: birthday || null,
          age: age ? Number(age) : null,
          age_group: ageGroup,
          notes,
          data_basis: basis,
          interests: [...interests, ...pending],
          favorite_categories: split(categories),
          favorite_brands: split(brands),
          excluded_categories: split(excluded),
        }),
      });
      await refresh();
      toast.success(recipient ? "Профиль обновлён" : "Ваш человек добавлен");
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <div className="avatar-picker">
        <Avatar person={{ name: name || "?", avatar }} size="lg" />
        <div>
          <span className="field-label">Цвет аватара</span>
          <div className="color-options">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch avatar-${color}`}
                aria-label={`Аватар: ${color}`}
                aria-pressed={avatar === color}
                onClick={() => setAvatar(color)}
              >
                {avatar === color && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Имя или псевдоним">
          <Input
            required
            maxLength={80}
            placeholder="Например, Аня"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Кем вам приходится">
          <Select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {["Друг", "Подруга", "Партнёр", "Семья", "Коллега", "Другое"].map((v) => (
              <option key={v}>{v}</option>
            ))}
            {recipient &&
              !["Друг", "Подруга", "Партнёр", "Семья", "Коллега", "Другое"].includes(
                relationship,
              ) && <option>{relationship}</option>}
          </Select>
        </Field>
        <Field label="День рождения">
          <Input
            type="date"
            value={birthday}
            max={todayISO()}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </Field>
        <Field label="Возраст (по желанию)">
          <Input
            type="number"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
      </div>
      <Field label="Возрастная категория">
        <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
          <option value="">Не указывать</option>
          {["Ребёнок", "Подросток", "18–25", "26–35", "36–50", "51+"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
      </Field>
      <div className="field">
        <span className="field-label">Интересы и увлечения</span>
        <div className="interest-tags">
          {interests.map((item, i) => (
            <span key={`${item.name}-${i}`} className="interest-chip">
              {item.name}
              <button
                type="button"
                aria-label={`Удалить интерес ${item.name}`}
                onClick={() => setInterests((items) => items.filter((_, index) => index !== i))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="input-action">
          <Input
            placeholder="Книги, рисование, путешествия…"
            value={interest}
            maxLength={300}
            onChange={(e) => setInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInterest();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Добавить интерес"
            onClick={addInterest}
          >
            <Plus size={18} />
          </Button>
        </div>
        <small className="field-hint">
          Добавляйте через запятую. Веса можно изменить в Gift DNA.
        </small>
      </div>
      <div className="form-grid">
        <Field label="Любимые категории">
          <Input
            value={categories}
            maxLength={800}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="Книги, Творчество…"
          />
        </Field>
        <Field label="Любимые бренды">
          <Input
            value={brands}
            maxLength={800}
            onChange={(e) => setBrands(e.target.value)}
            placeholder="Через запятую"
          />
        </Field>
      </div>
      <Field
        label="Не стоит дарить"
        hint="Используйте категории каталога: Красота, Техника, Книги, Для дома, Чай и кофе, Спорт, Игры, Творчество, Музыка, Аксессуары, Кулинария, Путешествия."
      >
        <Input
          value={excluded}
          maxLength={800}
          onChange={(e) => setExcluded(e.target.value)}
          placeholder="Например, Красота, Техника"
        />
      </Field>
      <Field
        label="Заметки"
        hint="Не добавляйте медицинские и другие чувствительные сведения. Их обработка в MVP отключена."
      >
        <Textarea
          value={notes}
          maxLength={3000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Что особенно радует этого человека?"
          rows={3}
        />
      </Field>
      <Field
        label="Основание обработки данных"
        hint="Для реального человека оператор должен проверить и документировать применимое основание. Выбор пункта сам по себе не заменяет эту проверку."
      >
        <Select value={basis} onChange={(e) => setBasis(e.target.value)}>
          <option value="fictional">Вымышленный профиль для тестирования</option>
          <option value="recipient_consent">Документированное согласие самого получателя</option>
          <option value="contract">Применимое договорное основание</option>
          <option value="other_documented">Иное документированное основание</option>
        </Select>
      </Field>
      {error && <ErrorState message={error} />}
      <div className="dialog-actions">
        <Button type="button" variant="outline" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="spin" size={16} />}{" "}
          {recipient ? "Сохранить изменения" : "Добавить человека"}
        </Button>
      </div>
    </form>
  );
}
