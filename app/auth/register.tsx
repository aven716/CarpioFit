// app/(auth)/register.tsx
import { router } from "expo-router";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async () => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: "carpiofit://auth/callback"
            }
        });

        if (error) {
            alert("Registration failed: " + error.message);
            return;
        }

        alert("Check your email to confirm your account!");
        router.push("/auth/login");
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
            <TouchableOpacity onPress={handleRegister} style={{ padding: 15, backgroundColor: "#111", borderRadius: 8 }}>
                <Text style={{ color: "white", textAlign: "center" }}>Register</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/auth/login")} style={{ marginTop: 10 }}>
                <Text style={{ color: "#111", textAlign: "center" }}>Go to Login</Text>
            </TouchableOpacity>
        </View>
    );
}