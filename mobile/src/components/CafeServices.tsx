
import { StyleSheet, Text, View } from 'react-native';
import { CafeDetail } from '../types/CafeDetail';

type Props = {
    cafe: CafeDetail;
};

type Service = {
    label: string;
    value: boolean | null | undefined;
};

type ServiceGroup = {
    title: string;
    services: Service[];
};

export default function CafeServices({ cafe }: Props) {
    const groups: ServiceGroup[] = [
        {
            title: 'Atención',
            services: [
                { label: 'Delivery', value: cafe.delivery },
                { label: 'Para llevar', value: cafe.takeout },
                { label: 'Consumo en el local', value: cafe.dineIn },
                { label: 'Retiro en la puerta', value: cafe.curbsidePickup },
                { label: 'Mesas al aire libre', value: cafe.outdoorSeating },
                { label: 'Reservas', value: cafe.reservable },
            ],
        },
        {
            title: 'Comidas y bebidas',
            services: [
                { label: 'Desayuno', value: cafe.servesBreakfast },
                { label: 'Brunch', value: cafe.servesBrunch },
                { label: 'Almuerzo', value: cafe.servesLunch },
                { label: 'Cena', value: cafe.servesDinner },
                { label: 'Café', value: cafe.servesCoffee },
                { label: 'Postres', value: cafe.servesDessert },
                {
                    label: 'Opciones vegetarianas',
                    value: cafe.servesVegetarianFood,
                },
            ],
        },
        {
            title: 'Comodidades',
            services: [
                { label: 'Baños', value: cafe.restroom },
                { label: 'Música en vivo', value: cafe.liveMusic },
                { label: 'Apto para niños', value: cafe.goodForChildren },
                { label: 'Menú infantil', value: cafe.menuForChildren },
            ],
        },
        {
            title: 'Accesibilidad',
            services: [
                {
                    label: 'Entrada accesible',
                    value: cafe.accessibilityOptions
                        ?.wheelchairAccessibleEntrance,
                },
                {
                    label: 'Estacionamiento accesible',
                    value: cafe.accessibilityOptions
                        ?.wheelchairAccessibleParking,
                },
                {
                    label: 'Baños accesibles',
                    value: cafe.accessibilityOptions
                        ?.wheelchairAccessibleRestroom,
                },
                {
                    label: 'Asientos accesibles',
                    value: cafe.accessibilityOptions
                        ?.wheelchairAccessibleSeating,
                },
            ],
        },
        {
            title: 'Estacionamiento',
            services: [
                {
                    label: 'Estacionamiento gratuito',
                    value: cafe.parkingOptions?.freeParkingLot,
                },
                {
                    label: 'Estacionamiento pago',
                    value: cafe.parkingOptions?.paidParkingLot,
                },
                {
                    label: 'Estacionamiento gratuito en la calle',
                    value: cafe.parkingOptions?.freeStreetParking,
                },
                {
                    label: 'Estacionamiento pago en la calle',
                    value: cafe.parkingOptions?.paidStreetParking,
                },
                {
                    label: 'Valet parking',
                    value: cafe.parkingOptions?.valetParking,
                },
                {
                    label: 'Garaje gratuito',
                    value: cafe.parkingOptions?.freeGarageParking,
                },
                {
                    label: 'Garaje pago',
                    value: cafe.parkingOptions?.paidGarageParking,
                },
            ],
        },
        {
            title: 'Medios de pago',
            services: [
                {
                    label: 'Tarjetas de crédito',
                    value: cafe.paymentOptions?.acceptsCreditCards,
                },
                {
                    label: 'Tarjetas de débito',
                    value: cafe.paymentOptions?.acceptsDebitCards,
                },
                {
                    label: 'Solo efectivo',
                    value: cafe.paymentOptions?.acceptsCashOnly,
                },
                {
                    label: 'Pagos sin contacto',
                    value: cafe.paymentOptions?.acceptsNfc,
                },
            ],
        },
    ];

    const visibleGroups = groups
        .map((group) => ({
            ...group,
            services: group.services.filter(
                (service) =>
                    service.value === true ||
                    service.value === false
            ),
        }))
        .filter((group) => group.services.length > 0);

    if (visibleGroups.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                Servicios y comodidades
            </Text>

            {visibleGroups.map((group) => (
                <View key={group.title} style={styles.group}>
                    <Text style={styles.groupTitle}>
                        {group.title}
                    </Text>

                    <View style={styles.services}>
                        {group.services.map((service) => (
                            <View
                                key={service.label}
                                style={[
                                    styles.service,
                                    service.value
                                        ? styles.available
                                        : styles.unavailable,
                                ]}
                            >
                                <Text style={styles.serviceText}>
                                    {service.value ? '✓ ' : '✕ '}
                                    {service.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
    },

    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4A2416',
        marginBottom: 12,
    },

    group: {
        marginBottom: 16,
    },

    groupTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B3A22',
        marginBottom: 8,
    },

    services: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    service: {
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 12,
    },

    available: {
        backgroundColor: '#E3F0E3',
    },

    unavailable: {
        backgroundColor: '#F3E4E1',
    },

    serviceText: {
        fontSize: 13,
        color: '#4A2416',
    },
});
