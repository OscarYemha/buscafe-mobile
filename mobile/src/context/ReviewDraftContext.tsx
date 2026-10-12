import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

type ReviewDraft = {
    cafeId: string | null;
    rating: number;
    comment: string;

    coffeeRating: number | null;
    foodRating: number | null;
    serviceRating: number | null;
    comfortRating: number | null;
    quietRating: number | null;

    goodForWork: boolean | null;
    goodForStudy: boolean | null;
    goodForDate: boolean | null;
};

type PublicationAttempt = {
    key: string;
    userId: number;
    payload: string;
};

type StoredDraft = {
    draft: ReviewDraft;
    attempt: PublicationAttempt | null;
};

type ReviewDraftContextType = {
    draft: ReviewDraft;
    isDraftReady: boolean;
    setDraft: (draft: ReviewDraft) => void;
    clearDraft: () => Promise<void>;
    preparePublication: (
        userId: number,
        payload: string
    ) => Promise<string>;
};

const STORAGE_KEY = '@buscafe:review-draft';

const initialDraft: ReviewDraft = {
    cafeId: null,
    rating: 0,
    comment: '',

    coffeeRating: null,
    foodRating: null,
    serviceRating: null,
    comfortRating: null,
    quietRating: null,

    goodForWork: null,
    goodForStudy: null,
    goodForDate: null,
};

const initialState: StoredDraft = {
    draft: initialDraft,
    attempt: null,
};

const ReviewDraftContext =
    createContext<ReviewDraftContextType | undefined>(undefined);

export function ReviewDraftProvider({
    children,
}: {
    children: ReactNode;
})
{
    const [state, setState] = useState<StoredDraft>(initialState);
    const [isDraftReady, setIsDraftReady] = useState(false);

    const stateRef = useRef<StoredDraft>(initialState);
    const writeQueue = useRef<Promise<void>>(Promise.resolve());

    const persist = (next: StoredDraft): Promise<void> =>
    {
        writeQueue.current = writeQueue.current
            .catch(() => undefined)
            .then(() =>
                AsyncStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(next)
                )
            );

        return writeQueue.current;
    };

    useEffect(() =>
    {
        let active = true;

        const loadDraft = async () =>
        {
            try
            {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);

                if (stored && active)
                {
                    const parsed = JSON.parse(stored) as StoredDraft;

                    if (parsed?.draft)
                    {
                        const restored: StoredDraft = {
                            draft: {
                                ...initialDraft,
                                ...parsed.draft,
                            },
                            attempt: parsed.attempt ?? null,
                        };

                        stateRef.current = restored;
                        setState(restored);
                    }
                }
            }
            catch (error)
            {
                console.error(
                    'No se pudo recuperar el borrador:',
                    error
                );
            }
            finally
            {
                if (active)
                {
                    setIsDraftReady(true);
                }
            }
        };

        void loadDraft();

        return () =>
        {
            active = false;
        };
    }, []);

    const setDraft = (draft: ReviewDraft) =>
    {
        const current = stateRef.current;

        if (
            JSON.stringify(current.draft) ===
            JSON.stringify(draft)
        )
        {
            return;
        }

        const next: StoredDraft = {
            draft,
            attempt: null,
        };

        stateRef.current = next;
        setState(next);

        void persist(next).catch(error =>
        {
            console.error(
                'No se pudo guardar el borrador:',
                error
            );
        });
    };

    const clearDraft = async () =>
    {
        const next = initialState;

        stateRef.current = next;
        setState(next);

        await persist(next);
    };

    const preparePublication = async (
        userId: number,
        payload: string
    ): Promise<string> =>
    {
        if (!isDraftReady)
        {
            throw new Error(
                'Esperá mientras recuperamos tu reseña.'
            );
        }

        const current = stateRef.current;
        const previous = current.attempt;

        if (
            previous &&
            previous.userId === userId &&
            previous.payload === payload
        )
        {
            await writeQueue.current;

            return previous.key;
        }

        const key = Crypto.randomUUID();

        const next: StoredDraft = {
            draft: current.draft,
            attempt: {
                key,
                userId,
                payload,
            },
        };

        stateRef.current = next;
        setState(next);

        await persist(next);

        return key;
    };

    return (
        <ReviewDraftContext.Provider
            value={{
                draft: state.draft,
                isDraftReady,
                setDraft,
                clearDraft,
                preparePublication,
            }}
        >
            {children}
        </ReviewDraftContext.Provider>
    );
}

export function useReviewDraft()
{
    const context = useContext(ReviewDraftContext);

    if (!context)
    {
        throw new Error(
            'useReviewDraft debe usarse dentro de ReviewDraftProvider'
        );
    }

    return context;
}