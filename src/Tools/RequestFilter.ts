import { Request } from '../Routers/RouterBase';


export abstract class RequestFilter
{
    Match(req: Request)
    {
        return true;
    }
}