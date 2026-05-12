import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const docsSource = resolve(__dirname, "docs/pokopia_image_sources");
const docsTarget = resolve(__dirname, "dist/docs/pokopia_image_sources");

export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: "copy-pokopia-docs",
      closeBundle() {
        if (existsSync(docsSource)) {
          cpSync(docsSource, docsTarget, {
            recursive: true,
            filter: (source) => !source.endsWith(".DS_Store"),
          });
        }
      },
    },
  ],
});
