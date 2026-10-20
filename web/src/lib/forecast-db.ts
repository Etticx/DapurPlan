import "server-only";
import {openForecastStore} from "./forecast-store";
const cache=globalThis as unknown as {forecastStore?:ReturnType<typeof openForecastStore>};
export function getForecastStore(){return cache.forecastStore??=openForecastStore();}
