"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty-state">
      <h2>Не получилось открыть страницу</h2>
      <p>Попробуйте ещё раз. Ваши сохранённые данные остаются в аккаунте.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
