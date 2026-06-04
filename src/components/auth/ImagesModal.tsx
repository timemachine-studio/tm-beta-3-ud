import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Sparkles, ChevronLeft, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserImages, deleteImage } from '../../services/image/imageService';

interface ImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Album = 'list' | 'uploaded' | 'generated';

interface ImageItem {
  url: string;
  path: string;
  created_at: string;
}

export const ImagesModal: React.FC<ImagesModalProps> = ({ isOpen, onClose }) => {
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
    if (isOpen && user) {
      loadImages();
      setCurrentView('list');
      setSelectedImage(null);
    }
  }, [isOpen, user, loadImages]);

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

  const handleDelete = async (path: string, isGenerated: boolean) => {
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

  const AlbumCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    count: number;
    gradient: string;
    onClick: () => void;
    preview?: string;
  }> = ({ title, icon, count, gradient, onClick, preview }) => (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl aspect-square group"
    >
      {/* Background image or gradient */}
      {preview ? (
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />

      {/* Glass border */}
      <div className="absolute inset-[1px] rounded-2xl border border-white/[0.1]" />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center gap-3 p-4">
        <div className={`p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10`}>
          {icon}
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">{title}</p>
          <p className="text-white/60 text-sm">{count} {count === 1 ? 'image' : 'images'}</p>
        </div>
      </div>
    </motion.button>
  );

  const ImageGrid: React.FC<{ images: ImageItem[]; isGenerated: boolean }> = ({ images, isGenerated }) => (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image) => (
        <motion.div
          key={image.path}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
          onClick={() => setSelectedImage(image)}
        >
          <img src={image.url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => handleDownload(image.url, e)}
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
            >
              <Download className="w-4 h-4 text-white" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(image.path, isGenerated);
              }}
              disabled={deletingPath === image.path}
              className="p-2 rounded-full bg-red-500/20 backdrop-blur-sm"
            >
              {deletingPath === image.path ? (
                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-400" />
              )}
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[60]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
              >
                <div className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl">
                  {/* Glass background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10" />
                  <div className="absolute inset-[1px] rounded-3xl border border-white/[0.08]" />

                  <div className="relative p-6 flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        {currentView !== 'list' && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setCurrentView('list');
                              setSelectedImage(null);
                            }}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                          >
                            <ChevronLeft className="w-5 h-5 text-white/70" />
                          </motion.button>
                        )}
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20">
                          <ImageIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <Dialog.Title className="text-xl font-semibold text-white">
                          {currentView === 'list' ? 'Images' : currentView === 'uploaded' ? 'Your Images' : 'Generated Images'}
                        </Dialog.Title>
                      </div>
                      <Dialog.Close asChild>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                        >
                          <X className="w-5 h-5 text-white/70" />
                        </motion.button>
                      </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        </div>
                      ) : currentView === 'list' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <AlbumCard
                            title="Your Images"
                            icon={<ImageIcon className="w-6 h-6 text-cyan-400" />}
                            count={uploadedImages.length}
                            gradient="from-cyan-500/30 to-blue-500/30"
                            onClick={() => setCurrentView('uploaded')}
                            preview={uploadedImages[0]?.url}
                          />
                          <AlbumCard
                            title="Generated"
                            icon={<Sparkles className="w-6 h-6 text-purple-400" />}
                            count={generatedImages.length}
                            gradient="from-purple-500/30 to-pink-500/30"
                            onClick={() => setCurrentView('generated')}
                            preview={generatedImages[0]?.url}
                          />
                        </div>
                      ) : (
                        <>
                          {(currentView === 'uploaded' ? uploadedImages : generatedImages).length === 0 ? (
                            <div className="text-center py-12">
                              <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
                                {currentView === 'uploaded' ? (
                                  <ImageIcon className="w-8 h-8 text-white/30" />
                                ) : (
                                  <Sparkles className="w-8 h-8 text-white/30" />
                                )}
                              </div>
                              <p className="text-white/50 text-sm">No images yet</p>
                              <p className="text-white/30 text-xs mt-1">
                                {currentView === 'uploaded'
                                  ? 'Images you share in chats will appear here'
                                  : 'AI-generated images will appear here'}
                              </p>
                            </div>
                          ) : (
                            <ImageGrid
                              images={currentView === 'uploaded' ? uploadedImages : generatedImages}
                              isGenerated={currentView === 'generated'}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Full image view */}
      {selectedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4"
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
  );
};

export default ImagesModal;
