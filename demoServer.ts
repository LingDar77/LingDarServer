import server, { DefineRouter, RouterBase } from './index';


@DefineRouter('/api/test')
class testRouter extends RouterBase
{

}

@DefineRouter('/api/test1')
class cors extends RouterBase
{
    GetPriority(): number
    {
        return -1;
    }
}

server.StartServer();