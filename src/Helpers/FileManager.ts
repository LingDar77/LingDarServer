//Target: cache files when requesting a file that has not be changed
/**
 * system need to know wheather the requeting file have changed
 * if checking the update time every request may cause frequently accesses
 * maybe check the cached files changing time when system is free
 */

import { promises as fs } from 'fs';
import LRUCache from './LRUCache';
import { Writable } from 'stream';
import {resolve as ResolvePath} from 'path';

export interface IFileManagerConfig
{
    cacheCheckTime: number;
    cacheMaxSize: number;
    cacheLastTime: number;
}

export interface IFileCache
{
    conctent: Buffer;
    modifiedTime: Date;

}

export class FileManager
{
    private caches;
    private timer;
    private lastTime;
    private totalTime;
    private checkTime;
    private info = { cacheSize: 0, caches: 0 };
    private dirs = new Array<string>();

    constructor(private config: IFileManagerConfig = { cacheCheckTime: 10000, cacheMaxSize: 512, cacheLastTime: 60000 })
    {
        this.caches = new LRUCache<string, IFileCache>();
        this.checkTime = config.cacheCheckTime;
        this.totalTime = config.cacheLastTime;
        this.timer = setInterval(this._checkCaches.bind(this), config.cacheCheckTime);
        this.lastTime = config.cacheLastTime;
    }

    private _checkCaches()
    {
        if (this.lastTime > 0) {
            let size = 0;
            for (const item of this.caches) size = + item[1].conctent.length;
            size /= 1024 * 1024;

            this.info.cacheSize = size;
            this.info.caches = this.caches.Size();

            while (size >= this.config.cacheMaxSize) {
                const cache = this.caches.Pop();
                if (cache?.val) {
                    let freeSize = cache.val?.conctent.length;
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

            this.lastTime -= this.checkTime;
            if (this.lastTime <= 0) {
                //consider clear all caches
                this.caches.Clear();
            }
        }

    }

    ResetCacheTimer(cacheCheckTime: 10000)
    {
        this.config.cacheCheckTime = cacheCheckTime;
        clearInterval(this.timer);
        this.timer = setInterval(this._checkCaches.bind(this), this.config.cacheCheckTime);
    }

    Dirs(dirs:Array<string>)
    {
        this.dirs = dirs;
        return this;
    }

    private CanAcessFile(path:string)
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

    async RequestFile(path: string, target: Writable, version?: number): Promise<Date>
    {
        return new Promise((resovle, reject) =>
        {
            if(!this.CanAcessFile(path))
            {
                reject('Can not access file: ' + path);
            }
            else
            {    
                const cache = this.caches.Get(path);
                if (cache && (!version || version == cache?.modifiedTime.getTime())) {
                //cache hit 
                    target.write(cache.conctent, err =>
                    {
                        if (err)
                            reject(err);
                        else {
                            if (cache) {
                                this.lastTime = this.totalTime;
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
                            this.caches.Set(path, { conctent: data, modifiedTime: stats.mtime });
                            target.write(data, err =>
                            {
                                if (!err) {
                                    this.lastTime = this.totalTime;
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

    GetCache(path: string)
    {
        return this.caches.Get(path);
    }
}

