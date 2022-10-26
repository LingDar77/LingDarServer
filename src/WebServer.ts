import http from 'http';
import https from 'https';
import { promises as fs } from 'fs';
import { Debounce } from './Tools/Utils';
import { spawnSync } from 'child_process';
import { CacheManager } from './Helpers/CacheManager';
import { RouterBase, Request, Response } from './Routers/RouterBase';

export type ServerOptions = { maxContentSize?: number } & https.ServerOptions;
export const globalRouters =  new Array<[RouterBase, (webServer:WebServer)=>boolean]>();

export function DefineRouter(pathPattern: RegExp | string, targetServer:((webServer:WebServer)=>boolean) | WebServer = (webServer:WebServer)=>true)
{
    return <T extends { new(p: RegExp | string): RouterBase }>(constructor: T) =>
    {
        if(targetServer instanceof WebServer)
        {
            if(targetServer)
            {
                targetServer.routers.push(new constructor(pathPattern));
            }
            else
            {
                globalRouters.push([new constructor(pathPattern), (webServer)=>webServer == targetServer]);
            }
        }
        else
        {
            globalRouters.push([new constructor(pathPattern), targetServer]);
        }
    };
}

export class WebServer
{
    private instance;
    public routers = new Array<RouterBase>();
    public server: http.Server | undefined;
    private options:ServerOptions = {};
    private onClose= ()=>{};
    
    constructor(protocol: 'http' | 'https' = 'http', private cm?: CacheManager)
    {
        this.instance = protocol == 'http' ? http : https;
    }

    Options(options: ServerOptions)
    {
        this.options = options;
        return this;
    }

    OnClose(onClose:()=>void)
    {
        this.onClose = onClose;
        return this;
    }

    StartServer(port = 8080)
    {
        for(const router of globalRouters)
        {
            if(router[1](this))
            {
                this.routers.push(router[0]);
            }
        }
        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });

        this.server = (this.instance as typeof http).createServer(this.options, async (request, response) =>
        {
            let next = () => { };
            function* iterate(routers: Array<RouterBase>)
            {
                for (const router of routers) {

                    const results = req.path.match(router.pattern);
                    if (results) {
                        req.path = results[1];
                        switch (request.method) {
                        case 'GET':
                            router.Get(req, res, next);
                            break;

                        case 'POST':
                            router.Post(req, res, next);
                            break;

                        default:
                            break;
                        }
                        yield;
                    }

                }
                response.statusCode = 404;
                response.end();
            }

            const req = request as Request;
            const res = response as Response;

            res.Write = (chunk:object | string | Buffer, encoding:BufferEncoding = 'utf-8')=>
            {
                if(typeof chunk == 'object' )
                    return res.write(JSON.stringify(chunk), encoding);
                else
                    return res.write(chunk, encoding);
            };
            
            res.End = (...args)=>
            {
                if(typeof args[0] == 'number')
                {
                    if(args[1])
                    {
                        res.Write(args[1] as string);
                        res.statusCode = args[0];
                        res.end();
                    }
                    else
                    {
                        res.statusCode = args[0];
                        res.end();
                    }
                }
                else if(args[0])
                {
                    res.Write(args[0] as string);
                    res.end();
                }
                else
                {
                    res.end();
                }
            };

            if (await this.ParseHeader(req, this.options)) {

                response.setHeader('X-Frame-Options', 'SAMEORIGIN');
                response.setHeader('Content-Security-Policy', 'img-src *; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; frame-ancestors \'self\'');
                const loop = iterate(this.routers);
                next = () =>
                {
                    process.nextTick(loop.next.bind(loop));
                };
                loop.next();
            }

        });

        this.server.headersTimeout = 3200;

        this.server.listen(port);
        this.server.on('close', this.onClose);
        return this;
    }

    private async ParseHeader(request: Request, options: ServerOptions): Promise<boolean>
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
            if (size > (options.maxContentSize ?? 1024 * 1024 * 20)) {
                request.socket.destroy();
                resolve(false);
            }
            
            if (request.method == 'GET') {
                if (request.url) {
                    const results = request.url.match(/(.+)\?((?:[^=&]+=[^&]+&?)+)/);
                    if (results) {
                        //set get params
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
                if(types)
                { 
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
                if (request.method == 'POST') { //parse post params
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

    Watch(path:string)
    {
        (async () =>
        {
            const watcher = fs.watch(path, { recursive: true });
            const response = Debounce(() =>
            {
                process.addListener('exit', () =>
                {
                    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true, windowsHide:true });
                });
                console.clear();
                console.log('Changes detected, restarting...');
                process.emit('SIGINT');
            }, 200);

            process.on('SIGINT', () =>
            {
                this.onClose();
                if(this.server)
                    this.server.close();
                process.exit();
            });
            for await (const event of watcher) {
                if(event.eventType == 'change')
                    response();
            }
        })();
        return this;
    }
}
