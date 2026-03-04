// app/(auth)/login.tsx
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            Alert.alert("Login Error", error.message);
            return;
        }

        // RootLayout will auto redirect if session is valid
    };

    return (
        <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                style={{ borderWidth: 1, padding: 12, marginBottom: 12, borderRadius: 8 }}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ borderWidth: 1, padding: 12, marginBottom: 20, borderRadius: 8 }}
            />
            <TouchableOpacity onPress={handleLogin} style={{ padding: 15, backgroundColor: "#111", borderRadius: 8 }}>
                <Text style={{ color: "white", textAlign: "center" }}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/auth/register")} style={{ marginTop: 10 }}>
                <Text style={{ color: "#111", textAlign: "center" }}>Go to Register</Text>
            </TouchableOpacity>
        </View>
    );
}