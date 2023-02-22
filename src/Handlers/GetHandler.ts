
import { Request, Response } from '../Routers/RouterBase';
import { WebServer } from '../WebServer';
import { HandlerBase } from './HandlerBase';
import { RouterBase } from '../Routers/RouterBase';


export class GetHandler extends HandlerBase
{
    Match(request: Request, server: WebServer): boolean
    {
        return request.method == 'GET';
    }

    Preprocess(request: Request, response: Response, server: WebServer): Promise<void>
    {
        return new Promise((resolve) =>
        {
            //parse get parts
            if (request.url) {
                const results = request.url.match(/(.+)\?((?:[^=&]+=[^&]+&?)+)/);
                if (results) {
                    //set get request
                    request.RequestPath = results[1] == '/' ? '/' : results[1];
                    const params = results[2].split('&');
                    if (params.length != 0) {
                        request.GetParams = {};
                        for (const param of params) {
                            if (param != '') {
                                const [key, val] = param.split('=');
                                request.GetParams[key] = val;
                            }
                        }
                    }

                }
            }
            resolve();
        });
    }

    Handle = (request: Request, response: Response, router: RouterBase, next: () => void) =>
    {
        router.Get(request, response, next);
    };

}
