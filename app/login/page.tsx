'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  addFaceEmbeddingListener,
  removeFaceEmbeddingListener,
  sendFaceImageToDevice,
  startFaceIdDeviceConnection,
  stopFaceIdDeviceConnection,
} from '@/lib/faceIdWebSocket';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const { login, loginWithFaceEmbedding, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceAutoFlowRunningRef = useRef(false);
  const faceLoginInProgressRef = useRef(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    return () => {
      // Stop camera tracks on unmount
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  useEffect(() => {
    // Khi mở trang login => luôn kết nối/reconnect tới face device WS.
    startFaceIdDeviceConnection();
    return () => stopFaceIdDeviceConnection();
  }, []);

  useEffect(() => {
    const onEmbedding = async (embedding: number[]) => {
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
        setError(result.error || 'Face không khớp, đang thử lại...');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Đăng nhập bằng Face thất bại');
      } finally {
        faceLoginInProgressRef.current = false;
      }
    };

    addFaceEmbeddingListener(onEmbedding);
    return () => removeFaceEmbeddingListener(onEmbedding);
  }, [loginWithFaceEmbedding, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Đăng nhập thất bại');
    }
    
    setLoading(false);
  };

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
  };

  const startCamera = async () => {
    if (cameraOn || cameraStarting) return;
    setError('');
    setCameraStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ camera');
      }

      // facingMode='user' thường cho camera trước (nếu có).
      // Một số môi trường desktop bỏ qua facingMode nên vẫn fallback video: true.
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể mở camera');
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  };

  const startFaceAutoLoginFlow = async () => {
    if (loading || faceLoading || cameraStarting) return;
    if (faceAutoFlowRunningRef.current) return;

    faceAutoFlowRunningRef.current = true;
    setError('');
    setFaceLoading(true);

    try {
      await startCamera();
      await waitForVideoReady();

      // Mỗi 1 giây chụp + gửi ảnh, không chờ phản hồi WS.
      // Lỗi gửi/chụp chỉ báo lỗi và tiếp tục — không tắt camera, không dừng luồng Face.
      // Chỉ dừng khi: đăng nhập thành công (onEmbedding), hoặc bấm Đóng FaceID (closeFaceIdFlow).
      while (faceAutoFlowRunningRef.current && streamRef.current) {
        try {
          const base64Image = await videoFrameToBase64NoPrefix();
          await sendFaceImageToDevice(base64Image);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Gửi ảnh thất bại, đang thử lại...',
          );
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập bằng Face thất bại');
      // Chỉ khi mở camera / chờ video thất bại mới tắt cờ luồng Face.
      faceAutoFlowRunningRef.current = false;
    } finally {
      setFaceLoading(false);
      // Không set faceAutoFlowRunningRef = false ở đây: tránh dừng nhầm luồng khi có lỗi tạm thời
      // hoặc sau khi nhận embedding (response) — camera phải mở đến khi login OK hoặc Đóng FaceID.
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Đăng Nhập</h1>
        
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={styles.input}
              placeholder="Nhập tên đăng nhập"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mật khẩu</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.passwordInput}
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: 220,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#111827',
                display: cameraOn || cameraStarting ? 'block' : 'none',
              }}
              playsInline
              muted
            />

            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={loading || faceLoading || cameraStarting}
                style={{
                  ...styles.button,
                  ...(loading || faceLoading || cameraStarting ? styles.buttonDisabled : {}),
                  backgroundColor: '#111827',
                }}
                onClick={() => void startFaceAutoLoginFlow()}
              >
                {faceLoading ? 'Đang xác thực Face...' : 'Đăng nhập bằng Face'}
              </button>

              <button
                type="button"
                disabled={!cameraOn && !faceLoading}
                style={{
                  ...styles.button,
                  ...((!cameraOn && !faceLoading) ? styles.buttonDisabled : {}),
                  backgroundColor: '#374151',
                }}
                onClick={closeFaceIdFlow}
              >
                Đóng FaceID
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Nhấn nút để mở camera, tự chụp ảnh gửi tới WS `ws://127.0.0.1:9001/faceId` và giữ camera mở đến khi đăng nhập thành công
          </div>
        </div>

        <div style={styles.footer}>
          <span>Chưa có tài khoản? </span>
          <Link href="/register" style={styles.link}>
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 30px 0',
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  passwordInput: {
    padding: '12px 45px 12px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  passwordToggle: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'color 0.2s',
  },
  button: {
    padding: '12px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#666',
  },
  link: {
    color: '#0070f3',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
