import React, { useState, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage, POSTIT_COLORS } from '../utils';
import InteractablePhoto from './InteractablePhoto';
import { ArrowLeft, Layers, SmilePlus, ImagePlus, Check, Edit3, X, StickyNote, Calendar, Link as LinkIcon, Loader2, Save, Trash2, ChevronUp, ChevronDown, MessageSquareText } from 'lucide-react';

export default function ScrapbookCanvas({ user, activeAlbum, activePhotos, setCurrentView, setActiveAlbumId, setDbError }) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showLayers, setShowLayers] = useState(false);
    const [showStickerMenu, setShowStickerMenu] = useState(false);
    const [stickerModalType, setStickerModalType] = useState(null);
    const [stickerInputText, setStickerInputText] = useState("");
    const [stickerInputUrl, setStickerInputUrl] = useState("");
    const [stickerColor, setStickerColor] = useState("yellow");
    const [stickerDate, setStickerDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [deletePhotoId, setDeletePhotoId] = useState(null);
    const [selectedPhotoForDesc, setSelectedPhotoForDesc] = useState(null);
    const [descText, setDescText] = useState("");

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
                    await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'photos')), {
                        albumId: activeAlbum.id, src: base64Data, x: 50 + (i * 30), y: 50 + (i * 30),
                        width: 300, rotation: Math.floor(Math.random() * 20) - 10, zIndex: maxZ + i + 1, description: ""
                    });
                }
            }
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
        setIsUploading(false); e.target.value = '';
    };

    const updatePhoto = useCallback(async (photoId, updates) => {
        try { await setDoc(doc(db, 'artifacts', appId, 'public', 'photos', photoId), updates, { merge: true }); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    }, [user]);

    const confirmDeletePhoto = async () => {
        try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'photos', deletePhotoId)); setDeletePhotoId(null); }
        catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleAddSticker = async (type, content = "", url = "", color = "") => {
        const width = type === 'emoji' ? 120 : type === 'date' ? 220 : 250;
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        try {
            await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'photos')), {
                albumId: activeAlbum.id, type, content, color, url, x: 100, y: 100, width, rotation: 0, zIndex: maxZ + 1, description: ""
            });
            setStickerModalType(null); setShowStickerMenu(false); setStickerInputText("");
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const bringToFront = useCallback(async (photoId) => {
        const maxZ = activePhotos.length > 0 ? Math.max(...activePhotos.map(p => p.zIndex || 0)) : 0;
        await updatePhoto(photoId, { zIndex: maxZ + 1 });
    }, [activePhotos, updatePhoto]);

    return (
        <div className="min-h-screen flex flex-col font-sans overflow-hidden bg-[#f7f5f0]">
            {/* HEADER CONTROLS */}
            <div className="absolute top-6 left-6 right-6 z-50 flex justify-between gap-4">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-5">
                    <button onClick={() => { setCurrentView('dashboard'); setActiveAlbumId(null); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full"><ArrowLeft size={22} /></button>
                    <div><h2 className="text-xl font-bold font-serif text-stone-800">{activeAlbum?.name}</h2></div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <>
                            <button onClick={() => setShowLayers(!showLayers)} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-3.5 rounded-2xl"><Layers size={20} /> Capas</button>
                            <button onClick={() => openStickerModal('postit')} className="flex items-center gap-2 bg-pink-50 text-pink-700 px-5 py-3.5 rounded-2xl"><SmilePlus size={20} /> Pegatina</button>
                            <label className="flex items-center gap-2 bg-amber-100 text-amber-800 px-5 py-3.5 rounded-2xl cursor-pointer">
                                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />} Añadir Fotos
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        </>
                    )}
                    <button onClick={() => setIsEditMode(!isEditMode)} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border font-medium">
                        {isEditMode ? <Check size={20} /> : <Edit3 size={20} />} {isEditMode ? 'Terminar Edición' : 'Editar'}
                    </button>
                </div>
            </div>

            {/* CANVAS */}
            <div className="flex-1 relative w-full overflow-auto bg-[radial-gradient(#d1cfc7_2px,transparent_2px)] [background-size:32px_32px]">
                <div className="w-full h-full min-w-[100vw] min-h-[100vh] relative p-20">
                    {activePhotos.map(photo => (
                        <InteractablePhoto key={photo.id} photo={photo} updatePhoto={updatePhoto} deletePhoto={(id) => setDeletePhotoId(id)} isEditMode={isEditMode} onBringToFront={bringToFront} onClickView={(p) => { setSelectedPhotoForDesc(p); setDescText(p.description || ""); }} />
                    ))}
                </div>
            </div>

            {/* MODALES SIMPLIFICADOS (Delete, Description, Stickers) */}
            {deletePhotoId && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center"><div className="bg-white p-8 rounded-3xl"><h2 className="text-2xl font-bold">Eliminar</h2><button onClick={confirmDeletePhoto} className="mt-4 px-6 py-2 bg-rose-600 text-white rounded-full">Eliminar</button></div></div>
            )}
            {stickerModalType === 'postit' && (
                <div className="fixed inset-0 bg-stone-900/40 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4">Nuevo Post-it</h2>
                        <textarea value={stickerInputText} onChange={(e) => setStickerInputText(e.target.value)} className="w-full h-32 p-4 bg-yellow-100 rounded-xl mb-6" autoFocus />
                        <div className="flex justify-end gap-3"><button onClick={() => setStickerModalType(null)}>Cancelar</button><button onClick={() => handleAddSticker('postit', stickerInputText, '', 'yellow')} className="px-6 py-2 bg-stone-800 text-white rounded-full">Pegar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}