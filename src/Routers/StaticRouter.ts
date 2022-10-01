import { Request, Response, RouterBase } from "../../index";
import { Transform } from 'stream';
import { FileManager } from '../Helpers/FileManager'
import { promises as fs } from 'fs'
import Path from 'path';
import { Writable } from 'stream';

export class StaticRouter extends RouterBase
{
    private dir = './';
    private filter: undefined | ((path: string) => { transform: Transform, ContentEncoding: string } | void);
    private fileMan: undefined | FileManager;

    Dir(dir: string = './')
    {
        this.dir = dir;
        return this;
    }
    Filter(filter?: ((path: string) => { transform: Transform, ContentEncoding: string } | void))
    {
        this.filter = filter;
        return this;
    }
    FileManager(fm?: FileManager)
    {
        this.fileMan = fm;
        return this;
    }

    GetPriority(): number
    {
        return 1;

    }
    Get(request: Request, response: Response, next: () => void): void
    {
        let path = request.path;
        let cnt = 0;
        // /res/index.ts
        // /res/*
        for (let i = 0; i != this.path.length; ++i) {
            if (this.path[i] != '*') {
                cnt++;
            }
            else break;
        }
        path = path.slice(cnt);
        let finalPath = Path.join(this.dir, path == '' ? 'index.html' : path);

        //check if the client has cache
        const lastCache = request.headers["if-modified-since"];
        let version;
        fs.stat(finalPath)
            .then(stats =>
            {
                if (!lastCache || parseInt(lastCache) != stats.mtime.getTime()) {
                    version = stats.mtime.getTime();
                    response.header({ "last-modified": version });

                    //handle target
                    let target: Writable;
                    if (this.filter) {
                        let filter = this.filter(path);
                        if (filter) {
                            response.header({ "Content-Encoding": filter.ContentEncoding });
                            filter.transform.pipe(response);
                            target = filter.transform;
                        }
                        else
                            target = response;
                    } else
                        target = response;

                    if (this.fileMan) {
                        this.fileMan.RequestFile(finalPath, target, version)
                            .then(() =>
                            {
                                target.end();
                            })
                            .catch(() =>
                            {
                                next();
                            });
                    }
                    else {
                        fs.readFile(finalPath)
                            .then(data =>
                            {
                                target.write(data);
                                target.end();
                            })
                            .catch(err =>
                            {
                                next();
                            });
                    }
                }
                else {
                    response.status(304);
                    response.end();
                }
            })
            .catch(err => next());


    }

}