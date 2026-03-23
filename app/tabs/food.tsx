import { StatusBar } from "expo-status-bar";
import {
    Apple,
    Coffee,
    Moon,
    Plus,
    Search,
    Sun,
    X
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

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

const SUPABASE_FUNCTION_URL = "https://xnnuufpjmicavrmimjnh.supabase.co/functions/v1/edamam-search";

const mealTypes = [
    { id: "breakfast", name: "Breakfast", icon: Coffee, color: "#eab308", tint: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.22)" },
    { id: "lunch", name: "Lunch", icon: Sun, color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)" },
    { id: "dinner", name: "Dinner", icon: Moon, color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)" },
    { id: "snack", name: "Snacks", icon: Apple, color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)" },
];

export default function FoodLogging() {
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

            const today = new Date().toISOString().split("T")[0];

            const { data: logs } = await supabase
                .from("food_logs")
                .select("id, food_name, calories, protein_g, carbs_g, fat_g, meal_id")
                .eq("user_id", user.id)
                .gte("logged_at", `${today}T00:00:00`)
                .lte("logged_at", `${today}T23:59:59`);

            const { data: mealsData } = await supabase
                .from("meals")
                .select("id, meal_type")
                .eq("user_id", user.id)
                .eq("date", today);

            if (logs && mealsData) {
                const formatted: MealItem[] = logs.map((log) => {
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
                });
                setMeals(formatted);
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("daily_calories")
                .eq("id", user.id)
                .single();

            if (profile?.daily_calories) {
                setDailyCalorieGoal(profile.daily_calories);
            }
        };

        loadData();
    }, []);

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timeout = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${SUPABASE_FUNCTION_URL}?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();

                if (data.hints) {
                    const results: FoodResult[] = data.hints
                        .slice(0, 15)
                        .map((hint: any) => ({
                            foodId: hint.food.foodId,
                            label: hint.food.label,
                            calories: Math.round(hint.food.nutrients.ENERC_KCAL ?? 0),
                            protein: Math.round(hint.food.nutrients.PROCNT ?? 0),
                            carbs: Math.round(hint.food.nutrients.CHOCDF ?? 0),
                            fat: Math.round(hint.food.nutrients.FAT ?? 0),
                            fiber: Math.round(hint.food.nutrients.FIBTG ?? 0),
                        }));
                    setSearchResults(results);
                }
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const openFoodDetail = (food: FoodResult) => {
        setSelectedFood(food);
        setQuantity("1");
        setDetailModalVisible(true);
    };

    const getAdjustedNutrition = () => {
        if (!selectedFood) return selectedFood;
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

        const adjusted = getAdjustedNutrition()!;
        const today = new Date().toISOString().split("T")[0];

        try {
            let mealId: string;

            const { data: existingMeal } = await supabase
                .from("meals")
                .select("id")
                .eq("user_id", userId)
                .eq("date", today)
                .eq("meal_type", selectedMeal)
                .single();

            if (existingMeal) {
                mealId = existingMeal.id;
            } else {
                const { data: newMeal } = await supabase
                    .from("meals")
                    .insert({ user_id: userId, date: today, meal_type: selectedMeal })
                    .select()
                    .single();
                mealId = newMeal!.id;
            }

            await supabase.from("food_logs").insert({
                user_id: userId,
                meal_id: mealId,
                food_name: adjusted.label,
                calories: adjusted.calories,
                protein_g: adjusted.protein,
                carbs_g: adjusted.carbs,
                fat_g: adjusted.fat,
                quantity: parseFloat(quantity) || 1,
                unit: "serving",
                edamam_food_id: adjusted.foodId,
            });

            await supabase.rpc("increment_daily_nutrition", {
                user_id_input: userId,
                calories_input: adjusted.calories,
                protein_input: adjusted.protein,
                carbs_input: adjusted.carbs,
                fat_input: adjusted.fat,
            });

            setMeals((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    name: adjusted.label,
                    calories: adjusted.calories,
                    protein: adjusted.protein,
                    carbs: adjusted.carbs,
                    fat: adjusted.fat,
                    meal: selectedMeal,
                },
            ]);

            setDetailModalVisible(false);
            setModalVisible(false);
            setSearchQuery("");
            setSearchResults([]);
            setSelectedFood(null);
        } catch (err) {
            console.error("Error saving food:", err);
        } finally {
            setSaving(false);
        }
    };

    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
    const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
    const totalFat = meals.reduce((sum, m) => sum + m.fat, 0);
    const caloriesRemaining = dailyCalorieGoal - totalCalories;
    const adjusted = getAdjustedNutrition();

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Food Logging</Text>
                        <Text style={styles.headerSub}>Track your daily intake</Text>
                    </View>
                </View>

                <View style={styles.summaryCard}>
                    <View style={styles.summaryTop}>
                        <View>
                            <Text style={styles.totalCalories}>{totalCalories}</Text>
                            <Text style={styles.totalCaloriesLabel}>
                                {caloriesRemaining > 0
                                    ? `${caloriesRemaining} kcal remaining`
                                    : "Goal exceeded"}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addFoodBtn}
                            onPress={() => setModalVisible(true)}
                        >
                            <Plus size={16} color="#0a0a0a" />
                            <Text style={styles.addFoodBtnText}>Add Food</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.macroRow}>
                        {[
                            { label: "Protein", value: totalProtein },
                            { label: "Carbs", value: totalCarbs },
                            { label: "Fat", value: totalFat },
                        ].map((m) => (
                            <View key={m.label} style={styles.macroItem}>
                                <Text style={styles.macroValue}>{m.value.toFixed(1)}g</Text>
                                <Text style={styles.macroLabel}>{m.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* Meals List */}
            <ScrollView contentContainerStyle={styles.body}>
                {mealTypes.map((mealType) => {
                    const Icon = mealType.icon;
                    const mealItems = meals.filter((m) => m.meal === mealType.id);
                    const mealCalories = mealItems.reduce((sum, m) => sum + m.calories, 0);

                    return (
                        <View key={mealType.id} style={styles.mealSection}>
                            <View style={styles.mealHeader}>
                                <View style={styles.mealHeaderLeft}>
                                    <Icon size={20} color={mealType.color} />
                                    <Text style={styles.mealTitle}>{mealType.name}</Text>
                                </View>
                                <Text style={styles.mealCalories}>{mealCalories} kcal</Text>
                            </View>

                            {mealItems.length > 0 ? (
                                mealItems.map((item) => (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.mealCard,
                                            { backgroundColor: mealType.tint, borderColor: mealType.border, borderWidth: 1 },
                                        ]}
                                    >
                                        <View style={[styles.accentBar, { backgroundColor: mealType.color }]} />
                                        <View style={styles.mealCardLeft}>
                                            <Text style={styles.mealName}>{item.name}</Text>
                                            <Text style={styles.mealMacros}>
                                                P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                                            </Text>
                                        </View>
                                        <Text style={[styles.mealKcal, { color: mealType.color }]}>
                                            {item.calories}
                                        </Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyCard}>
                                    <Text style={styles.emptyText}>No items logged yet</Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Search Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Food Item</Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setSearchQuery("");
                                setSearchResults([]);
                            }}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>Meal Type</Text>
                        <View style={styles.mealTypeGrid}>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.mealTypeBtn,
                                        selectedMeal === type.id && {
                                            backgroundColor: type.tint,
                                            borderColor: type.color,
                                        },
                                    ]}
                                    onPress={() => setSelectedMeal(type.id)}
                                >
                                    <Text
                                        style={[
                                            styles.mealTypeBtnText,
                                            selectedMeal === type.id && { color: type.color, fontWeight: "700" },
                                        ]}
                                    >
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalLabel}>Search Foods</Text>
                        <View style={styles.searchContainer}>
                            <Search size={16} color="#888" />
                            <TextInput
                                placeholder="Search for foods..."
                                placeholderTextColor="#555"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={styles.searchInput}
                                autoFocus
                            />
                            {searching && <ActivityIndicator size="small" color="#22c55e" />}
                        </View>

                        {searchQuery.length < 2 ? (
                            <View style={styles.searchHint}>
                                <Text style={styles.searchHintText}>Type at least 2 characters to search</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item, index) => `${item.foodId}-${index}`}
                                style={styles.foodList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.foodItem}
                                        onPress={() => openFoodDetail(item)}
                                    >
                                        <View style={styles.foodItemLeft}>
                                            <Text style={styles.foodName}>{item.label}</Text>
                                            <Text style={styles.foodMacros}>
                                                {item.calories} kcal • P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                                            </Text>
                                        </View>
                                        <Plus size={18} color="#22c55e" />
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                                ListEmptyComponent={
                                    !searching ? (
                                        <Text style={styles.searchHintText}>No results found</Text>
                                    ) : null
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Food Detail Modal */}
            <Modal
                visible={detailModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{selectedFood?.label}</Text>
                            <View style={{ width: 22 }} />
                        </View>

                        {/* Calorie highlight */}
                        <View style={styles.calorieHighlight}>
                            <Text style={styles.calorieHighlightNumber}>{adjusted?.calories}</Text>
                            <Text style={styles.calorieHighlightLabel}>kcal per serving</Text>
                        </View>

                        {/* Nutrition breakdown */}
                        <View style={styles.nutritionGrid}>
                            {[
                                { label: "Protein", value: adjusted?.protein, unit: "g", color: "#f97316" },
                                { label: "Carbs", value: adjusted?.carbs, unit: "g", color: "#3b82f6" },
                                { label: "Fat", value: adjusted?.fat, unit: "g", color: "#a855f7" },
                                { label: "Fiber", value: adjusted?.fiber, unit: "g", color: "#22c55e" },
                            ].map((n) => (
                                <View key={n.label} style={styles.nutritionCard}>
                                    <Text style={[styles.nutritionValue, { color: n.color }]}>
                                        {n.value}{n.unit}
                                    </Text>
                                    <Text style={styles.nutritionLabel}>{n.label}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Quantity adjuster */}
                        <View style={styles.quantitySection}>
                            <Text style={styles.modalLabel}>Servings</Text>
                            <View style={styles.quantityRow}>
                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => setQuantity((prev) => {
                                        const val = Math.max(0.5, (parseFloat(prev) || 1) - 0.5);
                                        return val.toString();
                                    })}
                                >
                                    <Text style={styles.quantityBtnText}>−</Text>
                                </TouchableOpacity>

                                <TextInput
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    keyboardType="decimal-pad"
                                    style={styles.quantityInput}
                                    selectTextOnFocus
                                />

                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => setQuantity((prev) => {
                                        const val = (parseFloat(prev) || 1) + 0.5;
                                        return val.toString();
                                    })}
                                >
                                    <Text style={styles.quantityBtnText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Meal type selector */}
                        <Text style={styles.modalLabel}>Add to</Text>
                        <View style={styles.mealTypeGrid}>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.mealTypeBtn,
                                        selectedMeal === type.id && {
                                            backgroundColor: type.tint,
                                            borderColor: type.color,
                                        },
                                    ]}
                                    onPress={() => setSelectedMeal(type.id)}
                                >
                                    <Text
                                        style={[
                                            styles.mealTypeBtnText,
                                            selectedMeal === type.id && { color: type.color, fontWeight: "700" },
                                        ]}
                                    >
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Log button */}
                        <TouchableOpacity
                            style={[styles.logBtn, saving && { opacity: 0.6 }]}
                            onPress={addFood}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#0a0a0a" />
                            ) : (
                                <Text style={styles.logBtnText}>
                                    Log {adjusted?.calories} kcal to {mealTypes.find(m => m.id === selectedMeal)?.name}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
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
    headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
    headerSub: { color: "#888", fontSize: 12, marginTop: 2 },
    summaryCard: { backgroundColor: "#1a3329", borderRadius: 16, padding: 16, gap: 12 },
    summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    totalCalories: { color: "#fff", fontSize: 28, fontWeight: "700" },
    totalCaloriesLabel: { color: "#888", fontSize: 12, marginTop: 2 },
    addFoodBtn: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#22c55e",
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 6,
    },
    addFoodBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "700" },
    macroRow: {
        flexDirection: "row", justifyContent: "space-around",
        paddingTop: 12, borderTopWidth: 1, borderTopColor: "#26d173",
    },
    macroItem: { alignItems: "center", gap: 2 },
    macroValue: { color: "#fff", fontSize: 15, fontWeight: "600" },
    macroLabel: { color: "#888", fontSize: 11 },
    body: { padding: 16, gap: 24, paddingBottom: 100 },
    mealSection: { gap: 8 },
    mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    mealHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    mealTitle: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
    mealCalories: { color: "#888", fontSize: 13 },
    mealCard: {
        borderRadius: 14, padding: 14, paddingLeft: 18,
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", overflow: "hidden", position: "relative",
    },
    accentBar: {
        position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
    },
    mealCardLeft: { flex: 1, marginRight: 12 },
    mealName: { color: "#fff", fontSize: 14, fontWeight: "500", marginBottom: 4 },
    mealMacros: { color: "#aaa", fontSize: 12 },
    mealKcal: { fontSize: 15, fontWeight: "600" },
    emptyCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 20, alignItems: "center" },
    emptyText: { color: "#555", fontSize: 13 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: "#1a1a1a", borderTopLeftRadius: 28,
        borderTopRightRadius: 28, padding: 24, maxHeight: "90%",
    },
    modalHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 20,
    },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
    modalLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 10 },
    mealTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    mealTypeBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
        borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#2a2a2a",
    },
    mealTypeBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    searchContainer: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#2a2a2a",
        borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, gap: 8,
    },
    searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 12 },
    foodList: { maxHeight: 280 },
    foodItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    foodItemLeft: { flex: 1, marginRight: 12 },
    foodName: { color: "#fff", fontSize: 14, fontWeight: "500", marginBottom: 3 },
    foodMacros: { color: "#888", fontSize: 12 },
    separator: { height: 1, backgroundColor: "#2a2a2a" },
    searchHint: { padding: 20, alignItems: "center" },
    searchHintText: { color: "#555", fontSize: 13 },

    // Detail modal
    calorieHighlight: {
        alignItems: "center", backgroundColor: "#1a3329",
        borderRadius: 16, padding: 20, marginBottom: 20,
    },
    calorieHighlightNumber: { color: "#22c55e", fontSize: 48, fontWeight: "700" },
    calorieHighlightLabel: { color: "#888", fontSize: 13, marginTop: 4 },
    nutritionGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
    nutritionCard: {
        flex: 1, backgroundColor: "#2a2a2a", borderRadius: 12,
        padding: 12, alignItems: "center", gap: 4,
    },
    nutritionValue: { fontSize: 16, fontWeight: "700" },
    nutritionLabel: { color: "#888", fontSize: 11 },
    quantitySection: { marginBottom: 20 },
    quantityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    quantityBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#3a3a3a",
    },
    quantityBtnText: { color: "#fff", fontSize: 20, fontWeight: "600" },
    quantityInput: {
        flex: 1, backgroundColor: "#2a2a2a", borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 16, color: "#fff",
        fontSize: 18, fontWeight: "600", textAlign: "center",
        borderWidth: 1, borderColor: "#3a3a3a",
    },
    logBtn: {
        backgroundColor: "#22c55e", borderRadius: 14,
        paddingVertical: 16, alignItems: "center", marginTop: 8,
    },
    logBtnText: { color: "#0a0a0a", fontSize: 15, fontWeight: "700" },
});