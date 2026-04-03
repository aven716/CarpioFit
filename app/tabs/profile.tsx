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
    Dimensions,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, Circle as SvgCircle, Line as SvgLine } from "react-native-svg";
import { supabase } from "../../lib/supabase";

interface UserData {
    name: string;
    age: string;
    gender: string;
    currentWeight: string;
    goalWeight: string;
    fitnessGoal: string;
}

interface StatsData {
    totalWorkouts: number;
    totalDistanceKm: number;
    totalActiveDays: number;
    currentStreak: number;
    totalCaloriesBurned: number; // ← NEW: aggregated from daily_stats
    totalActiveMinutes: number; // ← ADD
}

interface AchievementItem {
    icon: any;
    label: string;
    color: string;
    earned: boolean;
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
        <View style={{ height, backgroundColor: trackColor, borderRadius: 99, overflow: "hidden" }}>
            <View
                style={{ width: `${clamped}%`, height, backgroundColor: fillColor, borderRadius: 99 }}
            />
        </View>
    );
}
const PROFILE_SCREEN_WIDTH = Dimensions.get("window").width;

function WeightMiniChart({ logs, goalWeight }: {
    logs: { weight_kg: number; logged_at: string }[];
    goalWeight: number;
}) {
    const W = PROFILE_SCREEN_WIDTH - 80;
    const H = 80;
    const pL = 8, pR = 8, pT = 8, pB = 8;
    const iW = W - pL - pR;
    const iH = H - pT - pB;

    const values = logs.map((l) => l.weight_kg);
    const allValues = [...values, goalWeight].filter(v => v > 0);
    if (allValues.length === 0) return null;

    const minV = Math.min(...allValues) - 1;
    const maxV = Math.max(...allValues) + 1;

    const tx = (i: number) => pL + (i / Math.max(logs.length - 1, 1)) * iW;
    const ty = (v: number) => pT + iH - ((v - minV) / (maxV - minV)) * iH;

    const pts = logs.map((l, i) => ({ x: tx(i), y: ty(l.weight_kg) }));
    const linePath = pts.reduce((acc, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        const prev = pts[i - 1];
        const cx = (prev.x + pt.x) / 2;
        return `${acc} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, "");

    const goalY = goalWeight > 0 ? ty(goalWeight) : null;

    return (
        <Svg width={W} height={H}>
            <Defs>
                <LinearGradient id="wmc" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                    <Stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </LinearGradient>
            </Defs>
            {goalY !== null && (
                <SvgLine x1={pL} y1={goalY} x2={W - pR} y2={goalY} stroke="#22c55e" strokeWidth="1" strokeDasharray="3,2" />
            )}
            {pts.length > 1 && (
                <Path
                    d={`${linePath} L${pts[pts.length - 1].x},${pT + iH} L${pL},${pT + iH} Z`}
                    fill="url(#wmc)"
                />
            )}
            <Path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            {pts.map((pt, i) => (
                <SvgCircle
                    key={i} cx={pt.x} cy={pt.y}
                    r={i === pts.length - 1 ? 4 : 2}
                    fill={i === pts.length - 1 ? "#22c55e" : "#3b82f6"}
                    stroke={i === pts.length - 1 ? "#22c55e" : "#3b82f6"}
                    strokeWidth="1"
                />
            ))}
        </Svg>
    );
}
export default function Profile() {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [statsData, setStatsData] = useState<StatsData>({
        totalWorkouts: 0,
        totalDistanceKm: 0,
        totalActiveDays: 0,
        currentStreak: 0,
        totalCaloriesBurned: 0,
        totalActiveMinutes: 0, // ← ADD
    });
    const [achievements, setAchievements] = useState<AchievementItem[]>([]);
    const [notifications, setNotifications] = useState(true);
    const [loading, setLoading] = useState(true);
    const [weightLogs, setWeightLogs] = useState<{ id: string; weight_kg: number; logged_at: string }[]>([]);

    useEffect(() => {
        const loadAllData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData.user;
            if (!user) return;

            const [
                profileRes,
                workoutsRes,
                streakRes,
                userAchievementsRes,
                allAchievementsRes,
                dailyStatsRes,
                weightLogsRes   // ← NEW: fetch all daily_stats rows for this user
            ] = await Promise.all([
                // Profile
                supabase
                    .from("profiles")
                    .select("first_name, age, gender, weight_kg, goal_weight, goal")
                    .eq("id", user.id)
                    .single(),

                // All completed workouts for totals
                supabase
                    .from("workouts")
                    .select("distance_km")
                    .eq("user_id", user.id)
                    .eq("completed", true),

                    
                
                // Streak
                supabase
                    .from("streaks")
                    .select("current_streak, total_active_days")
                    .eq("user_id", user.id)
                    .single(),

                // User's earned achievements
                supabase
                    .from("user_achievements")
                    .select("achievement_id")
                    .eq("user_id", user.id),

                // All achievement definitions
                supabase
                    .from("achievements")
                    .select("id, key, name, icon, category"),

                // ← NEW: All daily stats rows to aggregate calories_burned
                supabase
                    .from("daily_stats")
                    .select("calories_burned, active_minutes, steps, distance_km, calories_intake, protein_g, carbs_g, fat_g")
                    .eq("user_id", user.id),

                supabase
                    .from("weight_logs")
                    .select("id, weight_kg, logged_at")
                    .eq("user_id", user.id)
                    .order("logged_at", { ascending: true }),
            ]);

            // Set profile
            if (profileRes.data) {
                setUserData({
                    name: profileRes.data.first_name ?? "User",
                    age: profileRes.data.age?.toString() ?? "--",
                    gender: profileRes.data.gender ?? "--",
                    currentWeight: profileRes.data.weight_kg?.toString() ?? "--",
                    goalWeight: profileRes.data.goal_weight?.toString() ?? "--",
                    fitnessGoal: profileRes.data.goal ?? "",
                });
            }


            if (weightLogsRes.data) {
                setWeightLogs(weightLogsRes.data);
            }

            // Aggregate total calories burned across ALL days in daily_stats
        

            // Workout totals from workouts table
            const totalWorkouts = workoutsRes.data?.length ?? 0;
            const totalDistanceKm =
                workoutsRes.data?.reduce(
                    (sum, w) => sum + (Number(w.distance_km) || 0),
                    0
                ) ?? 0;

            const totalCaloriesBurned = dailyStatsRes.data
                ?.reduce((sum, row) => sum + (Number(row.calories_burned) || 0), 0) ?? 0;

            const totalActiveMinutes = dailyStatsRes.data
                ?.reduce((sum, row) => sum + (Number(row.active_minutes) || 0), 0) ?? 0;

            // Count days that had actual activity (more accurate than streaks table)
            const activeDaysFromStats = dailyStatsRes.data
                ?.filter(row => (Number(row.calories_burned) || 0) > 0 || (Number(row.active_minutes) || 0) > 0)
                .length ?? 0;

            setStatsData({
                totalWorkouts,
                totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
                totalActiveDays: streakRes.data?.total_active_days ?? activeDaysFromStats,
                currentStreak: streakRes.data?.current_streak ?? 0,
                totalCaloriesBurned: Math.round(totalCaloriesBurned),
                totalActiveMinutes: Math.round(totalActiveMinutes),
            });

            // Build achievements list — show up to 4, mark earned ones
            if (allAchievementsRes.data) {
                const earnedIds = new Set(
                    userAchievementsRes.data?.map((ua) => ua.achievement_id) ?? []
                );

                const iconMap: Record<string, any> = {
                    early_bird: Zap,
                    goal_setter: Target,
                    streak_3: Flame,
                    streak_7: Flame,
                    streak_30: Trophy,
                    first_workout: Trophy,
                    "10k_steps": TrendingUp,
                    calorie_crusher: Flame,
                    distance_5k: Award,
                };

                const colorMap: Record<string, string> = {
                    early_bird: "#3b82f6",
                    goal_setter: "#22c55e",
                    streak_3: "#f97316",
                    streak_7: "#f97316",
                    streak_30: "#eab308",
                    first_workout: "#eab308",
                    "10k_steps": "#22c55e",
                    calorie_crusher: "#f97316",
                    distance_5k: "#a855f7",
                };

                const mapped: AchievementItem[] = allAchievementsRes.data
                    .slice(0, 4)
                    .map((a) => ({
                        icon: iconMap[a.key] ?? Trophy,
                        label: a.name,
                        color: colorMap[a.key] ?? "#888",
                        earned: earnedIds.has(a.id),
                    }));

                setAchievements(mapped);
            }

            setLoading(false);
        };

        loadAllData();
    }, []);

    const handleLogout = async () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await supabase.auth.signOut();
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

    // ── Stats now include total calories burned ──────────────────────
    const stats = [
        { label: "Workouts", value: statsData.totalWorkouts.toString(), icon: TrendingUp },
        { label: "Total Distance", value: `${statsData.totalDistanceKm} km`, icon: Target },
        { label: "Active Days", value: statsData.totalActiveDays.toString(), icon: Award },
        {
            label: "Total Burned",
            value: statsData.totalCaloriesBurned >= 1000
                ? `${(statsData.totalCaloriesBurned / 1000).toFixed(1)}k`
                : statsData.totalCaloriesBurned.toString(),
            icon: Flame,
        },
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
                            {userData?.fitnessGoal
                                ? fitnessGoalLabel[userData.fitnessGoal] ?? ""
                                : ""}
                        </Text>
                        <Text style={styles.streakText}>
                            🔥 {statsData.currentStreak} day streak
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn}>
                        <Settings size={20} color="#888" />
                    </TouchableOpacity>
                </View>

                {/* Goal Progress */}
                {/* Weight Progress Card */}
                <View style={styles.progressCard}>
                    <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Weight Progress</Text>
                        <Text style={styles.progressValue}>
                            {userData?.currentWeight || "--"} → {userData?.goalWeight || "--"} kg
                        </Text>
                    </View>
                    <ProgressBar value={weightProgress} />

                    {/* Weight trend mini chart */}
                    {weightLogs.length >= 2 && (
                        <View style={{ marginTop: 12 }}>
                            <WeightMiniChart
                                logs={weightLogs}
                                goalWeight={parseFloat(userData?.goalWeight ?? "0")}
                            />
                        </View>
                    )}

                    {/* Recent logs */}
                    {weightLogs.length > 0 && (
                        <View style={styles.weightMiniList}>
                            {weightLogs.slice(-3).reverse().map((log, i) => (
                                <View key={log.id} style={styles.weightMiniItem}>
                                    <View style={[styles.weightMiniDot, { backgroundColor: i === 0 ? "#22c55e" : "#3b82f6" }]} />
                                    <Text style={styles.weightMiniWeight}>{log.weight_kg} kg</Text>
                                    <Text style={styles.weightMiniDate}>
                                        {new Date(log.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* ── Calories Burned Banner ─────────────────────────────── */}
                <View style={styles.caloriesBurnedBanner}>
                    <Flame size={18} color="#f97316" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.caloriesBurnedLabel}>Total Calories Burned</Text>
                        <Text style={styles.caloriesBurnedValue}>
                            {statsData.totalCaloriesBurned.toLocaleString()} kcal
                        </Text>
                    </View>
                    <Text style={styles.caloriesBurnedSub}>all time</Text>
                </View>
            </View>

            <View style={styles.body}>
                {/* Activity Stats — now 2×2 grid to fit 4 items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Stats</Text>
                    <View style={styles.statsGrid}>
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <View key={stat.label} style={styles.statCard}>
                                    <Icon
                                        size={20}
                                        color={stat.label === "Total Burned" ? "#f97316" : "#22c55e"}
                                    />
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
                    {achievements.length === 0 ? (
                        <View style={[styles.card, { padding: 24, alignItems: "center" }]}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
                            <Text style={{ color: "#888", fontSize: 14 }}>No achievements yet</Text>
                        </View>
                    ) : (
                        <View style={styles.achievementsGrid}>
                            {achievements.map((a) => {
                                const Icon = a.icon;
                                return (
                                    <View
                                        key={a.label}
                                        style={[
                                            styles.achievementCard,
                                            !a.earned && { opacity: 0.4 },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.achievementIcon,
                                                {
                                                    backgroundColor: a.earned
                                                        ? "rgba(34,197,94,0.1)"
                                                        : "#2a2a2a",
                                                },
                                            ]}
                                        >
                                            <Icon size={24} color={a.color} />
                                        </View>
                                        <Text style={styles.achievementLabel}>{a.label}</Text>
                                        {a.earned && (
                                            <Text style={styles.earnedText}>Earned ✓</Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
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
                                style={[
                                    styles.infoRow,
                                    i < arr.length - 1 && styles.infoRowBorder,
                                ]}
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
                                    style={[
                                        styles.settingRow,
                                        i < arr.length - 1 && styles.infoRowBorder,
                                    ]}
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
        borderRadius: 16,
        marginTop: 40,
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
        gap: 4,
    },
    userName: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "600",
    },
    userGoal: {
        color: "#888",
        fontSize: 13,
    },
    streakText: {
        color: "#f97316",
        fontSize: 12,
        fontWeight: "500",
    },
    settingsBtn: {
        padding: 8,
    },
    progressCard: {
        backgroundColor: "#1a3329",
        borderRadius: 12,
        padding: 16,
        gap: 10,
        marginBottom: 12,
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
    // ── NEW: Calories burned banner ─────────────────────────────────
    caloriesBurnedBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(249,115,22,0.1)",
        borderRadius: 12,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: "rgba(249,115,22,0.2)",
    },
    caloriesBurnedLabel: {
        color: "#888",
        fontSize: 12,
    },
    caloriesBurnedValue: {
        color: "#f97316",
        fontSize: 18,
        fontWeight: "700",
        marginTop: 2,
    },
    caloriesBurnedSub: {
        color: "#555",
        fontSize: 11,
    },
    body: {
        padding: 16,
        gap: 24,
    },
    section: {
        gap: 12,
        borderRadius: 16,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    // ── 2×2 grid for 4 stat cards ────────────────────────────────────
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    statCard: {
        width: "47.5%",
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
        color: "#22c55e",
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

    weightMiniList: {
        marginTop: 10, gap: 6, paddingTop: 10,
        borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
    },
    weightMiniItem: {
        flexDirection: "row", alignItems: "center", gap: 8,
    },
    weightMiniDot: {
        width: 7, height: 7, borderRadius: 4,
    },
    weightMiniWeight: {
        color: "#fff", fontSize: 13, fontWeight: "600", flex: 1,
    },
    weightMiniDate: {
        color: "#555", fontSize: 11,
    },
});