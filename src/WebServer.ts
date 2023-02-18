import { Server, createServer as http } from 'http';
import { ServerOptions as options, createServer as https } from 'https';
import { promises as fs } from 'fs';
import { Debounce } from './Tools/Utils';
import { spawnSync } from 'child_process';
import { CacheManager } from './Tools/CacheManager';
import { RouterBase, Request, Response } from './Routers/RouterBase';
import { ServerHandler } from './Handlers/ServerHandler';
import { ServerRecorder } from './Tools/ServerRocorder';
import ip from 'request-ip';
import { RequestFilter } from './Tools/RequestFilter';
import { nextTick } from 'process';

        
export type ServerOptions = { maxContentSize?: number } & options;
export const globalRouters = new Array<[RouterBase, (webServer: WebServer) => boolean]>();

export function DefineRouter(pathPattern: RegExp | string, targetServer: ((webServer: WebServer) => boolean) | WebServer = (webServer: WebServer) => true)
{
    return <T extends { new(p: RegExp | string): RouterBase }>(constructor: T) =>
    {
        if (targetServer instanceof WebServer) {
            if (targetServer) {
                targetServer.routers.push(new constructor(pathPattern));
            }
            else {
                globalRouters.push([new constructor(pathPattern), (webServer) => webServer == targetServer]);
            }
        }
        else {
            globalRouters.push([new constructor(pathPattern), targetServer]);
        }
    };
}
export class WebServer
{   
    public routers = new Array<RouterBase>();
    public servers = new Array<Server>();
    public handlers: ServerHandler[] = [];
    private options: ServerOptions = {};
    private onClose = () => { };
    private recorder: ServerRecorder | undefined;
    private filter: RequestFilter | undefined;

    constructor( public readonly cm?: CacheManager) {
        process.setMaxListeners(16);
    }
    
    Record(recorder: ServerRecorder)
    {
        this.recorder = recorder;
        return this;
    }

    Route(router: RouterBase)
    {
        this.routers.push(router);
        return this;
    }

    Handle(handler: ServerHandler)
    {
        this.handlers.push(handler);
        return this;
    }

    Options(options: ServerOptions)
    {
        this.options = options;
        return this;
    }

    OnClose(onClose: () => void)
    {
        this.onClose = onClose;
        return this;
    }

    Watch(path: string)
    {
        (async () =>
        {
            const watcher = fs.watch(path, { recursive: true });
            const response = Debounce(() =>
            {
                process.addListener('exit', () =>
                {
                    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true, windowsHide: true });
                });
                // console.clear();
                console.log('Changes detected, restarting...');
                process.emit('SIGINT');
            }, 200);
            
            for await (const event of watcher) {
                if (event.eventType == 'change')
                    response();
            }
        })();
        return this;
    }

    Filter(filter: RequestFilter)
    {
        this.filter = filter;
    }
    
    StartServer(port:number):WebServer;
    StartServer(protocol:'https'|'http'):WebServer;
    StartServer(protocol:'https'|'http', port:number):WebServer;
    StartServer(port:number, protocol:'https'|'http'):WebServer;
    StartServer(...args:unknown[]):WebServer
    {
        let port = 8080;
        let protocol = 'http';
        if(typeof args[0] == 'number')
        {
            port = args[0];
        }
        else
        {
            protocol =  (args[0] as string) ?? 'http';
        }
        if(typeof args[1] == 'number')
        {
            port = args[1];
        }
        else
        {
            protocol = (args[1] as string) ?? 'http';
        }

        const instance = protocol == 'https' ? https : http;

        for (const router of globalRouters) {
            if (router[1](this)) {
                this.routers.push(router[0]);
            }
        }

        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });

        const server = (instance as typeof http)(this.options, async (request, response) =>
        {
            const req = request as Request;
            const res = response as Response;
            if (!await this.HandleRequest(req, res)) {
                res.statusCode = 404;
                res.end();
            }
            else
                this.recorder?.Record(req);
        });

        server.headersTimeout = 3200;

        server.listen(port);
        server.on('close', () =>
        {
            this.cm?.Destory();
            this.recorder?.Destory();
            this.onClose();
        });

        process.on('SIGINT', () =>
        {
            if(this.servers.length)
            {
                const server = this.servers.pop();
                server?.close();
            }
            if(this.servers.length == 1)
            {
                this.onClose();
                nextTick(()=>{process.exit();});
            }
        });
        this.servers.push(server);
        return this;
    }

    private HandleRequest(request: Request, response: Response): Promise<boolean>
    {

        return new Promise((resolve) =>
        {

            try {
                request.path = decodeURI(request.url ?? '/');
            } catch (error) {
                request.socket.destroy();
                resolve(false);
                return;
            }

            request.ip = ip.getClientIp(request) ?? 'unknown';

            if (this.filter && !this.filter.Match(request)) {
                resolve(false);
                return;
            }

            const size = parseInt(request.headers['content-length'] ?? '0');
            if (size > (this.options.maxContentSize ?? 1024 * 1024)) {
                request.socket.destroy();
                resolve(false);
                return;
            }

            response.setHeader('X-Frame-Options', 'SAMEORIGIN');
            response.setHeader('Content-Security-Policy', 'img-src *; script-src \'self\' ; style-src \'self\' \'unsafe-inline\'; frame-ancestors \'self\'');

            response = Response(response);

            function handle(f: (req: Request, res: Response, router: RouterBase, next: () => void) => void, server: WebServer)
            {
                let going = false;
                for (const router of server.routers) {
                    const next = () => going = true;
                    const results = request.path.match(router.pattern);
                    if (results) {
                        if (results[1])
                            request.path = results[1];
                        going = false;
                        f(request, response, router, next);
                        if (!going) {
                            break;
                        }
                    }
                }
            }

            (async () =>
            {
                for (const handler of this.handlers) {
                    if (handler.Match(request, this)) {
                        await handler.Preprocess(request, response, this);
                        if (handler.Handle) {
                            handle(handler.Handle.bind(handler), this);
                        }
                    }
                }
                resolve(true);
            })();

        });
    }
}