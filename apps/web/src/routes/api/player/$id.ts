// GET /api/player/<name or UUID>
// A Mojang account's name, UUID, skin and cape. Found players are cached for
// an hour, names nobody has for five minutes.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/player/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cached, direct }, { lookupPlayer, playerKey }] = await Promise.all([
          import("../../../server/http"),
          import("../../../server/mojang"),
        ]);
        const id = decodeURIComponent(params.id).trim();
        const key = playerKey(id);
        if (!key) return direct(await lookupPlayer(id));
        return cached(request, key, () => lookupPlayer(id));
      },
    },
  },
});
