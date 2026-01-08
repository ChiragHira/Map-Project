
export type NodeType = 'city' | 'resource' | 'checkpoint' | 'landmark';

export interface MapNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: NodeType;
  color?: string;
}

export interface MapEdge {
  id: string;
  fromId: string;
  toId: string;
  weight: number;
  label?: string;
}

export interface MapGraph {
  nodes: MapNode[];
  edges: MapEdge[];
}

export type AppMode = 'select' | 'add_node' | 'add_edge' | 'pathfinding';
export type AppPage = 'editor' | 'showmap';
