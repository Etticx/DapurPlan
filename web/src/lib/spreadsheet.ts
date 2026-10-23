export type CsvRow=Record<string,string>;
export class CsvInputError extends Error {}
export class CsvPayloadTooLargeError extends CsvInputError {}

export async function readBoundedBody(body:ReadableStream<Uint8Array>|null,maxBytes:number):Promise<Uint8Array>{
 if(!body)throw new CsvInputError("Choose a CSV file and try again.");
 const reader=body.getReader();
 const chunks:Uint8Array[]=[];
 let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>maxBytes){
    await reader.cancel();
    throw new CsvPayloadTooLargeError("CSV files may not exceed 1 MB.");
   }
   chunks.push(value);
  }
 }finally{
  reader.releaseLock();
 }
 const result=new Uint8Array(length);
 let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
 return result;
}

export function stringifyCsv(headers:string[],rows:Record<string,string|number|boolean|null|undefined>[]):string{
 const cell=(value:string|number|boolean|null|undefined)=>{
  let text=value===null||value===undefined?"":String(value);
  if(/^[\t\r\n ]*[=+\-@]/.test(text))text="'"+text;
  return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
 };
 return [headers,...rows.map(row=>headers.map(header=>row[header]??""))].map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
}

export function parseCsv(source:string):{headers:string[];rows:CsvRow[]}{
 const text=source.replace(/^\uFEFF/,"");
 const records:string[][]=[];
 let row:string[]=[];let cell="";let quoted=false;let closedQuote=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){
   if(char==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(char==='"'){quoted=false;closedQuote=true;}
   else cell+=char;
  }else if(char==='"'){
   if(cell||closedQuote)throw new CsvInputError("CSV quotes must begin at the start of a cell.");
   quoted=true;
  }else if(char===","){
   row.push(cell);cell="";closedQuote=false;
  }else if(char==="\n"||char==="\r"){
   row.push(cell);cell="";
   if(row.some(value=>value!==""))records.push(row);
   row=[];closedQuote=false;
   if(char==="\r"&&text[i+1]==="\n")i++;
  }else{
   if(closedQuote)throw new CsvInputError("Unexpected text after a quoted CSV value.");
   cell+=char;
  }
 }
 if(quoted)throw new CsvInputError("CSV contains an unclosed quoted value.");
 row.push(cell);
 if(row.some(value=>value!==""))records.push(row);
 if(records.length<1)throw new CsvInputError("The CSV is empty.");
 const headers=records[0].map(value=>value.trim());
 if(headers.some(header=>!header)||new Set(headers).size!==headers.length)throw new CsvInputError("CSV headers must be non-empty and unique.");
 const rows=records.slice(1).map((values,index)=>{
  if(values.length!==headers.length)throw new CsvInputError(`CSV row ${index+2} has ${values.length} cells; expected ${headers.length}.`);
  return Object.fromEntries(headers.map((header,column)=>{
   const value=values[column];
   return [header,/^'[\t\r\n ]*[=+\-@]/.test(value)?value.slice(1):value];
  }));
 });
 if(rows.length>5000)throw new CsvInputError("CSV files may contain at most 5,000 data rows.");
 return {headers,rows};
}

export function requireCsvColumns(headers:string[],required:string[]){
 const missing=required.filter(header=>!headers.includes(header));
 if(missing.length)throw new CsvInputError(`Missing CSV columns: ${missing.join(", ")}.`);
}

export function csvInteger(value:string,label:string,options:{min?:number;max?:number;blank?:boolean}={}):number|null{
 if(value===""&&options.blank)return null;
 if(!/^-?\d+$/.test(value))throw new CsvInputError(`${label} must be a whole number.`);
 const number=Number(value);
 if(!Number.isSafeInteger(number)||number<(options.min??0)||number>(options.max??Number.MAX_SAFE_INTEGER))throw new CsvInputError(`${label} is outside the allowed range.`);
 return number;
}

export function csvDecimal(value:string,label:string,options:{min?:number;max?:number;blank?:boolean}={}):number|null{
 if(value===""&&options.blank)return null;
 if(!/^(?:\d+\.?\d*|\.\d+)$/.test(value))throw new CsvInputError(`${label} must be a non-negative number.`);
 const number=Number(value);
 if(!Number.isFinite(number)||number<(options.min??0)||number>(options.max??Number.MAX_SAFE_INTEGER))throw new CsvInputError(`${label} is outside the allowed range.`);
 return number;
}

export function csvMoneyCents(value:string,label:string,options:{blank?:boolean}={}):number|null{
 if(value===""&&options.blank)return null;
 if(!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value))throw new CsvInputError(`${label} must have no more than two decimal places.`);
 const amount=csvDecimal(value,label,{max:1_000_000});
 return amount===null?null:Math.round(amount*100);
}

export function csvBoolean(value:string,label:string):boolean{
 if(value==="true"||value==="1")return true;
 if(value==="false"||value==="0"||value==="")return false;
 throw new CsvInputError(`${label} must be true or false.`);
}
