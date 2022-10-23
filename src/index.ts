import { Server, ServerOptions } from './Core/Server';
import { RouterBase } from './Routers/RouterBase';
import { spawnSync } from 'child_process';
import { debounce } from './Tools/Debounce';
import { promises as fs } from 'fs';
import { CacheManager } from './Helpers/CacheManager';

export function DefineRouter(pattern: RegExp | string)
{
    return <T extends { new(p: RegExp | string): RouterBase }>(constructor: T) =>
    {
        app.routers.push(new constructor(pattern));
    };
}
const app = {
    routers: new Array<RouterBase>(),
    onClose: () => { },
    StartServer(cacheMan: CacheManager, protocol: 'http' | 'https' = 'http', port = 8080, options: ServerOptions = {})
    {
        const server = new Server(protocol, cacheMan);
        server.routers = this.routers;
        server.routers.sort((a, b) =>
        {
            return a.GetPriority() - b.GetPriority();
        });
        server.StartServer(this.onClose, port, options);
        return server;
    },
    On(event: 'close', callback: () => void)
    {
        this.onClose = callback;
    },
    Watch(instance: Server, path:string)
    {
        (async () =>
        {
            const watcher = fs.watch(path, { recursive: true });
            const response = debounce(() =>
            {
                process.addListener('exit', () =>
                {
                    spawnSync('node', [process.argv[1]], { stdio: 'inherit', shell: true });
                });
                console.clear();
                console.log('Changes detected, server restarting...');
                process.emit('SIGINT');
            }, 200);

            process.on('SIGINT', () =>
            {
                this.onClose();
                instance.server?.close();
                process.exit();
            });
            for await (const event of watcher) {
                if(event.eventType == 'change')
                    response(event);
            }
        })();
    }
};

export default app;
