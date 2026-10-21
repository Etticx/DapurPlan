import "server-only";
import { openRecipeStore } from "./recipe-store";
const globalDb=globalThis as unknown as {dapurRecipeStoreV2?:ReturnType<typeof openRecipeStore>};
export function getRecipeStore() {
  return globalDb.dapurRecipeStoreV2 ??= openRecipeStore();
}
