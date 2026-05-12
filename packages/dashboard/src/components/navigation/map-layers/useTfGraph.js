import { useEffect, useRef } from 'react';
import { SimpleTfGraph } from '../../../utils/SimpleTfGraph';

export function useTfGraph(ros) {
    const tfGraphRef = useRef(null);

    useEffect(() => {
        if (!ros) return;

        // Initialize SimpleTfGraph
        const tfGraph = new SimpleTfGraph(ros);
        tfGraphRef.current = tfGraph;

        return () => {
            // Proper cleanup to prevent memory leaks
            if (tfGraphRef.current) {
                tfGraphRef.current.destroy();
                tfGraphRef.current = null;
            }
        };
    }, [ros]);

    return tfGraphRef.current;
}
