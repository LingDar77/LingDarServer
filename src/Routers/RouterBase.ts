import http from 'http';

export class ServerResponse extends http.ServerResponse
{

}

export class Request extends http.IncomingMessage
{
    params: {[x:string]:string} = {};
    path = '';
}

export class Response extends http.ServerResponse
{
    
}

export class RouterBase
{

    constructor(public pattern: RegExp)
    {
    }

    GetPriority()
    {
        return 0;
    }

    Get(request: Request, response: Response, next: () => void)
    {
        next();
    }

    Post(request: Request, response: Response, next: () => void)
    {
        next();
    }

}
