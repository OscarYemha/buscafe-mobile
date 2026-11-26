import { CLOSED_COLOR, getOpenStatus, OPEN_COLOR } from './openStatus';

describe('getOpenStatus', () =>
{
    it('abierto en verde y cerrado en rojo', () =>
    {
        expect(getOpenStatus(true)).toEqual({ label: 'Abierto', color: OPEN_COLOR });
        expect(getOpenStatus(false)).toEqual({ label: 'Cerrado', color: CLOSED_COLOR });
    });

    it('sin horario no muestra nada', () =>
    {
        expect(getOpenStatus(null)).toBeNull();
    });
});
