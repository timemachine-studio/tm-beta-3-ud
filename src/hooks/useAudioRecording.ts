import { useState, useCallback, useRef } from 'react';
import RecordRTC from 'recordrtc';

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        },
        video: false
      });

      streamRef.current = stream;

      // Create AudioContext and AnalyserNode for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
        timeSlice: 1000,
      });

      recorder.startRecording();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      const stream = streamRef.current;
      const audioContext = audioContextRef.current;

      if (!recorder || !stream) {
        const error = 'No active recording found';
        setError(error);
        reject(new Error(error));
        return;
      }

      try {
        recorder.stopRecording(async () => {
          try {
            setError(null);
            const blob = await recorder.getBlob();
            
            if (blob.size === 0) {
              throw new Error('No audio data recorded');
            }

            // Stop all tracks and clean up audio context
            stream.getTracks().forEach(track => track.stop());
            if (audioContext && audioContext.state !== 'closed') {
              await audioContext.close();
            }
            
            // Clean up recorder
            recorder.destroy();
            recorderRef.current = null;
            streamRef.current = null;
            audioContextRef.current = null;
            analyserRef.current = null;
            setIsRecording(false);

            // Convert blob to base64 string
            const reader = new FileReader();
            reader.onload = () => {
              const base64String = reader.result as string;
              resolve(base64String);
            };
            reader.onerror = () => {
              const error = 'Failed to convert audio to base64';
              setError(error);
              reject(new Error(error));
            };
            reader.readAsDataURL(blob);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process recording';
            setError(message);
            reject(new Error(message));
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to stop recording';
        setError(message);
        reject(new Error(message));
      }
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    analyser: analyserRef.current
  };
}
