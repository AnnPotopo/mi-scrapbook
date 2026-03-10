import React, { useState } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { FolderPlus, ImagePlus, User, LogOut, Share2, Trash2, Edit2, Calendar, Clock, Users } from 'lucide-react';

// --- Catálogo de Temas para los Álbumes ---
const ALBUM_THEMES = {
    'default': { name: 'Blanco Clásico', bg: 'bg-white', border: 'border-stone-200', text: 'text-stone-800', extra: '' },
    'biology': { name: 'Naturaleza', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', extra: 'bg-[url("https://www.transparenttextures.com/patterns/leaves-pattern.png")]' },
    'sea': { name: 'Océano', bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-900', extra: 'bg-[url("https://www.transparenttextures.com/patterns/wavecut.png")]' },
    'love': { name: 'Romance', bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-900', extra: 'bg-[url("https://www.transparenttextures.com/patterns/hearts.png")]' },
    'space': { name: 'Galaxia', bg: 'bg-slate-900', border: 'border-indigo-400', text: 'text-indigo-50', extra: 'bg-[url("https://www.transparenttextures.com/patterns/stardust.png")]' },
    'pixel': { name: 'Aventura', bg: 'bg-stone-200', border: 'border-stone-400', text: 'text-stone-800', extra: 'bg-[url("https://www.transparenttextures.com/patterns/pixel-weave.png")]' }
};

export default function Dashboard({ user, albums, photos, setActiveAlbumId, setCurrentView, handleLogout, setDbError }) {
    // Estados para Modales
    const [showAlbumModal, setShowAlbumModal] = useState(false);
    const [editingAlbumId, setEditingAlbumId] = useState(null);

    // Estados del Formulario de Álbum
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formTheme, setFormTheme] = useState("default");

    const [showShareModal, setShowShareModal] = useState(null);
    const [shareEmail, setShareEmail] = useState("");
    const [deleteAlbumId, setDeleteAlbumId] = useState(null);

    // Utilidad para formatear fechas
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Desconocida';
        return new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const openCreateModal = () => {
        setEditingAlbumId(null);
        setFormName(""); setFormDesc(""); setFormTheme("default");
        setShowAlbumModal(true);
    };

    const openEditModal = (album) => {
        setEditingAlbumId(album.id);
        setFormName(album.name || "");
        setFormDesc(album.description || "");
        setFormTheme(album.theme || "default");
        setShowAlbumModal(true);
    };

    const handleSaveAlbum = async () => {
        if (!user || !formName.trim()) return;
        try {
            const albumData = {
                name: formName.trim(),
                description: formDesc.trim(),
                theme: formTheme,
                updatedAt: Date.now()
            };

            if (editingAlbumId) {
                // Editar álbum existente
                await setDoc(doc(db, 'artifacts', appId, 'albums', editingAlbumId), albumData, { merge: true });
            } else {
                // Crear nuevo álbum
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
            setShareEmail(""); setShowShareModal(null);
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
        <div className="min-h-screen bg-gradient-to-br from-[#fdfcfb] to-[#f4f1ea] p-6 md:p-12 font-sans relative">
            {/* Cabecera de Usuario */}
            <div className="max-w-7xl mx-auto flex justify-between items-center mb-12 bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-stone-200 shadow-sm">
                <div className="flex items-center gap-4 px-2">
                    {user.photoURL ? <img src={user.photoURL} alt="Perfil" className="w-12 h-12 rounded-full shadow-sm border-2 border-white" /> : <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center"><User size={24} /></div>}
                    <div><p className="font-bold text-stone-800 leading-tight">{user.displayName || 'Usuario'}</p><p className="text-sm text-stone-500">{user.email || 'Invitado'}</p></div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-stone-500 hover:text-rose-600 px-4 py-2 rounded-xl font-medium transition-colors"><LogOut size={18} /> <span className="hidden sm:inline">Cerrar Sesión</span></button>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                    <div>
                        <h1 className="text-5xl md:text-6xl font-bold font-serif text-stone-800 mb-3">Mis Álbumes</h1>
                        <p className="text-stone-500 text-lg font-light">Guarda y organiza tus colecciones de recuerdos</p>
                    </div>
                    <button onClick={openCreateModal} className="flex items-center gap-2 bg-stone-800 text-white px-6 py-3.5 rounded-full hover:bg-stone-700 font-medium shadow-lg hover:-translate-y-1 transition-all"><FolderPlus size={20} /> Crear Nuevo Álbum</button>
                </div>

                {albums.length === 0 ? (
                    <div className="text-center py-32 bg-white/40 backdrop-blur-md rounded-3xl border-2 border-dashed border-stone-300">
                        <FolderPlus size={72} className="mx-auto text-stone-300 mb-6" strokeWidth={1.5} />
                        <p className="text-stone-600 text-2xl font-serif mb-2">Aún no tienes álbumes</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {albums.map(album => {
                            // Filtramos SÓLO las fotos reales para el conteo
                            const photoImages = photos.filter(p => p.albumId === album.id && (!p.type || p.type === 'image'));
                            const cover = photoImages.length > 0 ? photoImages[0].src : null;
                            const isOwner = album.ownerId === user.uid;

                            // Obtener el tema del álbum
                            const theme = ALBUM_THEMES[album.theme] || ALBUM_THEMES['default'];

                            return (
                                <div key={album.id} className="group relative">
                                    {/* Botones Flotantes (Solo dueño) */}
                                    {isOwner && (
                                        <div className="absolute -top-4 -right-4 flex gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(album); }} className="bg-stone-800 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform" title="Editar detalles"><Edit2 size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setShowShareModal(album.id); }} className="bg-blue-500 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform" title="Compartir"><Share2 size={16} /></button>
                                        </div>
                                    )}

                                    <div onClick={() => { setActiveAlbumId(album.id); setCurrentView('album'); }} className="cursor-pointer h-full">
                                        {/* Efecto de marco / apilado */}
                                        <div className={`absolute inset-0 rounded-2xl shadow-md transform rotate-3 scale-95 transition-transform duration-300 group-hover:rotate-6 border ${theme.border} ${theme.bg} ${theme.extra} opacity-60`}></div>

                                        {/* Tarjeta Principal */}
                                        <div className={`rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 relative z-10 flex flex-col h-full ${theme.bg} ${theme.border} ${theme.text} ${theme.extra}`}>

                                            {/* Portada */}
                                            <div className="aspect-[4/3] overflow-hidden relative border-b-2 border-inherit">
                                                {cover ? (
                                                    <img src={cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Portada" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-black/5 backdrop-blur-sm">
                                                        <ImagePlus size={48} className="opacity-30" strokeWidth={1.5} />
                                                    </div>
                                                )}
                                                {!isOwner && <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">Compartido</div>}
                                            </div>

                                            {/* Información del Álbum */}
                                            <div className="p-5 flex flex-col flex-1 bg-white/60 backdrop-blur-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-serif font-bold text-xl truncate pr-2" title={album.name}>{album.name}</h3>
                                                    {isOwner && <button onClick={(e) => { e.stopPropagation(); setDeleteAlbumId(album.id); }} className="text-inherit opacity-40 hover:opacity-100 hover:text-rose-500 transition-colors -mt-1"><Trash2 size={18} /></button>}
                                                </div>

                                                {album.description && <p className="text-sm opacity-80 line-clamp-2 leading-snug mb-3">{album.description}</p>}

                                                <div className="mt-auto pt-3 flex flex-col gap-3">
                                                    {/* Fechas */}
                                                    <div className="flex flex-col gap-1 text-[11px] opacity-70 font-medium">
                                                        <div className="flex items-center gap-1.5"><Calendar size={12} /> Creado: {formatDate(album.createdAt)}</div>
                                                        <div className="flex items-center gap-1.5"><Clock size={12} /> Modificado: {formatDate(album.updatedAt || album.createdAt)}</div>
                                                    </div>

                                                    {/* Participantes y Contador */}
                                                    <div className="flex justify-between items-end border-t border-inherit/20 pt-3">
                                                        <div className="text-xs flex items-center gap-1.5 opacity-90 max-w-[65%]">
                                                            <Users size={14} className="flex-shrink-0" />
                                                            <span className="truncate" title={`${album.ownerName}${album.sharedWithEmails?.length > 0 ? ', ' + album.sharedWithEmails.join(', ') : ''}`}>
                                                                {isOwner ? 'Tú' : album.ownerName}
                                                                {album.sharedWithEmails?.length > 0 && `, y ${album.sharedWithEmails.length} más`}
                                                            </span>
                                                        </div>
                                                        <div className="font-bold text-sm bg-black/10 px-2.5 py-1 rounded-lg flex-shrink-0">
                                                            {photoImages.length} fotos
                                                        </div>
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
                <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg animate-in fade-in zoom-in duration-200">
                        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-6">{editingAlbumId ? 'Editar Álbum' : 'Nuevo Álbum'}</h2>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1">Nombre del Álbum *</label>
                                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej. Aves Nativas, Viaje al Mar..." className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-medium" autoFocus />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1">Descripción (Opcional)</label>
                                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Agrega detalles sobre esta colección..." className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none h-24" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-2">Tema y Marco</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(ALBUM_THEMES).map(([key, t]) => (
                                        <button
                                            key={key}
                                            onClick={() => setFormTheme(key)}
                                            className={`p-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${t.bg} ${t.extra} ${t.text} ${formTheme === key ? 'border-amber-500 scale-105 shadow-md ring-2 ring-amber-200' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                        >
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowAlbumModal(false)} className="px-6 py-2.5 text-stone-600 hover:bg-stone-100 rounded-full font-medium transition-colors">Cancelar</button>
                            <button onClick={handleSaveAlbum} className="px-6 py-2.5 bg-stone-800 text-white rounded-full font-medium hover:bg-stone-700 transition-colors shadow-md">{editingAlbumId ? 'Guardar Cambios' : 'Crear Álbum'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Compartir Álbum */}
            {showShareModal && (
                <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Share2 size={28} /></div>
                        <h2 className="text-2xl font-bold text-center text-stone-800 mb-2">Compartir Álbum</h2>
                        <p className="text-stone-500 text-center mb-6">Ingresa el correo de la persona con la que quieres compartir este álbum.</p>
                        <input type="email" placeholder="amigo@correo.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleShareAlbum()} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 mb-8 text-center" autoFocus />
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setShowShareModal(null)} className="px-6 py-2.5 text-stone-600 hover:bg-stone-100 rounded-full font-medium">Cancelar</button>
                            <button onClick={handleShareAlbum} className="px-6 py-2.5 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 shadow-md">Compartir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmar Eliminar Álbum */}
            {deleteAlbumId && (
                <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md">
                        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6"><Trash2 size={28} /></div>
                        <h2 className="text-2xl font-bold text-stone-800 mb-2">Eliminar Álbum</h2>
                        <p className="text-stone-600 mb-8 text-lg">¿Seguro que deseas eliminar este álbum de forma permanente? Se perderán todas las fotografías y elementos en él.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteAlbumId(null)} className="px-6 py-2.5 text-stone-600 hover:bg-stone-100 rounded-full font-medium">Cancelar</button>
                            <button onClick={confirmDeleteAlbum} className="px-6 py-2.5 bg-rose-600 text-white rounded-full font-medium hover:bg-rose-700 shadow-md">Sí, eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}