import http from 'http';
export type Request = RequestParams & http.IncomingMessage;

export interface RequestParams
{
    GetParams: { [x: string]: string };
    PostParams: { [x: string]: string };
    FormParams: { [x: string]: string };
    Files: { [x: string]: Buffer };
    RequestPath: string;
    ResolvedPath: string;
    Address: string;
}

export type Response = http.ServerResponse &
// {ended:boolean} &
{ Write: (chunk: object | string | Buffer, encoding?: BufferEncoding) => boolean } &
{ Redirect: (url: string) => void } &
{ End: (message?: string | object | Buffer) => void } &
{ End: (code?: number) => void } &
{ End: (code?: number, message?: string | object | Buffer) => void }

export function Response(res: http.ServerResponse)
{
    const response = res as Response;

    response.Write = (chunk: object | string | Buffer, encoding: BufferEncoding = 'utf-8') =>
    {
        if (chunk instanceof Buffer || typeof chunk == 'string') {
            return response.write(chunk, encoding);
        }
        else {
            response.setHeader('Content-Type', 'application/json');
            return response.write(JSON.stringify(chunk), encoding);
        }
    };

    response.Redirect = (url) =>
    {
        response.writeHead(302, {
            'Location': url
            //add other headers here...
        });
        response.end();
    };

    response.End = (...args) =>
    {
        if (typeof args[0] == 'number') {
            if (args[1]) {
                response.Write(args[1] as string);
                response.statusCode = args[0];
                response.end();
            }
            else {
                response.statusCode = args[0];
                response.end();
            }
        }
        else if (args[0]) {
            response.Write(args[0] as string);
            response.end();
        }
        else {
            response.end();
        }
    };

    return response;
}

export abstract class RouterBase
{
    public expression = /.*/g;
    constructor(pattern: RegExp | string,)
    {
        if (typeof pattern == 'string') {
            /**
             *  /*
             *  ^(\/.*)$
             *  /cache/index
             *  ^\/cache(\/index)$
             *  /cache/*
             *  ^\/cache(\/.*)$
             *  
             *  reg
             *  (\/*)
             */

            let reg = pattern.replace(/\//g, '\\/');
            // \/*
            // \/cache\/*
            reg = '^' + reg.replace(/\\\/\*/g, '(\\/.*)$');


            this.expression = RegExp(reg);
            // console.log('^(' + this.pattern.source.slice(1, -1) + '\\/).*$');

        }
        else {
            this.expression = pattern;
        }
    }

    GetPriority()
    {
        return 0;
    }

    abstract Handle(request: Request, response: Response): Promise<void>;
}
