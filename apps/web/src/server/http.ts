// Responses and the edge cache, for the API routes. The Workers Cache API is
// free and per data centre; KV isn't used (its free plan allows 1,000 writes a day).

const API_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export interface Answer {
  status: number;
  body: BodyInit;
  contentType: string;
  /** Seconds the edge and the browser may keep it. 0 for no caching. */
  ttl: number;
  /** Browser caching for a file that never changes at this URL. */
  immutable?: boolean;
}

export const json = (body: unknown, status: number, ttl: number): Answer => ({
  status,
  body: JSON.stringify(body),
  contentType: "application/json; charset=utf-8",
  ttl,
});

function respond(a: Answer, age = 0): Response {
  const left = Math.max(0, a.ttl - age);
  const headers = new Headers(API_HEADERS);
  headers.set("Content-Type", a.contentType);
  headers.set(
    "Cache-Control",
    left > 0 ? `public, max-age=${left}${a.immutable ? ", immutable" : ""}` : "no-store",
  );
  if (age > 0) headers.set("Age", String(age));
  return new Response(a.body, { status: a.status, headers });
}

/** The default cache, or none (in tests, or a runtime without it). */
function edge(): Cache | null {
  try {
    return (globalThis.caches as unknown as { default?: Cache })?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Serves `key` from the edge cache, or computes it and caches it for its ttl.
 * The browser is told only the time that's left, so a cached answer is never
 * held for longer than its ttl in all.
 */
export async function cached(
  request: Request,
  key: string,
  compute: () => Promise<Answer>,
): Promise<Response> {
  const cache = edge();
  const cacheKey = new Request(`${new URL(request.url).origin}/__cache/${key}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const at = Number(hit.headers.get("X-Stored-At")) || Date.now();
      const ttl = Number(hit.headers.get("X-Ttl")) || 0;
      const age = Math.floor((Date.now() - at) / 1000);
      return respond(
        {
          status: hit.status,
          body: await hit.arrayBuffer(),
          contentType: hit.headers.get("Content-Type") ?? "application/octet-stream",
          ttl,
          immutable: hit.headers.get("X-Immutable") === "1",
        },
        age,
      );
    }
  }
  const answer = await compute();
  if (cache && answer.ttl > 0) {
    const body =
      typeof answer.body === "string" ? answer.body : await new Response(answer.body).arrayBuffer();
    const stored = new Response(body, {
      status: answer.status,
      headers: {
        "Content-Type": answer.contentType,
        "Cache-Control": `public, max-age=${answer.ttl}`,
        "X-Stored-At": String(Date.now()),
        "X-Ttl": String(answer.ttl),
        "X-Immutable": answer.immutable ? "1" : "0",
      },
    });
    try {
      await cache.put(cacheKey, stored);
    } catch {
      // A failed cache write only costs the next visitor a fresh check.
    }
    return respond({ ...answer, body });
  }
  return respond(answer);
}

/** An answer that skips the edge cache (bad input costs nothing to answer again). */
export const direct = (a: Answer): Response => respond(a);
