import { ServerHandler } from './ServerHandler';
import { WebSocketServer, ServerOptions } from 'ws';
import { Request } from '../Routers/RouterBase';
import { WebServer } from '../WebServer';
import { IncomingMessage } from 'http';

export class WebSocketHandler extends ServerHandler
{
    private socket:WebSocketServer | undefined;
    OnConnection: ((socket: WebSocket, request: IncomingMessage) => void) | undefined;
    OnError: ((error: Error) => void) | undefined;
    OnHeaders: ((headers: string[], request: IncomingMessage) => void) | undefined;
    OnListening: (() => void) | undefined;

    constructor(private options:ServerOptions = {})
    {
        super();
    }

    Match(request: Request, server: WebServer): boolean {
        if(!this.socket)
        {
            this.options.server = server.server;
            this.socket = new WebSocketServer(this.options);
            if(this.OnConnection)
                this.socket.on('connection', this.OnConnection.bind(this));
            if(this.OnError)
                this.socket.on('error', this.OnError.bind(this));
            if(this.OnHeaders)
                this.socket.on('headers', this.OnHeaders.bind(this));
            if(this.OnListening)
                this.socket.on('listening', this.OnListening.bind(this));
        }
        return false;
    }

}