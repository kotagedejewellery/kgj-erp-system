export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  ["userId", "userEmail", "userName", "userUsername", "userRole", "userRoleDetail"].forEach((k) => localStorage.removeItem(k));
  window.location.href = "/login";
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) { handleUnauthorized(); throw new ApiError("Unauthorized", 401); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? body.message ?? "Gagal memuat data", res.status);
  }
  return res.json();
}

type MutatorMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export async function mutator<T>(
  url: string,
  options?: { method?: MutatorMethod; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: options?.method ?? "POST",
    headers:
      options?.body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      options?.body instanceof FormData
        ? options.body
        : options?.body
          ? JSON.stringify(options.body)
          : undefined,
  });
  if (res.status === 401) { handleUnauthorized(); throw new ApiError("Unauthorized", 401); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? body.message ?? "Gagal memproses", res.status);
  }
  return res.json();
}
