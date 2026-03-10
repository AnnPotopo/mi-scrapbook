import React, { useState } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { FolderPlus, ImagePlus, User, LogOut, Share2, Trash2 } from 'lucide-react';

export default function Dashboard({ user, albums, photos, setActiveAlbumId, setCurrentView, handleLogout, setDbError }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState("");
    const [showShareModal, setShowShareModal] = useState(null);
    const [shareEmail, setShareEmail] = useState("");
    const [deleteAlbumId, setDeleteAlbumId] = useState(null);

    const handleCreateAlbum = async () => {
        if (!user || !newAlbumName.trim()) return;
        try {
            const newAlbumRef = doc(collection(db, 'artifacts', appId, 'public', 'albums'));
            await setDoc(newAlbumRef, {
                name: newAlbumName.trim(), createdAt: Date.now(), ownerId: user.uid,
                ownerName: user.displayName || 'Usuario', ownerEmail: user.email || 'invitado@prueba.com', sharedWithEmails: []
            });
            setNewAlbumName(""); setShowCreateModal(false);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const handleShareAlbum = async () => {
        if (!user || !showShareModal || !shareEmail.trim()) return;
        const albumToShare = albums.find(a => a.id === showShareModal);
        if (!albumToShare) return;
        try {
            const albumRef = doc(db, 'artifacts', appId, 'public', 'albums', showShareModal);
            const newSharedList = [...(albumToShare.sharedWithEmails || []), shareEmail.trim().toLowerCase()];
            await setDoc(albumRef, { sharedWithEmails: newSharedList }, { merge: true });
            setShareEmail(""); setShowShareModal(null);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    const confirmDeleteAlbum = async () => {
        if (!user || !deleteAlbumId) return;
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'albums', deleteAlbumId));
            const photosToDelete = photos.filter(p => p.albumId === deleteAlbumId);
            for (const p of photosToDelete) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'photos', p.id));
            setDeleteAlbumId(null);
        } catch (error) { if (error.code === 'permission-denied') setDbError('permissions'); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#fdfcfb] to-[#f4f1ea] p-6 md:p-12 font-sans relative">
            <div className="max-w-7xl mx-auto flex justify-between items-center mb-12 bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-stone-200 shadow-sm">
                <div className="flex items-center gap-4 px-2">
                    {user.photoURL ? <img src={user.photoURL} alt="Perfil" className="w-12 h-12 rounded-full shadow-sm border-2 border-white" /> : <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center"><User size={24} /></div>}
                    <div><p className="font-bold text-stone-800 leading-tight">{user.displayName || 'Usuario'}</p><p className="text-sm text-stone-500">{user.email || 'Invitado'}</p></div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-stone-500 hover:text-rose-600 px-4 py-2 rounded-xl font-medium"><LogOut size={18} /> Cerrar Sesión</button>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-12">
                    <div><h1 className="text-5xl font-bold font-serif text-stone-800 mb-3">Mis Álbumes</h1></div>
                    <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-stone-800 text-white px-6 py-3.5 rounded-full hover:bg-stone-700 font-medium shadow-lg"><FolderPlus size={20} /> Crear Nuevo Álbum</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {albums.map(album => {
                        const albumPhotos = photos.filter(p => p.albumId === album.id);
                        const cover = albumPhotos.filter(p => !p.type || p.type === 'image')[0]?.src;
                        const isOwner = album.ownerId === user.uid;

                        return (
                            <div key={album.id} className="group relative cursor-pointer">
                                {isOwner && <button onClick={() => setShowShareModal(album.id)} className="absolute -top-4 -right-4 bg-blue-500 text-white p-3 rounded-full shadow-lg z-20 hover:scale-110 opacity-0 group-hover:opacity-100"><Share2 size={18} /></button>}
                                <div onClick={() => { setActiveAlbumId(album.id); setCurrentView('album'); }}>
                                    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl overflow-hidden border border-stone-100 relative z-10 flex flex-col h-full">
                                        <div className="aspect-[4/3] bg-stone-100 p-3">
                                            {cover ? <img src={cover} className="w-full h-full object-cover rounded shadow-inner" /> : <div className="w-full h-full flex items-center justify-center text-stone-400"><ImagePlus size={48} opacity={0.4} /></div>}
                                        </div>
                                        <div className="p-5 flex justify-between bg-white z-10">
                                            <div>
                                                <h3 className="font-serif font-bold text-stone-800 text-xl truncate" title={album.name}>{album.name}</h3>
                                                <p className="text-stone-500 text-sm">{albumPhotos.length} fotos</p>
                                            </div>
                                            {isOwner && <button onClick={(e) => { e.stopPropagation(); setDeleteAlbumId(album.id); }} className="text-stone-300 hover:text-rose-500 p-2"><Trash2 size={18} /></button>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md">
                        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-6">Nuevo Álbum</h2>
                        <input type="text" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateAlbum()} className="w-full p-4 bg-stone-50 border rounded-xl mb-8" autoFocus />
                        <div className="flex justify-end gap-3"><button onClick={() => setShowCreateModal(false)} className="px-6 py-2.5">Cancelar</button><button onClick={handleCreateAlbum} className="px-6 py-2.5 bg-stone-800 text-white rounded-full">Crear</button></div>
                    </div>
                </div>
            )}

            {showShareModal && (
                <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center">
                        <h2 className="text-2xl font-bold mb-6">Compartir Álbum</h2>
                        <input type="email" placeholder="amigo@correo.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} className="w-full p-4 border rounded-xl mb-8 text-center" />
                        <div className="flex justify-center gap-3"><button onClick={() => setShowShareModal(null)} className="px-6 py-2.5">Cancelar</button><button onClick={handleShareAlbum} className="px-6 py-2.5 bg-blue-600 text-white rounded-full">Compartir</button></div>
                    </div>
                </div>
            )}

            {deleteAlbumId && (
                <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md"><h2 className="text-2xl font-bold mb-6">Eliminar Álbum</h2><div className="flex justify-end gap-3"><button onClick={() => setDeleteAlbumId(null)}>Cancelar</button><button onClick={confirmDeleteAlbum} className="px-6 py-2.5 bg-rose-600 text-white rounded-full">Sí, eliminar</button></div></div>
                </div>
            )}
        </div>
    );
}