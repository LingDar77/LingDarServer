import { Server as HttpServer, createServer as createHttpServer } from 'http';
import { Server as HttpsServer, ServerOptions as httpsServerOptions, createServer as createHttpsServer } from 'https';
import { Constructor, MergeSortedArray } from 'lingdar-utils';
import { RouterBase, LDRequest, LDResponse, WarpResponse, WarpRequest } from './Core';

const GlobalRouter = new Array<(server: WebServer) => (RouterBase | null)>();

export type ServerOptions =
    {
        maxContentSize?: number,
        maxConnectionTime?: number,
    }
    & httpsServerOptions

export type OriginalServer = HttpServer | HttpsServer;
/**
 * Declare a global router class for a specular server, which should extend class RouterBase
 * @param pattern specify the pattern recived for the router, that matches the request's path
 * @param targetServer the target server that will apply this router, make sure the server is already created, or use a function to delay the process
 * @returns 
 */
export function DefineRouter(pattern: RegExp | string, targetServer: WebServer | ((webServer: WebServer) => boolean) = () => true)
{
    return <T extends Constructor<RouterBase>>(constructor: T) =>
    {
        if (targetServer instanceof WebServer) {
            if (targetServer) {
                //target server is already created
                targetServer.Route(new constructor(pattern));
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

    private Routers = new Array<RouterBase>();
    private Instances = Array<OriginalServer>();

    constructor(public Options: ServerOptions = { maxContentSize: 1024 ** 2, maxConnectionTime: 5000 }) { }

    Route(...routers: Array<RouterBase>)
    {
        if (routers.length) {
            if (routers.length > 1) {
                routers.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
            }
            this.Routers = MergeSortedArray(this.Routers, routers, (lhs, rhs) => lhs.GetPriority() > rhs.GetPriority());
        }
        return this;
    }

    Unroute(...routers: Array<RouterBase>)
    {
        if (routers.length > 1) {
            routers.sort((lhs, rhs) => lhs.GetPriority() - rhs.GetPriority());
        }

        let lhs = 0, rhs = 0;
        const result = new Array<RouterBase>();
        while (rhs != routers.length) {
            if (this.Routers[lhs] == routers[rhs]) {
                console.log('?');
                ++lhs;
                ++rhs;
            }
            else {
                console.log('!');

                result.push(this.Routers[lhs]);
                ++lhs;
            }
        }
        while (lhs != this.Routers.length) {
            result.push(this.Routers[lhs]);
            ++lhs;
        }
        this.Routers = result;
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
        return this;
    }

    Close()
    {
        for (const instance of this.Instances) {
            instance.close();
        }
        this.Instances = [];
        return this;
    }

    GetRouters<T extends RouterBase>(constructor: Constructor<T>)
    {
        const result = new Array<RouterBase>();
        for (const router of this.Routers) {
            if (router.constructor == constructor) {
                result.push(router);
            }
        }
        return result as T[];
    }

    private async HandleOrginalRequest(req: LDRequest, res: LDResponse)
    {
        //prepare vals
        try {
            req.RequestPath = decodeURI(req.url ?? '/');
        } catch (error) {
            req.socket.destroy();
            return;
        }

        const size = parseInt(req.headers['content-length'] ?? '0');
        // console.log('incomming content size',size);

        if (size > (this.Options.maxContentSize ?? 0)) {
            req.socket.destroy();
            return;
        }

        req = WarpRequest(req);
        res = WarpResponse(res);

        //iterate routers
        for (const router of this.Routers) {

            const results = req.RequestPath.match(router.expression);
            req.Matches = results;

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
            if (res.writableEnded) {
                break;
            }
        }

        //No router handled this request, reject connection
        if (!res.writableEnded)
            res.End(404);
    }

}

