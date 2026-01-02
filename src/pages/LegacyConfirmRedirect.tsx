import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function LegacyConfirmRedirect() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  useEffect(() => {
    if (!eventId) {
      navigate("/", { replace: true });
      return;
    }
    navigate(`/app/event/${eventId}/settings`, { replace: true });
  }, [navigate, eventId]);

  return null;
}
