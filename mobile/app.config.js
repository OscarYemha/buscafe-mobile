module.exports = {
    expo: {
        name: 'BusCafé',
        slug: 'buscafe',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/buscafe-icon.png',
        userInterfaceStyle: 'light',

        plugins: [
            [
                'expo-splash-screen',
                {
                    image: './assets/buscafe-splash-leyenda-fiel.png',
                    imageWidth: 280,
                    resizeMode: 'contain',
                    backgroundColor: '#F3E4C8',
                },
            ],
            'expo-secure-store',
        ],

        ios: {
            supportsTablet: true,
        },

        android: {
            predictiveBackGestureEnabled: false,
            package: 'com.oscaryemha.buscafe',

            config: {
                googleMaps: {
                    apiKey:
                        process.env
                            .GOOGLE_MAPS_ANDROID_API_KEY,
                },
            },
        },

        web: {
            favicon: './assets/favicon.png',
        },

        /*
         * EAS Update: los cambios de JavaScript llegan por aire a los APK
         * instalados, sin buildear de nuevo. Con la política "fingerprint"
         * el runtime cambia solo cuando cambia algo nativo, así una
         * actualización nunca le llega a un APK incompatible.
         */
        updates: {
            url: 'https://u.expo.dev/6395df3e-972a-41a5-a83f-aaba181d7a03',
        },

        runtimeVersion: {
            policy: 'fingerprint',
        },

        extra: {
            eas: {
                projectId:
                    '6395df3e-972a-41a5-a83f-aaba181d7a03',
            },
        },
    },
};