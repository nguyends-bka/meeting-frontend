import '@livekit/components-styles';
import './globals.css';

export const metadata = {
  title: 'Meeting App',
  description: 'Google Meet clone using LiveKit',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
