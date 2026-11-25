export const OPEN_COLOR = '#39734A';
export const CLOSED_COLOR = '#A13D32';

/**
 * "Abierto" / "Cerrado" con su color. null si Google no tiene el horario:
 * en el mapa no se muestra nada en ese caso, para no recargarlo.
 */
export function getOpenStatus(
    isOpen: boolean | null
): { label: string; color: string } | null
{
    if (isOpen === null)
    {
        return null;
    }

    return isOpen
        ? { label: 'Abierto', color: OPEN_COLOR }
        : { label: 'Cerrado', color: CLOSED_COLOR };
}
