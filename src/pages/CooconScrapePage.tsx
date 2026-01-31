// src/pages/CooconScrapePage.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RouteParams = {
  eventId: string;
};

type StartResponse = {
  ok: boolean;
  scrapeAccountId: string;
  status: string;
};

export default function CooconScrapePage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const popupRef = useRef<Window | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrapeAccountId, setScrapeAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     1️⃣ 쿠콘 연결 시작
     ========================= */
  const startConnect = async () => {
  try {
    setLoading(true);
    setError(null);

    if (!eventId) {
      setError("이벤트 ID가 없습니다.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("로그인이 필요합니다.");
      return;
    }

    const { data, error } = await supabase.functions.invoke<StartResponse>(
      "coocon-connect",
      {
        body: {
          action: "start",
          eventId,
        },
      }
    );

    if (error) throw error;

    if (!data?.ok || !data.scrapeAccountId) {
      throw new Error("쿠콘 연결 시작 실패");
    }

      setScrapeAccountId(data.scrapeAccountId);


      /* =========================
         2️⃣ 쿠콘 HTML 새 창 오픈
         ========================= */
      const url =
      `/coocon/은행_거래내역조회.html` +
      `?eventId=${eventId}` +
      `&scrapeAccountId=${data.scrapeAccountId}`;


      popupRef.current = window.open(
        url,
        "coocon_scrape",
        "width=960,height=800"
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     3️⃣ 쿠콘 인증 완료 메시지 수신
     ========================= */
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (!e.data || e.data.type !== "COOCON_FINISH") return;

      try {
        const {
          scrapeAccountId,
          bankCode,
          bankName,
          accountMasked,
          mode,
        } = e.data;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const { error } = await supabase.functions.invoke("coocon-connect", {
        body: {
          action: "finish",
          eventId,
          scrapeAccountId,
          bankCode,
          bankName,
          accountMasked,
          mode: mode ?? "real",
        },
      });

      if (error) throw error;


        // 팝업 닫기
        popupRef.current?.close();

        // 리포트 페이지로 이동
        navigate(`/app/event/${eventId}/report`);
      } catch (err) {
        console.error(err);
        setError("쿠콘 인증 완료 처리 실패");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [eventId, navigate]);

  /* =========================
     UI
     ========================= */
  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <Card>
        <CardContent className="p-8 space-y-6">
          <h1 className="text-xl font-bold tracking-tight">
            축의금 계좌 연결
          </h1>

          <p className="text-sm text-muted-foreground">
            은행 계좌를 연결하면 결혼식 당일 축의금 내역을 자동으로
            불러올 수 있습니다.
          </p>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={loading}
            onClick={startConnect}
          >
            {loading ? "연결 중…" : "은행 계좌 연결하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
