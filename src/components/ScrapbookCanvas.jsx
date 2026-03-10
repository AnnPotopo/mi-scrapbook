import React, { useState, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage } from '../utils';
import InteractablePhoto from './InteractablePhoto';
import { ArrowLeft, Layers, SmilePlus, ImagePlus, Check, Edit3, X, StickyNote, Calendar, Link as LinkIcon, Loader2, Save, Trash2, ChevronUp, ChevronDown, MessageSquareText, MapPin, Edit2, Palette } from 'lucide-react';

// --- Catálogo de Fondos de Lienzo ---
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

    // Estados de los menús
    const [showLayers, setShowLayers] = useState(false);
    const [showStickerMenu, setShowStickerMenu] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);

    const [selectedItemId, setSelectedItemId] = useState(null);
    const [editingStickerId, setEditingStickerId] = useState(null);
    const [stickerModalType, setStickerModalType] = useState(null);
    const [stickerInputText, setStickerInputText] = useState("");
    const [stickerInputUrl, setStickerInputUrl] = useState("");
    const [stickerDate, setStickerDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Estados de Estilos Universales
    const [stickerBgColor, setStickerBgColor] = useState("#ffffff");
    const [stickerBorderColor, setStickerBorderColor] = useState("#e5e7eb");
    const [stickerTextColor, setStickerTextColor] = useState("#1f2937");
    const [stickerIsBold, setStickerIsBold] = useState(false);
    const [stickerIsItalic, setStickerIsItalic] = useState(false);

    const [deletePhotoId, setDeletePhotoId] = useState(null);
    const [selectedPhotoForDesc, setSelectedPhotoForDesc] = useState(null);
    const [descText, setDescText] = useState("");

    // Fondo actual guardado en el álbum (por defecto puntos)
    const activeBgId = activeAlbum?.canvasBg || 'dots';
    const bgClass = CANVAS_BACKGROUNDS[activeBgId]?.className || CANVAS_BACKGROUNDS.dots.className;

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
                        albumId: activeAlbum.id, src: base64Data, x: 50 + (i * 30), y: 50 + (i * 30),
                        width: 300, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + i + 1, description: ""
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
                await setDoc(newStickerRef, { albumId: activeAlbum.id, ...stickerData, x: startX, y: startY, width, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + 1, description: "" });
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

    // Función para cambiar el fondo del álbum y guardarlo en Firebase
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
        setStickerModalType(type);
        if (photoToEdit) {
            setEditingStickerId(photoToEdit.id);
            setStickerInputText(photoToEdit.content || "");
            setStickerInputUrl(photoToEdit.url || "");
            setStickerBgColor(photoToEdit.bgColor || "#ffffff");
            setStickerBorderColor(photoToEdit.borderColor || "#e5e7eb");
            setStickerTextColor(photoToEdit.textColor || "#1f2937");
            setStickerIsBold(photoToEdit.isBold || false);
            setStickerIsItalic(photoToEdit.isItalic || false);
            if (type === 'date') setStickerDate(photoToEdit.rawDate || new Date().toISOString().split('T')[0]);
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
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerBgColor} onChange={e => setStickerBgColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded" /> Fondo</label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerBorderColor} onChange={e => setStickerBorderColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded" /> Contorno</label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer"><input type="color" value={stickerTextColor} onChange={e => setStickerTextColor(e.target.value)} className="w-8 h-8 p-0 border-0 rounded" /> Letra</label>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setStickerIsBold(!stickerIsBold)} className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${stickerIsBold ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>B Negrita</button>
                <button onClick={() => setStickerIsItalic(!stickerIsItalic)} className={`flex-1 py-2 rounded-lg italic border transition-colors ${stickerIsItalic ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}>I Cursiva</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col font-sans overflow-hidden bg-stone-100">
            {/* HEADER CONTROLS */}
            <div className="absolute top-6 left-6 right-6 z-50 flex justify-between gap-4">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-5">
                    <button onClick={() => { setCurrentView('dashboard'); setActiveAlbumId(null); setSelectedItemId(null); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full"><ArrowLeft size={22} /></button>
                    <div><h2 className="text-xl font-bold font-serif text-stone-800">{activeAlbum?.name}</h2></div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <>
                            {/* NUEVO: Menú de Fondo */}
                            <div className="relative">
                                <button onClick={() => { setShowBgMenu(!showBgMenu); setShowStickerMenu(false); setShowLayers(false); }} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-5 py-3.5 rounded-2xl border border-purple-200 hover:bg-purple-100 transition-colors font-medium shadow-sm">
                                    <Palette size={20} /> <span className="hidden sm:inline">Fondo</span>
                                </button>
                                {showBgMenu && (
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 w-72 z-[60]">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Fondo del Lienzo</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(CANVAS_BACKGROUNDS).map(([key, bg]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handleBgChange(key)}
                                                    className={`p-2.5 rounded-xl border-2 text-xs font-bold text-center transition-all ${activeBgId === key ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-stone-100 text-stone-600 hover:border-purple-200 hover:bg-stone-50'}`}
                                                >
                                                    {bg.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => { setShowLayers(!showLayers); setShowStickerMenu(false); setShowBgMenu(false); }} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-3.5 rounded-2xl border border-indigo-200 hover:bg-indigo-100 font-medium shadow-sm"><Layers size={20} /> <span className="hidden sm:inline">Capas</span></button>

                            <div className="relative">
                                <button onClick={() => { setShowStickerMenu(!showStickerMenu); setShowLayers(false); setShowBgMenu(false); }} className="flex items-center gap-2 bg-pink-50 text-pink-700 px-5 py-3.5 rounded-2xl border border-pink-200 hover:bg-pink-100 font-medium shadow-sm">
                                    <SmilePlus size={20} /> <span className="hidden sm:inline">Pegatinas</span>
                                </button>
                                {showStickerMenu && (
                                    <div className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 w-80 flex flex-col z-[60]">
                                        <div className="grid grid-cols-2 gap-1 mb-2">
                                            <button onClick={() => openStickerModal('postit')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium"><StickyNote size={16} className="text-yellow-500" /> Post-it</button>
                                            <button onClick={() => openStickerModal('date')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium"><Calendar size={16} className="text-blue-500" /> Fecha</button>
                                            <button onClick={() => openStickerModal('link')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium"><LinkIcon size={16} className="text-emerald-500" /> Enlace</button>
                                            <button onClick={() => openStickerModal('location')} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded-xl text-left text-sm font-medium"><MapPin size={16} className="text-rose-500" /> Ubicación</button>
                                        </div>
                                        <div className="border-t border-stone-100 my-1"></div>

                                        <div className="flex flex-col gap-4 px-3 py-3 max-h-72 overflow-y-auto">
                                            {/* NUEVO: Catálogo de Flechas y Conectores */}
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Flechas y Conectores</p>
                                                <div className="flex flex-wrap gap-2">{['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '↪️', '↩️', '⤵️', '⤴️', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '〰️', '➰', '➿', '🎀', '🎗️', '🧵', '🧶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 transition-transform" title="Añadir al lienzo">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Biología & Naturaleza</p>
                                                <div className="flex flex-wrap gap-2">{['🧬', '🔬', '🦠', '🌿', '🍄', '🌱', '🌳', '🍂'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Aves</p>
                                                <div className="flex flex-wrap gap-2">{['🦅', '🦉', '🦜', '🦆', '🦩', '🕊️', '🐧', '🪶'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Vida Marina</p>
                                                <div className="flex flex-wrap gap-2">{['🐟', '🐠', '🐡', '🦈', '🐙', '🦀', '🐢', '🐋', '🐚'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}</div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Generales</p>
                                                <div className="flex flex-wrap gap-2">{['💖', '🌟', '📌', '🔥', '✨', '✈️', '📸', '🎉'].map(e => <button key={e} onClick={() => handleAddEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <label className="flex items-center gap-2 bg-amber-100 text-amber-800 px-5 py-3.5 rounded-2xl cursor-pointer hover:bg-amber-200 transition-colors font-medium shadow-sm">
                                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />} <span className="hidden sm:inline">Añadir Fotos</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        </>
                    )}
                    <button onClick={() => { setIsEditMode(!isEditMode); setSelectedItemId(null); setShowBgMenu(false); setShowLayers(false); setShowStickerMenu(false); }} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border font-medium shadow-sm hover:bg-stone-50 transition-colors">
                        {isEditMode ? <Check size={20} /> : <Edit3 size={20} />} {isEditMode ? 'Terminar Edición' : 'Editar Álbum'}
                    </button>
                </div>
            </div>

            {/* MENÚ DE CAPAS */}
            {showLayers && isEditMode && (
                <div className="absolute top-24 right-6 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 z-[100] border border-stone-200">
                    <h3 className="font-bold mb-3 flex items-center justify-between text-stone-800">
                        Capas <button onClick={() => setShowLayers(false)} className="p-1 hover:bg-stone-100 rounded-full"><X size={16} /></button>
                    </h3>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                        {[...activePhotos].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(p => {
                            const isEditable = ['postit', 'date', 'link', 'location'].includes(p.type);
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedItemId(p.id)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl text-sm group cursor-pointer transition-colors border ${selectedItemId === p.id ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-stone-50 border-stone-100 hover:border-indigo-200'}`}
                                >
                                    <span className={`truncate w-24 font-medium text-xs ${selectedItemId === p.id ? 'text-indigo-800' : 'text-stone-600'}`}>
                                        {p.type === 'postit' ? 'Post-it' : p.type === 'date' ? 'Fecha' : p.type === 'location' ? 'Ubicación' : p.type === 'link' ? 'Enlace' : p.type === 'emoji' ? p.content : 'Imagen'}
                                    </span>
                                    <div className="flex gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                        {isEditable && <button onClick={(e) => { e.stopPropagation(); openStickerModal(p.type, p); }} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Editar"><Edit2 size={14} /></button>}
                                        <button onClick={(e) => { e.stopPropagation(); bringToFront(p.id); }} className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors" title="Traer al frente"><ChevronUp size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeletePhotoId(p.id); }} className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            )
                        })}
                        {activePhotos.length === 0 && <p className="text-xs text-stone-400 text-center py-4 font-medium">No hay elementos</p>}
                    </div>
                </div>
            )}

            {/* CANVAS APLICANDO EL FONDO DINÁMICO */}
            <div className={`flex-1 relative w-full overflow-auto transition-colors duration-500 ${bgClass}`}>
                <div
                    className="w-full h-full min-w-[100vw] min-h-[100vh] relative p-20"
                    onPointerDown={() => isEditMode && setSelectedItemId(null)}
                >
                    {activePhotos.map(photo => (
                        <InteractablePhoto
                            key={photo.id}
                            photo={photo}
                            updatePhoto={updatePhoto}
                            deletePhoto={(id) => { setDeletePhotoId(id); setSelectedItemId(null); }}
                            isEditMode={isEditMode}
                            isSelected={selectedItemId === photo.id}
                            onSelect={() => setSelectedItemId(photo.id)}
                            onBringToFront={bringToFront}
                            onClickView={(p) => { setSelectedPhotoForDesc(p); setDescText(p.description || ""); }}
                        />
                    ))}
                </div>
            </div>

            {/* MODALES DE EDICIÓN Y CREACIÓN */}
            {deletePhotoId && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center"><div className="bg-white p-8 rounded-3xl"><h2 className="text-2xl font-bold mb-4">Eliminar Elemento</h2><div className="flex justify-end gap-3"><button onClick={() => setDeletePhotoId(null)} className="px-4 py-2 hover:bg-stone-100 rounded-full">Cancelar</button><button onClick={confirmDeletePhoto} className="px-6 py-2 bg-rose-600 text-white rounded-full">Eliminar</button></div></div></div>
            )}

            {stickerModalType === 'postit' && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><StickyNote /> {editingStickerId ? 'Editar Post-it' : 'Nuevo Post-it'}</h2>
                        {renderStyleControls()}
                        <textarea value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Escribe tu nota..." className="w-full h-32 p-4 rounded-xl resize-none font-serif text-lg mb-6 outline-none focus:ring-2 focus:ring-stone-400 border border-stone-200" style={{ backgroundColor: stickerBgColor, color: stickerTextColor, fontWeight: stickerIsBold ? 'bold' : 'normal', fontStyle: stickerIsItalic ? 'italic' : 'normal' }} autoFocus />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }}>Cancelar</button><button onClick={() => handleSaveSticker('postit')} className="px-6 py-2 bg-stone-800 text-white rounded-full">{editingStickerId ? 'Guardar' : 'Pegar'}</button></div>
                    </div>
                </div>
            )}

            {stickerModalType === 'date' && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Calendar /> {editingStickerId ? 'Editar Fecha' : 'Seleccionar Fecha'}</h2>
                        {renderStyleControls()}
                        <input type="date" value={stickerDate} onChange={(e) => setStickerDate(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none mb-8 text-xl text-center font-bold" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }}>Cancelar</button><button onClick={() => handleSaveSticker('date')} className="px-6 py-2 bg-stone-800 text-white rounded-full">{editingStickerId ? 'Guardar' : 'Añadir Fecha'}</button></div>
                    </div>
                </div>
            )}

            {stickerModalType === 'link' && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2"><LinkIcon /> {editingStickerId ? 'Editar Enlace' : 'Nuevo Enlace'}</h2>
                        {renderStyleControls()}
                        <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Texto del botón" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-4 font-medium" autoFocus />
                        <input type="url" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder="https://..." className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-8" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }}>Cancelar</button><button onClick={() => handleSaveSticker('link')} className="px-6 py-2 bg-blue-600 text-white rounded-full">{editingStickerId ? 'Guardar' : 'Añadir'}</button></div>
                    </div>
                </div>
            )}

            {stickerModalType === 'location' && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4 text-rose-600 flex items-center gap-2"><MapPin /> {editingStickerId ? 'Editar Ubicación' : 'Ubicación'}</h2>
                        {renderStyleControls()}
                        <input type="text" value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} placeholder="Texto (Ej. Parque Estatal)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-4 font-medium text-center" autoFocus />
                        <input type="url" value={stickerInputUrl} onChange={(e) => setStickerInputUrl(e.target.value)} placeholder="Enlace de Google Maps (Opcional)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl mb-8 text-sm" />
                        <div className="flex justify-end gap-3"><button onClick={() => { setStickerModalType(null); setEditingStickerId(null); }}>Cancelar</button><button onClick={() => handleSaveSticker('location')} className="px-6 py-2 bg-rose-600 text-white rounded-full">{editingStickerId ? 'Guardar' : 'Añadir'}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}