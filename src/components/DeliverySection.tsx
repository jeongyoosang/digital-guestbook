import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, FileVideo, FileSpreadsheet } from "lucide-react";

export const DeliverySection: React.FC = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        {/* 섹션 제목 + 인트로 */}
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
          신랑신부에게 전달되는 순간
        </h2>

        <p className="text-center text-muted-foreground mb-16 max-w-3xl mx-auto leading-relaxed">
          결혼식 현장에서는 하객들의 축하 메시지가{" "}
          <strong>스탠드형 디스플레이를 통해 실시간으로 AI가 자동 연출</strong>
          합니다.<br />
          식장의 분위기에 따라 다채롭게 변화하며, 현장의 감동을 더합니다.<br />
          본식이 끝남과 동시에, 그 모든 장면은 <strong>영상으로 기록</strong>되어 전달되며,<br />
          동일한 데이터가 <strong>엑셀 파일로 함께 제공</strong>됩니다.<br />
          (신랑신부 외 파일 동시 수령자 지정 가능 / 기본 스탠드형 디스플레이 제공 / 장소 환경에 맞춰 연동 가능)
        </p>

        {/* 1️⃣ 현장 실시간 표시 (AI 자동 연출) */}
        <Card className="border-2 border-pink-100/50 bg-white/70">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-pink-50 p-3">
                <Sparkles className="w-6 h-6 text-pink-500" aria-hidden="true" />
              </div>
              <div className="w-full">
                <h3 className="text-2xl font-semibold">현장에서 실시간 AI 자동 연출</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  하객들의 축하 메시지가 도착하는 즉시{" "}
                  <strong>홀 입구에 비치된 스탠드형 디스플레이</strong>를 통해
                  AI가 자동으로 연출합니다.<br />
                  풍선처럼 떠오르거나, 식장의 분위기에 따라 다채롭게 변화하며 결혼식의 감동을 더합니다.
                </p>

                {/* 옵션/확장 안내 */}
                <p className="mt-3 text-sm text-muted-foreground italic">
                  * 신부대기실·연회장 등은 옵션으로 스탠드형 디스플레이 추가가 가능하며,<br />
                  프로젝터 등 기타 장비 연동은 장소와 협의 후 확정됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2️⃣ 예식 직후 전달물: 영상 + 엑셀 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 border-blue-100/60 bg-white/70">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-blue-50 p-3">
                  <FileVideo className="w-6 h-6 text-blue-500" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">영상으로 감동을 그대로</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">
                    현장 연출 장면과 축하 메시지가 <strong>영상</strong>으로 기록되어 예식 직후 전달됩니다.
                    다시 볼 때마다 그날의 온기를 생생히 느낄 수 있어요.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-100/60 bg-white/70">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-green-50 p-3">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">엑셀로 정확하게</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">
                    동일한 내용을 <strong>엑셀(XLSX)</strong>로 함께 제공합니다.
                    연락처·메시지 등 데이터를 손쉽게 검색·분류·백업할 수 있어요.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 하단 요약 안내 (중복 최소화) */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          * 현장 장비는 장소 환경에 맞춰 세팅해 드립니다.
        </p>
      </div>
    </section>
  );
};
