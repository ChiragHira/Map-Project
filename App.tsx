
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Circle, Line, Text, Group, Rect } from 'react-konva';
import { MapNode, MapEdge, MapGraph, AppMode, NodeType, AppPage } from './types';
import { pathService } from './services/pathService';
import { 
  Plus, 
  MousePointer2, 
  Share2, 
  Trash2, 
  Info,
  Map as MapIcon,
  Download,
  Settings2,
  Maximize,
  Menu,
  X,
  Navigation,
  Eye,
  ArrowLeft,
  RotateCcw,
  Loader2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const INITIAL_GRAPH: MapGraph = {
  nodes: [
    { id: 'node-1', x: 150, y: 150, label: 'Capital City', type: 'city' },
    { id: 'node-2', x: 500, y: 200, label: 'Crystal Mines', type: 'resource' },
    { id: 'node-3', x: 300, y: 450, label: 'Trade Outpost', type: 'checkpoint' },
  ],
  edges: [
    { id: 'edge-1', fromId: 'node-1', toId: 'node-2', weight: 10 },
    { id: 'edge-2', fromId: 'node-2', toId: 'node-3', weight: 15 },
    { id: 'edge-3', fromId: 'node-1', toId: 'node-3', weight: 20 },
  ],
};

// Google Maps inspired colors
const NODE_COLORS: Record<NodeType, string> = {
  city: '#1a73e8',      // Google Blue
  resource: '#34a853',  // Google Green
  checkpoint: '#fbbc04',// Google Yellow
  landmark: '#ea4335'   // Google Red
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>('editor');
  const [graph, setGraph] = useState<MapGraph>(INITIAL_GRAPH);
  const [mode, setMode] = useState<AppMode>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeStartId, setEdgeStartId] = useState<string | null>(null);
  
  // Navigation State
  const [pathStartId, setPathStartId] = useState<string | null>(null);
  const [pathEndId, setPathEndId] = useState<string | null>(null);
  const [activePathNodes, setActivePathNodes] = useState<string[]>([]);
  const [isFetchingPath, setIsFetchingPath] = useState(false);
  
  // UI State
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  const stageRef = useRef<any>(null);

  const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = graph.edges.find(e => e.id === selectedEdgeId);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFetchPath = async () => {
    if (!pathStartId || !pathEndId) return;
    setIsFetchingPath(true);
    setActivePathNodes([]);
    try {
      const path = await pathService.fetchPath(graph, pathStartId, pathEndId);
      setActivePathNodes(path);
    } catch (error) {
      console.error("Backend communication failed", error);
    } finally {
      setIsFetchingPath(false);
    }
  };

  const exportGraph = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graph, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "map_graph.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setGraph(prev => ({
        nodes: prev.nodes.filter(n => n.id !== selectedNodeId),
        edges: prev.edges.filter(e => e.fromId !== selectedNodeId && e.toId !== selectedNodeId)
      }));
      if (edgeStartId === selectedNodeId) setEdgeStartId(null);
      if (pathStartId === selectedNodeId) setPathStartId(null);
      if (pathEndId === selectedNodeId) setPathEndId(null);
      if (activePathNodes.includes(selectedNodeId)) setActivePathNodes([]);
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setGraph(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== selectedEdgeId) }));
      setSelectedEdgeId(null);
      setActivePathNodes([]);
    }
  }, [selectedNodeId, selectedEdgeId, edgeStartId, pathStartId, pathEndId, activePathNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentPage === 'showmap') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && 
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, currentPage]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    const limitedScale = Math.max(0.1, Math.min(newScale, 5));
    setStageScale(limitedScale);
    setStagePos({ x: pointer.x - mousePointTo.x * limitedScale, y: pointer.y - mousePointTo.y * limitedScale });
  };

  const handleStageClick = (e: any) => {
    if (currentPage === 'showmap') return;
    if (e.target.getStage().isDragging()) return;
    if (e.target !== e.target.getStage()) return;
    if (mode === 'add_node') {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      const pos = { x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() };
      const newNode: MapNode = { id: `node-${Date.now()}`, x: pos.x, y: pos.y, label: `Node ${graph.nodes.length + 1}`, type: 'landmark' };
      setGraph(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    } else {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEdgeStartId(null);
    }
  };

  const handleNodeClick = (id: string) => {
    if (currentPage === 'showmap') return;
    if (mode === 'select') {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      if (windowSize.width < 1024) setIsSidebarOpen(true);
    } else if (mode === 'add_edge') {
      if (!edgeStartId) setEdgeStartId(id);
      else if (edgeStartId !== id) {
        const exists = graph.edges.some(e => (e.fromId === edgeStartId && e.toId === id) || (e.fromId === id && e.toId === edgeStartId));
        if (!exists) setGraph(prev => ({ ...prev, edges: [...prev.edges, { id: `edge-${Date.now()}`, fromId: edgeStartId, toId: id, weight: 1 }] }));
        setEdgeStartId(null);
      }
    } else if (mode === 'pathfinding') {
      if (!pathStartId) setPathStartId(id);
      else if (!pathEndId) setPathEndId(id);
      else { setPathStartId(id); setPathEndId(null); setActivePathNodes([]); }
    }
  };

  const renderMapContent = () => {
    const isPathNode = (id: string) => activePathNodes.includes(id);
    const isPathEdge = (edge: MapEdge) => {
      if (activePathNodes.length < 2) return false;
      for (let i = 0; i < activePathNodes.length - 1; i++) {
        const u = activePathNodes[i], v = activePathNodes[i+1];
        if ((edge.fromId === u && edge.toId === v) || (edge.fromId === v && edge.toId === u)) return true;
      }
      return false;
    };

    return (
      <Layer>
        {graph.edges.map(edge => {
          const from = graph.nodes.find(n => n.id === edge.fromId), to = graph.nodes.find(n => n.id === edge.toId);
          if (!from || !to) return null;
          const onPath = isPathEdge(edge), isSelected = selectedEdgeId === edge.id;
          return (
            <Group key={edge.id} onClick={(e) => { if (currentPage === 'editor') { e.cancelBubble = true; setSelectedEdgeId(edge.id); setSelectedNodeId(null); } }}>
              <Line 
                points={[from.x, from.y, to.x, to.y]} 
                stroke={onPath ? "#1a73e8" : isSelected ? "#4285f4" : "#bdc1c6"} 
                strokeWidth={onPath ? 8/stageScale : isSelected ? 4/stageScale : 2/stageScale} 
                opacity={onPath ? 1 : isSelected ? 0.8 : 0.6}
              />
              <Group x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>
                <Rect 
                  x={-16/stageScale} y={-12/stageScale} 
                  width={32/stageScale} height={24/stageScale} 
                  fill="white" 
                  stroke={onPath ? "#1a73e8" : isSelected ? "#4285f4" : "#dadce0"}
                  strokeWidth={1/stageScale}
                  cornerRadius={4/stageScale} 
                />
                <Text 
                  x={-16/stageScale} y={-6/stageScale} 
                  text={`${edge.weight}`} 
                  fill={onPath ? "#1a73e8" : isSelected ? "#4285f4" : "#5f6368"} 
                  fontSize={11/stageScale} 
                  align="center" width={32/stageScale} 
                  fontStyle="bold"
                />
              </Group>
            </Group>
          );
        })}
        {graph.nodes.map(node => {
          const onPath = isPathNode(node.id), isSelected = selectedNodeId === node.id;
          return (
            <Group key={node.id} x={node.x} y={node.y} draggable={mode === 'select' && currentPage === 'editor'} onDragEnd={(e) => setGraph(p => ({ ...p, nodes: p.nodes.map(n => n.id === node.id ? { ...n, x: e.target.x(), y: e.target.y() } : n) }))} onClick={(e) => { e.cancelBubble = true; handleNodeClick(node.id); }}>
              <Circle 
                radius={(onPath || isSelected ? 14 : 10) / stageScale} 
                fill={NODE_COLORS[node.type]} 
                shadowBlur={onPath || isSelected ? 10 : 2} 
                shadowColor="rgba(0,0,0,0.2)"
                stroke="white"
                strokeWidth={2/stageScale}
              />
              <Text 
                x={-60/stageScale} y={18/stageScale} 
                text={node.label} width={120/stageScale} 
                align="center" 
                fill={onPath ? "#1a73e8" : isSelected ? "#1a73e8" : "#3c4043"} 
                fontSize={12/stageScale} 
                fontStyle="bold" 
              />
              {(pathStartId === node.id || pathEndId === node.id) && (
                <Text 
                  x={-20/stageScale} y={-35/stageScale} 
                  text={pathStartId === node.id ? "START" : "END"} 
                  fill="#1a73e8" 
                  fontSize={10/stageScale} 
                  fontStyle="bold" 
                  width={40/stageScale} align="center" 
                />
              )}
            </Group>
          );
        })}
      </Layer>
    );
  };

  // --- SHOW MAP PAGE ---
  if (currentPage === 'showmap') {
    return (
      <div className="flex flex-col h-screen w-full bg-gray-50 text-gray-900 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('editor')} className="flex items-center gap-2 bg-white hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 transition-all active:scale-95 text-gray-700">
              <ArrowLeft size={16} /> <span>Back to Editor</span>
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <h2 className="text-sm md:text-lg font-bold flex items-center gap-2 text-gray-800">
              <ExternalLink size={18} className="text-blue-600" /> Map Preview
            </h2>
          </div>
        </header>
        <main className="flex-1 relative bg-[#f8f9fa]">
          <Stage width={windowSize.width} height={windowSize.height - 64} scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y} draggable onWheel={handleWheel} className="cursor-grab active:cursor-grabbing">
            {renderMapContent()}
          </Stage>
          <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <button onClick={() => setStageScale(s => Math.min(s * 1.2, 5))} className="w-11 h-11 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-gray-600">+</button>
            <button onClick={() => setStageScale(s => Math.max(s / 1.2, 0.1))} className="w-11 h-11 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-gray-600">−</button>
          </div>
        </main>
      </div>
    );
  }

  // --- EDITOR PAGE ---
  return (
    <div className="flex flex-col h-screen w-full bg-[#f8f9fa] text-gray-900 font-sans overflow-hidden">
      <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="bg-blue-600 p-2 rounded-lg">
            <MapIcon size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight hidden sm:block text-gray-800">Cartographer</h1>
        </div>

        <nav className="flex items-center gap-1 md:gap-2 bg-gray-100 p-1 rounded-full border border-gray-200">
          <ModeButton active={mode === 'select'} onClick={() => setMode('select')} icon={<MousePointer2 size={16} />} label="Select" />
          <ModeButton active={mode === 'add_node'} onClick={() => setMode('add_node')} icon={<Plus size={16} />} label="Add" />
          <ModeButton active={mode === 'add_edge'} onClick={() => setMode('add_edge')} icon={<Share2 size={16} />} label="Link" />
          <ModeButton active={mode === 'pathfinding'} onClick={() => setMode('pathfinding')} icon={<Navigation size={16} />} label="Route" />
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage('showmap')} className="hidden sm:flex items-center gap-2 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 active:scale-95 text-gray-700">
            <Eye size={16} /> <span className="hidden lg:inline">Live View</span>
          </button>
          <button onClick={exportGraph} className="bg-blue-600 hover:bg-blue-700 px-4 md:px-5 py-2 rounded-lg font-bold text-xs md:text-sm text-white active:scale-95 flex items-center gap-2 shadow-md">
            <Download size={16} /> <span className="hidden md:inline">Save Map</span>
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        {/* Backdrop for mobile/tablet */}
        {isSidebarOpen && windowSize.width < 1024 && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[55] transition-opacity duration-300" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Container */}
        <aside className={`
          ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0'} 
          fixed lg:relative inset-y-0 left-0 lg:inset-auto h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-[60] overflow-hidden shadow-xl lg:shadow-none
        `}>
          <div className="w-80 flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Properties</h3>
              {mode === 'pathfinding' && (
                <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">NAVIGATION</div>
              )}
            </div>
            
            <div className="flex-1 space-y-6">
              {mode === 'pathfinding' ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-gray-500 font-bold">STARTING POINT</span>
                       <span className={`font-bold ${pathStartId ? 'text-blue-600' : 'text-gray-400 italic'}`}>
                        {pathStartId ? graph.nodes.find(n => n.id === pathStartId)?.label : 'Click node'}
                       </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-gray-500 font-bold">DESTINATION</span>
                       <span className={`font-bold ${pathEndId ? 'text-blue-600' : 'text-gray-400 italic'}`}>
                        {pathEndId ? graph.nodes.find(n => n.id === pathEndId)?.label : 'Click node'}
                       </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleFetchPath} 
                    disabled={isFetchingPath || !pathStartId || !pathEndId} 
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {isFetchingPath ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />} Find Directions
                  </button>

                  {activePathNodes.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-xs text-green-700 font-bold flex items-center gap-3">
                      <ChevronRight size={16} className="shrink-0" /> Path sequence generated.
                    </div>
                  )}
                  
                  <button onClick={() => { setPathStartId(null); setPathEndId(null); setActivePathNodes([]); }} className="w-full bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl text-xs font-bold border border-gray-300 flex items-center justify-center gap-2 transition-all">
                    <RotateCcw size={14} /> Clear Selection
                  </button>
                </div>
              ) : selectedNode ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-left duration-500">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-6 shadow-sm">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Location Name</label>
                      <input type="text" value={selectedNode.label} onChange={(e) => setGraph(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, label: e.target.value } : n) }))} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none text-gray-800 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Category</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['city', 'resource', 'checkpoint', 'landmark'] as NodeType[]).map(t => (
                          <button key={t} onClick={() => setGraph(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, type: t } : n) }))} className={`w-full aspect-square rounded-lg border-2 transition-all ${selectedNode.type === t ? 'border-blue-600 scale-105 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: NODE_COLORS[t] }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={deleteSelected} className="w-full bg-white hover:bg-red-50 text-red-600 py-3 rounded-xl border border-gray-200 hover:border-red-200 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shadow-sm"><Trash2 size={14} /> Remove Node</button>
                </div>
              ) : selectedEdge ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Weight / Cost</label>
                    <input type="number" value={selectedEdge.weight} onChange={(e) => setGraph(prev => ({ ...prev, edges: prev.edges.map(edge => edge.id === selectedEdgeId ? { ...edge, weight: parseInt(e.target.value) || 0 } : edge) }))} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <button onClick={deleteSelected} className="w-full bg-white hover:bg-red-50 text-red-600 py-3 rounded-xl border border-gray-200 hover:border-red-200 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shadow-sm"><Trash2 size={14} /> Sever Link</button>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-gray-300 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <Settings2 size={40} className="mb-4 opacity-50" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center px-10 text-gray-400">Select an item to configure</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-100 text-center">
               <p className="text-[10px] font-bold text-gray-400">Professional Map Designer</p>
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 bg-[#f8f9fa] relative overflow-hidden">
          <Stage 
            ref={stageRef} 
            width={windowSize.width - (isSidebarOpen && windowSize.width >= 1024 ? 320 : 0)} 
            height={windowSize.height - 64} 
            scaleX={stageScale} 
            scaleY={stageScale} 
            x={stagePos.x} 
            y={stagePos.y} 
            draggable={mode === 'select'} 
            onWheel={handleWheel} 
            onClick={handleStageClick} 
            className="cursor-crosshair active:cursor-grabbing"
          >
            {renderMapContent()}
          </Stage>

          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 shadow-lg">
            <button onClick={() => setStageScale(s => Math.min(s * 1.2, 5))} className="w-11 h-11 bg-white hover:bg-gray-50 border border-gray-200 rounded-t-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform text-gray-600 font-bold text-xl">+</button>
            <button onClick={() => { setStageScale(1); setStagePos({x:0,y:0}); }} className="w-11 h-11 bg-white hover:bg-gray-50 border-x border-gray-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform text-blue-600"><Maximize size={18} /></button>
            <button onClick={() => setStageScale(s => Math.max(s / 1.2, 0.1))} className="w-11 h-11 bg-white hover:bg-gray-50 border border-gray-200 rounded-b-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform text-gray-600 font-bold text-xl">−</button>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      ` }} />
    </div>
  );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 transition-all font-bold px-3 md:px-4 py-2 rounded-full border ${
      active 
        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' 
        : 'text-gray-500 border-transparent hover:bg-gray-200 hover:text-gray-700'
    }`}
  >
    {icon} <span className="text-[11px] uppercase tracking-wider hidden lg:inline">{label}</span>
  </button>
);

export default App;
