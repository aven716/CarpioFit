import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function Onboarding() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [fullName, setFullName] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!fullName || !height || !weight) {
            Alert.alert("Missing Fields", "Please complete all fields.");
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("profiles").upsert({
            id: user.id,
            full_name: fullName,
            height_cm: Number(height),
            weight_kg: Number(weight),
        });

        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
            return;
        }

        router.replace("/tabs");
    };

    // ─── STEP 1: Welcome ───────────────────────────────────────────────
    if (step === 1) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />

                <View style={styles.welcomeInner}>
                    {/* Logo */}
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoEmoji}>🏋️</Text>
                    </View>

                    <Text style={styles.welcomeTitle}>Connect with{"\n"}your goals</Text>
                    <Text style={styles.welcomeSub}>
                        Your personal fitness companion is ready. Track workouts, log meals,
                        and crush your goals every single day.
                    </Text>
                    <Text style={styles.byLine}>By CarpioFit</Text>

                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => setStep(2)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>Get Started →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── STEP 2: Profile Form ──────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <StatusBar style="light" />

            <View style={styles.formInner}>
                {/* Progress indicator */}
                <View style={styles.progressRow}>
                    <View style={[styles.progressDot, styles.progressDotDone]} />
                    <View style={styles.progressLine} />
                    <View style={[styles.progressDot, styles.progressDotActive]} />
                </View>

                {/* Header */}
                <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Complete Your Profile</Text>
                    <Text style={styles.formSub}>
                        Help us personalize your fitness experience
                    </Text>
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                        placeholder="e.g., Juan dela Cruz"
                        placeholderTextColor="#555"
                        value={fullName}
                        onChangeText={setFullName}
                        style={styles.input}
                    />

                    <Text style={styles.inputLabel}>Height</Text>
                    <View style={styles.inputWithUnit}>
                        <TextInput
                            placeholder="170"
                            placeholderTextColor="#555"
                            value={height}
                            onChangeText={setHeight}
                            keyboardType="numeric"
                            style={[styles.input, styles.inputFlex]}
                        />
                        <View style={styles.unitBadge}>
                            <Text style={styles.unitText}>cm</Text>
                        </View>
                    </View>

                    <Text style={styles.inputLabel}>Weight</Text>
                    <View style={styles.inputWithUnit}>
                        <TextInput
                            placeholder="65"
                            placeholderTextColor="#555"
                            value={weight}
                            onChangeText={setWeight}
                            keyboardType="numeric"
                            style={[styles.input, styles.inputFlex]}
                        />
                        <View style={styles.unitBadge}>
                            <Text style={styles.unitText}>kg</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>
                            {loading ? "Saving..." : "Finish Setup"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setStep(1)}>
                    <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },

    // ── Step 1 Welcome ──
    welcomeInner: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        gap: 16,
    },
    logoCircle: {
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 2, borderColor: "rgba(34,197,94,0.25)",
        alignItems: "center", justifyContent: "center",
        marginBottom: 8,
    },
    logoEmoji: { fontSize: 40 },
    welcomeTitle: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "800",
        textAlign: "center",
        lineHeight: 40,
    },
    welcomeSub: {
        color: "#888",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    byLine: {
        color: "#22c55e",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 8,
    },

    // ── Step 2 Form ──
    formInner: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 20,
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: 8,
    },
    progressDot: {
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: "#2a2a2a",
    },
    progressDotDone: { backgroundColor: "#22c55e" },
    progressDotActive: {
        backgroundColor: "#22c55e",
        width: 16, height: 16, borderRadius: 8,
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
        elevation: 4,
    },
    progressLine: {
        width: 48, height: 2,
        backgroundColor: "#22c55e",
    },
    formHeader: { gap: 6 },
    formTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
    formSub: { color: "#888", fontSize: 13 },

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
    inputLabel: {
        color: "#888",
        fontSize: 13,
        fontWeight: "500",
        marginBottom: 6,
    },
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
    inputFlex: { flex: 1, marginBottom: 14 },
    inputWithUnit: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 0,
    },
    unitBadge: {
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderWidth: 1,
        borderColor: "#333",
        marginBottom: 14,
    },
    unitText: { color: "#888", fontSize: 14, fontWeight: "600" },

    // ── Shared ──
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

    backLink: {
        color: "#666",
        fontSize: 14,
        textAlign: "center",
        marginTop: 4,
    },
});