export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new APIError(
      0,
      "Не удалось связаться с сервером. Проверьте подключение и запуск backend.",
    );
  }
  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* Use the status fallback. */
    }
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? "Проверьте заполнение полей: " +
            detail
              .map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)} — ${d.msg}`)
              .join("; ")
          : response.status === 502
            ? "Backend недоступен. Проверьте его запуск на порту 8000."
            : "Не удалось выполнить действие. Попробуйте ещё раз.";
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("gifty:session-expired"));
    throw new APIError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const json = (value: unknown) => JSON.stringify(value);
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Произошла ошибка. Попробуйте ещё раз.";
