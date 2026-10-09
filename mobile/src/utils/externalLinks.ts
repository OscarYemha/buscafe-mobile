
export type ExternalLinkType =
    | 'instagram'
    | 'facebook'
    | 'tiktok'
    | 'whatsapp'
    | 'menu'
    | 'website';

export type ExternalLinkInfo = {
    type: ExternalLinkType;
    label: string;
    icon: string;
    url: string;
};

function matchesDomain(
    hostname: string,
    domain: string
): boolean {
    return (
        hostname === domain ||
        hostname.endsWith(`.${domain}`)
    );
}

export function classifyExternalLink(
    value: string
): ExternalLinkInfo | null {
    const input = value.trim();

    if (!input) {
        return null;
    }

    try {
        const url = new URL(input);

        if (
            url.protocol !== 'https:' &&
            url.protocol !== 'http:'
        ) {
            return null;
        }

        const hostname = url.hostname.toLowerCase();

        if (matchesDomain(hostname, 'instagram.com')) {
            return {
                type: 'instagram',
                label: 'Instagram',
                icon: '📸',
                url: url.toString(),
            };
        }

        if (
            matchesDomain(hostname, 'facebook.com') ||
            matchesDomain(hostname, 'fb.com') ||
            matchesDomain(hostname, 'fb.me')
        ) {
            return {
                type: 'facebook',
                label: 'Facebook',
                icon: '📘',
                url: url.toString(),
            };
        }

        if (matchesDomain(hostname, 'tiktok.com')) {
            return {
                type: 'tiktok',
                label: 'TikTok',
                icon: '🎵',
                url: url.toString(),
            };
        }

        if (
            matchesDomain(hostname, 'wa.me') ||
            matchesDomain(hostname, 'whatsapp.com')
        ) {
            return {
                type: 'whatsapp',
                label: 'WhatsApp',
                icon: '💬',
                url: url.toString(),
            };
        }

        if (matchesDomain(hostname, 'menusa.app')) {
            return {
                type: 'menu',
                label: 'Ver menú',
                icon: '📋',
                url: url.toString(),
            };
        }

        return {
            type: 'website',
            label: 'Sitio web',
            icon: '🌐',
            url: url.toString(),
        };
    } catch {
        return null;
    }
}
