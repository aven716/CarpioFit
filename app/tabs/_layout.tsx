import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";
import { BottomNavigation } from "../components/BottomNavigation";

export default function TabsLayout() {
    return (
        <View style={styles.container}>
            <Slot />
            <BottomNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },
});