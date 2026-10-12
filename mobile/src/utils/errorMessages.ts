export function getErrorMessage(
    error: unknown,
    fallback: string = 'Ocurrió un error inesperado. Intentá nuevamente.'
): string
{
    if (!(error instanceof Error))
    {
        return fallback;
    }

    const message = error.message.trim();

    if (
        /network request failed|failed to fetch|networkerror|internet connection|internet appears to be offline|timed out|timeout/i.test(message)
    )
    {
        return 'No pudimos conectarnos. Comprobá tu conexión a Internet e intentá nuevamente.';
    }

    if (
        !message ||
        /^(undefined|null|unknown error|internal server error)$/i.test(message)
    )
    {
        return fallback;
    }

    return message;
}