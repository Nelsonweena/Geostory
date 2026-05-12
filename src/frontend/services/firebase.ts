import { FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { Auth, getAuth } from 'firebase/auth'
import { Firestore, getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let firebaseConfigError: string | undefined

const requiredFirebaseConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

requiredFirebaseConfigKeys.forEach(key => {
  if (!firebaseConfig[key]) {
    firebaseConfigError = `Missing Firebase config value: ${key}`
  }
})

const getFirebaseApp = (): FirebaseApp => {
  if (firebaseConfigError) {
    throw new Error(firebaseConfigError)
  }

  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp())

export const getFirebaseFirestore = (): Firestore => getFirestore(getFirebaseApp())

export const getFirebaseConfigError = () => firebaseConfigError

export const getFirebaseStorage = () => getStorage(getFirebaseApp())
