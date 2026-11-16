import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">404</span>
      <h1>Кажется, идея ушла гулять</h1>
      <p>Этой страницы нет. Вернёмся в ваше пространство?</p>
      <Button asChild>
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
