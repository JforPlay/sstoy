import {describe,it,expect,vi} from 'vitest';
import {searchWorkerCount,startCycleSearchPool} from '../core/combat-search-pool';
function setup(count=2){
  const workers:{onmessage:((event:{data:any})=>void)|null;onerror:((event:{message:string})=>void)|null;postMessage:ReturnType<typeof vi.fn>;terminate:ReturnType<typeof vi.fn>}[]=[];
  const factory=()=>{const worker={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()};workers.push(worker);return worker as unknown as Worker;};
  const callbacks={progress:vi.fn(),result:vi.fn(),error:vi.fn()};
  const job=startCycleSearchPool(factory,count,{input:'test'},callbacks);
  return {workers,callbacks,job};
}
describe('사이클 병렬 작업 관리',()=>{
  it('로컬은 10개 작업으로 나누고 모든 결과를 합산',()=>{
    expect(searchWorkerCount(4,true)).toBe(10);
    expect(searchWorkerCount(16,true)).toBe(10);
    const {workers,callbacks}=setup(10);
    expect(workers).toHaveLength(10);
    workers.forEach((worker,index)=>{
      expect(worker.postMessage).toHaveBeenCalledWith({input:'test',partition:{index,count:10}});
      worker.onmessage!({data:{type:'result',result:{baseline:1,duration:180,switchRate:1,input:{},options:{},tested:9,candidates:[]}}});
    });
    expect(callbacks.result).toHaveBeenCalledTimes(1);
    expect(callbacks.result.mock.calls[0]![0].tested).toBe(90);
    expect(callbacks.error).not.toHaveBeenCalled();
  });
  it('기기에 따라 두 작업 또는 네 작업을 자동 사용',()=>{
    expect(searchWorkerCount(16)).toBe(4);expect(searchWorkerCount(6)).toBe(4);
    expect(searchWorkerCount(4)).toBe(2);expect(searchWorkerCount(2)).toBe(2);
    expect(searchWorkerCount(1)).toBe(2);expect(searchWorkerCount(NaN)).toBe(2);
  });
  it('서로 다른 파티션을 전달하고 진행률을 합산',()=>{
    const {workers,callbacks}=setup();
    expect(workers[0]!.postMessage).toHaveBeenCalledWith({input:'test',partition:{index:0,count:2}});
    expect(workers[1]!.postMessage).toHaveBeenCalledWith({input:'test',partition:{index:1,count:2}});
    workers[0]!.onmessage!({data:{type:'progress',done:2,total:5}});
    workers[1]!.onmessage!({data:{type:'progress',done:3,total:5}});
    expect(callbacks.progress).toHaveBeenLastCalledWith(5,10);
  });
  it('중지 후 모든 작업을 종료하고 늦게 오는 메시지 무시',()=>{
    const {workers,callbacks,job}=setup();job.cancel();
    workers[0]!.onmessage!({data:{type:'progress',done:5,total:5}});
    expect(workers.every(worker=>worker.terminate.mock.calls.length===1)).toBe(true);
    expect(callbacks.progress).not.toHaveBeenCalled();
  });
  it('작업 하나가 실패해도 전체 종료하고 오류는 한 번만 표시',()=>{
    const {workers,callbacks}=setup();workers[0]!.onerror!({message:'실패'});workers[1]!.onerror!({message:'늦은 오류'});
    expect(callbacks.error).toHaveBeenCalledTimes(1);expect(callbacks.error).toHaveBeenCalledWith('실패');
    expect(workers.every(worker=>worker.terminate.mock.calls.length===1)).toBe(true);
  });
  it('모든 결과가 도착해야 최종 결과를 전달',()=>{
    const {workers,callbacks}=setup();
    const result={baseline:1,duration:180,switchRate:1,input:{},options:{},tested:5,candidates:[]};
    workers[1]!.onmessage!({data:{type:'result',result}});expect(callbacks.result).not.toHaveBeenCalled();
    workers[0]!.onmessage!({data:{type:'result',result}});
    expect(callbacks.result.mock.calls[0]![0].tested).toBe(10);
  });
});
