import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    Award,
    Bell,
    ChevronRight,
    Flame,
    Globe,
    HelpCircle,
    Lock,
    LogOut,
    Settings,
    Target,
    TrendingUp,
    Trophy,
    User,
    Zap,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

interface UserData {
    name: string;
    age: string;
    gender: string;
    currentWeight: string;
    goalWeight: string;
    fitnessGoal: string;
}

function ProgressBar({
    value,
    height = 8,
    trackColor = "rgba(255,255,255,0.1)",
    fillColor = "#22c55e",
}: {
    value: number;
    height?: number;
    trackColor?: string;
    fillColor?: string;
}) {
    const clamped = Math.min(Math.max(value, 0), 100);
    return (
        <View style={[{ height, backgroundColor: trackColor, borderRadius: 99, overflow: "hidden" }]}>
            <View style={{ width: `${clamped}%`, height, backgroundColor: fillColor, borderRadius: 99 }} />
        </View>
    );
}

export default function Profile() {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [notifications, setNotifications] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem("carpioFitUser").then((data) => {
            if (data) setUserData(JSON.parse(data));
        });
    }, []);

    const handleLogout = async () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await supabase.auth.signOut();
                    await AsyncStorage.removeItem("carpioFitUser");
                    // RootLayout will auto-redirect to /auth/login
                },
            },
        ]);
    };

    const fitnessGoalLabel: Record<string, string> = {
        lose: "Weight Loss Journey",
        gain: "Muscle Building",
        maintain: "Maintaining Fitness",
        endurance: "Endurance Training",
    };

    const achievements = [
        { icon: Flame, label: "7 Day Streak", color: "#f97316", earned: true },
        { icon: Trophy, label: "First 5K", color: "#eab308", earned: true },
        { icon: Target, label: "Goal Setter", color: "#22c55e", earned: true },
        { icon: Zap, label: "Early Bird", color: "#3b82f6", earned: false },
    ];

    const stats = [
        { label: "Workouts", value: "24", icon: TrendingUp },
        { label: "Total Distance", value: "48.2 km", icon: Target },
        { label: "Active Days", value: "18", icon: Award },
    ];

    const settingsItems = [
        { icon: Bell, label: "Notifications", hasSwitch: true },
        { icon: Globe, label: "Language", value: "English" },
        { icon: Lock, label: "Privacy & Security" },
        { icon: HelpCircle, label: "Help & Support" },
    ];

    const weightProgress =
        userData?.currentWeight && userData?.goalWeight
            ? ((parseFloat(userData.currentWeight) - parseFloat(userData.goalWeight)) /
                parseFloat(userData.currentWeight)) *
            100
            : 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.avatarCircle}>
                        <User size={40} color="#22c55e" />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.userName}>{userData?.name || "User"}</Text>
                        <Text style={styles.userGoal}>
                            {userData?.fitnessGoal ? fitnessGoalLabel[userData.fitnessGoal] ?? "" : ""}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn}>
                        <Settings size={20} color="#888" />
                    </TouchableOpacity>
                </View>

                {/* Goal Progress */}
                <View style={styles.progressCard}>
                    <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Current Progress</Text>
                        <Text style={styles.progressValue}>
                            {userData?.currentWeight || "--"} / {userData?.goalWeight || "--"} kg
                        </Text>
                    </View>
                    <ProgressBar value={weightProgress} />
                </View>
            </View>

            <View style={styles.body}>
                {/* Activity Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Stats</Text>
                    <View style={styles.statsGrid}>
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <View key={stat.label} style={styles.statCard}>
                                    <Icon size={20} color="#22c55e" />
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Achievements */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Achievements</Text>
                    <View style={styles.achievementsGrid}>
                        {achievements.map((a) => {
                            const Icon = a.icon;
                            return (
                                <View key={a.label} style={[styles.achievementCard, !a.earned && { opacity: 0.4 }]}>
                                    <View style={[styles.achievementIcon, { backgroundColor: a.earned ? "rgba(34,197,94,0.1)" : "#2a2a2a" }]}>
                                        <Icon size={24} color={a.color} />
                                    </View>
                                    <Text style={styles.achievementLabel}>{a.label}</Text>
                                    {a.earned && <Text style={styles.earnedText}>Earned</Text>}
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Personal Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.card}>
                        {[
                            { label: "Age", value: `${userData?.age || "--"} years` },
                            { label: "Gender", value: userData?.gender || "--" },
                            { label: "Current Weight", value: `${userData?.currentWeight || "--"} kg` },
                            { label: "Goal Weight", value: `${userData?.goalWeight || "--"} kg` },
                        ].map((item, i, arr) => (
                            <View
                                key={item.label}
                                style={[styles.infoRow, i < arr.length - 1 && styles.infoRowBorder]}
                            >
                                <Text style={styles.infoLabel}>{item.label}</Text>
                                <Text style={styles.infoValue}>{item.value}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <View style={styles.card}>
                        {settingsItems.map((item, i, arr) => {
                            const Icon = item.icon;
                            return (
                                <TouchableOpacity
                                    key={item.label}
                                    style={[styles.settingRow, i < arr.length - 1 && styles.infoRowBorder]}
                                >
                                    <View style={styles.settingLeft}>
                                        <Icon size={20} color="#888" />
                                        <Text style={styles.settingLabel}>{item.label}</Text>
                                    </View>
                                    {item.hasSwitch ? (
                                        <Switch
                                            value={notifications}
                                            onValueChange={setNotifications}
                                            trackColor={{ false: "#333", true: "#22c55e" }}
                                            thumbColor="#fff"
                                        />
                                    ) : item.value ? (
                                        <Text style={styles.settingValue}>{item.value}</Text>
                                    ) : (
                                        <ChevronRight size={20} color="#888" />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut size={16} color="#ef4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>Carpio Fit v1.0.0</Text>
                    <Text style={styles.appInfoText}>Your personal fitness companion</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },
    header: {
        backgroundColor: "#1a1a1a",
        padding: 24,
        paddingTop: 48,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(34,197,94,0.1)",
        borderWidth: 2,
        borderColor: "rgba(34,197,94,0.2)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
    },
    userName: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 4,
    },
    userGoal: {
        color: "#888",
        fontSize: 13,
    },
    settingsBtn: {
        padding: 8,
    },
    progressCard: {
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        padding: 16,
        gap: 10,
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    progressLabel: {
        color: "#888",
        fontSize: 13,
    },
    progressValue: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "500",
    },
    body: {
        padding: 16,
        gap: 24,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    statsGrid: {
        flexDirection: "row",
        gap: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: "#1a1a1a",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        gap: 6,
    },
    statValue: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        marginTop: 4,
    },
    statLabel: {
        color: "#888",
        fontSize: 11,
        textAlign: "center",
    },
    achievementsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    achievementCard: {
        width: "48%",
        backgroundColor: "#1a1a1a",
        borderRadius: 16,
        padding: 16,
        gap: 8,
    },
    achievementIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    achievementLabel: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "500",
    },
    earnedText: {
        color: "#888",
        fontSize: 11,
    },
    card: {
        backgroundColor: "#1a1a1a",
        borderRadius: 16,
        overflow: "hidden",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: "#2a2a2a",
    },
    infoLabel: {
        color: "#888",
        fontSize: 13,
    },
    infoValue: {
        color: "#fff",
        fontSize: 13,
        textTransform: "capitalize",
    },
    settingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    settingLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    settingLabel: {
        color: "#fff",
        fontSize: 14,
    },
    settingValue: {
        color: "#888",
        fontSize: 13,
    },
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: "#ef4444",
        borderRadius: 12,
        paddingVertical: 14,
    },
    logoutText: {
        color: "#ef4444",
        fontSize: 15,
        fontWeight: "600",
    },
    appInfo: {
        alignItems: "center",
        gap: 4,
        paddingBottom: 8,
    },
    appInfoText: {
        color: "#555",
        fontSize: 12,
    },
});