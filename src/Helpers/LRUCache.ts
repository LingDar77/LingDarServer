export class LRUCache<Key, Value>
{
    private cache = new Map<Key, Value>();
    constructor(private size?: number) { }

    Set(key: Key, value: Value)
    {
        const val = this.cache.get(key);
        if (typeof val != 'undefined') {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        else {
            this.cache.set(key, value);
            if (this.size)
                if (this.cache.size > this.size) {
                    const lastKey = () =>
                    {
                        for (const k of this.cache.keys()) {
                            return k;
                        }
                        throw new Error('Invalid Operation');
                    };
                    this.cache.delete(lastKey());
                }

        }
    }
    Get(key: Key)
    {
        const val = this.cache.get(key);
        if (typeof val != 'undefined') {
            this.cache.delete(key);
            this.cache.set(key, val);
            return val;
        }

    }
    Size()
    {
        return this.cache.size;
    }
    [Symbol.iterator]()
    {
        return this.cache[Symbol.iterator]();
    }
    Pop()
    {
        let key = this.cache.keys().next().value;
        let val = this.cache.get(key);
        if (key) {
            this.cache.delete(key);
            return { key: key, val: val };
        }

    }
    Remove(key: Key)
    {
        this.cache.delete(key);
    }
}


export default LRUCache;