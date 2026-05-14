# Pokopia image URL dedupe summary

Generated: 2026-05-12

## Cleaned dataset
- Total image rows: 426
- Pokemon rows: 311
- Furniture rows: 115

## Output files
- `pokemon_images.csv`: one image per cleaned Pokemon / Pokopia special Pokemon entry, with Simplified Chinese names.
- `item_furniture_images.csv`: one image per furniture entry, with Simplified Chinese names.
- `infipoke_items_zh_hans.csv`: Simplified Chinese item-name snapshot from the InfiPoke Pokopia item index.
- `pokopia_image_urls.csv`: combined cleaned Pokemon + furniture rows.

## Columns
- `kind`: `pokemon` or `furniture`
- `name`: canonical English source name used for matching
- `name_zh_hans`: matched Simplified Chinese name
- `image_url`: selected single image URL
- `source_page`: source page where the image URL was found
- `source`: local scrape source key
- `translation_source`: source class used for Chinese-name matching

## Dedupe rules
- Pokemon: kept only Pokopia-specific Pokemon rows: `pokopiadex_pokedex` rows from the Pokopia Pokedex page, plus `rankedboost_pokedex` rows whose image URL is under `/pokopia/assets/npcs/` for Pokopia special Pokemon/NPC images.
- Pokemon: dropped hash-only Game8 rows, moves, specialties, page labels, duplicate aliases, duplicate special-form aliases, and generic Pokemon sprite assets from other Pokemon contexts such as `rankedboost` `/k-Pokemon/.../sprites-official/` URLs.
- Furniture: kept only names present in the Furniture category, normalized punctuation/case variants, and preferred `pokopiadex_furniture` image URLs over `pokopia_town_furniture` when both existed.
- Furniture: dropped ordinary items, materials, habitat images, page decorations, category labels, hash-only Game8 rows, and non-furniture aliases.

## Chinese-name sources
- Standard Pokemon names: official Chinese Pokemon names as reflected in the public Chinese-name index.
- Pokopia special Pokemon names: Simplified Chinese names from the official Pokopia `sc/pokemon` page.
- Furniture names: Simplified Chinese in-game names from InfiPoke Pokopia item/crafting indexes; Nintendo's official store page confirms Pokopia supports Simplified Chinese, but I did not find an official public page that lists every furniture name one by one.
- Full item-name snapshot: Simplified Chinese item names from InfiPoke's Pokopia item index, used to populate generated `nameZh` / `itemZhName` values when the English name or normalized slug matches.

## Source URLs used for translation checks
- https://bulbapedia.bulbagarden.net/wiki/List_of_Chinese_Pok%C3%A9mon_names
- https://www.pocoapokemon.jp/sc/pokemon/
- https://infipoke.com/zh/game/pokopia/items
- https://infipoke.com/zh/game/pokopia/crafting
- https://www.nintendo.com/us/store/products/pokemon-pokopia-121593/

## Second-pass Pokemon filter
- Removed generic non-Pokopia Pokemon sprite rows: 5
- Removed names: Hoppip, Jumpluff, Paldean Wooper, Sableye, Skiploom

## Decorative item expansion
- Generated: 2026-05-12
- Requirement: include all Pokopia items that can be used for decoration, including blocks, decoration-tagged items, toy-tagged items, furniture, and ordinary food/material items that can be placed on the ground.
- Output files:
  - `decorative_item_images.csv`: one row per deduped decorative item selected from the expanded rules.
  - `decorative_item_portraits/`: downloaded item portraits/icons for the expanded decorative item set.
  - `decorative_item_portraits/manifest.csv`: download manifest with local filename, source URL, content type, byte size, SHA-256, and status.
- Source pages:
  - `https://pokopiadex.com/items`
  - `https://infipoke.com/zh/game/pokopia/items`
- Selection rules:
  - Keep PokopiaDex rows where `menu_category` is `Furniture` or `Blocks`, or `tags` contains `Decoration` or `Toy`.
  - Keep InfiPoke rows where `category` is `Furniture` or `Blocks`, or `tag` is `Decoration` or `Toy`.
  - Keep PokopiaDex `Food` and `Materials` rows when `favorite_category_ids` is non-empty, used here as the available source signal that the item can be placed as a ground/world item for Pokemon preferences.
  - Merge both sources by normalized English item name to catch current event items from PokopiaDex and extra block/decorative rows from InfiPoke.
  - Prefer PokopiaDex image URLs when available; fall back to InfiPoke WebP images when PokopiaDex has no image.
- Decorative item rows: 658
  - Blocks: 197
  - Furniture: 117
  - Misc.: 142
  - Outdoor: 57
  - Utilities: 49
  - Other: 27
  - Food: 36
  - Materials: 30
  - Buildings: 2
  - Nature: 1
- Download result:
  - 638 images downloaded from PokopiaDex.
  - 19 images downloaded from InfiPoke.
  - 1 image uses a shared InfiPoke Farm soil fallback because `Farm soil (Skyland)` is listed by InfiPoke but its item-specific rendered image URL returns 404; the other Farm soil variants share identical image bytes.

## Complete PokopiaDex placeable item scrape
- Generated: 2026-05-12
- Requirement: include all PokopiaDex items with `inventory_status` set to `in-collection`, matching the 1,219 items shown as collectible/placeable on the PokopiaDex items page.
- Source page:
  - `https://pokopiadex.com/items?source=base`
- Output files:
  - `pokopiadex_placeable_items.csv`: normalized item meta for the 1,219 in-collection rows.
  - `pokopiadex_placeable_items.json`: raw PokopiaDex item objects after the in-collection filter.
  - `item_portraits/`: downloaded local icon files for all 1,219 rows.
  - `item_portraits/manifest.csv`: normalized meta plus local filename, source URL, content type, byte size, SHA-256, and download status.
  - `pokopiadex_placeable_items_summary.md`: generated count summary for this complete scrape.
- Download result:
  - 1,219 images downloaded from PokopiaDex.
  - 0 image download failures.
