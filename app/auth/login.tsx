import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            Alert.alert("Login Error", error.message);
            return;
        }

        router.replace("/tabs");
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <StatusBar style="light" />

            <View style={styles.inner}>
                {/* Logo / Title */}
                <View style={styles.topSection}>
                    <View style={styles.logoCircle}>
                        <Image
                            // Place your logo file at assets/images/logo.png
                            // and update the path below if it differs
                            source={require("../../assets/CarpioFitLogo.png")}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.appName}>CarpioFit</Text>
                    <Text style={styles.tagline}>Welcome back! Ready to crush it?</Text>
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sign In</Text>

                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                        placeholder="you@example.com"
                        placeholderTextColor="#555"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.input}
                    />

                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                        placeholder="••••••••"
                        placeholderTextColor="#555"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.input}
                    />

                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>
                            {loading ? "Signing in..." : "Sign In"}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.dividerRow}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.divider} />
                    </View>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => router.push("/auth/register")}
                    >
                        <Text style={styles.secondaryBtnText}>Create an Account</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    inner: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 28,
    },
    topSection: { alignItems: "center", gap: 10 },
    logoCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 2, borderColor: "rgba(34,197,94,0.25)",
        alignItems: "center", justifyContent: "center",
        marginBottom: 4,
        overflow: "hidden",
    },
    logoImage: {
        width: 52,
        height: 52,
    },
    appName: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 0.5 },
    tagline: { color: "#888", fontSize: 14 },

    card: {
        backgroundColor: "#1a1a1a",
        borderRadius: 24,
        padding: 24,
        gap: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    cardTitle: {
        color: "#fff", fontSize: 20, fontWeight: "700",
        marginBottom: 16,
    },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 6 },
    input: {
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        color: "#fff",
        fontSize: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#333",
    },
    primaryBtn: {
        backgroundColor: "#22c55e",
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: "center",
        marginTop: 4,
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    dividerRow: {
        flexDirection: "row", alignItems: "center",
        gap: 10, marginVertical: 16,
    },
    divider: { flex: 1, height: 1, backgroundColor: "#2a2a2a" },
    dividerText: { color: "#555", fontSize: 12 },

    secondaryBtn: {
        borderWidth: 1, borderColor: "#2a2a2a",
        borderRadius: 14, paddingVertical: 14,
        alignItems: "center",
    },
    secondaryBtnText: { color: "#aaa", fontSize: 15, fontWeight: "600" },
});