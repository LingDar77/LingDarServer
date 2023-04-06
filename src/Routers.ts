import { LDRequest, LDResponse, RouterBase } from './Core';
import { Types } from './ContentTypes';
import { Stats } from 'fs';
import { LRUCache } from 'lingdar-utils';

/**
 * Security router is need to set policies configured to ensure security
 * this version is not always suitable for your server, you should configure one for your need.
 */
export class SecurityRouter extends RouterBase
{
    GetPriority(): number
    {
        return -2;
    }
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise((resolve) =>
        {

            response.setHeader('X-Frame-Options', 'SAMEORIGIN');
            response.setHeader('Content-Security-Policy', 'img-src *; script-src \'self\' ; style-src \'self\' \'unsafe-inline\'; frame-ancestors \'self\'');
            resolve();
        });
    }
}

/**
 * Cors router configures cors problems for your server
 * this version is not always suitable for your server, you should configure one for your need.
 */
export class CorsRouter extends RouterBase
{
    GetPriority(): number
    {
        return -2;
    }
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise((resolve) =>
        {
            response.setHeader('Referrer-Policy', 'no-referrer');
            response.setHeader('Access-Control-Allow-Origin', '*');
            resolve();
        });
    }
}

/**
 * Get router handles get requests and format incoming get params for your server
 */
export class GetRouter extends RouterBase
{
    GetPriority(): number
    {
        return -1;
    }

    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise(resolve =>
        {

            if (request.method == 'GET') {
                //parse get parts
                if (request.url) {
                    const results = request.url.match(/(.+)\?((?:[^=&]+=[^&]+&?)+)/);
                    if (results) {
                        //set get request
                        request.RequestPath = results[1];

                        const params = results[2].split('&');
                        if (params.length) {
                            request.GetParams = {};
                            for (const param of params) {
                                if (param != '') {
                                    const pair = param.match(/(.+)=(.+)/);

                                    if (pair?.length == 3)
                                        request.GetParams[pair[1]] = decodeURIComponent(pair[2]);
                                }
                            }
                        }

                    }
                }
            }
            resolve();
        });
    }
}

/**
 * Post router handles post requests and format incoming post params for your server, 
 * including tranditional form params and normal post params.
 */
export class PostRouter extends RouterBase
{
    GetPriority(): number
    {
        return -1;
    }

    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise((resolve, reject) =>
        {

            if (request.method == 'POST' && !request.headers['content-type']?.match(/multipart/)) {
                //handle post request

                let buffer = Buffer.alloc(0);
                request.on('data', (data: Buffer) =>
                {
                    buffer = Buffer.concat([buffer, data]);
                });

                request.once('end', () =>
                {
                    try {
                        if (buffer.byteLength) {
                            const params = JSON.parse(buffer.toString());
                            if (params) {
                                request.PostParams = params;
                            }
                        }
                        else {
                            throw 'buffer length not valid';
                        }
                    } catch (error) {
                    }
                    finally {
                        resolve();
                    }
                });

                request.once('error', () =>
                {
                    resolve();
                });

            }
            else
                resolve();

        });
    }
}

/**
 * Multipart router handles multipart request and format incoming multipart form params and file buffer.
 */
export class MultipartRouter extends RouterBase
{
    GetPriority(): number
    {
        return -1;
    }
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise((resolve, reject) =>
        {
            if (request.method != 'POST') {
                resolve();
                return;
            }

            //handle multipart request
            const results = request.headers['content-type']?.match(/multipart\/form-data; boundary=(.+)/);
            if (results) {
                const boundary = '--' + results[1];

                //parse data
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
                            if (!request.FormParams)
                                request.FormParams = {};
                            request.FormParams[name] = body;
                        }
                        else {
                            fname = Buffer.from(fname, 'binary').toString();
                            const fdata = Buffer.from(body, 'binary');
                            if (!request.Files)
                                request.Files = {};
                            request.Files[fname] = fdata;
                        }
                    }
                    resolve();
                });

            }
            else
                resolve();

        });
    }
}

export enum ECacheStrategy
{
    None,
    LastModified,
    MaxAge,
    Auto
}

/**
 * Static router handles basic file request and automatically send data for request
 * you can configure router actions:
 * @Strategy decides how the router configure caching method,
 * @MaxAge decides the client's cache lifetime by Strategy MaxAge
 * @LimitedSize decides when will use MaxAge or LastModify when choise Auto Strategy
 * @MaxCacheNum decides how many caches will be reserved
 * @Dir the actual dir the router will use
 */
export class StaticRouter extends RouterBase
{
    private Strategy: ECacheStrategy = ECacheStrategy.Auto;
    private MaxAge = 86400;
    private LimitedSize = 128 * 1024;
    private static Cache: LRUCache<string, { data: Buffer, timestamp: number }>;
    constructor(partten: RegExp | string, private Dir: string)
    {
        super(partten);
        if (!StaticRouter.Cache)
            StaticRouter.Cache = new LRUCache();
        if (!Dir.endsWith('/')) {
            this.Dir = Dir + '/';
        }
    }

    SetLimitedSize(size: number)
    {
        this.LimitedSize = size;
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
    SetStrategy(strategy: ECacheStrategy)
    {
        this.Strategy = strategy;
        return this;
    }

    GetPriority(): number
    {
        return 1;
    }

    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise(async resolve =>
        {
            if (request.method != 'GET') {
                resolve();
                return;
            }
            if (request.ResolvedPath.endsWith('/')) {
                request.ResolvedPath = request.ResolvedPath + 'index.html';
            }

            const ResolvePath = (await import('path')).resolve;
            const JoinPath = (await import('path')).join;
            const ResolvedDir = ResolvePath(this.Dir);
            const finnalPath = JoinPath(ResolvedDir, request.ResolvedPath);

            if (finnalPath.includes(ResolvedDir)) {
                //Requeting path is safe
                try {
                    const fs = (await import('fs')).promises;
                    const stat = await fs.stat(finnalPath);
                    const suffix = request.ResolvedPath.split('.').pop() ?? '';
                    const contentType = Types.Get('.' + suffix);
                    if (contentType) {
                        response.setHeader('Content-Type', contentType);
                    }

                    if (this.Strategy == ECacheStrategy.Auto) {
                        if (stat.size > this.LimitedSize) {
                            this.Strategy = ECacheStrategy.MaxAge;
                        }
                        else {
                            this.Strategy = ECacheStrategy.LastModified;
                        }
                    }

                    switch (this.Strategy) {
                    case ECacheStrategy.None:
                        response.End(await this.GetFile(finnalPath, stat));
                        break;
                    case ECacheStrategy.LastModified:
                    {
                        const lastCache = request.headers['if-modified-since'];
                        const current = stat.mtime.getTime();
                        if (!lastCache || parseInt(lastCache) != current) {
                            response.setHeader('last-modified', current);
                            response.End(await this.GetFile(finnalPath, stat, true));
                        }
                        else {
                            response.statusCode = 304;
                            response.End();
                        }
                        break;
                    }
                    case ECacheStrategy.MaxAge:
                    {
                        response.setHeader('Cache-Control', 'public, max-age=' + this.MaxAge);
                        response.End(await this.GetFile(finnalPath, stat, true));
                        break;
                    }
                    default:
                        break;
                    }



                } catch (error) { }
            }
            resolve();

        });
    }

    static get cache()
    {
        return StaticRouter.Cache;
    }

    /**
     * get file, will not check the given path is valid or it's safe
     * @param path 
     * @param update 
     * @returns 
     */
    private GetFile(path: string, stat: Stats, update = false): Promise<Buffer>
    {
        return new Promise(async (resolve, reject) =>
        {
            if (!update) {
                const cache = StaticRouter.Cache.Get(path);
                if (cache) {
                    resolve(cache.data);
                    return;
                }
            }

            try {
                //need update or cache miss
                const fs = (await import('fs')).promises;
                const data = await fs.readFile(path);
                StaticRouter.Cache.Set(path, { data, timestamp: stat.mtime.getTime() });
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });

    }
}