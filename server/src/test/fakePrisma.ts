/*
 * Fake en memoria del cliente de Prisma para los tests de integración.
 * Implementa solo las operaciones que usan las rutas probadas, con la
 * semántica que importa: unicidad (P2002), updateMany condicional,
 * increment, select e include. Nunca abre una conexión a la base.
 */
import { Prisma } from '../generated/prisma/client.js';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Data = Record<string, unknown>;

const uniqueError = (target: string) =>
    new Prisma.PrismaClientKnownRequestError(
        `Unique constraint failed on the fields: (\`${target}\`)`,
        { code: 'P2002', clientVersion: 'fake', meta: { target: [target] } }
    );

const notFoundError = () =>
    new Prisma.PrismaClientKnownRequestError(
        'Record to update not found.',
        { code: 'P2025', clientVersion: 'fake' }
    );

const matches = (row: Row, where: Where): boolean =>
    Object.entries(where).every(([key, condition]) =>
    {
        const value = row[key];

        if (
            condition !== null &&
            typeof condition === 'object' &&
            !(condition instanceof Date)
        )
        {
            const c = condition as { not?: unknown; lt?: number };

            if ('not' in c && value === c.not)
            {
                return false;
            }

            if (c.lt !== undefined && !((value as number) < c.lt))
            {
                return false;
            }

            return true;
        }

        return value === condition;
    });

const applyData = (row: Row, data: Data) =>
{
    for (const [key, value] of Object.entries(data))
    {
        // Prisma ignora los campos undefined.
        if (value === undefined)
        {
            continue;
        }

        if (
            value !== null &&
            typeof value === 'object' &&
            'increment' in value
        )
        {
            row[key] =
                (row[key] as number) +
                (value as { increment: number }).increment;
        }
        else
        {
            row[key] = value;
        }
    }
};

const pick = (row: Row, select?: Record<string, unknown>): Row =>
{
    if (!select)
    {
        return { ...row };
    }

    return Object.fromEntries(
        Object.entries(select)
            .filter(([, enabled]) => enabled)
            .map(([key]) => [key, row[key]])
    );
};

class Table
{
    rows: Row[] = [];
    private nextId = 1;

    constructor(
        private readonly uniqueFields: string[],
        private readonly defaults: () => Row
    )
    {}

    /*
     * Los IDs no se reinician: los rate limiters por usuario guardan
     * estado durante todo el archivo, y reusar IDs mezclaría usuarios
     * de tests distintos.
     */
    reset()
    {
        this.rows = [];
    }

    find(where: Where): Row | undefined
    {
        return this.rows.find((row) => matches(row, where));
    }

    private checkUnique(candidate: Row, self?: Row)
    {
        for (const field of this.uniqueFields)
        {
            const value = candidate[field];

            if (value === null || value === undefined)
            {
                continue;
            }

            if (this.rows.some((row) => row !== self && row[field] === value))
            {
                throw uniqueError(field);
            }
        }
    }

    insert(data: Data): Row
    {
        const row: Row = {
            id: this.nextId,
            createdAt: new Date(),
            ...this.defaults(),
        };

        applyData(row, data);
        this.checkUnique(row);
        this.nextId++;
        this.rows.push(row);

        return row;
    }

    patch(row: Row, data: Data)
    {
        const next = { ...row };
        applyData(next, data);
        this.checkUnique(next, row);
        Object.assign(row, next);
    }
}

export const db = {
    users: new Table(['email'], () => ({
        emailVerified: false,
        emailVerificationCodeHash: null,
        emailVerificationExpires: null,
        emailVerificationAttempts: 0,
        pendingEmail: null,
        emailChangeCodeHash: null,
        emailChangeCodeExpires: null,
        emailChangeAttempts: 0,
        avatarUrl: null,
        passwordResetCodeHash: null,
        passwordResetCodeExpires: null,
        passwordResetAttempts: 0,
        tokenVersion: 0,
    })),
    cafes: new Table(['googlePlaceId'], () => ({})),
    reviews: new Table(['idempotencyKey'], () => ({
        coffeeRating: null,
        foodRating: null,
        serviceRating: null,
        comfortRating: null,
        quietRating: null,
        goodForWork: null,
        goodForStudy: null,
        goodForDate: null,
        idempotencyKey: null,
        userId: null,
    })),
    favorites: new Table([], () => ({})),

    reset()
    {
        this.users.reset();
        this.cafes.reset();
        this.reviews.reset();
        this.favorites.reset();
    },
};

type Args = {
    where?: Where;
    data?: Data;
    select?: Record<string, unknown>;
    include?: Record<string, unknown>;
    create?: Data;
    update?: Data;
};

const withCafe = (row: Row, include?: Record<string, unknown>): Row =>
{
    const cafeInclude = include?.cafe;

    if (!cafeInclude)
    {
        return { ...row };
    }

    const cafe = db.cafes.find({ id: row.cafeId });
    const select =
        typeof cafeInclude === 'object'
            ? (cafeInclude as { select?: Record<string, unknown> }).select
            : undefined;

    return { ...row, cafe: cafe ? pick(cafe, select) : null };
};

export const fakePrisma = {
    // Solo lo usa GET /health (SELECT 1).
    $queryRaw: async () => [{ '?column?': 1 }],
    user: {
        findUnique: async ({ where = {}, select }: Args) =>
        {
            const row = db.users.find(where);
            return row ? pick(row, select) : null;
        },
        create: async ({ data = {}, select }: Args) =>
            pick(db.users.insert(data), select),
        update: async ({ where = {}, data = {}, select }: Args) =>
        {
            const row = db.users.find(where);
            if (!row) throw notFoundError();
            db.users.patch(row, data);
            return pick(row, select);
        },
        updateMany: async ({ where = {}, data = {} }: Args) =>
        {
            const rows = db.users.rows.filter((row) => matches(row, where));
            for (const row of rows) db.users.patch(row, data);
            return { count: rows.length };
        },
        delete: async ({ where = {} }: Args) =>
        {
            const row = db.users.find(where);
            if (!row) throw notFoundError();
            db.users.rows = db.users.rows.filter((r) => r !== row);
            return row;
        },
    },
    cafe: {
        findUnique: async ({ where = {} }: Args) =>
        {
            const row = db.cafes.find(where);
            return row ? { ...row } : null;
        },
        create: async ({ data = {} }: Args) => ({ ...db.cafes.insert(data) }),
    },
    review: {
        findUnique: async ({ where = {}, include }: Args) =>
        {
            const row = db.reviews.find(where);
            return row ? withCafe(row, include) : null;
        },
        create: async ({ data = {} }: Args) => ({ ...db.reviews.insert(data) }),
    },
    favorite: {
        upsert: async ({ where = {}, create = {}, update = {}, include }: Args) =>
        {
            const key = where.userId_cafeId as { userId: number; cafeId: number };
            let row = db.favorites.find(key);

            if (row)
            {
                db.favorites.patch(row, update);
            }
            else
            {
                row = db.favorites.insert(create);
            }

            return withCafe(row, include);
        },
    },
};
