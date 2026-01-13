import dictionaryJson from "../data/dictionary.json";
import {
  normalizeDictionary,
  type Dictionary,
  type NormalizedDictionary,
  type DictionaryMeta,
  type StandardEntry
} from "./dict-utils";

export type { Dictionary, NormalizedDictionary, DictionaryMeta, StandardEntry };
export { normalizeDictionary };

let cachedDictionary: NormalizedDictionary | null = null;

export function getDictionary(): NormalizedDictionary {
  if (cachedDictionary) {
    return cachedDictionary;
  }

  cachedDictionary = normalizeDictionary(dictionaryJson as Dictionary);
  return cachedDictionary;
}
