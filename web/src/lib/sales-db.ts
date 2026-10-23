import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStoreV11?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStoreV11??=openSalesStore();}
