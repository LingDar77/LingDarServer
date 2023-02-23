
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
    Instances = Array<OriginalServer>();

    constructor(public Options: ServerOptions = { maxContentSize: 1024 ** 2 }) { }

    Route(...router: Array<RouterBase>)
    {
        if (router.length > 1) {
            router.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
        }
        this.Routers = MergeSortedArray(this.Routers, router, (lhs, rhs) => lhs.GetPriority() > rhs.GetPriority());
        return this;
    }

    Run(protocol: 'http' | 'https' = 'http', port = 8080)
    {
        //collect routers
        for (const filter of GlobalRouter) {
            const router = filter(this);
            if (router) {
                this.Routers.push(router);
            }
        }
        this.Routers.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
        const createServer = (protocol == 'http' ? createHttpServer : createHttpsServer) as typeof createHttpsServer;
        const instance = createServer(this.Options);
        instance.on('request', this.HandleOrginalRequest.bind(this));
        instance.listen(port);
        this.Instances.push(instance);
    }

    Close()
    {
        for (const instance of this.Instances) {
            instance.close();
        }
        this.Instances = new Array();
    }

    private async HandleOrginalRequest(req: Request, res: Response)
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

            //response.End() has been called, no need to iterate other routers.
            if(res.writableEnded)
            {
                break;
            }
        }

        //No router handled this request, reject connection
        if (!res.writableEnded)
            res.End(404);
    };

}

