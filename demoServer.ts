import server, { DefineRouter, Request, Response, RouterBase } from './index';
import { FileManager } from './src/Helpers/FileManager';
import './src/Routers/CorsRouter';
import './src/Routers/JsonParserRouter';
import { StaticRouter } from './src/Routers/StaticRouter';
import zlib from 'zlib';

const fm = new FileManager();
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
                console.log(err);
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
        if (path.includes('css') || path.includes('js') || path.includes('html')) {
            return { ContentEncoding: 'gzip', transform: zlib.createGzip() }
        }
    })
    .FileManager(fm)
);

server.StartServer();