"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Gift,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useGifty } from "@/components/providers";
import {
  Avatar,
  Badge,
  DemoNotice,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { ProductCard } from "@/components/product-card";
import { GiftSets } from "@/components/gift-sets";
import { api, errorText, json } from "@/lib/api";
import type { GiftRequest, Question } from "@/lib/types";
import { cn, rub } from "@/lib/utils";

export default function AssistantPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Assistant />
    </Suspense>
  );
}
function Assistant() {
  const params = useSearchParams();
  const { recipients, integrations, user, refresh } = useGifty();
  const [tab, setTab] = useState(params.get("tab") === "sets" ? "sets" : "assistant");
  const [recipientId, setRecipientId] = useState(params.get("recipient") || ""),
    [budget, setBudget] = useState(5000),
    [occasion, setOccasion] = useState(params.get("occasion")?.slice(0, 140) || "День рождения"),
    [city, setCity] = useState("");
  const [mode, setMode] = useState<"quick" | "smart">("quick"),
    [prompt, setPrompt] = useState(""),
    [external, setExternal] = useState(false),
    [advanced, setAdvanced] = useState(false);
  const [result, setResult] = useState<GiftRequest | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [initialLoading, setInitialLoading] = useState(!!params.get("request"));
  const [questions, setQuestions] = useState<Question[]>([]),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [customAnswer, setCustomAnswer] = useState("");
  const [sort, setSort] = useState("relevance"),
    [category, setCategory] = useState("all");
  const [speechNotice, setSpeechNotice] = useState(false),
    [recording, setRecording] = useState(false),
    [transcribing, setTranscribing] = useState(false),
    [speechDraft, setSpeechDraft] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = params.get("request");
    if (!id) return;
    let active = true;
    api<GiftRequest>(`/requests/${encodeURIComponent(id)}`)
      .then((r) => {
        if (active) {
          setResult(r);
          setRecipientId(r.recipient_id || "");
          setBudget(r.budget);
          setOccasion(r.occasion);
          setCity(r.city);
          setMode(r.mode);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const person = recipients.find((r) => r.id === recipientId);
  const question = questions.find((q) => !(q.id in answers));
  async function run(nextAnswers = answers) {
    if (!Number.isFinite(budget) || budget < 100 || budget > 1000000) {
      setError("Укажите бюджет от 100 до 1 000 000 ₽");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const combinedPrompt = result && prompt ? `${result.prompt}\n${prompt}`.slice(-5000) : prompt;
      const response = await api<{
        status: "complete" | "needs_clarification";
        request?: GiftRequest;
        questions?: Question[];
      }>("/recommendations", {
        method: "POST",
        body: json({
          recipient_id: recipientId || null,
          budget,
          occasion,
          prompt: combinedPrompt,
          city,
          mode,
          answers: nextAnswers,
          messages: result?.messages.slice(-16) || [],
          use_external_ai: external,
        }),
      });
      if (response.status === "needs_clarification") {
        setQuestions(response.questions || []);
        setAnswers(nextAnswers);
      } else if (response.request) {
        setResult(response.request);
        setBudget(response.request.budget);
        setPrompt("");
        setQuestions([]);
        setAnswers({});
        setCategory("all");
        await refresh();
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          }),
        );
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function answer(value: string) {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    setCustomAnswer("");
    if (questions.every((q) => q.id in next)) void run(next);
  }
  async function microphone() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!integrations?.speech_connected || !user?.speech_consent) {
      setSpeechNotice(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error(
        "Этот браузер не поддерживает запись. Используйте современный браузер на localhost или HTTPS.",
      );
      return;
    }
    const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mime) {
      toast.error("Формат записи этого браузера не поддерживается. Используйте текстовый ввод.");
      return;
    }
    if (mime.includes("webm") && !integrations.speech_webm_supported) {
      toast.error(
        "Для записи в Chrome нужен FFmpeg на backend. Используйте Firefox с OggOpus или текстовый ввод.",
      );
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream.current, { mimeType: mime });
      recorder.current = media;
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = async () => {
        if (timeout.current) clearTimeout(timeout.current);
        setRecording(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const data = new FormData();
          data.append(
            "audio",
            new Blob(chunks, { type: mime }),
            mime.includes("ogg") ? "voice.ogg" : "voice.webm",
          );
          const response = await api<{ text: string }>("/speech/transcribe", {
            method: "POST",
            body: data,
          });
          if (response.text) setSpeechDraft(response.text);
          else toast("Речь не распознана. Попробуйте записать ещё раз.");
        } catch (e) {
          toast.error(errorText(e));
        } finally {
          setTranscribing(false);
        }
      };
      media.start();
      setRecording(true);
      timeout.current = setTimeout(() => {
        if (media.state === "recording") media.stop();
      }, 25000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      toast.error(
        "Не удалось получить доступ к микрофону. Разрешите его в браузере или введите пожелания текстом.",
      );
    }
  }
  const recommendations = [...(result?.recommendations || [])]
    .filter((r) => category === "all" || r.product.category === category)
    .sort((a, b) =>
      sort === "price-asc"
        ? a.product.price_rub - b.product.price_rub
        : sort === "price-desc"
          ? b.product.price_rub - a.product.price_rub
          : b.score - a.score,
    );
  return (
    <>
      <PageHeading
        eyebrow="НАЙДЁМ ТО САМОЕ, ВМЕСТЕ"
        title="Немного магии для ваших подарков"
        description="Вы знаете человека. Мы поможем превратить это в хорошую идею."
      />
      <div className="assistant-tabs">
        <button className={tab === "assistant" ? "active" : ""} onClick={() => setTab("assistant")}>
          <Sparkles size={17} />
          AI Gift Assistant
        </button>
        <button className={tab === "sets" ? "active" : ""} onClick={() => setTab("sets")}>
          <Gift size={17} />
          Подарочные наборы<Badge tone="purple">GIFT SETS</Badge>
        </button>
      </div>
      {tab === "sets" ? (
        <GiftSets />
      ) : (
        <div className="assistant-layout">
          <aside className="assistant-parameters panel">
            <div className="section-heading">
              <h2>Детали подарка</h2>
              <SlidersHorizontal size={17} />
            </div>
            <Field label="Для кого ищем">
              <Select
                value={recipientId}
                onChange={(e) => {
                  setRecipientId(e.target.value);
                  setResult(null);
                  setQuestions([]);
                  setAnswers({});
                }}
              >
                <option value="">Без профиля</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.relationship_type}
                  </option>
                ))}
              </Select>
            </Field>
            {person && (
              <div className="assistant-person">
                <Avatar person={person} size="sm" />
                <div>
                  <strong>{person.name}</strong>
                  <p>
                    {person.interests
                      .filter((i) => i.confirmed)
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(" · ") || "Добавьте интересы в профиль"}
                  </p>
                </div>
              </div>
            )}
            <Field label="Повод">
              <Input
                list="occasions"
                value={occasion}
                maxLength={140}
                required
                onChange={(e) => setOccasion(e.target.value)}
              />
              <datalist id="occasions">
                {[
                  "День рождения",
                  "Просто так",
                  "Новый год",
                  "Годовщина",
                  "8 Марта",
                  "23 Февраля",
                  "Новоселье",
                ].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </Field>
            <Field label="Бюджет, до ₽">
              <div className="budget-input">
                <Input
                  type="number"
                  min={100}
                  max={1000000}
                  step={100}
                  value={budget || ""}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
                <span>₽</span>
              </div>
            </Field>
            <div className="budget-presets">
              {[1500, 3000, 5000, 10000].map((v) => (
                <button
                  key={v}
                  className={budget === v ? "selected" : ""}
                  onClick={() => setBudget(v)}
                >
                  {v / 1000} тыс.
                </button>
              ))}
            </div>
            <div className="field">
              <span className="field-label">Как подбираем</span>
              <div className="mode-options">
                <button
                  className={mode === "quick" ? "selected" : ""}
                  onClick={() => {
                    setMode("quick");
                    setQuestions([]);
                    setAnswers({});
                  }}
                >
                  <WandSparkles size={17} />
                  <span>
                    <strong>Быстрый подбор</strong>
                    <small>Сразу к хорошим идеям</small>
                  </span>
                  <span className="radio-indicator" />
                </button>
                <button
                  className={mode === "smart" ? "selected" : ""}
                  onClick={() => setMode("smart")}
                >
                  <Sparkles size={17} />
                  <span>
                    <strong>Умный подбор</strong>
                    <small>Сначала уточним детали</small>
                  </span>
                  <span className="radio-indicator" />
                </button>
              </div>
            </div>
            <button className="advanced-toggle" onClick={() => setAdvanced((v) => !v)}>
              <SlidersHorizontal size={14} />
              Дополнительно
              <ChevronDown size={14} className={advanced ? "rotate-180" : ""} />
            </button>
            {advanced && (
              <div className="form-stack">
                <Field label="Город получения">
                  <div className="icon-input">
                    <MapPin size={15} />
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={100}
                      placeholder="Например, Москва"
                    />
                  </div>
                </Field>
                <label className="external-ai-toggle">
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(e) => setExternal(e.target.checked)}
                    disabled={!integrations?.ai_connected || !user?.external_ai_consent}
                  />
                  Использовать внешний AI Provider
                </label>
                <small className="field-hint">
                  {integrations?.ai_connected
                    ? "Нужно разрешение в настройках конфиденциальности. Текст запроса будет передан провайдеру."
                    : "Не подключён. Локальный демоанализ доступен без ключей."}
                </small>
              </div>
            )}
            <div className="parameters-footer">
              <span className="status-dot" />{" "}
              {external ? "Подключённый AI Provider" : "Локальный деморежим"}
              <p>Бюджет и ограничения проверяются на сервере.</p>
            </div>
          </aside>
          <div className="assistant-main">
            {initialLoading ? (
              <Loading />
            ) : (
              <>
                <section className="chat-panel panel">
                  <div className="chat-heading">
                    <span className="assistant-avatar">
                      <Sparkles size={22} />
                    </span>
                    <div>
                      <h2>Ваш помощник по подаркам</h2>
                      <p>
                        <span className="status-dot" />
                        Готов искать маленькие поводы для счастья
                      </p>
                    </div>
                    <Badge tone="purple">{external ? integrations?.ai_provider : "DEMO AI"}</Badge>
                  </div>
                  <div className="chat-conversation">
                    {!result ? (
                      <div className="assistant-message">
                        <span className="chat-mini-avatar">
                          <Sparkles size={15} />
                        </span>
                        <div>
                          <p>
                            Привет! Давайте найдём подарок, в котором будет чувствоваться ваше
                            внимание.
                          </p>
                          <p>
                            Расскажите, что любит человек, чем он живёт и чего точно не хочется
                            дарить. А я предложу идеи в вашем бюджете.
                          </p>
                          <div className="prompt-suggestions">
                            {[
                              "Хочется чего-то небанального",
                              "Для уютных вечеров",
                              "Что-то для любимого хобби",
                            ].map((text) => (
                              <button key={text} onClick={() => setPrompt(text)}>
                                {text}
                                <Plus size={12} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      result.messages.slice(-6).map((message, i) => (
                        <div
                          className={cn(
                            "chat-message",
                            message.role === "user" ? "user-message" : "assistant-message",
                          )}
                          key={i}
                        >
                          {message.role === "assistant" && (
                            <span className="chat-mini-avatar">
                              <Sparkles size={15} />
                            </span>
                          )}
                          <div>
                            <p>{message.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {question && (
                      <div className="smart-question">
                        <Badge tone="purple">
                          {Object.keys(answers).length + 1} ИЗ {questions.length}
                        </Badge>
                        <h3>{question.question}</h3>
                        <div className="answer-options">
                          {question.options.map((option) => (
                            <button key={option} onClick={() => answer(option)}>
                              {option}
                              <ArrowRight size={13} />
                            </button>
                          ))}
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (customAnswer.trim()) answer(customAnswer.trim());
                          }}
                          className="custom-answer"
                        >
                          <Input
                            placeholder="Или свой ответ…"
                            value={customAnswer}
                            maxLength={1000}
                            onChange={(e) => setCustomAnswer(e.target.value)}
                          />
                          <Button
                            type="submit"
                            size="icon"
                            aria-label="Отправить ответ"
                            disabled={!customAnswer.trim()}
                          >
                            <Send size={15} />
                          </Button>
                        </form>
                      </div>
                    )}
                    {busy && (
                      <div className="assistant-thinking" role="status">
                        <span />
                        <span />
                        <span />
                        Сопоставляем интересы и хорошие идеи…
                      </div>
                    )}
                  </div>
                  {error && <ErrorState message={error} />}
                  <form
                    className="chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run();
                    }}
                  >
                    <Textarea
                      aria-label="Пожелания к подарку"
                      placeholder={
                        result
                          ? "Что изменим? Например, без косметики, больше творчества…"
                          : "Например: подарок подруге, любит рисовать и корейскую культуру. Хочется удивить…"
                      }
                      rows={3}
                      value={prompt}
                      maxLength={4000}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={busy || !!question}
                    />
                    <div className="composer-bottom">
                      <span>
                        {recording
                          ? "Идёт запись · до 25 секунд"
                          : transcribing
                            ? "Распознаём вашу запись…"
                            : "Можно своими словами. Учтём детали."}
                      </span>
                      <div>
                        <button
                          className={cn("mic-button", recording && "recording")}
                          type="button"
                          aria-label={recording ? "Остановить запись" : "Голосовой ввод"}
                          onClick={() => void microphone()}
                          disabled={busy || transcribing || !!question}
                        >
                          {transcribing ? (
                            <Loader2 size={18} className="spin" />
                          ) : recording ? (
                            <Square size={17} fill="currentColor" />
                          ) : (
                            <Mic size={19} />
                          )}
                        </button>
                        <Button type="submit" disabled={busy || !!question || !occasion.trim()}>
                          {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                          <span>{result ? "Уточнить подбор" : "Найти идеи"}</span>
                          <ArrowRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </form>
                  <div className="chat-privacy">
                    Демоанализ не передаёт данные внешнему ИИ. Не вводите чувствительные сведения.
                  </div>
                </section>
                {result && (
                  <section className="recommendation-results" ref={resultsRef}>
                    <div className="section-heading">
                      <div>
                        <h2>
                          {result.recommendations.length
                            ? "Вот что может порадовать"
                            : "Попробуем немного иначе"}
                        </h2>
                        <p>
                          {result.recipient_name} · {result.occasion} · до {rub(result.budget)}
                        </p>
                      </div>
                      <Badge tone="green">{result.recommendations.length} идей</Badge>
                    </div>
                    <DemoNotice />
                    <div className="result-filters">
                      <Select
                        aria-label="Категория подарков"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="all">Все категории</option>
                        {[...new Set(result.recommendations.map((r) => r.product.category))].map(
                          (c) => (
                            <option key={c}>{c}</option>
                          ),
                        )}
                      </Select>
                      <Select
                        aria-label="Сортировка подарков"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="relevance">По совпадению</option>
                        <option value="price-asc">Сначала дешевле</option>
                        <option value="price-desc">Сначала дороже</option>
                      </Select>
                    </div>
                    {recommendations.length ? (
                      <div className="product-grid assistant-products">
                        {recommendations.map((item) => (
                          <ProductCard
                            key={item.id}
                            product={item.product}
                            reason={item.reason}
                            score={item.score}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="Под эти условия пока нет идей"
                        text="Увеличьте бюджет, выберите другую категорию или уточните пожелания."
                      />
                    )}
                    <p className="subtle-caption">
                      Совпадение — внутренняя оценка алгоритма. Наличие и доставку
                      {city ? ` в ${city}` : ""} уточняйте в магазине. Подборка сохранена в истории.
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <Modal
        open={speechNotice}
        onOpenChange={setSpeechNotice}
        title="Поговорим, когда всё будет готово"
        description="Голосовой ввод работает через Yandex SpeechKit."
      >
        <div className="speech-notice-art">
          <Mic size={32} />
        </div>
        <p className="modal-paragraph">
          {!integrations?.speech_connected
            ? "SpeechKit пока не подключён. Для записи нужен API-ключ и разрешение внешней обработки на сервере. Сейчас все пожелания можно ввести текстом."
            : "Перед записью разрешите обработку голоса в настройках конфиденциальности. Разрешение браузера на микрофон будет запрошено только при записи."}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setSpeechNotice(false)}>
            Понятно
          </Button>
          <Button asChild>
            <Link href="/settings">
              Открыть настройки
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      </Modal>
      <Modal
        open={speechDraft !== null}
        onOpenChange={(open) => {
          if (!open) setSpeechDraft(null);
        }}
        title="Всё правильно расслышали?"
        description="Проверьте и исправьте текст. Он не отправляется автоматически."
      >
        <Textarea
          rows={5}
          aria-label="Распознанный текст"
          value={speechDraft || ""}
          maxLength={4000}
          onChange={(e) => setSpeechDraft(e.target.value)}
        />
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setSpeechDraft(null)}>
            Удалить запись
          </Button>
          <Button
            onClick={() => {
              setPrompt((current) => (current + " " + speechDraft).trim().slice(0, 4000));
              setSpeechDraft(null);
            }}
          >
            <Check size={15} />
            Добавить в сообщение
          </Button>
        </div>
      </Modal>
    </>
  );
}
