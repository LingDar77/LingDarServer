
import { promises as fs } from 'fs';
import { Request } from '../Routers/RouterBase';
import { resolve as resolvePath } from 'path';
import { FormatDate } from './Utils';
import { FileHandle } from 'fs/promises';

export class ServerRecorder
{
    private file: FileHandle | undefined;
    private currentLines = 0;
    constructor(private path: string, private maxLines = 1024)
    {
        this.newArchive();
    }

    private newArchive()
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
                await fs.writeFile(filePath, 'log');
                await fs.open(filePath, 'w')
                    .then((file) =>
                    {
                        this.file = file;
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
                resolve(`Time: ${new Date().toLocaleTimeString()}, IP: ${req.ip}, RequestPath: ${req.path}${req.getParams ? ', GetParams: ' + JSON.stringify(req.getParams) : ''}${req.postParams ? ', PostParams: ' + JSON.stringify(req.postParams) : ''}${req.formParams ? ', FormParams: ' + JSON.stringify(req.formParams) : ''}${length ? ', Files: ' + JSON.stringify(files) : ''}\n`);
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
            this.file.write(await this.getRecord(req));
            this.currentLines += 1;
            if (this.currentLines >= this.maxLines) {

                this.file.close();
                this.newArchive();
            }
        }

    }


}