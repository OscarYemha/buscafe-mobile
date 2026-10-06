import { CafeSummary } from "../types/CafeSummary";
import { CafeDetail } from "../types/CafeDetail";
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const API_URL =
    process.env.EXPO_PUBLIC_API_URL ??
    'http://localhost:3001';

export type CafeSearchResult = {
    cafes: CafeSummary[];
    nextPageToken: string | null;
    resolvedQuery: string;
}

export async function getCafes() 
{
    const response = await fetch(`${API_URL}/cafes`);
    
    if (!response.ok)
    {
        throw new Error(
            'No se pudieron obtener las cafeterías'
        );
    }

    return response.json();
}

export async function getNearbyCafes(
    latitude: number,
    longitude: number,
    intent?: string
): Promise<CafeSummary[]>
{
    const intentQuery =
        intent
            ? `&intent=${encodeURIComponent(intent)}`
            : '';

    const response = await fetch(
        `${API_URL}/cafes/nearby` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        intentQuery
    );

    if (!response.ok)
    {
        throw new Error('No se pudieron obtener las cafeterías cercanas');
    }

    return response.json();
}

export async function searchCafes(
    query: string,
    pageToken?: string,
    resolvedQuery?: string,
    latitude?: number,
    longitude?: number
): Promise<CafeSearchResult>
{
    const params =
        new URLSearchParams({
            query,
        });

    if (pageToken && resolvedQuery)
    {
        params.set(
            'pageToken',
            pageToken
        );

        params.set(
            'resolvedQuery',
            resolvedQuery
        );
    }

    if (latitude !== undefined && longitude !== undefined
    )
    {
        params.set('latitude', latitude.toString());

        params.set('longitude', longitude.toString());
    }

    const response = await fetch(
        `${API_URL}/cafes/search?${params.toString()}`
    );

    if (!response.ok)
    {
        throw new Error(
            'No se pudieron buscar cafeterías'
        );
    }

    return response.json();
}

export async function getCafeDetails(
    googlePlaceId: string
): Promise<CafeDetail>
{
    const response = await fetch(
        `${API_URL}/cafes/place/` +
        `${encodeURIComponent(googlePlaceId)}`
    );

    if (!response.ok)
    {
        throw new Error(
            'No se pudo obtener el detalle de la cafetería'
        );
    }

    return response.json();
}

export type CreateReviewData = {
    googlePlaceId: string;
    cafeName: string;
    cafeAddress: string;
    cafeLatitude: number;
    cafeLongitude: number;

    rating: number;
    comment: string;

    coffeeRating?: number;
    foodRating?: number;
    serviceRating?: number;
    comfortRating?: number;
    quietRating?: number;

    goodForWork?: boolean;
    goodForStudy?: boolean;
    goodForDate?: boolean;
};

export async function createReview(
    data: CreateReviewData
) {
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para publicar una reseña');
    }

    const response = await fetch(
        `${API_URL}/reviews`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        }
    );

    if (!response.ok)
    {
        throw new Error(
            'No se pudo publicar la reseña'
        );
    }

    return response.json();
}

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
};

export type LoginResponse = {
    token: string;
    user: AuthUser;
};

export class EmailVerificationRequiredError extends Error
{
    constructor()
    {
        super('Tenés que verificar tu email antes de iniciar sesión');

        this.name = 'EmailVerificationRequiredError';
    }
}

export type RegisterResponse = {
    requiresEmailVerification: true;
    user: AuthUser;
};

export type RegisterData = {
    name: string;
    email: string;
    password: string;
}

export async function registerUser(
    data: RegisterData
): Promise<RegisterResponse>
{
    const response = await fetch(
        `${API_URL}/users`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        }
    );

    if (!response.ok)
    {
        const responseData = await response.json();

        throw new Error(
            responseData.error ??
            'No se pudo crear la cuenta'
        );
    }

    return response.json();
}

export async function loginUser(
    email: string,
    password: string
): Promise<LoginResponse>
{
    const response = await fetch(
        `${API_URL}/users/login`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password
            }),
        }
    );

    if (!response.ok)
    {
        const data = await response.json();

        if (response.status === 403 &&
            data.requiresEmailVerification === true
        )
        {
            throw new EmailVerificationRequiredError();
        }

        throw new Error(
            data.error ??
            'No se pudo iniciar sesión'
        );
    }

    return response.json();
}

export async function verifyEmail(
    email: string,
    code: string
): Promise<LoginResponse>
{
    const response = await fetch(
        `${API_URL}/users/verify-email`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                code,
            }),
        }
    );

    if (!response.ok)
    {
        const data = await response.json();

        throw new Error(
            data.error ??
            'No se pudo verificar el email'
        );
    }

    return response.json();
}

export async function resendVerificationEmail(
    email: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/resend-verification`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
            }),
        }
    );

    if (!response.ok)
    {
        const data = await response.json();

        throw new Error(
            data.error ??
            'No se pudo reenviar el código'
        );
    }
}

export async function getCurrentUser(
    token: string
): Promise<AuthUser> 
{
    const response = await fetch(
        `${API_URL}/users/me`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    
    if (!response.ok)
    {
        throw new Error('No se pudo restaurar la sesión');
    }

    return response.json();
}

export async function updateProfile(
    token: string,
    name: string
): Promise<AuthUser>
{
    const response = await fetch(
        `${API_URL}/users/me`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                name,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo actualizar el perfil'
        );
    }

    return data;
}

export async function changePassword(
    token: string,
    currentPassword: string,
    newPassword: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/me/password`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo actualizar la contraseña'
        );
    }
}

export async function deleteAccount(
    token: string,
    password: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/me`,
        {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                password,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo eliminar la cuenta'
        );
    }
}

export async function requestPasswordReset(
    email: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/password-reset/request`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo iniciar la recuperación de contraseña'
        );
    }
}

export async function confirmPasswordReset(
    email: string,
    code: string,
    newPassword: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/password-reset/confirm`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                code,
                newPassword,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo restablecer la contraseña'
        );
    }
}

export async function requestEmailChange(
    token: string,
    email: string
): Promise<void>
{
    const response = await fetch(
        `${API_URL}/users/me/email-change`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                email,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo solicitar el cambio de email'
        );
    }
}

export async function verifyEmailChange(
    token: string,
    code: string
): Promise<AuthUser>
{
    const response = await fetch(
        `${API_URL}/users/me/email-change/verify`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                code,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo verificar el nuevo email'
        );
    }

    return data;
}

export async function uploadAvatar(
    token: string,
    imageUri: string
): Promise<AuthUser>
{
    const uploadResult =
        await FileSystem.uploadAsync(
            `${API_URL}/users/me/avatar`,
            imageUri,
            {
                httpMethod: 'PATCH',
                uploadType:
                    FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'avatar',
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                },
            }
        );

    const data =
        uploadResult.body
            ? JSON.parse(uploadResult.body)
            : {};

    if (
        uploadResult.status < 200 ||
        uploadResult.status >= 300
    )
    {
        throw new Error(
            data.error ??
            'No se pudo actualizar la foto de perfil'
        );
    }

    return data;
}

export type FavoriteCafe = {
    id: number;
    googlePlaceId: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    createdAt: string;
};

export type Favorite = {
    id: number;
    createdAt: string;
    cafe: FavoriteCafe;
};

export type AddFavoriteData = {
    googlePlaceId: string;
    cafeName: string;
    cafeAddress: string;
    cafeLatitude: number;
    cafeLongitude: number;
};

export async function getFavorites(): Promise<Favorite[]>
{
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para ver tus favoritos');
    }

    const response = await fetch(
        `${API_URL}/favorites`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok)
    {
        throw new Error('No se pudieron obtener los favoritos');
    }

    return response.json();
}

export async function addFavorite(
    data: AddFavoriteData
): Promise<Favorite>
{
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para agregar favoritos');
    }

    const response = await fetch(
        `${API_URL}/favorites`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        }
    );

    if (!response.ok)
    {
        throw new Error('No se pudo agregar a favoritos');
    }
    
    return response.json();
}

export async function removeFavorite(
    googlePlaceId: string
): Promise<void>
{
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para quitar favoritos');
    }

    const response = await fetch(
        `${API_URL}/favorites/${encodeURIComponent(googlePlaceId)}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok)
    {
        throw new Error('No se pudo quitar de favoritos');
    }
}