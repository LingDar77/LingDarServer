/* eslint-disable no-empty */
import { promises as fs } from 'fs';
import sfs from 'fs';
import LRUCache from './LRUCache';
import Path from 'path';
import crypto from 'crypto';

export interface ICacheManagerConfig
{
    maxTempSize: number;
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

    constructor(private config: ICacheManagerConfig)
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
    }

    private LoadPersistents()
    {
        fs.readFile(Path.join(this.config.persistentDir, 'persistents.json'))
            .then(buf =>
            {
                this.persistents = JSON.parse(buf.toString(), (key, value) =>
                {
                    if (typeof value === 'object' && value !== null) {
                        if (value.dataType === 'Map') {
                            return new Map(value.value);
                        }
                    }
                    return value;
                });

            })
            .catch(() => { });

    }

    Destory()
    {
        if (this.temps.Size())
            sfs.rmdirSync(this.config.tempDir, { recursive: true });
        //record persistents map
        if (this.persistents.size) {
            const json = JSON.stringify(this.persistents,
                (key, value) =>
                {
                    if (value instanceof Map) {
                        return {
                            dataType: 'Map',
                            value: Array.from(value.entries()), // or with spread: value: [...value]
                        };
                    } else {
                        return value;
                    }
                });
            sfs.writeFileSync(Path.join(this.config.persistentDir, 'persistents.json'), json);
        }
    }

    async CacheFile(buffer: Buffer, name: string, persistent = false): Promise<string>
    {
        return new Promise((resolve, reject) =>
        {
            const [source, get, set, dir] =
                persistent ?
                    [this.persistents, this.persistents.get.bind(this.persistents), this.persistents.set.bind(this.persistents), this.config.persistentDir] :
                    [this.temps, this.temps.Get.bind(this.temps), this.temps.Set.bind(this.temps), this.config.tempDir];
            const hash = crypto.createHash('sha256');
            hash.update(buffer);
            const sha256 = hash.digest('hex');
            this.QuerySha256(sha256, source)
                .then(result =>
                {
                    if (result) {
                        //already uploaded
                        const val = get(sha256);
                        if (val)
                            resolve(val);
                        else
                            reject();
                    }
                    else {
                        const pref = crypto.randomBytes(12).toString('hex');
                        const suff = name.split('.').pop();
                        name = pref + '.' + suff;
                        set(sha256, name);
                        fs.writeFile(Path.join(dir, name), buffer, 'binary');
                        resolve(name);
                    }
                });
        });
    }

    async ClearPersistents()
    {
        this.persistents.clear();
        sfs.rmdirSync(this.config.persistentDir);
        fs.mkdir(this.config.persistentDir);
    }

    async QuerySha256(hash: string, source: Iterable<[string, string]>)
    {
        return new Promise<boolean>((resolve) =>
        {
            for (const item of source) {
                if (item[0] == hash) {
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        });

    }

}