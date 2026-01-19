'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
} from '@livekit/components-react';

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    const joinMeeting = async () => {
      const res = await fetch('http://localhost:5002/api/meeting/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          identity: `user-${Math.floor(Math.random() * 10000)}`,
        }),
      });

      const data = await res.json();
      setToken(data.token);
      setUrl(data.liveKitUrl);
    };

    joinMeeting();
  }, [meetingId]);

  if (!token || !url) {
    return <div style={{ padding: 20 }}>Connecting to meeting...</div>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      video
      audio
      style={{ height: '100vh' }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
