import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function LegacyResultRedirect() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  useEffect(() => {
    if (!eventId) {
      navigate("/", { replace: true });
      return;
    }
    navigate(`/app/event/${eventId}/report`, { replace: true });
  }, [eventId, navigate]);

  return null;
}
