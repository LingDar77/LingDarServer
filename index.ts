// /* eslint-disable @typescript-eslint/no-empty-function */

// import express from 'express';
// import { NextHandleFunction } from 'connect';
// 
// 
// 
// export type Request = express.Request;
// export type Response = express.Response;

// export class RouterBase
// {

//     constructor(public path: string)
//     {
//     }

//     GetPriority()
//     {
//         return 0;
//     }

//     GetRow(): null | express.Router | NextHandleFunction
//     {
//         return null;
//     }

//     Get(request: Request, response: Response, next: () => void)
//     {
//         next();
//     }

//     Post(request: Request, response: Response, next: () => void)
//     {
//         next();
//     }

//     OnLoad()
//     {

//     }

//     OnDestory()
//     {

//     }

// }

// export function DefineRouter(path: string)
// {
//     return <T extends { new(p: string): RouterBase }>(constructor: T) =>
//     {
//         server.routers.push(new constructor(path));
//     };

// }

// const server = {
//     routers: Array<RouterBase>(),
//     StartServer(onClose: () => void, port = 8080, watch = true)
//     {

//         this.routers.sort((a, b) =>
//         {
//             return a.GetPriority() - b.GetPriority();
//         });
//         const app = express();
//         for (const router of this.routers) {
//             const row = router.GetRow();
//             if (row != null) {
//                 app.use(row);
//             }
//             else {
//                 const r = express.Router();
//                 r.get(router.path, router.Get.bind(router));
//                 r.post(router.path, router.Post.bind(router));
//                 app.use(r);
//             }
//             router.OnLoad();
//             // console.log(`Loaded Router: ${router.constructor.name}`);
//         }

//         const server = app.listen(port, () =>
//         {
//             console.info(`Server started running at: http://localhost:${port}`);
//         });

//         console.clear();
//         if (watch) {
//             (async () =>
//             {
//                 const watcher = fs.watch(__dirname, { recursive: true });
//                 const response = debounce(() =>
//                 {
//                     process.addListener('exit', () =>
//                     {
//                         spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true });
//                     });
//                     console.clear();
//                     console.log('Changes detected, server restarting...');
//                     process.emit('SIGINT');
//                 }, 200);

//                 for await (const event of watcher) {
//                     response(event);
//                 }

//             })();
//         }
//         const close = () =>
//         {
//             onClose();
//             console.log('Exiting server...');
//             for (const router of this.routers) {
//                 router.OnDestory();
//             }
//             server.close();
//             process.exit();
//         };

//         process.on('SIGINT', close);
//     }
// };

// export default server;


import { Server, ServerOptions } from './src/Core/Server';
import { RouterBase } from './src/Routers/RouterBase';
import { spawnSync } from 'child_process';
import { debounce } from './src/Tools/Debounce';
import { promises as fs } from 'fs';

export function DefineRouter(pattern:RegExp)
{
    return <T extends { new(p: RegExp): RouterBase }>(constructor: T) =>
    {
        app.routers.push(new constructor(pattern));
    };
}

const app = {
    routers : new Array<RouterBase>(),
    onClose: ()=>{},
    StartServer(protocol:'http' | 'https' = 'http', port = 8080, options:ServerOptions = {})
    {
        const server = new Server(protocol);
        server.routers = this.routers;
        server.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });
        server.StartServer(this.onClose, port, options);
        return server;
    },
    On(event:'close', callback:()=>void)
    {
        this.onClose = callback;
    },
    Watch(instance:Server)
    {
        (async () => {
            const watcher = fs.watch(__dirname, { recursive: true });
            const response = debounce(() =>
            {
                process.addListener('exit', () =>
                {
                    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true });
                });
                console.clear();
                console.log('Changes detected, server restarting...');
                process.emit('SIGINT');
            }, 200);
            
            process.on('SIGINT', ()=>{
                instance.server?.close();
                process.exit();
            });
            for await (const event of watcher) {
                response(event);
            }
        })();
    }
};



export default app;
