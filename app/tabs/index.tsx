import { useNavigation } from "@react-navigation/native";
import { StatusBar } from 'expo-status-bar';
import { Activity, Flame, Plus, Target, TrendingUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { usePedometer } from "../../lib/usePedometer";
const { width } = Dimensions.get("window");


interface UserData {
  name: string;
  age: string;
  currentWeight: string;
  goalWeight: string;
  fitnessGoal: string;
  dailyCalories: number;
  dailyProtein: number;
  dailyFat: number;
  dailyCarbs: number;
}

interface DailyStats {
  caloriesBurned: number;
  steps: number;
  activeMinutes: number;
  distanceKm: number;
}

interface WorkoutItem {
  name: string;
  time: string;
  duration: string;
  type: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
}

function ProgressBar({
  value,
  height = 8,
  trackColor = "rgba(255,255,255,0.2)",
  fillColor = "#fff",
}: {
  value: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <View style={[styles.progressTrack, { height, backgroundColor: trackColor }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${clamped}%`, height, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

function FootprintsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16 }}>👣</Text>
    </View>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16 }}>🍎</Text>
    </View>
  );
}

export default function Home() {
  const navigation = useNavigation<any>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    caloriesBurned: 0,
    steps: 0,
    activeMinutes: 0,
    distanceKm: 0,
  });
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutItem[]>([]);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    totalActiveDays: 0,
  });
  const [caloriesConsumed] = useState(0);

  const calorieGoal = userData?.dailyCalories ?? 2000;
  const caloriesRemaining = calorieGoal - caloriesConsumed;

  const macros = [
    { name: "Carbs", consumed: 0, goal: userData?.dailyCarbs ?? 250, color: "#3b82f6", label: "g" },
    { name: "Protein", consumed: 0, goal: userData?.dailyProtein ?? 150, color: "#f97316", label: "g" },
    { name: "Fat", consumed: 0, goal: userData?.dailyFat ?? 70, color: "#a855f7", label: "g" },
  ];
  const { steps, distanceKm, caloriesBurned, goalProgress, isAvailable, isLoading } = usePedometer();
 
  useEffect(() => {
    if (!isAvailable || steps === 0) return;

    const syncSteps = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      await supabase.from("daily_stats").upsert({
        user_id: user.id,
        date: today,
        steps: steps,
        calories_burned: caloriesBurned,
        distance_km: distanceKm,
      });
    };

    if (steps % 20 === 0) syncSteps();
  }, [steps]);
 
 
  useEffect(() => {
    
    const loadAllData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      // Fetch all data in parallel
      const [profileRes, dailyStatsRes, workoutsRes, streakRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, age, weight_kg, goal_weight, goal, daily_calories, daily_protein, daily_fat, daily_carbs")
          .eq("id", user.id)
          .single(),

        supabase
          .from("daily_stats")
          .select("calories_burned, steps, active_minutes, distance_km")
          .eq("user_id", user.id)
          .eq("date", today)
          .single(),

        supabase
          .from("workouts")
          .select("name, type, duration_minutes, created_at")
          .eq("user_id", user.id)
          .eq("date", today)
          .order("created_at", { ascending: true }),

        supabase
          .from("streaks")
          .select("current_streak, longest_streak, total_active_days")
          .eq("user_id", user.id)
          .single(),
      ]);

      // Set profile
      if (profileRes.data) {
        setUserData({
          name: profileRes.data.first_name,
          age: profileRes.data.age?.toString() ?? "",
          currentWeight: profileRes.data.weight_kg?.toString() ?? "",
          goalWeight: profileRes.data.goal_weight?.toString() ?? "",
          fitnessGoal: profileRes.data.goal ?? "",
          dailyCalories: profileRes.data.daily_calories ?? 2000,
          dailyProtein: profileRes.data.daily_protein ?? 150,
          dailyFat: profileRes.data.daily_fat ?? 70,
          dailyCarbs: profileRes.data.daily_carbs ?? 250,
        });
      }

      // Set daily stats (if no row yet for today, defaults stay 0)
      if (dailyStatsRes.data) {
        setDailyStats({
          caloriesBurned: Number(dailyStatsRes.data.calories_burned) ?? 0,
          steps: dailyStatsRes.data.steps ?? 0,
          activeMinutes: dailyStatsRes.data.active_minutes ?? 0,
          distanceKm: Number(dailyStatsRes.data.distance_km) ?? 0,
        });
      }

      // Set today's workouts
      if (workoutsRes.data && workoutsRes.data.length > 0) {
        const formatted: WorkoutItem[] = workoutsRes.data.map((w) => ({
          name: w.name,
          type: w.type ?? "general",
          duration: w.duration_minutes ? `${w.duration_minutes} min` : "--",
          time: new Date(w.created_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setTodayWorkouts(formatted);
      }

      // Set streak
      if (streakRes.data) {
        setStreakData({
          currentStreak: streakRes.data.current_streak ?? 0,
          longestStreak: streakRes.data.longest_streak ?? 0,
          totalActiveDays: streakRes.data.total_active_days ?? 0,
        });
      }
    };

    loadAllData();
    
  }, []);

  const statsCards = [
    {
      icon: "flame",
      label: "Calories Burned",
      value: isAvailable ? caloriesBurned.toString() : dailyStats.caloriesBurned.toString(),
      unit: "kcal",
      color: "#f97316",
    },
    {
      icon: "footprints",
      label: "Steps Today",
      value: isAvailable ? steps.toLocaleString() : dailyStats.steps.toLocaleString(),
      unit: "steps",
      color: "#22c55e",
    },
    {
      icon: "activity",
      label: "Active Minutes",
      value: dailyStats.activeMinutes.toString(),
      unit: "min",
      color: "#3b82f6",
    },
  ];

  const fitnessGoalLabel: Record<string, string> = {
    lose: "Losing weight",
    gain: "Gaining muscle",
    maintain: "Maintaining weight",
    endurance: "Building endurance",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hey, {userData?.name || "there"}! 👋
        </Text>
        <Text style={styles.subGreeting}>Ready to crush your goals today?</Text>
      </View>
      <View style={{ backgroundColor: "#333", padding: 10, borderRadius: 8 }}>
        <Text style={{ color: "#fff", fontSize: 12 }}>isAvailable: {isAvailable ? "true" : "false"}</Text>
        <Text style={{ color: "#fff", fontSize: 12 }}>isLoading: {isLoading ? "true" : "false"}</Text>
        <Text style={{ color: "#fff", fontSize: 12 }}>Steps: {steps}</Text>
      </View>
      {/* Calorie Card */}
      <View style={[styles.card, styles.calorieCard]}>
        <View style={styles.calorieCardHeader}>
          <View style={styles.calorieCardLeft}>
            <View style={styles.iconCircle}>
              <AppleIcon color="#fff" />
            </View>
            <View>
              <Text style={styles.calorieCardTitle}>Daily Calories</Text>
              <Text style={styles.calorieCardSub}>
                {caloriesRemaining > 0
                  ? `${caloriesRemaining} remaining`
                  : "Goal exceeded"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.logFoodBtn}
            onPress={() => navigation.navigate("Food")}
          >
            <Plus size={14} color="#1a3329" />
            <Text style={styles.logFoodBtnText}>Log Food</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calorieProgress}>
          <View style={styles.calorieProgressLabels}>
            <Text style={styles.calorieLabel}>Consumed</Text>
            <Text style={styles.calorieValue}>
              {caloriesConsumed} / {calorieGoal} kcal
            </Text>
          </View>
          <ProgressBar value={(caloriesConsumed / calorieGoal) * 100} height={12} />
        </View>

        <View style={styles.macrosContainer}>
          {macros.map((macro) => (
            <View key={macro.name} style={styles.macroItem}>
              <Text style={styles.macroName}>{macro.name}</Text>
              <Text style={styles.macroValue}>
                {macro.consumed}/{macro.goal}{macro.label}
              </Text>
              <ProgressBar
                value={(macro.consumed / macro.goal) * 100}
                height={6}
                fillColor={macro.color}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {statsCards.map((stat) => (
          <View key={stat.label} style={[styles.card, styles.statCard]}>
            {stat.icon === "flame" && <Flame size={20} color={stat.color} />}
            {stat.icon === "footprints" && <FootprintsIcon color={stat.color} />}
            {stat.icon === "activity" && <Activity size={20} color={stat.color} />}
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statUnit}>{stat.unit}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Streak Card */}
     

      {/* Weight Goal Card */}
      <View style={[styles.card, styles.darkCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(34,197,94,0.1)" }]}>
            <Target size={20} color="#22c55e" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Weight Goal</Text>
            <Text style={styles.cardSub}>
              {userData?.fitnessGoal
                ? fitnessGoalLabel[userData.fitnessGoal] ?? ""
                : ""}
            </Text>
          </View>
        </View>

        <View style={styles.weightRow}>
          <View>
            <Text style={styles.weightValue}>
              {userData?.currentWeight ?? "--"}
            </Text>
            <Text style={styles.weightLabel}>Current (kg)</Text>
          </View>
          <TrendingUp size={24} color="#22c55e" />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.weightValue}>
              {userData?.goalWeight ?? "--"}
            </Text>
            <Text style={styles.weightLabel}>Goal (kg)</Text>
          </View>
        </View>

        <ProgressBar
          value={
            userData?.currentWeight && userData?.goalWeight
              ? ((parseFloat(userData.currentWeight) -
                parseFloat(userData.goalWeight)) /
                parseFloat(userData.currentWeight)) *
              100
              : 0
          }
          trackColor="rgba(255,255,255,0.1)"
          fillColor="#22c55e"
        />
      </View>

      {/* Today's Workouts */}
      <View style={styles.workoutsSection}>
        <View style={styles.workoutsHeader}>
          <Text style={styles.sectionTitle}>Today's Workouts</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Calendar")}>
            <Text style={styles.viewAllBtn}>View All</Text>
          </TouchableOpacity>
        </View>

        {todayWorkouts.length === 0 ? (
          <View style={[styles.card, styles.darkCard, { alignItems: "center", paddingVertical: 24 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏃</Text>
            <Text style={{ color: "#888", fontSize: 14 }}>No workouts logged today</Text>
          </View>
        ) : (
          todayWorkouts.map((workout, index) => (
            <View key={index} style={[styles.card, styles.workoutCard]}>
              <View>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutMeta}>
                  {workout.time} • {workout.duration}
                </Text>
              </View>
              <View
                style={[
                  styles.workoutBadge,
                  workout.type === "cardio"
                    ? styles.cardioBadge
                    : styles.strengthBadge,
                ]}
              >
                <Text
                  style={[
                    styles.workoutBadgeText,
                    workout.type === "cardio"
                      ? styles.cardioText
                      : styles.strengthText,
                  ]}
                >
                  {workout.type}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 80,
    paddingTop: 30,
  },
  header: {
    paddingTop: 16,
  },
  greeting: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "600",
  },
  subGreeting: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  darkCard: {
    backgroundColor: "#1a1a1a",
  },
  calorieCard: {
    backgroundColor: "#1a3329",
  },
  calorieCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calorieCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  calorieCardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  calorieCardSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  logFoodBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  logFoodBtnText: {
    color: "#1a3329",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  calorieProgress: {
    gap: 8,
    marginBottom: 4,
  },
  calorieProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calorieLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  calorieValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  macrosContainer: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    gap: 8,
  },
  macroItem: {
    flex: 1,
    gap: 4,
  },
  macroName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 2,
  },
  macroValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
    marginTop: 6,
  },
  statUnit: {
    fontSize: 11,
    color: "#888",
  },
  statLabel: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  cardSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  weightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  weightValue: {
    fontSize: 30,
    color: "#fff",
    fontWeight: "700",
  },
  weightLabel: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  workoutsSection: {
    gap: 10,
  },
  workoutsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  viewAllBtn: {
    color: "#22c55e",
    fontSize: 14,
  },
  workoutCard: {
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  workoutMeta: {
    color: "#888",
    fontSize: 12,
  },
  workoutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  workoutBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardioBadge: { backgroundColor: "rgba(249,115,22,0.1)" },
  cardioText: { color: "#f97316" },
  strengthBadge: { backgroundColor: "rgba(59,130,246,0.1)" },
  strengthText: { color: "#3b82f6" },
  progressTrack: {
    borderRadius: 99,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    borderRadius: 99,
  },
});