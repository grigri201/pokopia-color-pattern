import { createReadStream, cpSync, existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { defineConfig } from "vite";

const docsSource = resolve(__dirname, "docs/pokopia_image_sources");
const docsTarget = resolve(__dirname, "dist/docs/pokopia_image_sources");
const generatedDataSource = resolve(__dirname, "generated/data");
const generatedDataTarget = resolve(__dirname, "dist/data");
const requiredGeneratedDataFiles = ["pokemon-index.json", "compact-items.json", "item-colors.json"];
const requiredGeneratedDataDirectories = ["recommendations"];

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

          if (!expectedGeneratedDataFiles().has(relativePath)) {
            response.statusCode = 404;
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
        const allowlist = assertRequiredGeneratedDataFiles();
        cpSync(generatedDataSource, generatedDataTarget, {
          recursive: true,
          filter: (source) => isAllowedGeneratedDataCopyPath(source, allowlist),
        });
      },
    },
  ],
});

function contentType(path: string): string {
  return extname(path) === ".json" ? "application/json; charset=utf-8" : "application/octet-stream";
}

function assertRequiredGeneratedDataFiles(): Set<string> {
  if (!existsSync(generatedDataSource) || !statSync(generatedDataSource).isDirectory()) {
    throw new Error("Missing generated data directory. Run `npm run generate:data` before production build.");
  }

  const allowlist = expectedGeneratedDataPaths();
  requiredGeneratedDataFiles.forEach((fileName) => {
    const filePath = resolve(generatedDataSource, fileName);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new Error(`Missing generated data file: generated/data/${fileName}. Run \`npm run generate:data\`.`);
    }
  });
  requiredGeneratedDataDirectories.forEach((directoryName) => {
    const directoryPath = resolve(generatedDataSource, directoryName);
    if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
      throw new Error(`Missing generated data directory: generated/data/${directoryName}. Run \`npm run generate:data\`.`);
    }
  });
  validateGeneratedDataTree(allowlist);
  return allowlist;
}

function expectedGeneratedDataFiles(): Set<string> {
  const allowlist = expectedGeneratedDataPaths();
  return new Set(Array.from(allowlist).filter((path) => path.endsWith(".json")));
}

function expectedGeneratedDataPaths(): Set<string> {
  const allowlist = new Set([...requiredGeneratedDataFiles, ...requiredGeneratedDataDirectories]);
  const pokemonIndexPath = resolve(generatedDataSource, "pokemon-index.json");
  const pokemonIndex = JSON.parse(readFileSync(pokemonIndexPath, "utf8")) as unknown;

  if (!isRecord(pokemonIndex) || !Array.isArray(pokemonIndex.pokemon)) {
    throw new Error("Invalid generated/data/pokemon-index.json. Run `npm run generate:data`.");
  }

  pokemonIndex.pokemon.forEach((pokemon) => {
    if (!isRecord(pokemon) || typeof pokemon.slug !== "string") {
      throw new Error("Invalid Pokemon slug in generated/data/pokemon-index.json. Run `npm run generate:data`.");
    }
    allowlist.add(`recommendations/${pokemon.slug}.json`);
  });
  return allowlist;
}

function validateGeneratedDataTree(allowlist: Set<string>): void {
  listGeneratedDataTree(generatedDataSource).forEach((path) => {
    if (!allowlist.has(path)) {
      throw new Error(`Unexpected generated data path would be copied or served: generated/data/${path}`);
    }
  });
}

function listGeneratedDataTree(root: string, prefix = ""): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return [entryPath, ...listGeneratedDataTree(join(root, entry.name), entryPath)];
    }
    return [entryPath];
  });
}

function isAllowedGeneratedDataCopyPath(source: string, allowlist: Set<string>): boolean {
  if (source.endsWith(".DS_Store")) {
    return false;
  }

  const sourceRelativePath = relative(generatedDataSource, source);
  return sourceRelativePath === "" || allowlist.has(sourceRelativePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
