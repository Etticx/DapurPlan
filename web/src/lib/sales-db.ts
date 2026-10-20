import "server-only";
import {openSalesStore} from "./sales-store";
const cache=globalThis as unknown as {salesStore?:ReturnType<typeof openSalesStore>};
export function getSalesStore(){return cache.salesStore??=openSalesStore();}
