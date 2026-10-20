import "server-only";
import {openActivityStore} from "./activity-store";
const cache=globalThis as unknown as {activityStore?:ReturnType<typeof openActivityStore>};
export function getActivityStore(){return cache.activityStore??=openActivityStore();}
