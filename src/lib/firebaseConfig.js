// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC2xMjRtyHDo-8tnVHEvPHo20aRY8lFYAg",
    authDomain: "gallery-image-45316.firebaseapp.com",
    projectId: "gallery-image-45316",
    storageBucket: "gallery-image-45316.firebasestorage.app",
    messagingSenderId: "617422214622",
    appId: "1:617422214622:web:529881b8703f35a0b1394f",
    measurementId: "G-0BGRM5M015"
  };
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Firestore
const db = getFirestore(app);

// Initialize Authentication
const auth = getAuth(app); // Add authentication initialization

// Initialize Analytics only in the browser
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Export the Firestore database, Auth, and Firebase config
export { db, auth, firebaseConfig };