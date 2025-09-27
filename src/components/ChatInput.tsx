import React, { useState, useRef } from 'react';
import { Send, Image, X } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, imageData?: string[]) => void;
}

// Function to convert image to base64
const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() || selectedImage) {
      try {
        let imageDataArray: string[] = [];
        
        if (selectedImage) {
          const base64Image = await convertImageToBase64(selectedImage);
          imageDataArray.push(base64Image);
        }
        
        onSendMessage(message, imageDataArray.length > 0 ? imageDataArray : undefined);
        setMessage('');
        setSelectedImage(null);
        setImagePreviewUrl(null);
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
      {imagePreviewUrl && (
        <div className="mb-2 relative inline-block">
          <img 
            src={imagePreviewUrl} 
            alt="Preview" 
            className="h-20 rounded-md object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
          id="image-upload"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          <Image className="w-5 h-5" />
        </button>
        <button
          type="submit"
          className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
