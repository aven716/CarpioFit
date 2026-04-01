import DateTimePicker from "@react-native-community/datetimepicker";
import { StatusBar } from "expo-status-bar";
import {
    Apple,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Coffee,
    Moon,
    Plus,
    Search,
    Sun,
    TrendingUp,
    X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, Circle as SvgCircle, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { supabase } from "../../lib/supabase";

// ─── Types ───────────────────────────────────
interface MealItem {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meal: string;
}

interface FoodResult {
    foodId: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
}

interface DayStats {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

// ─── Constants ───────────────────────────────
const SUPABASE_FUNCTION_URL =
    "https://xnnuufpjmicavrmimjnh.supabase.co/functions/v1/edamam-search";
const SCREEN_WIDTH = Dimensions.get("window").width;

const mealTypes = [
    { id: "breakfast", name: "Breakfast", icon: Coffee, color: "#eab308", tint: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.22)" },
    { id: "lunch", name: "Lunch", icon: Sun, color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)" },
    { id: "dinner", name: "Dinner", icon: Moon, color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)" },
    { id: "snack", name: "Snacks", icon: Apple, color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)" },
];

// ─── Helpers ─────────────────────────────────
const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const formatDisplayDate = (dateStr: string) => {
    const today = toDateStr(new Date());
    const yesterday = toDateStr(new Date(Date.now() - 86400000));
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ─── Simple Line Chart ────────────────────────
function SimpleLineChart({
    data,
    valueKey,
    color,
    goalLine,
}: {
    data: DayStats[];
    valueKey: keyof DayStats;
    color: string;
    goalLine?: number;
}) {
    const W = SCREEN_WIDTH - 80;
    const H = 110;
    const pL = 36, pR = 8, pT = 8, pB = 22;
    const iW = W - pL - pR;
    const iH = H - pT - pB;

    const values = data.map((d) => Number(d[valueKey] ?? 0));
    const maxV = Math.max(...values, goalLine ?? 0, 1) * 1.2;

    const tx = (i: number) => pL + (i / Math.max(data.length - 1, 1)) * iW;
    const ty = (v: number) => pT + iH - (v / maxV) * iH;

    const pts = data.map((d, i) => ({ x: tx(i), y: ty(Number(d[valueKey] ?? 0)) }));

    const linePath = pts.reduce((acc, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        const prev = pts[i - 1];
        const cx = (prev.x + pt.x) / 2;
        return `${acc} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, "");

    const areaPath = `${linePath} L${pts[pts.length - 1].x},${pT + iH} L${pL},${pT + iH} Z`;

    const yTicks = [0, 0.5, 1].map((t) => ({
        y: pT + iH - t * iH,
        val: Math.round(t * maxV),
    }));

    const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((i) => ({ x: tx(i), label: data[i]?.date.slice(5) ?? "" }));

    if (data.length < 2) {
        return (
            <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#444", fontSize: 12 }}>Log more days to see trends</Text>
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

            {yTicks.map((t) => (
                <SvgLine key={t.val} x1={pL} y1={t.y} x2={W - pR} y2={t.y} stroke="#222" strokeWidth="1" />
            ))}
            {yTicks.map((t) => (
                <SvgText key={`y${t.val}`} x={pL - 4} y={t.y + 4} fontSize="8" fill="#444" textAnchor="end">
                    {t.val}
                </SvgText>
            ))}

            {goalLine !== undefined && (
                <SvgLine x1={pL} y1={ty(goalLine)} x2={W - pR} y2={ty(goalLine)}
                    stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
            )}

            <Path d={areaPath} fill={`url(#g-${valueKey})`} />
            <Path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {pts.map((pt, i) => (
                <SvgCircle key={i} cx={pt.x} cy={pt.y}
                    r={i === pts.length - 1 ? 4 : 2.5}
                    fill={i === pts.length - 1 ? color : "#111"}
                    stroke={color} strokeWidth="1.5"
                />
            ))}

            {xLabels.map((xl) => (
                <SvgText key={xl.label} x={xl.x} y={H - 4} fontSize="8" fill="#444" textAnchor="middle">
                    {xl.label}
                </SvgText>
            ))}
        </Svg>
    );
}

// ─── Trends Section ───────────────────────────
function TrendsSection({ userId, goalCalories }: { userId: string | null; goalCalories: number }) {
    const [data, setData] = useState<DayStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState<7 | 14>(7);

    useEffect(() => {
        if (!userId) return;
        load();
    }, [userId, days]);

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - days + 1);

            const { data: logs } = await supabase
                .from("food_logs")
                .select("calories, protein_g, carbs_g, fat_g, logged_at")
                .eq("user_id", userId)
                .gte("logged_at", `${toDateStr(start)}T00:00:00`)
                .lte("logged_at", `${toDateStr(end)}T23:59:59`);

            const map: Record<string, DayStats> = {};
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                const key = toDateStr(d);
                map[key] = { date: key, calories: 0, protein: 0, carbs: 0, fat: 0 };
            }
            (logs ?? []).forEach((l) => {
                const key = l.logged_at.split("T")[0];
                if (map[key]) {
                    map[key].calories += Number(l.calories ?? 0);
                    map[key].protein += Number(l.protein_g ?? 0);
                    map[key].carbs += Number(l.carbs_g ?? 0);
                    map[key].fat += Number(l.fat_g ?? 0);
                }
            });
            setData(Object.values(map).sort((a, b) => a.date.localeCompare(b.date)));
        } finally {
            setLoading(false);
        }
    };

    const macros = [
        { key: "calories" as keyof DayStats, label: "Calories", color: "#22c55e", unit: "kcal" },
        { key: "protein" as keyof DayStats, label: "Protein", color: "#f97316", unit: "g" },
        { key: "carbs" as keyof DayStats, label: "Carbs", color: "#3b82f6", unit: "g" },
        { key: "fat" as keyof DayStats, label: "Fat", color: "#a855f7", unit: "g" },
    ];

    return (
        <View style={ts.wrap}>
            <View style={ts.header}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <TrendingUp size={15} color="#22c55e" />
                    <Text style={ts.title}>Trends</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                    {([7, 14] as const).map((d) => (
                        <TouchableOpacity
                            key={d}
                            style={[ts.pill, days === d && ts.pillActive]}
                            onPress={() => setDays(d)}
                        >
                            <Text style={[ts.pillText, days === d && ts.pillTextActive]}>{d}d</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#22c55e" size="small" />
                </View>
            ) : (
                macros.map((m) => (
                    <View key={m.key} style={ts.chartBlock}>
                        <Text style={[ts.chartLabel, { color: m.color }]}>{m.label}</Text>
                        <SimpleLineChart
                            data={data}
                            valueKey={m.key}
                            color={m.color}
                            goalLine={m.key === "calories" ? goalCalories : undefined}
                        />
                    </View>
                ))
            )}
        </View>
    );
}

// ─── Main Screen ──────────────────────────────
export default function FoodLogging() {
    const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [meals, setMeals] = useState<MealItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMeal, setSelectedMeal] = useState("breakfast");
    const [modalVisible, setModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
    const [quantity, setQuantity] = useState("1");
    const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [dailyCalorieGoal, setDailyCalorieGoal] = useState(2000);

    useEffect(() => {
        const loadData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData.user;
            if (!user) return;
            setUserId(user.id);

            const { data: logs } = await supabase
                .from("food_logs")
                .select("id, food_name, calories, protein_g, carbs_g, fat_g, meal_id")
                .eq("user_id", user.id)
                .gte("logged_at", `${selectedDate}T00:00:00`)
                .lte("logged_at", `${selectedDate}T23:59:59`);

            const { data: mealsData } = await supabase
                .from("meals")
                .select("id, meal_type")
                .eq("user_id", user.id)
                .eq("date", selectedDate);

            if (logs && mealsData) {
                setMeals(
                    logs.map((log) => {
                        const meal = mealsData.find((m) => m.id === log.meal_id);
                        return {
                            id: log.id,
                            name: log.food_name,
                            calories: Number(log.calories),
                            protein: Number(log.protein_g),
                            carbs: Number(log.carbs_g),
                            fat: Number(log.fat_g),
                            meal: meal?.meal_type ?? "snack",
                        };
                    })
                );
            } else {
                setMeals([]);
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("daily_calories")
                .eq("id", user.id)
                .single();
            if (profile?.daily_calories) setDailyCalorieGoal(profile.daily_calories);
        };

        loadData();
    }, [selectedDate]);

    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${SUPABASE_FUNCTION_URL}?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                if (data.hints) {
                    setSearchResults(
                        data.hints.slice(0, 15).map((hint: any) => ({
                            foodId: hint.food.foodId,
                            label: hint.food.label,
                            calories: Math.round(hint.food.nutrients.ENERC_KCAL ?? 0),
                            protein: Math.round(hint.food.nutrients.PROCNT ?? 0),
                            carbs: Math.round(hint.food.nutrients.CHOCDF ?? 0),
                            fat: Math.round(hint.food.nutrients.FAT ?? 0),
                            fiber: Math.round(hint.food.nutrients.FIBTG ?? 0),
                        }))
                    );
                }
            } catch (err) { console.error(err); }
            finally { setSearching(false); }
        }, 500);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const shiftDate = (delta: number) => {
        const d = new Date(selectedDate + "T00:00:00");
        d.setDate(d.getDate() + delta);
        if (d <= new Date()) setSelectedDate(toDateStr(d));
    };

    const openFoodDetail = (food: FoodResult) => {
        setSelectedFood(food);
        setQuantity("1");
        setDetailModalVisible(true);
    };

    const getAdjusted = () => {
        if (!selectedFood) return null;
        const qty = parseFloat(quantity) || 1;
        return {
            ...selectedFood,
            calories: Math.round(selectedFood.calories * qty),
            protein: Math.round(selectedFood.protein * qty * 10) / 10,
            carbs: Math.round(selectedFood.carbs * qty * 10) / 10,
            fat: Math.round(selectedFood.fat * qty * 10) / 10,
            fiber: Math.round((selectedFood.fiber ?? 0) * qty * 10) / 10,
        };
    };

    const addFood = async () => {
        if (!userId || !selectedFood) return;
        setSaving(true);
        const adj = getAdjusted()!;
        try {
            let mealId: string;
            const { data: existing } = await supabase
                .from("meals").select("id")
                .eq("user_id", userId).eq("date", selectedDate).eq("meal_type", selectedMeal)
                .single();

            if (existing) {
                mealId = existing.id;
            } else {
                const { data: nm } = await supabase
                    .from("meals")
                    .insert({ user_id: userId, date: selectedDate, meal_type: selectedMeal })
                    .select().single();
                mealId = nm!.id;
            }

            await supabase.from("food_logs").insert({
                user_id: userId, meal_id: mealId,
                food_name: adj.label, calories: adj.calories,
                protein_g: adj.protein, carbs_g: adj.carbs, fat_g: adj.fat,
                quantity: parseFloat(quantity) || 1, unit: "serving",
                edamam_food_id: adj.foodId,
                // Log at noon on the selected date so date filtering works correctly
                logged_at: `${selectedDate}T12:00:00`,
            });

            await supabase.rpc("increment_daily_nutrition", {
                user_id_input: userId,
                calories_input: adj.calories, protein_input: adj.protein,
                carbs_input: adj.carbs, fat_input: adj.fat,
            });

            setMeals((prev) => [
                ...prev,
                {
                    id: Date.now().toString(), name: adj.label, calories: adj.calories,
                    protein: adj.protein, carbs: adj.carbs, fat: adj.fat, meal: selectedMeal
                },
            ]);
            setDetailModalVisible(false);
            setModalVisible(false);
            setSearchQuery("");
            setSearchResults([]);
            setSelectedFood(null);
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const totalProtein = meals.reduce((s, m) => s + m.protein, 0);
    const totalCarbs = meals.reduce((s, m) => s + m.carbs, 0);
    const totalFat = meals.reduce((s, m) => s + m.fat, 0);
    const remaining = dailyCalorieGoal - totalCalories;
    const adj = getAdjusted();
    const isToday = selectedDate === toDateStr(new Date());

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* ── Header ── */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Food Logging</Text>

                {/* Date navigator */}
                <View style={s.dateRow}>
                    <TouchableOpacity style={s.dateArrow} onPress={() => shiftDate(-1)}>
                        <ChevronLeft size={18} color="#888" />
                    </TouchableOpacity>

                    <TouchableOpacity style={s.datePill} onPress={() => setShowDatePicker(true)}>
                        <Calendar size={13} color="#22c55e" />
                        <Text style={s.datePillText}>{formatDisplayDate(selectedDate)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.dateArrow, isToday && { opacity: 0.3 }]}
                        onPress={() => shiftDate(1)}
                        disabled={isToday}
                    >
                        <ChevronRight size={18} color="#888" />
                    </TouchableOpacity>
                </View>

                {/* Calorie summary */}
                <View style={s.summaryCard}>
                    <View style={s.summaryTop}>
                        <View>
                            <Text style={s.totalCalories}>{totalCalories}</Text>
                            <Text style={s.totalCaloriesLabel}>
                                {remaining > 0 ? `${remaining} kcal remaining` : "Goal exceeded"}
                            </Text>
                        </View>
                        <TouchableOpacity style={s.addFoodBtn} onPress={() => setModalVisible(true)}>
                            <Plus size={16} color="#0a0a0a" />
                            <Text style={s.addFoodBtnText}>Add Food</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={s.macroRow}>
                        {[
                            { label: "Protein", value: totalProtein },
                            { label: "Carbs", value: totalCarbs },
                            { label: "Fat", value: totalFat },
                        ].map((m) => (
                            <View key={m.label} style={s.macroItem}>
                                <Text style={s.macroValue}>{m.value.toFixed(1)}g</Text>
                                <Text style={s.macroLabel}>{m.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* ── Body ── */}
            <ScrollView contentContainerStyle={s.body}>
                {mealTypes.map((mt) => {
                    const Icon = mt.icon;
                    const items = meals.filter((m) => m.meal === mt.id);
                    const kcal = items.reduce((sum, m) => sum + m.calories, 0);
                    return (
                        <View key={mt.id} style={s.mealSection}>
                            <View style={s.mealHeader}>
                                <View style={s.mealHeaderLeft}>
                                    <Icon size={20} color={mt.color} />
                                    <Text style={s.mealTitle}>{mt.name}</Text>
                                </View>
                                <Text style={s.mealCalories}>{kcal} kcal</Text>
                            </View>

                            {items.length > 0 ? items.map((item) => (
                                <View key={item.id} style={[s.mealCard, { backgroundColor: mt.tint, borderColor: mt.border, borderWidth: 1 }]}>
                                    <View style={[s.accentBar, { backgroundColor: mt.color }]} />
                                    <View style={s.mealCardLeft}>
                                        <Text style={s.mealName}>{item.name}</Text>
                                        <Text style={s.mealMacros}>P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g</Text>
                                    </View>
                                    <Text style={[s.mealKcal, { color: mt.color }]}>{item.calories}</Text>
                                </View>
                            )) : (
                                <View style={s.emptyCard}>
                                    <Text style={s.emptyText}>No items logged yet</Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* ── Trends ── */}
                <TrendsSection userId={userId} goalCalories={dailyCalorieGoal} />
            </ScrollView>

            {/* ── Native Date Picker ── */}
            {showDatePicker && (
                <DateTimePicker
                    value={new Date(selectedDate + "T00:00:00")}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) setSelectedDate(toDateStr(date));
                    }}
                />
            )}

            {/* ── Search Modal ── */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Add Food Item</Text>
                            <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(""); setSearchResults([]); }}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <Text style={s.modalLabel}>Meal Type</Text>
                        <View style={s.mealTypeGrid}>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[s.mealTypeBtn, selectedMeal === type.id && { backgroundColor: type.tint, borderColor: type.color }]}
                                    onPress={() => setSelectedMeal(type.id)}
                                >
                                    <Text style={[s.mealTypeBtnText, selectedMeal === type.id && { color: type.color, fontWeight: "700" }]}>
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.modalLabel}>Search Foods</Text>
                        <View style={s.searchContainer}>
                            <Search size={16} color="#888" />
                            <TextInput
                                placeholder="Search for foods..."
                                placeholderTextColor="#555"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={s.searchInput}
                                autoFocus
                            />
                            {searching && <ActivityIndicator size="small" color="#22c55e" />}
                        </View>

                        {searchQuery.length < 2 ? (
                            <View style={s.searchHint}><Text style={s.searchHintText}>Type at least 2 characters</Text></View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item, i) => `${item.foodId}-${i}`}
                                style={s.foodList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={s.foodItem} onPress={() => openFoodDetail(item)}>
                                        <View style={s.foodItemLeft}>
                                            <Text style={s.foodName}>{item.label}</Text>
                                            <Text style={s.foodMacros}>{item.calories} kcal • P:{item.protein}g C:{item.carbs}g F:{item.fat}g</Text>
                                        </View>
                                        <Plus size={18} color="#22c55e" />
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={s.separator} />}
                                ListEmptyComponent={!searching ? <Text style={s.searchHintText}>No results</Text> : null}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Detail Modal ── */}
            <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                            <Text style={s.modalTitle}>{selectedFood?.label}</Text>
                            <View style={{ width: 22 }} />
                        </View>

                        <View style={s.calorieHighlight}>
                            <Text style={s.calorieHighlightNumber}>{adj?.calories}</Text>
                            <Text style={s.calorieHighlightLabel}>kcal per serving</Text>
                        </View>

                        <View style={s.nutritionGrid}>
                            {[
                                { label: "Protein", value: adj?.protein, color: "#f97316" },
                                { label: "Carbs", value: adj?.carbs, color: "#3b82f6" },
                                { label: "Fat", value: adj?.fat, color: "#a855f7" },
                                { label: "Fiber", value: adj?.fiber, color: "#22c55e" },
                            ].map((n) => (
                                <View key={n.label} style={s.nutritionCard}>
                                    <Text style={[s.nutritionValue, { color: n.color }]}>{n.value}g</Text>
                                    <Text style={s.nutritionLabel}>{n.label}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={s.quantitySection}>
                            <Text style={s.modalLabel}>Servings</Text>
                            <View style={s.quantityRow}>
                                <TouchableOpacity style={s.quantityBtn} onPress={() => setQuantity((p) => Math.max(0.5, (parseFloat(p) || 1) - 0.5).toString())}>
                                    <Text style={s.quantityBtnText}>−</Text>
                                </TouchableOpacity>
                                <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={s.quantityInput} selectTextOnFocus />
                                <TouchableOpacity style={s.quantityBtn} onPress={() => setQuantity((p) => ((parseFloat(p) || 1) + 0.5).toString())}>
                                    <Text style={s.quantityBtnText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={s.modalLabel}>Add to</Text>
                        <View style={s.mealTypeGrid}>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[s.mealTypeBtn, selectedMeal === type.id && { backgroundColor: type.tint, borderColor: type.color }]}
                                    onPress={() => setSelectedMeal(type.id)}
                                >
                                    <Text style={[s.mealTypeBtnText, selectedMeal === type.id && { color: type.color, fontWeight: "700" }]}>
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={[s.logBtn, saving && { opacity: 0.6 }]} onPress={addFood} disabled={saving}>
                            {saving
                                ? <ActivityIndicator size="small" color="#0a0a0a" />
                                : <Text style={s.logBtnText}>Log {adj?.calories} kcal to {mealTypes.find((m) => m.id === selectedMeal)?.name}</Text>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Trend Styles ─────────────────────────────
const ts = StyleSheet.create({
    wrap: {
        backgroundColor: "#111", borderRadius: 20, padding: 16,
        marginTop: 8, borderWidth: 1, borderColor: "#2a2a2a",
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    title: { color: "#fff", fontSize: 14, fontWeight: "700" },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#333" },
    pillActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    pillText: { color: "#555", fontSize: 12, fontWeight: "600" },
    pillTextActive: { color: "#22c55e" },
    chartBlock: { marginBottom: 20 },
    chartLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
});

// ─── Main Styles ──────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    header: { backgroundColor: "#1a1a1a", padding: 16, paddingTop: 52, elevation: 6, gap: 12 },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
    dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
    dateArrow: { padding: 6, borderRadius: 8, backgroundColor: "#2a2a2a" },
    datePill: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "#2a2a2a", paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: "#3a3a3a", flex: 1, justifyContent: "center",
    },
    datePillText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    summaryCard: { backgroundColor: "#1a3329", borderRadius: 16, padding: 16, gap: 12 },
    summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    totalCalories: { color: "#fff", fontSize: 28, fontWeight: "700" },
    totalCaloriesLabel: { color: "#888", fontSize: 12, marginTop: 2 },
    addFoodBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#22c55e", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 6 },
    addFoodBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "700" },
    macroRow: { flexDirection: "row", justifyContent: "space-around", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#26d173" },
    macroItem: { alignItems: "center", gap: 2 },
    macroValue: { color: "#fff", fontSize: 15, fontWeight: "600" },
    macroLabel: { color: "#888", fontSize: 11 },
    body: { padding: 16, gap: 24, paddingBottom: 100 },
    mealSection: { gap: 8 },
    mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    mealHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    mealTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
    mealCalories: { color: "#888", fontSize: 13 },
    mealCard: { borderRadius: 14, padding: 14, paddingLeft: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", overflow: "hidden", position: "relative" },
    accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
    mealCardLeft: { flex: 1, marginRight: 12 },
    mealName: { color: "#fff", fontSize: 14, fontWeight: "500", marginBottom: 4 },
    mealMacros: { color: "#aaa", fontSize: 12 },
    mealKcal: { fontSize: 15, fontWeight: "600" },
    emptyCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 20, alignItems: "center" },
    emptyText: { color: "#555", fontSize: 13 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
    modalLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 10 },
    mealTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    mealTypeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#2a2a2a" },
    mealTypeBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, gap: 8 },
    searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 12 },
    foodList: { maxHeight: 280 },
    foodItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    foodItemLeft: { flex: 1, marginRight: 12 },
    foodName: { color: "#fff", fontSize: 14, fontWeight: "500", marginBottom: 3 },
    foodMacros: { color: "#888", fontSize: 12 },
    separator: { height: 1, backgroundColor: "#2a2a2a" },
    searchHint: { padding: 20, alignItems: "center" },
    searchHintText: { color: "#555", fontSize: 13 },
    calorieHighlight: { alignItems: "center", backgroundColor: "#1a3329", borderRadius: 16, padding: 20, marginBottom: 20 },
    calorieHighlightNumber: { color: "#22c55e", fontSize: 48, fontWeight: "700" },
    calorieHighlightLabel: { color: "#888", fontSize: 13, marginTop: 4 },
    nutritionGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
    nutritionCard: { flex: 1, backgroundColor: "#2a2a2a", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 },
    nutritionValue: { fontSize: 16, fontWeight: "700" },
    nutritionLabel: { color: "#888", fontSize: 11 },
    quantitySection: { marginBottom: 20 },
    quantityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    quantityBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3a3a3a" },
    quantityBtnText: { color: "#fff", fontSize: 20, fontWeight: "600" },
    quantityInput: { flex: 1, backgroundColor: "#2a2a2a", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center", borderWidth: 1, borderColor: "#3a3a3a" },
    logBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
    logBtnText: { color: "#0a0a0a", fontSize: 15, fontWeight: "700" },
});