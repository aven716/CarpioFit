import { StatusBar } from "expo-status-bar";
import { Bot, Send, Settings, Sparkles, Trash2, User, X } from "lucide-react-native";
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
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.1-8b-instant";

const MAX_CONTEXT_MESSAGES = 20;

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
    {
        label: "🏋️ Fitness Coach",
        prompt: `You are Bernard, CarpioFit's AI fitness coach named after Bernardo Carpio. Help users with workout plans, meal planning, and fitness motivation. Keep responses concise and encouraging.`,
    },
    {
        label: "🥗 Nutrition Expert",
        prompt: `You are Bernard, CarpioFit's AI nutritionist. Focus on meal planning, macros, calorie tracking, and healthy eating habits. Give specific, science-backed advice.`,
    },
    {
        label: "🧘 Wellness Coach",
        prompt: `You are Bernard, CarpioFit's wellness coach. Focus on mental health, stress management, sleep, recovery, and work-life balance alongside fitness. Be calm and empathetic.`,
    },
    {
        label: "💪 Bodybuilding Coach",
        prompt: `You are Bernard, CarpioFit's bodybuilding coach. Focus on muscle gain, progressive overload, protein intake, and hypertrophy training. Be direct and data-driven.`,
    },
];

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    persisted?: boolean;
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
                <View
                    key={i}
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: dot > i ? "#22c55e" : "#333",
                    }}
                />
            ))}
        </View>
    );
}

const NAV_HEIGHT = 64;

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
                {
                    role: "system",
                    content: "You are a fitness plan generator. Respond ONLY with valid JSON. No markdown, no explanation, no extra text.",
                },
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
        .upsert(
            { user_id: userId, plan, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
        );
    if (error) throw error;
}

async function loadMessages(userId: string, limit = 80): Promise<Message[]> {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data.reverse().map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        timestamp: new Date(row.created_at),
        persisted: true,
    }));
}

async function persistMessage(userId: string, role: "user" | "assistant", content: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("chat_messages")
        .insert({ user_id: userId, role, content })
        .select("id")
        .single();
    if (error) { console.error("Failed to persist message:", error.message); return null; }
    return data.id;
}

async function clearHistory(userId: string) {
    await supabase.from("chat_messages").delete().eq("user_id", userId);
}

const welcomeMessage = (): Message => ({
    id: "welcome",
    role: "assistant",
    content: "Hey! I'm Bernard, your CarpioFit AI coach 💪 I can help you with workouts, nutrition, and recovery. I can also update your workout plan anytime — just ask! How can I help you today?",
    timestamp: new Date(),
    persisted: false,
});

export default function AICoach() {
    const [messages, setMessages] = useState<Message[]>([welcomeMessage()]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [showPromptPanel, setShowPromptPanel] = useState(false);
    const [customPromptDraft, setCustomPromptDraft] = useState(DEFAULT_SYSTEM_PROMPT);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const init = async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;
            const uid = auth.user.id;
            setUserId(uid);

            const { data: profile } = await supabase
                .from("profiles")
                .select("age, gender, weight_kg, height_cm, goal, activity_level, daily_calories, daily_protein, daily_fat, daily_carbs")
                .eq("id", uid)
                .single();
            if (profile) setUserProfile(profile as UserProfile);

            const history = await loadMessages(uid);
            if (history.length > 0) setMessages(history);
            setIsLoadingHistory(false);
        };
        init();
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
            persisted: false,
        }]);
    };

    const handleClearHistory = () => {
        if (!userId) return;
        Alert.alert("Clear Chat History", "This will permanently delete all your conversation history with Bernard. Continue?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear", style: "destructive",
                onPress: async () => {
                    await clearHistory(userId);
                    setMessages([welcomeMessage()]);
                },
            },
        ]);
    };

    const handlePlanAction = async (action: string, instruction: string) => {
        if (!userProfile || !userId) return false;
        if (action === "update_workout_plan") {
            setIsUpdatingPlan(true);
            try {
                const plan = await generateWorkoutPlan(userProfile, instruction);
                await saveWorkoutPlan(userId, plan);
                const content = "✅ Your workout plan has been updated! Head to the Calendar tab to see your new personalized weekly plan.";
                const dbId = await persistMessage(userId, "assistant", content);
                setMessages((prev) => [...prev, { id: dbId ?? Date.now().toString(), role: "assistant", content, timestamp: new Date(), persisted: true }]);
            } catch {
                const content = "Sorry, I had trouble updating your plan. Please try again!";
                const dbId = await persistMessage(userId, "assistant", content);
                setMessages((prev) => [...prev, { id: dbId ?? Date.now().toString(), role: "assistant", content, timestamp: new Date(), persisted: true }]);
            } finally {
                setIsUpdatingPlan(false);
            }
            return true;
        }
        return false;
    };

    const sendMessage = async (content?: string) => {
        const text = (content ?? input).trim();
        if (!text || isTyping || !userId) return;

        const tempId = `temp-${Date.now()}`;
        const userMsg: Message = { id: tempId, role: "user", content: text, timestamp: new Date(), persisted: false };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");
        setIsTyping(true);

        persistMessage(userId, "user", text).then((dbId) => {
            if (dbId) setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: dbId, persisted: true } : m)));
        });

        try {
            const contextMessages = updatedMessages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content }));
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [{ role: "system", content: systemPrompt }, ...contextMessages],
                    max_tokens: 512,
                    temperature: 0.7,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
            const rawContent: string = data.choices[0].message.content;

            const actionMatch = rawContent.match(/^\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})/);
            if (actionMatch) {
                try {
                    const actionData = JSON.parse(actionMatch[1]);
                    const conversationalPart = rawContent.replace(actionMatch[1], "").trim();
                    if (conversationalPart) {
                        const dbId = await persistMessage(userId, "assistant", conversationalPart);
                        setMessages((prev) => [...prev, { id: dbId ?? (Date.now() + 1).toString(), role: "assistant", content: conversationalPart, timestamp: new Date(), persisted: true }]);
                    }
                    setIsTyping(false);
                    await handlePlanAction(actionData.action, actionData.instruction);
                    return;
                } catch { }
            }

            const dbId = await persistMessage(userId, "assistant", rawContent);
            setMessages((prev) => [...prev, { id: dbId ?? (Date.now() + 1).toString(), role: "assistant", content: rawContent, timestamp: new Date(), persisted: true }]);
        } catch (err: any) {
            const errContent = `Sorry, something went wrong: ${err?.message ?? "Unknown error"}`;
            const dbId = await persistMessage(userId, "assistant", errContent);
            setMessages((prev) => [...prev, { id: dbId ?? (Date.now() + 1).toString(), role: "assistant", content: errContent, timestamp: new Date(), persisted: true }]);
        } finally {
            setIsTyping(false);
        }
    };

    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const formatDateLabel = (d: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const groupedMessages: { dateLabel: string; items: Message[] }[] = [];
    for (const msg of messages) {
        const label = formatDateLabel(msg.timestamp);
        const last = groupedMessages[groupedMessages.length - 1];
        if (last && last.dateLabel === label) last.items.push(msg);
        else groupedMessages.push({ dateLabel: label, items: [msg] });
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.avatarWrap}>
                        <Bot size={22} color="#22c55e" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Bernard</Text>
                        <Text style={styles.headerSub}>
                            {isLoadingHistory ? "Loading..." : isUpdatingPlan ? "Updating plan..." : "AI Coach · Online"}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleClearHistory}>
                        <Trash2 size={16} color="#555" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconBtn, showPromptPanel && styles.iconBtnActive]}
                        onPress={() => setShowPromptPanel((v) => !v)}
                    >
                        <Settings size={16} color={showPromptPanel ? "#22c55e" : "#555"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setMessages([welcomeMessage()])}>
                        <X size={16} color="#555" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Updating Banner ── */}
            {isUpdatingPlan && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>⚡ Updating your workout plan...</Text>
                </View>
            )}

            {/* ── Prompt Panel ── */}
            {showPromptPanel && (
                <View style={styles.promptPanel}>
                    <Text style={styles.promptPanelTitle}>Coach Style</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {PROMPT_PRESETS.map((preset) => (
                                <TouchableOpacity
                                    key={preset.label}
                                    style={[styles.chip, systemPrompt === preset.prompt && styles.chipActive]}
                                    onPress={() => applyPrompt(preset.prompt)}
                                >
                                    <Text style={[styles.chipText, systemPrompt === preset.prompt && styles.chipTextActive]}>
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
                        placeholderTextColor="#444"
                        placeholder="Write a custom system prompt..."
                        textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.applyBtn} onPress={() => applyPrompt(customPromptDraft)}>
                        <Text style={styles.applyBtnText}>Apply & Reset Chat</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Messages ── */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                >
                    {isLoadingHistory && (
                        <View style={styles.loadingWrap}>
                            <Text style={styles.loadingText}>Loading conversation...</Text>
                        </View>
                    )}

                    {groupedMessages.map((group) => (
                        <View key={group.dateLabel}>
                            {/* Date separator */}
                            <View style={styles.dateSep}>
                                <View style={styles.dateLine} />
                                <Text style={styles.dateText}>{group.dateLabel}</Text>
                                <View style={styles.dateLine} />
                            </View>

                            {group.items.map((msg) => {
                                const isUser = msg.role === "user";
                                return (
                                    <View
                                        key={msg.id}
                                        style={[styles.msgRow, isUser && styles.msgRowUser]}
                                    >
                                        {/* Avatar */}
                                        <View style={[styles.avatar, isUser && styles.avatarUser]}>
                                            {isUser
                                                ? <User size={14} color="#fff" />
                                                : <Bot size={14} color="#22c55e" />
                                            }
                                        </View>

                                        {/* Bubble */}
                                        <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
                                            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                                                <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                                                    {msg.content}
                                                </Text>
                                            </View>
                                            <Text style={[styles.time, isUser && { textAlign: "right" }]}>
                                                {formatTime(msg.timestamp)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))}

                    {/* Typing indicator */}
                    {isTyping && (
                        <View style={styles.msgRow}>
                            <View style={styles.avatar}>
                                <Bot size={14} color="#22c55e" />
                            </View>
                            <View style={[styles.bubble, styles.bubbleBot, { paddingVertical: 14, marginLeft: 10 }]}>
                                <TypingDots />
                            </View>
                        </View>
                    )}

                    {/* Quick prompts */}
                    {messages.length === 1 && !isTyping && !isLoadingHistory && (
                        <View style={{ marginTop: 12 }}>
                            <View style={styles.quickHeader}>
                                <Sparkles size={13} color="#22c55e" />
                                <Text style={styles.quickLabel}>Quick suggestions</Text>
                            </View>
                            <View style={styles.quickGrid}>
                                {QUICK_PROMPTS.map((p) => (
                                    <TouchableOpacity key={p} style={styles.quickChip} onPress={() => sendMessage(p)}>
                                        <Text style={styles.quickChipText}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* ── Input Bar ── */}
                <View style={[styles.inputBar, { marginBottom: NAV_HEIGHT }]}>
                    <TextInput
                        placeholder="Ask Bernard anything..."
                        placeholderTextColor="#444"
                        value={input}
                        onChangeText={setInput}
                        style={styles.input}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnOff]}
                        onPress={() => sendMessage()}
                        disabled={!input.trim() || isTyping}
                    >
                        <Send size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },

    // Header
    header: {
        backgroundColor: "#0a0a0a",
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a1a",
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
    headerSub: { color: "#555", fontSize: 12, marginTop: 1 },
    headerActions: { flexDirection: "row", gap: 6 },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#111",
        alignItems: "center",
        justifyContent: "center",
    },
    iconBtnActive: { backgroundColor: "#111", borderWidth: 1, borderColor: "#22c55e" },

    // Banner
    banner: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a1a",
    },
    bannerText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

    // Prompt panel
    promptPanel: {
        backgroundColor: "#0f0f0f",
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a1a",
        padding: 16,
    },
    promptPanelTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 12 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#222",
        backgroundColor: "#111",
    },
    chipActive: { borderColor: "#22c55e" },
    chipText: { color: "#555", fontSize: 12 },
    chipTextActive: { color: "#22c55e", fontWeight: "600" },
    promptLabel: { color: "#444", fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
    promptInput: {
        backgroundColor: "#111",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: "#fff",
        fontSize: 13,
        minHeight: 80,
        borderWidth: 1,
        borderColor: "#222",
        marginBottom: 10,
    },
    applyBtn: { backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 11, alignItems: "center" },
    applyBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

    // Messages
    messageList: { padding: 16, paddingBottom: NAV_HEIGHT + 80 },
    loadingWrap: { alignItems: "center", paddingVertical: 20 },
    loadingText: { color: "#333", fontSize: 13 },

    // Date separator
    dateSep: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
    dateLine: { flex: 1, height: 1, backgroundColor: "#1a1a1a" },
    dateText: { color: "#333", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },

    // Message rows
    msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 14, gap: 10 },
    msgRowUser: { flexDirection: "row-reverse" },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#1e1e1e",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    avatarUser: { backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" },
    bubbleWrap: { maxWidth: "74%", alignItems: "flex-start" },
    bubbleWrapUser: { alignItems: "flex-end" },
    bubble: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    bubbleBot: {
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#1e1e1e",
        borderBottomLeftRadius: 4,
    },
    bubbleUser: {
        backgroundColor: "#22c55e",
        borderBottomRightRadius: 4,
    },
    bubbleText: { color: "#ccc", fontSize: 14, lineHeight: 21 },
    bubbleTextUser: { color: "#fff" },
    time: { color: "#333", fontSize: 10, marginTop: 4, paddingHorizontal: 2 },

    // Quick prompts
    quickHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    quickLabel: { color: "#444", fontSize: 12 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    quickChip: {
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#1e1e1e",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    quickChipText: { color: "#555", fontSize: 12 },

    // Input bar
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#0a0a0a",
        borderTopWidth: 1,
        borderTopColor: "#1a1a1a",
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: "#111",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: "#fff",
        fontSize: 14,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: "#1e1e1e",
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "#22c55e",
        alignItems: "center",
        justifyContent: "center",
    },
    sendBtnOff: { backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e" },
});