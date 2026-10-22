import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStoreV9?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStoreV9??=openSalesStore();}
