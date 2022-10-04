import app, { DefineRouter } from './index';
import {ECacheStrategy, StaticRouter} from './src/Routers/StaticRouter';
import './src/Routers/CorsRouter';
import { Request, Response, RouterBase } from './src/Routers/RouterBase';
import { FileManager } from './src/Helpers/FileManager';

app.On('close', ()=>{
    console.log('server closed');
});

const fm = new FileManager();

app.routers.push(new StaticRouter(/^(\/.*)$/)
    .Dir('./www')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified));

@DefineRouter(/^(\/api\/test)$/)
class TestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        console.log(request);
    }
}

const server = app.StartServer();
console.clear();
console.log('Server started running at: http://localhost:8080');
app.Watch(server);