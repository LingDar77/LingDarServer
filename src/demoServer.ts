
import { LDRequest, LDResponse, RouterBase } from "./Core";
import { CorsRouter, GetRouter, MultipartRouter, PostRouter, StaticRouter } from "./Routers";
import { MergeSortedArray, WatchChange } from "./Tools";
import { DefineRouter, WebServer } from "./WebServer";

// @DefineRouter('/test/*')
// class TestRouter extends RouterBase
// {
//     Handle(request: LDRequest, response: LDResponse): Promise<void>
//     {
//         return new Promise((resolve, reject) =>
//         {
//             response.setHeader('Content-Type', 'text/html; charset=utf-8');
//             // console.log('??');

//             // response.End("???");
//             resolve();
//         });
//     }
// }

@DefineRouter('/test')
class TestRouter2 extends RouterBase
{
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise(resolve =>
        {
            response.setHeader('Set-Cookie', ['asd=ddsa', 'ddsa=1123']);
            // console.log(request.GetParams, request.PostParams);
            // console.log(request.headers.cookie);
            response.End({
                Matches: request.Matches,
                GetParams: request.GetParams,
                PostParams: request.PostParams,
                FormParams: request.FormParams,
                Files: request.Files,
                code: '妈妈生的'
            });
            resolve();
        });
    }
}

const server = new WebServer();

const routers = [
    new CorsRouter('/*'),
    new GetRouter('/*'),
    new PostRouter('/*'),
    // new MultipartRouter('/test/*'),
    new StaticRouter('/res/*', './www')];

server.Route(...routers);

server.Run('http', 1887);
WatchChange(__filename, async () =>
{
    const spawnSync = (await import('child_process')).spawnSync;
    console.log('Changes detected, restarting...');
    server.Close();
    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true, windowsHide: true });
    process.emit('SIGINT');
});