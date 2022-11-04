import { DefineRouter, WebServer } from './WebServer';
import { ECacheStrategy, StaticRouter } from './Routers/StaticRouter';
import { Request, Response, RouterBase } from './Routers/RouterBase';
import { FileManager } from './Tools/FileManager';
import { CacheManager } from './Tools/CacheManager';
import './Routers/CorsRouter';
import { GetHandler } from './Handlers/GetHandler';
import { MultipartHandler, PostHandler } from './Handlers/PostHandler';
import { ServerRecorder } from './Tools/ServerRocorder';
import fs from 'fs';
const fm = new FileManager()
    .Dirs(['./www']);
const cm = new CacheManager({ persistentDir: './www/cache', tempDir: './www/temp' });

const server = new WebServer(cm)
    .Options({
        cert: fs.readFileSync('./www/certs/saltyfishcontainer.eu.org_bundle.crt'),
        key: fs.readFileSync('./www/certs/saltyfishcontainer.eu.org.key'),
    })
    // .Watch(__filename)
    .Handle(new GetHandler())
    .Handle(new PostHandler());
    // .Record(new ServerRecorder('./Records'));

server.Route(new StaticRouter('/app/calendar/*')
    .Dir('./www')
    .FileManager(fm)
);

@DefineRouter('/api/test', server)
class TestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        response.Write(request.postParams);
        response.end();
    }
    Get(request: Request, response: Response, next: () => void): void
    {
        response.End(200, 'okk');
    }
}

interface Affair
{
    date: string;
    titile: string;
    urgency: number;
    message: string;
}
interface UserInfo 
{
    affairs: Affair[];
}
const users = new Map<string, UserInfo>();
users.set('LingDar77',
    {
        affairs: [
            {
                date: '2022/10/20',
                titile: '采购',
                message: '整点零食，买点水果，找群友v50吃肯德基',
                urgency: 4
            },
            {
                date: '2022/10/20',
                titile: 'DDL',
                message: '别摸鱼了，再摸人没了，你这个点还敢摸鱼？',
                urgency: 4
            },
            {
                date: '2022/10/21',
                titile: 'p5r',
                message: 'p5rp5rp5rp5rp5rp5rp5r',
                urgency: 3
            }
        ]
    });

@DefineRouter('/api/loginTest', server)
class LoginTestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        if (request.postParams.userName) {
            response.End({ registered: users.has(request.postParams.userName) });
        }
        else {
            response.End(404);
        }
    }
}

@DefineRouter('/api/login', server)
class LoginRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        if (request.postParams.userName && request.postParams.password) {
            if (!users.has(request.postParams.userName)) {
                users.set(request.postParams.userName, { affairs: [] });
            }
            response.End(users.get(request.postParams.userName));
        }
        else {
            next();
        }
    }
}

server.StartServer(18886, 'https');
server.StartServer(18887, 'http');
// console.clear();
console.log('Server started running at: https://localhost:18886');
