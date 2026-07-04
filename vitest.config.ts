import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        bindings: {
          READ_PUBLIC: "false",
          MAX_ENTRIES: "2000"
        }
      },
      wrangler: {
        configPath: "./wrangler.jsonc"
      }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"]
  }
});
