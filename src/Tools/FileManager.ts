import LRUCache from './LRUCache';
import { promises as fs } from 'fs';
import {resolve as ResolvePath} from 'path';
import { Writable } from 'stream';

export interface IFileManConfig
{
    CheckFrequency:number,
    CacheDuration:number,
    CacheMaxSize:number
}

export interface IFileCache
{
    content: Buffer;
    modifiedTime: Date;
}

export class FileManager
{
    private caches = new LRUCache<string, IFileCache>();
    private dirs = new Array<string>();
    private lastingTime = 0;
    private timer;
    private config:IFileManConfig = {CacheDuration:60000, CacheMaxSize:512, CheckFrequency:10000}; 
    public readonly info = { cacheSize: 0, caches: 0 };

    constructor(config?:Partial<IFileManConfig>)
    {
        if(config?.CheckFrequency)
        {
            this.config.CheckFrequency = config.CheckFrequency;
        }
        if(config?.CacheMaxSize)
        {
            this.config.CacheMaxSize = config.CacheMaxSize;
        }
        if(config?.CacheDuration)
        {
            this.config.CacheDuration = config.CacheDuration;
        }
        this.lastingTime = this.config?.CacheDuration;
        this.timer = setInterval(this.checkCaches.bind(this), this.config.CheckFrequency);
    }

    private checkCaches()
    {

        if (this.lastingTime > 0) {
            let size = 0;
            for (const item of this.caches) size = + item[1].content.length;
            size /= 1024 * 1024;

            this.info.cacheSize = size;
            this.info.caches = this.caches.Size();

            while (size >= this.config.CacheMaxSize) {
                const cache = this.caches.Pop();
                if (cache?.val) {
                    let freeSize = cache.val?.content.length;
                    freeSize /= 1024 * 1024;
                    size -= freeSize;
                    console.log(`releasing cache: ${cache.key}, sizing: ${freeSize} MB`);
                }
            }

            for (const cache of this.caches) {
                fs.stat(cache[0])
                    .then(stats =>
                    {
                        if (stats.mtime.getDate() != cache[1].modifiedTime.getDate()) {
                            this.caches.Remove(cache[0]);
                            console.log(`file:${cache[0]} has been expired`);
                        }
                    })
                    .catch(() =>
                    {
                        this.caches.Remove(cache[0]);
                        console.log(`file:${cache[0]} has been expired`);
                    });
            }

            this.lastingTime -= this.config.CacheDuration;
            if (this.lastingTime <= 0) {
                //consider clear all caches
                this.caches.Clear();
            }
        }
    }

    private canAcessFile(path:string)
    {
        const requestFile = ResolvePath(path);
        for(let dir of this.dirs)
        {
            dir = ResolvePath(dir);
            if(requestFile.startsWith(dir))
                return true;
            
        }
        return false;
    }

    ResetCacheTimer(cacheCheckTime: 10000)
    {
        this.config.CheckFrequency = cacheCheckTime;
        clearInterval(this.timer);
        this.timer = setInterval(this.checkCaches.bind(this), this.config.CheckFrequency);
    }
    
    GetCache(path: string)
    {
        return this.caches.Get(path);
    }

    Dirs(dirs:Array<string>)
    {
        this.dirs = dirs;
        return this;
    }

    async RequestFile(path: string, target: Writable, version?: number): Promise<Date>
    {
        return new Promise((resovle, reject) =>
        {
            if(!this.canAcessFile(path))
            {
                reject('Can not access file: ' + path);
            }
            else
            {    
                const cache = this.caches.Get(path);
                if (cache && (!version || version == cache?.modifiedTime.getTime())) {
                //cache hit 
                    target.write(cache.content, err =>
                    {
                        if (err)
                            reject(err);
                        else {
                            if (cache) {
                                this.lastingTime = this.config.CacheDuration;
                                resovle(cache.modifiedTime);
                            }
                        }
                    });
                }
                else {
                //cache miss
                //read file
                    fs.stat(path)
                        .then(async (stats) =>
                        {
                            const data = await fs.readFile(path);
                            this.caches.Set(path, { content: data, modifiedTime: stats.mtime });
                            target.write(data, err =>
                            {
                                if (!err) {
                                    this.lastingTime = this.config.CacheDuration;
                                    resovle(stats.mtime);
                                }
                                else {
                                    reject(err);
                                }
                            });

                        })
                        .catch(err => reject(err));
                }
            }
        });
    }

}