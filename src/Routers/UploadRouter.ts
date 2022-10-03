/* eslint-disable @typescript-eslint/no-empty-function */
import { Request, Response, RouterBase } from '../../index';
import { CacheManager } from '../Helpers/CacheManager';

export class UploadProgressRouter extends RouterBase
{

}
export class UploadRouter extends RouterBase
{
    private cacheMan: undefined | CacheManager;

    GetPriority(): number
    {
        return 2;
    }

    CacheManager(cm?: CacheManager)
    {
        this.cacheMan = cm;
        return this;
    }

    CacheStrategy()
    {
        
    }

    Post(request: Request, response: Response, next: () => void): void
    {
        const parts = request.headers['content-type']?.split(';');
        const boudary = '--' + parts?.at(1)?.split('=')[1];
        const contentType = parts?.at(0);
        if (contentType == 'multipart/form-data') {
            let buffer = Buffer.alloc(0);
            request.on('data', data =>
            {
                buffer = Buffer.concat([buffer, data]);
            });
            request.on('end', async () =>
            {
                const items = buffer.toString('binary').split(boudary);

                items.pop();
                items.shift();

                for (const item of items) {
                    const i = item.indexOf('\r\n\r\n');
                    const head = item.slice(0, i);
                    const body = item.slice(i + 4);
                    const parts = head.split('; ');
                    const name = parts[1].split('=')[1].slice(1, -1);
                    let fname = parts[2] ? parts[2].split('=')[1].split('\r\n')[0].slice(1, -1) : parts[2];
                    if (!fname) {
                        request.params[name] = body.slice(0, -2);
                    }
                    else {
                        fname = Buffer.from(fname, 'binary').toString();
                        //start handle uploading, send an upload id to client
                        //this id can be used to query the progress of this upload
                        if (this.cacheMan) {
                            const path = await this.cacheMan.CachePersistent(Buffer.from(body.slice(0, -2)), fname);
                            response.write(JSON.stringify({ path }));
                        }
                    }
                }

                response.end();

            });
        }
        else {
            next();
        }

    }
}