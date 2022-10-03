/* eslint-disable no-empty */
import { promises as fs } from 'fs';
import LRUCache from './LRUCache';
import Path from 'path';
import crypto from 'crypto';

export interface ICacheManagerConfig
{
    tempDir: string;
    persistentDir: string;

}

/**
 * Cache manager decides how much files can be saved to disk
 */
export class CacheManager
{

    private temps = new LRUCache<string, string>();
    private persistents = new Map<string, string>();

    constructor(private config: ICacheManagerConfig = { tempDir: '../Cache/temp', persistentDir: '../Cache' })
    {
        this.LoadPersistents();
        fs.access(config.persistentDir)
            .catch(() =>
            {
                fs.mkdir(config.persistentDir);
            });
        fs.access(config.tempDir)
            .catch(() =>
            {
                fs.mkdir(config.tempDir);
            });
        process.on('exit', () =>
        {
            //clear temp files
            fs.unlink(config.tempDir);
        });
    }

    private async LoadPersistents()
    {
        fs.readFile(Path.join(this.config.persistentDir, 'persistents.json'))
            .then(buffer =>
            {
                //
            })
            .catch(err =>
            {
                console.error(err);
            });

    }

    async CacheTemp(bufer: Buffer, name: string)
    {
        //
    }

    async CachePersistent(bufer: Buffer, name: string): Promise<string>
    {
        return new Promise((resolve, reject) =>
        {
            const hash = crypto.createHash('sha256');
            hash.update(bufer);
            const sha256 = hash.digest('hex');
            this.QuerySha256(sha256).then(result =>
            {
                if (result) {
                    //already uploaded
                    const val = this.persistents.get(sha256);
                    if (val)
                        resolve(val);
                    else
                        reject();
                }
                else {

                }
            });

            resolve(name);
        });
    }

    async QuerySha256(hash: string)
    {
        return new Promise<boolean>((resolve) =>
        {
            for (const item of this.persistents) {
                if (item[0] == hash) {
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        });

    }
}