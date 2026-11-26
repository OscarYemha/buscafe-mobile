import { sortCafes } from './sortCafes';
import { makeCafe } from '../test/factories';

const names = (cafes: { name: string }[]) => cafes.map((cafe) => cafe.name);

describe('sortCafes', () =>
{
    it('por distancia: el más cercano primero y los sin distancia al final', () =>
    {
        const cafes = [
            makeCafe({ name: 'lejos', distanceKm: 3 }),
            makeCafe({ name: 'sin distancia', distanceKm: null }),
            makeCafe({ name: 'cerca', distanceKm: 0.2 }),
        ];

        expect(names(sortCafes(cafes, 'distance'))).toEqual(['cerca', 'lejos', 'sin distancia']);
    });

    it('por puntuación de Google: la mayor primero y los sin puntuación al final', () =>
    {
        const cafes = [
            makeCafe({ name: 'sin', googleRating: null }),
            makeCafe({ name: '4.2', googleRating: 4.2 }),
            makeCafe({ name: '4.8', googleRating: 4.8 }),
        ];

        expect(names(sortCafes(cafes, 'google'))).toEqual(['4.8', '4.2', 'sin']);
    });

    it('por puntuación de BusCafé usa buscafeRating, no la de Google', () =>
    {
        const cafes = [
            makeCafe({ name: 'a', googleRating: 5, buscafeRating: 3 }),
            makeCafe({ name: 'b', googleRating: 3, buscafeRating: 4.5 }),
        ];

        expect(names(sortCafes(cafes, 'buscafe'))).toEqual(['b', 'a']);
    });

    it('con la misma puntuación desempata por distancia', () =>
    {
        const cafes = [
            makeCafe({ name: 'lejos', googleRating: 4.5, distanceKm: 2 }),
            makeCafe({ name: 'cerca', googleRating: 4.5, distanceKm: 0.5 }),
        ];

        expect(names(sortCafes(cafes, 'google'))).toEqual(['cerca', 'lejos']);
    });

    it('no modifica la lista original', () =>
    {
        const cafes = [makeCafe({ distanceKm: 2 }), makeCafe({ distanceKm: 1 })];
        const original = [...cafes];

        sortCafes(cafes, 'distance');

        expect(cafes).toEqual(original);
    });
});
