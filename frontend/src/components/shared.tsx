"use client";
import Link from "next/link";
import { Gift, Loader2, ArrowRight, AlertCircle, Flower2, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Recipient } from "@/lib/types";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="Gifty — главная">
      <span className="logo-mark">
        <Gift size={24} strokeWidth={1.8} />
      </span>
      {!compact && (
        <>
          <span>
            gifty<span className="logo-dot">.</span>
          </span>
          <span className="logo-ai">AI</span>
        </>
      )}
    </Link>
  );
}
export function Avatar({
  person,
  size = "md",
}: {
  person: Pick<Recipient, "name" | "avatar">;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span className={cn("avatar", `avatar-${person.avatar}`, `avatar-${size}`)} aria-hidden="true">
      <span>{person.name.charAt(0).toUpperCase()}</span>
      <Flower2 className="avatar-flower" size={size === "xl" ? 30 : 19} strokeWidth={1.2} />
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "purple" | "green" | "peach";
  className?: string;
}) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  subtitle,
  href,
  link = "Смотреть все",
  action,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  link?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {href ? (
        <Link href={href} className="text-link">
          {link}
          <ArrowRight size={15} />
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
export function EmptyState({
  icon: Icon = Gift,
  title,
  text,
  action,
}: {
  icon?: typeof Gift;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading({ text = "Загружаем ваше пространство…" }: { text?: string }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 size={24} className="spin" />
      <span>{text}</span>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("field", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
export function CheckField({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("check-field", disabled && "disabled")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="custom-check">{checked && <Check size={13} />}</span>
      <span>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("demo-notice", compact && "demo-notice-compact")}>
      <Sparkles size={16} />
      <p>
        {compact
          ? "Демокаталог · условные цены и иллюстрации"
          : "У идей с пометкой «Демо» цены и изображения условные. Наличие и стоимость уточняйте в магазине. Если прямой карточки нет, ссылка ведёт на поиск."}
      </p>
    </div>
  );
}
