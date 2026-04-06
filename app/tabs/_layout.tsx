import { router, Slot, usePathname } from "expo-router";
import { Bot } from "lucide-react-native";
import { createContext } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { usePedometer } from "../../lib/usePedometer";
import { BottomNavigation } from "../components/BottomNavigation";

export const PedometerContext = createContext({
    steps: 0,
    distanceKm: 0,
    caloriesBurned: 0,
    goalProgress: 0,
    isAvailable: false,
    isLoading: true,
    stepGoal: 10000,
});

export default function TabsLayout() {
    const pathname = usePathname();
    const isAICoach = pathname === "/tabs/ai-coach";
    const pedometer = usePedometer();

    return (
        <PedometerContext.Provider value={pedometer}>
    
                <View style={styles.container}>
                    <Slot />
                    <BottomNavigation />

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
        
        </PedometerContext.Provider>
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