import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStoreV4?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStoreV4??=openSalesStore();}
