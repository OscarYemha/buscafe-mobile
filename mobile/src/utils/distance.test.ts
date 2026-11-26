import { calculateDistanceKm, calculateDistanceMeters, formatDistance } from './distance';

const OBELISCO = { latitude: -34.6037, longitude: -58.3816 };
const PALERMO = { latitude: -34.5780655, longitude: -58.4265317 };
const MADRID = { latitude: 40.4168, longitude: -3.7038 };

describe('calculateDistanceKm', () =>
{
    it('da distancias conocidas', () =>
    {
        expect(calculateDistanceKm(OBELISCO, PALERMO)).toBeCloseTo(5.0, 1);
        expect(calculateDistanceKm(OBELISCO, MADRID)).toBeCloseTo(10045, -1);
    });

    it('es simétrica y vale 0 en el mismo punto', () =>
    {
        expect(calculateDistanceKm(PALERMO, OBELISCO)).toBeCloseTo(calculateDistanceKm(OBELISCO, PALERMO), 6);
        expect(calculateDistanceMeters(OBELISCO, OBELISCO)).toBe(0);
    });

    it('metros y kilómetros son consistentes', () =>
    {
        expect(calculateDistanceMeters(OBELISCO, PALERMO)).toBeCloseTo(calculateDistanceKm(OBELISCO, PALERMO) * 1000, 3);
    });
});

describe('formatDistance', () =>
{
    it('menos de 1 km en metros redondeados', () =>
    {
        expect(formatDistance(0.3456)).toBe('346 m');
    });

    it('desde 1 km con un decimal', () =>
    {
        expect(formatDistance(1)).toBe('1.0 km');
        expect(formatDistance(2.345)).toBe('2.3 km');
    });

    it('sin distancia lo avisa', () =>
    {
        expect(formatDistance(null)).toBe('Distancia no disponible');
    });
});
