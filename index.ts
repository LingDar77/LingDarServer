import express from 'express';
import { NextHandleFunction } from 'connect';
export type Request = express.Request;
export type Response = express.Response;

export class RouterBase
{
    constructor(public path: string)
    {
    }
    GetPriority()
    {
        return 0;
    }
    GetRow(): null | express.Router | NextHandleFunction
    {
        return null;
    }
    Get(request: Request, response: Response, next: () => void)
    {
        next();
    }
    Post(request: Request, response: Response, next: () => void)
    {
        next();
    }


}

export function DefineRouter(path: string)
{
    return <T extends { new(p: string): RouterBase }>(constructor: T) =>
    {
        server.routers.push(new constructor(path));
    }

}

const server = {
    routers: Array<RouterBase>(),
    StartServer(port = 8080)
    {
        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });
        const app = express();
        for (const router of this.routers) {
            const row = router.GetRow();
            if (row != null) {
                app.use(row);
            }
            else {
                const r = express.Router();
                r.get(router.path, router.Get.bind(router));
                r.post(router.path, router.Post.bind(router));
                app.use(r);
            }
            console.log(`Loaded Router: ${router.constructor.name}`);
        }
        const server = app.listen(port, () =>
        {
            console.info(`Server started running at : http://localhost:${port}`);
        });
        process.on('SIGINT', () =>
        {
            console.log('Exiting server...');
            server.close();
            process.exit();
        });

    }
};

export default server;