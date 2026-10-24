import {CsvInputError,csvBoolean,csvInteger,type CsvRow} from "./spreadsheet";
import {salesDate,salesMenus} from "./sales";
import type {SalesDay} from "./sales";

type SalesImportStore={
 day:(date:string)=>SalesDay;
 save:(value:unknown,actor:string)=>unknown;
};

function isLegacyMenuVersionCsv(rows:CsvRow[]){
 if(rows.length<salesMenus.length*2)return false;
 const versionsByMenu=new Map<string,string>();
 const versionsByDate=new Map<string,Set<string>>();
 for(const data of rows){
  if(!salesMenus.some(menu=>menu.id===data.menu_id)||!/^\d+$/.test(data.version))return false;
  const version=String(Number(data.version));
  const previous=versionsByMenu.get(data.menu_id);
  if(previous!==undefined&&previous!==version)return false;
  versionsByMenu.set(data.menu_id,version);
  const versions=versionsByDate.get(data.date)??new Set<string>();
  versions.add(version);versionsByDate.set(data.date,versions);
 }
 return versionsByMenu.size===salesMenus.length&&versionsByDate.size>1&&[...versionsByDate.values()].some(versions=>versions.size>1);
}

export function importSalesRows(rows:CsvRow[],actor:string,sales:SalesImportStore){
 const errors:string[]=[];let imported=0;
 const fail=(row:number,error:unknown)=>errors.push(`Row ${row}: ${error instanceof Error?error.message:"Could not import this row."}`);
 const legacyMenuVersions=isLegacyMenuVersionCsv(rows);
 const groups=new Map<string,{version:number;rows:{row:number;data:CsvRow}[]}>();
 rows.forEach((data,index)=>{
  const row=index+2;
  try{
   const date=salesDate(data.date);const version=csvInteger(data.version,`Row ${row} version`,{max:1_000_000});
   const current=groups.get(date);
   if(current&&current.version!==version&&!legacyMenuVersions)throw new CsvInputError("All rows for a sales date must use the same version.");
   if(current)current.rows.push({row,data});else groups.set(date,{version:version!,rows:[{row,data}]});
  }catch(error){fail(row,error);}
 });
 for(const [date,group] of groups){
  const groupRows=group.rows;const ids=groupRows.map(item=>item.data.menu_id);
  if(groupRows.length!==salesMenus.length||new Set(ids).size!==salesMenus.length||salesMenus.some(menu=>!ids.includes(menu.id))){
   fail(groupRows[0].row,new CsvInputError(`${date} must contain exactly one row for each of the five menu IDs.`));continue;
  }
  try{
   const lines=groupRows.map(({data,row})=>({
    menuId:data.menu_id,quantity:csvInteger(data.servings,`Row ${row} servings`,{max:1_000_000,blank:true}),
    soldOut:csvBoolean(data.sold_out,`Row ${row} sold_out`),
   }));
   if(lines.every(line=>line.quantity===null))continue;
   const current=sales.day(date);
   const version=legacyMenuVersions?current.version:group.version;
   const unchanged=lines.every(line=>{
    const existing=current.lines.find(item=>item.menuId===line.menuId);
    return existing?.quantity===line.quantity&&existing.soldOut===line.soldOut;
   });
   if(unchanged){imported+=groupRows.length;continue;}
   sales.save({date,version,lines},actor);imported+=groupRows.length;
  }catch(error){for(const item of groupRows)fail(item.row,error);}
 }
 return {imported,errors};
}
