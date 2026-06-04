import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Image as ImageIcon, Sparkles, Download, Trash2, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getUserImages, deleteImage } from '../../services/image/imageService';

type Album = 'list' | 'uploaded' | 'generated';

interface ImageItem {
  url: string;
  path: string;
  created_at: string;
}

export function AlbumPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<Album>('list');
  const [uploadedImages, setUploadedImages] = useState<ImageItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [uploaded, generated] = await Promise.all([
        getUserImages(user.id, 'chat'),
        getUserImages(user.id, 'generated'),
      ]);
      setUploadedImages(uploaded);
      setGeneratedImages(generated);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadImages();
    }
  }, [user, loadImages]);

  const handleDownload = async (imageUrl: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timemachine_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const handleDelete = async (path: string, isGenerated: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;
    setDeletingPath(path);
    try {
      const success = await deleteImage(path, user.id);
      if (success) {
        if (isGenerated) {
          setGeneratedImages(prev => prev.filter(img => img.path !== path));
        } else {
          setUploadedImages(prev => prev.filter(img => img.path !== path));
        }
        if (selectedImage?.path === path) {
          setSelectedImage(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    } finally {
      setDeletingPath(null);
    }
  };

  if (!user) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center`}>
        <div className="text-center">
          <ImageIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg">Sign in to view your albums</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200"
          >
            Go Home
          </motion.button>
        </div>
      </div>
    );
  }

  const AlbumCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    count: number;
    gradient: string;
    onClick: () => void;
    preview?: string;
  }> = ({ title, icon, count, gradient, onClick, preview }) => (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-3xl aspect-square group"
    >
      {preview ? (
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
      <div className="absolute inset-[1px] rounded-3xl border border-white/[0.1]" />
      <div className="relative h-full flex flex-col items-center justify-center gap-4 p-6">
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
          {icon}
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl">{title}</p>
          <p className="text-white/60 text-sm mt-1">{count} {count === 1 ? 'image' : 'images'}</p>
        </div>
      </div>
    </motion.button>
  );

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}>
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => currentView === 'list' ? navigate('/') : setCurrentView('list')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">
              {currentView === 'list' ? 'Back' : 'Albums'}
            </span>
          </motion.button>

          <h1 className="text-2xl font-bold text-white">
            {currentView === 'list' ? 'Albums' : currentView === 'uploaded' ? 'Your Images' : 'Generated Images'}
          </h1>

          <div className="w-16" />
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : currentView === 'list' ? (
          <div className="grid grid-cols-2 gap-6">
            <AlbumCard
              title="Your Images"
              icon={<ImageIcon className="w-8 h-8 text-cyan-400" />}
              count={uploadedImages.length}
              gradient="from-cyan-500/30 to-blue-500/30"
              onClick={() => setCurrentView('uploaded')}
              preview={uploadedImages[0]?.url}
            />
            <AlbumCard
              title="Generated"
              icon={<Sparkles className="w-8 h-8 text-purple-400" />}
              count={generatedImages.length}
              gradient="from-purple-500/30 to-pink-500/30"
              onClick={() => setCurrentView('generated')}
              preview={generatedImages[0]?.url}
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {(currentView === 'uploaded' ? uploadedImages : generatedImages).length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex p-6 rounded-full bg-white/5 mb-6">
                  {currentView === 'uploaded' ? (
                    <ImageIcon className="w-12 h-12 text-white/30" />
                  ) : (
                    <Sparkles className="w-12 h-12 text-white/30" />
                  )}
                </div>
                <p className="text-white/50 text-lg">No images yet</p>
                <p className="text-white/30 text-sm mt-2">
                  {currentView === 'uploaded'
                    ? 'Images you share in chats will appear here'
                    : 'AI-generated images will appear here'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {(currentView === 'uploaded' ? uploadedImages : generatedImages).map((image) => (
                  <motion.div
                    key={image.path}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img src={image.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDownload(image.url, e)}
                        className="p-3 rounded-full bg-white/20 backdrop-blur-sm"
                      >
                        <Download className="w-5 h-5 text-white" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(image.path, currentView === 'generated', e)}
                        disabled={deletingPath === image.path}
                        className="p-3 rounded-full bg-red-500/20 backdrop-blur-sm"
                      >
                        {deletingPath === image.path ? (
                          <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5 text-red-400" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Full image view */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleDownload(selectedImage.url)}
                className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
              >
                <Download className="w-5 h-5 text-white" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedImage(null)}
                className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
              >
                <X className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
