import { Request, Response, RouterBase } from './RouterBase';
import { Transform } from 'stream';
import { FileManager } from '../Helpers/FileManager';
import { promises as fs } from 'fs';
import Path from 'path';
import { Writable } from 'stream';
import { Types } from '../Tools/ContentTypes';

export enum ECacheStrategy
{
    None,
    LastModified,
    MaxAge,
    Auto
}

export class StaticRouter extends RouterBase
{
    private dir = './';
    private filter: undefined | ((path: string) => { transform: Transform, ContentEncoding: string } | void);
    private fileMan: undefined | FileManager;
    private cacheStratgy:ECacheStrategy | ((request:Request)=>ECacheStrategy) = ECacheStrategy.Auto;
    private maxAge: number | undefined;
    private limitedSize:number = 128 * 1024;
    constructor(patterm:RegExp | string, private resolveContentType = true)
    {
        super(patterm);
    }

    Limited(size:number)
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

    MaxAge(age:number)
    {
        this.maxAge = age;
        return this;
    }

    CacheStrategy(strategy: ECacheStrategy | ((request:Request)=>ECacheStrategy))
    {
        this.cacheStratgy = strategy;
        return this;
    }

    Get(request: Request, response: Response, next: () => void): void
    {
        const path = request.path;

        const finalPath = Path.join(this.dir, path == '/' ? 'index.html' : path);
        let stratgy = this.cacheStratgy;
        if(typeof this.cacheStratgy != 'number')
        {
            stratgy = this.cacheStratgy(request);
        }

        fs.stat(finalPath)
            .then(stats =>
            {
                if(stratgy == ECacheStrategy.Auto)
                {
                    if(stats.size > this.limitedSize)
                    {
                        stratgy = ECacheStrategy.MaxAge;
                    }
                    else
                    {
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
                    this.RequestFile(path, finalPath, response, next);
                    break;
                }
                default:
                    //None cache strategy
                    this.RequestFile(path, finalPath, response, next);
                    break;
                }
            })
            .catch((err) => {
                next();
            });
    }

    private RequestFile(path: string, finalPath: string, response: Response, next: () => void, version?: number)
    {
        //handle target
        let target: Writable;
        if(this.resolveContentType)
        {
            const type = Types.Get('.' + finalPath.split('.').pop());
            if(type)
            {
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