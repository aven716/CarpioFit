import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
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
import { supabase } from "../../lib/supabase";

export default function VerifyOTP() {
    const { email } = useLocalSearchParams<{ email: string }>();
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const inputs = useRef<(TextInput | null)[]>([]);

    const handleChange = (text: string, index: number) => {
        const digit = text.replace(/[^0-9]/g, "").slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        if (digit && index < 5) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join("");
        if (code.length < 6) {
            Alert.alert("Invalid Code", "Please enter the full 6-digit code.");
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: code,
            type: "signup",
        });

        setLoading(false);

        if (error) {
            Alert.alert("Verification Failed", error.message);
            return;
        }

        router.replace("/onboarding");
    };

    const handleResend = async () => {
        setResending(true);

        const { error } = await supabase.auth.resend({
            type: "signup",
            email,
        });

        setResending(false);

        if (error) {
            Alert.alert("Error", error.message);
            return;
        }

        Alert.alert("Code Sent", "A new verification code has been sent to your email.");
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <StatusBar style="light" />
            <View style={styles.inner}>
                <View style={styles.topSection}>
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconEmoji}>📧</Text>
                    </View>
                    <Text style={styles.title}>Check your email</Text>
                    <Text style={styles.subtitle}>
                        We sent a 6-digit code to
                    </Text>
                    <Text style={styles.emailText}>{email}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Enter Verification Code</Text>

                    {/* OTP Input Boxes */}
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { inputs.current[index] = ref; }}
                                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                value={digit}
                                onChangeText={(text) => handleChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="numeric"
                                maxLength={1}
                                selectTextOnFocus
                                caretHidden
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                        onPress={handleVerify}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>
                            {loading ? "Verifying..." : "Verify Email"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.resendBtn}
                        onPress={handleResend}
                        disabled={resending}
                    >
                        <Text style={styles.resendText}>
                            {resending ? "Sending..." : "Didn't receive a code? Resend"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backLink}>← Back to Register</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    inner: { flex: 1, justifyContent: "center", padding: 24, gap: 28 },
    topSection: { alignItems: "center", gap: 8 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 2, borderColor: "rgba(34,197,94,0.25)",
        alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    iconEmoji: { fontSize: 36 },
    title: { color: "#fff", fontSize: 24, fontWeight: "700" },
    subtitle: { color: "#888", fontSize: 14 },
    emailText: { color: "#22c55e", fontSize: 14, fontWeight: "600" },
    card: {
        backgroundColor: "#1a1a1a", borderRadius: 24, padding: 24,
        gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
    },
    cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 20, textAlign: "center" },
    otpRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
        gap: 8,
    },
    otpBox: {
        // Fixed: use explicit width/height instead of aspectRatio
        // to prevent text clipping on Android
        flex: 1,
        height: 52,
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#333",
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
        // Explicit vertical padding reset so text isn't pushed out of bounds
        paddingVertical: 0,
        includeFontPadding: false,  // Android: removes extra space above/below text
    },
    otpBoxFilled: {
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
    },
    primaryBtn: {
        backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 15,
        alignItems: "center", marginTop: 4, shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35,
        shadowRadius: 8, elevation: 6,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    resendBtn: { alignItems: "center", paddingVertical: 14 },
    resendText: { color: "#666", fontSize: 13 },
    backLink: { color: "#666", fontSize: 14, textAlign: "center" },
});