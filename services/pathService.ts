
import { MapGraph } from '../types';

/**
 * ============================================================================
 * BACKEND API SPECIFICATION & DATA CONTRACT
 * ============================================================================
 * 
 * To ensure the frontend renders navigation paths correctly, the backend 
 * must adhere to the following contract.
 * 
 * ----------------------------------------------------------------------------
 * 1. REQUEST SPECIFICATION
 * ----------------------------------------------------------------------------
 * Endpoint: POST /api/v1/navigation/calculate-path
 * Content-Type: application/json
 * Payload: 
 * {
 *   "sourceId": "node-unique-id-1",
 *   "targetId": "node-unique-id-2",
 *   "graph": { ... } // Optional: only if the backend doesn't persist the graph
 * }
 * 
 * ----------------------------------------------------------------------------
 * 2. EXPECTED RESPONSE TYPE (SUCCESS)
 * ----------------------------------------------------------------------------
 * Type: string[] 
 * Description: A flat, ordered array containing the unique 'id' of each node 
 *              along the optimal path.
 * 
 * Why string[]? 
 * - The frontend maps these IDs back to its internal coordinate system.
 * - Order is critical: The path is rendered by connecting index [i] to [i+1].
 * 
 * JSON Example:
 * [
 *   "node-1", 
 *   "node-5", 
 *   "node-12", 
 *   "node-target"
 * ]
 * 
 * ----------------------------------------------------------------------------
 * 3. EXPECTED RESPONSE TYPE (FAILURE/NO PATH)
 * ----------------------------------------------------------------------------
 * Status: 200 OK (with empty array) OR 404 Not Found
 * Payload: [] 
 * Logic: An empty array tells the frontend to clear any existing active paths.
 * 
 * ----------------------------------------------------------------------------
 * 4. FIELD REQUIREMENTS
 * ----------------------------------------------------------------------------
 * - Node IDs: Must match exactly with the 'id' field in the MapNode objects 
 *             sent or stored in the database.
 * - Weight/Cost: The backend handles the algorithm (Dijkstra/A*), so the 
 *                response doesn't need costs, just the resulting sequence.
 * ============================================================================
 */

export const pathService = {
  /**
   * Fetches an ordered list of node IDs from the backend to represent a path.
   * @param graph The current map graph state
   * @param startId The starting node ID
   * @param endId The target node ID
   * @returns Promise<string[]> An ordered list of node IDs matching the backend contract
   */
  async fetchPath(graph: MapGraph, startId: string, endId: string): Promise<string[]> {
    /**
     * SIMULATION OF API CALL
     * 
     * In a production environment, use fetch or axios:
     * 
     * const response = await fetch('/api/v1/navigation/calculate-path', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ sourceId: startId, targetId: endId, graph })
     * });
     * 
     * if (!response.ok) throw new Error('Network response was not ok');
     * return await response.json(); // Should return string[]
     */

    console.log(`[PathService] Initiating API request: Pathfinding from ${startId} to ${endId}...`);

    // Simulate network delay (1000ms) to reflect real-world latency
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Internal simulation logic (BFS) to find a valid path for demo purposes.
    // The backend should perform this logic using a graph library or custom Dijkstra/A*.
    const queue: [string, string[]][] = [[startId, [startId]]];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const [curr, path] = queue.shift()!;
      if (curr === endId) {
        console.log(`[PathService] Success: Path found with ${path.length} steps.`);
        return path;
      }

      const neighbors = graph.edges
        .filter((e) => e.fromId === curr || e.toId === curr)
        .map((e) => (e.fromId === curr ? e.toId : e.fromId));

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([neighbor, [...path, neighbor]]);
        }
      }
    }

    console.warn(`[PathService] No path found between ${startId} and ${endId}. Returning empty array.`);
    return [];
  },
};
