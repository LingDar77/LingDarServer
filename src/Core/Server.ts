import http from 'http';
import https from 'https';
import { RouterBase, Request, Response } from '../Routers/RouterBase';

export type ServerOptions = http.ServerOptions;

export class Server
{
    private http = http;
    private https = https;
    private instance;
    public routers = new Array<RouterBase>();
    public server: http.Server|undefined;

    constructor(protocol:'http'|'https' = 'http')
    {
        this.instance = this[protocol];
    }

    StartServer(onClose = () => {}, port = 8080, options:ServerOptions = {})
    {

        this.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });

        this.server = (this.instance as typeof http).createServer(options, (request, response)=>{

            const req = request as Request;
            const res = response as Response;

            this.ParseHeader(req);
            this.ParseBody(req);
            if(req.url)
            {
                let results = /(.*)(\/\?)((([^=&]+)=([^=&]+)&?)*)/g.exec(req.url);
                if(results)
                {
                    req.path = results[1] == '' ? '/' : results[1];
                    const params = results[3].split('&');
                    req.params = {};
                    for(const param of params)
                    {
                        const [key, val] = param.split('=');
                        req.params[key as keyof typeof req.params] = val;
                    }
                    
                }
                else
                {
                    results = /(\/.*\.[^/]*)\//g.exec(req.url);
                    if(results)
                    {
                        req.path = req.url.slice(results[1].length);
                    }
                    else
                    {
                        req.path = req.url;
                    }
                    
                }
                
            }
            
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
            const loop = iter(this.routers);
            const next = ()=>{
                process.nextTick(()=>loop.next());
            };
            next();
           
        });

        this.server.headersTimeout= 3200;

        this.server.listen(port);
        this.server.on('close', onClose);
        return this.server;
    }

    private ParseHeader(request:Request)
    {
        //parse get params
        

        //parse post params
    }
    private ParseBody(request:Request)
    {

    }
}
