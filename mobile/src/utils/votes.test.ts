import { formatVotes } from './votes';

describe('formatVotes', () =>
{
    it('en singular y en plural', () =>
    {
        expect(formatVotes(1)).toBe(' · 1 voto');
        expect(formatVotes(12)).toBe(' · 12 votos');
    });

    it('sin dato no agrega nada', () =>
    {
        expect(formatVotes(undefined)).toBe('');
        expect(formatVotes(0)).toBe('');
    });
});
