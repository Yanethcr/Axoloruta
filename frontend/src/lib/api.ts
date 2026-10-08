export async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(body !== undefined ? {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Request': '1' }, body: JSON.stringify(body),
  } : {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'No se pudo completar la solicitud');
  return data;
}
