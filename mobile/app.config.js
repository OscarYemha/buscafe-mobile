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
                    image:
                        './assets/buscafe-splash-transparent.png',
                    imageWidth: 315,
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

        extra: {
            eas: {
                projectId:
                    '6395df3e-972a-41a5-a83f-aaba181d7a03',
            },
        },
    },
};