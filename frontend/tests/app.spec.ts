import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async () => {
  // Optional pacing for a normal development instance with its request limiter enabled.
  if (process.env.E2E_THROTTLE === "true")
    await new Promise((resolve) => setTimeout(resolve, 12000));
});

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Попробовать демо", exact: true }).click();
  await page.getByRole("button", { name: "Пропустить знакомство" }).click();
  await expect(page.getByRole("heading", { name: /Привет,/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Все люди", exact: true })).toBeVisible();
}

test("demo dashboard, quick recommendations, favorites and persisted history", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/assistant");
  await page.getByLabel("Для кого ищем").selectOption({ label: "Аня · Подруга" });
  await page.getByLabel("Бюджет, до ₽").fill("3000");
  await page
    .getByLabel("Пожелания к подарку")
    .fill("Любит рисовать. Не хочу дарить косметику, без книг.");
  await page.getByRole("button", { name: "Найти идеи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Вот что может порадовать" })).toBeVisible();
  const cards = page.locator(".recommendation-results .product-card");
  await expect(cards).toHaveCount(8);
  const request = await page.request.get("/api/requests");
  const latest = (await request.json())[0];
  expect(
    latest.recommendations.every(
      (r: { product: { price_rub: number; category: string } }) =>
        r.product.price_rub <= 3000 && !["Красота", "Книги"].includes(r.product.category),
    ),
  ).toBeTruthy();
  await cards
    .first()
    .getByRole("button", { name: /Добавить.*в избранное/ })
    .click();
  await expect(page.getByText("Сохранили в избранное", { exact: true })).toBeVisible();
  await page.goto("/history");
  await expect(page.locator(".request-card")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".request-card")).toHaveCount(3);
  await page.goto(`/assistant?request=${latest.id}`);
  await expect(page.getByRole("heading", { name: "Вот что может порадовать" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Найти в магазине" }).first()).toHaveAttribute(
    "href",
    /^https:\/\//,
  );
});

test("create and edit a recipient; confirm imported interests; erase source", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/people");
  await page.getByRole("button", { name: "Добавить человека", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Имя или псевдоним").fill("Лена Тест");
  await dialog.getByPlaceholder("Книги, рисование, путешествия…").fill("Кофе, Книги");
  await dialog.getByRole("button", { name: "Добавить человека", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("heading", { name: "Лена Тест", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gift DNA", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Импортировать текст" }).click();
  await page.getByLabel("Текст с интересами").fill("Любит путешествия и музыку, играет на гитаре");
  await page.getByLabel("Источник разрешено использовать").check();
  await page.getByRole("button", { name: "Предложить интересы" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Предположение", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).first().click();
  await page.getByRole("button", { name: "Сохранить DNA" }).click();
  await expect(page.getByText("Подтверждено вами", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Удалить импорт Мои заметки" }).click();
  await expect(page.getByText("Предположение", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Подтверждено вами", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Редактировать профиль" }).click();
  await page.getByLabel("Имя или псевдоним").fill("Лена Обновлённая");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("heading", { name: "Лена Обновлённая", exact: true })).toBeVisible();
});

test("smart selection and unavailable voice input", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Умный подбор Сначала уточним детали" }).click();
  await page.getByRole("button", { name: "Найти идеи", exact: true }).click();
  await page.getByRole("button", { name: "Необычным", exact: true }).click();
  await page.getByRole("button", { name: "Без косметики", exact: true }).click();
  await page.getByRole("button", { name: "Личное внимание", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Вот что может порадовать" })).toBeVisible();
  await page.getByRole("button", { name: "Голосовой ввод", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("SpeechKit пока не подключён");
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
});

test("calendar event and gift set creation", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Добавить событие", exact: true }).click();
  await page.getByLabel("Название события").fill("День дружбы");
  await page.getByRole("button", { name: "Сохранить событие", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".calendar-event").filter({ hasText: "День дружбы" })).toBeVisible();
  await page.goto("/assistant?tab=sets");
  await page.getByRole("button", { name: "Собрать набор", exact: true }).click();
  await expect(page.locator(".collection-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Сохранить весь набор", exact: true }).click();
  await expect(page.getByRole("button", { name: "Набор сохранён", exact: true })).toBeVisible();
  await page.locator(".collection-items button").first().click();
  await expect(page.getByText("В пределах бюджета", { exact: true })).toBeVisible();
  const collections = await (await page.request.get("/api/collections")).json();
  expect(collections[0].total).toBeLessThanOrEqual(collections[0].budget);
});

test("mobile navigation and desktop layout have no overflow", async ({ page }) => {
  await enterDemo(page);
  await expect(page.locator(".hero-card")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "../.artifacts/dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Открыть меню", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page.getByRole("link", { name: "Мои люди", exact: false }).first().click();
  await expect(page.getByRole("heading", { name: "Ваши люди", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.goto("/assistant");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "../.artifacts/assistant-mobile.png", fullPage: true });
});

test("new account works from empty state and remembers gifts after logout", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.ru`;
  const password = "test-password-with-12-characters";
  await page.goto("/login");
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).first().click();
  await page.getByLabel("Как к вам обращаться").fill("Олег");
  await page.getByLabel("Электронная почта", { exact: true }).fill(email);
  await page.getByLabel(/^Пароль/).fill(password);
  await page.locator(".privacy-checkbox input").check();
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).last().click();
  await page.getByRole("button", { name: "Пропустить знакомство" }).click();
  await expect(page.getByRole("heading", { name: "Привет, Олег ☀", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Добавить человека", exact: true }).click();
  await page.getByLabel("Имя или псевдоним").fill("Друг Олега");
  await page.getByPlaceholder("Книги, рисование, путешествия…").fill("Книги");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Добавить человека", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/assistant");
  await page.getByLabel("Для кого ищем").selectOption({ label: "Друг Олега · Друг" });
  await page.getByLabel("Бюджет, до ₽").fill("2000");
  await page.getByRole("button", { name: "Найти идеи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Вот что может порадовать" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти из аккаунта", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Рады снова видеть." })).toBeVisible();
  await page.getByLabel("Электронная почта", { exact: true }).fill(email);
  await page.getByLabel(/^Пароль/).fill(password);
  await page.getByRole("button", { name: "Войти в своё пространство", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Привет, Олег ☀", exact: true })).toBeVisible();
  await page.goto("/history");
  await expect(page.locator(".request-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "День рождения · Друг Олега", exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспортировать данные", exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe("gifty-data.json");
  await page.getByRole("button", { name: "Удалить мой аккаунт", exact: true }).click();
  await page.getByLabel("Для подтверждения введите УДАЛИТЬ").fill("УДАЛИТЬ");
  await page.getByRole("button", { name: "Удалить все данные", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Рады снова видеть." })).toBeVisible();
});

test("account switch clears previous data even when the new workspace cannot load", async ({
  page,
}) => {
  await enterDemo(page);
  await expect(page.locator(".person-mini")).toHaveCount(4);
  await page.getByRole("button", { name: "Выйти из аккаунта", exact: true }).click();
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).first().click();
  await page.getByLabel("Как к вам обращаться").fill("Новый пользователь");
  await page
    .getByLabel("Электронная почта", { exact: true })
    .fill(`isolation-${Date.now()}@example.ru`);
  await page.getByLabel(/^Пароль/).fill("isolation-test-password");
  await page.locator(".privacy-checkbox input").check();
  await page.route("**/api/recipients", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Тестовая недоступность сервера" }),
    }),
  );
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).last().click();
  await page.getByRole("button", { name: "Пропустить знакомство" }).click();
  await expect(page.getByRole("heading", { name: "Привет, Новый ☀", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Тестовая недоступность сервера",
  );
  await expect(page.locator(".person-mini")).toHaveCount(0);
  await expect(page.locator(".saved-row")).toHaveCount(0);
  await page.unroute("**/api/recipients");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".person-mini")).toHaveCount(0);
});
