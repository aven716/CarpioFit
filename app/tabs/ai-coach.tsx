import { StatusBar } from "expo-status-bar";
import { Bot, Send, Settings, Sparkles, User, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { supabase } from "../../lib/supabase";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.1-8b-instant";

const DEFAULT_SYSTEM_PROMPT = `You are Bernard, CarpioFit's personal AI fitness and nutrition coach — named after the legendary Bernardo Carpio.
You are strong, motivating, and knowledgeable. Help users with workout plans, meal planning, nutrition advice, and fitness motivation.
Keep responses concise, practical, and encouraging. Use emojis sparingly.
Always prioritize safety — remind users to consult a doctor for medical concerns.

IMPORTANT: If the user asks to update, change, modify, regenerate, or adjust their workout plan or meal plan, 
you MUST respond with a JSON action block at the very start of your message in this exact format:
{"action":"update_workout_plan","instruction":"<what the user wants changed>"}
or
{"action":"update_meal_plan","instruction":"<what the user wants changed>"}
Then continue with a normal conversational response after the JSON block.`;

const PROMPT_PRESETS = [
    { label: "🏋️ Fitness Coach", prompt: `You are Bernard, CarpioFit's AI fitness coach named after Bernardo Carpio. Help users with workout plans, meal planning, and fitness motivation. Keep responses concise and encouraging.` },
    { label: "🥗 Nutrition Expert", prompt: `You are Bernard, CarpioFit's AI nutritionist. Focus on meal planning, macros, calorie tracking, and healthy eating habits. Give specific, science-backed advice.` },
    { label: "🧘 Wellness Coach", prompt: `You are Bernard, CarpioFit's wellness coach. Focus on mental health, stress management, sleep, recovery, and work-life balance alongside fitness. Be calm and empathetic.` },
    { label: "💪 Bodybuilding Coach", prompt: `You are Bernard, CarpioFit's bodybuilding coach. Focus on muscle gain, progressive overload, protein intake, and hypertrophy training. Be direct and data-driven.` },
];

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface UserProfile {
    age: number;
    gender: string;
    weight_kg: number;
    height_cm: number;
    goal: string;
    activity_level: string;
    daily_calories: number;
    daily_protein: number;
    daily_fat: number;
    daily_carbs: number;
}

const QUICK_PROMPTS = [
    "Update my workout plan — make it harder",
    "Suggest a healthy breakfast",
    "I'm too sore, lighten my plan",
    "Add more cardio to my plan",
];

function TypingDots() {
    const [dot, setDot] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setDot((d) => (d + 1) % 4), 400);
        return () => clearInterval(interval);
    }, []);
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {[0, 1, 2].map((i) => (
                <View key={i} style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: dot > i ? "#13a549c8" : "#444",
                }} />
            ))}
        </View>
    );
}

const NAV_HEIGHT = 64;

// ─── Plan Generator ───────────────────────────
async function generateWorkoutPlan(profile: UserProfile, instruction?: string): Promise<any> {
    const base = `
User profile:
- Age: ${profile.age}, Gender: ${profile.gender}
- Weight: ${profile.weight_kg}kg, Height: ${profile.height_cm}cm
- Fitness goal: ${profile.goal}
- Activity level: ${profile.activity_level}
- Daily calories: ${profile.daily_calories} kcal

${instruction ? `User's specific request: "${instruction}"` : "Generate a balanced weekly workout plan."}

Respond ONLY with valid JSON. No explanation, no markdown, no extra text before or after.
The JSON must follow this exact structure:
{
  "weekPlan": [
    {
      "day": "Monday",
      "isRest": false,
      "focus": "Chest & Triceps",
      "exercises": [
        { "name": "Push-ups", "sets": 3, "reps": "12-15", "duration": null },
        { "name": "Running", "sets": 1, "reps": null, "duration": "20 min" }
      ]
    },
    {
      "day": "Sunday",
      "isRest": true,
      "focus": "Rest & Recovery",
      "exercises": []
    }
  ]
}
All 7 days (Monday through Sunday) must be included.
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: "You are a fitness plan generator. Respond ONLY with valid JSON. No markdown, no explanation, no extra text." },
                { role: "user", content: base },
            ],
            max_tokens: 1500,
            temperature: 0.7,
        }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);

    const raw = data.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
}

async function saveWorkoutPlan(userId: string, plan: any) {
    const { error } = await supabase
        .from("workout_plans")
        .upsert({ user_id: userId, plan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
}

// ─── Main Component ───────────────────────────
export default function AICoach() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hey! I'm Bernard, your CarpioFit AI coach 💪 I can help you with workouts, nutrition, and recovery. I can also update your workout plan anytime — just ask! How can I help you today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [showPromptPanel, setShowPromptPanel] = useState(false);
    const [customPromptDraft, setCustomPromptDraft] = useState(DEFAULT_SYSTEM_PROMPT);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const loadProfile = async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;
            setUserId(auth.user.id);

            const { data } = await supabase
                .from("profiles")
                .select("age, gender, weight_kg, height_cm, goal, activity_level, daily_calories, daily_protein, daily_fat, daily_carbs")
                .eq("id", auth.user.id)
                .single();

            if (data) setUserProfile(data as UserProfile);
        };
        loadProfile();
    }, []);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, [messages, isTyping]);

    const applyPrompt = (prompt: string) => {
        setSystemPrompt(prompt);
        setCustomPromptDraft(prompt);
        setShowPromptPanel(false);
        setMessages([{
            id: Date.now().toString(),
            role: "assistant",
            content: "I've updated my coaching style! How can I help you today?",
            timestamp: new Date(),
        }]);
    };

    // ─── Detect & handle plan actions ────────────
    const handlePlanAction = async (action: string, instruction: string) => {
        if (!userProfile || !userId) return false;

        if (action === "update_workout_plan") {
            setIsUpdatingPlan(true);
            try {
                const plan = await generateWorkoutPlan(userProfile, instruction);
                await saveWorkoutPlan(userId, plan);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        role: "assistant",
                        content: "✅ Your workout plan has been updated! Head to the Calendar tab to see your new personalized weekly plan.",
                        timestamp: new Date(),
                    },
                ]);
            } catch (err: any) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        role: "assistant",
                        content: "Sorry, I had trouble updating your plan. Please try again!",
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setIsUpdatingPlan(false);
            }
            return true;
        }

        return false;
    };

    const sendMessage = async (content?: string) => {
        const text = (content ?? input).trim();
        if (!text || isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date(),
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");
        setIsTyping(true);

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
                    ],
                    max_tokens: 512,
                    temperature: 0.7,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);

            const rawContent: string = data.choices[0].message.content;

            // ─── Check for action JSON at start of response ───
            const actionMatch = rawContent.match(/^\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})/);
            if (actionMatch) {
                try {
                    const actionData = JSON.parse(actionMatch[1]);
                    const conversationalPart = rawContent.replace(actionMatch[1], "").trim();

                    // Show conversational part first
                    if (conversationalPart) {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: (Date.now() + 1).toString(),
                                role: "assistant",
                                content: conversationalPart,
                                timestamp: new Date(),
                            },
                        ]);
                    }

                    // Then handle the action
                    setIsTyping(false);
                    await handlePlanAction(actionData.action, actionData.instruction);
                    return;
                } catch {
                    // JSON parse failed, treat as normal message
                }
            }

            // Normal message
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: rawContent,
                    timestamp: new Date(),
                },
            ]);
        } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Unknown error");
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: `Error: ${err?.message ?? "Unknown"}`,
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const formatTime = (d: Date) =>
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={styles.botAvatar}>
                        <Bot size={24} color="#22c55e" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Bernard</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>
                                {isUpdatingPlan ? "Updating your plan..." : "Online"}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.headerBtn, showPromptPanel && styles.headerBtnActive]}
                        onPress={() => setShowPromptPanel((v) => !v)}
                    >
                        <Settings size={18} color={showPromptPanel ? "#22c55e" : "#888"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => setMessages([{
                            id: "1", role: "assistant",
                            content: "Hey! I'm Bernard, your CarpioFit AI coach 💪 How can I help you today?",
                            timestamp: new Date(),
                        }])}
                    >
                        <X size={18} color="#888" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Updating Plan Banner ── */}
            {isUpdatingPlan && (
                <View style={styles.updatingBanner}>
                    <Text style={styles.updatingBannerText}>⚡ Bernard is updating your workout plan...</Text>
                </View>
            )}

            {/* ── Prompt Panel ── */}
            {showPromptPanel && (
                <View style={styles.promptPanel}>
                    <Text style={styles.promptPanelTitle}>Coach Persona</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {PROMPT_PRESETS.map((preset) => (
                                <TouchableOpacity
                                    key={preset.label}
                                    style={[styles.presetChip, systemPrompt === preset.prompt && styles.presetChipActive]}
                                    onPress={() => applyPrompt(preset.prompt)}
                                >
                                    <Text style={[styles.presetChipText, systemPrompt === preset.prompt && styles.presetChipTextActive]}>
                                        {preset.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                    <Text style={styles.promptLabel}>Custom Prompt</Text>
                    <TextInput
                        value={customPromptDraft}
                        onChangeText={setCustomPromptDraft}
                        style={styles.promptInput}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#555"
                        placeholder="Write a custom system prompt..."
                        textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.applyBtn} onPress={() => applyPrompt(customPromptDraft)}>
                        <Text style={styles.applyBtnText}>Apply & Reset Chat</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Messages ── */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: NAV_HEIGHT + 80 }}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((msg) => {
                        const isUser = msg.role === "user";
                        return (
                            <View
                                key={msg.id}
                                style={{
                                    flexDirection: isUser ? "row-reverse" : "row",
                                    alignItems: "flex-end",
                                    marginBottom: 16,
                                }}
                            >
                                <View style={isUser ? styles.userAvatar : styles.botAvatarSmall}>
                                    {isUser
                                        ? <User size={16} color="#fff" />
                                        : <Bot size={16} color="#22c55e" />}
                                </View>
                                <View style={{
                                    maxWidth: "72%",
                                    marginLeft: isUser ? 0 : 10,
                                    marginRight: isUser ? 10 : 0,
                                    alignItems: isUser ? "flex-end" : "flex-start",
                                }}>
                                    <View style={isUser ? styles.userBubble : styles.assistantBubble}>
                                        <Text style={isUser ? styles.userText : styles.assistantText}>
                                            {msg.content}
                                        </Text>
                                    </View>
                                    <Text style={[styles.timestamp, isUser && { textAlign: "right" }]}>
                                        {formatTime(msg.timestamp)}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}

                    {isTyping && (
                        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 16 }}>
                            <View style={styles.botAvatarSmall}>
                                <Bot size={16} color="#22c55e" />
                            </View>
                            <View style={[styles.assistantBubble, { marginLeft: 10, paddingVertical: 14 }]}>
                                <TypingDots />
                            </View>
                        </View>
                    )}

                    {messages.length === 1 && !isTyping && (
                        <View style={{ marginTop: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                                <Sparkles size={14} color="#22c55e" />
                                <Text style={{ color: "#888", fontSize: 12 }}>Quick suggestions</Text>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {QUICK_PROMPTS.map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        style={styles.quickChip}
                                        onPress={() => sendMessage(p)}
                                    >
                                        <Text style={styles.quickChipText}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>

                <View style={[styles.inputBar, { marginBottom: NAV_HEIGHT }]}>
                    <TextInput
                        placeholder="Ask Bernard anything..."
                        placeholderTextColor="#555"
                        value={input}
                        onChangeText={setInput}
                        style={styles.textInput}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnOff]}
                        onPress={() => sendMessage()}
                        disabled={!input.trim() || isTyping}
                    >
                        <Send size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    header: {
        backgroundColor: "#1a1a1a",
        paddingHorizontal: 16,
        paddingTop: 52,
        paddingBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#2a2a2a",
    },
    botAvatar: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: "rgba(34,197,94,0.12)",
        alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
    onlineText: { color: "#888", fontSize: 12 },
    headerBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: "#2a2a2a",
        alignItems: "center", justifyContent: "center",
    },
    headerBtnActive: {
        backgroundColor: "rgba(34,197,94,0.15)",
        borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
    },
    updatingBanner: {
        backgroundColor: "rgba(34,197,94,0.1)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(34,197,94,0.2)",
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    updatingBannerText: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
    promptPanel: {
        backgroundColor: "#141414",
        borderBottomWidth: 1,
        borderBottomColor: "#2a2a2a",
        padding: 16,
    },
    promptPanelTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 12 },
    presetChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: "#333",
        backgroundColor: "#2a2a2a",
    },
    presetChipActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22c55e" },
    presetChipText: { color: "#888", fontSize: 13 },
    presetChipTextActive: { color: "#22c55e", fontWeight: "600" },
    promptLabel: { color: "#888", fontSize: 12, fontWeight: "500", marginBottom: 8 },
    promptInput: {
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10,
        color: "#fff", fontSize: 13,
        minHeight: 90,
        borderWidth: 1, borderColor: "#333",
        marginBottom: 12,
    },
    applyBtn: {
        backgroundColor: "#22c55e", borderRadius: 12,
        paddingVertical: 12, alignItems: "center",
    },
    applyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    userAvatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "#2a2a2a",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
    },
    botAvatarSmall: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "rgba(34,197,94,0.12)",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
    },
    userBubble: {
        backgroundColor: "#22c55e",
        borderRadius: 18, borderBottomRightRadius: 4,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    assistantBubble: {
        backgroundColor: "#1e1e1e",
        borderRadius: 18, borderBottomLeftRadius: 4,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1.5, borderColor: "#2e2e2e",
    },
    userText: { color: "#fff", fontSize: 14, lineHeight: 20 },
    assistantText: { color: "#e5e5e5", fontSize: 14, lineHeight: 20 },
    timestamp: { color: "#555", fontSize: 11, marginTop: 4, paddingHorizontal: 2 },
    quickChip: {
        backgroundColor: "#1e1e1e",
        borderWidth: 1, borderColor: "#333",
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    },
    quickChipText: { color: "#ccc", fontSize: 13 },
    inputBar: {
        flexDirection: "row", alignItems: "flex-end",
        paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
        backgroundColor: "#1a1a1a",
        borderTopWidth: 1, borderTopColor: "#2a2a2a",
        gap: 10,
    },
    textInput: {
        flex: 1, backgroundColor: "#2a2a2a",
        borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
        color: "#fff", fontSize: 14, maxHeight: 100,
        borderWidth: 1, borderColor: "#333",
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#22c55e",
        alignItems: "center", justifyContent: "center",
    },
    sendBtnOff: { backgroundColor: "#2a2a2a" },
});