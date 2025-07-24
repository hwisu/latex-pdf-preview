export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): T {
    let timeout: NodeJS.Timeout | undefined;

    return ((...args: Parameters<T>) => {
        const later = () => {
            timeout = undefined;
            func(...args);
        };

        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    }) as T;
}