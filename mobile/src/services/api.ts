import { CafeSummary } from "../types/CafeSummary";
import { CafeDetail } from "../types/CafeDetail";
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { apiErrorFromResponse } from './apiError';
import { Zone, ZoneSuggestion } from '../types/Zone';

const API_URL =
    process.env.EXPO_PUBLIC_API_URL ??
    'http://localhost:3001';

export type CafeSearchResult = {
    cafes: CafeSummary[];
    nextPageToken: string | null;
    resolvedQuery: string;
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

/**
 * Sugerencias de zonas (barrios, ciudades) para "Elegir zona".
 * `sessionToken` agrupa en Google las consultas de una misma búsqueda;
 * `near` prioriza las zonas cercanas al usuario.
 */
export async function searchZones(
    query: string,
    sessionToken: string,
    near?: { latitude: number; longitude: number }
): Promise<ZoneSuggestion[]>
{
    const params = new URLSearchParams({ query, sessionToken });

    if (near)
    {
        params.set('latitude', String(near.latitude));
        params.set('longitude', String(near.longitude));
    }

    const response = await fetch(`${API_URL}/zones?${params}`);

    if (!response.ok)
    {
        throw await apiErrorFromResponse(
            response,
            'No se pudieron buscar zonas'
        );
    }

    const data: { zones: ZoneSuggestion[] } = await response.json();

    return data.zones;
}

/** Coordenadas de la zona elegida. Cierra la sesión de búsqueda. */
export async function getZone(
    placeId: string,
    sessionToken: string
): Promise<Zone>
{
    const params = new URLSearchParams({ sessionToken });

    const response = await fetch(
        `${API_URL}/zones/${encodeURIComponent(placeId)}?${params}`
    );

    if (!response.ok)
    {
        throw await apiErrorFromResponse(
            response,
            'No se pudo obtener la zona'
        );
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

    hasWifi?: boolean;
    hasPowerOutlets?: boolean;

    idempotencyKey: string;
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

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        throw await apiErrorFromResponse(
            response,
            'No se pudo publicar la reseña'
        );
    }

    return response.json();
}

/*
 * Edición: reemplaza todo el contenido. Lo que falte (undefined) queda
 * vacío en el server, igual que en el alta.
 */
export type UpdateReviewData = Omit<
    CreateReviewData,
    'googlePlaceId' | 'cafeName' | 'cafeAddress' | 'cafeLatitude' | 'cafeLongitude' | 'idempotencyKey'
>;

async function sendReviewChange(
    reviewId: number,
    method: 'PATCH' | 'DELETE',
    fallbackMessage: string,
    data?: UpdateReviewData
): Promise<Response>
{
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para cambiar tus reseñas');
    }

    const response = await fetch(
        `${API_URL}/reviews/${reviewId}`,
        {
            method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json' } : {}),
                Authorization: `Bearer ${token}`,
            },
            body: data ? JSON.stringify(data) : undefined,
        }
    );

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        throw await apiErrorFromResponse(response, fallbackMessage);
    }

    return response;
}

export async function updateReview(
    reviewId: number,
    data: UpdateReviewData
): Promise<void>
{
    await sendReviewChange(reviewId, 'PATCH', 'No se pudo guardar la reseña', data);
}

export async function deleteReview(reviewId: number): Promise<void>
{
    await sendReviewChange(reviewId, 'DELETE', 'No se pudo borrar la reseña');
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

export class InvalidSessionError extends Error
{
    constructor()
    {
        super('Tu sesión venció. Iniciá sesión nuevamente.');

        this.name = 'InvalidSessionError';
    }
}

export function isInvalidSessionError(
    error: unknown
): error is InvalidSessionError
{
    return (
        error instanceof InvalidSessionError ||
        (
            error instanceof Error &&
            error.name === 'InvalidSessionError'
        )
    );
}

/*
 * Quien maneja la sesión (AuthContext) registra acá qué hacer cuando el
 * servidor rechaza un token. Recibe el token rechazado para no cerrar
 * una sesión más nueva si el 401 corresponde a un request viejo.
 */
type InvalidSessionHandler = (rejectedToken: string) => void | Promise<void>;

let invalidSessionHandler: InvalidSessionHandler | null = null;

export function setInvalidSessionHandler(
    handler: InvalidSessionHandler | null
): void
{
    invalidSessionHandler = handler;
}

/**
 * Para requests autenticados: ante un 401 avisa al handler de sesión y
 * tira InvalidSessionError. El server usa 401 solo para sesión inválida
 * (la contraseña incorrecta en /me/password y DELETE /me es 403).
 */
async function throwIfUnauthorized(
    status: number,
    token: string
): Promise<void>
{
    if (status !== 401)
    {
        return;
    }

    try
    {
        await invalidSessionHandler?.(token);
    }
    catch (error)
    {
        console.error(
            'Error al cerrar la sesión inválida:',
            error
        );
    }

    throw new InvalidSessionError();
}

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
    let response: Response;

    try
    {
        response = await fetch(
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
    }
    catch
    {
        throw new Error(
            'No pudimos conectar con el servidor. Revisá tu conexión a Internet e intentá nuevamente.'
        );
    }

    if (response.status >= 500)
    {
        throw new Error(
            'El servidor no está disponible en este momento. Intentá nuevamente en unos minutos.'
        );
    }

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
    
    await throwIfUnauthorized(response.status, token);

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

    await throwIfUnauthorized(response.status, token);

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
): Promise<string>
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

    await throwIfUnauthorized(response.status, token);

    const data = await response.json();

    if (!response.ok)
    {
        throw new Error(
            data.error ??
            'No se pudo actualizar la contraseña'
        );
    }

    return data.token;
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

    await throwIfUnauthorized(response.status, token);

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

    await throwIfUnauthorized(response.status, token);

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

    await throwIfUnauthorized(response.status, token);

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

    await throwIfUnauthorized(uploadResult.status, token);

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

export type MyReview = {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;
    editedAt: string | null;

    coffeeRating: number | null;
    foodRating: number | null;
    serviceRating: number | null;
    comfortRating: number | null;
    quietRating: number | null;

    goodForWork: boolean | null;
    goodForStudy: boolean | null;
    goodForDate: boolean | null;

    hasWifi: boolean | null;
    hasPowerOutlets: boolean | null;

    cafe: {
        googlePlaceId: string;
        name: string;
        address: string;
    };
};

/** Reseñas del usuario, de la más nueva a la más vieja ("Mis reseñas"). */
export async function getMyReviews(): Promise<MyReview[]>
{
    const token = await SecureStore.getItemAsync('auth_token');

    if (!token)
    {
        throw new Error('Tenés que iniciar sesión para ver tus reseñas');
    }

    const response = await fetch(
        `${API_URL}/users/me/reviews`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        throw new Error('No se pudieron obtener tus reseñas');
    }

    const data: { reviews: MyReview[] } = await response.json();

    return data.reviews;
}

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

    await throwIfUnauthorized(response.status, token);

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

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        throw await apiErrorFromResponse(
            response,
            'No se pudo agregar a favoritos'
        );
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

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        throw new Error('No se pudo quitar de favoritos');
    }
}

export async function updateProfileWithAvatar(
    token: string,
    name: string,
    imageUri?: string
): Promise<AuthUser>
{
    const formData = new FormData();

    formData.append('name', name);

    if (imageUri)
    {
        const fileName =
            imageUri.split('/').pop() || 'avatar.jpg';

        const extension =
            fileName.split('.').pop()?.toLowerCase();

        const mimeType =
            extension === 'png'
                ? 'image/png'
                : extension === 'webp'
                    ? 'image/webp'
                    : 'image/jpeg';

        const file = new File(imageUri);

        formData.append(
            'avatar',
            file,
            fileName
        );
    }

    const response = await expoFetch(
        `${API_URL}/users/me/profile`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        }
    );

    await throwIfUnauthorized(response.status, token);

    if (!response.ok)
    {
        const responseData =
            await response.json().catch(() => null);

        throw new Error(
            responseData?.error ??
            'No se pudo actualizar el perfil'
        );
    }

    return response.json();
}