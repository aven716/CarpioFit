import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, ChevronLeft, ChevronRight, Dumbbell, Edit2, Heart, Moon, Plus, RefreshCw, Save, Share2, Trash2, TrendingUp, X } from "lucide-react-native";
import { useEffect, useState } from "react";
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
import { DayPlan, Exercise, fetchOrGenerateWorkoutPlan, generateAndSavePlan, WorkoutPlan } from "../../lib/workoutPlan";

const { width } = Dimensions.get("window");
const SCREEN_WIDTH = width;

interface WorkoutEvent {
    id: string;
    date: string;
    name: string;
    type: "strength" | "cardio" | "rest" | "flexibility";
    duration: number;
    time: string;
}

interface DayWorkoutStat {
    date: string;
    count: number;
    minutes: number;
}

const workoutTypeConfig = {
    strength: { color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)", bgColor: "rgba(59,130,246,0.15)", icon: Dumbbell, label: "Strength" },
    cardio: { color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)", bgColor: "rgba(249,115,22,0.15)", icon: Heart, label: "Cardio" },
    rest: { color: "#6b7280", tint: "rgba(107,114,128,0.10)", border: "rgba(107,114,128,0.22)", bgColor: "rgba(107,114,128,0.15)", icon: Moon, label: "Rest" },
    flexibility: { color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)", bgColor: "rgba(34,197,94,0.15)", icon: Heart, label: "Flexibility" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKOUT_TYPES = ["strength", "cardio", "flexibility", "rest"] as const;
const toDateStr = (d: Date) => d.toISOString().split("T")[0];

function inferWorkoutType(name: string, focus: string): "strength" | "cardio" | "flexibility" | "rest" {
    const lower = (name + " " + focus).toLowerCase();
    if (/run|jog|cycle|bike|swim|cardio|hiit|jump|rope|row|elliptic/.test(lower)) return "cardio";
    if (/stretch|yoga|flex|mobility|foam/.test(lower)) return "flexibility";
    return "strength";
}

async function logExercisesToWorkouts(
    userId: string,
    exercises: Exercise[],
    focus: string,
    dateStr: string,
    onSuccess: () => void
) {
    if (exercises.length === 0) {
        Alert.alert("Nothing to log", "This day has no exercises.");
        return;
    }
    try {
        const rows = exercises.map((ex) => ({
            user_id: userId,
            date: dateStr,
            name: ex.name,
            type: inferWorkoutType(ex.name, focus),
            duration_minutes: ex.duration ? parseInt(ex.duration.replace(/[^0-9]/g, "")) || 30 : 30,
            completed: true,
        }));
        const { error } = await supabase.from("workouts").insert(rows);
        if (error) throw error;
        Alert.alert("✅ Logged!", `${exercises.length} exercise${exercises.length > 1 ? "s" : ""} added to your calendar.`);
        onSuccess();
    } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Could not log workouts.");
    }
}

async function logSingleExercise(
    userId: string,
    exercise: Exercise,
    focus: string,
    dateStr: string,
    onSuccess: () => void
) {
    try {
        const { error } = await supabase.from("workouts").insert({
            user_id: userId,
            date: dateStr,
            name: exercise.name,
            type: inferWorkoutType(exercise.name, focus),
            duration_minutes: exercise.duration ? parseInt(exercise.duration.replace(/[^0-9]/g, "")) || 30 : 30,
            completed: true,
        });
        if (error) throw error;
        Alert.alert("✅ Logged!", `${exercise.name} added to your calendar.`);
        onSuccess();
    } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Could not log workout.");
    }
}

// ─── Share Plan Modal ─────────────────────────
function SharePlanModal({
    visible,
    plan,
    userId,
    onClose,
}: {
    visible: boolean;
    plan: WorkoutPlan | null;
    userId: string | null;
    onClose: () => void;
}) {
    const [title, setTitle] = useState("Check out my weekly workout plan! 💪");
    const [category, setCategory] = useState("Motivation");
    const [extraNote, setExtraNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const CATEGORIES = ["Achievement", "Motivation", "Discussion"];

    const buildPlanContent = () => {
        if (!plan) return "";
        const lines: string[] = ["Here's my personalized weekly workout plan from Bernard (CarpioFit):", ""];
        plan.weekPlan.forEach((day) => {
            if (day.isRest) {
                lines.push(`😴 ${day.day}: Rest & Recovery`);
            } else {
                lines.push(`💪 ${day.day}: ${day.focus}`);
                if (day.exercises && day.exercises.length > 0) {
                    day.exercises.slice(0, 3).forEach((ex) => {
                        const detail = ex.sets > 0 ? ` (${ex.sets} sets${ex.reps ? ` × ${ex.reps}` : ""})` : "";
                        lines.push(`   • ${ex.name}${detail}`);
                    });
                    if (day.exercises.length > 3) {
                        lines.push(`   • +${day.exercises.length - 3} more...`);
                    }
                }
            }
        });
        if (extraNote.trim()) {
            lines.push("", extraNote.trim());
        }
        lines.push("", "Generated by CarpioFit 🏋️");
        return lines.join("\n");
    };

    const handleShare = async () => {
        if (!title.trim() || !userId) {
            Alert.alert("Missing", "Please add a title.");
            return;
        }
        setSubmitting(true);

        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", userId)
            .single();

        const authorName = profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "User"
            : "User";
        const initials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

        const { error } = await supabase.from("community_posts").insert({
            user_id: userId,
            author_name: authorName,
            author_initials: initials,
            title: title.trim(),
            content: buildPlanContent(),
            category,
            likes_count: 0,
            comments_count: 0,
        });

        setSubmitting(false);

        if (error) {
            Alert.alert("Error", error.message);
            return;
        }

        Alert.alert("🎉 Shared!", "Your workout plan is now live in the Community!");
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={shareStyles.overlay}>
                <ScrollView
                    style={{ width: "100%" }}
                    contentContainerStyle={shareStyles.sheet}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={shareStyles.header}>
                        <Text style={shareStyles.title}>Share Weekly Plan</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    {/* Plan preview */}
                    <View style={shareStyles.planPreview}>
                        <Text style={shareStyles.planPreviewTitle}>📋 Plan Preview</Text>
                        {plan?.weekPlan.map((day, i) => (
                            <View key={i} style={shareStyles.planPreviewRow}>
                                <Text style={shareStyles.planPreviewDay}>{day.day.slice(0, 3)}</Text>
                                <Text style={shareStyles.planPreviewFocus} numberOfLines={1}>
                                    {day.isRest ? "😴 Rest" : `💪 ${day.focus}`}
                                </Text>
                                {!day.isRest && (
                                    <Text style={shareStyles.planPreviewCount}>{day.exercises?.length ?? 0} ex</Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <Text style={shareStyles.label}>Post Title *</Text>
                    <TextInput
                        style={shareStyles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="e.g., Check out my weekly plan!"
                        placeholderTextColor="#555"
                    />

                    <Text style={shareStyles.label}>Category</Text>
                    <View style={shareStyles.catRow}>
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[shareStyles.catBtn, category === cat && shareStyles.catBtnActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <Text style={[shareStyles.catBtnText, category === cat && shareStyles.catBtnTextActive]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={shareStyles.label}>Add a note <Text style={{ fontWeight: "400", color: "#555" }}>(optional)</Text></Text>
                    <TextInput
                        style={[shareStyles.input, { minHeight: 80, textAlignVertical: "top" }]}
                        value={extraNote}
                        onChangeText={setExtraNote}
                        placeholder="e.g., Loving this plan — week 2 in!"
                        placeholderTextColor="#555"
                        multiline
                    />

                    <TouchableOpacity
                        style={[shareStyles.shareBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleShare}
                        disabled={submitting}
                    >
                        <Share2 size={16} color="#fff" />
                        <Text style={shareStyles.shareBtnText}>{submitting ? "Sharing..." : "Share Plan"}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}

// ─── Simple Line Chart ────────────────────────
function SimpleLineChart({ data, valueKey, color }: {
    data: DayWorkoutStat[];
    valueKey: keyof DayWorkoutStat;
    color: string;
}) {
    const W = SCREEN_WIDTH - 80;
    const H = 110;
    const pL = 32, pR = 8, pT = 8, pB = 22;
    const iW = W - pL - pR;
    const iH = H - pT - pB;
    const values = data.map((d) => Number(d[valueKey] ?? 0));
    const maxV = Math.max(...values, 1) * 1.2;
    const tx = (i: number) => pL + (i / Math.max(data.length - 1, 1)) * iW;
    const ty = (v: number) => pT + iH - (v / maxV) * iH;
    const pts = data.map((d, i) => ({ x: tx(i), y: ty(Number(d[valueKey] ?? 0)) }));
    const linePath = pts.reduce((acc, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        const prev = pts[i - 1];
        const cx = (prev.x + pt.x) / 2;
        return `${acc} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, "");
    const areaPath = pts.length > 1 ? `${linePath} L${pts[pts.length - 1].x},${pT + iH} L${pL},${pT + iH} Z` : "";
    const yTicks = [0, 0.5, 1].map((t) => ({ y: pT + iH - t * iH, val: Math.round(t * maxV) }));
    const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i && data[v])
        .map((i) => ({ x: tx(i), label: data[i].date.slice(5) }));

    if (data.length < 2) {
        return (
            <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#444", fontSize: 12 }}>Log more workouts to see trends</Text>
            </View>
        );
    }

    return (
        <Svg width={W} height={H}>
            <Defs>
                <LinearGradient id={`g-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </LinearGradient>
            </Defs>
            {yTicks.map((t, idx) => (
                <SvgLine key={`${valueKey}-line-${idx}`} x1={pL} y1={t.y} x2={W - pR} y2={t.y} stroke="#222" strokeWidth="1" />
            ))}
            {yTicks.map((t, idx) => (
                <SvgText key={`${valueKey}-label-${idx}`} x={pL - 4} y={t.y + 4} fontSize="8" fill="#444" textAnchor="end">{t.val}</SvgText>
            ))}
            <Path d={areaPath} fill={`url(#g-${valueKey})`} />
            <Path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((pt, i) => (
                <SvgCircle key={`${valueKey}-dot-${i}`} cx={pt.x} cy={pt.y} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? color : "#111"} stroke={color} strokeWidth="1.5" />
            ))}
            {xLabels.map((xl) => (
                <SvgText key={`${valueKey}-x-${xl.label}`} x={xl.x} y={H - 4} fontSize="8" fill="#444" textAnchor="middle">{xl.label}</SvgText>
            ))}
        </Svg>
    );
}

// ─── Workout Trends ───────────────────────────
function WorkoutTrends({ userId }: { userId: string | null }) {
    const [data, setData] = useState<DayWorkoutStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState<7 | 14 | 30>(7);

    useEffect(() => { if (userId) load(); }, [userId, days]);

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - days + 1);
            const { data: workouts } = await supabase.from("workouts").select("date, duration_minutes, completed").eq("user_id", userId).gte("date", toDateStr(start)).lte("date", toDateStr(end));
            const map: Record<string, DayWorkoutStat> = {};
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                const key = toDateStr(d);
                map[key] = { date: key, count: 0, minutes: 0 };
            }
            (workouts ?? []).forEach((w) => {
                if (map[w.date]) { map[w.date].count += 1; map[w.date].minutes += Number(w.duration_minutes ?? 0); }
            });
            setData(Object.values(map).sort((a, b) => a.date.localeCompare(b.date)));
        } finally { setLoading(false); }
    };

    const activeDays = data.filter((d) => d.count > 0).length;
    const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
    const charts = [
        { key: "count" as keyof DayWorkoutStat, label: "Workouts per Day", color: "#22c55e" },
        { key: "minutes" as keyof DayWorkoutStat, label: "Minutes per Day", color: "#3b82f6" },
    ];

    return (
        <View style={ts.wrap}>
            <View style={ts.header}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <TrendingUp size={15} color="#22c55e" />
                    <Text style={ts.title}>Workout Trends</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                    {([7, 14, 30] as const).map((d) => (
                        <TouchableOpacity key={d} style={[ts.pill, days === d && ts.pillActive]} onPress={() => setDays(d)}>
                            <Text style={[ts.pillText, days === d && ts.pillTextActive]}>{d}d</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            {!loading && (
                <View style={ts.statsRow}>
                    <View style={ts.statCard}><Text style={ts.statVal}>{activeDays}</Text><Text style={ts.statLabel}>active days</Text></View>
                    <View style={ts.statCard}><Text style={[ts.statVal, { color: "#3b82f6" }]}>{totalMinutes}m</Text><Text style={ts.statLabel}>total minutes</Text></View>
                    <View style={ts.statCard}><Text style={[ts.statVal, { color: "#f97316" }]}>{activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0}m</Text><Text style={ts.statLabel}>avg / session</Text></View>
                </View>
            )}
            {loading ? (
                <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#444", fontSize: 12 }}>Loading...</Text>
                </View>
            ) : (
                charts.map((c) => (
                    <View key={c.key} style={ts.chartBlock}>
                        <Text style={[ts.chartLabel, { color: c.color }]}>{c.label}</Text>
                        <SimpleLineChart data={data} valueKey={c.key} color={c.color} />
                    </View>
                ))
            )}
        </View>
    );
}

// ─── Exercise Edit Modal ──────────────────────
function ExerciseEditModal({
    visible, exercise, onSave, onClose,
}: {
    visible: boolean;
    exercise: Exercise | null;
    onSave: (ex: Exercise) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [sets, setSets] = useState("");
    const [reps, setReps] = useState("");
    const [duration, setDuration] = useState("");

    useEffect(() => {
        if (exercise) { setName(exercise.name); setSets(exercise.sets?.toString() ?? ""); setReps(exercise.reps ?? ""); setDuration(exercise.duration ?? ""); }
        else { setName(""); setSets(""); setReps(""); setDuration(""); }
    }, [exercise, visible]);

    const handleSave = () => {
        if (!name.trim()) { Alert.alert("Missing", "Exercise name is required."); return; }
        onSave({ name: name.trim(), sets: parseInt(sets) || 0, reps: reps.trim() || null, duration: duration.trim() || null });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={es.overlay}>
                <View style={es.sheet}>
                    <View style={es.sheetHeader}>
                        <Text style={es.sheetTitle}>{exercise?.name ? "Edit Exercise" : "Add Exercise"}</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color="#888" /></TouchableOpacity>
                    </View>
                    <Text style={es.label}>Exercise Name *</Text>
                    <TextInput style={es.input} value={name} onChangeText={setName} placeholder="e.g., Push-ups" placeholderTextColor="#555" />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={es.label}>Sets</Text>
                            <TextInput style={es.input} value={sets} onChangeText={setSets} placeholder="3" placeholderTextColor="#555" keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={es.label}>Reps</Text>
                            <TextInput style={es.input} value={reps} onChangeText={setReps} placeholder="12-15" placeholderTextColor="#555" />
                        </View>
                    </View>
                    <Text style={es.label}>Duration (optional)</Text>
                    <TextInput style={es.input} value={duration} onChangeText={setDuration} placeholder="e.g., 20 min" placeholderTextColor="#555" />
                    <TouchableOpacity style={es.saveBtn} onPress={handleSave}>
                        <Save size={16} color="#fff" />
                        <Text style={es.saveBtnText}>Save Exercise</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── AI Plan Day Card ─────────────────────────
function AIPlanDayCard({
    day, isToday, userId, onPlanChange, onWorkoutsLogged,
}: {
    day: DayPlan;
    isToday: boolean;
    userId: string | null;
    onPlanChange: (updated: DayPlan) => void;
    onWorkoutsLogged: () => void;
}) {
    const [expanded, setExpanded] = useState(isToday);
    const [editMode, setEditMode] = useState(false);
    const [editingExercise, setEditingExercise] = useState<{ exercise: Exercise | null; index: number | null }>({ exercise: null, index: null });
    const [showExModal, setShowExModal] = useState(false);
    const [focusText, setFocusText] = useState(day.focus);
    const [isRest, setIsRest] = useState(day.isRest);
    const [loggingAll, setLoggingAll] = useState(false);
    const [loggedExercises, setLoggedExercises] = useState<Set<number>>(new Set());

    const getDayDateStr = () => {
        const today = new Date();
        const todayDayIndex = (today.getDay() + 6) % 7;
        const planDayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(day.day);
        const diff = planDayIndex - todayDayIndex;
        const target = new Date(today);
        target.setDate(today.getDate() + diff);
        return toDateStr(target);
    };

    const handleToggleRest = () => {
        const updated = { ...day, isRest: !isRest, focus: !isRest ? "Rest & Recovery" : day.focus };
        setIsRest(!isRest);
        onPlanChange(updated);
    };

    const handleFocusSave = () => { onPlanChange({ ...day, focus: focusText }); };

    const handleEditExercise = (ex: Exercise, index: number) => { setEditingExercise({ exercise: ex, index }); setShowExModal(true); };
    const handleAddExercise = () => { setEditingExercise({ exercise: null, index: null }); setShowExModal(true); };

    const handleDeleteExercise = (index: number) => {
        Alert.alert("Delete Exercise", "Remove this exercise from the plan?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => { onPlanChange({ ...day, exercises: day.exercises.filter((_, i) => i !== index) }); } },
        ]);
    };

    const handleSaveExercise = (ex: Exercise) => {
        let updatedExercises: Exercise[];
        if (editingExercise.index !== null) {
            updatedExercises = day.exercises.map((e, i) => i === editingExercise.index ? ex : e);
        } else {
            updatedExercises = [...(day.exercises ?? []), ex];
        }
        onPlanChange({ ...day, exercises: updatedExercises });
        setShowExModal(false);
    };

    const handleLogAll = async () => {
        if (!userId) return;
        setLoggingAll(true);
        const dateStr = getDayDateStr();
        await logExercisesToWorkouts(userId, day.exercises ?? [], day.focus, dateStr, () => {
            setLoggedExercises(new Set(day.exercises.map((_, i) => i)));
            onWorkoutsLogged();
        });
        setLoggingAll(false);
    };

    const handleLogSingle = async (ex: Exercise, index: number) => {
        if (!userId) return;
        const dateStr = getDayDateStr();
        await logSingleExercise(userId, ex, day.focus, dateStr, () => {
            setLoggedExercises((prev) => new Set([...prev, index]));
            onWorkoutsLogged();
        });
    };

    return (
        <>
            <View style={[ps.dayCard, isToday && ps.dayCardToday, isRest && ps.dayCardRest]}>
                <TouchableOpacity style={ps.dayCardHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[ps.dayName, isToday && { color: "#22c55e" }]}>{day.day}</Text>
                            {isToday && <View style={ps.todayChip}><Text style={ps.todayChipText}>Today</Text></View>}
                        </View>
                        <Text style={ps.dayFocus}>{isRest ? "😴 Rest & Recovery" : day.focus}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={[ps.restBadge, !isRest && ps.activeBadge]}>
                            <Text style={[ps.restBadgeText, !isRest && ps.activeBadgeText]}>
                                {isRest ? "Rest" : `${day.exercises?.length ?? 0} ex`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[ps.editToggleBtn, editMode && ps.editToggleBtnActive]}
                            onPress={() => { setEditMode((v) => !v); setExpanded(true); }}
                        >
                            <Edit2 size={12} color={editMode ? "#22c55e" : "#555"} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={ps.expandedContent}>
                        {editMode && (
                            <View style={ps.editControls}>
                                <View style={ps.editControlRow}>
                                    <Text style={ps.editControlLabel}>Mark as rest day</Text>
                                    <TouchableOpacity style={[ps.toggleBtn, isRest && ps.toggleBtnActive]} onPress={handleToggleRest}>
                                        <Text style={[ps.toggleBtnText, isRest && ps.toggleBtnTextActive]}>{isRest ? "Yes" : "No"}</Text>
                                    </TouchableOpacity>
                                </View>
                                {!isRest && (
                                    <View style={ps.editControlRow}>
                                        <Text style={ps.editControlLabel}>Focus</Text>
                                        <TextInput style={ps.focusInput} value={focusText} onChangeText={setFocusText} onBlur={handleFocusSave} placeholderTextColor="#555" placeholder="e.g., Chest & Triceps" />
                                    </View>
                                )}
                            </View>
                        )}

                        {!isRest && day.exercises && day.exercises.length > 0 && (
                            <View style={ps.exerciseList}>
                                {day.exercises.map((ex, i) => {
                                    const isLogged = loggedExercises.has(i);
                                    return (
                                        <View key={i} style={[ps.exerciseRow, isLogged && ps.exerciseRowLogged]}>
                                            <View style={[ps.exNumCircle, isLogged && ps.exNumCircleLogged]}>
                                                {isLogged ? <CheckCircle size={14} color="#22c55e" /> : <Text style={ps.exNum}>{i + 1}</Text>}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[ps.exName, isLogged && { color: "#555" }]}>{ex.name}</Text>
                                                <Text style={ps.exMeta}>
                                                    {ex.sets > 0 ? `${ex.sets} sets` : ""}
                                                    {ex.reps ? ` × ${ex.reps} reps` : ""}
                                                    {ex.duration ? ` • ${ex.duration}` : ""}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: "row", gap: 6 }}>
                                                {!editMode && !isLogged && (
                                                    <TouchableOpacity style={ps.logSingleBtn} onPress={() => handleLogSingle(ex, i)}>
                                                        <CheckCircle size={13} color="#22c55e" />
                                                        <Text style={ps.logSingleBtnText}>Log</Text>
                                                    </TouchableOpacity>
                                                )}
                                                {!editMode && isLogged && (
                                                    <View style={ps.loggedBadge}><Text style={ps.loggedBadgeText}>Logged</Text></View>
                                                )}
                                                {editMode && (
                                                    <>
                                                        <TouchableOpacity style={ps.exActionBtn} onPress={() => handleEditExercise(ex, i)}>
                                                            <Edit2 size={13} color="#3b82f6" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[ps.exActionBtn, { backgroundColor: "rgba(239,68,68,0.1)" }]} onPress={() => handleDeleteExercise(i)}>
                                                            <Trash2 size={13} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {editMode && !isRest && (
                            <TouchableOpacity style={ps.addExBtn} onPress={handleAddExercise}>
                                <Plus size={14} color="#22c55e" />
                                <Text style={ps.addExBtnText}>Add Exercise</Text>
                            </TouchableOpacity>
                        )}

                        {!editMode && !isRest && day.exercises && day.exercises.length > 0 && (
                            <View style={{ gap: 10, marginTop: 12 }}>
                                <TouchableOpacity
                                    style={ps.startWorkoutBtn}
                                    onPress={() => {
                                        const dateStr = getDayDateStr();
                                        router.push({
                                            pathname: "/tabs/workout-session" as any,
                                            params: { exercises: JSON.stringify(day.exercises), dayName: day.day, focus: day.focus, dateStr, userId: userId ?? "" },
                                        });
                                    }}
                                >
                                    <Text style={ps.startWorkoutBtnText}>▶ Start Workout</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[ps.logAllBtn, loggingAll && { opacity: 0.6 }]}
                                    onPress={handleLogAll}
                                    disabled={loggingAll}
                                >
                                    <CheckCircle size={15} color="#22c55e" />
                                    <Text style={ps.logAllBtnText}>{loggingAll ? "Logging..." : "Log All Without Starting"}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!editMode && isRest && (
                            <View style={ps.restMsg}>
                                <Text style={ps.restMsgText}>Take it easy today. Rest is part of the plan 💤</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            <ExerciseEditModal
                visible={showExModal}
                exercise={editingExercise.exercise}
                onSave={handleSaveExercise}
                onClose={() => setShowExModal(false)}
            />
        </>
    );
}

// ─── Full AI Plan Section ─────────────────────
function AIPlanSection({
    userId, userProfile, onWorkoutsLogged,
}: {
    userId: string | null;
    userProfile: any;
    onWorkoutsLogged: () => void;
}) {
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loggingWeek, setLoggingWeek] = useState(false);
    const [sharePlanVisible, setSharePlanVisible] = useState(false);

    const todayIndex = (new Date().getDay() + 6) % 7;

    useEffect(() => { if (!userId || !userProfile) return; load(); }, [userId, userProfile]);

    const load = async () => {
        if (!userId || !userProfile) return;
        setLoading(true);
        const p = await fetchOrGenerateWorkoutPlan(userId, userProfile);
        setPlan(p);
        setLoading(false);
    };

    const handleDayChange = (dayIndex: number, updated: DayPlan) => {
        if (!plan) return;
        const newWeekPlan = plan.weekPlan.map((d, i) => i === dayIndex ? updated : d);
        setPlan({ weekPlan: newWeekPlan });
        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!plan || !userId) return;
        setSaving(true);
        try {
            await supabase.from("workout_plans").update({ plan, updated_at: new Date().toISOString() }).eq("user_id", userId);
            setHasUnsavedChanges(false);
            Alert.alert("Saved!", "Your workout plan has been updated.");
        } catch {
            Alert.alert("Error", "Could not save changes. Try again.");
        } finally { setSaving(false); }
    };

    const handleLogWeek = async () => {
        if (!plan || !userId) return;
        Alert.alert("Log Entire Week", "This will add all exercises from this week's plan to your calendar. Continue?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log All",
                onPress: async () => {
                    setLoggingWeek(true);
                    let totalLogged = 0;
                    for (const day of plan.weekPlan) {
                        if (day.isRest || !day.exercises || day.exercises.length === 0) continue;
                        const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(day.day);
                        const todayDayIndex = (new Date().getDay() + 6) % 7;
                        const diff = dayIndex - todayDayIndex;
                        const target = new Date();
                        target.setDate(new Date().getDate() + diff);
                        const dateStr = toDateStr(target);
                        const rows = day.exercises.map((ex) => ({
                            user_id: userId, date: dateStr, name: ex.name,
                            type: inferWorkoutType(ex.name, day.focus),
                            duration_minutes: ex.duration ? parseInt(ex.duration.replace(/[^0-9]/g, "")) || 30 : 30,
                            completed: true,
                        }));
                        const { error } = await supabase.from("workouts").insert(rows);
                        if (!error) totalLogged += rows.length;
                    }
                    setLoggingWeek(false);
                    Alert.alert("✅ Week Logged!", `${totalLogged} exercises added across your calendar.`);
                    onWorkoutsLogged();
                },
            },
        ]);
    };

    const regenerate = async () => {
        if (!userId || !userProfile) return;
        Alert.alert("Regenerate Plan", "This will replace your current plan with a brand new AI-generated one. Continue?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Regenerate", style: "destructive",
                onPress: async () => {
                    setRegenerating(true);
                    await supabase.from("workout_plans").delete().eq("user_id", userId);
                    const p = await generateAndSavePlan(userId, userProfile);
                    setPlan(p);
                    setHasUnsavedChanges(false);
                    setRegenerating(false);
                },
            },
        ]);
    };

    return (
        <View style={ps.wrap}>
            {/* Header */}
            <View style={ps.header}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={ps.headerEmoji}>🤖</Text>
                    <View>
                        <Text style={ps.title}>Bernard's Weekly Plan</Text>
                        <Text style={ps.subtitle}>Tap a day to expand • ✏️ to edit</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[ps.regenBtn, regenerating && { opacity: 0.5 }]}
                    onPress={regenerate}
                    disabled={regenerating}
                >
                    <RefreshCw size={14} color="#22c55e" />
                    <Text style={ps.regenBtnText}>{regenerating ? "..." : "New Plan"}</Text>
                </TouchableOpacity>
            </View>

            {/* Action buttons row */}
            {!loading && !regenerating && plan && (
                <View style={ps.actionRow}>
                    <TouchableOpacity
                        style={[ps.logWeekBtn, { flex: 1 }, loggingWeek && { opacity: 0.6 }]}
                        onPress={handleLogWeek}
                        disabled={loggingWeek}
                    >
                        <CheckCircle size={15} color="#22c55e" />
                        <Text style={ps.logWeekBtnText}>{loggingWeek ? "Logging..." : "Log Entire Week"}</Text>
                    </TouchableOpacity>

                    {/* Share Plan button */}
                    <TouchableOpacity
                        style={ps.sharePlanBtn}
                        onPress={() => setSharePlanVisible(true)}
                    >
                        <Share2 size={15} color="#3b82f6" />
                        <Text style={ps.sharePlanBtnText}>Share</Text>
                    </TouchableOpacity>
                </View>
            )}

            {hasUnsavedChanges && (
                <TouchableOpacity style={ps.unsavedBanner} onPress={handleSaveChanges} disabled={saving}>
                    <Save size={14} color="#f97316" />
                    <Text style={ps.unsavedBannerText}>{saving ? "Saving..." : "You have unsaved changes — tap to save"}</Text>
                </TouchableOpacity>
            )}

            {loading || regenerating ? (
                <View style={ps.loadingBox}>
                    <Text style={ps.loadingText}>{regenerating ? "⚡ Bernard is crafting your new plan..." : "Loading your plan..."}</Text>
                </View>
            ) : !plan ? (
                <View style={ps.loadingBox}>
                    <Text style={ps.loadingText}>Could not load plan. Ask Bernard to generate one!</Text>
                </View>
            ) : (
                <View style={{ gap: 10 }}>
                    {plan.weekPlan.map((day, i) => (
                        <AIPlanDayCard
                            key={day.day} day={day} isToday={i === todayIndex}
                            userId={userId}
                            onPlanChange={(updated) => handleDayChange(i, updated)}
                            onWorkoutsLogged={onWorkoutsLogged}
                        />
                    ))}
                </View>
            )}

            <View style={ps.bernardHint}>
                <Text style={ps.bernardHintText}>
                    💬 Ask Bernard to adjust your plan, tap ✏️ to edit manually, or tap "Log" to track exercises.
                </Text>
            </View>

            {/* Share Plan Modal */}
            <SharePlanModal
                visible={sharePlanVisible}
                plan={plan}
                userId={userId}
                onClose={() => setSharePlanVisible(false)}
            />
        </View>
    );
}

// ─── Main Screen ──────────────────────────────
export default function ExerciseCalendar() {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [modalVisible, setModalVisible] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [workouts, setWorkouts] = useState<WorkoutEvent[]>([]);
    const [newWorkout, setNewWorkout] = useState({ name: "", type: "strength" as WorkoutEvent["type"], duration: "", time: "" });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = new Date(year, month, 1).getDay();
    const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    useEffect(() => {
        const init = async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;
            setUserId(auth.user.id);
            loadWorkouts(auth.user.id);
            const { data: profile } = await supabase
                .from("profiles")
                .select("age, gender, weight_kg, height_cm, goal, activity_level, daily_calories, daily_protein, daily_fat, daily_carbs")
                .eq("id", auth.user.id)
                .single();
            if (profile) setUserProfile(profile);
        };
        init();
    }, []);

    const loadWorkouts = async (uid: string) => {
        const { data } = await supabase.from("workouts").select("id, date, name, type, duration_minutes, created_at").eq("user_id", uid).order("date", { ascending: false });
        if (data) {
            setWorkouts(data.map((w) => ({
                id: w.id, date: w.date, name: w.name,
                type: (w.type ?? "strength") as WorkoutEvent["type"],
                duration: Number(w.duration_minutes ?? 0),
                time: w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
            })));
        }
    };

    const getWorkoutsForDay = (day: number) => {
        const dateStr = toDateStr(new Date(year, month, day));
        return workouts.filter((w) => w.date === dateStr);
    };

    const selectedDateStr = toDateStr(selectedDate);
    const selectedWorkouts = workouts.filter((w) => w.date === selectedDateStr);

    const addWorkout = async () => {
        if (!newWorkout.name || !newWorkout.duration) { Alert.alert("Missing Fields", "Please fill in workout name and duration."); return; }
        if (!userId) return;
        const { data, error } = await supabase.from("workouts").insert({
            user_id: userId, date: selectedDateStr, name: newWorkout.name,
            type: newWorkout.type, duration_minutes: parseInt(newWorkout.duration) || 0, completed: true,
        }).select().single();
        if (error) { Alert.alert("Error", error.message); return; }
        const added: WorkoutEvent = {
            id: data.id, date: data.date, name: data.name,
            type: (data.type ?? "strength") as WorkoutEvent["type"],
            duration: Number(data.duration_minutes ?? 0),
            time: newWorkout.time || "—",
        };
        setWorkouts((prev) => [...prev, added]);
        setModalVisible(false);
        setNewWorkout({ name: "", type: "strength", duration: "", time: "" });
    };

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekWorkouts = workouts.filter((w) => {
        const d = new Date(w.date + "T00:00:00");
        return d >= weekStart && d <= today;
    });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

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
                    <View style={styles.dayHeaderRow}>
                        {DAYS.map((d) => <Text key={d} style={styles.dayHeader}>{d}</Text>)}
                    </View>
                    <View style={styles.grid}>
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <View key={`e-${i}`} style={styles.dayCell} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayWorkouts = getWorkoutsForDay(day);
                            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                            const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                            return (
                                <TouchableOpacity
                                    key={day}
                                    style={[styles.dayCell, isToday && styles.dayCellToday, isSelected && !isToday && styles.dayCellSelected]}
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

                {/* Selected Day */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
                    </Text>
                    {selectedWorkouts.length > 0 ? selectedWorkouts.map((workout) => {
                        const config = workoutTypeConfig[workout.type];
                        const Icon = config.icon;
                        return (
                            <View key={workout.id} style={[styles.workoutCard, { backgroundColor: config.tint, borderColor: config.border, borderWidth: 1 }]}>
                                <View style={[styles.accentBar, { backgroundColor: config.color }]} />
                                <View style={[styles.workoutIconCircle, { backgroundColor: config.bgColor }]}>
                                    <Icon size={20} color={config.color} />
                                </View>
                                <View style={styles.workoutInfo}>
                                    <Text style={styles.workoutName}>{workout.name}</Text>
                                    <Text style={[styles.workoutMeta, { color: config.color }]}>
                                        {workout.time}{workout.duration > 0 ? ` • ${workout.duration} min` : ""} • {config.label}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteWorkoutBtn}
                                    onPress={() => {
                                        Alert.alert("Remove Workout", `Remove "${workout.name}"?`, [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Remove", style: "destructive",
                                                onPress: async () => {
                                                    const { error } = await supabase.from("workouts").delete().eq("id", workout.id);
                                                    if (!error) setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
                                                    else Alert.alert("Error", "Could not remove workout.");
                                                },
                                            },
                                        ]);
                                    }}
                                >
                                    <X size={14} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        );
                    }) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No workouts scheduled</Text>
                        </View>
                    )}
                </View>

                {/* This Week Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>This Week</Text>
                    <View style={styles.summaryGrid}>
                        {WORKOUT_TYPES.map((type) => {
                            const config = workoutTypeConfig[type];
                            const Icon = config.icon;
                            const count = weekWorkouts.filter((w) => w.type === type).length;
                            return (
                                <View key={type} style={[styles.summaryCard, { backgroundColor: config.tint, borderColor: config.border, borderWidth: 1 }]}>
                                    <View style={[styles.summaryIcon, { backgroundColor: config.bgColor }]}>
                                        <Icon size={16} color={config.color} />
                                    </View>
                                    <Text style={[styles.summaryCount, { color: config.color }]}>{count}</Text>
                                    <Text style={styles.summaryLabel}>{config.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* AI Plan Section */}
                <AIPlanSection userId={userId} userProfile={userProfile} onWorkoutsLogged={() => userId && loadWorkouts(userId)} />

                {/* Trends */}
                <WorkoutTrends userId={userId} />
            </ScrollView>

            {/* Add Workout Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Workout</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><X size={22} color="#888" /></TouchableOpacity>
                        </View>
                        <Text style={styles.inputLabel}>Date</Text>
                        <View style={styles.dateDisplay}>
                            <Text style={styles.dateDisplayText}>
                                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </Text>
                        </View>
                        <Text style={styles.inputLabel}>Workout Name</Text>
                        <TextInput placeholder="e.g., Morning Run" placeholderTextColor="#555" value={newWorkout.name} onChangeText={(v) => setNewWorkout({ ...newWorkout, name: v })} style={styles.input} />
                        <Text style={styles.inputLabel}>Type</Text>
                        <View style={styles.typeGrid}>
                            {WORKOUT_TYPES.map((type) => {
                                const cfg = workoutTypeConfig[type];
                                const isActive = newWorkout.type === type;
                                return (
                                    <TouchableOpacity key={type} style={[styles.typeBtn, isActive && { backgroundColor: cfg.tint, borderColor: cfg.color }]} onPress={() => setNewWorkout({ ...newWorkout, type })}>
                                        <Text style={[styles.typeBtnText, isActive && { color: cfg.color, fontWeight: "700" }]}>{cfg.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.inputLabel}>Duration (min)</Text>
                                <TextInput placeholder="30" placeholderTextColor="#555" keyboardType="numeric" value={newWorkout.duration} onChangeText={(v) => setNewWorkout({ ...newWorkout, duration: v })} style={styles.input} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Time (HH:MM)</Text>
                                <TextInput placeholder="07:00" placeholderTextColor="#555" value={newWorkout.time} onChangeText={(v) => setNewWorkout({ ...newWorkout, time: v })} style={styles.input} />
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

// ─── Share Modal Styles ───────────────────────
const shareStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    title: { color: "#fff", fontSize: 18, fontWeight: "700" },
    label: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 14, borderWidth: 1, borderColor: "#333" },
    catRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
    catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#333", backgroundColor: "#2a2a2a" },
    catBtnActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    catBtnText: { color: "#888", fontSize: 13 },
    catBtnTextActive: { color: "#22c55e", fontWeight: "700" },
    shareBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    // Plan preview inside share modal
    planPreview: { backgroundColor: "#111", borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a", gap: 6 },
    planPreviewTitle: { color: "#888", fontSize: 12, fontWeight: "600", marginBottom: 4 },
    planPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    planPreviewDay: { color: "#555", fontSize: 11, fontWeight: "700", width: 28 },
    planPreviewFocus: { color: "#ccc", fontSize: 12, flex: 1 },
    planPreviewCount: { color: "#22c55e", fontSize: 11, fontWeight: "600" },
});

// ─── Exercise Modal Styles ────────────────────
const es = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    sheetTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
    label: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 14, borderWidth: 1, borderColor: "#333" },
    saveBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// ─── AI Plan Styles ───────────────────────────
const ps = StyleSheet.create({
    wrap: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    headerEmoji: { fontSize: 28 },
    title: { color: "#fff", fontSize: 15, fontWeight: "700" },
    subtitle: { color: "#555", fontSize: 12, marginTop: 2 },
    regenBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
    regenBtnText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

    // Updated: action row with log week + share side by side
    actionRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    logWeekBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
    logWeekBtnText: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
    sharePlanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" },
    sharePlanBtnText: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },

    unsavedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)" },
    unsavedBannerText: { color: "#f97316", fontSize: 13, fontWeight: "600", flex: 1 },
    loadingBox: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 20, alignItems: "center" },
    loadingText: { color: "#555", fontSize: 13, textAlign: "center" },
    dayCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#2a2a2a" },
    dayCardToday: { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.05)" },
    dayCardRest: { borderColor: "#2a2a2a", opacity: 0.7 },
    dayCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dayName: { color: "#fff", fontSize: 14, fontWeight: "700" },
    dayFocus: { color: "#888", fontSize: 12, marginTop: 3 },
    todayChip: { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
    todayChipText: { color: "#22c55e", fontSize: 10, fontWeight: "700" },
    restBadge: { backgroundColor: "rgba(107,114,128,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    activeBadge: { backgroundColor: "rgba(34,197,94,0.15)" },
    restBadgeText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
    activeBadgeText: { color: "#22c55e" },
    editToggleBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#333" },
    editToggleBtnActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2a2a2a" },
    editControls: { backgroundColor: "#151515", borderRadius: 10, padding: 12, marginBottom: 12, gap: 10 },
    editControlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    editControlLabel: { color: "#888", fontSize: 13 },
    focusInput: { flex: 1, backgroundColor: "#2a2a2a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: "#fff", fontSize: 13, borderWidth: 1, borderColor: "#333" },
    toggleBtn: { backgroundColor: "#2a2a2a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "#333" },
    toggleBtnActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    toggleBtnText: { color: "#888", fontSize: 13, fontWeight: "600" },
    toggleBtnTextActive: { color: "#22c55e" },
    exerciseList: { gap: 8 },
    exerciseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    exerciseRowLogged: { opacity: 0.6 },
    exNumCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center" },
    exNumCircleLogged: { backgroundColor: "rgba(34,197,94,0.15)" },
    exNum: { color: "#888", fontSize: 11, fontWeight: "700" },
    exName: { color: "#fff", fontSize: 13, fontWeight: "600" },
    exMeta: { color: "#555", fontSize: 12, marginTop: 2 },
    exActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.1)", alignItems: "center", justifyContent: "center" },
    logSingleBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
    logSingleBtnText: { color: "#22c55e", fontSize: 11, fontWeight: "600" },
    loggedBadge: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    loggedBadgeText: { color: "#22c55e", fontSize: 11, fontWeight: "600" },
    addExBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)", backgroundColor: "rgba(34,197,94,0.05)", justifyContent: "center" },
    addExBtnText: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
    logAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
    logAllBtnText: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
    restMsg: { paddingTop: 4 },
    restMsgText: { color: "#555", fontSize: 13, fontStyle: "italic" },
    bernardHint: { marginTop: 14, backgroundColor: "rgba(34,197,94,0.05)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.1)" },
    bernardHintText: { color: "#555", fontSize: 12, lineHeight: 18 },
    startWorkoutBtn: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
    startWorkoutBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

// ─── Trend Styles ─────────────────────────────
const ts = StyleSheet.create({
    wrap: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { color: "#fff", fontSize: 14, fontWeight: "700" },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#333" },
    pillActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    pillText: { color: "#555", fontSize: 12, fontWeight: "600" },
    pillTextActive: { color: "#22c55e" },
    statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 10, alignItems: "center", gap: 2, borderWidth: 1, borderColor: "#2a2a2a" },
    statVal: { color: "#22c55e", fontSize: 16, fontWeight: "700" },
    statLabel: { color: "#555", fontSize: 10 },
    chartBlock: { marginBottom: 20 },
    chartLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
});

// ─── Main Styles ──────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    header: { backgroundColor: "#1a1a1a", padding: 16, paddingTop: 52, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    headerSub: { color: "#888", fontSize: 12, marginTop: 2 },
    addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#22c55e", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 6 },
    addBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "700" },
    monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center" },
    monthName: { color: "#fff", fontSize: 16, fontWeight: "600" },
    body: { padding: 16, gap: 24, paddingBottom: 100, backgroundColor: "#0a0a0a" },
    calendarCard: { backgroundColor: "#1a3329", borderRadius: 20, padding: 12 },
    dayHeaderRow: { flexDirection: "row", marginBottom: 6 },
    dayHeader: { flex: 1, textAlign: "center", color: "#666", fontSize: 11, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    dayCell: { width: `${100 / 7}%`, height: 48, padding: 2, alignItems: "center", justifyContent: "flex-start", paddingTop: 5, borderRadius: 8 },
    dayCellToday: { backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1.5, borderColor: "#22c55e" },
    dayCellSelected: { backgroundColor: "#2a2a2a" },
    dayNum: { color: "#ccc", fontSize: 12, fontWeight: "500" },
    dayNumToday: { color: "#22c55e", fontWeight: "700" },
    dotRow: { flexDirection: "row", gap: 2, marginTop: 2, flexWrap: "wrap", justifyContent: "center" },
    dot: { width: 5, height: 5, borderRadius: 3 },
    section: { gap: 10 },
    sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
    workoutCard: { borderRadius: 14, padding: 14, paddingLeft: 18, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", position: "relative" },
    accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
    workoutIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    workoutInfo: { flex: 1 },
    workoutName: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 3 },
    workoutMeta: { fontSize: 12 },
    emptyCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 24, alignItems: "center" },
    emptyText: { color: "#555", fontSize: 13 },
    summaryGrid: { flexDirection: "row", gap: 10 },
    summaryCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
    summaryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    summaryCount: { fontSize: 20, fontWeight: "700" },
    summaryLabel: { color: "#888", fontSize: 10, textAlign: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 16 },
    dateDisplay: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
    dateDisplayText: { color: "#fff", fontSize: 14 },
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#2a2a2a" },
    typeBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    row: { flexDirection: "row" },
    submitBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    deleteWorkoutBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.15)", marginLeft: 8 },
});