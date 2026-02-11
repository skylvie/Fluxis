/**
 * Wraps Discord event handlers to prevent unhandled promise rejections from crashing the bot.
 *
 * Discord.js emits events rapidly and a single uncaught error would terminate the process.
 * This wrapper ensures errors are logged but don't bubble up to crash the selfbot.
 *
 * @param fn - The async event handler to wrap
 * @param errorContext - Descriptive name for logging (e.g., "onMessageCreate")
 * @returns A wrapped version of the handler that catches and logs errors
 */
export function safeExecute<T extends unknown[]>(
    fn: (...args: T) => Promise<void>,
    errorContext: string
): (...args: T) => Promise<void> {
    return async (...args: T): Promise<void> => {
        try {
            await fn(...args);
        } catch (err) {
            console.error(`Error in ${errorContext}:`, err);
        }
    };
}
