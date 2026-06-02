// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_KnyjQcD-tB97063XFj2TbWaQ6djAR9U",
  authDomain: "bty-accounting-app-2.firebaseapp.com",
  projectId: "bty-accounting-app-2",
  storageBucket: "bty-accounting-app-2.firebasestorage.app",
  messagingSenderId: "1076057122670",
  appId: "1:1076057122670:web:a7be7b6ea2dfd04375c37f",
  measurementId: "G-KE4JQBJK56"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);