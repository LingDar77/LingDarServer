import { DefineRouter } from "../../index";
import { Request, Response, RouterBase } from "../../index";

//Actually you may not want to use this router, instead, you may need to write your own policy to handlle cors
@DefineRouter('/*')
class CorsRouter extends RouterBase
{
    Get(request: Request, response: Response, next: () => void): void
    {
        response.header({ "Access-Control-Allow-Origin": "*" });
        next();
    }
    Post(request: Request, response: Response, next: () => void): void
    {
        response.header({ "Access-Control-Allow-Origin": "*" });
        next();
    }

}