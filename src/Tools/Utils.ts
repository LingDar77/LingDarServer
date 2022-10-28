
type ReturnType<T> = T extends (...args: never[]) => infer R ? R : unknown;
type ParamsType<T> = T extends (...args: infer P) => unknown ? P : unknown;
export type Constructor<T> = { new(...args: never[]): T };

export const classes = new Array<Constructor<unknown>>;

/**
 * Force the given function to run one time via given time
 * @param f the function
 * @param threshold the time
 * @returns the debounced function
 */
export function Debounce<T extends unknown[]>(f: (...args: T) => unknown, threshold = 1000)
{
    let timer: NodeJS.Timeout;
    return (...args: ParamsType<typeof f>) =>
    {

        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() =>
        {
            f(...args);
        }, threshold);
    };
}

/**
 * Format the given date into given pattern
 * @param date the date to format
 * @param format the patern to apply, like yyyy-mm-dd
 * @returns the desired pattern string
 */
export function FormatDate(date: Date, format = 'yyyy-mm-dd')
{
    format = format.toLowerCase();
    const parts = date.toLocaleDateString().split('/');
    let result = format.replace('yyyy', parts[0]);
    result = result.replace('mm', parts[1].length == 1 ? 0 + parts[1] : parts[1]);
    result = result.replace('dd', parts[2].length == 1 ? 0 + parts[2] : parts[2]);
    return result;
}

/**
 * Declare that class may need to be deserialized
 */
export function DeclareClass()
{
    return declareClass;
}

/**
 * Declare that class may need to be deserialized
 */
export const declareClass = <T>(constructor: Constructor<T>) =>
{
    classes.push(constructor);
};

/**
 * Serialize the given object into json string
 * @param obj the object to be serialized
 * @returns the result json string
 */
export function Serialize<T extends object>(obj: T): string
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

    return JSON.stringify(obj, (key, val) =>
    {

        if (key == '' && val instanceof Object) {
            if (val instanceof Map) {
                return {
                    classType: 'Map',
                    values: Array.from(val.entries())
                };
            }
            const vals = {};
            for (const key in val) {
                if (typeof val[key] != 'object')
                    vals[key as keyof typeof vals] = val[key] as never;
                else {
                    vals[key as keyof typeof vals] = JSON.parse(Serialize(val[key])) as never;
                }
            }
            return { classType: obj.constructor.name, values: vals };
        }
        else {
            return val;
        }
    });

}

/**
 * Deserialize the given json to sertain object, all relative classes need to be declared before(self included)
 * @param constructor the constructor of target object
 * @param json the json string of object
 * @returns the reuslt object
 */
export function Deserialize<T extends object>(constructor: Constructor<T>, json: string)
{
    new constructor();
    return JSON.parse(json, (key, val) =>
    {

        if (val.classType == 'Map') {
            return new Map(val.values);
        }
        if (val.classType == 'Array') {
            const arr = new Array<unknown>();
            for (const key in val.values) {
                arr.push(val.values[key]);
            }
            return arr;
        }
        if (typeof val == 'object' && val != null) {
            if (val instanceof Array || val instanceof Map) {
                return val;
            }
            const constructor = classes.find(item => item.name == val.classType);
            if (constructor) {
                const obj = new constructor() as object;
                for (const key in val.values) {
                    obj[key as keyof typeof obj] = val.values[key] as never;
                }
                return obj;
            }
            return val;
        }
        return val;
    }) as T;
}

/**
 * Mesure the run time of the given function
 * @param f the function that will be measured
 * @returns the mesurement function, that returns the reuslt as milliseconds
 */
export function Measurement<T extends unknown[]>(f: (...args: T) => unknown)
{
    return (...args: ParamsType<typeof f>) =>
    {
        const timeStamp1 = new Date().getTime();
        f(...args);
        const timeStamp2 = new Date().getTime();
        return timeStamp2 - timeStamp1;
    };
}
