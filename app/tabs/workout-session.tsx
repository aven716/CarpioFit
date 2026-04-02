import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, ChevronRight, SkipForward, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";
const [totalCaloriesBurned, setTotalCaloriesBurned] = useState(0);
const [totalActiveMinutes, setTotalActiveMinutes] = useState(0);
const { width } = Dimensions.get("window");
const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

interface Exercise {
    name: string;
    sets: number;
    reps: string | null;
    duration: string | null;
}

interface ExerciseData {
    id: string;
    gifUrl: string | null;
    bodyPart: string;
    target: string;
    instructions: string[];
    name: string;
}

const CALORIES_PER_MINUTE: Record<string, number> = {
    cardio: 10,
    strength: 6,
    flexibility: 3,
    rest: 0,
};

// MET values for more accurate calorie calculation
const MET_BY_EXERCISE: Record<string, number> = {
    "push": 8, "pull": 6, "squat": 7, "deadlift": 8, "lunge": 6,
    "run": 10, "jog": 8, "jump": 9, "burpee": 10, "cardio": 10,
    "hiit": 10, "cycle": 8, "bike": 8, "swim": 8, "row": 7,
    "plank": 4, "crunch": 5, "sit": 5, "curl": 5, "press": 6,
    "fly": 5, "raise": 4, "dip": 6, "stretch": 3, "yoga": 3,
    "flex": 3, "foam": 2, "walk": 4, "climb": 8, "rope": 10,
};

function getMET(exerciseName: string): number {
    const lower = exerciseName.toLowerCase();
    for (const [keyword, met] of Object.entries(MET_BY_EXERCISE)) {
        if (lower.includes(keyword)) return met;
    }
    return 5; // default moderate exercise
}

function calculateCaloriesBurned(
    exerciseName: string,
    durationMinutes: number,
    weightKg: number = 70
): number {
    const met = getMET(exerciseName);
    // Calories = MET × weight(kg) × duration(hours)
    return Math.round(met * weightKg * (durationMinutes / 60));
}

// ─── Bernard motivational messages ───────────
const BERNARD_MESSAGES: Record<string, string[]> = {
    chest: ["Chest day! Push like Bernardo Carpio moving mountains! 💪", "Every rep builds the chest of a legend!", "Drive through it — strength is earned!"],
    back: ["Strong back, strong foundation. Pull hard! 🏔️", "Bernardo Carpio carried mountains — you can carry this set!", "Back gains incoming!"],
    legs: ["Leg day separates the legends from the rest! 🦵", "No shortcuts. Every squat counts!", "Your legs will thank you tomorrow... eventually."],
    shoulders: ["Shoulders of a warrior! Press it up! ⚔️", "Build those boulders!", "Every rep is a step toward greatness!"],
    "upper arms": ["Biceps and triceps — the pillars of strength!", "Curl like you mean it!", "Every rep sculpts a legend!"],
    "lower arms": ["Grip strength matters! Hold on tight!", "Forearms of iron!", "Squeeze it!"],
    "upper legs": ["Quads and hamstrings of steel! 🦵", "Leg day never lies!", "Push through the burn!"],
    "lower legs": ["Calves of a mountain climber! Keep going!", "Every step builds foundation!", "Strong legs carry you further!"],
    waist: ["Core tight, focus sharper! 🎯", "Waist work builds total body stability!", "Control the movement!"],
    cardio: ["Heart pumping, legend in the making! 🏃", "Cardio builds endurance — keep pushing!", "Every step counts!"],
    default: ["Let's go! Bernard believes in you! 💪", "One rep at a time — you've got this!", "Strength is built moment by moment!"],
};

function getBernardMessage(bodyPart: string): string {
    const messages = BERNARD_MESSAGES[bodyPart?.toLowerCase()] ?? BERNARD_MESSAGES.default;
    return messages[Math.floor(Math.random() * messages.length)];
}
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // remove special chars
        .replace(/\s+/g, " ")        // clean spaces
        .trim();
}
// ─── Fetch exercise from ExerciseDB v2 ────────
async function fetchExerciseData(name: string): Promise<ExerciseData | null> {
    try {
        const normalized = normalizeName(name);

        const response = await fetch(
            `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(normalized)}?limit=3&offset=0`,
            {
                method: "GET",
                headers: {
                    "X-RapidAPI-Key": RAPIDAPI_KEY ?? "",
                    "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                },
            }
        );

        const data = await response.json();

        if (!data || !Array.isArray(data) || data.length === 0) {
            // Try a broader search with just first word
            const firstWord = normalized.split(" ")[0];
            if (firstWord === normalized) return null; // already tried single word

            const fallbackRes = await fetch(
                `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(firstWord)}?limit=1&offset=0`,
                {
                    method: "GET",
                    headers: {
                        "X-RapidAPI-Key": RAPIDAPI_KEY ?? "",
                        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                    },
                }
            );
            const fallbackData = await fallbackRes.json();
            if (!fallbackData || fallbackData.length === 0) return null;

            const ex = fallbackData[0];
            return buildExerciseData(ex);
        }

        return buildExerciseData(data[0]);
    } catch (err) {
        console.warn("ExerciseDB fetch error:", err);
        return null;
    }
}

function buildExerciseData(ex: any): ExerciseData {
    // v2 API returns id but no gifUrl in JSON — GIF is fetched via /image endpoint
    const gifUrl = ex.gifUrl
        ? ex.gifUrl  // v1 format still has gifUrl
        : ex.id
            ? `https://exercisedb.p.rapidapi.com/image?exerciseId=${ex.id}&resolution=360&rapidapi-key=${RAPIDAPI_KEY}`
            : null;

    return {
        id: ex.id ?? "",
        gifUrl,
        bodyPart: ex.bodyPart ?? "default",
        target: ex.target ?? "",
        instructions: ex.instructions ?? [],
        name: ex.name ?? "",
    };
}

// ─── Muscle Group Fallback ────────────────────
function MuscleGroupIllustration({ bodyPart }: { bodyPart: string }) {
    const muscleEmojis: Record<string, string> = {
        chest: "🫁", back: "🔙", "upper legs": "🦵", "lower legs": "🦶",
        shoulders: "🏔️", "upper arms": "💪", "lower arms": "🤜",
        waist: "⚡", cardio: "❤️", default: "🏋️",
    };
    const colors: Record<string, string> = {
        chest: "#3b82f6", back: "#8b5cf6", "upper legs": "#f97316", "lower legs": "#f97316",
        shoulders: "#22c55e", "upper arms": "#f59e0b", "lower arms": "#f59e0b",
        waist: "#ef4444", cardio: "#ec4899", default: "#22c55e",
    };
    const key = bodyPart?.toLowerCase() ?? "default";
    const emoji = muscleEmojis[key] ?? muscleEmojis.default;
    const color = colors[key] ?? colors.default;

    return (
        <View style={[ws.fallbackBox, { borderColor: color + "44" }]}>
            <Text style={ws.fallbackEmoji}>{emoji}</Text>
            <Text style={[ws.fallbackBodyPart, { color }]}>
                {bodyPart ? bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1) : "Exercise"}
            </Text>
            <Text style={ws.fallbackSub}>Exercise visual not available</Text>
        </View>
    );
}

// ─── Rest Timer ───────────────────────────────
function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
    const [remaining, setRemaining] = useState(seconds);
    const progressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: 0,
            duration: seconds * 1000,
            useNativeDriver: false,
        }).start();

        const interval = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) { clearInterval(interval); onDone(); return 0; }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const barWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    return (
        <View style={ws.restTimerBox}>
            <Text style={ws.restTimerTitle}>😮‍💨 Rest Time</Text>
            <Text style={ws.restTimerCount}>{remaining}s</Text>
            <View style={ws.restTimerTrack}>
                <Animated.View style={[ws.restTimerFill, { width: barWidth }]} />
            </View>
            <TouchableOpacity style={ws.skipRestBtn} onPress={onDone}>
                <Text style={ws.skipRestBtnText}>Skip Rest</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Summary Screen ───────────────────────────
function SummaryScreen({
    exercises,
    completedCount,
    skippedCount,
    dayName,
    focus,
    loggedWorkoutIds,
    totalCaloriesBurned,
    totalActiveMinutes,
    onClose,
}: {
    exercises: Exercise[];
    completedCount: number;
    skippedCount: number;
    dayName: string;
    focus: string;
    loggedWorkoutIds: string[];
    totalCaloriesBurned: number;
    totalActiveMinutes: number;
    onClose: () => void;
}) {
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

    const handleDeleteLog = async (id: string, name: string) => {
        Alert.alert("Remove Log", `Remove "${name}" from your calendar?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove", style: "destructive",
                onPress: async () => {
                    const { error } = await supabase.from("workouts").delete().eq("id", id);
                    if (!error) setDeletedIds((prev) => new Set([...prev, id]));
                    else Alert.alert("Error", "Could not remove workout.");
                },
            },
        ]);
    };

    return (
        <View style={ws.summaryContainer}>
            <ScrollView contentContainerStyle={ws.summaryScroll}>
                <View style={ws.summaryCard}>
                    <Text style={ws.summaryEmoji}>🏆</Text>
                    <Text style={ws.summaryTitle}>Workout Complete!</Text>
                    <Text style={ws.summarySub}>{focus} — {dayName}</Text>

                    <View style={ws.summaryStats}>
                        <View style={ws.summaryStat}>
                            <Text style={ws.summaryStatVal}>{completedCount}</Text>
                            <Text style={ws.summaryStatLabel}>Done</Text>
                        </View>
                        <View style={ws.summaryStat}>
                            <Text style={[ws.summaryStatVal, { color: "#f97316" }]}>{skippedCount}</Text>
                            <Text style={ws.summaryStatLabel}>Skipped</Text>
                        </View>
                        <View style={ws.summaryStat}>
                            <Text style={[ws.summaryStatVal, { color: "#f97316" }]}>{totalCaloriesBurned}</Text>
                            <Text style={ws.summaryStatLabel}>kcal</Text>
                        </View>
                        <View style={ws.summaryStat}>
                            <Text style={[ws.summaryStatVal, { color: "#3b82f6" }]}>{totalActiveMinutes}m</Text>
                            <Text style={ws.summaryStatLabel}>Active</Text>
                        </View>
                    </View>

                    <View style={ws.summaryMsgBox}>
                        <Text style={ws.summaryMsg}>
                            {completedCount === exercises.length
                                ? "🔥 Perfect session! Bernardo Carpio would be proud!"
                                : completedCount > exercises.length / 2
                                    ? "💪 Solid work! Every rep counts toward greatness!"
                                    : "👊 You showed up — that's what matters. Keep pushing!"}
                        </Text>
                    </View>

                    {loggedWorkoutIds.length > 0 && (
                        <View style={ws.loggedListBox}>
                            <Text style={ws.loggedListTitle}>✅ Logged to Calendar</Text>
                            <Text style={ws.loggedListSub}>Tap × to remove if logged by mistake</Text>
                            {loggedWorkoutIds.map((item) => {
                                const [id, name] = item.split("||");
                                const isDeleted = deletedIds.has(id);
                                return (
                                    <View key={id} style={[ws.loggedItem, isDeleted && ws.loggedItemDeleted]}>
                                        <CheckCircle size={14} color={isDeleted ? "#333" : "#22c55e"} />
                                        <Text style={[ws.loggedItemName, isDeleted && { color: "#333", textDecorationLine: "line-through" }]}>
                                            {name}
                                        </Text>
                                        {!isDeleted && (
                                            <TouchableOpacity style={ws.deleteLogBtn} onPress={() => handleDeleteLog(id, name)}>
                                                <X size={12} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <TouchableOpacity style={ws.summaryCloseBtn} onPress={onClose}>
                        <Text style={ws.summaryCloseBtnText}>Back to Calendar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
// ─── Main Session Screen ──────────────────────
export default function WorkoutSession() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        exercises: string;
        dayName: string;
        focus: string;
        dateStr: string;
        userId: string;
    }>();

    const exercises: Exercise[] = JSON.parse(params.exercises ?? "[]");
    const dayName = params.dayName ?? "Today";
    const focus = params.focus ?? "Workout";
    const dateStr = params.dateStr ?? new Date().toISOString().split("T")[0];
    const userId = params.userId ?? "";

    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSet, setCurrentSet] = useState(1);
    const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
    const [loadingGif, setLoadingGif] = useState(true);
    const [gifError, setGifError] = useState(false);
    const [showRest, setShowRest] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
    const [skippedExercises, setSkippedExercises] = useState<Set<number>>(new Set());
    const [bernardMsg, setBernardMsg] = useState("");
    const [loggedWorkoutIds, setLoggedWorkoutIds] = useState<string[]>([]);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const currentExercise = exercises[currentIndex];
    const totalSets = currentExercise?.sets > 0 ? currentExercise.sets : 1;

    useEffect(() => {
        if (!currentExercise) return;
        loadExerciseData();
    }, [currentIndex]);

    const loadExerciseData = async () => {
        setLoadingGif(true);
        setGifError(false);
        setExerciseData(null);
        const data = await fetchExerciseData(currentExercise.name);
        setExerciseData(data);
        setBernardMsg(getBernardMessage(data?.bodyPart ?? "default"));
        setLoadingGif(false);
    };

    const animateTransition = (callback: () => void) => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            callback();
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
    };

    const handleNextSet = () => {
        if (currentSet < totalSets) {
            setShowRest(true);
        } else {
            setCompletedExercises((prev) => new Set([...prev, currentIndex]));
            moveToNext();
        }
    };

    const handleAfterRest = () => {
        setShowRest(false);
        setCurrentSet((prev) => prev + 1);
    };

    const handleSkip = () => {
        Alert.alert("Skip Exercise?", `Skip ${currentExercise?.name}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Skip", onPress: () => {
                    setSkippedExercises((prev) => new Set([...prev, currentIndex]));
                    animateTransition(() => moveToNext());
                },
            },
        ]);
    };

    const moveToNext = () => {
        if (currentIndex + 1 >= exercises.length) {
            finishWorkout();
        } else {
            animateTransition(() => {
                setCurrentIndex((prev) => prev + 1);
                setCurrentSet(1);
                setShowRest(false);
            });
        }
    };

    const finishWorkout = async () => {
        const ids: string[] = [];
        let totalCaloriesBurned = 0;
        let totalActiveMinutes = 0;

        try {
            const completedList = exercises.filter((_, i) => !skippedExercises.has(i));
            if (completedList.length > 0 && userId) {
                // Get user weight for calorie calculation
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("weight_kg")
                    .eq("id", userId)
                    .single();
                const weightKg = Number(profile?.weight_kg) || 70;

                const rows = completedList.map((ex) => {
                    const durationMin = ex.duration
                        ? parseInt(ex.duration.replace(/[^0-9]/g, "")) || 30
                        : (ex.sets > 0 ? ex.sets * 3 : 30); // estimate 3 min per set
                    const caloriesBurned = calculateCaloriesBurned(ex.name, durationMin, weightKg);
                    totalCaloriesBurned += caloriesBurned;
                    totalActiveMinutes += durationMin;

                    return {
                        user_id: userId,
                        date: dateStr,
                        name: ex.name,
                        type: inferType(ex.name),
                        duration_minutes: durationMin,
                        calories_burned: caloriesBurned,
                        completed: true,
                    };
                });

                const { data, error } = await supabase
                    .from("workouts")
                    .insert(rows)
                    .select("id, name");

                if (!error && data) {
                    data.forEach((w) => ids.push(`${w.id}||${w.name}`));
                }

                // Update daily_stats with accumulated calories + active minutes
                if (totalCaloriesBurned > 0 || totalActiveMinutes > 0) {
                    const { data: existing } = await supabase
                        .from("daily_stats")
                        .select("calories_burned, active_minutes")
                        .eq("user_id", userId)
                        .eq("date", dateStr)
                        .single();

                    await supabase.from("daily_stats").upsert({
                        user_id: userId,
                        date: dateStr,
                        calories_burned: (Number(existing?.calories_burned) || 0) + totalCaloriesBurned,
                        active_minutes: (Number(existing?.active_minutes) || 0) + totalActiveMinutes,
                    }, { onConflict: "user_id,date" });
                }
            }
        } catch (err) {
            console.warn("Auto-log failed:", err);
        }
        setLoggedWorkoutIds(ids);
        setTotalCaloriesBurned(totalCaloriesBurned);
        setTotalActiveMinutes(totalActiveMinutes);
        setShowSummary(true);
    };
    const handleQuit = () => {
        Alert.alert("Quit Workout?", "Your progress won't be saved.", [
            { text: "Keep Going", style: "cancel" },
            { text: "Quit", style: "destructive", onPress: () => router.back() },
        ]);
    };

    function inferType(name: string): "strength" | "cardio" | "flexibility" | "rest" {
        const lower = name.toLowerCase();
        if (/run|jog|cycle|bike|swim|cardio|hiit|jump|rope|row|elliptic/.test(lower)) return "cardio";
        if (/stretch|yoga|flex|mobility|foam/.test(lower)) return "flexibility";
        return "strength";
    }

    if (showSummary) {
        return (
            <SummaryScreen
                exercises={exercises}
                completedCount={completedExercises.size}
                skippedCount={skippedExercises.size}
                dayName={dayName}
                focus={focus}
                loggedWorkoutIds={loggedWorkoutIds}
                totalCaloriesBurned={totalCaloriesBurned}
                totalActiveMinutes={totalActiveMinutes}
                onClose={() => router.back()}
            />
        );
    }

    if (!currentExercise) {
        return (
            <View style={[ws.container, { justifyContent: "center", alignItems: "center" }]}>
                <Text style={{ color: "#fff", marginBottom: 16 }}>No exercises found.</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: "#22c55e" }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const progressPercent = (currentIndex / exercises.length) * 100;

    return (
        <View style={ws.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={ws.header}>
                <TouchableOpacity style={ws.quitBtn} onPress={handleQuit}>
                    <X size={20} color="#888" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={ws.headerFocus}>{focus}</Text>
                    <Text style={ws.headerDay}>{dayName}</Text>
                </View>
                <TouchableOpacity style={ws.skipBtn} onPress={handleSkip}>
                    <SkipForward size={18} color="#888" />
                </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={ws.progressBarTrack}>
                <View style={[ws.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={ws.progressLabel}>Exercise {currentIndex + 1} of {exercises.length}</Text>

            <ScrollView contentContainerStyle={ws.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim }}>

                    {/* GIF / Fallback */}
                    <View style={ws.gifContainer}>
                        {loadingGif ? (
                            <View style={ws.gifPlaceholder}>
                                <Text style={ws.gifLoadingText}>⏳ Loading exercise...</Text>
                            </View>
                        ) : exerciseData?.gifUrl && !gifError ? (
                            <Image
                                source={{
                                    uri: exerciseData.gifUrl,
                                    headers: {
                                        "X-RapidAPI-Key": RAPIDAPI_KEY ?? "",
                                        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                                    },
                                }}
                                style={ws.gifImage}
                                resizeMode="contain"
                                onError={() => setGifError(true)}
                            />
                        ) : (
                            <MuscleGroupIllustration bodyPart={exerciseData?.bodyPart ?? "default"} />
                        )}
                    </View>

                    {/* Exercise Info */}
                    <View style={ws.infoBox}>
                        <Text style={ws.exerciseName}>{currentExercise.name}</Text>
                        {exerciseData && (
                            <View style={ws.muscleRow}>
                                <View style={ws.musclePill}>
                                    <Text style={ws.musclePillText}>{exerciseData.bodyPart}</Text>
                                </View>
                                {exerciseData.target ? (
                                    <View style={[ws.musclePill, { backgroundColor: "rgba(59,130,246,0.15)", borderColor: "rgba(59,130,246,0.3)" }]}>
                                        <Text style={[ws.musclePillText, { color: "#3b82f6" }]}>{exerciseData.target}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )}
                    </View>

                    {/* Sets & Reps */}
                    {!showRest && (
                        <View style={ws.setsBox}>
                            <View style={ws.setsRow}>
                                {Array.from({ length: totalSets }).map((_, i) => (
                                    <View key={i} style={[
                                        ws.setDot,
                                        i < currentSet - 1 && ws.setDotDone,
                                        i === currentSet - 1 && ws.setDotActive,
                                    ]} />
                                ))}
                            </View>
                            <Text style={ws.setLabel}>Set {currentSet} of {totalSets}</Text>
                            {currentExercise.reps && (
                                <Text style={ws.repsLabel}>{currentExercise.reps} reps</Text>
                            )}
                            {currentExercise.duration && (
                                <Text style={ws.repsLabel}>{currentExercise.duration}</Text>
                            )}
                        </View>
                    )}

                    {/* Rest Timer */}
                    {showRest && <RestTimer seconds={60} onDone={handleAfterRest} />}

                    {/* Instructions */}
                    {!showRest && exerciseData?.instructions && exerciseData.instructions.length > 0 && (
                        <View style={ws.instructionsBox}>
                            <Text style={ws.instructionsTitle}>How to do it</Text>
                            {exerciseData.instructions.slice(0, 4).map((step, i) => (
                                <View key={i} style={ws.instructionRow}>
                                    <View style={ws.instructionNum}>
                                        <Text style={ws.instructionNumText}>{i + 1}</Text>
                                    </View>
                                    <Text style={ws.instructionText}>{step}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Bernard Message */}
                    {!showRest && (
                        <View style={ws.bernardBox}>
                            <Text style={ws.bernardEmoji}>🤖</Text>
                            <Text style={ws.bernardText}>{bernardMsg}</Text>
                        </View>
                    )}

                    {/* Action Button */}
                    {!showRest && (
                        <TouchableOpacity style={ws.nextBtn} onPress={handleNextSet}>
                            {currentSet < totalSets ? (
                                <>
                                    <Text style={ws.nextBtnText}>Done — Next Set</Text>
                                    <ChevronRight size={20} color="#fff" />
                                </>
                            ) : currentIndex + 1 >= exercises.length ? (
                                <>
                                    <CheckCircle size={20} color="#fff" />
                                    <Text style={ws.nextBtnText}>Finish Workout 🏆</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={ws.nextBtnText}>Next Exercise</Text>
                                    <ChevronRight size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Exercise dots */}
                    <View style={ws.dotsRow}>
                        {exercises.map((_, i) => (
                            <View key={i} style={[
                                ws.navDot,
                                i === currentIndex && ws.navDotActive,
                                completedExercises.has(i) && ws.navDotDone,
                                skippedExercises.has(i) && ws.navDotSkipped,
                            ]} />
                        ))}
                    </View>

                </Animated.View>
            </ScrollView>
        </View>
    );
}

const ws = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    header: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: "#111",
    },
    quitBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
    skipBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
    headerFocus: { color: "#fff", fontSize: 15, fontWeight: "700" },
    headerDay: { color: "#555", fontSize: 12, marginTop: 2 },
    progressBarTrack: { height: 4, backgroundColor: "#1a1a1a", width: "100%" },
    progressBarFill: { height: 4, backgroundColor: "#22c55e", borderRadius: 2 },
    progressLabel: { color: "#555", fontSize: 12, textAlign: "center", paddingVertical: 8 },
    scrollContent: { padding: 16, paddingBottom: 60 },
    gifContainer: {
        width: "100%", height: 280, backgroundColor: "#111", borderRadius: 20,
        overflow: "hidden", marginBottom: 20, alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#2a2a2a",
    },
    gifImage: { width: "100%", height: "100%" },
    gifPlaceholder: { alignItems: "center", justifyContent: "center", flex: 1 },
    gifLoadingText: { color: "#444", fontSize: 14 },
    fallbackBox: {
        alignItems: "center", justifyContent: "center", flex: 1, width: "100%",
        borderWidth: 1, borderRadius: 20, gap: 8,
    },
    fallbackEmoji: { fontSize: 72 },
    fallbackBodyPart: { fontSize: 18, fontWeight: "700" },
    fallbackSub: { color: "#444", fontSize: 12 },
    infoBox: { marginBottom: 16 },
    exerciseName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 10, textTransform: "capitalize" },
    muscleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    musclePill: {
        backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
        borderWidth: 1, borderColor: "rgba(34,197,94,0.25)",
    },
    musclePillText: { color: "#22c55e", fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
    setsBox: {
        backgroundColor: "#111", borderRadius: 16, padding: 16,
        alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a",
    },
    setsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    setDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#333" },
    setDotDone: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    setDotActive: { backgroundColor: "rgba(34,197,94,0.3)", borderColor: "#22c55e", width: 16, height: 16, borderRadius: 8 },
    setLabel: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
    repsLabel: { color: "#22c55e", fontSize: 28, fontWeight: "800" },
    restTimerBox: {
        backgroundColor: "#111", borderRadius: 16, padding: 24,
        alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)",
    },
    restTimerTitle: { color: "#888", fontSize: 14, marginBottom: 8 },
    restTimerCount: { color: "#3b82f6", fontSize: 56, fontWeight: "800", marginBottom: 16 },
    restTimerTrack: { width: "100%", height: 6, backgroundColor: "#1a1a1a", borderRadius: 3, overflow: "hidden", marginBottom: 16 },
    restTimerFill: { height: 6, backgroundColor: "#3b82f6", borderRadius: 3 },
    skipRestBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#1a1a1a", borderRadius: 10, borderWidth: 1, borderColor: "#333" },
    skipRestBtnText: { color: "#888", fontSize: 13, fontWeight: "600" },
    instructionsBox: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a" },
    instructionsTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 12 },
    instructionRow: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
    instructionNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
    instructionNumText: { color: "#888", fontSize: 11, fontWeight: "700" },
    instructionText: { color: "#aaa", fontSize: 13, lineHeight: 20, flex: 1 },
    bernardBox: {
        flexDirection: "row", alignItems: "flex-start", gap: 10,
        backgroundColor: "rgba(34,197,94,0.06)", borderRadius: 14, padding: 14,
        marginBottom: 20, borderWidth: 1, borderColor: "rgba(34,197,94,0.12)",
    },
    bernardEmoji: { fontSize: 24, flexShrink: 0 },
    bernardText: { color: "#22c55e", fontSize: 13, lineHeight: 20, flex: 1, fontStyle: "italic" },
    nextBtn: {
        backgroundColor: "#22c55e", borderRadius: 16, paddingVertical: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        marginBottom: 20, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 },
    navDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2a2a2a" },
    navDotActive: { backgroundColor: "#22c55e", width: 20, borderRadius: 4 },
    navDotDone: { backgroundColor: "#22c55e" },
    navDotSkipped: { backgroundColor: "#f97316" },

    // Summary
    summaryContainer: { flex: 1, backgroundColor: "#0a0a0a" },
    summaryScroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
    summaryCard: {
        backgroundColor: "#111", borderRadius: 24, padding: 28,
        width: "100%", alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a",
    },
    summaryEmoji: { fontSize: 64, marginBottom: 12 },
    summaryTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 4 },
    summarySub: { color: "#555", fontSize: 14, marginBottom: 24 },
    summaryStats: { flexDirection: "row", gap: 20, marginBottom: 20 },
    summaryStat: { alignItems: "center" },
    summaryStatVal: { color: "#22c55e", fontSize: 28, fontWeight: "800" },
    summaryStatLabel: { color: "#555", fontSize: 12, marginTop: 2 },
    summaryMsgBox: {
        backgroundColor: "rgba(34,197,94,0.06)", borderRadius: 14, padding: 14,
        marginBottom: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.15)", width: "100%",
    },
    summaryMsg: { color: "#22c55e", fontSize: 14, lineHeight: 22, textAlign: "center", fontStyle: "italic" },

    // Logged list with delete
    loggedListBox: {
        width: "100%", backgroundColor: "#151515", borderRadius: 14, padding: 14,
        marginBottom: 20, borderWidth: 1, borderColor: "#2a2a2a",
    },
    loggedListTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
    loggedListSub: { color: "#555", fontSize: 11, marginBottom: 12 },
    loggedItem: {
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
    },
    loggedItemDeleted: { opacity: 0.4 },
    loggedItemName: { color: "#ccc", fontSize: 13, flex: 1 },
    deleteLogBtn: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
    },

    summaryCloseBtn: {
        backgroundColor: "#22c55e", borderRadius: 14,
        paddingVertical: 14, width: "100%", alignItems: "center",
    },
    summaryCloseBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});