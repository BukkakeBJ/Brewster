import {solve} from './engine/solver';
self.onmessage=e=>{try{self.postMessage({candidates:solve(e.data.target,e.data.catalog,70,e.data.userWeight??1)})}catch(err){self.postMessage({error:err instanceof Error?err.message:'Solver failed'})}};
