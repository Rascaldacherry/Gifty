import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const rub = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
export const todayISO = () => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
export const dateLabel = (value: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(
    value.length === 10
      ? value + "T12:00:00+03:00"
      : /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
        ? value
        : value + "Z",
  ).toLocaleDateString("ru-RU", {
    ...(opts ?? { day: "numeric", month: "long" }),
    timeZone: "Europe/Moscow",
  });
