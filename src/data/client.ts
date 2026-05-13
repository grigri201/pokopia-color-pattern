import {
  validateCompactItemsData,
  validatePokemonIndexData,
  validateRecommendationsData,
  type CompactItemsData,
  type PokemonIndexData,
  type RecommendationsData,
  type SchemaIssue,
} from "./schemas.js";

const POKEMON_INDEX_PATH = "/data/pokemon-index.json";
const COMPACT_ITEMS_PATH = "/data/compact-items.json";

export type GeneratedData = {
  pokemonIndex: PokemonIndexData;
  compactItems: CompactItemsData;
};

export class GeneratedDataError extends Error {
  readonly filePath: string;

  constructor(filePath: string, message: string) {
    super(message);
    this.name = "GeneratedDataError";
    this.filePath = filePath;
  }
}

export async function loadGeneratedData(): Promise<GeneratedData> {
  const [pokemonIndex, compactItems] = await Promise.all([
    fetchAndValidate<PokemonIndexData>(POKEMON_INDEX_PATH, validatePokemonIndexData),
    fetchAndValidate<CompactItemsData>(COMPACT_ITEMS_PATH, validateCompactItemsData),
  ]);

  return { pokemonIndex, compactItems };
}

export async function loadRecommendationData(slug: string): Promise<RecommendationsData> {
  const filePath = recommendationDataPath(slug);
  const data = await fetchAndValidate<RecommendationsData>(filePath, validateRecommendationsData);
  if (data.pokemonSlug !== slug) {
    throw new GeneratedDataError(filePath, `推荐数据 pokemonSlug 不匹配：expected ${slug}, got ${data.pokemonSlug}`);
  }
  return data;
}

function recommendationDataPath(slug: string): string {
  return `/data/recommendations/${encodeURIComponent(slug)}.json`;
}

async function fetchAndValidate<T>(
  filePath: string,
  validate: (value: unknown) => SchemaIssue[],
): Promise<T> {
  const json = await fetchJson(filePath);
  const issues = validate(json);
  if (issues.length > 0) {
    throw new GeneratedDataError(filePath, `数据结构校验失败：${formatIssues(issues)}`);
  }
  return json as T;
}

async function fetchJson(filePath: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(filePath, { cache: "no-cache" });
  } catch (error) {
    throw new GeneratedDataError(filePath, `无法请求数据文件：${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw new GeneratedDataError(filePath, `数据文件请求失败：HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new GeneratedDataError(filePath, `JSON 解析失败：${errorMessage(error)}`);
  }
}

function formatIssues(issues: SchemaIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path} ${issue.message}`)
    .join("; ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
