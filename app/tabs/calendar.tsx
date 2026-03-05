import { StatusBar } from "expo-status-bar";
import { ChevronLeft, ChevronRight, Dumbbell, Heart, Moon, Plus, X } from "lucide-react-native";
import { useState } from "react";
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

const { width } = Dimensions.get("window");
const DAY_SIZE = Math.floor((width - 32 - 48) / 7); // 7 cols, padding accounted

interface WorkoutEvent {
    id: string;
    date: string;
    name: string;
    type: "strength" | "cardio" | "rest" | "flexibility";
    duration: number;
    time: string;
}

const workoutTypeConfig = {
    strength: { color: "#3b82f6", bgColor: "rgba(59,130,246,0.15)", icon: Dumbbell, label: "Strength" },
    cardio: { color: "#f97316", bgColor: "rgba(249,115,22,0.15)", icon: Heart, label: "Cardio" },
    rest: { color: "#6b7280", bgColor: "rgba(107,114,128,0.15)", icon: Moon, label: "Rest" },
    flexibility: { color: "#22c55e", bgColor: "rgba(34,197,94,0.15)", icon: Heart, label: "Flexibility" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKOUT_TYPES = ["strength", "cardio", "flexibility", "rest"] as const;

export default function ExerciseCalendar() {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [modalVisible, setModalVisible] = useState(false);
    const [workouts, setWorkouts] = useState<WorkoutEvent[]>([
        { id: "1", date: today.toISOString().split("T")[0], name: "Morning Run", type: "cardio", duration: 30, time: "07:00" },
        { id: "2", date: today.toISOString().split("T")[0], name: "Upper Body Workout", type: "strength", duration: 45, time: "18:00" },
        { id: "3", date: new Date(Date.now() + 86400000).toISOString().split("T")[0], name: "Rest Day", type: "rest", duration: 0, time: "00:00" },
    ]);

    const [newWorkout, setNewWorkout] = useState({
        name: "",
        type: "strength" as WorkoutEvent["type"],
        duration: "",
        time: "",
    });

    // Calendar helpers
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = new Date(year, month, 1).getDay();
    const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const getWorkoutsForDay = (day: number) => {
        const dateStr = new Date(year, month, day).toISOString().split("T")[0];
        return workouts.filter((w) => w.date === dateStr);
    };

    const selectedDateStr = selectedDate.toISOString().split("T")[0];
    const selectedWorkouts = workouts.filter((w) => w.date === selectedDateStr);

    const addWorkout = () => {
        if (!newWorkout.name || !newWorkout.duration || !newWorkout.time) {
            Alert.alert("Missing Fields", "Please fill in all fields.");
            return;
        }
        const workout: WorkoutEvent = {
            id: Date.now().toString(),
            date: selectedDateStr,
            name: newWorkout.name,
            type: newWorkout.type,
            duration: parseInt(newWorkout.duration),
            time: newWorkout.time,
        };
        setWorkouts([...workouts, workout]);
        setModalVisible(false);
        setNewWorkout({ name: "", type: "strength", duration: "", time: "" });
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Exercise Calendar</Text>
                        <Text style={styles.headerSub}>Plan your workouts</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                        <Plus size={16} color="#0a0a0a" />
                        <Text style={styles.addBtnText}>Add Workout</Text>
                    </TouchableOpacity>
                </View>

                {/* Month Navigator */}
                <View style={styles.monthNav}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentDate(new Date(year, month - 1))}>
                        <ChevronLeft size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.monthName}>{monthName}</Text>
                    <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentDate(new Date(year, month + 1))}>
                        <ChevronRight size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.body}>

                {/* Calendar Grid */}
                <View style={styles.calendarCard}>
                    {/* Day headers */}
                    <View style={styles.dayHeaderRow}>
                        {DAYS.map((d) => (
                            <Text key={d} style={styles.dayHeader}>{d}</Text>
                        ))}
                    </View>

                    {/* Grid */}
                    <View style={styles.grid}>
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <View key={`empty-${i}`} style={styles.dayCell} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayWorkouts = getWorkoutsForDay(day);
                            const isToday =
                                day === today.getDate() &&
                                month === today.getMonth() &&
                                year === today.getFullYear();
                            const isSelected =
                                day === selectedDate.getDate() &&
                                month === selectedDate.getMonth() &&
                                year === selectedDate.getFullYear();

                            return (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayCell,
                                        isToday && styles.dayCellToday,
                                        isSelected && !isToday && styles.dayCellSelected,
                                    ]}
                                    onPress={() => setSelectedDate(new Date(year, month, day))}
                                >
                                    <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day}</Text>
                                    <View style={styles.dotRow}>
                                        {dayWorkouts.slice(0, 3).map((w) => (
                                            <View key={w.id} style={[styles.dot, { backgroundColor: workoutTypeConfig[w.type].color }]} />
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Selected Day Workouts */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Workouts for {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                    </Text>

                    {selectedWorkouts.length > 0 ? (
                        selectedWorkouts.map((workout) => {
                            const config = workoutTypeConfig[workout.type];
                            const Icon = config.icon;
                            return (
                                <View key={workout.id} style={styles.workoutCard}>
                                    <View style={[styles.workoutIconCircle, { backgroundColor: config.bgColor }]}>
                                        <Icon size={20} color={config.color} />
                                    </View>
                                    <View style={styles.workoutInfo}>
                                        <Text style={styles.workoutName}>{workout.name}</Text>
                                        <Text style={styles.workoutMeta}>
                                            {workout.time} • {workout.duration} min • {config.label}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No workouts scheduled for this day</Text>
                        </View>
                    )}
                </View>

                {/* Weekly Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>This Week</Text>
                    <View style={styles.summaryGrid}>
                        {WORKOUT_TYPES.map((type) => {
                            const config = workoutTypeConfig[type];
                            const Icon = config.icon;
                            const count = workouts.filter((w) => w.type === type).length;
                            return (
                                <View key={type} style={styles.summaryCard}>
                                    <View style={[styles.summaryIcon, { backgroundColor: config.bgColor }]}>
                                        <Icon size={16} color={config.color} />
                                    </View>
                                    <Text style={styles.summaryCount}>{count}</Text>
                                    <Text style={styles.summaryLabel}>{config.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

            </ScrollView>

            {/* Add Workout Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Workout</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Selected Date</Text>
                        <View style={styles.dateDisplay}>
                            <Text style={styles.dateDisplayText}>
                                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </Text>
                        </View>

                        <Text style={styles.inputLabel}>Workout Name</Text>
                        <TextInput
                            placeholder="e.g., Morning Run"
                            placeholderTextColor="#555"
                            value={newWorkout.name}
                            onChangeText={(v) => setNewWorkout({ ...newWorkout, name: v })}
                            style={styles.input}
                        />

                        <Text style={styles.inputLabel}>Type</Text>
                        <View style={styles.typeGrid}>
                            {WORKOUT_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.typeBtn, newWorkout.type === type && { backgroundColor: workoutTypeConfig[type].color, borderColor: workoutTypeConfig[type].color }]}
                                    onPress={() => setNewWorkout({ ...newWorkout, type })}
                                >
                                    <Text style={[styles.typeBtnText, newWorkout.type === type && styles.typeBtnTextActive]}>
                                        {workoutTypeConfig[type].label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.inputLabel}>Duration (min)</Text>
                                <TextInput
                                    placeholder="30"
                                    placeholderTextColor="#555"
                                    keyboardType="numeric"
                                    value={newWorkout.duration}
                                    onChangeText={(v) => setNewWorkout({ ...newWorkout, duration: v })}
                                    style={styles.input}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Time (HH:MM)</Text>
                                <TextInput
                                    placeholder="07:00"
                                    placeholderTextColor="#555"
                                    value={newWorkout.time}
                                    onChangeText={(v) => setNewWorkout({ ...newWorkout, time: v })}
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={addWorkout}>
                            <Text style={styles.submitBtnText}>Add Workout</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },

    // Header
    header: {
        backgroundColor: "#1a1a1a",
        padding: 16,
        paddingTop: 52,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    headerSub: { color: "#888", fontSize: 12, marginTop: 2 },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#22c55e",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        gap: 6,
    },
    addBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "700" },
    monthNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    navBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: "#2a2a2a",
        alignItems: "center", justifyContent: "center",
    },
    monthName: { color: "#fff", fontSize: 16, fontWeight: "600" },

    // Body
    body: { padding: 16, gap: 24, paddingBottom: 100 },

    // Calendar
    calendarCard: {
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 12,
    },
    dayHeaderRow: {
        flexDirection: "row",
        marginBottom: 6,
    },
    dayHeader: {
        flex: 1,
        textAlign: "center",
        color: "#666",
        fontSize: 11,
        fontWeight: "600",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 2,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 4,
        borderRadius: 8,
    },
    dayCellToday: {
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 1.5,
        borderColor: "#22c55e",
    },
    dayCellSelected: {
        backgroundColor: "#2a2a2a",
    },
    dayNum: { color: "#ccc", fontSize: 12, fontWeight: "500" },
    dayNumToday: { color: "#22c55e", fontWeight: "700" },
    dotRow: {
        flexDirection: "row",
        gap: 2,
        marginTop: 2,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    dot: { width: 5, height: 5, borderRadius: 3 },

    // Sections
    section: { gap: 10 },
    sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },

    // Workout cards
    workoutCard: {
        backgroundColor: "#1a1a1a",
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    workoutIconCircle: {
        width: 44, height: 44, borderRadius: 22,
        alignItems: "center", justifyContent: "center",
    },
    workoutInfo: { flex: 1 },
    workoutName: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 3 },
    workoutMeta: { color: "#888", fontSize: 12 },
    emptyCard: {
        backgroundColor: "#1a1a1a", borderRadius: 14,
        padding: 24, alignItems: "center",
    },
    emptyText: { color: "#555", fontSize: 13 },

    // Summary
    summaryGrid: { flexDirection: "row", gap: 10 },
    summaryCard: {
        flex: 1, backgroundColor: "#1a1a1a",
        borderRadius: 14, padding: 12, alignItems: "center", gap: 4,
    },
    summaryIcon: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    summaryCount: { color: "#fff", fontSize: 20, fontWeight: "700" },
    summaryLabel: { color: "#888", fontSize: 10, textAlign: "center" },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24,
    },
    modalHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 20,
    },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: {
        backgroundColor: "#2a2a2a", borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        color: "#fff", fontSize: 14, marginBottom: 16,
    },
    dateDisplay: {
        backgroundColor: "#2a2a2a", borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
    },
    dateDisplayText: { color: "#fff", fontSize: 14 },
    typeGrid: {
        flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16,
    },
    typeBtn: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 8, borderWidth: 1, borderColor: "#3a3a3a",
        backgroundColor: "#2a2a2a",
    },
    typeBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    typeBtnTextActive: { color: "#fff", fontWeight: "700" },
    row: { flexDirection: "row" },
    submitBtn: {
        backgroundColor: "#22c55e", borderRadius: 14,
        paddingVertical: 15, alignItems: "center", marginTop: 4,
        shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});