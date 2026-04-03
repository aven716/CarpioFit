import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, ChevronRight, Navigation, Pause, Play, SkipForward, Square, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    AppState,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { supabase } from "../../lib/supabase";

const { width, height } = Dimensions.get("window");
const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

// ─── Types ────────────────────────────────────
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

interface Coordinate {
    latitude: number;
    longitude: number;
}

// ─── Cardio exercise detection ────────────────
const CARDIO_KEYWORDS = [
    "run", "jog", "sprint", "walk", "hike", "march",
    "cycle", "bike", "cycling", "biking",
    "swim", "swimming",
    "cardio", "hiit", "jump rope", "jumping", "skipping",
    "elliptic", "row", "rowing",
];

function isCardioExercise(name: string): boolean {
    const lower = name.toLowerCase();
    return CARDIO_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Calorie helpers ──────────────────────────
const MET_BY_EXERCISE: Record<string, number> = {
    "push": 8, "pull": 6, "squat": 7, "deadlift": 8, "lunge": 6,
    "run": 10, "jog": 8, "sprint": 12, "jump": 9, "burpee": 10,
    "cardio": 10, "hiit": 10, "cycle": 8, "bike": 8, "swim": 8,
    "row": 7, "plank": 4, "crunch": 5, "sit": 5, "curl": 5,
    "press": 6, "fly": 5, "raise": 4, "dip": 6, "stretch": 3,
    "yoga": 3, "flex": 3, "foam": 2, "walk": 4, "climb": 8,
    "rope": 10, "hike": 6, "march": 5,
};

function getMET(exerciseName: string): number {
    const lower = exerciseName.toLowerCase();
    for (const [keyword, met] of Object.entries(MET_BY_EXERCISE)) {
        if (lower.includes(keyword)) return met;
    }
    return 5;
}

function calculateCaloriesBurned(
    exerciseName: string,
    durationMinutes: number,
    weightKg = 70
): number {
    const met = getMET(exerciseName);
    return Math.round(met * weightKg * (durationMinutes / 60));
}

// ─── Haversine distance (meters) ─────────────
function haversineDistance(a: Coordinate, b: Coordinate): number {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const angle =
        sinDlat * sinDlat +
        Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        sinDlon * sinDlon;
    return R * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(speedMs: number): string {
    if (speedMs < 0.3) return "--:--";
    const paceSec = 1000 / speedMs; // seconds per km
    const m = Math.floor(paceSec / 60);
    const s = Math.round(paceSec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Bernard motivational messages ───────────
const BERNARD_MESSAGES: Record<string, string[]> = {
    chest: ["Chest day! Push like Bernardo Carpio moving mountains! 💪", "Every rep builds the chest of a legend!"],
    back: ["Strong back, strong foundation. Pull hard! 🏔️", "Bernardo Carpio carried mountains — you can carry this set!"],
    legs: ["Leg day separates the legends from the rest! 🦵", "No shortcuts. Every squat counts!"],
    shoulders: ["Shoulders of a warrior! Press it up! ⚔️", "Build those boulders!"],
    "upper arms": ["Biceps and triceps — the pillars of strength!", "Curl like you mean it!"],
    "lower arms": ["Grip strength matters! Hold on tight!", "Forearms of iron!"],
    "upper legs": ["Quads and hamstrings of steel! 🦵", "Leg day never lies!"],
    "lower legs": ["Calves of a mountain climber! Keep going!", "Strong legs carry you further!"],
    waist: ["Core tight, focus sharper! 🎯", "Control the movement!"],
    cardio: ["Heart pumping, legend in the making! 🏃", "Every step counts!", "Bernardo Carpio ran across mountains — keep going!"],
    default: ["Let's go! Bernard believes in you! 💪", "One rep at a time — you've got this!"],
};

function getBernardMessage(bodyPart: string): string {
    const msgs = BERNARD_MESSAGES[bodyPart?.toLowerCase()] ?? BERNARD_MESSAGES.default;
    return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─── ExerciseDB helpers ───────────────────────
function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchExerciseData(name: string): Promise<ExerciseData | null> {
    try {
        const normalized = normalizeName(name);
        const res = await fetch(
            `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(normalized)}?limit=3&offset=0`,
            {
                headers: {
                    "X-RapidAPI-Key": RAPIDAPI_KEY ?? "",
                    "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                },
            }
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            const firstWord = normalized.split(" ")[0];
            if (firstWord === normalized) return null;
            const fb = await fetch(
                `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(firstWord)}?limit=1&offset=0`,
                {
                    headers: {
                        "X-RapidAPI-Key": RAPIDAPI_KEY ?? "",
                        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                    },
                }
            );
            const fbData = await fb.json();
            if (!fbData?.length) return null;
            return buildExerciseData(fbData[0]);
        }
        return buildExerciseData(data[0]);
    } catch {
        return null;
    }
}

function buildExerciseData(ex: any): ExerciseData {
    const gifUrl = ex.gifUrl
        ? ex.gifUrl
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

function inferType(name: string): "strength" | "cardio" | "flexibility" | "rest" {
    const lower = name.toLowerCase();
    if (/run|jog|cycle|bike|swim|cardio|hiit|jump|rope|row|elliptic|sprint|walk|hike/.test(lower)) return "cardio";
    if (/stretch|yoga|flex|mobility|foam/.test(lower)) return "flexibility";
    return "strength";
}

// ─── Muscle Group Fallback ────────────────────
function MuscleGroupIllustration({ bodyPart }: { bodyPart: string }) {
    const emojis: Record<string, string> = {
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
    return (
        <View style={[ws.fallbackBox, { borderColor: (colors[key] ?? colors.default) + "44" }]}>
            <Text style={ws.fallbackEmoji}>{emojis[key] ?? emojis.default}</Text>
            <Text style={[ws.fallbackBodyPart, { color: colors[key] ?? colors.default }]}>
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
        Animated.timing(progressAnim, { toValue: 0, duration: seconds * 1000, useNativeDriver: false }).start();
        const interval = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) { clearInterval(interval); onDone(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

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

// ═══════════════════════════════════════════════
// ─── CARDIO TRACKER ───────────────────────────
// ═══════════════════════════════════════════════
interface CardioResult {
    distanceKm: number;
    durationSeconds: number;
    caloriesBurned: number;
    averageSpeedKmh: number;
    route: Coordinate[];
}

function CardioTracker({
    exercise,
    weightKg,
    onFinish,
    onSkip,
}: {
    exercise: Exercise;
    weightKg: number;
    onFinish: (result: CardioResult) => void;
    onSkip: () => void;
}) {
    const mapRef = useRef<MapView>(null);
    const locationSub = useRef<Location.LocationSubscription | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef(AppState.currentState);

    const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "loading">("loading");
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    const [route, setRoute] = useState<Coordinate[]>([]);
    const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [currentSpeedMs, setCurrentSpeedMs] = useState(0);

    // Track distance across pauses
    const lastCoordRef = useRef<Coordinate | null>(null);
    const isPausedRef = useRef(false);

    const caloriesBurned = calculateCaloriesBurned(
        exercise.name,
        elapsedSeconds / 60,
        weightKg
    );

    // ─── Request location permission ─────────
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setLocationPermission("denied");
                return;
            }
            setLocationPermission("granted");

            // Get initial position to center map
            try {
                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setCurrentLocation(coord);
            } catch { /* ignore */ }
        })();

        // Handle app going to background
        const sub = AppState.addEventListener("change", (nextState) => {
            appStateRef.current = nextState;
        });

        return () => {
            sub.remove();
            stopTracking();
        };
    }, []);

    // ─── Timer ───────────────────────────────
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (!isPausedRef.current) {
                setElapsedSeconds((s) => s + 1);
            }
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // ─── Location subscription ────────────────
    const startLocationTracking = useCallback(async () => {
        if (locationSub.current) {
            locationSub.current.remove();
            locationSub.current = null;
        }

        locationSub.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 2000,        // every 2 seconds
                distanceInterval: 5,        // or every 5 meters
            },
            (loc) => {
                if (isPausedRef.current) return;

                const coord: Coordinate = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
                const speed = loc.coords.speed ?? 0;
                setCurrentSpeedMs(Math.max(0, speed));
                setCurrentLocation(coord);

                // Accumulate distance
                if (lastCoordRef.current) {
                    const d = haversineDistance(lastCoordRef.current, coord);
                    // Filter GPS jitter: ignore jumps < 1m or > 50m per 2s
                    if (d > 1 && d < 100) {
                        setDistanceMeters((prev) => prev + d);
                    }
                }
                lastCoordRef.current = coord;

                setRoute((prev) => {
                    const updated = [...prev, coord];
                    // Animate map to follow
                    mapRef.current?.animateToRegion(
                        {
                            latitude: coord.latitude,
                            longitude: coord.longitude,
                            latitudeDelta: 0.003,
                            longitudeDelta: 0.003,
                        },
                        300
                    );
                    return updated;
                });
            }
        );
    }, []);

    const stopTracking = useCallback(() => {
        locationSub.current?.remove();
        locationSub.current = null;
        stopTimer();
    }, [stopTimer]);

    // ─── Controls ────────────────────────────
    const handleStart = async () => {
        setHasStarted(true);
        setIsTracking(true);
        setIsPaused(false);
        isPausedRef.current = false;
        lastCoordRef.current = currentLocation;
        await startLocationTracking();
        startTimer();
    };

    const handlePause = () => {
        setIsPaused(true);
        isPausedRef.current = true;
    };

    const handleResume = () => {
        setIsPaused(false);
        isPausedRef.current = false;
        lastCoordRef.current = null; // reset to avoid gap-distance spike
    };

    const handleFinish = () => {
        Alert.alert(
            "Finish Cardio?",
            `You've covered ${(distanceMeters / 1000).toFixed(2)} km in ${formatDuration(elapsedSeconds)}.`,
            [
                { text: "Keep Going", style: "cancel" },
                {
                    text: "Finish",
                    onPress: () => {
                        stopTracking();
                        const avgSpeedKmh = elapsedSeconds > 0
                            ? (distanceMeters / 1000) / (elapsedSeconds / 3600)
                            : 0;
                        onFinish({
                            distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
                            durationSeconds: elapsedSeconds,
                            caloriesBurned,
                            averageSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
                            route,
                        });
                    },
                },
            ]
        );
    };

    const distanceKm = distanceMeters / 1000;
    const speedKmh = currentSpeedMs * 3.6;
    const pace = formatPace(currentSpeedMs);

    // ─── Permission Denied ────────────────────
    if (locationPermission === "denied") {
        return (
            <View style={ct.permissionBox}>
                <Text style={ct.permissionEmoji}>📍</Text>
                <Text style={ct.permissionTitle}>Location Required</Text>
                <Text style={ct.permissionSub}>
                    CarpioFit needs location access to track your route and distance.
                    Please enable it in Settings.
                </Text>
                <TouchableOpacity style={ct.skipCardioBtn} onPress={onSkip}>
                    <Text style={ct.skipCardioBtnText}>Skip Cardio Tracking</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─── Loading ──────────────────────────────
    if (locationPermission === "loading") {
        return (
            <View style={ct.permissionBox}>
                <Text style={ct.permissionEmoji}>⏳</Text>
                <Text style={ct.permissionTitle}>Getting your location...</Text>
            </View>
        );
    }

    return (
        <View style={ct.container}>
            {/* ── Map ── */}
            <View style={ct.mapWrapper}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_DEFAULT}
                    style={ct.map}
                    initialRegion={
                        currentLocation
                            ? {
                                latitude: currentLocation.latitude,
                                longitude: currentLocation.longitude,
                                latitudeDelta: 0.008,
                                longitudeDelta: 0.008,
                            }
                            : {
                                // Default: Manila, Philippines
                                latitude: 14.5995,
                                longitude: 120.9842,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }
                    }
                    showsUserLocation
                    followsUserLocation={isTracking && !isPaused}
                    showsMyLocationButton={false}
                    mapType="standard"
                    userInterfaceStyle="dark"
                >
                    {/* Route polyline */}
                    {route.length > 1 && (
                        <Polyline
                            coordinates={route}
                            strokeColor="#22c55e"
                            strokeWidth={4}
                            lineDashPattern={undefined}
                        />
                    )}
                    {/* Start marker */}
                    {route.length > 0 && (
                        <Marker coordinate={route[0]} anchor={{ x: 0.5, y: 0.5 }}>
                            <View style={ct.startMarker}>
                                <Text style={ct.startMarkerText}>S</Text>
                            </View>
                        </Marker>
                    )}
                </MapView>

                {/* Overlay: exercise name + skip */}
                <View style={ct.mapTopOverlay}>
                    <View style={ct.exerciseNameBadge}>
                        <Text style={ct.exerciseNameBadgeText}>
                            {exercise.name}
                            {exercise.duration ? `  •  ${exercise.duration}` : ""}
                        </Text>
                    </View>
                    <TouchableOpacity style={ct.skipOverlayBtn} onPress={onSkip}>
                        <SkipForward size={16} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Tracking pill */}
                {isTracking && (
                    <View style={[ct.trackingPill, isPaused && ct.trackingPillPaused]}>
                        <View style={[ct.trackingDot, isPaused && ct.trackingDotPaused]} />
                        <Text style={[ct.trackingText, isPaused && ct.trackingTextPaused]}>
                            {isPaused ? "PAUSED" : "TRACKING"}
                        </Text>
                    </View>
                )}
            </View>

            {/* ── Stats Panel ── */}
            <View style={ct.statsPanel}>
                {/* Timer row */}
                <View style={ct.timerRow}>
                    <Text style={ct.timerValue}>{formatDuration(elapsedSeconds)}</Text>
                    <Text style={ct.timerLabel}>elapsed</Text>
                </View>

                {/* 3-stat grid */}
                <View style={ct.statsGrid}>
                    <View style={ct.statBox}>
                        <Text style={ct.statVal}>{distanceKm.toFixed(2)}</Text>
                        <Text style={ct.statUnit}>km</Text>
                    </View>
                    <View style={[ct.statBox, ct.statBoxCenter]}>
                        <Text style={[ct.statVal, { color: "#3b82f6" }]}>
                            {speedKmh.toFixed(1)}
                        </Text>
                        <Text style={ct.statUnit}>km/h</Text>
                    </View>
                    <View style={ct.statBox}>
                        <Text style={[ct.statVal, { color: "#f97316" }]}>{caloriesBurned}</Text>
                        <Text style={ct.statUnit}>kcal</Text>
                    </View>
                </View>

                {/* Pace */}
                <View style={ct.paceRow}>
                    <Text style={ct.paceLabel}>Pace</Text>
                    <Text style={ct.paceValue}>{pace} /km</Text>
                </View>

                {/* Controls */}
                <View style={ct.controls}>
                    {!hasStarted ? (
                        <TouchableOpacity style={ct.startBtn} onPress={handleStart}>
                            <Play size={24} color="#fff" fill="#fff" />
                            <Text style={ct.startBtnText}>Start</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={ct.activeControls}>
                            {/* Pause / Resume */}
                            <TouchableOpacity
                                style={ct.pauseBtn}
                                onPress={isPaused ? handleResume : handlePause}
                            >
                                {isPaused
                                    ? <Play size={22} color="#22c55e" fill="#22c55e" />
                                    : <Pause size={22} color="#fff" fill="#fff" />
                                }
                                <Text style={[ct.pauseBtnText, isPaused && { color: "#22c55e" }]}>
                                    {isPaused ? "Resume" : "Pause"}
                                </Text>
                            </TouchableOpacity>

                            {/* Finish */}
                            <TouchableOpacity style={ct.finishBtn} onPress={handleFinish}>
                                <Square size={20} color="#fff" fill="#fff" />
                                <Text style={ct.finishBtnText}>Finish</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Bernard message */}
                <View style={ct.bernardRow}>
                    <Text style={ct.bernardEmoji}>🤖</Text>
                    <Text style={ct.bernardText}>
                        {!hasStarted
                            ? "Tap Start when you're ready. Your route will be tracked live! 🗺️"
                            : isPaused
                                ? "Take a breather! Bernardo Carpio would approve. 💪"
                                : distanceKm < 0.5
                                    ? "Just getting started — keep that pace! 🏃"
                                    : distanceKm < 1
                                        ? `${distanceKm.toFixed(2)} km done! You're building momentum! 🔥`
                                        : `${distanceKm.toFixed(2)} km — Bernardo would be proud! 🏔️`
                        }
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ─── Cardio Summary overlay ───────────────────
function CardioSummaryCard({
    result,
    exerciseName,
    onContinue,
}: {
    result: CardioResult;
    exerciseName: string;
    onContinue: () => void;
}) {
    return (
        <View style={ct.cardioSummaryOverlay}>
            <View style={ct.cardioSummaryCard}>
                <Text style={ct.cardioSummaryEmoji}>🏅</Text>
                <Text style={ct.cardioSummaryTitle}>Cardio Complete!</Text>
                <Text style={ct.cardioSummaryExName}>{exerciseName}</Text>

                <View style={ct.cardioSummaryGrid}>
                    <View style={ct.cardioSummaryStat}>
                        <Text style={ct.cardioSummaryVal}>{result.distanceKm.toFixed(2)}</Text>
                        <Text style={ct.cardioSummaryUnit}>km</Text>
                    </View>
                    <View style={ct.cardioSummaryStat}>
                        <Text style={[ct.cardioSummaryVal, { color: "#3b82f6" }]}>
                            {formatDuration(result.durationSeconds)}
                        </Text>
                        <Text style={ct.cardioSummaryUnit}>time</Text>
                    </View>
                    <View style={ct.cardioSummaryStat}>
                        <Text style={[ct.cardioSummaryVal, { color: "#f97316" }]}>
                            {result.caloriesBurned}
                        </Text>
                        <Text style={ct.cardioSummaryUnit}>kcal</Text>
                    </View>
                    <View style={ct.cardioSummaryStat}>
                        <Text style={[ct.cardioSummaryVal, { color: "#a855f7" }]}>
                            {result.averageSpeedKmh}
                        </Text>
                        <Text style={ct.cardioSummaryUnit}>km/h avg</Text>
                    </View>
                </View>

                <TouchableOpacity style={ct.continueBtn} onPress={onContinue}>
                    <Text style={ct.continueBtnText}>Continue Workout</Text>
                    <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
            </View>
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
    totalDistanceKm,
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
    totalDistanceKm: number;
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

                    {/* Distance badge if any cardio was done */}
                    {totalDistanceKm > 0 && (
                        <View style={ws.distanceBadge}>
                            <Navigation size={16} color="#22c55e" />
                            <Text style={ws.distanceBadgeText}>
                                {totalDistanceKm.toFixed(2)} km tracked
                            </Text>
                        </View>
                    )}

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

// ═══════════════════════════════════════════════
// ─── MAIN SESSION SCREEN ──────────────────────
// ═══════════════════════════════════════════════
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

    const [userWeightKg, setUserWeightKg] = useState(70);
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
    const [totalCaloriesBurned, setTotalCaloriesBurned] = useState(0);
    const [totalActiveMinutes, setTotalActiveMinutes] = useState(0);
    const [totalDistanceKm, setTotalDistanceKm] = useState(0);

    // Cardio tracker state
    const [showCardioTracker, setShowCardioTracker] = useState(false);
    const [pendingCardioResult, setPendingCardioResult] = useState<CardioResult | null>(null);
    const [showCardioSummary, setShowCardioSummary] = useState(false);

    // Accumulated workout data (for exercises completed before final finish)
    const accumulatedRows = useRef<any[]>([]);

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const currentExercise = exercises[currentIndex];
    const totalSets = currentExercise?.sets > 0 ? currentExercise.sets : 1;

    // Load user weight for calorie calcs
    useEffect(() => {
        if (!userId) return;
        supabase
            .from("profiles")
            .select("weight_kg")
            .eq("id", userId)
            .single()
            .then(({ data }) => {
                if (data?.weight_kg) setUserWeightKg(Number(data.weight_kg));
            });
    }, [userId]);

    useEffect(() => {
        if (!currentExercise) return;

        // If it's a cardio exercise, show the tracker instead of the normal view
        if (isCardioExercise(currentExercise.name)) {
            setShowCardioTracker(true);
            setBernardMsg(getBernardMessage("cardio"));
        } else {
            setShowCardioTracker(false);
            loadExerciseData();
        }
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

    // ─── Cardio finished ─────────────────────
    const handleCardioFinish = (result: CardioResult) => {
        setPendingCardioResult(result);
        setShowCardioTracker(false);
        setShowCardioSummary(true);
        setCompletedExercises((prev) => new Set([...prev, currentIndex]));

        // Accumulate the cardio row
        const durationMin = Math.round(result.durationSeconds / 60);
        accumulatedRows.current.push({
            user_id: userId,
            date: dateStr,
            name: currentExercise.name,
            type: "cardio",
            duration_minutes: durationMin || 1,
            calories_burned: result.caloriesBurned,
            distance_km: result.distanceKm,
            completed: true,
        });
    };

    const handleCardioSummaryContinue = () => {
        setShowCardioSummary(false);
        setPendingCardioResult(null);
        moveToNext();
    };

    const handleCardioSkip = () => {
        setSkippedExercises((prev) => new Set([...prev, currentIndex]));
        setShowCardioTracker(false);
        animateTransition(() => moveToNext());
    };

    // ─── Strength exercise controls ───────────
    const handleNextSet = () => {
        if (currentSet < totalSets) {
            setShowRest(true);
        } else {
            setCompletedExercises((prev) => new Set([...prev, currentIndex]));
            // Accumulate strength row
            const durationMin = currentExercise.duration
                ? parseInt(currentExercise.duration.replace(/[^0-9]/g, "")) || 30
                : totalSets * 3;
            accumulatedRows.current.push({
                user_id: userId,
                date: dateStr,
                name: currentExercise.name,
                type: inferType(currentExercise.name),
                duration_minutes: durationMin,
                calories_burned: calculateCaloriesBurned(currentExercise.name, durationMin, userWeightKg),
                completed: true,
            });
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
        let totalCal = 0;
        let totalMin = 0;
        let totalDist = 0;

        try {
            if (accumulatedRows.current.length > 0 && userId) {
                const { data, error } = await supabase
                    .from("workouts")
                    .insert(accumulatedRows.current)
                    .select("id, name, calories_burned, duration_minutes, distance_km");

                if (!error && data) {
                    data.forEach((w) => {
                        ids.push(`${w.id}||${w.name}`);
                        totalCal += Number(w.calories_burned) || 0;
                        totalMin += Number(w.duration_minutes) || 0;
                        totalDist += Number(w.distance_km) || 0;
                    });
                }

                // Update daily_stats
                if (totalCal > 0 || totalMin > 0) {
                    const { data: existing } = await supabase
                        .from("daily_stats")
                        .select("calories_burned, active_minutes, distance_km")
                        .eq("user_id", userId)
                        .eq("date", dateStr)
                        .single();

                    await supabase.from("daily_stats").upsert({
                        user_id: userId,
                        date: dateStr,
                        calories_burned: (Number(existing?.calories_burned) || 0) + totalCal,
                        active_minutes: (Number(existing?.active_minutes) || 0) + totalMin,
                        distance_km: (Number(existing?.distance_km) || 0) + totalDist,
                    }, { onConflict: "user_id,date" });
                }
            }
        } catch (err) {
            console.warn("Auto-log failed:", err);
        }

        setLoggedWorkoutIds(ids);
        setTotalCaloriesBurned(Math.round(totalCal));
        setTotalActiveMinutes(Math.round(totalMin));
        setTotalDistanceKm(Math.round(totalDist * 100) / 100);
        setShowSummary(true);
    };

    const handleQuit = () => {
        Alert.alert("Quit Workout?", "Your progress so far won't be saved.", [
            { text: "Keep Going", style: "cancel" },
            { text: "Quit", style: "destructive", onPress: () => router.back() },
        ]);
    };

    // ─── Render: Summary ─────────────────────
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
                totalDistanceKm={totalDistanceKm}
                onClose={() => router.back()}
            />
        );
    }

    // ─── Render: Cardio Summary ───────────────
    if (showCardioSummary && pendingCardioResult) {
        return (
            <CardioSummaryCard
                result={pendingCardioResult}
                exerciseName={currentExercise?.name ?? "Cardio"}
                onContinue={handleCardioSummaryContinue}
            />
        );
    }

    // ─── Render: No exercises ─────────────────
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

    // ─── Render: Cardio Tracker ───────────────
    if (showCardioTracker) {
        return (
            <View style={ws.container}>
                <StatusBar style="light" />

                {/* Mini header */}
                <View style={ws.header}>
                    <TouchableOpacity style={ws.quitBtn} onPress={handleQuit}>
                        <X size={20} color="#888" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={ws.headerFocus}>{focus}</Text>
                        <Text style={ws.headerDay}>{dayName}</Text>
                    </View>
                    {/* empty spacer */}
                    <View style={{ width: 36 }} />
                </View>

                {/* Progress bar */}
                <View style={ws.progressBarTrack}>
                    <View style={[ws.progressBarFill, { width: `${(currentIndex / exercises.length) * 100}%` }]} />
                </View>
                <Text style={ws.progressLabel}>
                    Exercise {currentIndex + 1} of {exercises.length} • Cardio 🏃
                </Text>

                <CardioTracker
                    exercise={currentExercise}
                    weightKg={userWeightKg}
                    onFinish={handleCardioFinish}
                    onSkip={handleCardioSkip}
                />
            </View>
        );
    }

    // ─── Render: Normal Exercise ──────────────
    const progressPercent = (currentIndex / exercises.length) * 100;

    return (
        <View style={ws.container}>
            <StatusBar style="light" />

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
                            {currentExercise.reps && <Text style={ws.repsLabel}>{currentExercise.reps} reps</Text>}
                            {currentExercise.duration && <Text style={ws.repsLabel}>{currentExercise.duration}</Text>}
                        </View>
                    )}

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

                    {/* Bernard */}
                    {!showRest && (
                        <View style={ws.bernardBox}>
                            <Text style={ws.bernardEmoji}>🤖</Text>
                            <Text style={ws.bernardText}>{bernardMsg}</Text>
                        </View>
                    )}

                    {/* Next button */}
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

                    {/* Dots */}
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

// ─── Cardio Tracker Styles ─────────────────────
const ct = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },

    // Permission
    permissionBox: {
        flex: 1, alignItems: "center", justifyContent: "center",
        padding: 32, backgroundColor: "#0a0a0a",
    },
    permissionEmoji: { fontSize: 56, marginBottom: 16 },
    permissionTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 10, textAlign: "center" },
    permissionSub: { color: "#888", fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 24 },
    skipCardioBtn: {
        borderWidth: 1, borderColor: "#333", borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 24,
    },
    skipCardioBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },

    // Map
    mapWrapper: { flex: 1, position: "relative" },
    map: { width: "100%", height: "100%" },
    mapTopOverlay: {
        position: "absolute", top: 12, left: 12, right: 12,
        flexDirection: "row", alignItems: "center", gap: 10,
    },
    exerciseNameBadge: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
    },
    exerciseNameBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    skipOverlayBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: "rgba(0,0,0,0.72)",
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#333",
    },
    trackingPill: {
        position: "absolute", top: 56, alignSelf: "center",
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "rgba(34,197,94,0.9)", borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 6,
    },
    trackingPillPaused: { backgroundColor: "rgba(249,115,22,0.9)" },
    trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
    trackingDotPaused: { backgroundColor: "#fff" },
    trackingText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    trackingTextPaused: { color: "#fff" },
    startMarker: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center",
        borderWidth: 2, borderColor: "#fff",
    },
    startMarkerText: { color: "#fff", fontSize: 12, fontWeight: "800" },

    // Stats panel
    statsPanel: {
        backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 12,
        borderTopWidth: 1, borderTopColor: "#2a2a2a",
    },
    timerRow: { alignItems: "center", marginBottom: 16 },
    timerValue: { color: "#fff", fontSize: 44, fontWeight: "800", fontVariant: ["tabular-nums"] },
    timerLabel: { color: "#555", fontSize: 12, marginTop: 2 },
    statsGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
    statBox: {
        flex: 1, backgroundColor: "#1a1a1a", borderRadius: 14, padding: 12,
        alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a",
    },
    statBoxCenter: {
        borderColor: "rgba(59,130,246,0.2)", backgroundColor: "rgba(59,130,246,0.05)",
    },
    statVal: { color: "#22c55e", fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
    statUnit: { color: "#555", fontSize: 11, marginTop: 2 },
    paceRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
        marginBottom: 14, borderWidth: 1, borderColor: "#2a2a2a",
    },
    paceLabel: { color: "#888", fontSize: 13 },
    paceValue: { color: "#fff", fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },

    // Controls
    controls: { marginBottom: 14 },
    startBtn: {
        backgroundColor: "#22c55e", borderRadius: 16, paddingVertical: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    startBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
    activeControls: { flexDirection: "row", gap: 10 },
    pauseBtn: {
        flex: 1, backgroundColor: "#1a1a1a", borderRadius: 14, paddingVertical: 14,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        borderWidth: 1, borderColor: "#2a2a2a",
    },
    pauseBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    finishBtn: {
        flex: 1, backgroundColor: "#ef4444", borderRadius: 14, paddingVertical: 14,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    finishBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

    // Bernard
    bernardRow: {
        flexDirection: "row", alignItems: "flex-start", gap: 8,
        backgroundColor: "rgba(34,197,94,0.05)", borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: "rgba(34,197,94,0.1)",
    },
    bernardEmoji: { fontSize: 18, flexShrink: 0 },
    bernardText: { color: "#22c55e", fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },

    // Cardio Summary overlay
    cardioSummaryOverlay: {
        flex: 1, backgroundColor: "#0a0a0a",
        justifyContent: "center", alignItems: "center", padding: 24,
    },
    cardioSummaryCard: {
        backgroundColor: "#111", borderRadius: 24, padding: 28,
        width: "100%", alignItems: "center",
        borderWidth: 1, borderColor: "#2a2a2a",
    },
    cardioSummaryEmoji: { fontSize: 56, marginBottom: 12 },
    cardioSummaryTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
    cardioSummaryExName: { color: "#555", fontSize: 13, marginBottom: 20, textTransform: "capitalize" },
    cardioSummaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, width: "100%" },
    cardioSummaryStat: {
        width: "47%", backgroundColor: "#1a1a1a", borderRadius: 14,
        padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a",
    },
    cardioSummaryVal: { color: "#22c55e", fontSize: 24, fontWeight: "800" },
    cardioSummaryUnit: { color: "#555", fontSize: 11, marginTop: 4 },
    continueBtn: {
        backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14,
        width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    continueBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// ─── Workout Session Styles ───────────────────
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
    fallbackBox: { alignItems: "center", justifyContent: "center", flex: 1, width: "100%", borderWidth: 1, borderRadius: 20, gap: 8 },
    fallbackEmoji: { fontSize: 72 },
    fallbackBodyPart: { fontSize: 18, fontWeight: "700" },
    fallbackSub: { color: "#444", fontSize: 12 },
    infoBox: { marginBottom: 16 },
    exerciseName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 10, textTransform: "capitalize" },
    muscleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    musclePill: { backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
    musclePillText: { color: "#22c55e", fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
    setsBox: { backgroundColor: "#111", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a" },
    setsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    setDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#333" },
    setDotDone: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    setDotActive: { backgroundColor: "rgba(34,197,94,0.3)", borderColor: "#22c55e", width: 16, height: 16, borderRadius: 8 },
    setLabel: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
    repsLabel: { color: "#22c55e", fontSize: 28, fontWeight: "800" },
    restTimerBox: { backgroundColor: "#111", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" },
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
    bernardBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(34,197,94,0.06)", borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "rgba(34,197,94,0.12)" },
    bernardEmoji: { fontSize: 24, flexShrink: 0 },
    bernardText: { color: "#22c55e", fontSize: 13, lineHeight: 20, flex: 1, fontStyle: "italic" },
    nextBtn: { backgroundColor: "#22c55e", borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 },
    navDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2a2a2a" },
    navDotActive: { backgroundColor: "#22c55e", width: 20, borderRadius: 4 },
    navDotDone: { backgroundColor: "#22c55e" },
    navDotSkipped: { backgroundColor: "#f97316" },
    summaryContainer: { flex: 1, backgroundColor: "#0a0a0a" },
    summaryScroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
    summaryCard: { backgroundColor: "#111", borderRadius: 24, padding: 28, width: "100%", alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
    summaryEmoji: { fontSize: 64, marginBottom: 12 },
    summaryTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 4 },
    summarySub: { color: "#555", fontSize: 14, marginBottom: 24 },
    summaryStats: { flexDirection: "row", gap: 20, marginBottom: 20 },
    summaryStat: { alignItems: "center" },
    summaryStatVal: { color: "#22c55e", fontSize: 28, fontWeight: "800" },
    summaryStatLabel: { color: "#555", fontSize: 12, marginTop: 2 },
    distanceBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
    distanceBadgeText: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
    summaryMsgBox: { backgroundColor: "rgba(34,197,94,0.06)", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.15)", width: "100%" },
    summaryMsg: { color: "#22c55e", fontSize: 14, lineHeight: 22, textAlign: "center", fontStyle: "italic" },
    loggedListBox: { width: "100%", backgroundColor: "#151515", borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#2a2a2a" },
    loggedListTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
    loggedListSub: { color: "#555", fontSize: 11, marginBottom: 12 },
    loggedItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
    loggedItemDeleted: { opacity: 0.4 },
    loggedItemName: { color: "#ccc", fontSize: 13, flex: 1 },
    deleteLogBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
    summaryCloseBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, width: "100%", alignItems: "center" },
    summaryCloseBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});