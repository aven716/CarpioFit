import { useNavigation } from "@react-navigation/native";
import { StatusBar } from 'expo-status-bar';
import { Activity, ChevronDown, ChevronRight, ChevronUp, Flame, Plus, Target } from "lucide-react-native";
import { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, Circle as SvgCircle, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { fetchOrGenerateWorkoutPlan, WorkoutPlan } from "../../lib/workoutPlan";
import { PedometerContext } from "./_layout";

const { width } = Dimensions.get("window");
const SCREEN_WIDTH = width;

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

interface WeightLog {
  id: string;
  weight_kg: number;
  notes: string | null;
  logged_at: string;
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

// ─── Weight Mini Line Chart ───────────────────
function WeightLineChart({ logs, goalWeight }: { logs: WeightLog[]; goalWeight: number }) {
  const W = SCREEN_WIDTH - 80;
  const H = 120;
  const pL = 36, pR = 12, pT = 12, pB = 24;
  const iW = W - pL - pR;
  const iH = H - pT - pB;

  if (logs.length < 2) {
    return (
      <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#444", fontSize: 12 }}>Log at least 2 weights to see trend</Text>
      </View>
    );
  }

  const values = logs.map((l) => l.weight_kg);
  const allValues = [...values, goalWeight];
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

  const areaPath = `${linePath} L${pts[pts.length - 1].x},${pT + iH} L${pL},${pT + iH} Z`;

  // Goal line Y
  const goalY = ty(goalWeight);

  // Y ticks
  const yTicks = [minV, (minV + maxV) / 2, maxV].map((v) => ({
    y: ty(v),
    val: Math.round(v),
  }));

  // X labels — first, middle, last
  const xLabels = [0, Math.floor((logs.length - 1) / 2), logs.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => ({
      x: tx(i),
      label: new Date(logs[i].logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));

  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <SvgLine key={i} x1={pL} y1={t.y} x2={W - pR} y2={t.y} stroke="#222" strokeWidth="1" />
      ))}
      {yTicks.map((t, i) => (
        <SvgText key={`l${i}`} x={pL - 4} y={t.y + 4} fontSize="8" fill="#555" textAnchor="end">
          {t.val}
        </SvgText>
      ))}

      {/* Goal line */}
      <SvgLine x1={pL} y1={goalY} x2={W - pR} y2={goalY} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" />
      <SvgText x={W - pR + 2} y={goalY + 4} fontSize="8" fill="#22c55e" textAnchor="start">Goal</SvgText>

      {/* Area + line */}
      <Path d={areaPath} fill="url(#wg)" />
      <Path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

      {/* Dots */}
      {pts.map((pt, i) => (
        <SvgCircle
          key={i}
          cx={pt.x} cy={pt.y}
          r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? "#3b82f6" : "#111"}
          stroke="#3b82f6" strokeWidth="1.5"
        />
      ))}

      {/* X labels */}
      {xLabels.map((xl, i) => (
        <SvgText key={i} x={xl.x} y={H - 4} fontSize="8" fill="#555" textAnchor="middle">
          {xl.label}
        </SvgText>
      ))}
    </Svg>
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
            <Text style={styles.todayExCount}>{today.exercises.length} exercises</Text>
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

// ─── Weight Goal Card ─────────────────────────
function WeightGoalCard({
  userData,
  userId,
  onWeightUpdated,
}: {
  userData: UserData | null;
  userId: string | null;
  onWeightUpdated: (newWeight: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentWeight = parseFloat(userData?.currentWeight ?? "0");
  const goalWeight = parseFloat(userData?.goalWeight ?? "0");
  const startWeight = weightLogs.length > 0
    ? weightLogs[0].weight_kg
    : currentWeight;

  const totalToLose = Math.abs(startWeight - goalWeight);
  const lost = Math.abs(startWeight - currentWeight);
  const progressPercent = totalToLose > 0 ? Math.min((lost / totalToLose) * 100, 100) : 0;

  const diff = currentWeight - goalWeight;
  const diffText = diff > 0
    ? `${diff.toFixed(1)} kg to go`
    : diff < 0
      ? `${Math.abs(diff).toFixed(1)} kg past goal! 🎉`
      : "Goal reached! 🎉";

  useEffect(() => {
    if (expanded && userId) loadWeightLogs();
  }, [expanded, userId]);

  const loadWeightLogs = async () => {
    if (!userId) return;
    setLoadingLogs(true);
    const { data } = await supabase
      .from("weight_logs")
      .select("id, weight_kg, notes, logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true });
    setWeightLogs(data ?? []);
    setLoadingLogs(false);
  };

  const handleLogWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0 || w > 500) {
      Alert.alert("Invalid", "Please enter a valid weight.");
      return;
    }
    if (!userId) return;
    setSubmitting(true);

    const { error } = await supabase.from("weight_logs").insert({
      user_id: userId,
      weight_kg: w,
      notes: newNotes.trim() || null,
    });

    if (error) { Alert.alert("Error", error.message); setSubmitting(false); return; }

    // Update profile current weight
    await supabase.from("profiles").update({ weight_kg: w }).eq("id", userId);

    onWeightUpdated(w.toString());
    setLogModalVisible(false);
    setNewWeight("");
    setNewNotes("");
    setSubmitting(false);
    loadWeightLogs();
  };

  const handleDeleteLog = (id: string) => {
    Alert.alert("Delete Log", "Remove this weight entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("weight_logs").delete().eq("id", id);
          setWeightLogs((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  const fitnessGoalLabel: Record<string, string> = {
    lose: "Losing weight",
    gain: "Gaining muscle",
    maintain: "Maintaining weight",
    endurance: "Building endurance",
  };

  return (
    <>
      <View style={[styles.card, styles.darkCard]}>
        {/* ── Collapsed header — always visible ── */}
        <TouchableOpacity
          style={styles.weightCardHeader}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.weightCardHeaderLeft}>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={styles.logWeightBtn}
              onPress={() => setLogModalVisible(true)}
            >
              <Plus size={13} color="#22c55e" />
              <Text style={styles.logWeightBtnText}>Log</Text>
            </TouchableOpacity>
            {expanded ? <ChevronUp size={18} color="#555" /> : <ChevronDown size={18} color="#555" />}
          </View>
        </TouchableOpacity>

        {/* ── Progress bar — always visible ── */}
        <View style={{ paddingHorizontal: 0, marginTop: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "#888", fontSize: 12 }}>
              {currentWeight > 0 ? `${currentWeight} kg` : "--"}
            </Text>
            <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>{diffText}</Text>
            <Text style={{ color: "#888", fontSize: 12 }}>
              Goal: {goalWeight > 0 ? `${goalWeight} kg` : "--"}
            </Text>
          </View>
          <ProgressBar
            value={progressPercent}
            trackColor="rgba(255,255,255,0.1)"
            fillColor="#22c55e"
            height={10}
          />
        </View>

        {/* ── Expanded content ── */}
        {expanded && (
          <View style={styles.weightExpandedContent}>

            {/* Stats row */}
            <View style={styles.weightStatsRow}>
              <View style={styles.weightStatItem}>
                <Text style={styles.weightStatVal}>{currentWeight > 0 ? `${currentWeight} kg` : "--"}</Text>
                <Text style={styles.weightStatLabel}>Current</Text>
              </View>
              <View style={styles.weightStatDivider} />
              <View style={styles.weightStatItem}>
                <Text style={[styles.weightStatVal, { color: "#22c55e" }]}>
                  {goalWeight > 0 ? `${goalWeight} kg` : "--"}
                </Text>
                <Text style={styles.weightStatLabel}>Goal</Text>
              </View>
              <View style={styles.weightStatDivider} />
              <View style={styles.weightStatItem}>
                <Text style={[styles.weightStatVal, { color: "#3b82f6" }]}>
                  {weightLogs.length > 0 ? `${weightLogs[0].weight_kg} kg` : "--"}
                </Text>
                <Text style={styles.weightStatLabel}>Starting</Text>
              </View>
            </View>

            {/* Chart */}
            {loadingLogs ? (
              <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#444", fontSize: 12 }}>Loading...</Text>
              </View>
            ) : (
              <View style={styles.weightChartBox}>
                <Text style={styles.weightChartTitle}>Weight History</Text>
                <WeightLineChart logs={weightLogs} goalWeight={goalWeight} />
              </View>
            )}

            {/* Log history */}
            {weightLogs.length > 0 && (
              <View style={styles.weightLogList}>
                <Text style={styles.weightLogListTitle}>Recent Logs</Text>
                {weightLogs.slice(-5).reverse().map((log) => (
                  <View key={log.id} style={styles.weightLogItem}>
                    <View style={styles.weightLogDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weightLogWeight}>{log.weight_kg} kg</Text>
                      {log.notes && (
                        <Text style={styles.weightLogNotes}>{log.notes}</Text>
                      )}
                    </View>
                    <Text style={styles.weightLogDate}>
                      {new Date(log.logged_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </Text>
                    <TouchableOpacity
                      style={styles.weightLogDeleteBtn}
                      onPress={() => handleDeleteLog(log.id)}
                    >
                      <Text style={{ color: "#ef4444", fontSize: 11 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Log Weight Modal */}
      <Modal visible={logModalVisible} transparent animationType="slide" onRequestClose={() => setLogModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Weight</Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)}>
                <Text style={{ color: "#888", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCurrentWeight}>
              Current: {userData?.currentWeight ?? "--"} kg
            </Text>

            <Text style={styles.inputLabel}>New Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder={userData?.currentWeight ?? "70.0"}
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="e.g., After morning workout"
              placeholderTextColor="#555"
              multiline
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleLogWeight}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>{submitting ? "Saving..." : "Save Weight"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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

  const lastSyncedSteps = useRef(0);
  const lastSyncedCalories = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { steps, distanceKm, caloriesBurned, isAvailable } = useContext(PedometerContext);

  const calorieGoal = userData?.dailyCalories ?? 2000;
  const effectiveCaloriesBurned = isAvailable ? caloriesBurned : dailyStats.caloriesBurned;
  const effectiveSteps = isAvailable ? steps : dailyStats.steps;
  const caloriesRemaining = calorieGoal - caloriesConsumed + effectiveCaloriesBurned;

  const macros = [
    { name: "Carbs", consumed: macrosConsumed.carbs, goal: userData?.dailyCarbs ?? 250, color: "#3b82f6", label: "g" },
    { name: "Protein", consumed: macrosConsumed.protein, goal: userData?.dailyProtein ?? 150, color: "#f97316", label: "g" },
    { name: "Fat", consumed: macrosConsumed.fat, goal: userData?.dailyFat ?? 70, color: "#a855f7", label: "g" },
  ];

  useEffect(() => {
    if (!isAvailable || !userId) return;
    if (steps === 0 && caloriesBurned === 0) return;
    const stepsDiff = Math.abs(steps - lastSyncedSteps.current);
    const calDiff = Math.abs(caloriesBurned - lastSyncedCalories.current);
    if (stepsDiff < 10 && calDiff < 1) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("daily_stats").upsert(
        { user_id: userId, date: today, steps, calories_burned: Math.round(caloriesBurned * 10) / 10, distance_km: Math.round(distanceKm * 100) / 100 },
        { onConflict: "user_id,date" }
      );
      if (!error) {
        lastSyncedSteps.current = steps;
        lastSyncedCalories.current = caloriesBurned;
        setDailyStats((prev) => ({ ...prev, steps, caloriesBurned: Math.round(caloriesBurned * 10) / 10, distanceKm: Math.round(distanceKm * 100) / 100 }));
      }
    }, 5000);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [steps, caloriesBurned, distanceKm, isAvailable, userId]);

  useEffect(() => {
    const loadAllData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;
      setUserId(user.id);

      const today = new Date().toISOString().split("T")[0];

      const [profileRes, dailyStatsRes, workoutsRes, foodLogsRes] = await Promise.all([
        supabase.from("profiles").select("first_name, age, gender, weight_kg, goal_weight, goal, activity_level, height_cm, daily_calories, daily_protein, daily_fat, daily_carbs").eq("id", user.id).single(),
        supabase.from("daily_stats").select("calories_burned, steps, active_minutes, distance_km, calories_intake, protein_g, carbs_g, fat_g").eq("user_id", user.id).eq("date", today).single(),
        supabase.from("workouts").select("name, type, duration_minutes, created_at").eq("user_id", user.id).eq("date", today).order("created_at", { ascending: true }),
        supabase.from("food_logs").select("calories, protein_g, carbs_g, fat_g, logged_at").eq("user_id", user.id),
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

      if (dailyStatsRes.data) {
        const ds = dailyStatsRes.data;
        setDailyStats({ caloriesBurned: Number(ds.calories_burned) || 0, steps: ds.steps || 0, activeMinutes: ds.active_minutes || 0, distanceKm: Number(ds.distance_km) || 0 });
        lastSyncedSteps.current = ds.steps || 0;
        lastSyncedCalories.current = Number(ds.calories_burned) || 0;
      }

      const dsNutrition = dailyStatsRes.data;
      const hasStoredNutrition = Number(dsNutrition?.calories_intake) > 0;
      if (hasStoredNutrition) {
        setCaloriesConsumed(Number(dsNutrition!.calories_intake));
        setMacrosConsumed({ protein: Number(dsNutrition!.protein_g || 0), carbs: Number(dsNutrition!.carbs_g || 0), fat: Number(dsNutrition!.fat_g || 0) });
      } else if (foodLogsRes.data) {
        const todayStart = new Date(today);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(todayStart.getDate() + 1);
        const todayLogs = foodLogsRes.data.filter((log) => {
          const logDate = new Date(log.logged_at);
          return logDate >= todayStart && logDate < tomorrow;
        });
        const totals = todayLogs.reduce((acc, item) => ({
          calories: acc.calories + Number(item.calories || 0),
          protein: acc.protein + Number(item.protein_g || 0),
          carbs: acc.carbs + Number(item.carbs_g || 0),
          fat: acc.fat + Number(item.fat_g || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        setCaloriesConsumed(totals.calories);
        setMacrosConsumed({ protein: totals.protein, carbs: totals.carbs, fat: totals.fat });
      }

      if (workoutsRes.data && workoutsRes.data.length > 0) {
        setTodayWorkouts(workoutsRes.data.map((w) => ({
          name: w.name, type: w.type ?? "general",
          duration: w.duration_minutes ? `${w.duration_minutes} min` : "--",
          time: new Date(w.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        })));
      }
    };
    loadAllData();
  }, []);

  const statsCards = [
    { icon: "flame", label: "Calories Burned", value: Math.round(effectiveCaloriesBurned).toString(), unit: "kcal", color: "#f97316" },
    { icon: "footprints", label: "Steps Today", value: effectiveSteps.toLocaleString(), unit: "steps", color: "#22c55e" },
    { icon: "activity", label: "Active Minutes", value: dailyStats.activeMinutes.toString(), unit: "min", color: "#3b82f6" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.greeting}>Hey, {userData?.name || "there"}! 👋</Text>
        <Text style={styles.subGreeting}>Ready to crush your goals today?</Text>
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
                {caloriesRemaining > 0 ? `${Math.round(caloriesRemaining)} remaining` : "Goal exceeded"}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logFoodBtn} onPress={() => navigation.navigate("Food")}>
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
            <Text style={[styles.calorieSummaryValue, { color: "#f97316" }]}>{Math.round(effectiveCaloriesBurned)}</Text>
            <Text style={styles.calorieSummaryLabel}>Burned</Text>
          </View>
          <Text style={styles.calorieSummaryOp}>=</Text>
          <View style={styles.calorieSummaryItem}>
            <Text style={[styles.calorieSummaryValue, { color: caloriesRemaining >= 0 ? "#22c55e" : "#ef4444" }]}>
              {Math.round(caloriesRemaining)}
            </Text>
            <Text style={styles.calorieSummaryLabel}>Left</Text>
          </View>
        </View>

        <View style={styles.calorieProgress}>
          <View style={styles.calorieProgressLabels}>
            <Text style={styles.calorieLabel}>{Math.round(caloriesConsumed)} eaten of {calorieGoal} kcal goal</Text>
          </View>
          <ProgressBar value={(caloriesConsumed / (calorieGoal + effectiveCaloriesBurned)) * 100} height={12} />
        </View>

        <View style={styles.macrosContainer}>
          {macros.map((macro) => (
            <View key={macro.name} style={styles.macroItem}>
              <Text style={styles.macroName}>{macro.name}</Text>
              <Text style={styles.macroValue}>{Math.round(macro.consumed)}/{macro.goal}{macro.label}</Text>
              <ProgressBar value={(macro.consumed / macro.goal) * 100} height={6} fillColor={macro.color} />
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

      {/* Weekly Plan Card */}
      <CompactPlanCard plan={workoutPlan} onViewFull={() => navigation.navigate("Calendar")} />

      {/* Weight Goal Card — now expandable */}
      <WeightGoalCard
        userData={userData}
        userId={userId}
        onWeightUpdated={(newWeight) => {
          setUserData((prev) => prev ? { ...prev, currentWeight: newWeight } : prev);
        }}
      />

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
                <Text style={styles.workoutMeta}>{workout.time} • {workout.duration}</Text>
              </View>
              <View style={[styles.workoutBadge, workout.type === "cardio" ? styles.cardioBadge : styles.strengthBadge]}>
                <Text style={[styles.workoutBadgeText, workout.type === "cardio" ? styles.cardioText : styles.strengthText]}>
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
  planCard: { backgroundColor: "#111827", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1f2937" },
  planCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  planCardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  viewFullRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewFullBtn: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
  todayBox: { backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.15)", marginBottom: 14 },
  todayLabel: { color: "#888", fontSize: 11, marginBottom: 3 },
  todayFocus: { color: "#fff", fontSize: 14, fontWeight: "700" },
  todayExCount: { color: "#22c55e", fontSize: 12, marginTop: 3 },
  todayBadge: { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  todayBadgeRest: { backgroundColor: "rgba(107,114,128,0.15)", borderColor: "rgba(107,114,128,0.3)" },
  todayBadgeText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  dayStrip: { flexDirection: "row", justifyContent: "space-between" },
  dayPill: { alignItems: "center", flex: 1, paddingVertical: 6, borderRadius: 8 },
  dayPillToday: { backgroundColor: "rgba(34,197,94,0.12)" },
  dayPillLabel: { color: "#555", fontSize: 10, marginBottom: 3 },
  dayPillLabelToday: { color: "#22c55e", fontWeight: "700" },
  dayPillDot: { fontSize: 14 },
  card: { borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  darkCard: { backgroundColor: "#1a1a1a" },
  calorieCard: { backgroundColor: "#1a3329" },
  calorieCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  calorieCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  calorieCardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  calorieCardSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  logFoodBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  logFoodBtnText: { color: "#1a3329", fontSize: 13, fontWeight: "600", marginLeft: 4 },
  calorieSummaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 12, marginBottom: 14 },
  calorieSummaryItem: { alignItems: "center", flex: 1 },
  calorieSummaryValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  calorieSummaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  calorieSummaryOp: { color: "rgba(255,255,255,0.3)", fontSize: 16, fontWeight: "300", paddingHorizontal: 2 },
  calorieProgress: { gap: 8, marginBottom: 4 },
  calorieProgressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  calorieLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  calorieValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
  macrosContainer: { flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", gap: 8 },
  macroItem: { flex: 1, gap: 4 },
  macroName: { color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center", marginBottom: 2 },
  macroValue: { color: "#fff", fontSize: 12, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#1a1a1a", gap: 4 },
  statValue: { fontSize: 20, color: "#fff", fontWeight: "700", marginTop: 6 },
  statUnit: { fontSize: 11, color: "#888" },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cardSub: { color: "#888", fontSize: 12, marginTop: 2 },

  // Weight Goal Card
  weightCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weightCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logWeightBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.2)",
  },
  logWeightBtnText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  weightExpandedContent: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#2a2a2a", gap: 16 },
  weightStatsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#151515", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#2a2a2a" },
  weightStatItem: { flex: 1, alignItems: "center", gap: 4 },
  weightStatVal: { color: "#fff", fontSize: 16, fontWeight: "700" },
  weightStatLabel: { color: "#555", fontSize: 11 },
  weightStatDivider: { width: 1, height: 30, backgroundColor: "#2a2a2a" },
  weightChartBox: { backgroundColor: "#111", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#2a2a2a" },
  weightChartTitle: { color: "#888", fontSize: 12, fontWeight: "600", marginBottom: 10 },
  weightLogList: { gap: 8 },
  weightLogListTitle: { color: "#888", fontSize: 12, fontWeight: "600" },
  weightLogItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#151515", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#2a2a2a" },
  weightLogDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3b82f6", flexShrink: 0 },
  weightLogWeight: { color: "#fff", fontSize: 13, fontWeight: "600" },
  weightLogNotes: { color: "#555", fontSize: 11, marginTop: 2 },
  weightLogDate: { color: "#555", fontSize: 11 },
  weightLogDeleteBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalCurrentWeight: { color: "#555", fontSize: 13, marginBottom: 20 },
  inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: "#333" },
  submitBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  workoutsSection: { gap: 10 },
  workoutsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  viewAllBtn: { color: "#22c55e", fontSize: 14 },
  workoutCard: { backgroundColor: "#1a1a1a", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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