import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Onboarding() {
    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!fullName || !height || !weight) {
            Alert.alert("Missing fields", "Please complete all fields.");
            return;
        }

        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("profiles")
            .upsert({
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

        // Redirect to home
        router.replace("/tabs");
    };

    return (
        <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
            <Text style={{ fontSize: 24, marginBottom: 20 }}>
                Complete Your Profile
            </Text>

            <TextInput
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
            />

            <TextInput
                placeholder="Height (cm)"
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
            />

            <TextInput
                placeholder="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
            />

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={{
                    backgroundColor: loading ? "gray" : "black",
                    padding: 15,
                    alignItems: "center",
                }}
            >
                <Text style={{ color: "white" }}>
                    {loading ? "Saving..." : "Continue"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}