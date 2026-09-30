import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import * as SecureStore from 'expo-secure-store';
import { AuthUser, getCurrentUser, loginUser, registerUser, RegisterResponse, verifyEmail } from "../services/api";

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

    logout: () => Promise<void>;
};

const AuthContext = 
    createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
                    
                await SecureStore.setItemAsync(
                    USER_KEY,
                    JSON.stringify(currentUser)
                );
            }
            catch (error)
            {
                console.error(
                    'ERROR RESTAURANDO SESIÓN:',
                    error
                );

                await SecureStore.deleteItemAsync(TOKEN_KEY);

                await SecureStore.deleteItemAsync(USER_KEY);

                setUser(null);
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