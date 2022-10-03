export function debounce(f: (...args: any[]) => void, threshold = 1000)
{
    let timer: NodeJS.Timeout;
    return (...args: any[]) =>
    {
        
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() =>
        {
            f(...args);
        }, threshold);
    }
}