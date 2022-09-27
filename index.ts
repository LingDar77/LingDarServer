import express from 'express';
export interface IServerConfig
{
    port: number,
}
export type Request = express.Request;
export type Response = express.Response;

export class RouterBase
{
    constructor(public Path: string)
    {
    }
    GetPriority()
    {
        return 0;
    }
    GetRow(): null | express.Router
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
    StartServer(config: IServerConfig = { port: 8080 })
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
                r.get(router.Path, router.Get);
                r.post(router.Path, router.Post);
                app.use(r);
            }
            console.log(`Loading Router: ${router.constructor.name}`);
        }
        console.clear();
        const server = app.listen(config.port, () =>
        {
            console.info(`Server started running at : http://localhost:${config.port}`);
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