import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBQooGw5RxN9skXhmimbtC-IU_cas5UHtM",
    authDomain: "albumfotos-42002.firebaseapp.com",
    projectId: "albumfotos-42002",
    storageBucket: "albumfotos-42002.firebasestorage.app",
    messagingSenderId: "606805891175",
    appId: "1:606805891175:web:e73a2aa2d9bb9bf3b61cc2",
    measurementId: "G-RCCR7ED5N5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'scrapbook-local'; // ID para tu proyecto en local