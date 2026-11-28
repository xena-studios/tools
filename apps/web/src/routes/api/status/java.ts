// GET /api/status/java?host=<host or host:port>[&port=<port>]
// A Java server's status, cached at the edge for a minute per host and port.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/status/java")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [
          { cached, direct, json },
          { checkJava, STATUS_TTL },
          { formatAddress, parseAddress },
        ] = await Promise.all([
          import("../../../server/http"),
          import("../../../server/java"),
          import("@xena-tools/mc-protocol"),
        ]);
        const url = new URL(request.url);
        const host = (url.searchParams.get("host") ?? "").slice(0, 300);
        const port = url.searchParams.get("port");
        // A port that isn't a number becomes "host:NaN", which parseAddress rejects.
        const input = port ? `${host.trim()}:${port.slice(0, 6)}` : host;
        const parsed = parseAddress(input);
        const from = ((request as { cf?: { colo?: unknown } }).cf?.colo as string) ?? null;
        if (!parsed.ok) {
          // Cheap to answer again, so not worth a cache entry; the browser may keep it.
          const result = await checkJava(input, from);
          return direct(json(result, 400, 300));
        }
        const { host: h, port: p } = parsed.address;
        return cached(request, `java/${h}/${p ?? "default"}`, async () =>
          json(await checkJava(formatAddress(h, p), from), 200, STATUS_TTL),
        );
      },
    },
  },
});
