import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// Icons — requires: npm install lucide-react-native react-native-svg
import { StatusBar } from 'expo-status-bar';
import { Activity, Flame, Plus, Target, TrendingUp } from "lucide-react-native";


const { width } = Dimensions.get("window");

interface UserData {
  name: string;
  age: string;
  gender: string;
  currentWeight: string;
  goalWeight: string;
  fitnessGoal: string;
}

// Simple progress bar component
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

// Footprints icon substitute (not in lucide-react-native core set)
function FootprintsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16 }}>👣</Text>
    </View>
  );
}

// Apple icon substitute
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
  const [caloriesConsumed] = useState(1240);
  const calorieGoal = 2100;
  const caloriesRemaining = calorieGoal - caloriesConsumed;

  const macros = [
    { name: "Carbs", consumed: 124, goal: 250, color: "#3b82f6", label: "g" },
    { name: "Protein", consumed: 68, goal: 150, color: "#f97316", label: "g" },
    { name: "Fat", consumed: 42, goal: 70, color: "#a855f7", label: "g" },
  ];

  useEffect(() => {
    AsyncStorage.getItem("carpioFitUser").then((data) => {
      if (data) setUserData(JSON.parse(data));
    });
  }, []);

  const statsCards = [
    { icon: "flame", label: "Calories Burned", value: "420", unit: "kcal", color: "#f97316" },
    { icon: "footprints", label: "Steps Today", value: "6,234", unit: "steps", color: "#22c55e" },
    { icon: "activity", label: "Active Minutes", value: "45", unit: "min", color: "#3b82f6" },
  ];

  const todayWorkouts = [
    { name: "Morning Run", time: "07:00 AM", duration: "30 min", type: "cardio" },
    { name: "Upper Body", time: "06:00 PM", duration: "45 min", type: "strength" },
  ];

  const fitnessGoalLabel: Record<string, string> = {
    lose: "Losing weight",
    gain: "Gaining muscle",
    maintain: "Maintaining weight",
    endurance: "Building endurance",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hey, {userData?.name || "there"}! 👋
        </Text>
        <Text style={styles.subGreeting}>Ready to crush your goals today?</Text>
      </View>

      {/* Calorie Card */}
      <StatusBar style="light" />
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
                {macro.consumed}/{macro.goal}
                {macro.label}
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
        {statsCards.map((stat, index) => (
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
            <Text style={styles.weightLabel}>Current</Text>
          </View>
          <TrendingUp size={24} color="#22c55e" />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.weightValue}>
              {userData?.goalWeight ?? "--"}
            </Text>
            <Text style={styles.weightLabel}>Goal</Text>
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

        {todayWorkouts.map((workout, index) => (
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
        ))}
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

  // Header
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

  // Cards
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

  // Calorie card internals
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

  // Stats grid
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

  // Weight goal card
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

  // Workouts
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

  // Progress bar
  progressTrack: {
    borderRadius: 99,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    borderRadius: 99,
  },
});