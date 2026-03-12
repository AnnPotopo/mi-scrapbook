import React, { useState, useCallback, useRef, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage } from '../utils';
import InteractablePhoto from './InteractablePhoto';
import { ArrowLeft, Layers, SmilePlus, ImagePlus, Check, Edit3, X, StickyNote, Calendar, Link as LinkIcon, Loader2, Trash2, ChevronUp, MessageSquareText, MapPin, Edit2, Palette, PenTool, Brush, Music, Hash, Printer, ZoomIn, ZoomOut, Play, Pause, Square, Navigation, Lock, Unlock, Folder, FolderPlus, UploadCloud, RotateCw, Maximize2, Eye, EyeOff } from 'lucide-react';

const CANVAS_BACKGROUNDS = {
    dots: { name: 'Puntos Clásicos', className: 'bg-[#f7f5f0] bg-[radial-gradient(#d1cfc7_2px,transparent_2px)] [background-size:32px_32px]' },
    clean: { name: 'Liso Claro', className: 'bg-[#f7f5f0]' },
    grid: { name: 'Cuadrícula', className: 'bg-[#f7f5f0] bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:2rem_2rem]' },
    lines: { name: 'Libreta Raya', className: 'bg-[#f7f5f0] bg-[linear-gradient(transparent_95%,#cbd5e1_95%)] bg-[length:100%_2rem]' },
    kraft: { name: 'Papel Kraft', className: 'bg-[#d4b595] bg-[url("https://www.transparenttextures.com/patterns/cardboard-flat.png")]' },
    cork: { name: 'Corcho', className: 'bg-[#d2a679] bg-[url("https://www.transparenttextures.com/patterns/cork-board.png")]' },
    blueprint: { name: 'Plano Azul', className: 'bg-[#1e3a8a] bg-[linear-gradient(to_right,#3b82f6_1px,transparent_1px),linear-gradient(to_bottom,#3b82f6_1px,transparent_1px)] bg-[size:2rem_2rem]' },
    dark: { name: 'Noche', className: 'bg-stone-900' }
};

const getLazoPath = (pts, isSmooth) => {
    if (!pts || pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (!isSmooth || pts.length < 3) return `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[0];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;
        const cp1x = p1.x + (p2.x - p0.x) * 0.2;
        const cp1y = p1.y + (p2.y - p0.y) * 0.2;
        const cp2x = p2.x - (p3.x - p1.x) * 0.2;
        const cp2y = p2.y - (p3.y - p1.y) * 0.2;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
};

const CustomAnimations = () => (
    <style>
        {`
        @keyframes anim-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes anim-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes anim-floatX { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(30px); } }
        @keyframes anim-floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }
        @keyframes anim-wiggle { 0%, 100% { transform: rotate(-15deg); } 50% { transform: rotate(15deg); } }
        `}
    </style>
);

// MOTOR DE AGRUPACIÓN
function InteractableGroup({ folder, items, updateMultiplePhotos, isEditMode, isSelected, onSelect, onBringToFront, zoom, isLocked }) {
    const getItemsBoundingBox = (groupItems) => {
        if (!groupItems || groupItems.length === 0) return { x: 0, y: 0, width: 100, height: 100 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        groupItems.forEach(item => {
            const w = item.width || 100;
            const h = item.height || w;
            const cx = item.x + w / 2;
            const cy = item.y + h / 2;
            const rad = (item.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const corners = [
                { dx: -w / 2, dy: -h / 2 }, { dx: w / 2, dy: -h / 2 },
                { dx: -w / 2, dy: h / 2 }, { dx: w / 2, dy: h / 2 }
            ];
            corners.forEach(c => {
                const px = cx + c.dx * cos - c.dy * sin;
                const py = cy + c.dx * sin + c.dy * cos;
                if (px < minX) minX = px;
                if (py < minY) minY = py;
                if (px > maxX) maxX = px;
                if (py > maxY) maxY = py;
            });
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    };

    const [interaction, setInteraction] = useState(null);
    const [localTransform, setLocalTransform] = useState(() => ({ ...getItemsBoundingBox(items), rotation: 0 }));

    const isInteracting = useRef(false);
    const startState = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isInteracting.current) {
            setLocalTransform({ ...getItemsBoundingBox(items), rotation: 0 });
        }
    }, [items]);

    const handlePointerDown = (type, e) => {
        if (!isEditMode || isLocked) return;
        e.stopPropagation();
        e.preventDefault();
        onBringToFront();
        onSelect();

        isInteracting.current = true;
        setInteraction(type);

        startState.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            x: localTransform.x, y: localTransform.y,
            width: localTransform.width, height: localTransform.height,
            rotation: localTransform.rotation,
            bbox: { ...localTransform },
            items: JSON.parse(JSON.stringify(items)),
            centerX: 0, centerY: 0
        };

        if (type === 'rotate' && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            startState.current.centerX = rect.left + rect.width / 2;
            startState.current.centerY = rect.top + rect.height / 2;
        }
    };

    useEffect(() => {
        if (!interaction) return;

        const handlePointerMove = (e) => {
            const s = startState.current;
            const dx = (e.clientX - s.mouseX) / zoom;
            const dy = (e.clientY - s.mouseY) / zoom;

            if (interaction === 'drag') {
                setLocalTransform(prev => ({ ...prev, x: s.x + dx, y: s.y + dy }));
            } else if (interaction === 'resize') {
                const angleRad = s.rotation * (Math.PI / 180);
                const localDx = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
                const localDy = -dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
                const newWidth = Math.max(50, s.width + localDx);
                const newHeight = Math.max(50, s.height + localDy);
                setLocalTransform(prev => ({ ...prev, width: newWidth, height: newHeight }));
            } else if (interaction === 'rotate') {
                const currentAngle = Math.atan2(e.clientY - s.centerY, e.clientX - s.centerX);
                const startAngle = Math.atan2(s.mouseY - s.centerY, s.mouseX - s.centerX);
                const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
                let newRot = s.rotation + angleDiff;
                if (e.shiftKey) newRot = Math.round(newRot / 45) * 45;
                setLocalTransform(prev => ({ ...prev, rotation: newRot }));
            }
        };

        const handlePointerUp = () => {
            setInteraction(null);
            isInteracting.current = false;

            const sBbox = startState.current.bbox;
            const scaleX = localTransform.width / sBbox.width;
            const scaleY = localTransform.height / sBbox.height;
            const dRot = localTransform.rotation;

            const updates = startState.current.items.map(sItem => {
                const iw = sItem.width || 100;
                const ih = sItem.height || iw;
                const icx = sItem.x + iw / 2;
                const icy = sItem.y + ih / 2;
                const bcx = sBbox.x + sBbox.width / 2;
                const bcy = sBbox.y + sBbox.height / 2;

                const sdx = (icx - bcx) * scaleX;
                const sdy = (icy - bcy) * scaleY;
                const rad = dRot * Math.PI / 180;
                const rdx = sdx * Math.cos(rad) - sdy * Math.sin(rad);
                const rdy = sdx * Math.sin(rad) + sdy * Math.cos(rad);

                const n_icx = localTransform.x + localTransform.width / 2 + rdx;
                const n_icy = localTransform.y + localTransform.height / 2 + rdy;
                const n_w = iw * scaleX;
                const n_h = ih * scaleY;

                return {
                    id: sItem.id,
                    data: {
                        x: n_icx - n_w / 2,
                        y: n_icy - n_h / 2,
                        width: n_w,
                        height: n_h,
                        rotation: (sItem.rotation || 0) + dRot
                    }
                };
            });
            updateMultiplePhotos(updates);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [interaction, localTransform, zoom, updateMultiplePhotos]);

    const localItems = items.map(item => {
        if (!isInteracting.current || !startState.current) return item;
        const sItem = startState.current.items.find(i => i.id === item.id);
        const sBbox = startState.current.bbox;
        const scaleX = localTransform.width / sBbox.width;
        const scaleY = localTransform.height / sBbox.height;
        const dRot = localTransform.rotation;

        const iw = sItem.width || 100;
        const ih = sItem.height || iw;
        const icx = sItem.x + iw / 2;
        const icy = sItem.y + ih / 2;
        const bcx = sBbox.x + sBbox.width / 2;
        const bcy = sBbox.y + sBbox.height / 2;

        const sdx = (icx - bcx) * scaleX;
        const sdy = (icy - bcy) * scaleY;
        const rad = dRot * Math.PI / 180;
        const rdx = sdx * Math.cos(rad) - sdy * Math.sin(rad);
        const rdy = sdx * Math.sin(rad) + sdy * Math.cos(rad);

        const n_icx = localTransform.x + localTransform.width / 2 + rdx;
        const n_icy = localTransform.y + localTransform.height / 2 + rdy;
        const n_w = iw * scaleX;
        const n_h = ih * scaleY;

        return { ...item, x: n_icx - n_w / 2, y: n_icy - n_h / 2, width: n_w, height: n_h, rotation: (sItem.rotation || 0) + dRot };
    });

    const maxZ = Math.max(...items.map(i => i.zIndex || 0), 1);

    return (
        <>
            {localItems.map(item => (
                <InteractablePhoto
                    key={item.id} photo={{ ...item, isLocked: item.isLocked || isLocked }}
                    isEditMode={isEditMode} isSelected={false}
                    onSelect={onSelect}
                    onBringToFront={() => { }}
                    onGroupDragStart={isLocked ? null : (e) => handlePointerDown('drag', e)}
                    updatePhoto={() => { }} deletePhoto={() => { }}
                    zoom={zoom}
                />
            ))}

            {isSelected && isEditMode && items.length > 0 && !isLocked && (
                <div
                    ref={containerRef}
                    style={{ position: 'absolute', left: localTransform.x, top: localTransform.y, width: localTransform.width, height: localTransform.height, transform: `rotate(${localTransform.rotation}deg)`, zIndex: maxZ + 1 }}
                    className="border-2 border-dashed border-indigo-500 bg-indigo-500/5 pointer-events-none"
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-md pointer-events-none">{folder.content}</div>
                    <div className="pointer-events-auto">
                        <div onPointerDown={(e) => handlePointerDown('rotate', e)} className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/95 p-2 rounded-full shadow-lg border border-indigo-200 cursor-grab text-indigo-600 hover:bg-indigo-50 hover:scale-110 active:scale-95 transition-all"><RotateCw size={16} strokeWidth={3} /></div>
                        <div onPointerDown={(e) => handlePointerDown('resize', e)} className="absolute -bottom-4 -right-4 bg-white/95 p-2 rounded-full shadow-lg border border-indigo-200 cursor-nwse-resize text-indigo-600 hover:bg-indigo-50 hover:scale-110 active:scale-95 transition-all"><Maximize2 size={16} strokeWidth={3} /></div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function ScrapbookCanvas({ user, activeAlbum, activePhotos, setCurrentView, setActiveAlbumId, setDbError }) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [zoom, setZoom] = useState(1);
    const scrollContainerRef = useRef(null);

    const [showLayers, setShowLayers] = useState(false);
    const [showStickerMenu, setShowStickerMenu] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);

    const [drawingLazoType, setDrawingLazoType] = useState(null);
    const [lazoPoints, setLazoPoints] = useState([]);

    // ESTADOS PARA SELECCIÓN MÚLTIPLE Y CAJA
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [selectionBox, setSelectionBox] = useState(null);

    const [editingStickerId, setEditingStickerId] = useState(null);
    const [stickerModalType, setStickerModalType] = useState(null);
    const [stickerInputText, setStickerInputText] = useState("");
    const [stickerInputUrl, setStickerInputUrl] = useState("");
    const [stickerDate, setStickerDate] = useState(() => new Date().toISOString().split('T')[0]);

    const [stickerBgColor, setStickerBgColor] = useState("#ffffff");
    const [stickerBorderColor, setStickerBorderColor] = useState("#e5e7eb");
    const [stickerTextColor, setStickerTextColor] = useState("#1f2937");
    const [stickerIsBold, setStickerIsBold] = useState(false);
    const [stickerIsItalic, setStickerIsItalic] = useState(false);

    const [stickerFontSize, setStickerFontSize] = useState(16);
    const [stickerRotation, setStickerRotation] = useState(0);

    const [photoDescText, setPhotoDescText] = useState("");
    const [photoTapeStyle, setPhotoTapeStyle] = useState("top");

    const [lazoTexture, setLazoTexture] = useState("hilo");
    const [lazoThickness, setLazoThickness] = useState(3);
    const [lazoIsSmooth, setLazoIsSmooth] = useState(true);

    const [tourOrder, setTourOrder] = useState(1);
    const [tourZoomLevel, setTourZoomLevel] = useState(1);
    const [tourSpeed, setTourSpeed] = useState(250);
    const [tourMessage, setTourMessage] = useState("");
    const [tourVisible, setTourVisible] = useState(false);

    const [animStyle, setAnimStyle] = useState("animate-bounce");
    const [animType, setAnimType] = useState("none");
    const [animDuration, setAnimDuration] = useState(3);
    const [animDirection, setAnimDirection] = useState("alternate");

    const [openFolders, setOpenFolders] = useState({});
    const [assignFolderId, setAssignFolderId] = useState(null);
    const [dragOverFolderId, setDragOverFolderId] = useState(null);

    const [tourStatus, setTourStatus] = useState('idle');
    const [tourCurrentMessage, setTourCurrentMessage] = useState("");
    const tourEngineRef = useRef({ active: false, lazos: [], lIdx: 0, pIdx: 0, progress: 0, lastTime: 0 });

    const progressBarRef = useRef(null);
    const progressTextRef = useRef(null);

    const [deletePhotoId, setDeletePhotoId] = useState(null);
    const [selectedPhotoForDesc, setSelectedPhotoForDesc] = useState(null);

    const drawingCanvasRef = useRef(null);
    const [isDrawingCanvas, setIsDrawingCanvas] = useState(false);

    const itemsRef = useRef([]);
    const foldersRef = useRef([]);

    const activeBgId = activeAlbum?.canvasBg || 'dots';
    const bgClass = CANVAS_BACKGROUNDS[activeBgId]?.className || CANVAS_BACKGROUNDS.dots.className;
    const btnClass = "hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-sm font-medium flex items-center gap-2 px-5 py-3.5 rounded-2xl";

    const folders = activePhotos.filter(p => p.type === 'folder').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const items = activePhotos.filter(p => p.type !== 'folder').sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    // Mantener referencias actualizadas para la caja de selección
    useEffect(() => {
        itemsRef.current = items;
        foldersRef.current = folders;
    }, [items, folders]);

    // MOTOR DE LA CAJA DE SELECCIÓN (MARQUEE TOOL)
    useEffect(() => {
        if (!selectionBox?.active) return;

        const handlePointerMove = (e) => {
            const container = document.getElementById('canvas-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const currentX = (e.clientX - rect.left) / zoom;
                const currentY = (e.clientY - rect.top) / zoom;
                setSelectionBox(prev => ({ ...prev, currentX, currentY }));
            }
        };

        const handlePointerUp = () => {
            setSelectionBox(prev => {
                if (!prev) return null;
                const minX = Math.min(prev.startX, prev.currentX);
                const maxX = Math.max(prev.startX, prev.currentX);
                const minY = Math.min(prev.startY, prev.currentY);
                const maxY = Math.max(prev.startY, prev.currentY);

                // Si la caja es lo suficientemente grande, seleccionamos los elementos
                if (maxX - minX > 10 && maxY - minY > 10) {
                    const newSelectedIds = [];
                    const currentItems = itemsRef.current;
                    const currentFolders = foldersRef.current;

                    currentItems.forEach(item => {
                        const itemFolder = currentFolders.find(f => f.id === item.folderId);
                        // Ignorar bloqueados u ocultos
                        if (itemFolder?.isHidden || itemFolder?.isGrouped || itemFolder?.isLocked || item.isLocked) return;

                        const iW = item.width || 100;
                        const iH = item.height || iW;

                        // Chequeo de colisión
                        if (item.x < maxX && item.x + iW > minX && item.y < maxY && item.y + iH > minY) {
                            newSelectedIds.push(item.id);
                        }
                    });
                    setSelectedItemIds(newSelectedIds);
                }
                return null;
            });
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [selectionBox?.active, zoom]);

    const handlePrint = () => window.print();

    const tourLazos = activePhotos.filter(p => p.type === 'lazo_guia').sort((a, b) => (a.tourOrder || 0) - (b.tourOrder || 0));
    const hasGuideLazos = tourLazos.length > 0;

    const updateMultiplePhotos = useCallback(async (updatesArray) => {
        try {
            const promises = updatesArray.map(update =>
                setDoc(doc(db, 'artifacts', appId, 'photos', update.id), update.data, { merge: true })
            );
            await Promise.all(promises);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    }, [user]);

    const handleBringGroupToFront = useCallback(async (folderItems) => {
        if (!folderItems || folderItems.length === 0) return;
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const updates = folderItems.map((item, index) => ({
            id: item.id,
            data: { zIndex: maxZ + index + 1 }
        }));
        await updateMultiplePhotos(updates);
    }, [activePhotos, updateMultiplePhotos]);

    const playTour = () => {
        if (tourStatus === 'idle') {
            if (tourLazos.length === 0) return;
            tourEngineRef.current = { active: true, lazos: tourLazos, lIdx: 0, pIdx: 0, progress: 0, lastTime: performance.now() };
            setZoom(tourLazos[0].tourZoom || 1);
        } else {
            tourEngineRef.current.active = true;
            tourEngineRef.current.lastTime = performance.now();
        }
        setTourStatus('playing');
        requestAnimationFrame(animateTourLoop);
    };

    const pauseTour = () => {
        tourEngineRef.current.active = false;
        setTourStatus('paused');
    };

    const stopTour = () => {
        tourEngineRef.current.active = false;
        setTourStatus('idle');
        setTourCurrentMessage("");
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';
        if (progressTextRef.current) progressTextRef.current.innerText = '0%';
    };

    const continueTourAfterMessage = () => {
        setTourCurrentMessage("");
        tourEngineRef.current.lIdx++;
        tourEngineRef.current.pIdx = 0;
        tourEngineRef.current.progress = 0;

        if (tourEngineRef.current.lIdx >= tourEngineRef.current.lazos.length) {
            stopTour();
        } else {
            const nextLazo = tourEngineRef.current.lazos[tourEngineRef.current.lIdx];
            setZoom(nextLazo.tourZoom || 1);
            tourEngineRef.current.active = true;
            tourEngineRef.current.lastTime = performance.now();
            setTourStatus('playing');
            requestAnimationFrame(animateTourLoop);
        }
    };

    const animateTourLoop = (time) => {
        if (!tourEngineRef.current.active) return;
        const state = tourEngineRef.current;
        const dt = time - state.lastTime;
        state.lastTime = time;

        const lazo = state.lazos[state.lIdx];
        const pts = lazo.points;
        const p1 = pts[state.pIdx];
        const p2 = pts[state.pIdx + 1];

        if (progressBarRef.current && progressTextRef.current) {
            const overallProgress = ((state.lIdx + state.progress) / state.lazos.length) * 100;
            progressBarRef.current.style.width = `${Math.min(overallProgress, 100)}%`;
            progressTextRef.current.innerText = `${Math.round(Math.min(overallProgress, 100))}%`;
        }

        if (!p2) {
            tourEngineRef.current.active = false;
            if (lazo.tourMessage) {
                setTourStatus('message');
                setTourCurrentMessage(lazo.tourMessage);
            } else {
                continueTourAfterMessage();
            }
            return;
        }

        const speed = lazo.tourSpeed || 250;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const timeToTravel = (dist / speed) * 1000;

        if (timeToTravel > 0) state.progress += dt / timeToTravel;
        else state.progress = 1;

        if (state.progress >= 1) {
            state.pIdx++;
            state.progress = 0;
            requestAnimationFrame(animateTourLoop);
            return;
        }

        const currX = p1.x + (p2.x - p1.x) * state.progress;
        const currY = p1.y + (p2.y - p1.y) * state.progress;
        const absX = lazo.x + currX;
        const absY = lazo.y + currY;

        const container = scrollContainerRef.current;
        if (container) {
            const currentZoom = lazo.tourZoom || 1;
            container.scrollTo({
                left: (absX * currentZoom) - container.clientWidth / 2,
                top: (absY * currentZoom) - container.clientHeight / 2,
                behavior: 'instant'
            });
        }

        if (tourEngineRef.current.active) requestAnimationFrame(animateTourLoop);
    };

    useEffect(() => {
        if (stickerModalType === 'drawing' && stickerInputText && drawingCanvasRef.current) {
            const ctx = drawingCanvasRef.current.getContext('2d');
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
                ctx.drawImage(img, 0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
            };
            img.src = stickerInputText;
        }
    }, [stickerModalType, stickerInputText]);

    const startFreeDrawing = (e) => {
        const canvas = drawingCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.beginPath();
        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
        setIsDrawingCanvas(true);
    };

    const doFreeDrawing = (e) => {
        if (!isDrawingCanvas) return;
        const canvas = drawingCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
        ctx.strokeStyle = stickerBgColor;
        ctx.lineWidth = lazoThickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopFreeDrawing = () => { setIsDrawingCanvas(false); };
    const clearFreeCanvas = () => {
        const canvas = drawingCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getCenterCoords = (itemWidth = 300) => {
        const container = scrollContainerRef.current;
        let startX = 50;
        let startY = 50;
        if (container) {
            startX = (container.scrollLeft + container.clientWidth / 2) / zoom - (itemWidth / 2);
            startY = (container.scrollTop + container.clientHeight / 2) / zoom - 100;
        }
        return { startX: Math.max(50, startX), startY: Math.max(50, startY) };
    };

    const handleFileUpload = async (e) => {
        if (!user || !activeAlbum.id) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setIsUploading(true);
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const { startX, startY } = getCenterCoords(300);

        try {
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    const base64Data = await compressImage(files[i]);
                    await setDoc(doc(collection(db, 'artifacts', appId, 'photos')), {
                        albumId: activeAlbum.id, type: 'image', src: base64Data, x: startX + (i * 30), y: startY + (i * 30),
                        width: 300, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + i + 1,
                        description: "", frameColor: "#faf9f5", tapeStyle: "top", isLocked: false, folderId: null
                    });
                }
            }
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
        setIsUploading(false); e.target.value = '';
    };

    const handlePngUpload = async (e) => {
        if (!user || !activeAlbum.id) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setIsUploading(true);
        setShowStickerMenu(false);
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const { startX, startY } = getCenterCoords(150);

        try {
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    const base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(files[i]);
                        reader.onload = (event) => {
                            const img = new Image();
                            img.src = event.target.result;
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX_SIZE = 400;
                                let width = img.width; let height = img.height;
                                if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                                else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                                canvas.width = width; canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                resolve(canvas.toDataURL('image/png'));
                            };
                        };
                    });

                    await setDoc(doc(collection(db, 'artifacts', appId, 'photos')), {
                        albumId: activeAlbum.id, type: 'custom_sticker', src: base64Data, x: startX + (i * 20), y: startY + (i * 20),
                        width: 150, rotation: 0, zIndex: maxZ + i + 1,
                        isLocked: false, folderId: null, animType: 'none', animDuration: 3, animDirection: 'alternate'
                    });
                }
            }
        } catch (error) { console.error(error); }
        setIsUploading(false); e.target.value = '';
    };

    const updatePhoto = useCallback(async (photoId, updates) => {
        try { await setDoc(doc(db, 'artifacts', appId, 'photos', photoId), updates, { merge: true }); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    }, [user]);

    const confirmDeletePhoto = async () => {
        try { await deleteDoc(doc(db, 'artifacts', appId, 'photos', deletePhotoId)); setDeletePhotoId(null); setSelectedItemIds([]); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleCreateFolder = async () => {
        try {
            const newFolderRef = doc(collection(db, 'artifacts', appId, 'photos'));
            await setDoc(newFolderRef, {
                albumId: activeAlbum.id, type: 'folder', content: 'Nueva Carpeta', color: '#3b82f6', createdAt: Date.now(), isGrouped: false, isHidden: false, isLocked: false
            });
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const finishDrawingLazo = async (e) => {
        if (e) e.stopPropagation();
        if (lazoPoints.length < 2) { setDrawingLazoType(null); setLazoPoints([]); return; }

        const minX = Math.min(...lazoPoints.map(p => p.x));
        const maxX = Math.max(...lazoPoints.map(p => p.x));
        const minY = Math.min(...lazoPoints.map(p => p.y));
        const maxY = Math.max(...lazoPoints.map(p => p.y));

        const width = Math.max(maxX - minX, 40);
        const height = Math.max(maxY - minY, 40);

        const normalizedPoints = lazoPoints.map(p => ({ x: p.x - minX, y: p.y - minY }));
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;

        try {
            const newLazoRef = doc(collection(db, 'artifacts', appId, 'photos'));
            const payload = {
                albumId: activeAlbum.id, type: drawingLazoType,
                points: normalizedPoints, x: minX, y: minY, width, height,
                baseWidth: width, baseHeight: height, rotation: 0,
                zIndex: maxZ + 1, color: drawingLazoType === 'lazo_guia' ? '#3b82f6' : '#1f2937',
                texture: drawingLazoType === 'lazo_guia' ? 'flecha' : 'hilo', thickness: 3, isSmooth: true, isLocked: false, folderId: null
            };
            if (drawingLazoType === 'lazo_guia') {
                payload.tourOrder = activePhotos.filter(p => p.type === 'lazo_guia').length + 1;
                payload.tourZoom = 1;
                payload.tourSpeed = 250;
                payload.tourMessage = "";
                payload.tourVisible = false;
            }
            await setDoc(newLazoRef, payload);
            setSelectedItemIds([newLazoRef.id]);
        } catch (err) { if (err.code === 'permission-denied') setDbError('permissions'); }

        setDrawingLazoType(null);
        setLazoPoints([]);
    };

    const handleRotateAdd = (deg) => {
        setStickerRotation(prev => {
            let next = prev + deg;
            if (next > 180) next -= 360;
            if (next < -180) next += 360;
            return next;
        });
    };

    const handleSaveSticker = async (type) => {
        if (type === 'image') {
            await updatePhoto(editingStickerId, { description: photoDescText, frameColor: stickerBgColor, tapeStyle: photoTapeStyle, rotation: stickerRotation });
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'folder') {
            await updatePhoto(editingStickerId, { content: stickerInputText, color: stickerBgColor });
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'custom_sticker') {
            await updatePhoto(editingStickerId, { animType, animDuration, animDirection, rotation: stickerRotation });
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'lazo' || type === 'lazo_guia') {
            const payload = { color: stickerBgColor, texture: lazoTexture, thickness: lazoThickness, isSmooth: lazoIsSmooth, rotation: stickerRotation };
            if (type === 'lazo_guia') {
                payload.tourOrder = tourOrder;
                payload.tourZoom = tourZoomLevel;
                payload.tourSpeed = tourSpeed;
                payload.tourMessage = tourMessage;
                payload.tourVisible = tourVisible;
            }
            await updatePhoto(editingStickerId, payload);
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'drawing') {
            const base64Data = drawingCanvasRef.current.toDataURL('image/png');
            const drawingData = { type: 'drawing', src: base64Data, color: stickerBgColor, thickness: lazoThickness, rotation: stickerRotation };
            try {
                if (editingStickerId) await updatePhoto(editingStickerId, drawingData);
                else {
                    const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
                    const { startX, startY } = getCenterCoords(400);
                    const newStickerRef = doc(collection(db, 'artifacts', appId, 'photos'));
                    await setDoc(newStickerRef, { albumId: activeAlbum.id, ...drawingData, x: startX, y: startY, width: 400, zIndex: maxZ + 1, isLocked: false, folderId: null });
                    setSelectedItemIds([newStickerRef.id]);
                }
                setStickerModalType(null); setEditingStickerId(null); setShowStickerMenu(false);
            } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
            return;
        }

        let width = 250;
        if (type === 'date' || type === 'location' || type === 'counter') width = 220;

        let contentToSave = stickerInputText;
        if (type === 'date') {
            const [y, m, d] = stickerDate.split('-');
            contentToSave = new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        const stickerData = {
            type, content: contentToSave, url: stickerInputUrl,
            bgColor: stickerBgColor, borderColor: stickerBorderColor, textColor: stickerTextColor,
            isBold: stickerIsBold, isItalic: stickerIsItalic, rotation: stickerRotation, fontSize: stickerFontSize,
            ...(type === 'date' ? { rawDate: stickerDate } : {}),
            ...(type === 'animated' ? { animationStyle: animStyle } : {})
        };

        try {
            if (editingStickerId) await updatePhoto(editingStickerId, stickerData);
            else {
                const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
                const { startX, startY } = getCenterCoords(width);
                const newStickerRef = doc(collection(db, 'artifacts', appId, 'photos'));
                await setDoc(newStickerRef, { albumId: activeAlbum.id, ...stickerData, x: startX, y: startY, width, zIndex: maxZ + 1, isLocked: false, folderId: null });
                setSelectedItemIds([newStickerRef.id]);
            }
            setStickerModalType(null); setEditingStickerId(null); setShowStickerMenu(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleAddEmoji = async (emoji, isAnim = false) => {
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const { startX, startY } = getCenterCoords(120);
        try {
            const newEmojiRef = doc(collection(db, 'artifacts', appId, 'photos'));
            await setDoc(newEmojiRef, {
                albumId: activeAlbum.id, type: isAnim ? 'animated' : 'emoji', content: emoji,
                x: startX, y: startY, width: 120, rotation: Math.floor(Math.random() * 20) - 10,
                zIndex: maxZ + 1, animationStyle: isAnim ? 'animate-bounce' : null, isLocked: false, folderId: null
            });
            setSelectedItemIds([newEmojiRef.id]);
            setShowStickerMenu(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleBgChange = async (bgId) => {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'albums', activeAlbum.id), { canvasBg: bgId }, { merge: true });
            setShowBgMenu(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const bringToFront = useCallback(async (photoId) => {
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        await updatePhoto(photoId, { zIndex: maxZ + 1 });
    }, [activePhotos, updatePhoto]);

    const openStickerModal = (type, photoToEdit = null) => {
        setStickerModalType(type === 'image' || !type ? 'image' : type);

        if (photoToEdit) {
            setEditingStickerId(photoToEdit.id);
            setStickerRotation(photoToEdit.rotation || 0);
            setStickerFontSize(photoToEdit.fontSize || 16);

            if (type === 'image' || !type) {
                setPhotoDescText(photoToEdit.description || "");
                setStickerBgColor(photoToEdit.frameColor || "#faf9f5");
                setPhotoTapeStyle(photoToEdit.tapeStyle || "top");
            } else if (type === 'lazo' || type === 'lazo_guia') {
                setStickerBgColor(photoToEdit.color || (type === 'lazo_guia' ? "#3b82f6" : "#1f2937"));
                setLazoTexture(photoToEdit.texture || "hilo");
                setLazoThickness(photoToEdit.thickness || 3);
                setLazoIsSmooth(photoToEdit.isSmooth !== false);
                if (type === 'lazo_guia') {
                    setTourOrder(photoToEdit.tourOrder || 1);
                    setTourZoomLevel(photoToEdit.tourZoom || 1);
                    setTourSpeed(photoToEdit.tourSpeed || 250);
                    setTourMessage(photoToEdit.tourMessage || "");
                    setTourVisible(photoToEdit.tourVisible || false);
                }
            } else if (type === 'custom_sticker') {
                setAnimType(photoToEdit.animType || "none");
                setAnimDuration(photoToEdit.animDuration || 3);
                setAnimDirection(photoToEdit.animDirection || "alternate");
            } else if (type === 'drawing') {
                setStickerBgColor(photoToEdit.color || "#1f2937");
                setLazoThickness(photoToEdit.thickness || 3);
                setStickerInputText(photoToEdit.src || "");
            } else if (type === 'animated') {
                setStickerInputText(photoToEdit.content || "");
                setAnimStyle(photoToEdit.animationStyle || "animate-bounce");
            } else if (type === 'folder') {
                setStickerInputText(photoToEdit.content || "");
                setStickerBgColor(photoToEdit.color || "#3b82f6");
            } else {
                setStickerInputText(photoToEdit.content || "");
                setStickerInputUrl(photoToEdit.url || "");
                setStickerBgColor(photoToEdit.bgColor || "#ffffff");
                setStickerBorderColor(photoToEdit.borderColor || "#e5e7eb");
                setStickerTextColor(photoToEdit.textColor || "#1f2937");
                setStickerIsBold(photoToEdit.isBold || false);
                setStickerIsItalic(photoToEdit.isItalic || false);
                if (type === 'date') setStickerDate(photoToEdit.rawDate || new Date().toISOString().split('T')[0]);
            }
        } else {
            setEditingStickerId(null);
            setStickerRotation(0);
            setStickerFontSize(16);
            setStickerInputText(""); setStickerInputUrl("");
            setStickerBgColor(type === 'postit' ? '#fef08a' : (type === 'link' || type === 'music' || type === 'counter') ? '#3b82f6' : type === 'drawing' ? '#1f2937' : '#ffffff');
            setStickerBorderColor(type === 'location' ? '#f43f5e' : (type === 'link' || type === 'music' || type === 'counter') ? '#ffffff' : '#e5e7eb');
            setStickerTextColor((type === 'link' || type === 'music' || type === 'counter') ? '#ffffff' : type === 'location' ? '#e11d48' : '#1f2937');
            setStickerIsBold(type === 'link' || type === 'location' || type === 'date' || type === 'music' || type === 'counter');
            setStickerIsItalic(false);
            setLazoThickness(3);
            setTourVisible(false);
            setAnimStyle("animate-bounce");
            setStickerDate(new Date().toISOString().split('T')[0]);
        }
        setShowStickerMenu(false);
    };

    const renderRotationControls = () => (
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Rotación</span>
                <span className="text-xs font-bold text-stone-700">{Math.round(stickerRotation)}°</span>
            </div>
            <input type="range" min="-180" max="180" value={stickerRotation} onChange={(e) => setStickerRotation(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer mb-4" />
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleRotateAdd(-45)} className="py-1.5 text-xs rounded-lg font-bold border transition-all bg-white border-stone-200 text-stone-700 hover:bg-stone-100 active:scale-95">-45°</button>
                <button onClick={() => setStickerRotation(0)} className="py-1.5 text-xs rounded-lg font-bold border transition-all bg-stone-800 border-stone-800 text-white hover:bg-stone-700 active:scale-95">Recto (0°)</button>
                <button onClick={() => handleRotateAdd(45)} className="py-1.5 text-xs rounded-lg font-bold border transition-all bg-white border-stone-200 text-stone-700 hover:bg-stone-100 active:scale-95">+45°</button>
            </div>
            <p className="text-[10px] text-stone-400 text-center mt-2 italic leading-tight">Tip: Mantén presionada la tecla Shift mientras rotas con el ratón para fijar a 45°.</p>
        </div>
    );

    const renderStyleControls = () => (
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Estilo Visual</p>
            <div className="mb-4">
                <label className="flex justify-between text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                    <span>Tamaño de Letra</span><span>{stickerFontSize}px</span>
                </label>
                <input type="range" min="10" max="120" value={stickerFontSize} onChange={(e) => setStickerFontSize(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded hover:scale-110 transition-transform" /> Fondo</label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerBorderColor} onChange={e => setStickerBorderColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded hover:scale-110 transition-transform" /> Contorno</label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerTextColor} onChange={e => setStickerTextColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded hover:scale-110 transition-transform" /> Letra</label>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setStickerIsBold(!stickerIsBold)} className={`flex-1 py-2 rounded-lg font-bold border transition-all active:scale-95 ${stickerIsBold ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>B Negrita</button>
                <button onClick={() => setStickerIsItalic(!stickerIsItalic)} className={`flex-1 py-2 rounded-lg italic border transition-all active:scale-95 ${stickerIsItalic ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>I Cursiva</button>
            </div>
        </div>
    );

    const renderLayerItem = (p) => {
        const isEditable = !p.type || ['image', 'postit', 'date', 'link', 'music', 'counter', 'location', 'lazo', 'lazo_guia', 'drawing', 'animated', 'custom_sticker'].includes(p.type);
        const pFolder = folders.find(f => f.id === p.folderId);
        const isGroupedMember = pFolder && pFolder.isGrouped;
        const visuallyHidden = pFolder?.isHidden || p.isHidden;

        return (
            <div key={p.id} className={`flex flex-col ${visuallyHidden ? 'opacity-40' : ''}`}>
                <div
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('itemId', p.id); }}
                    onClick={() => setSelectedItemIds([isGroupedMember ? pFolder.id : p.id])}
                    className={`flex items-center justify-between p-2 rounded-lg text-sm group cursor-grab active:cursor-grabbing transition-all border ${selectedItemIds.includes(isGroupedMember ? pFolder.id : p.id) ? 'bg-indigo-50 border-indigo-300 shadow-sm scale-[1.02]' : 'bg-white border-transparent hover:border-stone-200'} ${(p.isLocked || pFolder?.isLocked) ? 'grayscale' : ''}`}
                >
                    <span className={`truncate w-24 font-medium text-[11px] pointer-events-none ${selectedItemIds.includes(isGroupedMember ? pFolder.id : p.id) ? 'text-indigo-800' : 'text-stone-600'}`}>
                        {p.type === 'postit' ? 'Post-it' : p.type === 'date' ? 'Fecha' : p.type === 'location' ? 'Ubicación' : p.type === 'link' ? 'Enlace' : p.type === 'music' ? 'Canción' : p.type === 'counter' ? 'Contador' : p.type === 'lazo' ? 'Lazo' : p.type === 'lazo_guia' ? 'Lazo Guía' : p.type === 'drawing' ? 'Dibujo Libre' : p.type === 'animated' ? 'Animación' : p.type === 'custom_sticker' ? 'Pegatina PNG' : p.type === 'emoji' ? p.content : 'Imagen'}
                    </span>
                    <div className="flex gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setAssignFolderId(assignFolderId === p.id ? null : p.id); }} className="p-1 hover:bg-amber-100 text-amber-600 rounded transition-all" title="Asignar a carpeta"><FolderPlus size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); updatePhoto(p.id, { isLocked: !p.isLocked }); }} className="p-1 hover:bg-stone-200 text-stone-700 rounded transition-all" title={p.isLocked ? 'Desbloquear' : 'Bloquear'}>
                            {p.isLocked ? <Lock size={12} className="text-rose-500" /> : <Unlock size={12} />}
                        </button>
                        {isEditable && <button onClick={(e) => { e.stopPropagation(); openStickerModal(p.type, p); }} className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-all" title="Editar"><Edit2 size={12} /></button>}
                        <button onClick={(e) => { e.stopPropagation(); bringToFront(p.id); }} className="p-1 hover:bg-indigo-100 text-indigo-600 rounded transition-all" title="Traer al frente"><ChevronUp size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletePhotoId(p.id); }} className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-all" title="Eliminar"><Trash2 size={12} /></button>
                    </div>
                </div>

                {assignFolderId === p.id && (
                    <div className="mt-1 bg-white border border-stone-200 p-1.5 flex flex-col gap-0.5 rounded-xl shadow-sm z-10 w-full animate-in fade-in slide-in-from-top-2">
                        <button onClick={(e) => { e.stopPropagation(); updatePhoto(p.id, { folderId: null }); setAssignFolderId(null); }} className="text-[10px] font-bold text-left px-2 py-1.5 hover:bg-stone-100 rounded-lg text-stone-500 w-full">↗️ Sacar de la carpeta</button>
                        {folders.map(f => (
                            <button key={f.id} onClick={(e) => { e.stopPropagation(); updatePhoto(p.id, { folderId: f.id }); setAssignFolderId(null); setOpenFolders(prev => ({ ...prev, [f.id]: true })); }} className="text-[10px] font-bold text-left px-2 py-1.5 hover:bg-stone-100 rounded-lg flex items-center gap-1.5 text-stone-700 w-full">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }}></div>
                                <span className="truncate">{f.content}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Separamos los items para renderizar
    const visibleFolders = folders.filter(f => !f.isHidden);
    const groupedFolders = visibleFolders.filter(f => f.isGrouped);

    const freeItems = items.filter(i => {
        if (!i.folderId) return true;
        const pFolder = folders.find(f => f.id === i.folderId);
        if (pFolder?.isHidden || pFolder?.isGrouped) return false;
        return true;
    });

    const multiSelectedItems = freeItems.filter(i => selectedItemIds.includes(i.id));
    const renderableFreeItems = freeItems.filter(i => {
        if (multiSelectedItems.length > 1 && selectedItemIds.includes(i.id)) return false;
        return true;
    });

    return (
        <div className="h-screen flex flex-col font-sans overflow-hidden bg-stone-100 relative">
            <CustomAnimations />

            {/* HEADER CONTROLS */}
            <div className="absolute top-6 left-6 right-6 z-[99999] flex justify-between gap-4 pointer-events-none print:hidden">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-5 pointer-events-auto">
                    <button onClick={() => { setCurrentView('dashboard'); setActiveAlbumId(null); setSelectedItemIds([]); stopTour(); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full hover:scale-110 active:scale-95 transition-all"><ArrowLeft size={22} /></button>
                    <div><h2 className="text-xl font-bold font-serif text-stone-800">{activeAlbum?.name}</h2></div>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                    {isEditMode && (
                        <>
                            <div className="relative">
                                <button onClick={() => { setShowBgMenu(!showBgMenu); setShowStickerMenu(false); setShowLayers(false); }} className={`${btnClass} bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100`}>
                                    <Palette size={20} /> <span className="hidden sm:inline">Fondo</span>
                                </button>
                                {showBgMenu && (
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 w-72 z-[99999]">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Fondo del Lienzo</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(CANVAS_BACKGROUNDS).map(([key, bg]) => (
                                                <button key={key} onClick={() => handleBgChange(key)} className={`p-2.5 rounded-xl border-2 text-xs font-bold text-center transition-all hover:scale-105 active:scale-95 ${activeBgId === key ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-stone-100 text-stone-600 hover:border-purple-200 hover:bg-stone-50'}`}>{bg.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => { setShowLayers(!showLayers); setShowStickerMenu(false); setShowBgMenu(false); }} className={`${btnClass} bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100`}><Layers size={20} /> <span className="hidden sm:inline">Capas</span></button>

                            <div className="relative">
                                <button onClick={() => { setShowStickerMenu(!showStickerMenu); setShowLayers(false); setShowBgMenu(false); }} className={`${btnClass} bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100`}>
                                    <SmilePlus size={20} /> <span className="hidden sm:inline">Pegatinas</span>
                                </button>
                                {showStickerMenu && (
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 w-80 flex flex-col z-[99999]">
                                        <div className="grid grid-cols-2 gap-1 mb-2">
                                            <button onClick={() => openStickerModal('postit')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><StickyNote size={16} className="text-yellow-500" /> Post-it</button>
                                            <button onClick={() => openStickerModal('date')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><Calendar size={16} className="text-blue-500" /> Fecha</button>
                                            <button onClick={() => openStickerModal('location')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><MapPin size={16} className="text-rose-500" /> Ubicación</button>
                                            <button onClick={() => openStickerModal('link')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><LinkIcon size={16} className="text-emerald-500" /> Enlace</button>
                                            <button onClick={() => openStickerModal('music')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><Music size={16} className="text-violet-500" /> Canción</button>
                                            <button onClick={() => openStickerModal('counter')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><Hash size={16} className="text-amber-500" /> Contador</button>
                                        </div>
                                        <div className="border-t border-stone-100 my-1"></div>
                                        <div className="flex gap-1 px-1 py-2">
                                            <button onClick={() => { setDrawingLazoType('lazo'); setShowStickerMenu(false); setSelectedItemIds([]); }} className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-stone-800 text-white rounded-xl text-[10px] font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md"><PenTool size={16} /> Lazo Decorativo</button>
                                            <button onClick={() => { setDrawingLazoType('lazo_guia'); setShowStickerMenu(false); setSelectedItemIds([]); }} className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md"><Navigation size={16} /> Lazo Guía (Tour)</button>
                                            <button onClick={() => openStickerModal('drawing')} className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md"><Brush size={16} /> Dibujo Libre</button>
                                        </div>
                                        <div className="px-1 pb-2">
                                            <label className="flex items-center justify-center gap-2 w-full p-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-200 cursor-pointer transition-all shadow-sm">
                                                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Subir PNG (Animable)
                                                <input type="file" multiple accept="image/png, image/gif, image/webp" className="hidden" onChange={handlePngUpload} disabled={isUploading} />
                                            </label>
                                        </div>
                                        <div className="border-t border-stone-100 my-1"></div>
                                        <div className="flex flex-col gap-4 px-3 py-3 max-h-80 overflow-y-auto">
                                            <div><p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Animaciones (Solo en Recorrido)</p><div className="flex flex-wrap gap-2">{['✨', '💖', '🔥', '🦋', '🫧', '🎉', '🕊️', '☄️'].map(e => <button key={e} onClick={() => handleAddEmoji(e, true)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir animación">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Pines y Papelería</p><div className="flex flex-wrap gap-2">{['📌', '📍', '📎', '🖇️', '🏷️', '🩹', '📏', '✂️', '🗑️', '📋'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Fotografía y Scrapbook</p><div className="flex flex-wrap gap-2">{['📷', '📸', '🎞️', '📽️', '🖼️', '📔', '📓', '🎨', '🖌️', '🔍'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Estrellas y Galaxias</p><div className="flex flex-wrap gap-2">{['🌌', '🪐', '🌍', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '☀️', '⭐', '🌟', '✨', '☄️', '🌠', '🚀', '🛸', '🔭', '👽'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Cielo y Paisajes</p><div className="flex flex-wrap gap-2">{['☁️', '⛅', '🌤️', '🌥️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌈', '🌅', '🌄', '🏜️', '🏖️', '🏕️', '⛰️', '🏔️', '🗻', '🌋', '🏞️'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Flechas y Conectores</p><div className="flex flex-wrap gap-2">{['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '↪️', '↩️', '⤵️', '⤴️', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '〰️', '➰', '➿', '🎀', '🎗️', '🧵', '🧶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Biología & Naturaleza</p><div className="flex flex-wrap gap-2">{['🧬', '🔬', '🦠', '🌿', '🍄', '🌱', '🌳', '🍂', '🌵', '🌾', '🌴', '🌺', '🌻', '🌼', '🌷', '🐞', '🦋', '🐝', '🐜', '🕷️', '🕸️'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Aves</p><div className="flex flex-wrap gap-2">{['🦅', '🦉', '🦜', '🦆', '🦩', '🕊️', '🐧', '🪶', '🦢', '🐓', '🦚', '🦃', '🐥', '🐤', '🐣'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Vida Marina</p><div className="flex flex-wrap gap-2">{['🐟', '🐠', '🐡', '🦈', '🐙', '🦀', '🐢', '🐋', '🐚', '🐬', '🦑', '🦐', '🦞', '🦭', '🫧', '🌊'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <label className={`${btnClass} bg-amber-100 text-amber-800 hover:bg-amber-200 border border-transparent`}>
                                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />} <span className="hidden sm:inline">Añadir Fotos</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        </>
                    )}
                    <button onClick={() => { setIsEditMode(!isEditMode); setSelectedItemIds([]); setShowBgMenu(false); setShowLayers(false); setShowStickerMenu(false); setDrawingLazoType(null); stopTour(); }} className={`${btnClass} bg-white text-stone-700 border hover:bg-stone-50`}>
                        {isEditMode ? <Check size={20} /> : <Edit3 size={20} />} {isEditMode ? 'Terminar Edición' : 'Editar Álbum'}
                    </button>
                </div>
            </div>

            {/* CONTROLES FLOTANTES INFERIORES: ZOOM E IMPRESIÓN */}
            <div className="absolute bottom-8 right-8 z-[9000] flex flex-col gap-4 print:hidden pointer-events-none">
                <button onClick={handlePrint} className="p-3.5 bg-stone-800 text-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:bg-stone-700 hover:scale-110 active:scale-95 transition-all pointer-events-auto" title="Imprimir / Guardar PDF">
                    <Printer size={22} />
                </button>
                <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-hidden border border-stone-200 pointer-events-auto">
                    <button onClick={() => setZoom(z => Math.min(z + 0.1, 2.5))} className="p-3 hover:bg-stone-100 active:bg-stone-200 transition-colors text-stone-600" title="Acercar"><ZoomIn size={20} /></button>
                    <div className="text-center text-[10px] font-bold py-1.5 border-y border-stone-200 text-stone-500 bg-stone-50">{Math.round(zoom * 100)}%</div>
                    <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="p-3 hover:bg-stone-100 active:bg-stone-200 transition-colors text-stone-600" title="Alejar"><ZoomOut size={20} /></button>
                </div>
            </div>

            {/* CONTROLES DEL TOUR Y TIMELINE */}
            {!isEditMode && hasGuideLazos && (
                <div className="absolute bottom-8 left-8 right-8 z-[9000] flex flex-col items-start gap-3 pointer-events-none print:hidden max-w-3xl">
                    {tourStatus !== 'idle' && (
                        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-blue-200 p-4 w-[320px] pointer-events-auto animate-in slide-in-from-left-8">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Progreso del Recorrido</span>
                                <span ref={progressTextRef} className="text-xs font-bold text-stone-500">0%</span>
                            </div>
                            <div className="relative h-2.5 bg-stone-200 rounded-full overflow-hidden">
                                <div ref={progressBarRef} className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-75" style={{ width: '0%' }}></div>
                                {tourLazos.map((lazo, i) => (
                                    <div key={lazo.id} className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/80 rounded-full shadow-sm" style={{ left: `${(i / tourLazos.length) * 100}%` }}></div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-blue-200 overflow-hidden pointer-events-auto animate-in slide-in-from-left-8">
                        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-center font-bold text-sm tracking-wider uppercase">Tour</div>
                        <button onClick={playTour} disabled={tourStatus === 'playing' || tourStatus === 'message'} className="p-3 hover:bg-blue-50 text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Reproducir"><Play size={20} fill="currentColor" /></button>
                        <button onClick={pauseTour} disabled={tourStatus !== 'playing'} className="p-3 hover:bg-amber-50 text-amber-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Pausar"><Pause size={20} fill="currentColor" /></button>
                        <button onClick={stopTour} disabled={tourStatus === 'idle'} className="p-3 hover:bg-rose-50 text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Detener"><Square size={20} fill="currentColor" /></button>
                    </div>
                </div>
            )}

            {/* MODAL DE MENSAJE DEL TOUR */}
            {tourStatus === 'message' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                    <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg text-center animate-in zoom-in-95">
                        <MessageSquareText size={48} className="mx-auto mb-6 text-blue-500" />
                        <p className="text-2xl font-serif text-stone-800 mb-10 leading-relaxed">{tourCurrentMessage}</p>
                        <button onClick={continueTourAfterMessage} className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-md hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all text-lg">Continuar Recorrido</button>
                    </div>
                </div>
            )}

            {/* MENÚ DE CAPAS CON CARPETAS Y HERRAMIENTAS NUEVAS */}
            {showLayers && isEditMode && (
                <div className="absolute top-24 right-6 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 z-[99999] border border-stone-200 print:hidden flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-stone-800">Capas</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCreateFolder} className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors">
                                <FolderPlus size={14} /> Nueva Carpeta
                            </button>
                            <button onClick={() => setShowLayers(false)} className="p-1.5 hover:bg-stone-100 rounded-full transition-all text-stone-500"><X size={16} /></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-2">
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                className={`border rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${dragOverFolderId === folder.id ? 'border-blue-500 bg-blue-50 scale-[1.02] ring-2 ring-blue-500/20' : 'border-stone-200'} ${folder.isHidden ? 'opacity-60' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverFolderId(null);
                                    const itemId = e.dataTransfer.getData('itemId');
                                    if (itemId && itemId !== folder.id) {
                                        updatePhoto(itemId, { folderId: folder.id });
                                        setOpenFolders(prev => ({ ...prev, [folder.id]: true }));
                                    }
                                }}
                            >
                                <div
                                    className={`p-2.5 flex justify-between items-center cursor-pointer transition-colors ${folder.isGrouped ? 'bg-indigo-50' : 'bg-stone-50 hover:bg-stone-100'}`}
                                    onClick={() => setOpenFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                                >
                                    <div className="flex items-center gap-2">
                                        <Folder size={16} fill={folder.color} color={folder.color} />
                                        <span className={`font-bold text-xs truncate w-20 ${folder.isGrouped ? 'text-indigo-800' : 'text-stone-700'}`}>{folder.content}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <button onClick={(e) => { e.stopPropagation(); updatePhoto(folder.id, { isHidden: !folder.isHidden }); }} className={`p-1 hover:bg-stone-200 rounded transition-colors ${folder.isHidden ? 'text-stone-300' : 'text-stone-600'}`} title={folder.isHidden ? 'Mostrar Carpeta' : 'Ocultar Carpeta'}>
                                            {folder.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); updatePhoto(folder.id, { isLocked: !folder.isLocked }); }} className={`p-1 hover:bg-stone-200 rounded transition-colors ${folder.isLocked ? 'text-rose-500' : 'text-stone-400'}`} title={folder.isLocked ? 'Desbloquear Carpeta' : 'Bloquear Carpeta'}>
                                            {folder.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); updatePhoto(folder.id, { isGrouped: !folder.isGrouped }); }} className={`p-1 hover:bg-indigo-200 rounded transition-colors ${folder.isGrouped ? 'text-indigo-600 bg-indigo-200' : 'text-stone-400'}`} title={folder.isGrouped ? 'Desagrupar Contenido' : 'Agrupar Contenido'}><Layers size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); openStickerModal('folder', folder); }} className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-colors" title="Editar"><Edit2 size={12} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeletePhotoId(folder.id); }} className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors" title="Eliminar"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                                {openFolders[folder.id] && (
                                    <div className={`p-1.5 flex flex-col gap-1 border-t shadow-inner ${folder.isGrouped ? 'bg-indigo-50/50 border-indigo-100' : 'bg-stone-100 border-stone-200'}`}>
                                        {items.filter(i => i.folderId === folder.id).map(renderLayerItem)}
                                        {items.filter(i => i.folderId === folder.id).length === 0 && <p className="text-[10px] text-stone-400 text-center py-2 italic pointer-events-none">Carpeta vacía</p>}
                                    </div>
                                )}
                            </div>
                        ))}

                        <div
                            className={`pt-2 flex flex-col gap-1 pb-4 min-h-[60px] rounded-xl transition-all border-2 ${dragOverFolderId === 'root' ? 'border-dashed border-stone-400 bg-stone-100/50' : 'border-transparent'}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('root'); }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverFolderId(null);
                                const itemId = e.dataTransfer.getData('itemId');
                                if (itemId) updatePhoto(itemId, { folderId: null });
                            }}
                        >
                            {freeItems.map(renderLayerItem)}
                            {freeItems.length === 0 && <p className="text-[10px] text-stone-400 text-center py-4 italic pointer-events-none">Arrastra objetos aquí para sacarlos</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* CANVAS PRINCIPAL Y ÁREA EXPANDIDA */}
            <div
                ref={scrollContainerRef}
                className={`flex-1 relative w-full overflow-auto transition-colors duration-500 ${bgClass} print:bg-white print:overflow-visible`}
            >
                <div
                    id="canvas-container"
                    className="w-[4000px] h-[3000px] origin-top-left transition-transform duration-500 ease-out relative cursor-crosshair"
                    style={{ transform: `scale(${zoom})` }}
                    onPointerDown={(e) => {
                        if (isEditMode && !drawingLazoType) {
                            if (e.target.id === 'canvas-bg') {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const startX = (e.clientX - rect.left) / zoom;
                                const startY = (e.clientY - rect.top) / zoom;
                                setSelectionBox({ active: true, startX, startY, currentX: startX, currentY: startY });
                                setSelectedItemIds([]);
                            }
                        }
                    }}
                >
                    {/* Fondo auxiliar para atrapar clics de selección */}
                    <div id="canvas-bg" className="absolute inset-0 z-0 pointer-events-auto" />

                    {drawingLazoType && (
                        <div className="absolute inset-0 z-[8000] cursor-crosshair" onPointerDown={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setLazoPoints(prev => [...prev, { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }]); }}>
                            <svg className="w-full h-full pointer-events-none drop-shadow-md">
                                {lazoPoints.length > 0 && <path d={getLazoPath(lazoPoints, true)} fill="none" stroke={drawingLazoType === 'lazo_guia' ? '#3b82f6' : '#1f2937'} strokeWidth="3" strokeDasharray={drawingLazoType === 'lazo_guia' ? '12 12' : '8 8'} strokeLinecap="round" strokeLinejoin="round" />}
                                {lazoPoints.map((p, i) => (
                                    <g key={i}>
                                        <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                                        {drawingLazoType === 'lazo_guia' && <text x={p.x + 10} y={p.y - 10} fill="#3b82f6" fontSize="16" fontWeight="bold">{i + 1}</text>}
                                    </g>
                                ))}
                            </svg>
                        </div>
                    )}

                    <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {/* RENDERIZADO DE CARPETAS AGRUPADAS */}
                        {groupedFolders.map(folder => {
                            const folderItems = items.filter(i => i.folderId === folder.id);
                            return (
                                <InteractableGroup
                                    key={folder.id} folder={folder} items={folderItems}
                                    updateMultiplePhotos={updateMultiplePhotos}
                                    isEditMode={isEditMode}
                                    isSelected={selectedItemIds.includes(folder.id)}
                                    onSelect={() => setSelectedItemIds([folder.id])}
                                    onBringToFront={() => handleBringGroupToFront(folderItems)}
                                    zoom={zoom}
                                    isLocked={folder.isLocked}
                                />
                            );
                        })}

                        {/* GRUPO TEMPORAL DE SELECCIÓN MÚLTIPLE */}
                        {multiSelectedItems.length > 1 && (
                            <InteractableGroup
                                folder={{ id: 'multi-select', content: 'Selección Múltiple' }}
                                items={multiSelectedItems}
                                updateMultiplePhotos={updateMultiplePhotos}
                                isEditMode={isEditMode}
                                isSelected={true}
                                onSelect={() => { }}
                                onBringToFront={() => handleBringGroupToFront(multiSelectedItems)}
                                zoom={zoom}
                                isLocked={false}
                            />
                        )}

                        {/* RENDERIZADO DE OBJETOS LIBRES */}
                        {renderableFreeItems.map(photo => {
                            const pFolder = folders.find(f => f.id === photo.folderId);
                            const isFolderLocked = pFolder?.isLocked;
                            const effectivePhoto = { ...photo, isLocked: photo.isLocked || isFolderLocked };

                            return (
                                <InteractablePhoto
                                    key={photo.id} photo={effectivePhoto} updatePhoto={updatePhoto} deletePhoto={(id) => { setDeletePhotoId(id); setSelectedItemIds([]); }}
                                    isEditMode={isEditMode && !drawingLazoType}
                                    isSelected={selectedItemIds.includes(photo.id)}
                                    onSelect={() => setSelectedItemIds([photo.id])}
                                    onBringToFront={bringToFront} onClickView={(p) => setSelectedPhotoForDesc(p)} onEditClick={(p) => openStickerModal(p.type, p)}
                                    zoom={zoom} isTourPlaying={tourStatus === 'playing'}
                                    isDrawingMode={!!drawingLazoType}
                                />
                            )
                        })}
                    </div>

                    {/* CAJA DE SELECCIÓN MÚLTIPLE VISUAL (DENTRO DEL CANVAS PARA QUE ESCALE CON EL ZOOM) */}
                    {selectionBox?.active && (
                        <div
                            className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none z-[9999] rounded-sm"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                height: Math.abs(selectionBox.currentY - selectionBox.startY),
                            }}
                        />
                    )}
                </div>
            </div>

            {/* PANEL FIJO MIENTRAS SE DIBUJA EL LAZO */}
            {drawingLazoType && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex items-center gap-6 border border-stone-200 z-[99999]">
                    <div><p className="font-bold text-stone-800 text-lg">Trazando {drawingLazoType === 'lazo_guia' ? 'Lazo Guía' : 'Lazo'}...</p><p className="text-sm text-stone-500">Haz clic en diferentes puntos para dibujar</p></div>
                    <div className="flex gap-3"><button onClick={() => { setDrawingLazoType(null); setLazoPoints([]); }} className="px-5 py-2 hover:bg-stone-100 rounded-full font-medium hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={finishDrawingLazo} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Terminar Trazado</button></div>
                </div>
            )}

            {/* MODAL MODO FACEBOOK (PANTALLA COMPLETA) */}
            {selectedPhotoForDesc && !isEditMode && (
                <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col md:flex-row animate-in fade-in duration-300 print:hidden" onClick={() => setSelectedPhotoForDesc(null)}>
                    <button className="absolute top-4 left-4 z-50 text-white/50 hover:text-white p-2 hover:scale-110 active:scale-95 transition-all" onClick={() => setSelectedPhotoForDesc(null)}><X size={32} /></button>
                    <div className="flex-1 p-6 md:p-12 flex items-center justify-center relative"><img src={selectedPhotoForDesc.src} alt="Detalle" className="max-w-full max-h-full object-contain drop-shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>
                    <div className="w-full md:w-[400px] h-1/3 md:h-full bg-white shadow-2xl flex flex-col relative z-10 slide-in-from-bottom-full md:slide-in-from-right-full duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 md:p-8 border-b border-stone-100 flex items-center gap-4 bg-stone-50/50"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0 shadow-inner"><MessageSquareText size={24} /></div><div><h3 className="font-serif font-bold text-2xl text-stone-800">El Recuerdo</h3><p className="text-stone-400 text-sm">Historia de esta fotografía</p></div></div>
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                            {selectedPhotoForDesc.description ? <p className="text-stone-700 leading-relaxed font-serif text-lg md:text-xl whitespace-pre-wrap">{selectedPhotoForDesc.description}</p> : <div className="text-center mt-10"><p className="text-stone-400 italic text-lg mb-2">Aún no has escrito la historia de esta foto.</p><p className="text-stone-300 text-sm">Activa el Modo Edición y dale al botón de Editar sobre la foto para añadirle una descripción secreta.</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* OTROS MODALES DE EDICIÓN */}
            {deletePhotoId && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden"><div className="bg-white p-8 rounded-3xl w-full max-w-sm"><h2 className="text-2xl font-bold mb-4">Eliminar Elemento</h2><div className="flex justify-end gap-3"><button onClick={() => setDeletePhotoId(null)} className="px-5 py-2 hover:bg-stone-100 rounded-full font-medium hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={confirmDeletePhoto} className="px-6 py-2 bg-rose-600 text-white rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-md hover:bg-rose-700">Eliminar</button></div></div></div>
            )}

            {/* Modal: Editar Carpeta */}
            {stickerModalType === 'folder' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800"><FolderPlus /> Propiedades de Carpeta</h2>
                        <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Nombre de la carpeta" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-6 font-medium" autoFocus />
                        <label className="flex items-center gap-3 text-sm font-medium mb-8 cursor-pointer hover:scale-[1.02] transition-transform">
                            <input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color de Identificación
                        </label>
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={() => handleSaveSticker('folder')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Edición de Custom Sticker PNG */}
            {stickerModalType === 'custom_sticker' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800"><ImagePlus /> Pegatina Animada</h2>

                        {renderRotationControls()}

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Tipo de Animación</p>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => setAnimType('none')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'none' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Ninguna</button>
                                <button onClick={() => setAnimType('spin')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'spin' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Rotar</button>
                                <button onClick={() => setAnimType('pulse')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'pulse' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Escalar</button>
                                <button onClick={() => setAnimType('wiggle')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'wiggle' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Tambalear</button>
                                <button onClick={() => setAnimType('floatX')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'floatX' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Mover ↔️</button>
                                <button onClick={() => setAnimType('floatY')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animType === 'floatY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Mover ↕️</button>
                            </div>

                            <div className="mb-4">
                                <label className="flex justify-between text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                                    <span>Duración / Velocidad</span><span>{animDuration}s</span>
                                </label>
                                <input type="range" min="0.5" max="10" step="0.5" value={animDuration} onChange={(e) => setAnimDuration(parseFloat(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                            </div>

                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Dirección</p>
                            <div className="flex gap-2">
                                <button onClick={() => setAnimDirection('normal')} className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all ${animDirection === 'normal' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Normal</button>
                                <button onClick={() => setAnimDirection('reverse')} className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all ${animDirection === 'reverse' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Inversa</button>
                                <button onClick={() => setAnimDirection('alternate')} className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all ${animDirection === 'alternate' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Alterna</button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={() => handleSaveSticker('custom_sticker')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar Cambios</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Dibujo Libre */}
            {stickerModalType === 'drawing' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Brush /> {editingStickerId ? 'Editar Dibujo' : 'Nuevo Dibujo Libre'}</h2>

                        {renderRotationControls()}

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-4">
                            <label className="flex items-center gap-3 text-sm font-medium mb-4 cursor-pointer hover:scale-[1.02] transition-transform">
                                <input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color del Pincel
                            </label>
                            <div>
                                <label className="flex justify-between text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                                    <span>Grosor</span><span>{lazoThickness}px</span>
                                </label>
                                <input type="range" min="1" max="30" value={lazoThickness} onChange={(e) => setLazoThickness(parseInt(e.target.value))} className="w-full accent-stone-800 cursor-pointer" />
                            </div>
                        </div>

                        <div className="border-2 border-stone-200 rounded-xl overflow-hidden mb-4 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] cursor-crosshair shadow-inner relative">
                            <canvas ref={drawingCanvasRef} width={400} height={300} className="w-full h-auto block touch-none" onPointerDown={startFreeDrawing} onPointerMove={doFreeDrawing} onPointerUp={stopFreeDrawing} onPointerOut={stopFreeDrawing} />
                        </div>

                        <div className="flex justify-between items-center">
                            <button onClick={clearFreeCanvas} className="text-sm font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">Limpiar Lienzo</button>
                            <div className="flex gap-3">
                                <button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button>
                                <button onClick={() => handleSaveSticker('drawing')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Imagen */}
            {stickerModalType === 'image' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800"><ImagePlus /> Detalles de la Foto</h2>

                        {renderRotationControls()}

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">Estilo Visual</p>
                            <label className="flex items-center gap-3 text-sm font-medium mb-4 cursor-pointer hover:scale-[1.02] transition-transform"><input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color del Marco</label>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Posición de la Cinta Adhesiva</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPhotoTapeStyle('top')} className={`flex-1 py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${photoTapeStyle === 'top' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Arriba</button>
                                <button onClick={() => setPhotoTapeStyle('corners')} className={`flex-1 py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${photoTapeStyle === 'corners' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Esquinas</button>
                                <button onClick={() => setPhotoTapeStyle('none')} className={`flex-1 py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${photoTapeStyle === 'none' ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Ninguna</button>
                            </div>
                        </div>
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Historia Secreta</p>
                        <textarea value={photoDescText} onChange={(e) => setPhotoDescText(e.target.value)} placeholder="Escribe la historia o detalle de esta fotografía..." className="w-full h-32 p-4 rounded-xl resize-none font-serif text-lg mb-6 outline-none focus:ring-2 focus:ring-amber-400 border border-stone-200 bg-stone-50" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={() => handleSaveSticker('image')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar Cambios</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Lazo y Lazo Guía */}
            {(stickerModalType === 'lazo' || stickerModalType === 'lazo_guia') && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800">
                            {stickerModalType === 'lazo_guia' ? <><Navigation /> Editar Lazo Guía (Tour)</> : <><PenTool /> Editar Lazo</>}
                        </h2>

                        {renderRotationControls()}

                        {stickerModalType === 'lazo_guia' && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">Configuración del Recorrido</p>

                                <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-lg border border-blue-200">
                                    <span className="text-sm font-bold text-stone-700">Línea Visible en el Recorrido</span>
                                    <button onClick={() => setTourVisible(!tourVisible)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${tourVisible ? 'bg-blue-500' : 'bg-stone-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${tourVisible ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div><label className="block text-xs font-bold text-stone-500 mb-1">Orden</label><input type="number" min="1" value={tourOrder} onChange={(e) => setTourOrder(parseInt(e.target.value))} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-center font-bold" /></div>
                                    <div><label className="block text-xs font-bold text-stone-500 mb-1">Velocidad</label><input type="number" min="50" max="1000" step="50" value={tourSpeed} onChange={(e) => setTourSpeed(parseInt(e.target.value))} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-center font-bold" /></div>
                                </div>
                                <div className="mb-4"><label className="flex justify-between text-xs font-bold text-stone-500 mb-1"><span>Zoom de Cámara</span><span>{tourZoomLevel}x</span></label><input type="range" min="0.5" max="2.5" step="0.1" value={tourZoomLevel} onChange={(e) => setTourZoomLevel(parseFloat(e.target.value))} className="w-full accent-blue-600" /></div>
                                <div><label className="block text-xs font-bold text-stone-500 mb-1">Mensaje final (Opcional)</label><textarea value={tourMessage} onChange={(e) => setTourMessage(e.target.value)} placeholder="Ej. ¡Llegamos a la cascada!" className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm resize-none h-16" /></div>
                            </div>
                        )}

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
                            <label className="flex items-center gap-3 text-sm font-medium mb-6 cursor-pointer hover:scale-[1.02] transition-transform"><input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color de la Línea</label>
                            <div className="mb-6"><label className="flex justify-between text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><span>Grosor</span><span>{lazoThickness}px</span></label><input type="range" min="1" max="20" value={lazoThickness} onChange={(e) => setLazoThickness(parseInt(e.target.value))} className="w-full accent-stone-800 cursor-pointer" /></div>
                            <div className="mb-6 flex items-center justify-between bg-white p-3 rounded-lg border border-stone-200"><span className="text-sm font-bold text-stone-700">Curvas Suaves</span><button onClick={() => setLazoIsSmooth(!lazoIsSmooth)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${lazoIsSmooth ? 'bg-emerald-500' : 'bg-stone-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${lazoIsSmooth ? 'translate-x-6' : 'translate-x-0'}`}></div></button></div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Textura / Estilo</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setLazoTexture('hilo')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'hilo' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Hilo Sólido</button>
                                <button onClick={() => setLazoTexture('punteada')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'punteada' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Punteado</button>
                                <button onClick={() => setLazoTexture('estambre')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'estambre' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Estambre Grueso</button>
                                <button onClick={() => setLazoTexture('flecha')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'flecha' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Flecha ➡️</button>
                                <button onClick={() => setLazoTexture('bidireccional')} className={`py-2 text-sm rounded-lg font-bold border col-span-2 transition-all active:scale-95 ${lazoTexture === 'bidireccional' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Bidireccional ↔️</button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={() => handleSaveSticker(stickerModalType)} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar Cambios</button></div>
                    </div>
                </div>
            )}

            {/* Modales Genéricos y Pegatina Animada */}
            {(['postit', 'date', 'link', 'location', 'music', 'counter', 'animated'].includes(stickerModalType)) && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            {stickerModalType === 'postit' && <StickyNote />}
                            {stickerModalType === 'date' && <Calendar />}
                            {stickerModalType === 'link' && <LinkIcon />}
                            {stickerModalType === 'location' && <MapPin />}
                            {stickerModalType === 'music' && <Music />}
                            {stickerModalType === 'counter' && <Hash />}
                            {stickerModalType === 'animated' && '✨ '}
                            {editingStickerId ? 'Editar Elemento' : 'Nuevo Elemento'}
                        </h2>

                        {renderRotationControls()}
                        {stickerModalType !== 'animated' && renderStyleControls()}

                        {stickerModalType === 'postit' && <textarea value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Escribe tu nota..." className="w-full h-32 p-4 rounded-xl resize-none font-serif text-lg mb-6 outline-none focus:ring-2 focus:ring-stone-400 border border-stone-200 shadow-inner" style={{ backgroundColor: stickerBgColor, color: stickerTextColor, fontWeight: stickerIsBold ? 'bold' : 'normal', fontStyle: stickerIsItalic ? 'italic' : 'normal' }} autoFocus />}
                        {stickerModalType === 'date' && <input type="date" value={stickerDate} onChange={(e) => setStickerDate(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none mb-8 text-xl text-center font-bold" />}
                        {(stickerModalType === 'link' || stickerModalType === 'location' || stickerModalType === 'music') && (
                            <>
                                <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder={stickerModalType === 'location' ? "Texto (Ej. Parque Estatal)" : stickerModalType === 'music' ? "Canción - Artista" : "Texto del botón"} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-4 font-medium text-center" autoFocus />
                                <input type="url" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder={stickerModalType === 'location' ? "Enlace de Maps (Opcional)" : stickerModalType === 'music' ? "Enlace a Spotify/YouTube" : "https://..."} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-8 text-sm" />
                            </>
                        )}
                        {stickerModalType === 'counter' && (
                            <div className="flex gap-3 mb-8">
                                <input type="text" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder="0" className="w-24 p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-black text-center text-3xl" autoFocus />
                                <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Días, Años, Fotos..." className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-bold uppercase tracking-widest text-sm" />
                            </div>
                        )}
                        {stickerModalType === 'animated' && (
                            <div className="mb-6">
                                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Estilo de Animación</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setAnimStyle('animate-bounce')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animStyle === 'animate-bounce' ? 'bg-blue-600 text-white border-blue-600' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Rebotar</button>
                                    <button onClick={() => setAnimStyle('animate-pulse')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animStyle === 'animate-pulse' ? 'bg-blue-600 text-white border-blue-600' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Pulsar</button>
                                    <button onClick={() => setAnimStyle('animate-spin')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animStyle === 'animate-spin' ? 'bg-blue-600 text-white border-blue-600' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Girar</button>
                                    <button onClick={() => setAnimStyle('animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]')} className={`py-2 text-sm rounded-lg font-bold border transition-all ${animStyle === 'animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]' ? 'bg-blue-600 text-white border-blue-600' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}>Latir</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button>
                            <button onClick={() => handleSaveSticker(stickerModalType)} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all">{editingStickerId ? 'Guardar' : 'Añadir'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}