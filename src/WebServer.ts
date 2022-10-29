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
    public server: Server | undefined;
    public handlers: ServerHandler[] = [];
    private instance;
    private options: ServerOptions = {};
    private onClose = () => { };
    private recorder: ServerRecorder | undefined;
    private filter: RequestFilter | undefined;

    constructor(protocol: 'http' | 'https' = 'http', public readonly cm?: CacheManager)
    {
        this.instance = protocol == 'http' ? http : https;
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

    StartServer(port = 8080)
    {
        for (const router of globalRouters) {
            if (router[1](this)) {
                this.routers.push(router[0]);
            }
        }
        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });

        this.server = (this.instance as typeof http)(this.options, async (request, response) =>
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

        this.server.headersTimeout = 3200;

        this.server.listen(port);
        this.server.on('close', () =>
        {
            this.cm?.Destory();
            this.recorder?.Destory();
            this.onClose();
        });
        return this;
    }

    /**
     * @deprecated deprecated since 1.0.13
     */
    private async ParseHeader(request: Request): Promise<boolean>
    {
        return new Promise((resolve) =>
        {

            try {
                request.path = decodeURI(request.url ?? '/');
            } catch (error) {
                request.socket.destroy();
                resolve(false);
            }
            request.postParams = {};
            request.getParams = {};
            request.formParams = {};
            request.files = {};
            request.ip = request.headers['host'] ?? '';

            //parse get params
            const size = parseInt(request.headers['content-length'] ?? '0');
            if (size > (this.options.maxContentSize ?? 1024 * 1024 * 20)) {
                request.socket.destroy();
                resolve(false);
            }

            if (request.method == 'GET') {
                //handle get parts
                if (request.url) {
                    const results = request.url.match(/(.+)\?((?:[^=&]+=[^&]+&?)+)/);
                    if (results) {
                        //set get request
                        request.path = results[1] == '/' ? '/' : results[1];
                        const params = results[2].split('&');
                        for (const param of params) {
                            if (param != '') {
                                const [key, val] = param.split('=');
                                request.getParams[key] = val;
                            }
                        }
                    }
                    resolve(true);
                }
            }
            else {
                const types = request.headers['content-type'];
                if (types) {
                    //handle multipart request
                    const results = types.match(/multipart\/form-data; boundary=(.+)/);
                    if (results) {
                        //parse form data
                        const boundary = '--' + results[1];
                        let buffer = Buffer.alloc(0);
                        request.on('data', (data: Buffer) =>
                        {
                            buffer = Buffer.concat([buffer, data]);
                        });
                        request.on('end', () =>
                        {
                            const items = buffer.toString('binary').split(boundary);
                            items.pop();
                            items.shift();
                            for (const item of items) {
                                const i = item.indexOf('\r\n\r\n');
                                const head = item.slice(0, i);
                                const body = item.slice(i + 4, -2);
                                const parts = head.split('; ');
                                const name = parts[1].split('=')[1].slice(1, -1);
                                let fname = parts[2] ? parts[2].split('=')[1].split('\r\n')[0].slice(1, -1) : parts[2];
                                if (!fname) {
                                    request.formParams[name] = body.slice(0, -2);

                                }
                                else {
                                    fname = Buffer.from(fname, 'binary').toString();
                                    //start handle uploading, send an upload id to client
                                    //this id can be used to query the progress of this upload
                                    if (this.cm) {
                                        request.files[fname] = this.cm.CacheFile(Buffer.from(body, 'binary'), fname);
                                    }
                                }
                            }
                        });
                    }
                }
                if (request.method == 'POST') {
                    //handle post request
                    let buffer = Buffer.alloc(0);
                    request.on('data', (data: Buffer) =>
                    {
                        buffer = Buffer.concat([buffer, data]);
                    });
                    request.on('end', () =>
                    {
                        try {
                            const params = JSON.parse(buffer.toString());
                            if (params) {
                                request.postParams = params;
                            }
                            resolve(true);
                        } catch (error) {
                            resolve(false);
                        }
                    });
                }
                else
                    resolve(true);
            }
        });
    }

    private HandleRequest(request: Request, response: Response)
    {

        return new Promise<boolean>((resolve) =>
        {

            try {
                request.path = decodeURI(request.url ?? '/');
            } catch (error) {
                request.socket.destroy();
                resolve(false);
                return;
            }

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

            request.ip = ip.getClientIp(request) ?? 'unknown';
            response.setHeader('X-Frame-Options', 'SAMEORIGIN');
            response.setHeader('Content-Security-Policy', 'img-src *; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; frame-ancestors \'self\'');

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
                console.clear();
                console.log('Changes detected, restarting...');
                process.emit('SIGINT');
            }, 200);

            process.on('SIGINT', () =>
            {
                this.onClose();
                if (this.server)
                    this.server.close();
                process.exit();
            });
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

}
