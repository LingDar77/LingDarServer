//Target: cache files when requesting a file that has not be changed
/**
 * system need to know wheather the requeting file have changed
 * if checking the update time every request may cause frequently accesses
 * maybe check the cached files changing time when system is free
 */

import { promises as fs } from 'fs';
import LRUCache from './LRUCache';
import { Writable } from 'stream';

export interface IFileManagerConfig
{
    cacheCheckTime: number;
    cacheMaxSize: number;

}

export interface IFileCache
{
    conctent: Buffer,
    modifiedTime: Date
}

export class FileManager
{
    private caches;
    private timer;

    constructor(private config: IFileManagerConfig = { cacheCheckTime: 10000, cacheMaxSize: 512 })
    {
        this.caches = new LRUCache<string, IFileCache>();
        this.timer = setInterval(this._checkCaches.bind(this), config.cacheCheckTime);
    }

    private _checkCaches()
    {
        let size = 0;
        for (const item of this.caches) {
            size = + item[1].conctent.length;
        }
        size /= 1024 * 1024;
        console.clear();
        console.log(`current cached ${this.caches.Size()} files\nmemory used: ${size} MB`);

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
                .catch(err =>
                {
                    this.caches.Remove(cache[0]);
                    console.log(`file:${cache[0]} has been expired`);
                });
        }
    }

    ResetCacheTimer(cacheCheckTime: 10000)
    {
        this.config.cacheCheckTime = cacheCheckTime;
        clearInterval(this.timer);
        this.timer = setInterval(this._checkCaches.bind(this), this.config.cacheCheckTime);
    }

    async RequestFile(path: string, target: Writable, version?: number): Promise<Date>
    {
        return new Promise((resovle, reject) =>
        {
            let cache = this.caches.Get(path);
            if (cache && (!version || version == cache?.modifiedTime.getTime())) {
                //cache hit 
                target.write(cache.conctent, err =>
                {
                    if (err)
                        reject(err);
                    else {
                        if (cache) {
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
                        let data = await fs.readFile(path);
                        this.caches.Set(path, { conctent: data, modifiedTime: stats.mtime });
                        target.write(data, err =>
                        {
                            if (!err) {
                                resovle(stats.mtime);
                            }
                            else {
                                reject(err);
                            }
                        });

                    })
                    .catch(err => reject(err));
            }
        });
    }

    GetCache(path: string)
    {
        return this.caches.Get(path);
    }
}

