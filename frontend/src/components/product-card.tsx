"use client";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Heart, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import { rub, cn } from "@/lib/utils";
import { useGifty } from "./providers";
import { Badge } from "./shared";

export function ProductCard({
  product,
  reason,
  score,
  compact = false,
}: {
  product: Product;
  reason?: string;
  score?: number;
  compact?: boolean;
}) {
  const { favorites, toggleFavorite } = useGifty();
  const [pending, setPending] = useState(false);
  const isFavorite = favorites.some((f) => f.product.id === product.id);
  return (
    <article className={cn("product-card", compact && "product-card-compact")}>
      <div className={cn("product-image", `product-bg-${product.category.length % 5}`)}>
        <img
          src={product.image_url}
          alt={product.title}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <button
          className={cn("favorite-button", isFavorite && "is-favorite")}
          disabled={pending}
          aria-label={
            isFavorite
              ? `Убрать ${product.title} из избранного`
              : `Добавить ${product.title} в избранное`
          }
          aria-pressed={isFavorite}
          onClick={async () => {
            setPending(true);
            await toggleFavorite(product);
            setPending(false);
          }}
        >
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        {score !== undefined && (
          <span
            className="score-badge"
            title="Внутренняя расчётная оценка соответствия, не рейтинг товара"
          >
            <Sparkles size={11} />
            {Math.round(score)}% совпадение
          </span>
        )}
      </div>
      <div className="product-body">
        <div className="product-source">
          <span
            className={cn(
              "market-dot",
              product.marketplace === "Ozon"
                ? "market-ozon"
                : product.marketplace === "Wildberries"
                  ? "market-wb"
                  : "market-ym",
            )}
          />
          {product.marketplace}
          <span className="product-demo-label">
            {product.source === "mock" ? "ДЕМО" : "КАТАЛОГ"}
          </span>
        </div>
        <h3>{product.title}</h3>
        <div className="product-price">
          {rub(product.price_rub)}
          {product.source === "mock" && <span>условная цена</span>}
        </div>
        {!compact && (
          <div className="product-tags">
            <Badge>{product.category}</Badge>
          </div>
        )}
        {reason && (
          <details className="product-reason">
            <summary>
              <Check size={13} />
              Почему подойдёт
              <ChevronDown size={13} />
            </summary>
            <p>{reason}</p>
          </details>
        )}
        <a
          className="product-buy"
          href={product.product_url || product.search_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {product.product_url ? "К товару" : "Найти в магазине"}
          <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  );
}
