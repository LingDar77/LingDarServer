import http from 'http';
import https from 'https';
import { type } from 'os';
import { CacheManager } from '../Helpers/CacheManager';
import { RouterBase, Request, Response } from '../Routers/RouterBase';

export type ServerOptions = { maxContentSize?:number } & http.ServerOptions;

export class Server
{
    private http = http;
    private https = https;
    private instance;
    public routers = new Array<RouterBase>();
    public server: http.Server|undefined;
    
    constructor(protocol:'http'|'https' = 'http', private cm:CacheManager)
    {
        this.instance = this[protocol];
    }

    StartServer(onClose = () => {}, port = 8080, options:ServerOptions = {})
    {

        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });

        this.server = (this.instance as typeof http).createServer(options, async (request, response)=>{
            let next=()=>{};
            function *iter(routers:Array<RouterBase>) {
                for(const router of routers)
                {
                
                    const results = req.path.match(router.pattern);
                    if(results)
                    {
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

            if(await this.ParseHeader(req, options))
            { 
                const loop = iter(this.routers);
                next = ()=>{
                    process.nextTick(()=>loop.next());
                };
                next();
            }
           
        });

        this.server.headersTimeout= 3200;

        this.server.listen(port);
        this.server.on('close', onClose);
        return this.server;
    }

    private async ParseHeader(request:Request, options:ServerOptions):Promise<boolean>
    {
        return new Promise((resolve)=>{

            request.path = request.url ?? '/';
            request.postParams = {};
            request.getParams= {};
            request.formParams = {};
            request.files = {};
            //parse get params
            const size = parseInt(request.headers['content-length'] ?? '0');
            if(size > (options.maxContentSize ?? 1024 * 1024 * 20))
            {
                request.socket.destroy();
                resolve(false);
            }
            const types = request.headers['content-type'];
            if(!types)
            {
                if(request.url)
                {
                    const results = request.url.match(/(^.*)(?:\?)((?:[^=&]+=[^&]+&?)+)/);
                    if(results)
                    {
                        //set get params
                        request.path = results[1] == '/' ? '/' : results[1].slice(0, -1);
                        const params = results[2].split('&');
                        for(const param of params)
                        {
                            if(param != '')
                            {
                                const [key, val] = param.split('=');
                                request.getParams[key] = val;
                            }
                        }
                    }
                    resolve(true);
                }
            }
            else if(types == 'application/json')
            {
                if(request.method == 'POST')
                { //parse post params
                    let buffer = Buffer.alloc(0);
                    request.on('data', (data:Buffer)=>{
                        buffer = Buffer.concat([buffer, data]);
                    });
                    request.on('end', ()=>{
                        const params = JSON.parse(buffer.toString());
                        if(params)
                        {
                            request.postParams = params;
                        }
                        request.path = request.url ?? '/';
                        resolve(true);
                    });
                }
                
            }
            else {
                const results = types.match(/multipart\/form-data; boundary=(.+)/);
                if(results)
                {
                    const boundary = '--' + results[1];
                    let buffer = Buffer.alloc(0);
                    request.on('data', (data:Buffer)=>{
                        buffer = Buffer.concat([buffer, data]);
                    }); 
                    request.on('end', ()=>{
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
                                    const path = this.cm.CacheFile(Buffer.from(body, 'binary'), fname);
                                    request.files[fname] = path;
                                }
                            }
                        }
                        resolve(true);
                    });
                }
                else
                {   
                    resolve(false);
                }
            }
        });
    }
}
