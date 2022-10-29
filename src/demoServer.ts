import { DefineRouter, WebServer } from './WebServer';
import { ECacheStrategy, StaticRouter } from './Routers/StaticRouter';
import { Request, Response, RouterBase } from './Routers/RouterBase';
import { FileManager } from './Tools/FileManager';
import { CacheManager } from './Tools/CacheManager';
import './Routers/CorsRouter';
import { GetHandler } from './Handlers/GetHandler';
import { MultipartHandler, PostHandler } from './Handlers/PostHandler';
import { WebSocketHandler } from './Handlers/WebSocketHandler';
import { ServerRecorder } from './Tools/ServerRocorder';

const fm = new FileManager()
    .Dirs(['./www']);
const cm = new CacheManager({ persistentDir: './www/cache', tempDir: './www/temp' });

const socketHandler = new WebSocketHandler();

const server = new WebServer('http', cm)
    // .Watch(__filename)
    .Handle(new GetHandler())
    .Handle(new MultipartHandler())
    .Handle(new PostHandler())
    .Handle(socketHandler)
    // .Record(new ServerRecorder('./Records'))
    .OnClose(() =>
    {
        console.log('Server closed');
    });


server.Route(new StaticRouter('/*')
    .Dir('./www')
    .FileManager(fm)
    .MaxAge(3600)
    .CacheStrategy(ECacheStrategy.LastModified)
);

@DefineRouter('/api/test', server)
class TestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        if (request.files) {
            console.log(request.files);
        }
        // console.log(request.postParams);

        response.End(request.postParams);
    }
    Get(request: Request, response: Response, next: () => void): void
    {
        response.End(200, request.getParams);
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

server.StartServer(8080);
console.clear();
console.log('Server started running at: http://localhost:8080');