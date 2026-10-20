import "server-only";
import { openRecipeStore } from "./recipe-store";
const globalDb=globalThis as unknown as {dapurRecipeStore?:ReturnType<typeof openRecipeStore>};
export function getRecipeStore() {
  return globalDb.dapurRecipeStore ??= openRecipeStore();
}
