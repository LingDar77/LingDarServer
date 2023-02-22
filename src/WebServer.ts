
import { Server as HttpServer, createServer as createHttpServer } from 'http';
import { Server as HttpsServer, ServerOptions as httpsServerOptions, createServer as createHttpsServer } from 'https';
import { MergeSortedArray } from './Tools';
import { RouterBase, Request, Response } from './Core';
import ip from 'request-ip';



const GlobalRouter = new Array<(server: WebServer) => (RouterBase | null)>();

export type ServerOptions =
    {
        maxContentSize: number
    }
    & httpsServerOptions

export type OriginalServer = HttpServer | HttpsServer;

export function DefineRouter(pattern: RegExp | string, targetServer: WebServer | ((webServer: WebServer) => boolean) = () => true)
{
    return <T extends { new(p: RegExp | string): RouterBase }>(constructor: T) =>
    {
        if (targetServer instanceof WebServer) {
            if (targetServer) {
                //target server is already created
                targetServer.Routers.push(new constructor(pattern));
            }
            else {
                //target server is not instanced yet, add this router to global list
                GlobalRouter.push(server => server == targetServer ? new constructor(pattern) : null);
            }
        }
        else {
            GlobalRouter.push(server => targetServer(server) ? new constructor(pattern) : null);
        }
    };
}


export class WebServer
{

    Routers = new Array<RouterBase>();
    Instance: OriginalServer | undefined;
    Options: ServerOptions;
    Run = () => { };

    constructor(instance: OriginalServer);
    constructor(port?: number, protocol?: 'https' | 'http', options?: ServerOptions);
    constructor(protocol?: 'https' | 'http', port?: number, options?: ServerOptions);
    constructor(...args: unknown[])
    {
        let port = 8080;
        let protocol = 'http';

        this.Options = { maxContentSize: 1024 ** 2 };

        if (args[0]) {
            if (typeof args[0] == 'string') {
                protocol = args[0];
            }
            else if (typeof args[0] == 'number') {
                port = args[0];
            }
            else {
                this.Instance = args[0] as OriginalServer;
            }
        }
        if (args[1]) {
            if (typeof args[1] == 'string') {
                protocol = args[1];
            }
            else {
                port = args[1] as number;
            }
        }
        if (args[2]) {
            this.Options = args[2] as ServerOptions;
        }

        const handleOrginalRequest = async (req: Request, res: Response) =>
        {
            //prepare vals
            try {
                req.RequestPath = decodeURI(req.url ?? '/');
            } catch (error) {
                req.socket.destroy();
                return;
            }

            req.Address = ip.getClientIp(req) ?? 'unknown';

            const size = parseInt(req.headers['content-length'] ?? '0');
            if (size > this.Options.maxContentSize) {
                req.socket.destroy();
                return;
            }

            res = Response(res);

            //iterate routers
            for (const router of this.Routers) {

                const results = req.RequestPath.match(router.expression);
                // console.log(results);
                
                if (results) {
                    if (results[1])
                        req.ResolvedPath = results[1];
                    try {
                        await router.Handle(req, res);
                    } catch (error) {
                        res.End(404);
                        break;
                    }
                }

            }
            
            //No router handled this request, reject connection
            if (!res.writableEnded)
                res.End(404);


        }

        if (!this.Instance) {
            const createServer = (protocol == 'http' ? createHttpServer : createHttpsServer) as typeof createHttpsServer;
            this.Instance = createServer(this.Options);
        }
        this.Instance.on('request', handleOrginalRequest);


        this.Run = () =>
        {
            //collect routers
            for (const filter of GlobalRouter) {
                const router = filter(this);
                if (router) {
                    this.Routers.push(router);
                }
            }
            this.Routers.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
            this.Instance?.listen(port);
        }
    }

    Route(...router: Array<RouterBase>)
    {
        if (router.length > 1) {
            router.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
        }
        this.Routers = MergeSortedArray(this.Routers, router, (lhs, rhs) => lhs.GetPriority() > rhs.GetPriority());
        return this;
    }

}

