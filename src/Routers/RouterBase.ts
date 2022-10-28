import http from 'http';
export type Request = RequestParams & http.IncomingMessage;

export interface RequestParams
{
    getParams: { [x: string]: string };
    postParams: { [x: string]: string };
    formParams: { [x: string]: string };
    files: { [x: string]: Promise<string> };
    path: string;
    ip: string;
}

export type Response = http.ServerResponse &
{ Write: (chunk: object | string | Buffer, encoding?: BufferEncoding) => boolean } &
{ End: (message?: string | object | Buffer) => void } &
{ End: (code?: number) => void } &
{ End: (code?: number, message?: string | object | Buffer) => void }

export abstract class RouterBase
{
    public pattern: RegExp;
    constructor(pattern: RegExp | string)
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


            this.pattern = RegExp(reg);
        }
        else {
            this.pattern = pattern;
        }

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
