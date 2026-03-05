import { router, Slot, usePathname } from "expo-router";
import { Bot } from "lucide-react-native";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomNavigation } from "../components/BottomNavigation";

export default function TabsLayout() {
    const pathname = usePathname();
    const isAICoach = pathname === "/tabs/ai-coach";

    return (
        <View style={styles.container}>
            <Slot />
            <BottomNavigation />

            {/* Floating AI Coach Button — hidden when already on AI Coach */}
            {!isAICoach && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => router.push("/tabs/ai-coach")}
                    activeOpacity={0.85}
                >
                    <Bot size={24} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },
    fab: {
        position: "absolute",
        bottom: 80,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#22c55e",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
        zIndex: 999,
    },
});