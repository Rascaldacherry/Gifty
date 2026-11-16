"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Gift, Heart, Search } from "lucide-react";
import { useGifty } from "@/components/providers";
import { Badge, DemoNotice, EmptyState, Loading, PageHeading } from "@/components/shared";
import { ProductCard } from "@/components/product-card";
import { CollectionCard } from "@/components/gift-sets";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export default function FavoritesPage() {
  const { favorites, collections, loading } = useGifty();
  const [tab, setTab] = useState("gifts"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("recent");
  const savedSets = collections.filter((c) => c.saved);
  const filtered = favorites
    .filter(
      (f) =>
        f.product.title.toLowerCase().includes(query.toLowerCase()) &&
        (category === "all" || f.product.category === category),
    )
    .sort((a, b) => (sort === "price" ? a.product.price_rub - b.product.price_rub : 0));
  return (
    <>
      <PageHeading
        eyebrow="ТО, К ЧЕМУ ХОЧЕТСЯ ВЕРНУТЬСЯ"
        title="Сохранено с любовью"
        description="Хорошие идеи пусть будут под рукой. Для ближайшего повода и просто так."
        action={
          <Button asChild variant="outline">
            <Link href="/assistant">
              Больше идей
              <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="assistant-tabs">
        <button className={tab === "gifts" ? "active" : ""} onClick={() => setTab("gifts")}>
          <Heart size={17} />
          Подарки<Badge>{favorites.length}</Badge>
        </button>
        <button className={tab === "sets" ? "active" : ""} onClick={() => setTab("sets")}>
          <Gift size={17} />
          Сохранённые наборы<Badge>{savedSets.length}</Badge>
        </button>
      </div>
      {tab === "gifts" ? (
        <>
          <div className="list-toolbar">
            <div className="search-input">
              <Search size={17} />
              <Input
                aria-label="Поиск в избранном"
                placeholder="Найти ту самую идею…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="toolbar-filters">
              <Select
                aria-label="Категория"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Все категории</option>
                {[...new Set(favorites.map((f) => f.product.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select
                aria-label="Сортировка"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Сначала последние</option>
                <option value="price">Сначала дешевле</option>
              </Select>
            </div>
          </div>
          {loading && !favorites.length ? (
            <Loading />
          ) : filtered.length ? (
            <>
              <div className="product-grid">
                {filtered.map((favorite) => (
                  <ProductCard key={favorite.id} product={favorite.product} />
                ))}
              </div>
              <DemoNotice />
            </>
          ) : (
            <EmptyState
              icon={Heart}
              title={
                query || category !== "all"
                  ? "Эта идея пока не нашлась"
                  : "Место для особенных находок"
              }
              text={
                query || category !== "all"
                  ? "Попробуйте изменить поиск или категорию."
                  : "Нажмите на сердечко у понравившегося подарка. Мы сохраним его здесь."
              }
              action={
                <Button asChild>
                  <Link href="/assistant">
                    Найти подарок
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              }
            />
          )}
        </>
      ) : savedSets.length ? (
        <div className="collections-grid">
          {savedSets.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Gift}
          title="Соберём маленькую историю?"
          text="Сохранённые подарочные наборы появятся здесь."
          action={
            <Button asChild>
              <Link href="/assistant?tab=sets">
                Создать набор
                <ArrowRight size={15} />
              </Link>
            </Button>
          }
        />
      )}
    </>
  );
}
