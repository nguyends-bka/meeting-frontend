'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState('');

  const createMeeting = async () => {
    const res = await fetch('http://localhost:5002/api/meeting/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Meeting',
        hostName: 'Host'
      }),
    });

    const data = await res.json();
    router.push(`/meeting/${data.meetingId}`);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Meeting App</h1>

      <button onClick={createMeeting}>
        Create New Meeting
      </button>

      <hr style={{ margin: '20px 0' }} />

      <input
        placeholder="Enter meeting ID"
        value={meetingId}
        onChange={(e) => setMeetingId(e.target.value)}
      />

      <button
        onClick={() => router.push(`/meeting/${meetingId}`)}
        style={{ marginLeft: 10 }}
      >
        Join Meeting
      </button>
    </div>
  );
}
