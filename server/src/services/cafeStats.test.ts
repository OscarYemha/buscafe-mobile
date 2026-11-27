import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {} }));
vi.mock('../lib/prisma', () => ({ default: {} }));

import { countAnswers } from './cafeStats.js';

describe('countAnswers (Wi-Fi y enchufes)', () =>
{
    it('cuenta los sí y las respuestas, sin contar a quien no respondió', () =>
    {
        expect(countAnswers([true, true, false, null, true, null])).toEqual({
            yesCount: 3,
            responsesCount: 4,
        });
    });

    it('sin respuestas da cero', () =>
    {
        expect(countAnswers([])).toEqual({ yesCount: 0, responsesCount: 0 });
        expect(countAnswers([null, null])).toEqual({ yesCount: 0, responsesCount: 0 });
    });
});
