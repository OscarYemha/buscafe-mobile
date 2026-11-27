/** Respuestas de la comunidad a una pregunta de sí o no (Wi-Fi, enchufes). */
export type AmenityStats = {
    yesCount: number;
    responsesCount: number;
};

/**
 * "Sí · 8 de 10 personas dicen que sí". Con empate, solo la cantidad
 * ("2 de 4 personas dicen que sí"). null si nadie respondió (o si el
 * server todavía no manda el dato).
 */
export function describeAmenity(stats: AmenityStats | undefined): string | null
{
    if (!stats || stats.responsesCount === 0)
    {
        return null;
    }

    const { yesCount, responsesCount } = stats;
    const ratio = yesCount / responsesCount;

    if (responsesCount === 1)
    {
        return yesCount === 1
            ? 'Sí · 1 persona dice que sí'
            : 'No · 1 persona dice que no';
    }

    const count = `${yesCount} de ${responsesCount} personas dicen que sí`;

    if (ratio === 0.5)
    {
        return count;
    }

    return `${ratio > 0.5 ? 'Sí' : 'No'} · ${count}`;
}
