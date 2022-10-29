
import { promises as fs } from 'fs';
import { Request } from '../Routers/RouterBase';
import { resolve as resolvePath } from 'path';
import { FormatDate } from './Utils';
import { FileHandle } from 'fs/promises';

export class ServerRecorder
{
    private file: FileHandle | undefined;
    
    constructor(private path: string)
    {
        this.newArchive();
    }

    private async newArchive()
    {
        return new Promise<void>((resolve) =>
        {
            fs.access(this.path)
                .catch(() =>
                {
                    fs.mkdir(this.path);
                })
                .finally(async () =>
                {
                    const time = new Date();
                    const filePath = resolvePath(this.path, FormatDate(time) + ' ' + time.toLocaleTimeString().replaceAll(':', '_') + '.log');
                    await fs.writeFile(filePath, '');
                    await fs.open(filePath, 'w')
                        .then((file) =>
                        {
                            this.file = file;
                            resolve();
                        });
                });
        });
    }

    private getRecord(req: Request): Promise<string>
    {
        return new Promise((resolve) =>
        {
            const files = {};
            let length = 0;
            (async () =>
            {
                for (const file in req.files) {

                    files[file as keyof typeof files] = await req.files[file] as never;
                    ++length;
                }
                resolve(`Time: ${new Date().toLocaleTimeString()}, IP: ${req.ip}, Request Method: ${req.method}, RequestPath: ${req.path}${req.getParams ? ', GetParams: ' + JSON.stringify(req.getParams) : ''}${req.postParams ? ', PostParams: ' + JSON.stringify(req.postParams) : ''}${req.formParams ? ', FormParams: ' + JSON.stringify(req.formParams) : ''}${length ? ', Files: ' + JSON.stringify(files) : ''}\n`);
            })();
        });
    }

    Destory()
    {
        this.file?.close();
    }

    async Record(req: Request)
    {
        if (this.file) {
            const record = await this.getRecord(req);
            this.file.write(record);
        }
    }


}