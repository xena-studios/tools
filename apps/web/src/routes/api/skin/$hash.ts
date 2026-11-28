// GET /api/skin/<texture hash>
// A skin or cape PNG from textures.minecraft.net, served from this origin so
// the page can draw it on a canvas under its own CSP. Only that host, only a
// texture hash: not an open proxy. Cached for a day.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/skin/$hash")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cached, direct }, { fetchTexture }, { TEXTURE_HASH }] = await Promise.all([
          import("../../../server/http"),
          import("../../../server/mojang"),
          import("../../../lib/api"),
        ]);
        const hash = params.hash.replace(/\.png$/, "");
        if (!TEXTURE_HASH.test(hash)) return direct(await fetchTexture(hash));
        return cached(request, `skin/${hash}`, () => fetchTexture(hash));
      },
    },
  },
});
