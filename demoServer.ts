/* eslint-disable @typescript-eslint/no-unused-vars */
import server, { DefineRouter, Request, Response, RouterBase } from './index';
import { FileManager } from './src/Helpers/FileManager';
import './src/Routers/CorsRouter';
import './src/Routers/JsonParserRouter';
import { ECacheStrategy, StaticRouter } from './src/Routers/StaticRouter';
import { UploadRouter } from './src/Routers/UploadRouter';
import zlib from 'zlib';
import { CacheManager } from './src/Helpers/CacheManager';

const fm = new FileManager();
const cm = new CacheManager({ persistentDir: 'C:/Cache/LDServerCache', tempDir: 'C:/Cache/LDServerCachetemp' });

@DefineRouter('/api/test1')
class testRouter extends RouterBase
{
    Get(request: Request, response: Response, next: () => void): void
    {
        fm.RequestFile('./1.epub', response)
            .then(() =>
            {
                response.end();
            }).catch((err) =>
            {
                response.status(404);
                response.end();
            });
    }
    Post(request: Request, response: Response, next: () => void): void
    {
        fm.RequestFile('./index.ts', response)
            .then(() =>
            {
                response.end();
            }).catch((err) =>
            {
                console.log(err);

            });
    }
}

server.routers.push(new StaticRouter('/*')
    .Dir('./www')
    .Filter((path) =>
    {
        if (path.match(/\.(html|css|js)/g)) {
            return { ContentEncoding: 'gzip', transform: zlib.createGzip() };
        }
    })
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified)
);

server.routers.push(new StaticRouter('/temp/*')
    .Dir('C:/Cache/LDServerCachetemp')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified)
);

server.routers.push(new StaticRouter('/cache/*')
    .Dir('C:/Cache/LDServerCache')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified)
);

server.routers.push(new UploadRouter('/api/upload')
    .CacheManager(cm));

server.StartServer();