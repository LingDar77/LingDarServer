import { Request, Response, RouterBase } from './RouterBase';
import { Transform } from 'stream';
import { FileManager } from '../Tools/FileManager';
import { PathLike, promises as fs, stat, Stats } from 'fs';
import { join as joinPath } from 'path';
import { Writable } from 'stream';
import { Types } from '../Constants/ContentTypes';


export enum ECacheStrategy
{
    None,
    LastModified,
    MaxAge,
    Auto
}

export type StaticFilter = (req: Request, resp:Response) => { targetStream?: Writable, contentType?: string };

export class StaticRouterV2 extends RouterBase
{

    private fm: FileManager | undefined;
    private strategy: ECacheStrategy = ECacheStrategy.Auto;
    private maxAge = 86400;
    private cacheMinSize = 1024;
    private filter:StaticFilter = (req, resp)=>{return {targetStream:resp,contentType:undefined};};
    private fallback = true;

    GetPriority(): number
    {
        return 1;
    }

    constructor(pattern: RegExp | string, private dir: PathLike)
    {
        super(pattern);
    }

    /**
     * Set fallback mode for this router, when set to true, any request that matches will try to use the index.html in given root when mathes fails
     * @param fb 
     * @returns 
     */
    Fallback(fb:boolean)
    {
        this.fallback = fb;
        return this;
    }

    /**
     * Set the file manager of this router, if unset, this router can only use max age or none strategy.
     * @param fm 
     * @returns 
     */
    FileManager(fm: FileManager)
    {
        this.fm = fm;
        return this;
    }

    /**
     * Set the caching strategy of this router.
     * @None  always send the newest version of data.
     * @MaxAge depending on the max age set by user or default 86400 seconds.
     * Modified depending on whether the requesting file is expired.
     * @Auto depending on the minSize set by user, 
     * if the requesting file is larger than it, the router will chose max age strategy, 
     * or the router choose Modified strategy
     * @param strategy 
     * @returns 
     */
    CachingStrategy(strategy: ECacheStrategy)
    {
        this.strategy = strategy;
        return this;
    }
    
    /**
     * Set the minium Size to deside cache
     * @param minSize 
     * @returns 
     */
    CacheMinSize(minSize:number)
    {
        this.cacheMinSize = minSize;
        return this;
    }
    
    /**
     * Set the max age of cache when using strategy MaxAge
     * @param age 
     * @returns 
     */
    MaxAge(age = 86400)
    {
        this.maxAge = age;
        return this;
    }

    Filter(filter: StaticFilter)
    {
        this.filter = filter;
        return this;
    }

    Get(request: Request, response: Response, next: () => void): void
    {

        let path = request.path;
        const {targetStream, contentType} = this.filter(request, response) ;
        if(targetStream && /^\/(.+\/?)*$/.test(path))
        {
            if(path.endsWith('/'))
            {
                path += 'index.html';
            }

            const finalPath = joinPath(this.dir.toString(), path);

            if(!contentType)
            {
                const type = Types.Get('.' + finalPath.split('.').pop());
                if(type)
                    response.setHeader('Content-Type', type);
                else
                    response.setHeader('Content-Type', 'unknown');
                    
            }else
                response.setHeader('Content-Type', contentType);

            fs.stat(finalPath)
                .then(stats=>{
                    if(stats.isFile())
                    { 
                        this.Route(stats, request, response, finalPath, targetStream);
                    }
                
                })
                .catch(error=>{
                    if(this.fallback)
                    {
                        const exp =  '^(' + this.pattern.source.slice(1, -1) + '\\/?).*$';

                        const reuslt =   request.path.match(exp);
                        if(!reuslt)
                        {
                            response.End(404,error);
                            return;

                        }
                        request.path = reuslt[1];
                        const finalPath = (request.path.endsWith('/') ? request.path : request.path + '/')  + 'index.html';
                        fs.stat(finalPath).then(stats=>{
                            this.Route(stats, request, response, finalPath, targetStream);

                        }).catch(error=>{
                            response.End(404,error);
                        });
                    }
                    else
                        response.End(404,error);
                });
        }
    }

    private Route(stats:Stats, request:Request, response:Response, path:string, targetStream:Writable)
    {
        if (this.strategy == ECacheStrategy.Auto) {
            if (stats.size > this.cacheMinSize) {
                this.strategy = ECacheStrategy.MaxAge;
            }
            else {
                this.strategy = ECacheStrategy.LastModified;
            }
        }
        switch (this.strategy) {
        case ECacheStrategy.LastModified:
        {
            //check if the client has cache
            const lastCache = request.headers['if-modified-since'];
            let version;

            if (!lastCache || parseInt(lastCache) != stats.mtime.getTime()) {
                version = stats.mtime.getTime();
                response.setHeader('last-modified', version);
                this.RequestFile(path,targetStream, response, version);
            }
            else {
                response.statusCode = 304;
                response.end();
            }
            break;  
        }  
        case ECacheStrategy.MaxAge:
            response.setHeader('Cache-Control', 'public, max-age=' + this.maxAge);
            this.RequestFile(path, targetStream, response);
            break;
        default:
        //None
            this.RequestFile(path, targetStream, response);
            break;
        }
    }

    private RequestFile(path:string,targetStream :Writable , response:Response, version?:number)
    {
        if(this.fm)
        {
            this.fm.RequestFile(path, targetStream,version)
                .then(()=>{
                    response.End();
                })
                .catch(error=>{
                    response.End(404, error);
                });
        }
        else
        {
            fs.readFile(path)
                .then(data=>{
            
                    targetStream.write(data);
                    response.End();

                })
                .catch(error=>{
                    response.End(404, error);
                });
        }
    }
}

export class StaticRouter extends RouterBase
{
    private dir = './';
    private filter: undefined | ((path: string) => { transform: Transform, ContentEncoding: string } | void);
    private fileMan: undefined | FileManager;
    private cacheStratgy: ECacheStrategy | ((request: Request) => ECacheStrategy) = ECacheStrategy.Auto;
    private maxAge = 86400;
    private limitedSize: number = 128 * 1024;
    constructor(patterm: RegExp | string, private resolveContentType = true)
    {
        super(patterm);
    }

    Limited(size: number)
    {
        this.limitedSize = size;
        return this;
    }

    Dir(dir = './')
    {
        this.dir = dir;
        return this;
    }

    Filter(filter?: ((path: string) => { transform: Transform, ContentEncoding: string } | void))
    {
        this.filter = filter;
        return this;
    }

    FileManager(fm?: FileManager)
    {
        this.fileMan = fm;
        return this;
    }

    GetPriority(): number
    {
        return 1;
    }

    MaxAge(age: number)
    {
        this.maxAge = age;
        return this;
    }

    CacheStrategy(strategy: ECacheStrategy | ((request: Request) => ECacheStrategy))
    {
        this.cacheStratgy = strategy;
        return this;
    }

    Get(request: Request, response: Response, next: () => void): void
    {
        const path = request.path;

        const finalPath = joinPath(this.dir, path == '/' ? 'index.html' : path);

        let stratgy = this.cacheStratgy;
        if (typeof this.cacheStratgy != 'number') {
            stratgy = this.cacheStratgy(request);
        }

        fs.stat(finalPath)
            .then(async stats =>
            {
                // if (stats.isDirectory()) {
                //     finalPath += '/index.html';
                //     const retry = await fs.stat(finalPath);
                // }
                if (stratgy == ECacheStrategy.Auto) {
                    if (stats.size > this.limitedSize) {
                        stratgy = ECacheStrategy.MaxAge;
                    }
                    else {
                        stratgy = ECacheStrategy.LastModified;
                    }
                }

                switch (stratgy) {
                case ECacheStrategy.LastModified:
                {
                    //check if the client has cache
                    const lastCache = request.headers['if-modified-since'];
                    let version;

                    if (!lastCache || parseInt(lastCache) != stats.mtime.getTime()) {
                        version = stats.mtime.getTime();
                        response.setHeader('last-modified', version);
                        this.RequestFile(path, finalPath, response, next, version);
                    }
                    else {
                        response.statusCode = 304;
                        response.end();
                    }
                    break;
                }
                case ECacheStrategy.MaxAge:
                {
                    this.maxAge = this.maxAge ? this.maxAge : 86400;
                    response.setHeader('Cache-Control', 'public, max-age=' + this.maxAge);
                    try {
                        this.RequestFile(path, finalPath, response, next);
                    } catch (error) {
                        response.End(404);
                    }
                    break;
                }
                default:
                    //None cache strategy
                    this.RequestFile(path, finalPath, response, next);
                    break;
                }
            })
            .catch((err) =>
            {
                next();
            });
    }

    private RequestFile(path: string, finalPath: string, response: Response, next: () => void, version?: number)
    {
        //handle target
        let target: Writable;
        if (this.resolveContentType) {
            const type = Types.Get('.' + finalPath.split('.').pop());
            if (type) {
                response.setHeader('Content-Type', type);
            }
        }
        if (this.filter) {
            const filter = this.filter(path);
            if (filter) {
                response.setHeader('Content-Encoding', filter.ContentEncoding);
                filter.transform.pipe(response);
                target = filter.transform;
            }
            else
                target = response;
        } else
            target = response;

        if (this.fileMan) {
            this.fileMan.RequestFile(finalPath, target, version)
                .then(() =>
                {
                    target.end();
                })
                .catch(() =>
                {
                    next();
                });
        }
        else {
            fs.readFile(finalPath)
                .then(data =>
                {
                    target.write(data);
                    target.end();
                })
                .catch(() =>
                {
                    next();
                });
        }
    }
}