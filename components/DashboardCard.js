import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const DashboardCard = ({ title, value, icon, colors, subtitle, style }) => {
    return (
        <LinearGradient
            colors={colors || ['#4c669f', '#3b5998', '#192f6a']}
            style={[styles.card, style]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={styles.content}>
                <View>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.value}>{value}</Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 24, // Increased from 16
        padding: 15, // Increased from 20 for more breathability
        marginVertical: 5,
        // Removed flex: 1 to allow parent to control width
        elevation: 8,
        shadowColor: '#000000ff', // Colored shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        minHeight: 60,
        justifyContent: 'center',
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    value: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '500',
    },
    iconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 12,
        borderRadius: 16,
        backdropFilter: 'blur(10px)', // For supported platforms
    },
});

export default DashboardCard;
