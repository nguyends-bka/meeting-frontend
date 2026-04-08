'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Modal } from 'antd';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import {
  addRegisterFaceEmbeddingListener,
  removeRegisterFaceEmbeddingListener,
  sendRegisterFaceImageToDevice,
  startRegisterFaceDeviceConnection,
  stopRegisterFaceDeviceConnection,
} from '@/lib/faceIdWebSocket';
import './face-registration-modal.css';

const SESSION_SKIP_KEY = 'bk_face_reg_skipped';

export function FaceRegistrationGate() {
  const { user, loading, isAuthenticated, updateUser } = useAuth();
  const { message } = App.useApp();

  const [skipHydrated, setSkipHydrated] = useState(false);
  const [sessionSkipped, setSessionSkipped] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraFlowStarted, setCameraFlowStarted] = useState(false);
  const [faceGuideDetected, setFaceGuideDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const flowActiveRef = useRef(false);
  const messageRef = useRef(message);
  const updateUserRef = useRef(updateUser);
  const faceGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  messageRef.current = message;
  updateUserRef.current = updateUser;

  useEffect(() => {
    setSkipHydrated(true);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      // Mỗi phiên đăng nhập mới phải hỏi lại đăng ký khuôn mặt.
      try {
        sessionStorage.removeItem(SESSION_SKIP_KEY);
      } catch {
        // ignore
      }
      setSessionSkipped(false);
      return;
    }

    try {
      setSessionSkipped(sessionStorage.getItem(SESSION_SKIP_KEY) === '1');
    } catch {
      setSessionSkipped(false);
    }
  }, [isAuthenticated, loading]);

  const needsRegistration =
    Boolean(user) && user!.hasFaceEmbedding === false;

  const open =
    skipHydrated &&
    !loading &&
    isAuthenticated &&
    needsRegistration &&
    !sessionSkipped;

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const resetFlow = useCallback(() => {
    flowActiveRef.current = false;
    setRegistering(false);
    setCameraFlowStarted(false);
    setFaceGuideDetected(false);
    stopCamera();
    stopRegisterFaceDeviceConnection();
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      resetFlow();
    }
  }, [open, resetFlow]);

  useEffect(() => {
    return () => {
      flowActiveRef.current = false;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopRegisterFaceDeviceConnection();
    };
  }, []);

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

  const skipForSession = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, '1');
    } catch {
      // ignore
    }
    setSessionSkipped(true);
    resetFlow();
  }, [resetFlow]);

  useEffect(() => {
    if (!open || !cameraFlowStarted) return;

    let cancelled = false;

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
        if (cancelled) throw new Error('Đã hủy');
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error('Camera chưa sẵn sàng để chụp ảnh');
    };

    const startCamera = async () => {
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

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Không tìm thấy video element');

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
    };

    /** Giống /login/face: gửi ảnh mỗi 50ms; embedding nhận qua listener. */
    const FRAME_INTERVAL_MS = 50;
    let regInFlight = false;

    const onEmbedding = async (embedding: number[]) => {
      if (!flowActiveRef.current || cancelled || regInFlight) return;
      regInFlight = true;
      try {
        const res = await apiService.registerFaceEmbedding(embedding);
        if (res.error) {
          messageRef.current.error(res.error);
          return;
        }
        updateUserRef.current({ hasFaceEmbedding: true });
        messageRef.current.success('Đăng ký sinh trắc học thành công');
        flowActiveRef.current = false;
      } catch {
        // im lặng — tiếp tục gửi khung hình khi có embedding mới
      } finally {
        regInFlight = false;
      }
    };

    const run = async () => {
      flowActiveRef.current = true;
      setRegistering(true);
      startRegisterFaceDeviceConnection();
      addRegisterFaceEmbeddingListener(onEmbedding);

      try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled) return;

        setCameraStarting(true);
        try {
          await startCamera();
        } finally {
          setCameraStarting(false);
        }

        if (cancelled) return;
        await waitForVideoReady();

        while (flowActiveRef.current && streamRef.current && !cancelled) {
          try {
            const base64Image = await videoFrameToBase64NoPrefix();
            await sendRegisterFaceImageToDevice(base64Image);
          } catch {
            // bỏ qua lỗi tạm thời, giống luồng face login
          }
          await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
        }
      } catch (e) {
        if (!cancelled) {
          messageRef.current.error(e instanceof Error ? e.message : 'Không thể mở camera');
        }
      } finally {
        removeRegisterFaceEmbeddingListener(onEmbedding);
        if (!cancelled) {
          flowActiveRef.current = false;
          setRegistering(false);
          stopCamera();
          stopRegisterFaceDeviceConnection();
          setCameraFlowStarted(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      flowActiveRef.current = false;
      removeRegisterFaceEmbeddingListener(onEmbedding);
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraOn(false);
      stopRegisterFaceDeviceConnection();
      setRegistering(false);
      setCameraStarting(false);
      setCameraFlowStarted(false);
    };
  }, [open, cameraFlowStarted, stopCamera]);

  const scanActive = cameraOn && registering;

  const primaryLabel = cameraStarting
    ? 'ĐANG MỞ CAMERA...'
    : registering || cameraFlowStarted
      ? 'ĐANG ĐĂNG KÝ...'
      : '▶ BẬT CAMERA';

  const primaryDisabled = cameraFlowStarted || registering || cameraStarting;

  return (
    <Modal
      open={open}
      onCancel={skipForSession}
      footer={null}
      closable={false}
      maskClosable
      destroyOnHidden
      centered
      width={560}
      className="fr-reg-modal"
      zIndex={1100}
      afterOpenChange={(vis) => {
        if (!vis) resetFlow();
      }}
    >
      <div className="fr-modal-shell">
        <div className="fr-panel">
          <div className="fr-panel-title">
            <span className="fr-title-icon" aria-hidden>
              🤖
            </span>
            <span className="fc-title-main">ĐĂNG KÝ SINH TRẮC HỌC</span>
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
              disabled={primaryDisabled}
              onClick={() => {
                if (!cameraFlowStarted) setCameraFlowStarted(true);
              }}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              className="fc-btn fc-btn-close"
              onClick={skipForSession}
            >
              ✕ ĐÓNG
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
