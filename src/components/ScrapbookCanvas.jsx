import React, { useState, useCallback, useRef, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage } from '../utils';
import InteractablePhoto, { getLazoPath } from './InteractablePhoto';
import { ArrowLeft, Layers, SmilePlus, ImagePlus, Check, Edit3, X, StickyNote, Calendar, Link as LinkIcon, Loader2, Trash2, ChevronUp, MessageSquareText, MapPin, Edit2, Palette, PenTool, Brush, Music, Hash, Printer, ZoomIn, ZoomOut } from 'lucide-react';

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

export default function ScrapbookCanvas({ user, activeAlbum, activePhotos, setCurrentView, setActiveAlbumId, setDbError }) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Novedad: Control de Zoom
    const [zoom, setZoom] = useState(1);
    const scrollContainerRef = useRef(null);

    const [showLayers, setShowLayers] = useState(false);
    const [showStickerMenu, setShowStickerMenu] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);

    const [isDrawingLazo, setIsDrawingLazo] = useState(false);
    const [lazoPoints, setLazoPoints] = useState([]);

    const [selectedItemId, setSelectedItemId] = useState(null);
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

    const [photoDescText, setPhotoDescText] = useState("");
    const [photoTapeStyle, setPhotoTapeStyle] = useState("top");

    const [lazoTexture, setLazoTexture] = useState("hilo");
    const [lazoThickness, setLazoThickness] = useState(3);
    const [lazoIsSmooth, setLazoIsSmooth] = useState(true);

    const [deletePhotoId, setDeletePhotoId] = useState(null);
    const [selectedPhotoForDesc, setSelectedPhotoForDesc] = useState(null);

    const drawingCanvasRef = useRef(null);
    const [isDrawingCanvas, setIsDrawingCanvas] = useState(false);

    const activeBgId = activeAlbum?.canvasBg || 'dots';
    const bgClass = CANVAS_BACKGROUNDS[activeBgId]?.className || CANVAS_BACKGROUNDS.dots.className;
    const btnClass = "hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-sm font-medium flex items-center gap-2 px-5 py-3.5 rounded-2xl";

    // Función para Imprimir / Exportar a PDF
    const handlePrint = () => {
        window.print();
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

    // Calcula el centro de la pantalla actual (teniendo en cuenta el scroll y el zoom) para los nuevos elementos
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
                        description: "", frameColor: "#faf9f5", tapeStyle: "top"
                    });
                }
            }
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
        setIsUploading(false); e.target.value = '';
    };

    const updatePhoto = useCallback(async (photoId, updates) => {
        try { await setDoc(doc(db, 'artifacts', appId, 'photos', photoId), updates, { merge: true }); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    }, [user]);

    const confirmDeletePhoto = async () => {
        try { await deleteDoc(doc(db, 'artifacts', appId, 'photos', deletePhotoId)); setDeletePhotoId(null); setSelectedItemId(null); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const finishDrawingLazo = async (e) => {
        if (e) e.stopPropagation();
        if (lazoPoints.length < 2) { setIsDrawingLazo(false); setLazoPoints([]); return; }

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
            await setDoc(newLazoRef, {
                albumId: activeAlbum.id, type: 'lazo',
                points: normalizedPoints, x: minX, y: minY, width, height,
                baseWidth: width, baseHeight: height, rotation: 0,
                zIndex: maxZ + 1, color: '#1f2937', texture: 'hilo', thickness: 3, isSmooth: true
            });
            setSelectedItemId(newLazoRef.id);
        } catch (err) { if (err.code === 'permission-denied') setDbError('permissions'); }

        setIsDrawingLazo(false);
        setLazoPoints([]);
    };

    const handleSaveSticker = async (type) => {
        if (type === 'image') {
            await updatePhoto(editingStickerId, { description: photoDescText, frameColor: stickerBgColor, tapeStyle: photoTapeStyle });
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'lazo') {
            await updatePhoto(editingStickerId, { color: stickerBgColor, texture: lazoTexture, thickness: lazoThickness, isSmooth: lazoIsSmooth });
            setStickerModalType(null); setEditingStickerId(null); return;
        }
        if (type === 'drawing') {
            const base64Data = drawingCanvasRef.current.toDataURL('image/png');
            const drawingData = { type: 'drawing', src: base64Data, color: stickerBgColor, thickness: lazoThickness };
            try {
                if (editingStickerId) {
                    await updatePhoto(editingStickerId, drawingData);
                } else {
                    const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
                    const { startX, startY } = getCenterCoords(400);
                    const newStickerRef = doc(collection(db, 'artifacts', appId, 'photos'));
                    await setDoc(newStickerRef, { albumId: activeAlbum.id, ...drawingData, x: startX, y: startY, width: 400, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + 1 });
                    setSelectedItemId(newStickerRef.id);
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
            isBold: stickerIsBold, isItalic: stickerIsItalic, ...(type === 'date' ? { rawDate: stickerDate } : {})
        };

        try {
            if (editingStickerId) await updatePhoto(editingStickerId, stickerData);
            else {
                const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
                const { startX, startY } = getCenterCoords(width);

                const newStickerRef = doc(collection(db, 'artifacts', appId, 'photos'));
                await setDoc(newStickerRef, { albumId: activeAlbum.id, ...stickerData, x: startX, y: startY, width, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + 1 });
                setSelectedItemId(newStickerRef.id);
            }
            setStickerModalType(null); setEditingStickerId(null); setShowStickerMenu(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleAddEmoji = async (emoji) => {
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const { startX, startY } = getCenterCoords(120);
        try {
            const newEmojiRef = doc(collection(db, 'artifacts', appId, 'photos'));
            await setDoc(newEmojiRef, { albumId: activeAlbum.id, type: 'emoji', content: emoji, x: startX, y: startY, width: 120, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + 1 });
            setSelectedItemId(newEmojiRef.id);
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
            if (type === 'image' || !type) {
                setPhotoDescText(photoToEdit.description || "");
                setStickerBgColor(photoToEdit.frameColor || "#faf9f5");
                setPhotoTapeStyle(photoToEdit.tapeStyle || "top");
            } else if (type === 'lazo') {
                setStickerBgColor(photoToEdit.color || "#1f2937");
                setLazoTexture(photoToEdit.texture || "hilo");
                setLazoThickness(photoToEdit.thickness || 3);
                setLazoIsSmooth(photoToEdit.isSmooth !== false);
            } else if (type === 'drawing') {
                setStickerBgColor(photoToEdit.color || "#1f2937");
                setLazoThickness(photoToEdit.thickness || 3);
                setStickerInputText(photoToEdit.src || "");
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
            setStickerInputText(""); setStickerInputUrl("");
            setStickerBgColor(type === 'postit' ? '#fef08a' : (type === 'link' || type === 'music' || type === 'counter') ? '#3b82f6' : type === 'drawing' ? '#1f2937' : '#ffffff');
            setStickerBorderColor(type === 'location' ? '#f43f5e' : (type === 'link' || type === 'music' || type === 'counter') ? '#ffffff' : '#e5e7eb');
            setStickerTextColor((type === 'link' || type === 'music' || type === 'counter') ? '#ffffff' : type === 'location' ? '#e11d48' : '#1f2937');
            setStickerIsBold(type === 'link' || type === 'location' || type === 'date' || type === 'music' || type === 'counter');
            setStickerIsItalic(false);
            setLazoThickness(3);
            setStickerDate(new Date().toISOString().split('T')[0]);
        }
        setShowStickerMenu(false);
    };

    const renderStyleControls = () => (
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Estilo Visual</p>
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

    return (
        <div className="h-screen flex flex-col font-sans overflow-hidden bg-stone-100 relative">
            {/* HEADER CONTROLS (Ocultos al imprimir) */}
            <div className="absolute top-6 left-6 right-6 z-[99999] flex justify-between gap-4 pointer-events-none print:hidden">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-5 pointer-events-auto">
                    <button onClick={() => { setCurrentView('dashboard'); setActiveAlbumId(null); setSelectedItemId(null); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full hover:scale-110 active:scale-95 transition-all"><ArrowLeft size={22} /></button>
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
                                            <button onClick={() => { setIsDrawingLazo(true); setShowStickerMenu(false); }} className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md"><PenTool size={16} /> Lazo</button>
                                            <button onClick={() => openStickerModal('drawing')} className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md"><Brush size={16} /> Dibujo Libre</button>
                                        </div>
                                        <div className="border-t border-stone-100 my-1"></div>

                                        <div className="flex flex-col gap-4 px-3 py-3 max-h-80 overflow-y-auto">
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Pines y Papelería</p><div className="flex flex-wrap gap-2">{['📌', '📍', '📎', '🖇️', '🏷️', '🩹', '📏', '✂️', '🗑️', '📋'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Fotografía y Scrapbook</p><div className="flex flex-wrap gap-2">{['📷', '📸', '🎞️', '📽️', '🖼️', '📔', '📓', '🎨', '🖌️', '🔍'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Estrellas y Galaxias</p><div className="flex flex-wrap gap-2">{['🌌', '🪐', '🌍', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '☀️', '⭐', '🌟', '✨', '☄️', '🌠', '🚀', '🛸', '🔭', '👽'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Cielo y Paisajes</p><div className="flex flex-wrap gap-2">{['☁️', '⛅', '🌤️', '🌥️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌈', '🌅', '🌄', '🏜️', '🏖️', '🏕️', '⛰️', '🏔️', '🗻', '🌋', '🏞️'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Flechas y Conectores</p><div className="flex flex-wrap gap-2">{['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '↪️', '↩️', '⤵️', '⤴️', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '〰️', '➰', '➿', '🎀', '🎗️', '🧵', '🧶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform" title="Añadir al lienzo">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Biología & Naturaleza</p><div className="flex flex-wrap gap-2">{['🧬', '🔬', '🦠', '🌿', '🍄', '🌱', '🌳', '🍂', '🌵', '🌾', '🌴', '🌺', '🌻', '🌼', '🌷', '🐞', '🦋', '🐝', '🐜', '🕷️', '🕸️'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Aves</p><div className="flex flex-wrap gap-2">{['🦅', '🦉', '🦜', '🦆', '🦩', '🕊️', '🐧', '🪶', '🦢', '🐓', '🦚', '🦃', '🐥', '🐤', '🐣'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Vida Marina</p><div className="flex flex-wrap gap-2">{['🐟', '🐠', '🐡', '🦈', '🐙', '🦀', '🐢', '🐋', '🐚', '🐬', '🦑', '🦐', '🦞', '🦭', '🫧', '🌊'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
                                            <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Generales</p><div className="flex flex-wrap gap-2">{['💖', '🌟', '✨', '✈️', '🎉', '🎈', '🎁', '🔮', '💡', '💌', '📝', '✏️', '✒️', '🖋️', '🖍️'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div></div>
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
                    <button onClick={() => { setIsEditMode(!isEditMode); setSelectedItemId(null); setShowBgMenu(false); setShowLayers(false); setShowStickerMenu(false); setIsDrawingLazo(false); }} className={`${btnClass} bg-white text-stone-700 border hover:bg-stone-50`}>
                        {isEditMode ? <Check size={20} /> : <Edit3 size={20} />} {isEditMode ? 'Terminar Edición' : 'Editar Álbum'}
                    </button>
                </div>
            </div>

            {/* CONTROLES FLOTANTES DE ZOOM E IMPRESIÓN (Abajo a la derecha) */}
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

            {/* MENÚ DE CAPAS */}
            {showLayers && isEditMode && (
                <div className="absolute top-24 right-6 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 z-[99999] border border-stone-200 print:hidden">
                    <h3 className="font-bold mb-3 flex items-center justify-between text-stone-800">Capas <button onClick={() => setShowLayers(false)} className="p-1 hover:bg-stone-100 rounded-full hover:scale-110 active:scale-95 transition-all"><X size={16} /></button></h3>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                        {[...activePhotos].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(p => {
                            const isEditable = !p.type || ['image', 'postit', 'date', 'link', 'music', 'counter', 'location', 'lazo', 'drawing'].includes(p.type);
                            return (
                                <div key={p.id} onClick={() => setSelectedItemId(p.id)} className={`flex items-center justify-between p-2.5 rounded-xl text-sm group cursor-pointer transition-all border ${selectedItemId === p.id ? 'bg-indigo-50 border-indigo-300 shadow-sm scale-[1.02]' : 'bg-stone-50 border-stone-100 hover:border-indigo-200'}`}>
                                    <span className={`truncate w-24 font-medium text-xs ${selectedItemId === p.id ? 'text-indigo-800' : 'text-stone-600'}`}>
                                        {p.type === 'postit' ? 'Post-it' : p.type === 'date' ? 'Fecha' : p.type === 'location' ? 'Ubicación' : p.type === 'link' ? 'Enlace' : p.type === 'music' ? 'Canción' : p.type === 'counter' ? 'Contador' : p.type === 'lazo' ? 'Lazo' : p.type === 'drawing' ? 'Dibujo Libre' : p.type === 'emoji' ? p.content : 'Imagen'}
                                    </span>
                                    <div className="flex gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                        {isEditable && <button onClick={(e) => { e.stopPropagation(); openStickerModal(p.type, p); }} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg hover:scale-110 active:scale-95 transition-all" title="Editar"><Edit2 size={14} /></button>}
                                        <button onClick={(e) => { e.stopPropagation(); bringToFront(p.id); }} className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg hover:scale-110 active:scale-95 transition-all" title="Traer al frente"><ChevronUp size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeletePhotoId(p.id); }} className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg hover:scale-110 active:scale-95 transition-all" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* CANVAS PRINCIPAL Y ÁREA EXPANDIDA (Soporta Zoom) */}
            <div
                ref={scrollContainerRef}
                className={`flex-1 relative w-full overflow-auto transition-colors duration-500 ${bgClass} print:bg-white print:overflow-visible`}
            >
                <div
                    className="w-[4000px] h-[3000px] origin-top-left transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                    onPointerDown={() => isEditMode && !isDrawingLazo && setSelectedItemId(null)}
                >
                    {/* Capa de intercepción para dibujar el lazo */}
                    {isDrawingLazo && (
                        <div className="absolute inset-0 z-[200] cursor-crosshair" onPointerDown={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setLazoPoints(prev => [...prev, { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }]); }}>
                            <svg className="w-full h-full pointer-events-none drop-shadow-md">
                                {lazoPoints.length > 0 && <path d={getLazoPath(lazoPoints, true)} fill="none" stroke="#1f2937" strokeWidth="3" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" />}
                                {lazoPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />)}
                            </svg>
                        </div>
                    )}

                    <div className="w-full h-full relative pointer-events-none">
                        <div className="pointer-events-auto w-full h-full">
                            {activePhotos.map(photo => (
                                <InteractablePhoto key={photo.id} photo={photo} updatePhoto={updatePhoto} deletePhoto={(id) => { setDeletePhotoId(id); setSelectedItemId(null); }} isEditMode={isEditMode && !isDrawingLazo} isSelected={selectedItemId === photo.id} onSelect={() => setSelectedItemId(photo.id)} onBringToFront={bringToFront} onClickView={(p) => setSelectedPhotoForDesc(p)} onEditClick={(p) => openStickerModal(p.type, p)} zoom={zoom} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* PANEL FIJO MIENTRAS SE DIBUJA EL LAZO */}
            {isDrawingLazo && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex items-center gap-6 border border-stone-200 z-[99999]">
                    <div><p className="font-bold text-stone-800 text-lg">Trazando Lazo...</p><p className="text-sm text-stone-500">Haz clic en diferentes puntos para dibujar</p></div>
                    <div className="flex gap-3"><button onClick={() => { setIsDrawingLazo(false); setLazoPoints([]); }} className="px-5 py-2 hover:bg-stone-100 rounded-full font-medium hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={finishDrawingLazo} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Terminar Lazo</button></div>
                </div>
            )}

            {/* MODAL MODO FACEBOOK (PANTALLA COMPLETA) - z-[99999] */}
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

            {/* OTROS MODALES DE EDICIÓN (z-[99999]) */}
            {deletePhotoId && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden"><div className="bg-white p-8 rounded-3xl w-full max-w-sm"><h2 className="text-2xl font-bold mb-4">Eliminar Elemento</h2><div className="flex justify-end gap-3"><button onClick={() => setDeletePhotoId(null)} className="px-5 py-2 hover:bg-stone-100 rounded-full font-medium hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={confirmDeletePhoto} className="px-6 py-2 bg-rose-600 text-white rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-md hover:bg-rose-700">Eliminar</button></div></div></div>
            )}

            {/* Modal: Dibujo Libre (NUEVO) */}
            {stickerModalType === 'drawing' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Brush /> {editingStickerId ? 'Editar Dibujo' : 'Nuevo Dibujo Libre'}</h2>

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

            {/* Modal: Editar Lazo */}
            {stickerModalType === 'lazo' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800"><PenTool /> Editar Lazo / Conector</h2>

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
                            <label className="flex items-center gap-3 text-sm font-medium mb-6 cursor-pointer hover:scale-[1.02] transition-transform">
                                <input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color de la Línea
                            </label>

                            <div className="mb-6">
                                <label className="flex justify-between text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                                    <span>Grosor</span>
                                    <span>{lazoThickness}px</span>
                                </label>
                                <input type="range" min="1" max="20" value={lazoThickness} onChange={(e) => setLazoThickness(parseInt(e.target.value))} className="w-full accent-stone-800 cursor-pointer" />
                            </div>

                            <div className="mb-6 flex items-center justify-between bg-white p-3 rounded-lg border border-stone-200">
                                <span className="text-sm font-bold text-stone-700">Curvas Suaves</span>
                                <button onClick={() => setLazoIsSmooth(!lazoIsSmooth)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${lazoIsSmooth ? 'bg-emerald-500' : 'bg-stone-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${lazoIsSmooth ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
                            </div>

                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Textura / Estilo</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setLazoTexture('hilo')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'hilo' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Hilo Sólido</button>
                                <button onClick={() => setLazoTexture('punteada')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'punteada' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Punteado</button>
                                <button onClick={() => setLazoTexture('estambre')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'estambre' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Estambre Grueso</button>
                                <button onClick={() => setLazoTexture('flecha')} className={`py-2 text-sm rounded-lg font-bold border transition-all active:scale-95 ${lazoTexture === 'flecha' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Flecha ➡️</button>
                                <button onClick={() => setLazoTexture('bidireccional')} className={`py-2 text-sm rounded-lg font-bold border col-span-2 transition-all active:scale-95 ${lazoTexture === 'bidireccional' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>Bidireccional ↔️</button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all text-stone-600">Cancelar</button><button onClick={() => handleSaveSticker('lazo')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all">Guardar Cambios</button></div>
                    </div>
                </div>
            )}

            {/* Modales: Post-it, Fecha, Enlace, Ubicación, Canción, Contador */}
            {(stickerModalType === 'postit' || stickerModalType === 'date' || stickerModalType === 'link' || stickerModalType === 'location' || stickerModalType === 'music' || stickerModalType === 'counter') && (
                <div className="fixed inset-0 bg-stone-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            {stickerModalType === 'postit' && <StickyNote />}
                            {stickerModalType === 'date' && <Calendar />}
                            {stickerModalType === 'link' && <LinkIcon />}
                            {stickerModalType === 'location' && <MapPin />}
                            {stickerModalType === 'music' && <Music />}
                            {stickerModalType === 'counter' && <Hash />}
                            {editingStickerId ? 'Editar Elemento' : 'Nuevo Elemento'}
                        </h2>
                        {renderStyleControls()}

                        {/* Renderizado condicional de los inputs según el tipo */}
                        {stickerModalType === 'postit' && (
                            <textarea value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Escribe tu nota..." className="w-full h-32 p-4 rounded-xl resize-none font-serif text-lg mb-6 outline-none focus:ring-2 focus:ring-stone-400 border border-stone-200 shadow-inner" style={{ backgroundColor: stickerBgColor, color: stickerTextColor, fontWeight: stickerIsBold ? 'bold' : 'normal', fontStyle: stickerIsItalic ? 'italic' : 'normal' }} autoFocus />
                        )}
                        {stickerModalType === 'date' && (
                            <input type="date" value={stickerDate} onChange={(e) => setStickerDate(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none mb-8 text-xl text-center font-bold" />
                        )}
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