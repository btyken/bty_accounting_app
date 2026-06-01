// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAOPZlbbhIgWYwSJP1YiHcJFuOjqnMP10U",
  authDomain: "bty-accounting-app.firebaseapp.com",
  projectId: "bty-accounting-app",
  storageBucket: "bty-accounting-app.firebasestorage.app",
  messagingSenderId: "435208406243",
  appId: "1:435208406243:web:106bd12d3297e7c019b1d6",
  measurementId: "G-G5L6HC4E9G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);