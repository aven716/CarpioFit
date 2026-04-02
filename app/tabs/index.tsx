import { useNavigation } from "@react-navigation/native";
import { StatusBar } from 'expo-status-bar';
import { Activity, ChevronRight, Flame, Plus, Target, TrendingUp } from "lucide-react-native";
import { useContext, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { fetchOrGenerateWorkoutPlan, WorkoutPlan } from "../../lib/workoutPlan";
import { PedometerContext } from "./_layout";

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

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      <View style={[styles.progressFill, { width: `${clamped}%`, height, backgroundColor: fillColor }]} />
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

// ─── Compact Plan Card ────────────────────────
function CompactPlanCard({ plan, onViewFull }: { plan: WorkoutPlan | null; onViewFull: () => void }) {
  const todayIndex = (new Date().getDay() + 6) % 7;

  if (!plan) {
    return (
      <View style={styles.planCard}>
        <View style={styles.planCardHeader}>
          <Text style={styles.planCardTitle}>📋 Your Weekly Plan</Text>
          <TouchableOpacity onPress={onViewFull}>
            <Text style={styles.viewFullBtn}>View Full</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: "#555", fontSize: 13 }}>Generating your personalized plan...</Text>
      </View>
    );
  }

  const today = plan.weekPlan[todayIndex];

  return (
    <View style={styles.planCard}>
      <View style={styles.planCardHeader}>
        <Text style={styles.planCardTitle}>📋 Your Weekly Plan</Text>
        <TouchableOpacity style={styles.viewFullRow} onPress={onViewFull}>
          <Text style={styles.viewFullBtn}>Full Plan</Text>
          <ChevronRight size={14} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <View style={styles.todayBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayLabel}>Today — {today?.day ?? "—"}</Text>
          <Text style={styles.todayFocus}>
            {today?.isRest ? "😴 Rest & Recovery" : today?.focus ?? "—"}
          </Text>
          {!today?.isRest && today?.exercises && today.exercises.length > 0 && (
            <Text style={styles.todayExCount}>
              {today.exercises.length} exercises
            </Text>
          )}
        </View>
        <View style={[styles.todayBadge, today?.isRest && styles.todayBadgeRest]}>
          <Text style={styles.todayBadgeText}>{today?.isRest ? "Rest" : "Active"}</Text>
        </View>
      </View>

      <View style={styles.dayStrip}>
        {plan.weekPlan.map((d, i) => (
          <View key={d.day} style={[styles.dayPill, i === todayIndex && styles.dayPillToday]}>
            <Text style={[styles.dayPillLabel, i === todayIndex && styles.dayPillLabelToday]}>
              {DAYS_SHORT[i]}
            </Text>
            <Text style={styles.dayPillDot}>{d.isRest ? "😴" : "💪"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Home() {
  const navigation = useNavigation<any>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    caloriesBurned: 0, steps: 0, activeMinutes: 0, distanceKm: 0,
  });
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutItem[]>([]);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [macrosConsumed, setMacrosConsumed] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);

  // Track last synced values to avoid redundant writes
  const lastSyncedSteps = useRef(0);
  const lastSyncedCalories = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { steps, distanceKm, caloriesBurned, isAvailable } = useContext(PedometerContext);

  const calorieGoal = userData?.dailyCalories ?? 2000;

  // Use pedometer value when available, otherwise fall back to DB value
  const effectiveCaloriesBurned = isAvailable ? caloriesBurned : dailyStats.caloriesBurned;
  const effectiveSteps = isAvailable ? steps : dailyStats.steps;
  const effectiveDistanceKm = isAvailable ? distanceKm : dailyStats.distanceKm;

  const caloriesRemaining = calorieGoal - caloriesConsumed + effectiveCaloriesBurned;

  const macros = [
    { name: "Carbs", consumed: macrosConsumed.carbs, goal: userData?.dailyCarbs ?? 250, color: "#3b82f6", label: "g" },
    { name: "Protein", consumed: macrosConsumed.protein, goal: userData?.dailyProtein ?? 150, color: "#f97316", label: "g" },
    { name: "Fat", consumed: macrosConsumed.fat, goal: userData?.dailyFat ?? 70, color: "#a855f7", label: "g" },
  ];

  // ─── Debounced sync: pedometer → daily_stats ─────────────────────
  // Writes steps, calories_burned, and distance_km to the DB.
  // Debounced by 5 s to avoid hammering Supabase on every step.
  useEffect(() => {
    if (!isAvailable || !userId) return;
    if (steps === 0 && caloriesBurned === 0) return;

    // Only sync if values changed meaningfully
    const stepsDiff = Math.abs(steps - lastSyncedSteps.current);
    const calDiff = Math.abs(caloriesBurned - lastSyncedCalories.current);
    if (stepsDiff < 10 && calDiff < 1) return;

    // Debounce: clear any pending timer
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("daily_stats").upsert(
        {
          user_id: userId,
          date: today,
          steps,
          calories_burned: Math.round(caloriesBurned * 10) / 10,
          distance_km: Math.round(distanceKm * 100) / 100,
        },
        { onConflict: "user_id,date" }
      );

      if (!error) {
        lastSyncedSteps.current = steps;
        lastSyncedCalories.current = caloriesBurned;
        // Update local dailyStats so the rest of the UI stays in sync
        setDailyStats((prev) => ({
          ...prev,
          steps,
          caloriesBurned: Math.round(caloriesBurned * 10) / 10,
          distanceKm: Math.round(distanceKm * 100) / 100,
        }));
      }
    }, 5000); // 5-second debounce

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [steps, caloriesBurned, distanceKm, isAvailable, userId]);

  // ─── Load all data on mount ───────────────────────────────────────
  useEffect(() => {
    const loadAllData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;
      setUserId(user.id);

      const today = new Date().toISOString().split("T")[0];

      const [profileRes, dailyStatsRes, workoutsRes, foodLogsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name, age, gender, weight_kg, goal_weight, goal, activity_level, height_cm, daily_calories, daily_protein, daily_fat, daily_carbs"
          )
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
          .from("food_logs")
          .select("calories, protein_g, carbs_g, fat_g, logged_at")
          .eq("user_id", user.id),
      ]);

      if (profileRes.data) {
        const p = profileRes.data;
        setUserProfile(p);
        setUserData({
          name: p.first_name,
          age: p.age?.toString() ?? "",
          currentWeight: p.weight_kg?.toString() ?? "",
          goalWeight: p.goal_weight?.toString() ?? "",
          fitnessGoal: p.goal ?? "",
          dailyCalories: p.daily_calories ?? 2000,
          dailyProtein: p.daily_protein ?? 150,
          dailyFat: p.daily_fat ?? 70,
          dailyCarbs: p.daily_carbs ?? 250,
        });

        const plan = await fetchOrGenerateWorkoutPlan(user.id, p);
        setWorkoutPlan(plan);
      }

      // Load today's stats from DB (used as fallback when pedometer unavailable)
      if (dailyStatsRes.data) {
        const ds = dailyStatsRes.data;
        setDailyStats({
          caloriesBurned: Number(ds.calories_burned) || 0,
          steps: ds.steps || 0,
          activeMinutes: ds.active_minutes || 0,
          distanceKm: Number(ds.distance_km) || 0,
        });
        // Seed last-synced refs so we don't immediately re-write unchanged data
        lastSyncedSteps.current = ds.steps || 0;
        lastSyncedCalories.current = Number(ds.calories_burned) || 0;
      }

      if (foodLogsRes.data) {
        const todayStart = new Date(today);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(todayStart.getDate() + 1);
        const todayLogs = foodLogsRes.data.filter((log) => {
          const logDate = new Date(log.logged_at);
          return logDate >= todayStart && logDate < tomorrow;
        });
        const totals = todayLogs.reduce(
          (acc, item) => ({
            calories: acc.calories + Number(item.calories || 0),
            protein: acc.protein + Number(item.protein_g || 0),
            carbs: acc.carbs + Number(item.carbs_g || 0),
            fat: acc.fat + Number(item.fat_g || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        setCaloriesConsumed(totals.calories);
        setMacrosConsumed({ protein: totals.protein, carbs: totals.carbs, fat: totals.fat });
      }

      if (workoutsRes.data && workoutsRes.data.length > 0) {
        setTodayWorkouts(
          workoutsRes.data.map((w) => ({
            name: w.name,
            type: w.type ?? "general",
            duration: w.duration_minutes ? `${w.duration_minutes} min` : "--",
            time: new Date(w.created_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))
        );
      }
    };

    loadAllData();
  }, []);

  const statsCards = [
    {
      icon: "flame",
      label: "Calories Burned",
      value: Math.round(effectiveCaloriesBurned).toString(),
      unit: "kcal",
      color: "#f97316",
    },
    {
      icon: "footprints",
      label: "Steps Today",
      value: effectiveSteps.toLocaleString(),
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

      <View style={styles.header}>
        <Text style={styles.greeting}>Hey, {userData?.name || "there"}! 👋</Text>
        <Text style={styles.subGreeting}>Ready to crush your goals today?</Text>
      </View>

      {/* ── Calorie Card ── */}
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
                  ? `${Math.round(caloriesRemaining)} remaining`
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

        <View style={styles.calorieSummaryRow}>
          <View style={styles.calorieSummaryItem}>
            <Text style={styles.calorieSummaryValue}>{calorieGoal}</Text>
            <Text style={styles.calorieSummaryLabel}>Goal</Text>
          </View>
          <Text style={styles.calorieSummaryOp}>−</Text>
          <View style={styles.calorieSummaryItem}>
            <Text style={styles.calorieSummaryValue}>{Math.round(caloriesConsumed)}</Text>
            <Text style={styles.calorieSummaryLabel}>Eaten</Text>
          </View>
          <Text style={styles.calorieSummaryOp}>+</Text>
          <View style={styles.calorieSummaryItem}>
            <Text style={[styles.calorieSummaryValue, { color: "#f97316" }]}>
              {Math.round(effectiveCaloriesBurned)}
            </Text>
            <Text style={styles.calorieSummaryLabel}>Burned</Text>
          </View>
          <Text style={styles.calorieSummaryOp}>=</Text>
          <View style={styles.calorieSummaryItem}>
            <Text
              style={[
                styles.calorieSummaryValue,
                { color: caloriesRemaining >= 0 ? "#22c55e" : "#ef4444" },
              ]}
            >
              {Math.round(caloriesRemaining)}
            </Text>
            <Text style={styles.calorieSummaryLabel}>Left</Text>
          </View>
        </View>

        <View style={styles.calorieProgress}>
          <View style={styles.calorieProgressLabels}>
            <Text style={styles.calorieLabel}>
              {Math.round(caloriesConsumed)} eaten of {calorieGoal} kcal goal
            </Text>
          </View>
          <ProgressBar
            value={(caloriesConsumed / (calorieGoal + effectiveCaloriesBurned)) * 100}
            height={12}
          />
        </View>

        <View style={styles.macrosContainer}>
          {macros.map((macro) => (
            <View key={macro.name} style={styles.macroItem}>
              <Text style={styles.macroName}>{macro.name}</Text>
              <Text style={styles.macroValue}>
                {Math.round(macro.consumed)}/{macro.goal}{macro.label}
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

      {/* ── Stats Grid ── */}
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

      {/* ── Weekly Plan Card ── */}
      <CompactPlanCard
        plan={workoutPlan}
        onViewFull={() => navigation.navigate("Calendar")}
      />

      {/* ── Weight Goal Card ── */}
      <View style={[styles.card, styles.darkCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(34,197,94,0.1)" }]}>
            <Target size={20} color="#22c55e" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Weight Goal</Text>
            <Text style={styles.cardSub}>
              {userData?.fitnessGoal ? fitnessGoalLabel[userData.fitnessGoal] ?? "" : ""}
            </Text>
          </View>
        </View>
        <View style={styles.weightRow}>
          <View>
            <Text style={styles.weightValue}>{userData?.currentWeight ?? "--"}</Text>
            <Text style={styles.weightLabel}>Current (kg)</Text>
          </View>
          <TrendingUp size={24} color="#22c55e" />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.weightValue}>{userData?.goalWeight ?? "--"}</Text>
            <Text style={styles.weightLabel}>Goal (kg)</Text>
          </View>
        </View>
        <ProgressBar
          value={
            userData?.currentWeight && userData?.goalWeight
              ? ((parseFloat(userData.currentWeight) - parseFloat(userData.goalWeight)) /
                parseFloat(userData.currentWeight)) *
              100
              : 0
          }
          trackColor="rgba(255,255,255,0.1)"
          fillColor="#22c55e"
        />
      </View>

      {/* ── Today's Workouts ── */}
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
                  workout.type === "cardio" ? styles.cardioBadge : styles.strengthBadge,
                ]}
              >
                <Text
                  style={[
                    styles.workoutBadgeText,
                    workout.type === "cardio" ? styles.cardioText : styles.strengthText,
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
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 16, gap: 16, paddingBottom: 80, paddingTop: 30 },
  header: { paddingTop: 16 },
  greeting: { fontSize: 24, color: "#ffffff", fontWeight: "600" },
  subGreeting: { fontSize: 14, color: "#888", marginTop: 4 },

  // Plan card
  planCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  planCardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  viewFullRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewFullBtn: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
  todayBox: {
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.15)",
    marginBottom: 14,
  },
  todayLabel: { color: "#888", fontSize: 11, marginBottom: 3 },
  todayFocus: { color: "#fff", fontSize: 14, fontWeight: "700" },
  todayExCount: { color: "#22c55e", fontSize: 12, marginTop: 3 },
  todayBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  todayBadgeRest: {
    backgroundColor: "rgba(107,114,128,0.15)",
    borderColor: "rgba(107,114,128,0.3)",
  },
  todayBadgeText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  dayStrip: { flexDirection: "row", justifyContent: "space-between" },
  dayPill: { alignItems: "center", flex: 1, paddingVertical: 6, borderRadius: 8 },
  dayPillToday: { backgroundColor: "rgba(34,197,94,0.12)" },
  dayPillLabel: { color: "#555", fontSize: 10, marginBottom: 3 },
  dayPillLabelToday: { color: "#22c55e", fontWeight: "700" },
  dayPillDot: { fontSize: 14 },

  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  darkCard: { backgroundColor: "#1a1a1a" },
  calorieCard: { backgroundColor: "#1a3329" },
  calorieCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calorieCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  calorieCardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  calorieCardSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  logFoodBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  logFoodBtnText: { color: "#1a3329", fontSize: 13, fontWeight: "600", marginLeft: 4 },
  calorieSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  calorieSummaryItem: { alignItems: "center", flex: 1 },
  calorieSummaryValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  calorieSummaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  calorieSummaryOp: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 16,
    fontWeight: "300",
    paddingHorizontal: 2,
  },
  calorieProgress: { gap: 8, marginBottom: 4 },
  calorieProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calorieLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  calorieValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
  macrosContainer: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    gap: 8,
  },
  macroItem: { flex: 1, gap: 4 },
  macroName: { color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center", marginBottom: 2 },
  macroValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#1a1a1a", gap: 4 },
  statValue: { fontSize: 20, color: "#fff", fontWeight: "700", marginTop: 6 },
  statUnit: { fontSize: 11, color: "#888" },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cardSub: { color: "#888", fontSize: 12, marginTop: 2 },
  weightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  weightValue: { fontSize: 30, color: "#fff", fontWeight: "700" },
  weightLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  workoutsSection: { gap: 10 },
  workoutsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  viewAllBtn: { color: "#22c55e", fontSize: 14 },
  workoutCard: {
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutName: { color: "#fff", fontSize: 14, fontWeight: "500", marginBottom: 4 },
  workoutMeta: { color: "#888", fontSize: 12 },
  workoutBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  workoutBadgeText: { fontSize: 12, fontWeight: "500" },
  cardioBadge: { backgroundColor: "rgba(249,115,22,0.1)" },
  cardioText: { color: "#f97316" },
  strengthBadge: { backgroundColor: "rgba(59,130,246,0.1)" },
  strengthText: { color: "#3b82f6" },
  progressTrack: { borderRadius: 99, overflow: "hidden", width: "100%" },
  progressFill: { borderRadius: 99 },
});