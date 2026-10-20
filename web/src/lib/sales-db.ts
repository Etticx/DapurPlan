import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStoreV2?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStoreV2??=openSalesStore();}
