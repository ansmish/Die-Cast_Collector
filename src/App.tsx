/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Camera, 
  Download, 
  Trash2, 
  LogOut, 
  Car as CarIcon, 
  Search, 
  Loader2, 
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  Tag,
  Maximize2
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { identifyCarFromImage, CarDetails } from './services/geminiService';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';

// --- Types ---
interface Car extends CarDetails {
  id: string;
  userId: string;
  condition: string;
  packaging: string;
  createdAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// --- Error Handler ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Real-time Updates ---
  useEffect(() => {
    if (!user) {
      setCars([]);
      return;
    }

    const q = query(
      collection(db, 'cars'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const carList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Car[];
      setCars(carList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cars');
    });

    return () => unsubscribe();
  }, [user]);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err) {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          setError("Firebase connection failed. Please check your configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cars', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cars/${id}`);
    }
  };

  const exportToExcel = () => {
    const data = cars.map(car => ({
      Brand: car.brand,
      Model: car.modelName,
      Series: car.series || '',
      Year: car.year || '',
      Color: car.color || '',
      Scale: car.scale || '',
      Condition: car.condition,
      Packaging: car.packaging,
      AddedOn: car.createdAt?.toDate?.()?.toLocaleDateString() || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "My Collection");
    XLSX.writeFile(wb, "DieCast_Collection.xlsx");
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const filteredCars = cars.filter(car => 
    car.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.series?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-sm text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-6">
            <CarIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#1a1a1a] mb-4">Die-Cast Collector</h1>
          <p className="text-[#5A5A40] mb-8">
            The premium way to catalog your collection. Scan, identify, and export your cars with ease.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1a1a1a] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E0] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center">
              <CarIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-serif font-bold hidden sm:block">Die-Cast Collector</h1>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportToExcel}
              disabled={cars.length === 0}
              className="p-2 text-[#5A5A40] hover:bg-[#F5F5F0] rounded-full transition-colors disabled:opacity-50"
              title="Export to Excel"
            >
              <Download className="w-6 h-6" />
            </button>
            <div className="h-8 w-px bg-[#E5E5E0]" />
            <div className="flex items-center gap-3">
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-[#5A5A40]" alt={user.displayName || ''} />
              <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats & Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40] w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by brand, model, or series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-none rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-[#5A5A40] transition-all"
            />
          </div>
          <div className="bg-[#5A5A40] rounded-2xl p-4 flex items-center justify-between text-white shadow-sm">
            <div>
              <p className="text-sm opacity-80 uppercase tracking-wider font-medium">Total Cars</p>
              <p className="text-3xl font-serif font-bold">{cars.length}</p>
            </div>
            <CarIcon className="w-10 h-10 opacity-20" />
          </div>
        </div>

        {/* Collection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredCars.map((car) => (
              <motion.div
                key={car.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[24px] overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="aspect-[4/3] bg-[#E5E5E0] relative">
                  {car.imageUrl ? (
                    <img src={car.imageUrl} alt={car.modelName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5A5A40]">
                      <CarIcon className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button 
                      onClick={() => handleDelete(car.id)}
                      className="p-2 bg-white/90 backdrop-blur-sm text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[#5A5A40] text-xs font-bold rounded-full uppercase tracking-wider">
                      {car.brand}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-serif font-bold mb-1 line-clamp-1">{car.modelName}</h3>
                  <p className="text-sm text-[#5A5A40] mb-4 line-clamp-1">{car.series || 'Mainline'}</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#5A5A40]">
                      <Calendar className="w-3 h-3" />
                      <span>{car.year || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#5A5A40]">
                      <Tag className="w-3 h-3" />
                      <span>{car.scale || '1:64'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#5A5A40]">
                      <Package className="w-3 h-3" />
                      <span>{car.packaging}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#5A5A40]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{car.condition}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add Placeholder */}
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-white border-2 border-dashed border-[#E5E5E0] rounded-[24px] flex flex-col items-center justify-center p-8 text-[#5A5A40] hover:border-[#5A5A40] hover:bg-[#F5F5F0] transition-all group min-h-[300px]"
          >
            <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
              <Plus className="w-8 h-8" />
            </div>
            <p className="font-medium">Add New Car</p>
            <p className="text-xs opacity-60 mt-1">Scan or enter manually</p>
          </button>
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !scanning && setShowAddModal(false)}
              className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif font-bold">Add to Collection</h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <AddCarForm 
                  onSuccess={() => {
                    setShowAddModal(false);
                    confetti({
                      particleCount: 150,
                      spread: 70,
                      origin: { y: 0.6 }
                    });
                  }}
                  setScanning={setScanning}
                  scanning={scanning}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FAB for Mobile */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#5A5A40] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform sm:hidden"
      >
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
}

function AddCarForm({ onSuccess, setScanning, scanning }: { onSuccess: () => void, setScanning: (s: boolean) => void, scanning: boolean }) {
  const [formData, setFormData] = useState<Partial<Car>>({
    brand: '',
    modelName: '',
    series: '',
    year: '',
    color: '',
    scale: '1:64',
    condition: 'Mint',
    packaging: 'Carded'
  });
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setPreview(reader.result as string);
      setScanning(true);
      try {
        const details = await identifyCarFromImage(base64);
        setFormData(prev => ({ ...prev, ...details }));
      } catch (err) {
        console.error("Scanning failed", err);
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'cars'), {
        ...formData,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        imageUrl: preview || ''
      });
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cars');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Upload/Scan */}
        <div className="space-y-4">
          <div 
            {...getRootProps()} 
            className={cn(
              "aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-6 transition-all cursor-pointer relative overflow-hidden",
              isDragActive ? "border-[#5A5A40] bg-[#F5F5F0]" : "border-[#E5E5E0] hover:border-[#5A5A40]",
              preview ? "border-none" : ""
            )}
          >
            <input {...getInputProps()} />
            {preview ? (
              <>
                <img src={preview} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-10 h-10 text-white" />
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-3">
                  <Camera className="w-6 h-6 text-[#5A5A40]" />
                </div>
                <p className="text-sm font-medium text-center">Click or drag image to scan</p>
                <p className="text-xs text-[#5A5A40] opacity-60 mt-1">Supports car or packaging photos</p>
              </>
            )}
            
            {scanning && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40] mb-2" />
                <p className="text-sm font-bold text-[#5A5A40] animate-pulse">AI Scanning...</p>
              </div>
            )}
          </div>
          {preview && (
            <button 
              type="button" 
              onClick={() => setPreview(null)}
              className="w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              Remove Image
            </button>
          )}
        </div>

        {/* Details Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Model Name</label>
              <input 
                required
                value={formData.modelName}
                onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
                placeholder="e.g. '67 Chevy C10"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Brand</label>
              <input 
                required
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
                placeholder="Hot Wheels"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Year</label>
              <input 
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
                placeholder="2023"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Series</label>
              <input 
                value={formData.series}
                onChange={e => setFormData({ ...formData, series: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
                placeholder="HW Trucks"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Condition</label>
              <select 
                value={formData.condition}
                onChange={e => setFormData({ ...formData, condition: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
              >
                {["Mint", "Near Mint", "Good", "Fair", "Poor"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] mb-1 block">Packaging</label>
              <select 
                value={formData.packaging}
                onChange={e => setFormData({ ...formData, packaging: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]"
              >
                {["Carded", "Loose", "Boxed"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button 
          type="submit"
          disabled={scanning || !formData.modelName || !formData.brand}
          className="flex-1 bg-[#5A5A40] text-white py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 shadow-lg shadow-[#5A5A40]/20"
        >
          Add to Collection
        </button>
      </div>
    </form>
  );
}
