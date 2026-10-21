import {validDate} from "./inventory";
export const activityTypes=["sales","expenses","recipes","inventory","costs","forecast","plans"] as const;
export type ActivityType=typeof activityTypes[number];
export type ActivityFilter={from:string;to:string;actor:string;type:string;page:number};
export type ActivityEvent={id:string;type:ActivityType;actor:string;at:string;title:string;subject:string;demo:boolean;changes:{label:string;before:string;after:string}[]};
export type ActivityResult={events:ActivityEvent[];total:number;page:number;pageSize:number};
export class ActivityInputError extends Error {}
export function activityFilter(params:URLSearchParams):ActivityFilter{
 const from=params.get("from")||"",to=params.get("to")||"",actor=params.get("actor")||"",type=params.get("type")||"";
 const page=Number(params.get("page")||1);
 if((from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to))throw new ActivityInputError("Choose a valid date range.");
 if(actor&&!["owner","staff","system"].includes(actor))throw new ActivityInputError("Choose an available person.");
 if(type&&!activityTypes.includes(type as ActivityType))throw new ActivityInputError("Choose a valid activity type.");
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new ActivityInputError("Invalid activity page.");
 return {from,to,actor,type,page};
}
export const activityLabels:Record<ActivityType,string>={sales:"Daily sales",expenses:"Daily expenses",recipes:"Recipes",inventory:"Inventory",costs:"Ingredient costs",forecast:"Forecast",plans:"Plans & approval"};
