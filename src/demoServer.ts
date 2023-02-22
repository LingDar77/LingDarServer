
import { Request, Response, RouterBase } from "./v2/Core";
import { DefineRouter, WebServer } from "./v2/WebServer";
import { CorsRouter, GetRouter, MultipartRouter, PostRouter, StaticRouter } from "./v2/Routers";
import { Measurement } from "./Tools/Utils";
import { WatchChange } from "./v2/Tools";

@DefineRouter('/test/*')
class TestRouter extends RouterBase
{
    Handle(request: Request, response: Response): Promise<void>
    {
        return new Promise((resolve, reject) =>
        {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
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

const server = new WebServer(18888);
server.Route(new CorsRouter('/*'),
    new GetRouter('/test/*'),
    new PostRouter('/*'),
    // new MultipartRouter('/test/*'),
    new StaticRouter('/res/*', './www')
);

server.Run();
// console.log(server.Routers);
// const a = 'C://asd/dsa.txt';
// const b = '^C://asd/';
// console.log(a.match(b));

WatchChange(__filename, async () =>
{
    const spawnSync = (await import('child_process')).spawnSync;
    server.Instance?.close();
    console.log('Changes detected, restarting...');
    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true, windowsHide: true });
    process.emit('SIGINT');
});
