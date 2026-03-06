import { useState, useEffect } from 'react';

/**
 * Hook to manage loading state of OpenCV.js script loaded via CDN
 * @returns {{ loaded: boolean, cv: any|null }}
 */
export function useOpenCV() {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // If it's already on the window object and ready
        if (window.cv && window.cv.Mat) {
            setLoaded(true);
            return;
        }

        // Wait for it to be ready
        const checkOpenCV = () => {
            if (window.cv && typeof window.cv.onRuntimeInitialized === 'undefined') {
                // Sometime cv is defined but not ready yet. 
                // We'll wait until cv object has core classes like Mat.
                if (window.cv.Mat) {
                    setLoaded(true);
                } else {
                    setTimeout(checkOpenCV, 100);
                }
                return;
            }

            if (window.cv) {
                // Intercept the onRuntimeInitialized callback
                const originalOnRuntimeInitialized = window.cv.onRuntimeInitialized;
                window.cv.onRuntimeInitialized = () => {
                    if (originalOnRuntimeInitialized) {
                        originalOnRuntimeInitialized();
                    }
                    setLoaded(true);
                };
            } else {
                // The script hasn't even created the window.cv object yet
                setTimeout(checkOpenCV, 100);
            }
        };

        checkOpenCV();

        return () => {
            // cleanup if needed
        };
    }, []);

    return {
        loaded,
        cv: loaded ? window.cv : null
    };
}

export default useOpenCV;
