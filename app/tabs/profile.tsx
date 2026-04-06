/**
 * profile.tsx
 * Uses global AppContext for language + theme (both saved to AsyncStorage).
 * Time picker now supports both preset chips AND manual typed input.
 */

import * as Notifications from "expo-notifications";
import {
    Award, Bell, ChevronRight, Flame, Globe,
    HelpCircle, LogOut, MessageCircle, Moon,
    Sun, Target, TrendingUp, Trophy, User, X, Zap,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    Alert, Dimensions, Modal, ScrollView, StyleSheet,
    Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import Svg, {
    Defs,
    LinearGradient, Path, Stop,
    Circle as SvgCircle,
    Line as SvgLine,
} from "react-native-svg";
import { T, useApp } from "../../lib/context/AppContext";
import { supabase } from "../../lib/supabase";

// ─── Types ──────────────────────────────────────
interface UserData {
    name: string; age: string; gender: string;
    currentWeight: string; goalWeight: string; fitnessGoal: string;
}
interface StatsData {
    totalWorkouts: number; totalDistanceKm: number;
    totalActiveDays: number; currentStreak: number;
    totalCaloriesBurned: number; totalActiveMinutes: number;
}
interface AchievementItem {
    icon: any; label: string; color: string; earned: boolean;
}

// ─── Notification handler ────────────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "💪 Workout Time!",
            body: "You have a workout scheduled today. Let's crush it!",
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
        },
    });
    return true;
}

async function cancelReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Time Picker Modal ───────────────────────────
// Shows preset hour chips + manual typed override
const PRESET_HOURS = [6, 7, 8, 9, 10, 12, 15, 17, 18, 19, 20, 21];
const MINUTE_OPTIONS = [0, 15, 30, 45];

function fmt12(h: number, m: number = 0) {
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function TimePickerModal({
    visible, initialHour, initialMinute, onSave, onClose,
}: {
    visible: boolean; initialHour: number; initialMinute: number;
    onSave: (h: number, m: number) => void; onClose: () => void;
}) {
    const { colors, lang } = useApp();
    const t = T[lang];

    const [hour, setHour] = useState(initialHour);
    const [minute, setMinute] = useState(initialMinute);
    // Manual typed input state  (24hr format strings)
    const [manualHour, setManualHour] = useState("");
    const [manualMin, setManualMin] = useState("");
    const [useManual, setUseManual] = useState(false);

    useEffect(() => {
        if (visible) {
            setHour(initialHour); setMinute(initialMinute);
            setManualHour(""); setManualMin(""); setUseManual(false);
        }
    }, [visible]);

    const handleSave = () => {
        let h = hour, m = minute;
        if (useManual) {
            const ph = parseInt(manualHour);
            const pm = parseInt(manualMin || "0");
            if (isNaN(ph) || ph < 0 || ph > 23) {
                Alert.alert("Invalid time", "Hour must be 0–23."); return;
            }
            if (isNaN(pm) || pm < 0 || pm > 59) {
                Alert.alert("Invalid time", "Minute must be 0–59."); return;
            }
            h = ph; m = pm;
        }
        onSave(h, m);
    };

    const C = colors;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[ms.overlay, { backgroundColor: C.overlayBg }]}>
                <View style={[ms.sheet, { backgroundColor: C.modalBg }]}>
                    <View style={ms.header}>
                        <Text style={[ms.title, { color: C.text }]}>{t.chooseTime}</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color={C.textMuted} /></TouchableOpacity>
                    </View>
                    <Text style={[ms.sub, { color: C.textSub }]}>{t.reminderTimeSub}</Text>

                    {/* ── Mode toggle ── */}
                    <View style={[ms.modeRow, { backgroundColor: C.surface3, borderColor: C.border }]}>
                        <TouchableOpacity
                            style={[ms.modeBtn, !useManual && { backgroundColor: C.green }]}
                            onPress={() => setUseManual(false)}
                        >
                            <Text style={[ms.modeBtnText, { color: !useManual ? "#fff" : C.textSub }]}>Presets</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[ms.modeBtn, useManual && { backgroundColor: C.green }]}
                            onPress={() => setUseManual(true)}
                        >
                            <Text style={[ms.modeBtnText, { color: useManual ? "#fff" : C.textSub }]}>Custom</Text>
                        </TouchableOpacity>
                    </View>

                    {!useManual ? (
                        <>
                            {/* Preset hour chips */}
                            <Text style={[ms.pickerLabel, { color: C.textMuted }]}>Hour</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.chipRow}>
                                {PRESET_HOURS.map((h) => (
                                    <TouchableOpacity
                                        key={h}
                                        style={[ms.chip, { backgroundColor: C.surface2, borderColor: C.border },
                                        hour === h && { backgroundColor: `${C.green}22`, borderColor: C.green }]}
                                        onPress={() => setHour(h)}
                                    >
                                        <Text style={[ms.chipText, { color: hour === h ? C.green : C.textSub }]}>
                                            {fmt12(h)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Minute chips */}
                            <Text style={[ms.pickerLabel, { color: C.textMuted, marginTop: 14 }]}>Minute</Text>
                            <View style={ms.minuteRow}>
                                {MINUTE_OPTIONS.map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[ms.minuteChip, { backgroundColor: C.surface2, borderColor: C.border },
                                        minute === m && { backgroundColor: `${C.green}22`, borderColor: C.green }]}
                                        onPress={() => setMinute(m)}
                                    >
                                        <Text style={[ms.chipText, { color: minute === m ? C.green : C.textSub }]}>
                                            :{String(m).padStart(2, "0")}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    ) : (
                        /* ── Manual typed input ── */
                        <View style={ms.manualBox}>
                            <Text style={[ms.pickerLabel, { color: C.textMuted, marginBottom: 12 }]}>
                                Enter time in 24-hour format
                            </Text>
                            <View style={ms.manualRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[ms.manualLabel, { color: C.textSub }]}>Hour (0–23)</Text>
                                    <TextInput
                                        style={[ms.manualInput, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
                                        value={manualHour}
                                        onChangeText={(v) => setManualHour(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                        placeholder="7"
                                        placeholderTextColor={C.textMuted}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                    />
                                </View>
                                <Text style={[ms.colonSep, { color: C.textSub }]}>:</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[ms.manualLabel, { color: C.textSub }]}>Minute (0–59)</Text>
                                    <TextInput
                                        style={[ms.manualInput, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
                                        value={manualMin}
                                        onChangeText={(v) => setManualMin(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                        placeholder="00"
                                        placeholderTextColor={C.textMuted}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                    />
                                </View>
                            </View>
                            {/* Live preview for manual */}
                            {manualHour !== "" && (
                                <Text style={[ms.manualPreview, { color: C.green }]}>
                                    {fmt12(parseInt(manualHour) || 0, parseInt(manualMin) || 0)} PHT
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Preview for preset mode */}
                    {!useManual && (
                        <View style={[ms.preview, { backgroundColor: C.surface2, borderColor: C.border }]}>
                            <Text style={[ms.previewLabel, { color: C.textSub }]}>Reminder will fire at</Text>
                            <Text style={[ms.previewValue, { color: C.green }]}>{fmt12(hour, minute)} PHT</Text>
                        </View>
                    )}

                    <TouchableOpacity style={[ms.saveBtn, { backgroundColor: C.green }]} onPress={handleSave}>
                        <Text style={ms.saveBtnText}>{t.save}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const ms = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    title: { fontSize: 17, fontWeight: "700" },
    sub: { fontSize: 12, marginBottom: 16 },
    modeRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden", marginBottom: 18 },
    modeBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
    modeBtnText: { fontSize: 13, fontWeight: "600" },
    pickerLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
    chipRow: { gap: 8, paddingBottom: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    chipText: { fontSize: 12 },
    minuteRow: { flexDirection: "row", gap: 8 },
    minuteChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
    manualBox: { marginBottom: 4 },
    manualRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    manualLabel: { fontSize: 11, marginBottom: 6 },
    manualInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: "700", textAlign: "center" },
    colonSep: { fontSize: 28, fontWeight: "700", marginBottom: 10 },
    manualPreview: { fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 14 },
    preview: { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 14, marginBottom: 16, borderWidth: 1 },
    previewLabel: { fontSize: 11, marginBottom: 4 },
    previewValue: { fontSize: 22, fontWeight: "700" },
    saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// ─── Language modal ──────────────────────────────
function LanguageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { lang, setLang, colors } = useApp();
    const C = colors;
    const languages = [
        { code: "en" as const, native: "English", sub: "English" },
        { code: "tl" as const, native: "Filipino (Tagalog)", sub: "Filipino" },
    ];
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[ms.overlay, { backgroundColor: C.overlayBg }]}>
                <View style={[ms.sheet, { backgroundColor: C.modalBg }]}>
                    <View style={ms.header}>
                        <Text style={[ms.title, { color: C.text }]}>Language / Wika</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color={C.textMuted} /></TouchableOpacity>
                    </View>
                    {languages.map((l) => (
                        <TouchableOpacity
                            key={l.code}
                            style={[lm.option, { backgroundColor: C.surface2, borderColor: C.border },
                            lang === l.code && { borderColor: C.green, backgroundColor: `${C.green}0f` }]}
                            onPress={() => { setLang(l.code); onClose(); }}
                        >
                            <View>
                                <Text style={[lm.label, { color: lang === l.code ? C.green : C.text }]}>{l.native}</Text>
                                <Text style={[lm.sub, { color: C.textSub }]}>{l.sub}</Text>
                            </View>
                            {lang === l.code && <View style={[lm.dot, { backgroundColor: C.green }]} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </Modal>
    );
}
const lm = StyleSheet.create({
    option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
    label: { fontSize: 15, fontWeight: "600" },
    sub: { fontSize: 12, marginTop: 2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
});

// ─── Help modal ──────────────────────────────────
function HelpModal({ visible, userId, onClose }: { visible: boolean; userId: string | null; onClose: () => void }) {
    const { lang, colors } = useApp();
    const t = T[lang];
    const C = colors;
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSend = async () => {
        if (!subject.trim() || !message.trim()) { Alert.alert("Missing Fields", "Please fill in both fields."); return; }
        setSubmitting(true);
        const { error } = await supabase.from("support_tickets").insert({ user_id: userId, subject: subject.trim(), message: message.trim() });
        setSubmitting(false);
        if (error) { Alert.alert("Error", t.ticketError); }
        else { Alert.alert("✅ Sent!", t.ticketSent); setSubject(""); setMessage(""); onClose(); }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[ms.overlay, { backgroundColor: C.overlayBg }]}>
                <ScrollView style={{ width: "100%" }} contentContainerStyle={[ms.sheet, { backgroundColor: C.modalBg }]} keyboardShouldPersistTaps="handled">
                    <View style={ms.header}>
                        <Text style={[ms.title, { color: C.text }]}>{t.helpTitle}</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color={C.textMuted} /></TouchableOpacity>
                    </View>

                    <View style={[hm.box, { backgroundColor: C.surface2, borderColor: C.border }]}>
                        <Text style={[hm.boxTitle, { color: C.text }]}>🎫 Submit a Ticket</Text>
                        <Text style={[hm.label, { color: C.textSub }]}>{t.ticketSubject}</Text>
                        <TextInput style={[hm.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} value={subject} onChangeText={setSubject} placeholder="e.g. Bug report..." placeholderTextColor={C.textMuted} />
                        <Text style={[hm.label, { color: C.textSub }]}>{t.ticketMessage}</Text>
                        <TextInput style={[hm.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text, minHeight: 100, textAlignVertical: "top" }]} value={message} onChangeText={setMessage} placeholder="Tell us what happened..." placeholderTextColor={C.textMuted} multiline />
                        <TouchableOpacity style={[ms.saveBtn, { backgroundColor: C.green, marginTop: 4 }, submitting && { opacity: 0.5 }]} onPress={handleSend} disabled={submitting}>
                            <Text style={ms.saveBtnText}>{submitting ? t.sending : t.sendTicket}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={hm.orRow}>
                        <View style={[hm.orLine, { backgroundColor: C.border }]} />
                        <Text style={[hm.orText, { color: C.textMuted }]}>{t.orLabel}</Text>
                        <View style={[hm.orLine, { backgroundColor: C.border }]} />
                    </View>

                    <TouchableOpacity style={[hm.chatBtn, { backgroundColor: `${C.green}14`, borderColor: `${C.green}33` }]}
                        onPress={() => { onClose(); Alert.alert("Coming Soon", "Live chat will be available in the next update!"); }}>
                        <MessageCircle size={18} color={C.green} />
                        <Text style={[hm.chatBtnText, { color: C.green }]}>{t.chatDev}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}
const hm = StyleSheet.create({
    box: { borderRadius: 14, padding: 16, marginTop: 10, borderWidth: 1 },
    boxTitle: { fontSize: 14, fontWeight: "700", marginBottom: 14 },
    label: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 7 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, marginBottom: 14 },
    orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
    orLine: { flex: 1, height: 1 },
    orText: { fontSize: 12 },
    chatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 12, paddingVertical: 14, borderWidth: 1 },
    chatBtnText: { fontSize: 14, fontWeight: "600" },
});

// ─── Progress bar ────────────────────────────────
function ProgressBar({ value, height = 8, trackColor, fillColor }: { value: number; height?: number; trackColor: string; fillColor: string }) {
    const clamped = Math.min(Math.max(value, 0), 100);
    return (
        <View style={{ height, backgroundColor: trackColor, borderRadius: 99, overflow: "hidden" }}>
            <View style={{ width: `${clamped}%`, height, backgroundColor: fillColor, borderRadius: 99 }} />
        </View>
    );
}

const SW = Dimensions.get("window").width;

// ─── Weight mini chart ───────────────────────────
function WeightMiniChart({ logs, goalWeight }: { logs: { weight_kg: number; logged_at: string }[]; goalWeight: number }) {
    const { colors } = useApp();
    const W = SW - 80, H = 80;
    const pL = 8, pR = 8, pT = 8, pB = 8;
    const iW = W - pL - pR, iH = H - pT - pB;
    const values = logs.map((l) => l.weight_kg);
    const allV = [...values, goalWeight].filter((v) => v > 0);
    if (allV.length === 0) return null;
    const minV = Math.min(...allV) - 1, maxV = Math.max(...allV) + 1;
    const tx = (i: number) => pL + (i / Math.max(logs.length - 1, 1)) * iW;
    const ty = (v: number) => pT + iH - ((v - minV) / (maxV - minV)) * iH;
    const pts = logs.map((l, i) => ({ x: tx(i), y: ty(l.weight_kg) }));
    const line = pts.reduce((acc, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        const prev = pts[i - 1]; const cx = (prev.x + pt.x) / 2;
        return `${acc} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, "");
    const goalY = goalWeight > 0 ? ty(goalWeight) : null;
    return (
        <Svg width={W} height={H}>
            <Defs>
                <LinearGradient id="wmc" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.green} stopOpacity="0.2" />
                    <Stop offset="100%" stopColor={colors.green} stopOpacity="0" />
                </LinearGradient>
            </Defs>
            {goalY !== null && <SvgLine x1={pL} y1={goalY} x2={W - pR} y2={goalY} stroke={colors.green} strokeWidth="1" strokeDasharray="3,2" />}
            {pts.length > 1 && <Path d={`${line} L${pts[pts.length - 1].x},${pT + iH} L${pL},${pT + iH} Z`} fill="url(#wmc)" />}
            <Path d={line} fill="none" stroke={colors.blue} strokeWidth="2" strokeLinecap="round" />
            {pts.map((pt, i) => <SvgCircle key={i} cx={pt.x} cy={pt.y} r={i === pts.length - 1 ? 4 : 2} fill={i === pts.length - 1 ? colors.green : colors.blue} stroke={i === pts.length - 1 ? colors.green : colors.blue} strokeWidth="1" />)}
        </Svg>
    );
}

// ═══════════════════════════════════════════════
// ─── MAIN SCREEN ──────────────────────────────
// ═══════════════════════════════════════════════
export default function Profile() {
    const { lang, theme, setTheme, isDark, colors } = useApp();
    const C = colors;
    const t = T[lang];

    const [userData, setUserData] = useState<UserData | null>(null);
    const [statsData, setStatsData] = useState<StatsData>({ totalWorkouts: 0, totalDistanceKm: 0, totalActiveDays: 0, currentStreak: 0, totalCaloriesBurned: 0, totalActiveMinutes: 0 });
    const [achievements, setAchievements] = useState<AchievementItem[]>([]);
    const [weightLogs, setWeightLogs] = useState<{ id: string; weight_kg: number; logged_at: string }[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    // Notification state
    const [notifEnabled, setNotifEnabled] = useState(false);
    const [notifHour, setNotifHour] = useState(7);
    const [notifMinute, setNotifMinute] = useState(0);

    // Modal visibility
    const [showTime, setShowTime] = useState(false);
    const [showLang, setShowLang] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user; if (!user) return;
        setUserId(user.id);

        const [profileRes, workoutsRes, streakRes, userAchRes, allAchRes, dailyRes, wLogsRes] = await Promise.all([
            supabase.from("profiles").select("first_name,age,gender,weight_kg,goal_weight,goal").eq("id", user.id).single(),
            supabase.from("workouts").select("distance_km").eq("user_id", user.id).eq("completed", true),
            supabase.from("streaks").select("current_streak,total_active_days").eq("user_id", user.id).single(),
            supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
            supabase.from("achievements").select("id,key,name"),
            supabase.from("daily_stats").select("calories_burned,active_minutes").eq("user_id", user.id),
            supabase.from("weight_logs").select("id,weight_kg,logged_at").eq("user_id", user.id).order("logged_at", { ascending: true }),
        ]);

        if (profileRes.data) {
            const p = profileRes.data;
            setUserData({ name: p.first_name ?? "User", age: p.age?.toString() ?? "--", gender: p.gender ?? "--", currentWeight: p.weight_kg?.toString() ?? "--", goalWeight: p.goal_weight?.toString() ?? "--", fitnessGoal: p.goal ?? "" });
        }
        if (wLogsRes.data) setWeightLogs(wLogsRes.data);

        const totalWorkouts = workoutsRes.data?.length ?? 0;
        const totalDist = workoutsRes.data?.reduce((s, w) => s + (Number(w.distance_km) || 0), 0) ?? 0;
        const totalCal = dailyRes.data?.reduce((s, r) => s + (Number(r.calories_burned) || 0), 0) ?? 0;
        const totalMin = dailyRes.data?.reduce((s, r) => s + (Number(r.active_minutes) || 0), 0) ?? 0;
        const activeDays = dailyRes.data?.filter(r => (Number(r.calories_burned) || 0) > 0).length ?? 0;

        setStatsData({ totalWorkouts, totalDistanceKm: Math.round(totalDist * 10) / 10, totalActiveDays: streakRes.data?.total_active_days ?? activeDays, currentStreak: streakRes.data?.current_streak ?? 0, totalCaloriesBurned: Math.round(totalCal), totalActiveMinutes: Math.round(totalMin) });

        if (allAchRes.data) {
            const earned = new Set(userAchRes.data?.map(u => u.achievement_id) ?? []);
            const iconMap: Record<string, any> = { early_bird: Zap, goal_setter: Target, streak_3: Flame, streak_7: Flame, streak_30: Trophy, first_workout: Trophy, "10k_steps": TrendingUp, calorie_crusher: Flame, distance_5k: Award };
            const colorMap: Record<string, string> = { early_bird: "#3b82f6", goal_setter: "#22c55e", streak_3: "#f97316", streak_7: "#f97316", streak_30: "#eab308", first_workout: "#eab308", "10k_steps": "#22c55e", calorie_crusher: "#f97316", distance_5k: "#a855f7" };
            setAchievements(allAchRes.data.slice(0, 4).map(a => ({ icon: iconMap[a.key] ?? Trophy, label: a.name, color: colorMap[a.key] ?? "#888", earned: earned.has(a.id) })));
        }
    };

    const handleToggleNotif = async (val: boolean) => {
        if (val) {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== "granted") { Alert.alert("Permission Required", "Enable notifications in Settings to use reminders."); return; }
            setNotifEnabled(true); setShowTime(true);
        } else {
            await cancelReminders(); setNotifEnabled(false);
        }
    };

    const handleSaveTime = async (h: number, m: number) => {
        setNotifHour(h); setNotifMinute(m); setShowTime(false);
        const ok = await scheduleDailyReminder(h, m);
        if (ok) {
            Alert.alert("✅ Reminder Set", `You'll be reminded every day at ${fmt12(h, m)} PHT.`);
        } else {
            Alert.alert("Error", "Could not schedule reminder."); setNotifEnabled(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(t.logout, t.logoutConfirm, [
            { text: t.cancel, style: "cancel" },
            { text: t.logout, style: "destructive", onPress: () => supabase.auth.signOut() },
        ]);
    };

    const goalLabel: Record<string, string> = {
        lose: lang === "en" ? "Weight Loss Journey" : "Pagbabawas ng Timbang",
        gain: lang === "en" ? "Muscle Building" : "Pagpapalakas ng Kalamnan",
        maintain: lang === "en" ? "Maintaining Fitness" : "Pagpapanatili ng Fitness",
        endurance: lang === "en" ? "Endurance Training" : "Pagsasanay sa Pagtitiis",
    };

    const stats = [
        { label: t.workouts, value: statsData.totalWorkouts.toString(), icon: TrendingUp },
        { label: t.totalDistance, value: `${statsData.totalDistanceKm} ${t.km}`, icon: Target },
        { label: t.activeDays, value: statsData.totalActiveDays.toString(), icon: Award },
        { label: t.totalBurned, value: statsData.totalCaloriesBurned >= 1000 ? `${(statsData.totalCaloriesBurned / 1000).toFixed(1)}k` : statsData.totalCaloriesBurned.toString(), icon: Flame },
    ];

    const wProg = userData?.currentWeight && userData?.goalWeight
        ? ((parseFloat(userData.currentWeight) - parseFloat(userData.goalWeight)) / parseFloat(userData.currentWeight)) * 100
        : 0;

    // ── Themed dynamic styles ─────────────────────
    const D = StyleSheet.create({
        container: { flex: 1, backgroundColor: C.bg },
        header: { backgroundColor: C.surface2, padding: 24, paddingTop: 48, borderRadius: 16, marginTop: 40 },
        progressCard: { backgroundColor: C.cardGreen, borderRadius: 12, padding: 16, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: C.cardGreenBorder },
        calBanner: { flexDirection: "row", alignItems: "center", backgroundColor: `${C.orange}18`, borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: `${C.orange}33` },
        card: { backgroundColor: C.surface2, borderRadius: 16, overflow: "hidden" },
        statCard: { width: "47.5%", backgroundColor: C.surface2, borderRadius: 16, padding: 16, alignItems: "center", gap: 6 },
        achCard: { width: "48%", backgroundColor: C.surface2, borderRadius: 16, padding: 16, gap: 8 },
        infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
        border: { borderBottomWidth: 1, borderBottomColor: C.border },
        settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
    });

    return (
        <ScrollView style={D.container} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* ── Header ── */}
            <View style={D.header}>
                <View style={styles.headerTop}>
                    <View style={[styles.avatar, { backgroundColor: `${C.green}18`, borderColor: `${C.green}33` }]}>
                        <User size={40} color={C.green} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.userName, { color: C.text }]}>{userData?.name || "User"}</Text>
                        <Text style={{ color: C.textSub, fontSize: 13 }}>{userData?.fitnessGoal ? goalLabel[userData.fitnessGoal] ?? "" : ""}</Text>
                        <Text style={{ color: C.orange, fontSize: 12, fontWeight: "500" }}>🔥 {statsData.currentStreak} {t.dayStreak}</Text>
                    </View>
                </View>

                {/* Weight progress */}
                <View style={D.progressCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                        <Text style={{ color: C.textSub, fontSize: 13 }}>{t.weightProgress}</Text>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }}>{userData?.currentWeight || "--"} → {userData?.goalWeight || "--"} kg</Text>
                    </View>
                    <ProgressBar value={wProg} trackColor={`${C.green}22`} fillColor={C.green} />
                    {weightLogs.length >= 2 && <View style={{ marginTop: 12 }}><WeightMiniChart logs={weightLogs} goalWeight={parseFloat(userData?.goalWeight ?? "0")} /></View>}
                    {weightLogs.length > 0 && (
                        <View style={{ marginTop: 10, gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: `${C.green}22` }}>
                            {weightLogs.slice(-3).reverse().map((log, i) => (
                                <View key={log.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === 0 ? C.green : C.blue }} />
                                    <Text style={{ color: C.text, fontSize: 13, fontWeight: "600", flex: 1 }}>{log.weight_kg} kg</Text>
                                    <Text style={{ color: C.textMuted, fontSize: 11 }}>{new Date(log.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Calories burned banner */}
                <View style={D.calBanner}>
                    <Flame size={18} color={C.orange} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: C.textSub, fontSize: 12 }}>{t.totalBurned}</Text>
                        <Text style={{ color: C.orange, fontSize: 18, fontWeight: "700", marginTop: 2 }}>{statsData.totalCaloriesBurned.toLocaleString()} kcal</Text>
                    </View>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>all time</Text>
                </View>
            </View>

            <View style={{ padding: 16, gap: 24 }}>
                {/* Activity Stats */}
                <View style={{ gap: 12 }}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t.activityStats}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <View key={stat.label} style={D.statCard}>
                                    <Icon size={20} color={stat.label === t.totalBurned ? C.orange : C.green} />
                                    <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", marginTop: 4 }}>{stat.value}</Text>
                                    <Text style={{ color: C.textSub, fontSize: 11, textAlign: "center" }}>{stat.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Achievements */}
                <View style={{ gap: 12 }}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t.achievements}</Text>
                    {achievements.length === 0 ? (
                        <View style={[D.card, { padding: 24, alignItems: "center" }]}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
                            <Text style={{ color: C.textSub, fontSize: 14 }}>{t.noAchievements}</Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                            {achievements.map((a) => {
                                const Icon = a.icon;
                                return (
                                    <View key={a.label} style={[D.achCard, !a.earned && { opacity: 0.4 }]}>
                                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: a.earned ? `${C.green}18` : C.surface3, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                                            <Icon size={24} color={a.color} />
                                        </View>
                                        <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }}>{a.label}</Text>
                                        {a.earned && <Text style={{ color: C.green, fontSize: 11 }}>Earned ✓</Text>}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Personal Info */}
                <View style={{ gap: 12 }}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t.personalInfo}</Text>
                    <View style={D.card}>
                        {[
                            { label: t.age, value: `${userData?.age || "--"} ${t.years}` },
                            { label: t.gender, value: userData?.gender || "--" },
                            { label: t.currentWeight, value: `${userData?.currentWeight || "--"} kg` },
                            { label: t.goalWeight, value: `${userData?.goalWeight || "--"} kg` },
                        ].map((item, i, arr) => (
                            <View key={item.label} style={[D.infoRow, i < arr.length - 1 && D.border]}>
                                <Text style={{ color: C.textSub, fontSize: 13 }}>{item.label}</Text>
                                <Text style={{ color: C.text, fontSize: 13, textTransform: "capitalize" }}>{item.value}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Settings ── */}
                <View style={{ gap: 12 }}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t.settings}</Text>
                    <View style={D.card}>

                        {/* Notifications */}
                        <View style={[D.settingRow, D.border]}>
                            <View style={styles.settingLeft}>
                                <Bell size={20} color={C.textSub} />
                                <View>
                                    <Text style={{ color: C.text, fontSize: 14 }}>{t.notifications}</Text>
                                    {notifEnabled && <Text style={{ color: C.green, fontSize: 11, marginTop: 2 }}>{fmt12(notifHour, notifMinute)} PHT</Text>}
                                </View>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                {notifEnabled && (
                                    <TouchableOpacity
                                        style={[styles.editBtn, { backgroundColor: `${C.green}18`, borderColor: `${C.green}33` }]}
                                        onPress={() => setShowTime(true)}
                                    >
                                        <Text style={{ color: C.green, fontSize: 11, fontWeight: "600" }}>Edit</Text>
                                    </TouchableOpacity>
                                )}
                                <Switch value={notifEnabled} onValueChange={handleToggleNotif} trackColor={{ false: C.surface3, true: C.green }} thumbColor="#fff" />
                            </View>
                        </View>

                        {/* Language */}
                        <TouchableOpacity style={[D.settingRow, D.border]} onPress={() => setShowLang(true)}>
                            <View style={styles.settingLeft}>
                                <Globe size={20} color={C.textSub} />
                                <Text style={{ color: C.text, fontSize: 14 }}>{t.language}</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ color: C.textSub, fontSize: 13 }}>{lang === "en" ? "English" : "Filipino"}</Text>
                                <ChevronRight size={18} color={C.textMuted} />
                            </View>
                        </TouchableOpacity>

                        {/* Dark / Light mode */}
                        <View style={[D.settingRow, D.border]}>
                            <View style={styles.settingLeft}>
                                {isDark ? <Moon size={20} color={C.textSub} /> : <Sun size={20} color={C.textSub} />}
                                <Text style={{ color: C.text, fontSize: 14 }}>{t.darkMode}</Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={(v) => setTheme(v ? "dark" : "light")}
                                trackColor={{ false: C.surface3, true: C.green }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Help & Support */}
                        <TouchableOpacity style={D.settingRow} onPress={() => setShowHelp(true)}>
                            <View style={styles.settingLeft}>
                                <HelpCircle size={20} color={C.textSub} />
                                <Text style={{ color: C.text, fontSize: 14 }}>{t.helpSupport}</Text>
                            </View>
                            <ChevronRight size={20} color={C.textSub} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={[styles.logoutBtn, { borderColor: C.red }]} onPress={handleLogout}>
                    <LogOut size={16} color={C.red} />
                    <Text style={{ color: C.red, fontSize: 15, fontWeight: "600" }}>{t.logout}</Text>
                </TouchableOpacity>

                <View style={{ alignItems: "center", gap: 4, paddingBottom: 8 }}>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>Carpio Fit v1.0.0</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>Your personal fitness companion</Text>
                </View>
            </View>

            {/* Modals */}
            <TimePickerModal visible={showTime} initialHour={notifHour} initialMinute={notifMinute} onSave={handleSaveTime} onClose={() => { setShowTime(false); if (notifEnabled && notifHour === 7 && notifMinute === 0) setNotifEnabled(false); }} />
            <LanguageModal visible={showLang} onClose={() => setShowLang(false)} />
            <HelpModal visible={showHelp} userId={userId} onClose={() => setShowHelp(false)} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 16 },
    userName: { fontSize: 20, fontWeight: "600" },
    sectionTitle: { fontSize: 16, fontWeight: "600" },
    settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    editBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
});