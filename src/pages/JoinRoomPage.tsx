import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// This page is no longer needed - students join rooms directly from the dashboard
// Redirect to the room view
export default function JoinRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/room/${roomId}`, { replace: true });
  }, [roomId, navigate]);

  return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Redirecionando...</div>;
}
