import { RouterBase } from '../Routers/RouterBase';
import { WebServer } from '../WebServer';
import {Request, Response} from '../Routers/RouterBase';

export abstract class HandlerBase
{
    Handle:((request:Request, response:Response, router:RouterBase, next:()=>void)=>void) | undefined;
    
    Match(request:Request, server:WebServer)
    {
        return true;
    }

    Preprocess(request: Request, response: Response, server:WebServer): Promise<void>{
        return new Promise((resolve)=>{
            resolve();
        });
    }
}
