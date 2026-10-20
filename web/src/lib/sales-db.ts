import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStoreV3?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStoreV3??=openSalesStore();}
