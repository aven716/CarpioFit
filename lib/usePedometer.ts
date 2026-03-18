import { Pedometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

const STEP_GOAL = 10000;
const STRIDE_LENGTH_KM = 0.000762;
const CALORIES_PER_STEP = 0.04;

export function usePedometer() {
    const [steps, setSteps] = useState(0);
    const [isAvailable, setIsAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const baselineSteps = useRef<number | null>(null);

    const distanceKm = parseFloat((steps * STRIDE_LENGTH_KM).toFixed(2));
    const caloriesBurned = parseFloat((steps * CALORIES_PER_STEP).toFixed(1));
    const goalProgress = Math.min((steps / STEP_GOAL) * 100, 100);

    useEffect(() => {
        let subscription: any;

        const start = async () => {
            // Request permission on Android first
    
            if (Platform.OS === "android") {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
                );
                console.log("Permission result:", granted); // <- only change
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.log("Activity recognition permission denied");
                    setIsLoading(false);
                    return;
                }
            }
            const available = await Pedometer.isAvailableAsync();
            console.log("Pedometer available:", available);
            setIsAvailable(available);
            setIsLoading(false);

            if (!available) return;

            subscription = Pedometer.watchStepCount((result) => {
                console.log("Step count result:", result.steps);

                if (baselineSteps.current === null) {
                    baselineSteps.current = result.steps;
                }

                const stepsSinceStart = result.steps - baselineSteps.current;
                setSteps(stepsSinceStart);
            });
        };

        start();

        return () => {
            if (subscription) subscription.remove();
            baselineSteps.current = null;
        };
    }, []);

    return {
        steps,
        distanceKm,
        caloriesBurned,
        goalProgress,
        isAvailable,
        isLoading,
        stepGoal: STEP_GOAL,
    };
}