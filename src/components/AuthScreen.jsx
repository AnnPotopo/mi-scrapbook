import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { ImagePlus, User, ShieldAlert, Copy } from 'lucide-react';

export default function AuthScreen() {
    const [authDomainError, setAuthDomainError] = useState(null);

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            setAuthDomainError(null);
            await signInWithPopup(auth, provider);
        } catch (error) {
            if (error.code === 'auth/unauthorized-domain') {
                setAuthDomainError(window.location.hostname);
            } else {
                alert("Error al iniciar sesión. Intenta de nuevo.");
            }
        }
    };

    const handleGuestLogin = async () => {
        try {
            setAuthDomainError(null);
            await signInAnonymously(auth);
        } catch (error) {
            alert("Asegúrate de habilitar el inicio Anónimo en Firebase Authentication.");
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Dominio copiado al portapapeles');
    };

    if (authDomainError) {
        return (
            <div className="min-h-screen bg-[#f4f1ea] flex flex-col items-center justify-center p-6 font-sans">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full border border-rose-100">
                    <div className="flex items-center gap-3 text-rose-600 mb-6"><ShieldAlert size={32} /><h2 className="text-3xl font-bold">Dominio no autorizado</h2></div>
                    {/* SOLUCIÓN: Usar &gt; en lugar de > */}
                    <p className="text-stone-700 text-lg mb-6">Agrega este dominio en Authentication &gt; Settings &gt; Authorized domains:</p>
                    <div className="mt-4 mb-6 flex items-center justify-between bg-white border border-stone-300 rounded-lg p-3 shadow-inner">
                        <span className="font-mono text-stone-800 break-all">{authDomainError}</span>
                        <button onClick={() => copyToClipboard(authDomainError)} className="ml-3 p-2 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-md"><Copy size={18} /></button>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => setAuthDomainError(null)} className="w-full bg-stone-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-stone-700">Volver a intentar</button>
                        <button onClick={handleGuestLogin} className="w-full bg-stone-200 text-stone-700 py-4 rounded-xl font-bold text-lg hover:bg-stone-800">Entrar como Invitado</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#fdfcfb] to-[#f4f1ea] flex items-center justify-center p-6 font-sans">
            <div className="bg-white p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-stone-100">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ImagePlus size={40} strokeWidth={1.5} />
                </div>
                <h1 className="text-4xl font-serif font-bold text-stone-800 mb-3">Scrapbook</h1>
                <p className="text-stone-500 mb-10 text-lg">Guarda y comparte tus recuerdos de forma creativa.</p>

                <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 text-stone-700 py-4 px-6 rounded-2xl font-bold text-lg hover:bg-stone-50 transition-all shadow-sm mb-4">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Entrar con Google
                </button>

                <button onClick={handleGuestLogin} className="w-full flex items-center justify-center gap-3 bg-stone-100 text-stone-600 py-3 px-6 rounded-2xl font-bold hover:bg-stone-200 transition-all">
                    <User size={20} /> Entrar como Invitado
                </button>
            </div>
        </div>
    );
}