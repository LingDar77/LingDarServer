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
