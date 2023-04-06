
import { LDRequest, LDResponse, RouterBase } from './Core';
import { CorsRouter, GetRouter, MultipartRouter, PostRouter, StaticRouter } from './Routers';
import { DefineRouter, WebServer } from './WebServer';

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

@DefineRouter('/api/test')
class TestRouter2 extends RouterBase
{
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise(resolve =>
        {

            // response.setHeader('Set-Cookie', encodeURIComponent('abababa=妈妈生的'));
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

@DefineRouter('/api/userlogin')
class UserLoginRouter extends RouterBase
{
    // private AppID: string;
    // private AppSecret: string;
    constructor(pattern: string | RegExp)
    {
        super(pattern);

        // try {
        //     // const data = JSON.parse(fs.readFileSync(ResolvePath('./AppData.json')).toString());
        //     this.AppID = data.App1.AppID;
        //     this.AppSecret = data.App1.AppSecret;
        // } catch (error) {
        //     console.warn(error);
        //     this.AppID = '';
        //     this.AppSecret = '';
        // }


    }
    Handle(request: LDRequest, response: LDResponse): Promise<void>
    {
        return new Promise(resolove =>
        {
            if (request.method == 'GET') {

                console.log(request.GetParams);

                // const res = fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${this.AppID}&secret=${this.AppSecret}&js_code=${request.PostParams.code}&grant_type=authorization_code`, { method: 'GET' });

            }
            response.End(200);
            resolove();
            return;

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

console.log(process.argv);
