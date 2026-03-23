import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

export default function SplashScreenComponent({ onFinish }: { onFinish: () => void }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const textFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            // Logo fade + scale in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                }),
            ]),
            // Text fade in
            Animated.timing(textFade, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            // Hold for a moment
            Animated.delay(800),
            // Fade everything out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start(() => onFinish());
    }, []);

    return (
        <View style={styles.container}>
            {/* Corner accents */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                {/* Logo circle */}
                <Animated.View style={[styles.logoCircle, { transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.dumbbellBar} />
                    <View style={[styles.dumbbellWeight, styles.leftWeight]} />
                    <View style={[styles.dumbbellWeight, styles.rightWeight]} />
                </Animated.View>

                {/* App name */}
                <Animated.View style={[styles.nameContainer, { opacity: textFade }]}>
                    <Text style={styles.nameWhite}>Carpio</Text>
                    <Text style={styles.nameGreen}>Fit</Text>
                </Animated.View>

                {/* Divider */}
                <Animated.View style={[styles.divider, { opacity: textFade }]} />

                {/* Tagline */}
                <Animated.Text style={[styles.tagline, { opacity: textFade }]}>
                    UNLEASH YOUR INNER LEGEND
                </Animated.Text>

                {/* Dots */}
                <Animated.View style={[styles.dotsRow, { opacity: textFade }]}>
                    {[0.4, 0.7, 1, 0.7, 0.4].map((opacity, i) => (
                        <View key={i} style={[styles.dot, { opacity }]} />
                    ))}
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        alignItems: "center",
    },
    logoCircle: {
        width: 152,
        height: 152,
        borderRadius: 76,
        backgroundColor: "#111111",
        borderWidth: 1.5,
        borderColor: "#22c55e",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 32,
    },
    dumbbellBar: {
        width: 88,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#22c55e",
    },
    dumbbellWeight: {
        position: "absolute",
        width: 16,
        height: 36,
        borderRadius: 4,
        backgroundColor: "#22c55e",
    },
    leftWeight: {
        left: 18,
    },
    rightWeight: {
        right: 18,
    },
    nameContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        marginBottom: 16,
    },
    nameWhite: {
        fontSize: 52,
        fontWeight: "700",
        color: "#ffffff",
        letterSpacing: 2,
    },
    nameGreen: {
        fontSize: 52,
        fontWeight: "700",
        color: "#22c55e",
        letterSpacing: 2,
    },
    divider: {
        width: 120,
        height: 1,
        backgroundColor: "#22c55e",
        opacity: 0.5,
        marginBottom: 16,
    },
    tagline: {
        fontSize: 12,
        color: "#888888",
        letterSpacing: 3,
        marginBottom: 32,
    },
    dotsRow: {
        flexDirection: "row",
        gap: 12,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#22c55e",
    },
    corner: {
        position: "absolute",
        width: 40,
        height: 40,
        borderColor: "#22c55e",
        opacity: 0.3,
    },
    topLeft: {
        top: 40,
        left: 40,
        borderTopWidth: 1.5,
        borderLeftWidth: 1.5,
    },
    topRight: {
        top: 40,
        right: 40,
        borderTopWidth: 1.5,
        borderRightWidth: 1.5,
    },
    bottomLeft: {
        bottom: 40,
        left: 40,
        borderBottomWidth: 1.5,
        borderLeftWidth: 1.5,
    },
    bottomRight: {
        bottom: 40,
        right: 40,
        borderBottomWidth: 1.5,
        borderRightWidth: 1.5,
    },
});