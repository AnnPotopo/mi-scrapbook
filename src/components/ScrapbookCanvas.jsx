import React, { useState, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage } from '../utils';
import InteractablePhoto from './InteractablePhoto';
import { ArrowLeft, Layers, SmilePlus, ImagePlus, Check, Edit3, X, StickyNote, Calendar, Link as LinkIcon, Loader2, Trash2, ChevronUp, MessageSquareText, MapPin, Edit2, Palette } from 'lucide-react';

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

    const [showLayers, setShowLayers] = useState(false);
    const [showStickerMenu, setShowStickerMenu] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);

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

    // Novedad: Opciones para Editar Fotos
    const [photoDescText, setPhotoDescText] = useState("");
    const [photoTapeStyle, setPhotoTapeStyle] = useState("top");

    const [deletePhotoId, setDeletePhotoId] = useState(null);
    const [selectedPhotoForDesc, setSelectedPhotoForDesc] = useState(null);

    const activeBgId = activeAlbum?.canvasBg || 'dots';
    const bgClass = CANVAS_BACKGROUNDS[activeBgId]?.className || CANVAS_BACKGROUNDS.dots.className;

    // BOTONES UNIVERSALES ESTILOS
    const btnClass = "hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-sm font-medium flex items-center gap-2 px-5 py-3.5 rounded-2xl";

    const handleFileUpload = async (e) => {
        if (!user || !activeAlbum.id) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setIsUploading(true);
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        try {
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    const base64Data = await compressImage(files[i]);
                    await setDoc(doc(collection(db, 'artifacts', appId, 'photos')), {
                        albumId: activeAlbum.id, type: 'image', src: base64Data, x: 50 + (i * 30), y: 50 + (i * 30),
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

    const handleSaveSticker = async (type) => {
        if (type === 'image') {
            await updatePhoto(editingStickerId, { description: photoDescText, frameColor: stickerBgColor, tapeStyle: photoTapeStyle });
            setStickerModalType(null); setEditingStickerId(null);
            return;
        }

        let width = 250;
        if (type === 'date' || type === 'location') width = 220;

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
                const startX = Math.max(50, window.innerWidth / 2 - (width / 2) + (Math.random() * 50 - 25));
                const startY = Math.max(50, window.innerHeight / 2 - 100 + (Math.random() * 50 - 25));

                const newStickerRef = doc(collection(db, 'artifacts', appId, 'photos'));
                await setDoc(newStickerRef, { albumId: activeAlbum.id, ...stickerData, x: startX, y: startY, width, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + 1 });
                setSelectedItemId(newStickerRef.id);
            }
            setStickerModalType(null); setEditingStickerId(null); setShowStickerMenu(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleAddEmoji = async (emoji) => {
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        const startX = Math.max(50, window.innerWidth / 2 - 60 + (Math.random() * 50 - 25));
        const startY = Math.max(50, window.innerHeight / 2 - 100 + (Math.random() * 50 - 25));
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
            setStickerBgColor(type === 'postit' ? '#fef08a' : type === 'link' ? '#3b82f6' : '#ffffff');
            setStickerBorderColor(type === 'location' ? '#f43f5e' : type === 'link' ? '#ffffff' : '#e5e7eb');
            setStickerTextColor(type === 'link' ? '#ffffff' : type === 'location' ? '#e11d48' : '#1f2937');
            setStickerIsBold(type === 'link' || type === 'location' || type === 'date');
            setStickerIsItalic(false);
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
        <div className="min-h-screen flex flex-col font-sans overflow-hidden bg-stone-100">
            {/* HEADER CONTROLS */}
            <div className="absolute top-6 left-6 right-6 z-50 flex justify-between gap-4">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-5">
                    <button onClick={() => { setCurrentView('dashboard'); setActiveAlbumId(null); setSelectedItemId(null); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full hover:scale-110 active:scale-95 transition-all"><ArrowLeft size={22} /></button>
                    <div><h2 className="text-xl font-bold font-serif text-stone-800">{activeAlbum?.name}</h2></div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <>
                            <div className="relative">
                                <button onClick={() => { setShowBgMenu(!showBgMenu); setShowStickerMenu(false); setShowLayers(false); }} className={`${btnClass} bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100`}>
                                    <Palette size={20} /> <span className="hidden sm:inline">Fondo</span>
                                </button>
                                {showBgMenu && (
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 w-72 z-[60]">
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
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 w-80 flex flex-col z-[60]">
                                        <div className="grid grid-cols-2 gap-1 mb-2">
                                            <button onClick={() => openStickerModal('postit')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><StickyNote size={16} className="text-yellow-500" /> Post-it</button>
                                            <button onClick={() => openStickerModal('date')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><Calendar size={16} className="text-blue-500" /> Fecha</button>
                                            <button onClick={() => openStickerModal('link')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><LinkIcon size={16} className="text-emerald-500" /> Enlace</button>
                                            <button onClick={() => openStickerModal('location')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"><MapPin size={16} className="text-rose-500" /> Ubicación</button>
                                        </div>
                                        <div className="border-t border-stone-100 my-1"></div>
                                        <div className="flex flex-col gap-4 px-3 py-3 max-h-72 overflow-y-auto">
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Flechas y Conectores</p>
                                                <div className="flex flex-wrap gap-2">{['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '↪️', '↩️', '⤵️', '⤴️', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '〰️', '➰', '➿', '🎀', '🎗️', '🧵', '🧶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Biología & Naturaleza</p>
                                                <div className="flex flex-wrap gap-2">{['🧬', '🔬', '🦠', '🌿', '🍄', '🌱', '🌳', '🍂'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Aves</p>
                                                <div className="flex flex-wrap gap-2">{['🦅', '🦉', '🦜', '🦆', '🦩', '🕊️', '🐧', '🪶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Vida Marina</p>
                                                <div className="flex flex-wrap gap-2">{['🐟', '🐠', '🐡', '🦈', '🐙', '🦀', '🐢', '🐋', '🐚'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Generales</p>
                                                <div className="flex flex-wrap gap-2">{['💖', '🌟', '📌', '🔥', '✨', '✈️', '📸', '🎉'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 active:scale-95 transition-transform">{e}</button>)}</div>
                                            </div>
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
                    <button onClick={() => { setIsEditMode(!isEditMode); setSelectedItemId(null); setShowBgMenu(false); setShowLayers(false); setShowStickerMenu(false); }} className={`${btnClass} bg-white text-stone-700 border hover:bg-stone-50`}>
                        {isEditMode ? <Check size={20} /> : <Edit3 size={20} />} {isEditMode ? 'Terminar Edición' : 'Editar Álbum'}
                    </button>
                </div>
            </div>

            {/* MENÚ DE CAPAS */}
            {showLayers && isEditMode && (
                <div className="absolute top-24 right-6 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 z-[100] border border-stone-200">
                    <h3 className="font-bold mb-3 flex items-center justify-between text-stone-800">Capas <button onClick={() => setShowLayers(false)} className="p-1 hover:bg-stone-100 rounded-full hover:scale-110 active:scale-95 transition-all"><X size={16} /></button></h3>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                        {[...activePhotos].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(p => {
                            const isEditable = !p.type || ['image', 'postit', 'date', 'link', 'location'].includes(p.type);
                            return (
                                <div key={p.id} onClick={() => setSelectedItemId(p.id)} className={`flex items-center justify-between p-2.5 rounded-xl text-sm group cursor-pointer transition-all border ${selectedItemId === p.id ? 'bg-indigo-50 border-indigo-300 shadow-sm scale-[1.02]' : 'bg-stone-50 border-stone-100 hover:border-indigo-200'}`}>
                                    <span className={`truncate w-24 font-medium text-xs ${selectedItemId === p.id ? 'text-indigo-800' : 'text-stone-600'}`}>
                                        {p.type === 'postit' ? 'Post-it' : p.type === 'date' ? 'Fecha' : p.type === 'location' ? 'Ubicación' : p.type === 'link' ? 'Enlace' : p.type === 'emoji' ? p.content : 'Imagen'}
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

            {/* CANVAS */}
            <div className={`flex-1 relative w-full overflow-auto transition-colors duration-500 ${bgClass}`}>
                <div className="w-full h-full min-w-[100vw] min-h-[100vh] relative p-20" onPointerDown={() => isEditMode && setSelectedItemId(null)}>
                    {activePhotos.map(photo => (
                        <InteractablePhoto key={photo.id} photo={photo} updatePhoto={updatePhoto} deletePhoto={(id) => { setDeletePhotoId(id); setSelectedItemId(null); }} isEditMode={isEditMode} isSelected={selectedItemId === photo.id} onSelect={() => setSelectedItemId(photo.id)} onBringToFront={bringToFront} onClickView={(p) => setSelectedPhotoForDesc(p)} onEditClick={(p) => openStickerModal(p.type, p)} />
                    ))}
                </div>
            </div>

            {/* MODAL MODO FACEBOOK (PANTALLA COMPLETA) */}
            {selectedPhotoForDesc && !isEditMode && (
                <div className="fixed inset-0 bg-black/95 z-[120] flex flex-col md:flex-row animate-in fade-in duration-300" onClick={() => setSelectedPhotoForDesc(null)}>

                    {/* Botón de Cierre */}
                    <button className="absolute top-4 left-4 z-50 text-white/50 hover:text-white p-2 hover:scale-110 active:scale-95 transition-all" onClick={() => setSelectedPhotoForDesc(null)}><X size={32} /></button>

                    {/* Área de la Foto (Izquierda) */}
                    <div className="flex-1 p-6 md:p-12 flex items-center justify-center relative">
                        <img src={selectedPhotoForDesc.src} alt="Detalle" className="max-w-full max-h-full object-contain drop-shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    </div>

                    {/* Panel de Descripción (Derecha) */}
                    <div className="w-full md:w-[400px] h-1/3 md:h-full bg-white shadow-2xl flex flex-col relative z-10 slide-in-from-bottom-full md:slide-in-from-right-full duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 md:p-8 border-b border-stone-100 flex items-center gap-4 bg-stone-50/50">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0 shadow-inner"><MessageSquareText size={24} /></div>
                            <div>
                                <h3 className="font-serif font-bold text-2xl text-stone-800">El Recuerdo</h3>
                                <p className="text-stone-400 text-sm">Historia de esta fotografía</p>
                            </div>
                        </div>
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                            {selectedPhotoForDesc.description ? (
                                <p className="text-stone-700 leading-relaxed font-serif text-lg md:text-xl whitespace-pre-wrap">{selectedPhotoForDesc.description}</p>
                            ) : (
                                <div className="text-center mt-10">
                                    <p className="text-stone-400 italic text-lg mb-2">Aún no has escrito la historia de esta foto.</p>
                                    <p className="text-stone-300 text-sm">Activa el Modo Edición y dale al botón de Editar sobre la foto para añadirle una descripción secreta.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* OTROS MODALES DE EDICIÓN */}
            {deletePhotoId && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white p-8 rounded-3xl w-full max-w-sm"><h2 className="text-2xl font-bold mb-4">Eliminar Elemento</h2><div className="flex justify-end gap-3"><button onClick={() => setDeletePhotoId(null)} className="px-5 py-2 hover:bg-stone-100 rounded-full font-medium hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={confirmDeletePhoto} className="px-6 py-2 bg-rose-600 text-white rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-md hover:bg-rose-700">Eliminar</button></div></div></div>
            )}

            {/* Modal: Editar Imagen (Marco, Cinta y Descripción) */}
            {stickerModalType === 'image' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-stone-800"><ImagePlus /> Detalles de la Foto</h2>

                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">Estilo Visual</p>
                            <label className="flex items-center gap-3 text-sm font-medium mb-4 cursor-pointer hover:scale-[1.02] transition-transform">
                                <input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-10 h-10 p-0 border-2 border-stone-300 rounded cursor-pointer" /> Color del Marco
                            </label>

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

            {/* Modal: Post-it */}
            {stickerModalType === 'postit' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><StickyNote /> {editingStickerId ? 'Editar Post-it' : 'Nuevo Post-it'}</h2>
                        {renderStyleControls()}
                        <textarea value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Escribe tu nota..." className="w-full h-32 p-4 rounded-xl resize-none font-serif text-lg mb-6 outline-none focus:ring-2 focus:ring-stone-400 border border-stone-200 shadow-inner" style={{ backgroundColor: stickerBgColor, color: stickerTextColor, fontWeight: stickerIsBold ? 'bold' : 'normal', fontStyle: stickerIsItalic ? 'italic' : 'normal' }} autoFocus />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={() => handleSaveSticker('postit')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all">{editingStickerId ? 'Guardar' : 'Pegar'}</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Fecha */}
            {stickerModalType === 'date' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Calendar /> {editingStickerId ? 'Editar Fecha' : 'Seleccionar Fecha'}</h2>
                        {renderStyleControls()}
                        <input type="date" value={stickerDate} onChange={(e) => setStickerDate(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none mb-8 text-xl text-center font-bold" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={() => handleSaveSticker('date')} className="px-6 py-2 bg-stone-800 text-white rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all">{editingStickerId ? 'Guardar' : 'Añadir Fecha'}</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Enlace */}
            {stickerModalType === 'link' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2"><LinkIcon /> {editingStickerId ? 'Editar Enlace' : 'Nuevo Enlace'}</h2>
                        {renderStyleControls()}
                        <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Texto del botón" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-4 font-medium" autoFocus />
                        <input type="url" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder="https://..." className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-8" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={() => handleSaveSticker('link')} className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all">{editingStickerId ? 'Guardar' : 'Añadir'}</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Ubicación */}
            {stickerModalType === 'location' && (
                <div className="fixed inset-0 bg-stone-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 text-rose-600 flex items-center gap-2"><MapPin /> {editingStickerId ? 'Editar Ubicación' : 'Ubicación'}</h2>
                        {renderStyleControls()}
                        <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Texto (Ej. Parque Estatal)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-4 font-medium text-center" autoFocus />
                        <input type="url" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder="Enlace de Google Maps (Opcional)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-8 text-sm" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }} className="px-5 py-2 font-medium hover:bg-stone-100 rounded-full hover:scale-105 active:scale-95 transition-all">Cancelar</button><button onClick={() => handleSaveSticker('location')} className="px-6 py-2 bg-rose-600 text-white rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all">{editingStickerId ? 'Guardar' : 'Añadir'}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}