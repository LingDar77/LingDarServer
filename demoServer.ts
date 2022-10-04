import app, { DefineRouter } from './index';
import {ECacheStrategy, StaticRouter} from './src/Routers/StaticRouter';
import './src/Routers/CorsRouter';
import { Request, Response, RouterBase } from './src/Routers/RouterBase';
import { FileManager } from './src/Helpers/FileManager';
import { CacheManager } from './src/Helpers/CacheManager';

app.On('close', ()=>{
    console.log('server closed');
    cm.Destory();
});

const fm = new FileManager();
const cm = new CacheManager({persistentDir:'C:/Cache/LDServerCache', tempDir:'C:/Cache/LDServerCacheTemp'});

app.routers.push(new StaticRouter(/^(\/.*)$/)
    .Dir('./www')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified));

@DefineRouter(/^(\/api\/test)$/)
class TestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        response.write(JSON.stringify(request.postParams));
        response.end();
    }
}

const server = app.StartServer(cm);
console.clear();
console.log('Server started running at: http://localhost:8080');
app.Watch(server);