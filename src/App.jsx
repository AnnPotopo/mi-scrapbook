import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db, appId } from './firebase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import ScrapbookCanvas from './components/ScrapbookCanvas';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeAlbumId, setActiveAlbumId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubAlbums = onSnapshot(collection(db, 'artifacts', appId, 'public', 'albums'), (snapshot) => {
      const loaded = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.ownerId === user.uid || (data.sharedWithEmails && data.sharedWithEmails.includes(user.email))) loaded.push({ id: doc.id, ...data });
      });
      setAlbums(loaded.sort((a, b) => b.createdAt - a.createdAt));
      setDbError(null);
    }, (error) => { if (error.code === 'permission-denied') setDbError('permissions'); });

    const unsubPhotos = onSnapshot(collection(db, 'artifacts', appId, 'public', 'photos'), (snapshot) => {
      const loaded = [];
      snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
      setPhotos(loaded);
    });

    return () => { unsubAlbums(); unsubPhotos(); };
  }, [user]);

  const handleLogout = () => { auth.signOut(); setAlbums([]); setPhotos([]); };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-amber-600" size={48} /></div>;
  if (!user) return <AuthScreen />;

  if (dbError === 'permissions') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl">
          <ShieldAlert size={40} className="mx-auto text-rose-600 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Faltan Reglas en Firebase</h2>
          {/* AQUÍ ESTÁ LA CORRECCIÓN */}
          <p>Recuerda ir a Firestore Database &gt; Rules y permitir acceso: <br /><br /><code>allow read, write: if request.auth != null;</code></p>
        </div>
      </div>
    );
  }

  if (currentView === 'dashboard') {
    return <Dashboard user={user} albums={albums} photos={photos} setActiveAlbumId={setActiveAlbumId} setCurrentView={setCurrentView} handleLogout={handleLogout} setDbError={setDbError} />;
  }

  return <ScrapbookCanvas user={user} activeAlbum={albums.find(a => a.id === activeAlbumId)} activePhotos={photos.filter(p => p.albumId === activeAlbumId)} setCurrentView={setCurrentView} setActiveAlbumId={setActiveAlbumId} setDbError={setDbError} />;
}