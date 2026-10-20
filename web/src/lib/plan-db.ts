import "server-only";
import {openPlanStore} from "./plan-store";
const cache=globalThis as unknown as {preparationStore?:ReturnType<typeof openPlanStore>};
export function getPlanStore(){return cache.preparationStore??=openPlanStore();}
