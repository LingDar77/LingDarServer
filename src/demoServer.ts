
import { Request, Response, RouterBase } from "./Core";
import { DefineRouter, WebServer } from "./WebServer";
import { CorsRouter, GetRouter, MultipartRouter, PostRouter, StaticRouter } from "./Routers";
import { WatchChange } from "./Tools";

@DefineRouter('/test/*')
class TestRouter extends RouterBase
{
    Handle(request: Request, response: Response): Promise<void>
    {
        return new Promise((resolve, reject) =>
        {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            console.log('??');
            
            // response.End("???");
            resolve();
        });
    }
}

@DefineRouter('/test/*')
class TestRouter2 extends RouterBase
{
    Handle(request: Request, response: Response): Promise<void>
    {
        return new Promise(resolve =>
        {
            // response.End('妈妈生的');
            console.log(request.GetParams);
            console.log(request.PostParams);
            console.log(request.FormParams);

            console.log(request.Files);
            response.End();
            resolve();
        });
    }
}

const server = new WebServer();
server.Route(new CorsRouter('/*'),
    new GetRouter('/test/*'),
    new PostRouter('/*'),
    // new MultipartRouter('/test/*'),
    new StaticRouter('/res/*', './www')
);

server.Run('http', 1887);
WatchChange(__filename, async () =>
{
    const spawnSync = (await import('child_process')).spawnSync;
    console.log('Changes detected, restarting...');
    server.Close();
    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true, windowsHide: true });
    process.emit('SIGINT');
});
