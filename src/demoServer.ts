import app, { DefineRouter } from './index';
import { ECacheStrategy, StaticRouter } from './Routers/StaticRouter';
import './Routers/CorsRouter';
import { Request, Response, RouterBase } from './Routers/RouterBase';
import { FileManager } from './Helpers/FileManager';
import { CacheManager } from './Helpers/CacheManager';
import fetch from 'cross-fetch';
app.On('close', () =>
{
    console.log('server closed');
    cm.Destory();
});

const fm = new FileManager()
    .Dirs([ './www','C:/Cache/LDServerCache', 'C:/Cache/LDServerCacheTemp' ]);
const cm = new CacheManager({ persistentDir: 'C:/Cache/LDServerCache', tempDir: 'C:/Cache/LDServerCacheTemp' });

app.routers.push(new StaticRouter('/*')
    .Dir('./www')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.MaxAge));

app.routers.push(new StaticRouter('/Cache/*')
    .Dir('C:/Cache/LDServerCache')
    .FileManager(fm)
    .CacheStrategy(ECacheStrategy.LastModified));
@DefineRouter('/api/test')
class TestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        response.Write(request.postParams);
        response.end();
    }
    Get(request: Request, response: Response, next: () => void): void
    {
        const fname = request.getParams.filename;
        if(fname){
            fm.RequestFile(fname, response).then(()=>{
                
                response.end();
            }).catch(()=>{
                response.statusCode = 423;
                response.end();
            });
        }
        else
        {
            response.Write(request.getParams);
            response.end();
        }
        
    }
}

@DefineRouter('/api/weather')
class WeatherRouter extends RouterBase
{
    private info = {fl:'', fx:'', high:'',low:'',notice:'',type:'', quality:'',wendu:''};
    Get(request: Request, response: Response, next: () => void): void
    {
        fetch('http://t.weather.itboy.net/api/weather/city/101010100', { headers:{'Content-Type':'text/plain'}}).then(res =>
        {
            if (res.status == 200) {
                return res.json();
            }
        }).then(data=>{
            this.info = data['data']['forecast'][0];
            this.info.quality = data['data']['quality'];
            this.info.wendu = data['data']['wendu'];
            // console.log(this.info);
            response.setHeader('Content-Type','application/json');
            response.End(this.info);
        }).catch(()=>{response.End();});
    }
}

interface Affair
{
    date:string;
    titile:string;
    urgency:number;
    message:string;
}
interface UserInfo 
{
    affairs:Affair[];
}
const users = new Map<string, UserInfo>();
users.set('LingDar77', 
    {
        affairs:[
            {
                date:'2022/10/20', 
                titile:'采购', 
                message:'整点零食，买点水果，找群友v50吃肯德基', 
                urgency:4
            },
            {
                date:'2022/10/20', 
                titile:'DDL', 
                message:'别摸鱼了，再摸人没了，你这个点还敢摸鱼？', 
                urgency:4
            },
            { date:'2022/10/21', 
                titile:'p5r', 
                message:'p5rp5rp5rp5rp5rp5rp5r', 
                urgency:3
            }
        ]
    });

@DefineRouter('/api/loginTest')
class LoginTestRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        if(request.postParams.userName)
        {
            response.End({registered:users.has(request.postParams.userName)});
        }
        else
        {
            response.End(404);
        }
    }
}

@DefineRouter('/api/login')
class LoginRouter extends RouterBase
{
    Post(request: Request, response: Response, next: () => void): void
    {
        if(request.postParams.userName && request.postParams.password)
        {
            if(!users.has(request.postParams.userName))
            {
                users.set(request.postParams.userName,{affairs:[]});
            }
            response.End(users.get(request.postParams.userName));
        }
        else
        {
            next();
        }
    }
}

const server = app.StartServer(cm);
console.clear();
console.log('Server started running at: http://localhost:8080');
app.Watch(server, __filename);