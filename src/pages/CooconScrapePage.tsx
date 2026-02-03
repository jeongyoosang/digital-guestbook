import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RouteParams = {
  eventId?: string;
};

type StartResponse = {
  ok: boolean;
  scrapeAccountId: string;
  status: string;
  reused?: boolean;
  bankCode?: string | null;
};

export default function CooconScrapePage() {
  const params = useParams<RouteParams>();
  const location = useLocation();
  const navigate = useNavigate();

  // eventId: param / query 둘 다 지원
  const eventId = useMemo(() => {
    return (
      params.eventId ??
      new URLSearchParams(location.search).get("eventId") ??
      undefined
    );
  }, [params.eventId, location.search]);

  const popupRef = useRef<Window | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     1️⃣ 쿠콘 연결 시작
     ========================= */
  /* =========================
     Constants & Helpers
     ========================= */
  const BANK_CODE_MAP: Record<string, string> = {
    국민은행: "004",
    신한은행: "088",
    우리은행: "020",
    하나은행: "081",
    NH농협은행: "011",
    IBK기업은행: "003",
    SC제일은행: "023",
    한국씨티은행: "027",
    카카오뱅크: "090",
    토스뱅크: "092",
    수협은행: "007",
    대구은행: "031",
    부산은행: "032",
    경남은행: "039",
    광주은행: "034",
    전북은행: "037",
    제주은행: "035",
  };

  const getBankCode = (name: string): string | null => {
    // 1) 매핑 테이블 조회
    if (BANK_CODE_MAP[name]) return BANK_CODE_MAP[name];

    // 2) 이름에 포함된 경우 (e.g. "KB국민은행" -> "국민") - 간단 매칭 시도
    for (const [key, code] of Object.entries(BANK_CODE_MAP)) {
      if (name.includes(key.replace("은행", ""))) return code;
    }
    return null;
  };

  const startConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!eventId) {
        setError("이벤트 ID가 없습니다.");
        return;
      }

      // 로그인 세션
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("로그인이 필요합니다.");
        return;
      }

      const userId = session.user.id;

      /* =========================
         A️⃣ event_members.id 조회 (Robust: user_id OR email)
         ========================= */
      let ownerMemberId: string | null = null;
      const userEmail = session.user.email;

      // 1. Try by user_id
      const { data: memberByUser } = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memberByUser) {
        ownerMemberId = memberByUser.id;
      } else if (userEmail) {
        // 2. Try by email
        const { data: memberByEmail } = await supabase
          .from("event_members")
          .select("id")
          .eq("event_id", eventId)
          .eq("email", userEmail)
          .maybeSingle();

        if (memberByEmail) {
          ownerMemberId = memberByEmail.id;
        }
      }

      if (!ownerMemberId) {
        throw new Error("이벤트 멤버 정보를 찾을 수 없습니다. (권한 없음)");
      }

      // ownerMemberId is now guaranteed to be set if we passed the error check

      /* =========================
         B️⃣ 본인 계좌 1개 조회
         ========================= */
      // ✅ `bank_code` 컬럼이 없어서 400 에러 발생 추정 -> `bank_name` 조회 후 매핑
      const { data: account, error: accountErr } = await supabase
        .from("event_accounts")
        // bank_name, account_number(for masking)
        .select("id, bank_name, account_number")
        .eq("event_id", eventId)
        .eq("owner_member_id", ownerMemberId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (accountErr || !account) {
        // console.error(accountErr);
        throw new Error("연결할 계좌가 없습니다. 먼저 계좌를 설정해주세요.");
      }

      const derivedBankCode = getBankCode(account.bank_name);
      if (!derivedBankCode) {
        throw new Error(
          `'${account.bank_name}' 은행 코드를 찾을 수 없습니다. (지원되지 않는 은행)`
        );
      }

      // ✅ 계좌번호 마스킹 (간단 예시: 앞 3자리 + *** + 뒤 2자리 등)
      // 실제로는 전체를 넘겨서 팝업에서 마스킹하거나, 여기서 마스킹해서 넘김.
      // 여기서는 팝업이 'visible' 로 쓸 수 있으므로 그냥 넘기거나, 보안상 마스킹 처리.
      // 사용자가 확인용으로만 쓰므로, "110-***-123456" 형태로 만듦
      const rawNum = account.account_number || "";
      const accountMasked =
        rawNum.length > 6
          ? rawNum.slice(0, 3) + "***" + rawNum.slice(-3)
          : rawNum;

      /* =========================
         C️⃣ coocon-connect start
         ========================= */
      const { data, error } = await supabase.functions.invoke<StartResponse>(
        "coocon-connect",
        {
          body: {
            action: "start",
            eventId,
            bankCode: derivedBankCode, // ✅ 매핑된 코드 사용
          },
        }
      );

      if (error) throw error;

      if (!data?.ok || !data.scrapeAccountId) {
        throw new Error("쿠콘 연결 시작 실패");
      }

      /* =========================
         D️⃣ 쿠콘 HTML 팝업 오픈
         ========================= */
      const url =
        `/coocon/은행_거래내역조회.html` +
        `?eventId=${eventId}` +
        `&scrapeAccountId=${data.scrapeAccountId}` +
        `&bankCode=${encodeURIComponent(derivedBankCode)}` +
        `&bankName=${encodeURIComponent(account.bank_name)}` +
        `&accountMasked=${encodeURIComponent(accountMasked)}`;

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
     2️⃣ 쿠콘 인증 완료 메시지 수신
     ========================= */
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      console.log("[CooconScrapePage] onMessage received:", e.data); // ✅ Debug Log

      if (!e.data || e.data.type !== "COOCON_FINISH") return;

      try {
        console.log("[CooconScrapePage] Processing COOCON_FINISH payload:", e.data); // ✅ Debug Log

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

        if (!session) {
          console.error("[CooconScrapePage] No active session found during onMessage");
          return;
        }

        console.log("[CooconScrapePage] Calling coocon-connect (finish)...");
        const { data: finishRes, error: finishErr } = await supabase.functions.invoke("coocon-connect", {
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

        if (finishErr) {
          console.error("[CooconScrapePage] coocon-connect (finish) failed:", finishErr);
          throw finishErr;
        }
        console.log("[CooconScrapePage] coocon-connect (finish) success:", finishRes);

        // ✅ 만약 중복 병합(Merge)이 일어났다면, 백엔드가 반환한 ID가 진짜 ID임
        const realScrapeAccountId =
          finishRes?.scrapeAccount?.id ?? scrapeAccountId;

        // 팝업 닫기
        if (popupRef.current) {
          console.log("[CooconScrapePage] Closing popup");
          popupRef.current.close();
        }

        // ✅ 4️⃣ 거래내역 스크래핑 요청 (최근 3개월)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);

        const formatDate = (d: Date) => d.toISOString().split("T")[0];

        console.log(`[CooconScrapePage] Calling coocon-scrape-transactions for account: ${realScrapeAccountId}`);

        const body = {
          eventId,
          scrapeAccountId: realScrapeAccountId,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          cooconOutput: e.data.cooconOutput,
          decryptParams: e.data.decryptParams,
          accountNumber: e.data.accountNumber,
          accountMasked: e.data.accountMasked,
          bankCode: e.data.bankCode,
        };

        console.log("[CooconScrapePage] Invoking Edge Function with body:", {
          ...body,
          cooconOutput: body.cooconOutput ? "PRESENT (size=" + JSON.stringify(body.cooconOutput).length + ")" : "MISSING",
          decryptParams: body.decryptParams,
        });

        try {
          const { data: scrapeRes, error: scrapeErr } =
            await supabase.functions.invoke("coocon-scrape-transactions", {
              body,
            });


          if (scrapeErr) {
            console.error("[CooconScrapePage] Transaction scraping failed:", scrapeErr);
            // 에러가 나도 리포트 페이지로 이동은 함 (연결은 성공했으므로)
          } else {
            console.log("[CooconScrapePage] Transaction scraping success:", scrapeRes);
          }
        } catch (e) {
          console.error("[CooconScrapePage] Exception calling scrape-transactions:", e);
        }

        // 리포트 페이지로 이동
        console.log("[CooconScrapePage] Navigating to report page");
        navigate(`/app/event/${eventId}/report`);
      } catch (err) {
        console.error(err);
        setError("쿠콘 인증 완료 처리 실패");
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
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
