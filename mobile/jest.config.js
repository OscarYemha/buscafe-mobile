/*
 * Tests de lógica de mobile: `npx jest` en mobile/.
 *
 * La configuración va acá y no en package.json, y no hay script "test",
 * a propósito: los scripts de package.json entran en el fingerprint de EAS
 * y cambiarlos dejaría a los APK instalados sin actualizaciones por aire.
 */
module.exports = {
    preset: 'jest-expo',
    testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
    clearMocks: true,
};
