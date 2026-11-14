import {mergeCycleSearchResults} from './combat-search-results';
import type {CycleSearchResult} from './combat-optimizer';
export function searchWorkerCount(cores:number):number{
  return Number.isFinite(cores)&&cores>=6?4:2;
}
export function startCycleSearchPool(factory:()=>Worker,count:number,payload:unknown,callbacks:{progress:(done:number,total:number)=>void;result:(result:CycleSearchResult)=>void;error:(message:string)=>void}):{cancel:()=>void}{
  if(!Number.isInteger(count)||count<1||count>4)throw new Error('Invalid worker count');
  const workers:Worker[]=[],progress=Array.from({length:count},()=>({done:0,total:0})),results:CycleSearchResult[]=[];
  let closed=false,completed=0;
  const cancel=()=>{closed=true;for(const worker of workers)worker.terminate();};
  const fail=(message:string)=>{if(closed)return;cancel();callbacks.error(message);};
  try{
    for(let index=0;index<count;index++){
      const worker=factory();workers.push(worker);
      worker.onmessage=event=>{
        if(closed)return;
        const data=event.data;
        if(data.type==='progress'){
          progress[index]={done:data.done,total:data.total};
          callbacks.progress(progress.reduce((sum,row)=>sum+row.done,0),progress.every(row=>row.total>0)?progress.reduce((sum,row)=>sum+row.total,0):0);
        }else if(data.type==='result'){
          if(results[index])return;
          results[index]=data.result;completed++;worker.terminate();
          if(completed===count){try{const result=mergeCycleSearchResults(results);cancel();callbacks.result(result);}catch(error){fail(String(error));}}
        }else fail(data.message||'계산 작업 오류');
      };
      worker.onerror=event=>fail(event.message||'계산 작업 오류');
      worker.postMessage({...payload as object,partition:{index,count}});
    }
  }catch(error){fail(error instanceof Error?error.message:String(error));}
  return {cancel};
}
