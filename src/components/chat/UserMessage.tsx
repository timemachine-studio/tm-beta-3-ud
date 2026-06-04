import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { MessageProps } from '../../types/chat';
import { slideInFromRight, slideInFromLeft } from '../../utils/animations';
import { useTheme } from '../../context/ThemeContext';
import { AudioPlayerBubble } from './AudioPlayerBubble';

function UserMessageComponent({ content, imageData, audioData, inputImageUrls, pdfFileName, sender_nickname, sender_avatar, isGroupMode }: MessageProps) {
  const { theme } = useTheme();

  // Check if this is another user's message in group mode
  const isOtherUser = isGroupMode && sender_nickname;

  // Other users' messages align left (like AI), own messages align right
  const alignment = isOtherUser ? 'justify-start' : 'justify-end';
  const animation = isOtherUser ? slideInFromLeft : slideInFromRight;

  return (
    <motion.div
      {...animation}
      className={`flex items-start ${alignment}`}
    >
      <div className="max-w-[85%]">
        {/* Show sender info in group mode for other users */}
        {isOtherUser && (
          <div className="flex items-center gap-2 mb-1">
            {sender_avatar && (
              <img
                src={sender_avatar}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="text-white/50 text-xs font-medium">
              {sender_nickname}
            </span>
          </div>
        )}

        {/* Display audio message if present */}
        {audioData ? (
          <AudioPlayerBubble
            audioSrc={audioData}
            isUserMessage={!isOtherUser}
            className="w-full"
          />
        ) : (
          <div className={`px-4 py-2 rounded-2xl
            ${isOtherUser
              ? 'bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
              : 'bg-purple-500/10 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
            }
            backdrop-blur-sm border
            ${theme.text} text-base`}
          >
          {/* Display images if present - prefer inputImageUrls (persistent URLs) over imageData (base64) */}
          {(inputImageUrls && inputImageUrls.length > 0) ? (
            <div className="mb-3">
              {inputImageUrls.length > 1 ? (
                <div className="grid grid-cols-2 gap-2">
                  {inputImageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Uploaded image ${index + 1}`}
                      className="max-w-full h-auto rounded-lg object-cover max-h-48"
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={inputImageUrls[0]}
                  alt="Uploaded image"
                  className="max-w-full h-auto rounded-lg object-cover max-h-48"
                />
              )}
            </div>
          ) : imageData && (
            <div className="mb-3">
              {Array.isArray(imageData) ? (
                <div className="grid grid-cols-2 gap-2">
                  {imageData.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Uploaded image ${index + 1}`}
                      className="max-w-full h-auto rounded-lg object-cover max-h-48"
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={imageData}
                  alt="Uploaded image"
                  className="max-w-full h-auto rounded-lg object-cover max-h-48"
                />
              )}
            </div>
          )}

            {/* Display PDF attachment indicator if present */}
            {pdfFileName && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/20 border border-red-500/30 flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-white/70 text-sm truncate">{pdfFileName}</span>
              </div>
            )}

            {/* Display text content if present (hide placeholder for PDF-only messages) */}
            {content && !content.startsWith('[PDF:') && <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Memoize to prevent re-renders when parent hover state changes
export const UserMessage = memo(UserMessageComponent);