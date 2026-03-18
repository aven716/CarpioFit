import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

function calculateNutrition(
    age: number,
    gender: string,
    heightCm: number,
    weightKg: number,
    activityLevel: string,
    goal: string
) {
    // BMR using Mifflin-St Jeor formula
    let bmr =
        gender === "male"
            ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
            : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const activityMultipliers: Record<string, number> = {
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
    };

    let tdee = bmr * (activityMultipliers[activityLevel] ?? 1.2);

    // Adjust calories based on goal
    if (goal === "lose") tdee -= 500;
    else if (goal === "gain") tdee += 300;

    const calories = Math.round(tdee);

    // Macro split
    const protein = Math.round((calories * 0.3) / 4);  // 30% protein
    const fat = Math.round((calories * 0.25) / 9);      // 25% fat
    const carbs = Math.round((calories * 0.45) / 4);    // 45% carbs

    return { calories, protein, fat, carbs };
}

const STEPS = 4;

export default function Onboarding() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 2 — Name
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // Step 3 — Body stats
    const [age, setAge] = useState("");
    const [gender, setGender] = useState<"male" | "female" | "">("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [goalWeight, setGoalWeight] = useState("");

    // Step 4 — Goals
    const [activityLevel, setActivityLevel] = useState("");
    const [goal, setGoal] = useState("");

    const handleSubmit = async () => {
        if (!activityLevel || !goal) {
            Alert.alert("Missing Fields", "Please complete all fields.");
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const nutrition = calculateNutrition(
            Number(age),
            gender,
            Number(height),
            Number(weight),
            activityLevel,
            goal
        );

        const { error } = await supabase.from("profiles").upsert({
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            age: Number(age),
            gender,
            height_cm: Number(height),
            weight_kg: Number(weight),
            goal_weight: Number(goalWeight),
            activity_level: activityLevel,
            goal,
            daily_calories: nutrition.calories,
            daily_protein: nutrition.protein,
            daily_fat: nutrition.fat,
            daily_carbs: nutrition.carbs,
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
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoEmoji}>🏋️</Text>
                    </View>
                    <Text style={styles.welcomeTitle}>Connect with{"\n"}your goals</Text>
                    <Text style={styles.welcomeSub}>
                        Your personal fitness companion is ready. Track workouts, log meals,
                        and crush your goals every single day.
                    </Text>
                    <Text style={styles.byLine}>By CarpioFit</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                        <Text style={styles.primaryBtnText}>Get Started →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── STEP 2: Name ──────────────────────────────────────────────────
    if (step === 2) {
        return (
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <StatusBar style="light" />
                <ScrollView contentContainerStyle={styles.formInner}>
                    <ProgressIndicator current={1} total={STEPS - 1} />
                    <View style={styles.formHeader}>
                        <Text style={styles.formTitle}>What's your name?</Text>
                        <Text style={styles.formSub}>Let's get to know you</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.inputLabel}>First Name</Text>
                        <TextInput placeholder="e.g., Juan" placeholderTextColor="#555" value={firstName} onChangeText={setFirstName} style={styles.input} />
                        <Text style={styles.inputLabel}>Last Name</Text>
                        <TextInput placeholder="e.g., dela Cruz" placeholderTextColor="#555" value={lastName} onChangeText={setLastName} style={styles.input} />
                        <TouchableOpacity
                            style={[styles.primaryBtn, (!firstName || !lastName) && styles.primaryBtnDisabled]}
                            onPress={() => {
                                if (!firstName || !lastName) return Alert.alert("Missing Fields", "Please enter your full name.");
                                setStep(3);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setStep(1)}>
                        <Text style={styles.backLink}>← Back</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    // ─── STEP 3: Body Stats ────────────────────────────────────────────
    if (step === 3) {
        return (
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <StatusBar style="light" />
                <ScrollView contentContainerStyle={styles.formInner}>
                    <ProgressIndicator current={2} total={STEPS - 1} />
                    <View style={styles.formHeader}>
                        <Text style={styles.formTitle}>Your Body Stats</Text>
                        <Text style={styles.formSub}>Used to calculate your daily calorie needs</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.inputLabel}>Age</Text>
                        <TextInput placeholder="e.g., 22" placeholderTextColor="#555" value={age} onChangeText={setAge} keyboardType="numeric" style={styles.input} />

                        <Text style={styles.inputLabel}>Gender</Text>
                        <View style={styles.optionRow}>
                            {["male", "female"].map((g) => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.optionBtn, gender === g && styles.optionBtnActive]}
                                    onPress={() => setGender(g as "male" | "female")}
                                >
                                    <Text style={[styles.optionBtnText, gender === g && styles.optionBtnTextActive]}>
                                        {g === "male" ? "♂ Male" : "♀ Female"}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Height</Text>
                        <View style={styles.inputWithUnit}>
                            <TextInput placeholder="170" placeholderTextColor="#555" value={height} onChangeText={setHeight} keyboardType="numeric" style={[styles.input, styles.inputFlex]} />
                            <View style={styles.unitBadge}><Text style={styles.unitText}>cm</Text></View>
                        </View>

                        <Text style={styles.inputLabel}>Current Weight</Text>
                        <View style={styles.inputWithUnit}>
                            <TextInput placeholder="65" placeholderTextColor="#555" value={weight} onChangeText={setWeight} keyboardType="numeric" style={[styles.input, styles.inputFlex]} />
                            <View style={styles.unitBadge}><Text style={styles.unitText}>kg</Text></View>
                        </View>

                        <Text style={styles.inputLabel}>Goal Weight</Text>
                        <View style={styles.inputWithUnit}>
                            <TextInput placeholder="60" placeholderTextColor="#555" value={goalWeight} onChangeText={setGoalWeight} keyboardType="numeric" style={[styles.input, styles.inputFlex]} />
                            <View style={styles.unitBadge}><Text style={styles.unitText}>kg</Text></View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, (!age || !gender || !height || !weight || !goalWeight) && styles.primaryBtnDisabled]}
                            onPress={() => {
                                if (!age || !gender || !height || !weight || !goalWeight)
                                    return Alert.alert("Missing Fields", "Please complete all fields.");
                                setStep(4);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setStep(2)}>
                        <Text style={styles.backLink}>← Back</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    // ─── STEP 4: Goals & Activity ──────────────────────────────────────
    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.formInner}>
                <ProgressIndicator current={3} total={STEPS - 1} />
                <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Your Goals</Text>
                    <Text style={styles.formSub}>We'll personalize your plan based on this</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.inputLabel}>Activity Level</Text>
                    {[
                        { value: "sedentary", label: "🪑 Sedentary", sub: "Little or no exercise" },
                        { value: "lightly_active", label: "🚶 Lightly Active", sub: "1–3 days/week" },
                        { value: "moderately_active", label: "🏃 Moderately Active", sub: "3–5 days/week" },
                        { value: "very_active", label: "💪 Very Active", sub: "6–7 days/week" },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.value}
                            style={[styles.optionCardBtn, activityLevel === item.value && styles.optionCardBtnActive]}
                            onPress={() => setActivityLevel(item.value)}
                        >
                            <Text style={[styles.optionCardLabel, activityLevel === item.value && styles.optionCardLabelActive]}>{item.label}</Text>
                            <Text style={styles.optionCardSub}>{item.sub}</Text>
                        </TouchableOpacity>
                    ))}

                    <Text style={[styles.inputLabel, { marginTop: 16 }]}>Fitness Goal</Text>
                    {[
                        { value: "lose", label: "🔥 Lose Weight", sub: "Calorie deficit" },
                        { value: "maintain", label: "⚖️ Maintain Weight", sub: "Stay at current weight" },
                        { value: "gain", label: "💪 Gain Muscle", sub: "Calorie surplus" },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.value}
                            style={[styles.optionCardBtn, goal === item.value && styles.optionCardBtnActive]}
                            onPress={() => setGoal(item.value)}
                        >
                            <Text style={[styles.optionCardLabel, goal === item.value && styles.optionCardLabelActive]}>{item.label}</Text>
                            <Text style={styles.optionCardSub}>{item.sub}</Text>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        style={[styles.primaryBtn, { marginTop: 8 }, (!activityLevel || !goal || loading) && styles.primaryBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>{loading ? "Setting up..." : "Finish Setup 🎉"}</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setStep(3)}>
                    <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// Progress dots component
function ProgressIndicator({ current, total }: { current: number; total: number }) {
    return (
        <View style={styles.progressRow}>
            {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.progressDot, i < current ? styles.progressDotDone : i === current - 1 ? styles.progressDotActive : null]} />
                    {i < total - 1 && <View style={[styles.progressLine, { backgroundColor: i < current - 1 ? "#22c55e" : "#2a2a2a" }]} />}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },

    welcomeInner: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 16 },
    logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 2, borderColor: "rgba(34,197,94,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    logoEmoji: { fontSize: 40 },
    welcomeTitle: { color: "#fff", fontSize: 32, fontWeight: "800", textAlign: "center", lineHeight: 40 },
    welcomeSub: { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
    byLine: { color: "#22c55e", fontSize: 13, fontWeight: "600", marginBottom: 8 },

    formInner: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 20, paddingBottom: 40 },
    progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2a2a2a" },
    progressDotDone: { backgroundColor: "#22c55e" },
    progressDotActive: { backgroundColor: "#22c55e", width: 16, height: 16, borderRadius: 8, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4 },
    progressLine: { width: 48, height: 2, backgroundColor: "#2a2a2a" },

    formHeader: { gap: 6 },
    formTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
    formSub: { color: "#888", fontSize: 13 },

    card: { backgroundColor: "#1a1a1a", borderRadius: 24, padding: 24, gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 6 },
    input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#fff", fontSize: 14, marginBottom: 14, borderWidth: 1, borderColor: "#333" },
    inputFlex: { flex: 1, marginBottom: 14 },
    inputWithUnit: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 0 },
    unitBadge: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: "#333", marginBottom: 14 },
    unitText: { color: "#888", fontSize: 14, fontWeight: "600" },

    optionRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    optionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#333", alignItems: "center" },
    optionBtnActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    optionBtnText: { color: "#888", fontSize: 14, fontWeight: "500" },
    optionBtnTextActive: { color: "#22c55e", fontWeight: "600" },

    optionCardBtn: { backgroundColor: "#2a2a2a", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#333" },
    optionCardBtnActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    optionCardLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
    optionCardLabelActive: { color: "#22c55e" },
    optionCardSub: { color: "#666", fontSize: 12, marginTop: 2 },

    primaryBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    backLink: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 4 },
});