import { createReadStream, cpSync, existsSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { defineConfig } from "vite";

const docsSource = resolve(__dirname, "docs/pokopia_image_sources");
const docsTarget = resolve(__dirname, "dist/docs/pokopia_image_sources");
const generatedDataSource = resolve(__dirname, "generated/data");
const generatedDataTarget = resolve(__dirname, "dist/data");
const requiredGeneratedDataFiles = ["pokemon-index.json", "compact-items.json"];

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
    {
      name: "serve-and-copy-generated-data",
      buildStart() {
        assertRequiredGeneratedDataFiles();
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith("/data/")) {
            next();
            return;
          }

          const url = new URL(request.url, "http://localhost");
          const relativePath = decodeDataPath(url.pathname.replace(/^\/data\//, ""));
          if (relativePath === null) {
            response.statusCode = 400;
            response.end();
            return;
          }

          const dataPath = resolve(generatedDataSource, relativePath);
          const dataRelativePath = relative(generatedDataSource, dataPath);
          const escapesDataRoot = dataRelativePath.startsWith("..") || dataRelativePath.includes(`..${sep}`);

          if (
            escapesDataRoot ||
            !existsSync(dataPath) ||
            !statSync(dataPath).isFile() ||
            !isInsideGeneratedDataRoot(dataPath)
          ) {
            response.statusCode = 404;
            response.end();
            return;
          }

          response.setHeader("content-type", contentType(dataPath));
          const stream = createReadStream(dataPath);
          stream.on("error", () => {
            if (!response.headersSent) {
              response.statusCode = 500;
            }
            response.end();
          });
          stream.pipe(response);
        });
      },
      closeBundle() {
        assertRequiredGeneratedDataFiles();
        cpSync(generatedDataSource, generatedDataTarget, {
          recursive: true,
          filter: (source) => !source.endsWith(".DS_Store"),
        });
      },
    },
  ],
});

function contentType(path: string): string {
  return extname(path) === ".json" ? "application/json; charset=utf-8" : "application/octet-stream";
}

function assertRequiredGeneratedDataFiles(): void {
  if (!existsSync(generatedDataSource) || !statSync(generatedDataSource).isDirectory()) {
    throw new Error("Missing generated data directory. Run `npm run generate:data` before production build.");
  }

  requiredGeneratedDataFiles.forEach((fileName) => {
    const filePath = resolve(generatedDataSource, fileName);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new Error(`Missing generated data file: generated/data/${fileName}. Run \`npm run generate:data\`.`);
    }
  });
}

function decodeDataPath(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function isInsideGeneratedDataRoot(path: string): boolean {
  const root = realpathSync(generatedDataSource);
  const target = realpathSync(path);
  const targetRelativePath = relative(root, target);
  return targetRelativePath !== "" && !targetRelativePath.startsWith("..") && !targetRelativePath.includes(`..${sep}`);
}
