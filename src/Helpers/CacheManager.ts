import { promises as fs} from 'fs';
import sfs from 'fs';
import LRUCache from './LRUCache';
import Path from 'path';
import crypto from 'crypto';
import { clearInterval } from 'timers';
import { Serialize, Deserialize } from '../Tools/Utils';

export interface ICacheManagerConfig
{
    maxTempSize?: number;
    tempDir: string;
    persistentDir: string;
    checkTime?:number
}

/**
 * Cache manager decides how much files can be saved to disk
 */
export class CacheManager
{

    private temps = new LRUCache<string, string>();
    private persistents = new Map<string, string>();
    private timer;

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
        this.timer = setInterval(this.Check.bind(this), config.checkTime ?? 2000);
    }

    private LoadPersistents()
    {
        fs.readFile(Path.join(this.config.persistentDir, 'persistents.json'))
            .then(buf =>
            {
                this.persistents = Deserialize(Map<string, string>, buf.toString());
            })
            .catch(() => { });

    }

    Check()
    {
        {

            fs.readdir(this.config.tempDir)
                .then(async files=> {
                    let size = 0;
                    const sizeMap = new Map<string, number>();
                    for(const file of files)
                    {
                        await fs.stat(Path.join(this.config.tempDir, file))
                            .then(stats=>{
                                size += stats.size;
                                sizeMap.set(file, stats.size);
                            });
                    }
                    const max = (this.config.maxTempSize ?? 1024) * 1014 * 1024;
                    while(size > max)
                    {
                        const file = this.temps.Pop();
                        
                        if(file?.val)
                        {
                            const fsize = sizeMap.get(file.val);
                            await fs.rm(Path.join(this.config.tempDir, file.val), {recursive:true});
                            size -= fsize ?? 0;
                        }
                        else
                        {
                            await fs.rm(this.config.tempDir, {recursive:true});
                            await fs.mkdir(this.config.tempDir);
                            return;
                        }
                    }
                    
                })
                .catch(()=>{
                    fs.mkdir(this.config.persistentDir);
                });
            
        }
    }

    Destory()
    {
        clearInterval(this.timer);
        sfs.rmdirSync(this.config.tempDir, { recursive:true });
        //record persistents map
        if (this.persistents.size) {
            const json = Serialize(this.persistents);
            sfs.writeFileSync(Path.join(this.config.persistentDir, 'persistents.json'), json);
        }
    }

    ResetTimer(time:number)
    {
        this.config.checkTime = time;
        this.timer = setInterval(this.Check.bind(this), time);
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