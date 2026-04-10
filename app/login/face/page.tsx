'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  addFaceEmbeddingListener,
  FACE_FRAME_SEND_INTERVAL_MS,
  removeFaceEmbeddingListener,
  sendFaceImageToDevice,
  startFaceIdDeviceConnection,
  stopFaceIdDeviceConnection,
} from '@/lib/faceIdWebSocket';
import './face-camera.css';

export default function FaceLoginPage() {
  const [faceLoading, setFaceLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [faceGuideDetected, setFaceGuideDetected] = useState(false);
  const { loginWithFaceEmbedding, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceAutoFlowRunningRef = useRef(false);
  const faceLoginInProgressRef = useRef(false);
  const faceGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    return () => {
      if (faceGuideTimerRef.current) clearTimeout(faceGuideTimerRef.current);
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  useEffect(() => {
    startFaceIdDeviceConnection();
    return () => stopFaceIdDeviceConnection();
  }, []);

  useEffect(() => {
    const onEmbedding = async ({ embedding }: { embedding: number[] }) => {
      if (!faceAutoFlowRunningRef.current) return;
      if (faceLoginInProgressRef.current) return;

      faceLoginInProgressRef.current = true;
      try {
        const result = await loginWithFaceEmbedding(embedding);
        if (result.success) {
          faceAutoFlowRunningRef.current = false;
          router.push('/');
          return;
        }
      } catch {
        // im lặng — tiếp tục thử khi có embedding mới
      } finally {
        faceLoginInProgressRef.current = false;
      }
    };

    addFaceEmbeddingListener(onEmbedding);
    return () => removeFaceEmbeddingListener(onEmbedding);
  }, [loginWithFaceEmbedding, router]);

  useEffect(() => {
    if (faceGuideTimerRef.current) {
      clearTimeout(faceGuideTimerRef.current);
      faceGuideTimerRef.current = null;
    }
    if (cameraOn) {
      faceGuideTimerRef.current = setTimeout(() => setFaceGuideDetected(true), 1500);
    } else {
      setFaceGuideDetected(false);
    }
    return () => {
      if (faceGuideTimerRef.current) clearTimeout(faceGuideTimerRef.current);
    };
  }, [cameraOn]);

  const videoFrameToBase64NoPrefix = async (): Promise<string> => {
    const video = videoRef.current;
    if (!video) throw new Error('Không tìm thấy video camera');
    if (!video.videoWidth || !video.videoHeight) throw new Error('Camera chưa sẵn sàng');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) throw new Error('Base64 không hợp lệ');
    return base64;
  };

  const waitForVideoReady = async (timeoutMs: number = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Camera chưa sẵn sàng để chụp ảnh');
  };

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const closeFaceIdFlow = () => {
    faceAutoFlowRunningRef.current = false;
    faceLoginInProgressRef.current = false;
    setFaceLoading(false);
    stopCamera();
    router.push('/login');
  };

  const startCamera = async () => {
    if (cameraOn || cameraStarting) return;
    setCameraStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ camera');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Không tìm thấy video element');

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
    } catch {
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  };

  const startFaceAutoLoginFlow = async () => {
    if (faceLoading || cameraStarting) return;
    if (faceAutoFlowRunningRef.current) return;

    faceAutoFlowRunningRef.current = true;
    setFaceLoading(true);

    try {
      await startCamera();
      await waitForVideoReady();

      while (faceAutoFlowRunningRef.current && streamRef.current) {
        try {
          const base64Image = await videoFrameToBase64NoPrefix();
          await sendFaceImageToDevice(base64Image);
        } catch {
          // bỏ qua lỗi tạm thời, vòng lặp tiếp tục
        }
        await new Promise((r) => setTimeout(r, FACE_FRAME_SEND_INTERVAL_MS));
      }
    } catch {
      faceAutoFlowRunningRef.current = false;
    } finally {
      setFaceLoading(false);
    }
  };

  const scanActive = cameraOn && faceLoading;

  return (
    <div className="face-cam-page">
      <div className="fc-panel">
        <div className="fc-panel-title">
          <span className="fc-title-main">🎥 XÁC THỰC KHUÔN MẶT</span>
          <span className="fc-sub">— Đăng nhập BKMeeting</span>
        </div>

        <div className="fc-video-wrapper">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className={`fc-scan-line${scanActive ? ' active' : ''}`} aria-hidden />
          <div className="fc-corner tl" />
          <div className="fc-corner tr" />
          <div className="fc-corner bl" />
          <div className="fc-corner br" />
          <div className={`fc-face-guide${faceGuideDetected ? ' detected' : ''}`} />
        </div>

        <div className="fc-btn-row">
          <button
            type="button"
            className="fc-btn fc-btn-primary"
            disabled={faceLoading || cameraStarting}
            onClick={() => void startFaceAutoLoginFlow()}
          >
            {faceLoading ? 'ĐANG XÁC THỰC...' : cameraOn ? '✔ CAMERA BẬT' : '▶ BẬT CAMERA'}
          </button>
          <button type="button" className="fc-btn fc-btn-close" onClick={closeFaceIdFlow}>
            ✕ ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
}
