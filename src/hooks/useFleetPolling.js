import { useState, useEffect, useCallback, useRef } from 'react';

export const useFleetPolling = (addNotification) => {
    const [robots, setRobots] = useState([]);
    const apiNotificationShownRef = useRef(false);

    const fetchRobotsFromAPI = useCallback(async () => {
        if (document.hidden) return;

        try {
            const fullUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/robots`;
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                addNotification(`⚠️ API status ${response.status}`);
                return;
            }

            const data = await response.json();

            if (data.robots && Array.isArray(data.robots)) {
                const mappedRobots = data.robots.map((robot, index) => ({
                    id: index + 1,
                    name: robot.id.charAt(0).toUpperCase() + robot.id.slice(1),
                    ip: robot.ip,
                    online: robot.status === 'online',
                    status: robot.status,
                    battery_level: robot.battery_level,
                    mode: robot.mode,
                    isBusy: robot.isBusy || false,
                    hasError: robot.has_error || false
                }));

                if (!apiNotificationShownRef.current) {
                    addNotification(`✅ ${mappedRobots.length} robô(s) carregado(s)`);
                    apiNotificationShownRef.current = true;
                }
                setRobots(mappedRobots);
            }
        } catch (error) {
            addNotification(`❌ Erro API: ${error.message}`);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchRobotsFromAPI();
        const interval = setInterval(fetchRobotsFromAPI, 5000);
        return () => clearInterval(interval);
    }, [fetchRobotsFromAPI]);

    return robots;
};
