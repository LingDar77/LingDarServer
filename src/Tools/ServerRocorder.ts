
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
                for (const file in req.Files) {

                    files[file as keyof typeof files] = await req.Files[file] as never;
                    ++length;
                }
                resolve(`Time: ${new Date().toLocaleTimeString()}, IP: ${req.Address}, Request Method: ${req.method}, RequestPath: ${req.RequestPath}${req.GetParams ? ', GetParams: ' + JSON.stringify(req.GetParams) : ''}${req.PostParams ? ', PostParams: ' + JSON.stringify(req.PostParams) : ''}${req.FormParams ? ', FormParams: ' + JSON.stringify(req.FormParams) : ''}${length ? ', Files: ' + JSON.stringify(files) : ''}\n`);
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