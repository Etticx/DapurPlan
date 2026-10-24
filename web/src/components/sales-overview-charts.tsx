"use client";

import {useMemo,useState} from "react";
import type {SalesOverviewPoint} from "@/lib/sales";
import {addDays} from "@/lib/inventory";
import {addCents} from "@/lib/sales-financials";

type Range="7"|"30"|"365";
type Point={date:string;label:string;servings:number|null;revenue:number|null;grossProfit:number|null};
const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function shortDate(date:string,year=false){
 const [,month,day]=date.split("-");const yearLabel=year?` '${date.slice(2,4)}`:"";
 return `${Number(day)} ${months[Number(month)-1]}${yearLabel}`;
}
function groupedRinggit(value:number){
 const digits=String(Math.abs(value));
 return digits.replace(/\B(?=(\d{3})+(?!\d))/g,",");
}
function compactCurrency(sen:number){
 const value=Math.round(sen/100);
 return `RM ${value<0?"-":""}${groupedRinggit(value)}`;
}
function exactCurrency(sen:number){
 const value=Math.abs(sen);const ringgit=Math.floor(value/100);const cents=value%100;
 return `RM ${sen<0?"-":""}${groupedRinggit(ringgit)}.${String(cents).padStart(2,"0")}`;
}
function pathForLine(points:{x:number;y:number;value:number|null}[]){
 const segments:string[]=[];let segment="";
 for(const point of points){
  if(point.value===null){if(segment)segments.push(segment);segment="";continue;}
  segment+=`${segment?" ":""}${point.x},${point.y}`;
 }
 if(segment)segments.push(segment);
 return segments.map(segment=>`M ${segment.replaceAll(" ", " L ")}`).join(" ");
}
function ChartFrame({title,description,children}:{title:string;description:string;children:React.ReactNode}){
 return <section aria-label={title} className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5">
  <div className="mb-3"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
  {children}
 </section>;
}
function ServingsLineChart({points}:{points:Point[]}){
 const values=points.map(point=>point.servings);
 const valid=values.filter((value):value is number=>value!==null);
 if(!valid.length)return <p className="grid h-56 place-items-center rounded-xl bg-slate-50 px-4 text-center text-sm text-muted-foreground">No complete servings totals in this range.</p>;
 const width=400,height=240,left=52,right=12,top=16,bottom=34,chartWidth=width-left-right,chartHeight=height-top-bottom;
 const max=Math.max(1,...valid);
 const coords=points.map((point,index)=>({x:left+(points.length===1?chartWidth/2:index/(points.length-1)*chartWidth),y:top+chartHeight-(point.servings??0)/max*chartHeight,value:point.servings}));
 const path=pathForLine(coords);
 const ticks=[0,0.5,1];
 const labelIndices=new Set([0,Math.floor((points.length-1)/2),points.length-1]);
 return <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Line chart of servings sold. ${valid.length} complete daily totals.`}>
  {ticks.map(fraction=>{const y=top+chartHeight*(1-fraction);return <g key={fraction}><line x1={left} x2={width-right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4"/><text x={left-8} y={y+4} textAnchor="end" fill="#64748b" fontSize="11">{Math.round(max*fraction)}</text></g>;})}
  <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
  {coords.map((point,index)=>point.value===null?null:<g key={points[index].date} aria-label={`${points[index].date}: ${point.value} servings`}><circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2"/></g>)}
  {points.map((point,index)=>labelIndices.has(index)?<text key={point.date} x={coords[index].x} y={height-8} textAnchor={index===0?"start":index===points.length-1?"end":"middle"} fill="#64748b" fontSize="11">{point.label}</text>:null)}
 </svg>;
}
function SalesBarChart({points,metric}:{points:Point[];metric:"revenue"|"grossProfit"}){
 const values=points.map(point=>point[metric]);
 const valid=values.filter((value):value is number=>value!==null);
 if(!valid.length)return <p className="grid h-56 place-items-center rounded-xl bg-slate-50 px-4 text-center text-sm text-muted-foreground">No complete financial totals in this range.</p>;
 const width=400,height=240,left=66,right=12,top=16,bottom=34,chartWidth=width-left-right,chartHeight=height-top-bottom;
 const min=metric==="revenue"?0:Math.min(0,...valid),max=Math.max(1,...valid,0);
 const span=Math.max(1,max-min),zeroY=top+(max/span)*chartHeight;
 const step=chartWidth/points.length,barWidth=Math.max(2,Math.min(32,step*0.66));
 const labelIndices=new Set([0,Math.floor((points.length-1)/2),points.length-1]);
 const ticks=[0,0.5,1];
 return <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric==="revenue"?"Bar chart of revenue":"Bar chart of gross profit"} in Malaysian Ringgit.`}>
  {ticks.map(fraction=>{const amount=min+span*fraction;const y=top+chartHeight*(1-fraction);return <g key={fraction}><line x1={left} x2={width-right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4"/><text x={left-8} y={y+4} textAnchor="end" fill="#64748b" fontSize="10">{compactCurrency(amount)}</text></g>;})}
  {metric==="grossProfit"&&<line x1={left} x2={width-right} y1={zeroY} y2={zeroY} stroke="#64748b" strokeWidth="1.5"/>}
  {points.map((point,index)=>{
   const value=point[metric];if(value===null)return null;
   const x=left+index*step+(step-barWidth)/2;const y=top+(max-value)/span*chartHeight;const barHeight=Math.abs(zeroY-y);
   const label=`${point.date}: ${exactCurrency(value)}`;
   return <g key={point.date} aria-label={label}><rect x={x} y={Math.min(y,zeroY)} width={barWidth} height={Math.max(value===0?1:0,barHeight)} rx="3" fill={metric==="revenue"?"#2563eb":value<0?"#dc2626":"#0f766e"}/></g>;
  })}
  {points.map((point,index)=>labelIndices.has(index)?<text key={point.date} x={left+index*step+step/2} y={height-8} textAnchor={index===0?"start":index===points.length-1?"end":"middle"} fill="#64748b" fontSize="11">{point.label}</text>:null)}
 </svg>;
}

export function SalesOverviewCharts({data,endDate}:{data:SalesOverviewPoint[];endDate:string}){
 const [range,setRange]=useState<Range>("30");
 const points=useMemo(()=>{
  const days=Number(range);const first=addDays(endDate,-(days-1));const saved=new Map(data.map(point=>[point.date,point]));
  const daily:Point[]=Array.from({length:days},(_,index)=>{
   const date=addDays(first,index);const point=saved.get(date);
   return {date,label:shortDate(date,days===365),servings:point?.servingsSold??null,revenue:point?.revenueCents??null,grossProfit:point?.grossProfitCents??null};
  });
  if(range!=="365")return daily;
  const monthly=new Map<string,{point:Point;records:number;servings:number;revenue:number;grossProfit:number;servingsUnknown:boolean;revenueUnknown:boolean;grossProfitUnknown:boolean}>();
  for(const point of daily){
   const month=point.date.slice(0,7);const current=monthly.get(month);
   const savedPoint=saved.get(point.date);
   if(!current){
    monthly.set(month,{point:{date:`${month}-01`,label:shortDate(`${month}-01`,true),servings:null,revenue:null,grossProfit:null},records:0,servings:0,revenue:0,grossProfit:0,servingsUnknown:false,revenueUnknown:false,grossProfitUnknown:false});
   }
   const bucket=monthly.get(month)!;
   if(savedPoint){
    bucket.records++;
    if(savedPoint.servingsSold===null)bucket.servingsUnknown=true;
    else {const sum=addCents(bucket.servings,savedPoint.servingsSold);if(sum===null)bucket.servingsUnknown=true;else bucket.servings=sum;}
    if(savedPoint.revenueCents===null)bucket.revenueUnknown=true;
    else {const sum=addCents(bucket.revenue,savedPoint.revenueCents);if(sum===null)bucket.revenueUnknown=true;else bucket.revenue=sum;}
    if(savedPoint.grossProfitCents===null)bucket.grossProfitUnknown=true;
    else {const sum=addCents(bucket.grossProfit,savedPoint.grossProfitCents);if(sum===null)bucket.grossProfitUnknown=true;else bucket.grossProfit=sum;}
   }
  }
  return [...monthly.values()].map(bucket=>({
   ...bucket.point,
   servings:bucket.records===0||bucket.servingsUnknown?null:bucket.servings,
   revenue:bucket.records===0||bucket.revenueUnknown?null:bucket.revenue,
   grossProfit:bucket.records===0||bucket.grossProfitUnknown?null:bucket.grossProfit,
  }));
 },[data,endDate,range]);
 const anyRecords=data.some(point=>point.date>=addDays(endDate,-(Number(range)-1))&&point.date<=endDate);
 const rangeOptions:[Range,string][]=[["7","7 days"],["30","30 days"],["365","12 months"]];
 return <section aria-labelledby="sales-overview-heading" className="mt-7">
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
   <div><p className="text-xs font-semibold tracking-[0.14em] text-blue-500">SALES PERFORMANCE</p><h2 id="sales-overview-heading" className="mt-1 text-xl font-semibold tracking-tight">Sales overview</h2><p className="mt-1 text-sm text-muted-foreground">Revenue and gross profit use saved price and recipe-cost snapshots.</p></div>
   <fieldset className="flex w-fit gap-1 rounded-xl border border-border bg-white p-1">
    <legend className="sr-only">Filter chart date range</legend>
    {rangeOptions.map(([value,label])=><button key={value} type="button" aria-pressed={range===value} onClick={()=>setRange(value)} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${range===value?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{label}</button>)}
   </fieldset>
  </div>
  {!anyRecords?<p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">No saved sales records in this range. Enter daily sales to see your performance.</p>
   :<div className="grid gap-4 xl:grid-cols-3">
    <ChartFrame title="Servings sold" description={range==="365"?"Monthly total; incomplete months are shown as gaps.":"Daily totals; incomplete records are shown as gaps."}><ServingsLineChart points={points}/></ChartFrame>
    <ChartFrame title="Revenue" description={range==="365"?"Monthly revenue (RM).":"Daily revenue (RM)."}><SalesBarChart points={points} metric="revenue"/></ChartFrame>
    <ChartFrame title="Gross profit" description={range==="365"?"Monthly gross profit (RM); losses appear below zero.":"Daily gross profit (RM); losses appear below zero."}><SalesBarChart points={points} metric="grossProfit"/></ChartFrame>
   </div>}
  <p className="mt-3 text-xs text-muted-foreground">Missing saved prices or ingredient costs create gaps in the affected financial chart. Dates without sales records and incomplete servings are not shown as zero.</p>
 </section>;
}
