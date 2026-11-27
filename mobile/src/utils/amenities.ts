/** Respuestas de la comunidad a una pregunta de sí o no (Wi-Fi, enchufes). */
export type AmenityStats = {
    yesCount: number;
    responsesCount: number;
};

/**
 * "Sí · 8 de 10 personas dicen que sí". null si nadie respondió (o si el
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

    const answer =
        ratio > 0.5 ? 'Sí' : ratio < 0.5 ? 'No' : 'Opiniones divididas';

    const people = responsesCount === 1
        ? '1 persona dice'
        : `${yesCount} de ${responsesCount} personas dicen`;

    return responsesCount === 1
        ? `${answer} · ${people} que ${yesCount === 1 ? 'sí' : 'no'}`
        : `${answer} · ${people} que sí`;
}
