import { type } from 'os';

export function debounce(f: (...args: unknown[]) => void, threshold = 1000)
{
    let timer: NodeJS.Timeout;
    return (...args: unknown[]) =>
    {
        
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() =>
        {
            f(...args);
        }, threshold);
    };
}

export function formatDate(date: Date, format = 'yyyy-mm-dd')
{
    format = format.toLowerCase();
    const parts = date.toLocaleDateString().split('/');
    let result = format.replace('yyyy', parts[0]);
    result = result.replace('mm', parts[1].length == 1 ? 0 + parts[1] : parts[1]);
    result = result.replace('dd', parts[2].length == 1 ? 0 + parts[2] : parts[2]);
    return result;
}

export type Constructor<T> = {new():T};

export const classes = new Array<Constructor<unknown>>;

export function DefineClass()
{
    console.log('defineclass');
    
    return <T>(constructor: {new():T}) =>
    {
        classes.push(constructor);
    };
}

export const defineClass = <T>(constructor: Constructor<T>) =>
{
    console.log('define');
    
    classes.push(constructor);
};

export function Serialize<T extends object>(obj:T):string
{
    // const constructor = obj.constructor as {new():T};
    /**
     * {
     * DataType:"Asd",
     * values:{
     *  "asd":213,
     *  "OOO":{
     *  DataType:"das",
     *  values:{
     *  "dsa":213
     * }
     * }
     * }
     * }
     */

    return JSON.stringify(obj, (key, val)=>{

        if(key == '' && val instanceof Object)
        {   
            if(val instanceof Map)
            {
                return {
                    classType: 'Map',
                    values: Array.from(val.entries())
                };
            }
            const vals = {};
            for(const key in val)
            {
                if(typeof val[key] != 'object')
                    vals[key as keyof typeof vals] = val[key] as never;
                else
                {
                    vals[key as keyof typeof vals] = JSON.parse(Serialize(val[key])) as never;
                }
            }
            return {classType:obj.constructor.name, values:vals};
        }
        else
        {
            return val;
        }
    });
    
}

export function Deserialize<T extends object>(constructor:Constructor<T>, json:string)
{
    new constructor();
    return JSON.parse(json, (key,val)=>{

        if(val.classType == 'Map')
        {
            return new Map(val.values);
        }
        if(val.classType == 'Array')
        {
            const arr = new Array<unknown>();
            for(const key in val.values)
            {
                arr.push(val.values[key]);
            }
            return arr;
        }
        if(typeof val =='object' && val != null)
        {
            if(val instanceof Array || val instanceof Map)
            {
                return val;
            }
            const constructor = classes.find(item=>item.name == val.classType);
            if(constructor)
            { 
                const obj = new constructor() as object;
                for(const key in val.values)
                {
                    obj[key as keyof typeof obj] = val.values[key] as never;
                }
                return obj;
            }
            return val;
        }
        return val;
    })as T;
}