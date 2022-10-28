import { Request, Response } from '../Routers/RouterBase';
import { WebServer } from '../WebServer';
import { ServerHandler } from './ServerHandler';
import { RouterBase } from '../Routers/RouterBase';

export class PostHandler extends ServerHandler
{
    Match(request: Request): boolean {
        return request.method == 'POST';
    }

    Handle = (request: Request, response: Response, router: RouterBase, next: () => void)=> {
        router.Post(request, response, next);
    };

    Preprocess(request: Request, response: Response, server: WebServer): Promise<void> {
        return new Promise((resolve)=>{
            //handle post request
            let buffer = Buffer.alloc(0);
            request.postParams = {};
            request.on('data', (data: Buffer) =>
            {
                buffer = Buffer.concat([buffer, data]);
            });
            request.on('end', () =>
            {
                try {
                    const data = buffer.toString();
                    if(data != '')
                    {
                        const params = JSON.parse(data);
                        if (params) {
                            request.postParams = params;
                        }
                    }
                } catch (error) {
                }
                resolve();
            });
        });
    }
}


export class MultipartHandler extends ServerHandler
{
    private boundary = '';
    Match(request: Request): boolean {
        if(request.method != 'POST')
            return false;
        const types = request.headers['content-type'];
        if(types)
        { 
            //handle multipart request
            const results = types.match(/multipart\/form-data; boundary=(.+)/);
            if (results) {
                this.boundary = '--' + results[1];
                return true;
            }
        }
        return false;
    }

    Preprocess(request: Request, response: Response, server: WebServer): Promise<void> {
        return new Promise((resolve)=>{
            //parse form data
            let buffer = Buffer.alloc(0);
            request.formParams = {};
            request.files = {};
            request.on('data', (data: Buffer) =>
            {
                buffer = Buffer.concat([buffer, data]);
            });
            request.on('end', () =>
            {
                const items = buffer.toString('binary').split(this.boundary);
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
                        request.formParams[name] = body.slice(0, -2);

                    }
                    else {
                        fname = Buffer.from(fname, 'binary').toString();
                        //start handle uploading, send an upload id to client
                        //this id can be used to query the progress of this upload
                        if (server.cm) {
                            request.files[fname] = server.cm.CacheFile(Buffer.from(body, 'binary'), fname);
                        }
                    }
                }
                resolve();
            });
        });
    }
    
}
