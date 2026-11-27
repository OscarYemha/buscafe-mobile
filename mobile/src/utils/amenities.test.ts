import { describeAmenity } from './amenities';

describe('describeAmenity', () =>
{
    it('mayoría de sí, mayoría de no y empate', () =>
    {
        expect(describeAmenity({ yesCount: 8, responsesCount: 10 })).toBe('Sí · 8 de 10 personas dicen que sí');
        expect(describeAmenity({ yesCount: 2, responsesCount: 6 })).toBe('No · 2 de 6 personas dicen que sí');
        expect(describeAmenity({ yesCount: 2, responsesCount: 4 })).toBe('2 de 4 personas dicen que sí');
    });

    it('con una sola respuesta lo dice en singular', () =>
    {
        expect(describeAmenity({ yesCount: 1, responsesCount: 1 })).toBe('Sí · 1 persona dice que sí');
        expect(describeAmenity({ yesCount: 0, responsesCount: 1 })).toBe('No · 1 persona dice que no');
    });

    it('sin respuestas (o sin el dato del server) no muestra nada', () =>
    {
        expect(describeAmenity({ yesCount: 0, responsesCount: 0 })).toBeNull();
        expect(describeAmenity(undefined)).toBeNull();
    });
});
