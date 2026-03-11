import React, { useState, useEffect } from 'react';
import { auth, provider, db, appId } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import ScrapbookCanvas from './components/ScrapbookCanvas';
import { BookHeart, Loader2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [dbError, setDbError] = useState(null);

  // Escuchar el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cargar álbumes y fotos desde Firestore
  useEffect(() => {
    if (!user) {
      setAlbums([]);
      setPhotos([]);
      return;
    }

    // Consultar álbumes donde el usuario es el dueño o fue invitado
    const qAlbums = query(
      collection(db, 'artifacts', appId, 'albums'),
      or(
        where('ownerId', '==', user.uid),
        where('sharedWithEmails', 'array-contains', user.email?.toLowerCase() || '')
      )
    );

    const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
      const loadedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlbums(loadedAlbums);
    }, (error) => {
      console.error("Error al cargar álbumes:", error);
      if (error.code === 'permission-denied') setDbError('permissions');
    });

    const qPhotos = query(collection(db, 'artifacts', appId, 'photos'));
    const unsubPhotos = onSnapshot(qPhotos, (snapshot) => {
      const loadedPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(loadedPhotos);
    }, (error) => {
      console.error("Error al cargar fotos:", error);
    });

    return () => { unsubAlbums(); unsubPhotos(); };
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setCurrentView('dashboard');
    setActiveAlbumId(null);
  };

  // Pantalla de carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfc] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
        <Loader2 className="animate-spin text-stone-400" size={40} />
      </div>
    );
  }

  // Pantalla de Inicio de Sesión (Estilo Scrapbook, Sin Invitado)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfc] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] font-sans p-4 selection:bg-amber-200">
        <div className="bg-white p-10 md:p-12 rounded-sm shadow-2xl border border-stone-200 max-w-md w-full text-center relative">
          {/* Cinta adhesiva decorativa */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-7 bg-white/40 backdrop-blur-md border border-white/40 shadow-sm transform -rotate-2" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.6))' }}></div>

          <div className="w-24 h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-stone-200">
            <BookHeart size={44} className="text-stone-700" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-stone-800 mb-2">Recuerdos</h1>
          <p className="text-stone-500 italic font-serif mb-12">Guarda y revive tus momentos especiales, un álbum a la vez.</p>

          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-stone-800 text-white py-4 rounded-sm font-bold tracking-wider uppercase text-sm shadow-md hover:bg-stone-700 hover:shadow-lg active:scale-95 transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  const activeAlbum = albums.find(a => a.id === activeAlbumId);
  const activePhotos = photos.filter(p => p.albumId === activeAlbumId);

  return (
    <>
      {dbError === 'permissions' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-rose-700 text-white px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 z-[999999] animate-in slide-in-from-top-4">
          <AlertCircle size={20} />
          <span className="font-bold text-sm tracking-wider uppercase">Error de permisos</span>
          <button onClick={() => setDbError(null)} className="ml-2 hover:text-rose-200 transition-colors"><X size={16} /></button>
        </div>
      )}

      {currentView === 'dashboard' ? (
        <Dashboard
          user={user}
          albums={albums}
          photos={photos}
          setActiveAlbumId={setActiveAlbumId}
          setCurrentView={setCurrentView}
          handleLogout={handleLogout}
          setDbError={setDbError}
        />
      ) : (
        <ScrapbookCanvas
          user={user}
          activeAlbum={activeAlbum}
          activePhotos={activePhotos}
          setCurrentView={setCurrentView}
          setActiveAlbumId={setActiveAlbumId}
          setDbError={setDbError}
        />
      )}
    </>
  );
}