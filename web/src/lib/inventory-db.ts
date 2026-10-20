import "server-only";
import {openInventoryStore} from "./inventory-store";
const cache=globalThis as unknown as {inventoryStore?:ReturnType<typeof openInventoryStore>};
export function getInventoryStore(){return cache.inventoryStore??=openInventoryStore();}
