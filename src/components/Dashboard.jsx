import React, { useState } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { compressImage } from '../utils'; // Importamos la función para comprimir
import { FolderPlus, ImagePlus, User, LogOut, Share2, Trash2, Edit2, Calendar, Clock, Users, X, BookHeart, Loader2 } from 'lucide-react';

// --- Catálogo de Temas para los Álbumes (Estilo minimalista) ---
const ALBUM_THEMES = {
    'default': { name: 'Papel Blanco', bg: 'bg-white', border: 'border-stone-200', text: 'text-stone-800', extra: '' },
    'biology': { name: 'Botánico', bg: 'bg-[#f0f4f1]', border: 'border-[#d1e0d7]', text: 'text-[#2d4a3e]', extra: 'bg-[url("https://www.transparenttextures.com/patterns/dust.png")]' },
    'sea': { name: 'Acuarela', bg: 'bg-[#f0f6f8]', border: 'border-[#d0e3e8]', text: 'text-[#2b4c59]', extra: 'bg-[url("https://www.transparenttextures.com/patterns/dust.png")]' },
    'love': { name: 'Cartas', bg: 'bg-[#fcf5f5]', border: 'border-[#f2d8d8]', text: 'text-[#6b3535]', extra: 'bg-[url("https://www.transparenttextures.com/patterns/dust.png")]' },
    'space': { name: 'Nocturno', bg: 'bg-[#2a2b30]', border: 'border-[#4a4d59]', text: 'text-[#e2e4eb]', extra: 'bg-[url("https://www.transparenttextures.com/patterns/stardust.png")]' },
    'kraft': { name: 'Kraft', bg: 'bg-[#e6d5c3]', border: 'border-[#cdae8d]', text: 'text-[#5c4731]', extra: 'bg-[url("https://www.transparenttextures.com/patterns/cardboard-flat.png")]' }
};

export default function Dashboard({ user, albums, photos, setActiveAlbumId, setCurrentView, handleLogout, setDbError }) {
    const [showAlbumModal, setShowAlbumModal] = useState(false);
    const [editingAlbumId, setEditingAlbumId] = useState(null);

    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formTheme, setFormTheme] = useState("default");
    const [formCover, setFormCover] = useState(null); // NUEVO: Estado de la portada
    const [isUploadingCover, setIsUploadingCover] = useState(false);

    const [showShareModal, setShowShareModal] = useState(null);
    const [shareEmail, setShareEmail] = useState("");
    const [deleteAlbumId, setDeleteAlbumId] = useState(null);

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Desconocida';
        return new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const openCreateModal = () => {
        setEditingAlbumId(null);
        setFormName(""); setFormDesc(""); setFormTheme("default"); setFormCover(null);
        setShowAlbumModal(true);
    };

    const openEditModal = (album) => {
        setEditingAlbumId(album.id);
        setFormName(album.name || "");
        setFormDesc(album.description || "");
        setFormTheme(album.theme || "default");
        setFormCover(album.customCover || null); // Cargar portada si existe
        setShowAlbumModal(true);
    };

    // Función para manejar la subida de la portada
    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploadingCover(true);
        try {
            const base64Data = await compressImage(file);
            setFormCover(base64Data);
        } catch (error) {
            console.error("Error al subir portada:", error);
        }
        setIsUploadingCover(false);
        e.target.value = ''; // Resetear el input
    };

    const handleSaveAlbum = async () => {
        if (!user || !formName.trim()) return;
        try {
            const albumData = {
                name: formName.trim(),
                description: formDesc.trim(),
                theme: formTheme,
                customCover: formCover, // Guardar la portada personalizada
                updatedAt: Date.now()
            };

            if (editingAlbumId) {
                await setDoc(doc(db, 'artifacts', appId, 'albums', editingAlbumId), albumData, { merge: true });
            } else {
                const newAlbumRef = doc(collection(db, 'artifacts', appId, 'albums'));
                await setDoc(newAlbumRef, {
                    ...albumData,
                    createdAt: Date.now(),
                    ownerId: user.uid,
                    ownerName: user.displayName || 'Usuario',
                    ownerEmail: user.email || 'invitado@prueba.com',
                    sharedWithEmails: []
                });
            }
            setShowAlbumModal(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleShareAlbum = async () => {
        if (!user || !showShareModal || !shareEmail.trim()) return;
        const albumToShare = albums.find(a => a.id === showShareModal);
        if (!albumToShare) return;
        try {
            const albumRef = doc(db, 'artifacts', appId, 'albums', showShareModal);
            const newSharedList = [...(albumToShare.sharedWithEmails || []), shareEmail.trim().toLowerCase()];
            await setDoc(albumRef, { sharedWithEmails: newSharedList }, { merge: true });
            setShareEmail("");
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleRemoveShare = async (albumId, emailToRemove) => {
        const albumToShare = albums.find(a => a.id === albumId);
        if (!albumToShare) return;
        try {
            const newSharedList = (albumToShare.sharedWithEmails || []).filter(e => e !== emailToRemove);
            await setDoc(doc(db, 'artifacts', appId, 'albums', albumId), { sharedWithEmails: newSharedList }, { merge: true });
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const confirmDeleteAlbum = async () => {
        if (!user || !deleteAlbumId) return;
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'albums', deleteAlbumId));
            const photosToDelete = photos.filter(p => p.albumId === deleteAlbumId);
            for (const p of photosToDelete) await deleteDoc(doc(db, 'artifacts', appId, 'photos', p.id));
            setDeleteAlbumId(null);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    return (
        <div className="min-h-screen bg-[#fdfdfc] text-stone-800 p-6 md:p-12 font-sans relative selection:bg-amber-200 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">

            {/* Cabecera de Usuario */}
            <div className="max-w-7xl mx-auto flex justify-between items-center mb-16 bg-white px-5 py-3 rounded-sm border border-stone-200 shadow-sm sticky top-6 z-40">
                <div className="flex items-center gap-4">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="Perfil" className="w-10 h-10 rounded-full shadow-sm grayscale hover:grayscale-0 transition-all duration-300" />
                    ) : (
                        <div className="w-10 h-10 bg-stone-100 text-stone-500 rounded-full flex items-center justify-center border border-stone-200"><User size={20} /></div>
                    )}
                    <div>
                        <p className="font-bold font-serif text-stone-800 leading-tight">{user.displayName || 'Usuario'}</p>
                        <p className="text-xs text-stone-400">{user.email || 'Invitado'}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-stone-400 hover:text-stone-800 px-3 py-2 rounded-sm font-medium transition-all hover:bg-stone-50">
                    <LogOut size={18} /> <span className="hidden sm:inline">Salir</span>
                </button>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-serif font-bold text-stone-800 mb-3 tracking-tight">Nuestras aventuras</h1>
                        <p className="text-stone-500 text-lg italic font-serif flex items-center gap-2">
                            <BookHeart size={20} className="text-amber-700/60" /> Recuerdos de nuestro camino
                        </p>
                    </div>
                    <button onClick={openCreateModal} className="flex items-center gap-2 bg-stone-800 text-white px-6 py-3.5 rounded-sm hover:bg-stone-700 font-bold shadow-md hover:shadow-lg active:scale-95 transition-all">
                        <FolderPlus size={20} /> Nuevo Álbum
                    </button>
                </div>

                {albums.length === 0 ? (
                    <div className="text-center py-32 bg-white/60 border border-stone-200 border-dashed rounded-sm">
                        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6"><FolderPlus size={32} className="text-stone-400" /></div>
                        <p className="text-stone-600 text-2xl font-serif mb-2">Páginas en blanco</p>
                        <p className="text-stone-400 italic">Crea tu primera colección para empezar a guardar fotos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-14">
                        {albums.map((album, index) => {
                            const photoImages = photos.filter(p => p.albumId === album.id && (!p.type || p.type === 'image'));
                            // Si tiene portada personalizada la usa, sino usa la primera foto.
                            const cover = album.customCover || (photoImages.length > 0 ? photoImages[0].src : null);
                            const isOwner = album.ownerId === user.uid;
                            const theme = ALBUM_THEMES[album.theme] || ALBUM_THEMES['default'];

                            const rotations = ['rotate-1', '-rotate-2', 'rotate-2', '-rotate-1'];
                            const rotationClass = rotations[index % rotations.length];

                            return (
                                <div key={album.id} className="group relative">
                                    {isOwner && (
                                        <div className="absolute -top-4 -right-4 flex gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(album); }} className="bg-white text-stone-700 p-2.5 rounded-full shadow-md border border-stone-200 hover:scale-110 active:scale-95 transition-all" title="Editar"><Edit2 size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setShowShareModal(album.id); }} className="bg-amber-100 text-amber-800 p-2.5 rounded-full shadow-md border border-amber-200 hover:scale-110 active:scale-95 transition-all" title="Compartir"><Share2 size={16} /></button>
                                        </div>
                                    )}

                                    <div onClick={() => { setActiveAlbumId(album.id); setCurrentView('album'); }} className={`cursor-pointer h-full transform ${rotationClass} hover:rotate-0 transition-transform duration-300`}>
                                        <div className={`absolute inset-0 rounded-sm shadow-md transform rotate-3 scale-[0.98] border ${theme.border} ${theme.bg} opacity-50`}></div>
                                        <div className={`absolute inset-0 rounded-sm shadow-md transform -rotate-2 scale-[0.99] border ${theme.border} ${theme.bg} opacity-50`}></div>

                                        <div className={`p-3 pb-6 shadow-xl hover:shadow-2xl transition-shadow duration-300 relative z-10 flex flex-col h-full ${theme.bg} border ${theme.border} ${theme.text} ${theme.extra} rounded-sm`}>
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-white/40 backdrop-blur-sm border border-white/40 shadow-sm transform -rotate-1 z-20" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.5))' }}></div>

                                            <div className="aspect-square overflow-hidden relative mb-4 shadow-inner border border-black/5 bg-stone-100/50">
                                                {cover ? (
                                                    <img src={cover} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700" alt="Portada" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-stone-300"><ImagePlus size={40} strokeWidth={1} /></div>
                                                )}
                                                {!isOwner && <div className="absolute top-2 left-2 bg-stone-800 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm uppercase tracking-wider">Compartido</div>}
                                            </div>

                                            <div className="flex flex-col flex-1 px-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="font-serif font-bold text-xl leading-tight truncate pr-2" title={album.name}>{album.name}</h3>
                                                    {isOwner && <button onClick={(e) => { e.stopPropagation(); setDeleteAlbumId(album.id); }} className="text-inherit opacity-30 hover:opacity-100 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>}
                                                </div>

                                                {album.description && <p className="text-sm opacity-70 line-clamp-2 leading-relaxed font-serif mb-4">{album.description}</p>}

                                                <div className="mt-auto pt-3 border-t border-black/10 flex justify-between items-end">
                                                    <div className="flex flex-col gap-0.5 text-[10px] opacity-60 font-mono uppercase tracking-tight">
                                                        <span>{formatDate(album.createdAt)}</span>
                                                        <span className="flex items-center gap-1" title={`${album.ownerName}${album.sharedWithEmails?.length > 0 ? ', ' + album.sharedWithEmails.join(', ') : ''}`}>
                                                            <Users size={10} /> {isOwner ? 'Propio' : 'De invitado'} {album.sharedWithEmails?.length > 0 && `(+${album.sharedWithEmails.length})`}
                                                        </span>
                                                    </div>
                                                    <div className="font-serif italic font-bold text-lg opacity-80">
                                                        {photoImages.length}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Crear / Editar Álbum */}
            {showAlbumModal && (
                <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
                    <div className="bg-[#faf9f5] border border-stone-200 rounded-sm shadow-2xl p-8 md:p-10 w-full max-w-lg animate-in fade-in zoom-in duration-200 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
                        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-8 border-b border-stone-200 pb-4">{editingAlbumId ? 'Editar Colección' : 'Nueva Colección'}</h2>

                        <div className="space-y-6 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Título *</label>
                                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej. Aves del parque..." className="w-full p-4 bg-white border border-stone-300 rounded-sm outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition-all font-serif text-lg text-stone-800 shadow-inner" autoFocus />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Descripción</label>
                                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Un breve resumen de estos recuerdos..." className="w-full p-4 bg-white border border-stone-300 rounded-sm outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition-all resize-none h-24 font-serif text-stone-700 shadow-inner" />
                            </div>

                            {/* SECCIÓN NUEVA: Subir Portada */}
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Foto de Portada</label>
                                <div className="flex items-center gap-4 bg-white p-3 border border-stone-300 rounded-sm shadow-inner">
                                    {formCover ? (
                                        <div className="relative w-16 h-16 rounded-sm overflow-hidden border border-stone-200 shadow-sm">
                                            <img src={formCover} alt="Portada" className="w-full h-full object-cover" />
                                            <button onClick={() => setFormCover(null)} className="absolute top-0 right-0 bg-white/80 p-1 rounded-bl-sm text-rose-600 hover:bg-white transition-colors" title="Quitar portada">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 bg-stone-100 border border-stone-300 border-dashed rounded-sm flex items-center justify-center text-stone-400">
                                            <ImagePlus size={20} />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <label className="cursor-pointer bg-stone-100 border border-stone-300 px-4 py-2 rounded-sm text-xs font-bold text-stone-700 hover:bg-stone-200 transition-all active:scale-95 flex items-center gap-2 w-fit">
                                            {isUploadingCover ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                                            {formCover ? 'Cambiar Imagen' : 'Subir Portada'}
                                            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={isUploadingCover} />
                                        </label>
                                        <span className="text-[10px] text-stone-400 italic mt-2">Si se deja vacío, se usará la primera foto del álbum.</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Papel y Textura</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(ALBUM_THEMES).map(([key, t]) => (
                                        <button
                                            key={key}
                                            onClick={() => setFormTheme(key)}
                                            className={`p-3 border-2 text-xs font-bold font-serif flex flex-col items-center justify-center gap-1 transition-all rounded-sm ${t.bg} ${t.extra} ${t.text} ${formTheme === key ? 'border-stone-800 shadow-md' : 'border-stone-200 opacity-60 hover:opacity-100'}`}
                                        >
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-4 border-t border-stone-200">
                            <button onClick={() => setShowAlbumModal(false)} className="px-6 py-3 text-stone-500 hover:text-stone-800 font-bold uppercase tracking-widest text-xs transition-all">Cancelar</button>
                            <button onClick={handleSaveAlbum} disabled={isUploadingCover} className="px-8 py-3 bg-stone-800 text-white rounded-sm font-bold uppercase tracking-widest text-xs shadow-md hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50">{editingAlbumId ? 'Guardar' : 'Crear'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Compartir Álbum */}
            {showShareModal && (() => {
                const albumToShare = albums.find(a => a.id === showShareModal);
                return (
                    <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
                        <div className="bg-[#faf9f5] border border-stone-200 rounded-sm shadow-2xl p-8 md:p-10 w-full max-w-md animate-in fade-in zoom-in duration-200 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
                            <h2 className="text-3xl font-serif font-bold text-stone-800 mb-2">Compartir</h2>
                            <p className="text-stone-500 mb-8 italic font-serif">Invita a otros a ver y editar esta colección.</p>

                            {albumToShare?.sharedWithEmails?.length > 0 && (
                                <div className="mb-6 bg-white p-3 border border-stone-200 rounded-sm shadow-inner max-h-40 overflow-y-auto">
                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">Tienen acceso</h3>
                                    {albumToShare.sharedWithEmails.map(email => (
                                        <div key={email} className="flex items-center justify-between py-2 px-2 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
                                            <span className="text-sm font-mono text-stone-600 truncate">{email}</span>
                                            <button onClick={() => handleRemoveShare(albumToShare.id, email)} className="text-stone-300 hover:text-rose-600 transition-colors p-1" title="Revocar acceso">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 mb-8">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Añadir Correo</label>
                                <div className="flex gap-2">
                                    <input type="email" placeholder="correo@ejemplo.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleShareAlbum()} className="flex-1 p-3 bg-white border border-stone-300 rounded-sm outline-none focus:border-stone-800 text-sm font-mono text-stone-700 shadow-inner" autoFocus />
                                    <button onClick={handleShareAlbum} className="px-5 py-3 bg-stone-800 text-white rounded-sm font-bold uppercase text-xs tracking-widest shadow-md hover:bg-stone-700 active:scale-95 transition-all">Invitar</button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-stone-200">
                                <button onClick={() => setShowShareModal(null)} className="px-8 py-3 bg-stone-200 text-stone-700 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-stone-300 active:scale-95 transition-all">Cerrar</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal: Confirmar Eliminar Álbum */}
            {deleteAlbumId && (
                <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
                    <div className="bg-[#faf9f5] border border-rose-200 rounded-sm shadow-2xl p-8 md:p-10 w-full max-w-md animate-in fade-in zoom-in duration-200 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
                        <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mb-6 shadow-sm border border-rose-200"><Trash2 size={32} /></div>
                        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-4">Eliminar Álbum</h2>
                        <p className="text-stone-600 mb-8 font-serif italic text-lg leading-relaxed">¿Destruir esta colección? Se quemarán todas las fotografías y recortes que contiene de forma irreversible.</p>
                        <div className="flex justify-end gap-4 pt-4 border-t border-stone-200">
                            <button onClick={() => setDeleteAlbumId(null)} className="px-6 py-3 text-stone-500 hover:text-stone-800 font-bold uppercase tracking-widest text-xs transition-all">Cancelar</button>
                            <button onClick={confirmDeleteAlbum} className="px-8 py-3 bg-rose-700 text-white rounded-sm font-bold uppercase tracking-widest text-xs shadow-md hover:bg-rose-800 active:scale-95 transition-all">Destruir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}