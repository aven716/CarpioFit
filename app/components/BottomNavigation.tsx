import { usePathname, useRouter } from "expo-router";
import { Calendar, Home, User, Users, Utensils } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const navItems = [
    { path: "/tabs", icon: Home, label: "Home" },
    { path: "/tabs/food", icon: Utensils, label: "Food" },
    { path: "/tabs/calendar", icon: Calendar, label: "Calendar" },
    { path: "/tabs/community", icon: Users, label: "Community" },
    { path: "/tabs/profile", icon: User, label: "Profile" },
];

export function BottomNavigation() {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <View style={styles.nav}>
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;

                return (
                    <TouchableOpacity
                        key={item.path}
                        style={styles.navItem}
                        onPress={() => router.push(item.path as any)}
                    >
                        <Icon
                            size={20}
                            color={isActive ? "#5dc736" : "#888"}
                            strokeWidth={isActive ? 2.5 : 1.5}
                        />
                        <Text style={[styles.label, isActive && styles.labelActive]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    nav: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        backgroundColor: "#1a3329",
        borderWidth: 1,
        borderTopWidth: 1,
        borderColor: "#60a74c6c",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: 8,
        shadowColor: "#000",
        shadowOffset: { width: -1, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
        borderRadius: 30,
        marginHorizontal: 10,
        marginBottom: 10,
    },
    navItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 4,
    },
    label: {
        fontSize: 11,
        color: "#888",
    },
    labelActive: {
        color: "#abee92",
    },
});

export default BottomNavigation;