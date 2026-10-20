import {salesMenus,type SalesDay} from "./sales";
import {addDays} from "./inventory";
export type ForecastInput={item:string;day_of_week:number;sales_yesterday:number;sales_last_week:number;average_previous_7_days:number};
export type PreparedForecast={targetDate:string;days:SalesDay[];inputs:ForecastInput[];missing:string[];inputKey:string;hasDemoData:boolean;soldOutCount:number};
export type SavedForecast={id:number;targetDate:string;createdAt:string;createdBy:string;modelId:string;syntheticModel:boolean;inputs:ForecastInput[];history:SalesDay[];inputKey:string;predictions:{menuId:string;item:string;predictedServings:number}[]};
export type ForecastView={targetDate:string;historyStart:string;historyEnd:string;missing:string[];hasDemoData:boolean;soldOutCount:number;latest:SavedForecast|null;stale:boolean};
export function buildForecastInputs(targetDate:string,days:SalesDay[]):PreparedForecast{
 const expected=Array.from({length:7},(_,i)=>addDays(targetDate,i-7));
 const ordered=expected.map(date=>days.find(d=>d.date===date));const missing:string[]=[];
 for(let i=0;i<expected.length;i++)for(const m of salesMenus){const line=ordered[i]?.lines.find(l=>l.menuId===m.id);if(!line||line.quantity===null)missing.push(`${expected[i]} · ${m.name}`);}
 const complete=ordered.filter((d):d is SalesDay=>!!d);
 const inputs=missing.length?[]:salesMenus.map(m=>{const values=ordered.map(d=>d!.lines.find(l=>l.menuId===m.id)!.quantity!);return {item:m.name,day_of_week:(new Date(targetDate+"T00:00:00Z").getUTCDay()+6)%7,sales_yesterday:values[6],sales_last_week:values[0],average_previous_7_days:values.reduce((a,b)=>a+b,0)/7};});
 return {targetDate,days:complete,inputs,missing,inputKey:JSON.stringify(complete.map(d=>({date:d.date,version:d.version,lines:d.lines}))),hasDemoData:complete.some(d=>!!d.provenance),soldOutCount:complete.reduce((n,d)=>n+d.lines.filter(l=>l.soldOut).length,0)};
}
export class ForecastServiceError extends Error {}
export async function requestForecast(inputs:ForecastInput[],url=process.env.FORECAST_API_URL||"http://127.0.0.1:8000",fetcher:typeof fetch=fetch){
 let response:Response;
 try{response=await fetcher(`${url.replace(/\/$/,"")}/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(inputs),signal:AbortSignal.timeout(15000),cache:"no-store"});}catch{throw new ForecastServiceError("The model service is unavailable. Start FastAPI on port 8000 and try again.");}
 if(!response.ok)throw new ForecastServiceError("The model service could not generate a forecast. Please check FastAPI and try again.");
 let body;try{body=await response.json();}catch{throw new ForecastServiceError("The model service returned an invalid response.");}
 if(typeof body?.model_id!=="string"||!/^[a-f0-9]{64}$/.test(body.model_id)||body.synthetic_model!==true||!Array.isArray(body.predictions)||body.predictions.length!==salesMenus.length)throw new ForecastServiceError("The model response did not match the expected five menus.");
 const predictions=salesMenus.map(m=>{const matches=body.predictions.filter((p:{item?:unknown})=>p?.item===m.name);if(matches.length!==1||typeof matches[0].predicted_servings!=="number"||!Number.isFinite(matches[0].predicted_servings)||matches[0].predicted_servings<0)throw new ForecastServiceError("The model returned invalid serving quantities.");return {menuId:m.id,item:m.name,predictedServings:matches[0].predicted_servings};});
 return {modelId:body.model_id as string,syntheticModel:true,predictions};
}
