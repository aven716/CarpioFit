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
import { useState } from "react";
import {
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface MealItem {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meal: string;
}

const mockFoodDatabase = [
    { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: "Brown Rice", calories: 216, protein: 5, carbs: 45, fat: 1.8 },
    { name: "Avocado", calories: 234, protein: 3, carbs: 12, fat: 21 },
    { name: "Greek Yogurt", calories: 100, protein: 17, carbs: 6, fat: 0.7 },
    { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    { name: "Oatmeal", calories: 158, protein: 6, carbs: 28, fat: 3.2 },
    { name: "Salmon", calories: 206, protein: 22, carbs: 0, fat: 13 },
    { name: "Sweet Potato", calories: 112, protein: 2, carbs: 26, fat: 0.1 },
];

const mealTypes = [
    { id: "breakfast", name: "Breakfast", icon: Coffee, color: "#eab308", tint: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.22)" },
    { id: "lunch", name: "Lunch", icon: Sun, color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)" },
    { id: "dinner", name: "Dinner", icon: Moon, color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)" },
    { id: "snack", name: "Snacks", icon: Apple, color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)" },
];

export default function FoodLogging() {
    const [meals, setMeals] = useState<MealItem[]>([
        { id: "1", name: "Oatmeal with Berries", calories: 320, protein: 12, carbs: 54, fat: 8, meal: "breakfast" },
        { id: "2", name: "Grilled Chicken Salad", calories: 420, protein: 38, carbs: 24, fat: 18, meal: "lunch" },
        { id: "3", name: "Protein Shake", calories: 180, protein: 24, carbs: 12, fat: 3, meal: "snack" },
    ]);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMeal, setSelectedMeal] = useState("breakfast");
    const [modalVisible, setModalVisible] = useState(false);

    const filteredFoods = mockFoodDatabase.filter((food) =>
        food.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const addFood = (food: (typeof mockFoodDatabase)[0]) => {
        const newMeal: MealItem = {
            id: Date.now().toString(),
            name: food.name,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            meal: selectedMeal,
        };
        setMeals([...meals, newMeal]);
        setModalVisible(false);
        setSearchQuery("");
    };

    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
    const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
    const totalFat = meals.reduce((sum, m) => sum + m.fat, 0);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Sticky Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Food Logging</Text>
                        <Text style={styles.headerSub}>Track your daily intake</Text>
                    </View>
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryTop}>
                        <View>
                            <Text style={styles.totalCalories}>{totalCalories}</Text>
                            <Text style={styles.totalCaloriesLabel}>Total Calories</Text>
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
                                            {
                                                backgroundColor: mealType.tint,
                                                borderColor: mealType.border,
                                                borderWidth: 1,
                                            },
                                        ]}
                                    >
                                        {/* Accent left bar */}
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

            {/* Add Food Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Food Item</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                        </View>

                        {/* Meal Type Selector */}
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
                                            selectedMeal === type.id && {
                                                color: type.color,
                                                fontWeight: "700",
                                            },
                                        ]}
                                    >
                                        {type.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Search */}
                        <Text style={styles.modalLabel}>Search Foods</Text>
                        <View style={styles.searchContainer}>
                            <Search size={16} color="#888" style={styles.searchIcon} />
                            <TextInput
                                placeholder="Search for foods..."
                                placeholderTextColor="#555"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={styles.searchInput}
                            />
                        </View>

                        {/* Food Results */}
                        <FlatList
                            data={filteredFoods}
                            keyExtractor={(item) => item.name}
                            style={styles.foodList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.foodItem}
                                    onPress={() => addFood(item)}
                                >
                                    <View style={styles.foodItemLeft}>
                                        <Text style={styles.foodName}>{item.name}</Text>
                                        <Text style={styles.foodMacros}>
                                            {item.calories} kcal • P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                                        </Text>
                                    </View>
                                    <Plus size={18} color="#22c55e" />
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },

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
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#2a2a2a",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    headerSub: {
        color: "#888",
        fontSize: 12,
        marginTop: 2,
    },

    // Summary card
    summaryCard: {
        backgroundColor: "#1a3329",
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    summaryTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    totalCalories: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "700",
    },
    totalCaloriesLabel: {
        color: "#888",
        fontSize: 12,
        marginTop: 2,
    },
    addFoodBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#22c55e",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        gap: 6,
    },
    addFoodBtnText: {
        color: "#0a0a0a",
        fontSize: 13,
        fontWeight: "700",
    },
    macroRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#26d173",
    },
    macroItem: {
        alignItems: "center",
        gap: 2,
    },
    macroValue: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    macroLabel: {
        color: "#888",
        fontSize: 11,
    },

    // Body
    body: {
        padding: 16,
        gap: 24,
        paddingBottom: 100,
    },
    mealSection: {
        gap: 8,
    },
    mealHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    mealHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    mealTitle: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
    mealCalories: {
        color: "#888",
        fontSize: 13,
    },
    mealCard: {
        borderRadius: 14,
        padding: 14,
        paddingLeft: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
    },
    accentBar: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 14,
        borderBottomLeftRadius: 14,
    },
    mealCardLeft: {
        flex: 1,
        marginRight: 12,
    },
    mealName: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 4,
    },
    mealMacros: {
        color: "#aaa",
        fontSize: 12,
    },
    mealKcal: {
        fontSize: 15,
        fontWeight: "600",
    },
    emptyCard: {
        backgroundColor: "#1a1a1a",
        borderRadius: 14,
        padding: 20,
        alignItems: "center",
    },
    emptyText: {
        color: "#555",
        fontSize: 13,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        maxHeight: "85%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    modalLabel: {
        color: "#888",
        fontSize: 13,
        fontWeight: "500",
        marginBottom: 10,
    },
    mealTypeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
    },
    mealTypeBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#3a3a3a",
        backgroundColor: "#2a2a2a",
    },
    mealTypeBtnText: {
        color: "#888",
        fontSize: 13,
        fontWeight: "500",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        gap: 8,
    },
    searchIcon: {
        marginRight: 4,
    },
    searchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 14,
        paddingVertical: 12,
    },
    foodList: {
        maxHeight: 280,
    },
    foodItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    foodItemLeft: {
        flex: 1,
        marginRight: 12,
    },
    foodName: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 3,
    },
    foodMacros: {
        color: "#888",
        fontSize: 12,
    },
    separator: {
        height: 1,
        backgroundColor: "#2a2a2a",
    },
});