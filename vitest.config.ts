import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // "server-only" זורק בכוונה בכל סביבה שאינה RSC, כולל vitest. מנוטרל
      // כאן כדי שאפשר יהיה לבדוק מודולי שרת (למשל שומר ה-cron) ביחידה.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
