import "server-only";
import {openInventoryStore} from "./inventory-store";
const cache=globalThis as unknown as {inventoryStoreV6?:ReturnType<typeof openInventoryStore>};
export function getInventoryStore(){return cache.inventoryStoreV6??=openInventoryStore();}
