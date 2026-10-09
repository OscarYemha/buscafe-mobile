import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState
} from "react";
import * as SecureStore from 'expo-secure-store';
import {
    AuthUser,
    changePassword,
    deleteAccount,
    getCurrentUser,
    InvalidSessionError,
    loginUser,
    registerUser,
    RegisterResponse,
    updateProfile,
    uploadAvatar,
    verifyEmail,
    requestEmailChange,
    verifyEmailChange,
} from "../services/api";

type AuthContextType = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isRestoringSession: boolean;

    login: (
        email: string,
        password: string
    ) => Promise<void>;

    register: (
        name: string,
        email: string,
        password: string
    ) => Promise<RegisterResponse>;

    verify: (
        email: string,
        code: string
    ) => Promise<void>;

    requestProfileEmailChange: (
        email: string
    ) => Promise<void>;

    verifyProfileEmailChange: (
        code: string
    ) => Promise<void>;

    updateProfileName: (
        name: string
    ) => Promise<void>;

    updateAvatar: (
        imageUri: string
    ) => Promise<void>;

    updateUser: (
        updatedUser: AuthUser
    ) => Promise<void>;

    changeProfilePassword: (
        currentPassword: string,
        newPassword: string
    ) => Promise<void>;

    deleteProfileAccount: (
        password: string
    ) => Promise<void>;

    logout: () => Promise<void>;
};

const AuthContext =
    createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

async function clearStoredSession(): Promise<void>
{
    try
    {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    }
    catch (error)
    {
        console.error(
            'ERROR LIMPIANDO CREDENCIALES:',
            error
        );
    }
}

export function AuthProvider({children, }: {children: ReactNode})
{
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isRestoringSession, setIsRestoringSession] = useState(true);

    useEffect(() => {
        const restoreSession = async () => {
            try
            {
                const token =
                    await SecureStore.getItemAsync(
                        TOKEN_KEY
                    );

                if (!token)
                {
                    return;
                }

                const currentUser =
                    await getCurrentUser(token);

                setUser(currentUser);

                try
                {
                    await SecureStore.setItemAsync(
                        USER_KEY,
                        JSON.stringify(currentUser)
                    );
                }
                catch (storageError)
                {
                    console.error(
                        'ERROR GUARDANDO USUARIO RESTAURADO:',
                        storageError
                    );
                }
            }
            catch (error)
            {
                console.error(
                    'ERROR RESTAURANDO SESIÓN:',
                    error
                );

                if (error instanceof InvalidSessionError)
                {
                    await clearStoredSession();

                    setUser(null);
                }
                else
                {
                    let savedUser: string | null = null;
                    let storageReadFailed = false;

                    try
                    {
                        savedUser =
                            await SecureStore.getItemAsync(USER_KEY);
                    }
                    catch (storageError)
                    {
                        storageReadFailed = true;

                        console.error(
                            'ERROR LEYENDO USUARIO GUARDADO:',
                            storageError
                        );
                    }

                    if (storageReadFailed)
                    {
                        setUser(null);
                    }
                    else if (savedUser)
                    {
                        try
                        {
                            const parsedUser: unknown =
                                JSON.parse(savedUser);

                            if (
                                typeof parsedUser === 'object' &&
                                parsedUser !== null &&
                                'id' in parsedUser &&
                                typeof parsedUser.id === 'number' &&
                                'name' in parsedUser &&
                                typeof parsedUser.name === 'string' &&
                                'email' in parsedUser &&
                                typeof parsedUser.email === 'string' &&
                                'avatarUrl' in parsedUser &&
                                (
                                    parsedUser.avatarUrl === null ||
                                    typeof parsedUser.avatarUrl === 'string'
                                )
                            )
                            {
                                setUser(parsedUser as AuthUser);
                            }
                            else
                            {
                                await clearStoredSession();

                                setUser(null);
                            }
                        }
                        catch
                        {
                            await clearStoredSession();

                            setUser(null);
                        }
                    }
                    else
                    {
                        await clearStoredSession();

                        setUser(null);
                    }
                }
            }
            finally
            {
                setIsRestoringSession(false);
            }
        };

        restoreSession();
    }, []);

    const login = async (
        email: string,
        password: string
    ) => {
        const result =
            await loginUser(
                email,
                password
            );

        await SecureStore.setItemAsync(
            TOKEN_KEY,
            result.token
        );

        await SecureStore.setItemAsync(
            USER_KEY,
            JSON.stringify(result.user)
        );

        setUser(result.user);
    };

    const register = async (
        name: string,
        email: string,
        password: string
    ) => {
        const result =
            await registerUser({
                name,
                email,
                password
            });

        return result;
    }

    const verify = async (
        email: string,
        code: string
    ) => {
        const result =
            await verifyEmail(
                email,
                code
            );

        await SecureStore.setItemAsync(
            TOKEN_KEY,
            result.token
        );

        await SecureStore.setItemAsync(
            USER_KEY,
            JSON.stringify(result.user)
        );

        setUser(result.user);
    };

    const updateAvatar = async (
        imageUri: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        const updatedUser =
            await uploadAvatar(
                token,
                imageUri
            );

        await updateUser(updatedUser);
    };

    const updateProfileName = async (
        name: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        const updatedUser =
            await updateProfile(
                token,
                name
            );

        await updateUser(updatedUser);
    };

    const requestProfileEmailChange = async (
        email: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        await requestEmailChange(
            token,
            email
        );
    };

    const verifyProfileEmailChange = async (
        code: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        const updatedUser =
            await verifyEmailChange(
                token,
                code
            );

        await updateUser(updatedUser);
    };

    const changeProfilePassword = async (
        currentPassword: string,
        newPassword: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        await changePassword(
            token,
            currentPassword,
            newPassword
        );
    };

    const deleteProfileAccount = async (
        password: string
    ) => {
        const token =
            await SecureStore.getItemAsync(
                TOKEN_KEY
            );

        if (!token)
        {
            throw new Error(
                'No hay una sesión activa'
            );
        }

        await deleteAccount(
            token,
            password
        );

        try
        {
            const results = await Promise.allSettled([
                SecureStore.deleteItemAsync(TOKEN_KEY),
                SecureStore.deleteItemAsync(USER_KEY),
            ]);

            const failed = results.some(
                result => result.status === 'rejected'
            );

            if (failed)
            {
                console.error(
                    'La cuenta fue eliminada, pero no se pudieron borrar todas las credenciales locales.'
                );
            }
        }
        finally
        {
            setUser(null);
        }
    };

    const updateUser = async (
        updatedUser: AuthUser
    ) => {
        await SecureStore.setItemAsync(
            USER_KEY,
            JSON.stringify(updatedUser)
        );

        setUser(updatedUser);
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync(
            TOKEN_KEY
        );

        await SecureStore.deleteItemAsync(
            USER_KEY
        );

        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: user !== null,
                isRestoringSession,
                login,
                register,
                verify,
                requestProfileEmailChange,
                verifyProfileEmailChange,
                updateAvatar,
                updateProfileName,
                changeProfilePassword,
                deleteProfileAccount,
                updateUser,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth()
{
    const context = useContext(AuthContext);

    if(!context)
    {
        throw new Error(
            'useAuth debe usarse dentro de AuthProvider'
        );
    }

    return context;
}