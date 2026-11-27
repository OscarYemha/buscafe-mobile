/** " · 12 votos" / " · 1 voto". Vacío si no hay dato (server viejo). */
export function formatVotes(count: number | undefined): string
{
    if (count === undefined || count < 1)
    {
        return '';
    }

    return count === 1 ? ' · 1 voto' : ` · ${count} votos`;
}
