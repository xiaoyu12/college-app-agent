'use client'

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

interface Message {
  text: string;
  sender: 'user' | 'bot';
  timestamp: number;
}

interface Preferences {
  theme: 'light' | 'dark';
  language: string;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [preferences, setPreferences] = useState<Preferences>({ theme: 'light', language: 'en' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  // Initialize Firebase Auth and Firestore listeners
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Load user preferences
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setPreferences(userDoc.data().preferences || preferences);
        } else {
          // Initialize user document
          await setDoc(doc(db, 'users', currentUser.uid), {
            email: currentUser.email,
            preferences,
            createdAt: new Date(),
          });
        }
        // Listen for chat messages
        const messagesRef = collection(db, 'users', currentUser.uid, 'messages');
        onSnapshot(messagesRef, (snapshot) => {
          const loadedMessages = snapshot.docs.map((doc) => doc.data() as Message);
          setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
        });
      } else {
        setUser(null);
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle Google Login
  const handleLoginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`);
    }
  };

  // Handle Email/Password Login
  const handleLoginWithEmail = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`);
    }
  };

  // Handle Email/Password Registration
  const handleRegisterWithEmail = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      await setDoc(doc(db, 'users', newUser.uid), {
        email: newUser.email,
        preferences,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim() || !user) return;
    const userMessage: Message = {
      text: input,
      sender: 'user',
      timestamp: Date.now(),
    };
    // Save user message to Firestore
    await addDoc(collection(db, 'users', user.uid, 'messages'), userMessage);
    setInput('');

    // Call CrewAI backend
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, userId: user.uid }),
      });
      const { reply } = await response.json();
      const botMessage: Message = {
        text: reply,
        sender: 'bot',
        timestamp: Date.now() + 100,
      };
      await addDoc(collection(db, 'users', user.uid, 'messages'), botMessage);
    } catch (error) {
      console.error('CrewAI error:', error);
      const errorMessage: Message = {
        text: 'Error: Could not get response from AI agent',
        sender: 'bot',
        timestamp: Date.now() + 100,
      };
      await addDoc(collection(db, 'users', user.uid, 'messages'), errorMessage);
    }
  };

  // Update user preferences
  const updatePreferences = async (newPrefs: Partial<Preferences>) => {
    const updatedPrefs = { ...preferences, ...newPrefs };
    setPreferences(updatedPrefs);
    if (user) {
      await setDoc(doc(db, 'users', user.uid), { preferences: updatedPrefs }, { merge: true });
    }
  };

  return (
    <div className={`min-h-screen ${preferences.theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <Head>
        <title>AI Chat App with CrewAI</title>
      </Head>
      <div className="container mx-auto p-4">
        <div className="text-center mb-4">
          <img
            src="/images/banner.png" // Replace with the actual path to your image file, e.g., "/"
            alt="AI Chat App Banner"
            className="mx-auto w-1/2 rounded"
          />
        </div>
        {!user ? (
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Welcome to AI Chat with CrewAI</h1>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-2 border rounded mb-2"
                placeholder="Email"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded mb-2"
                placeholder="Password"
              />
              {isRegistering ? (
                <button
                  onClick={handleRegisterWithEmail}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Register
                </button>
              ) : (
                <button
                  onClick={handleLoginWithEmail}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Login
                </button>
              )}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-gray-500 mt-2"
              >
                {isRegistering ? (
                  'Already have an account? Login'
                ) : (
                  <>
                    Don’t have an account? <span className="font-bold">Register</span>
                  </>
                )}
              </button>
            </div>
            <button
              onClick={handleLoginWithGoogle}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Chat with AI Agent</h1>
              <div>
                <select
                  value={preferences.theme}
                  onChange={(e) => updatePreferences({ theme: e.target.value as 'light' | 'dark' })}
                  className="mr-2 p-2 rounded bg-gray-200 text-black"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Sign Out
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <span
                    className={`inline-block p-2 rounded ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}
                  >
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 p-2 border rounded-l bg-white text-black"
                placeholder="Type your message..."
              />
              <button
                onClick={handleSendMessage}
                className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}