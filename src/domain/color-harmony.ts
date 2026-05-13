import { evaluateHarmonyRelation, type HarmonyRelationType } from "../../docs/oklch_color.js";

export type HarmonyType = HarmonyRelationType;
export type HarmonyStatus = "passed" | "failed";

export type HarmonyEvaluation = {
  harmonyStatus: HarmonyStatus;
  harmonyType: HarmonyType | null;
  source: "docs/oklch_color.ts";
};

export function evaluateOklchHarmony(pokemonPrimaryColor: string, itemPrimaryColor: string): HarmonyEvaluation {
  const relation = evaluateHarmonyRelation(pokemonPrimaryColor, itemPrimaryColor);

  return {
    harmonyStatus: relation.status,
    harmonyType: relation.type,
    source: "docs/oklch_color.ts",
  };
}
