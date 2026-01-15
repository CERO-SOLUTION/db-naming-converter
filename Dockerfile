# 빌드 명령어(전역 스코프)
ARG BUILD_COMMAND

# 베이스 이미지
FROM node:20.10.0-alpine AS base

# pnpm 추가 - 실행 환경에 따라 주석 해제
RUN npm install -g pnpm
# RUN npm install -g yarn

# 의존성 설치
FROM base AS deps
# libc6-compat 설치 이유
# https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 패키지 매니저별로 node_modules 의존성 설치
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 필요할 때만 소스 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# XLSX 파일 다운로드 (전체 스프레드시트 다운로드 - 모든 시트 포함)
RUN apk add --no-cache curl && \
    curl -L -f "https://docs.google.com/spreadsheets/d/1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY/export?format=xlsx" -o BMS_테이블_정의_V1.1.xlsx && \
    ls -la BMS_테이블_정의_V1.1.xlsx

# Next.js 익명 수집 끄기
ENV NEXT_TELEMETRY_DISABLED 1

# 빌드 명령어(전역 스코프 => 하위 빌드 스테이지 사용)
ARG BUILD_COMMAND

# 외부 시크릿을 주입하고 빌드
# RUN --mount=type=secret,id=nextEnv,target=/app/.env.local $BUILD_COMMAND

# 외부 시크릿 없이 빌드
RUN sh -c "$BUILD_COMMAND"

# public 디렉토리가 없으면 생성 (Next.js standalone 빌드에 필요)
RUN mkdir -p public && touch public/.gitkeep

# 프로덕션 이미지, 모든 파일을 복사하고 실행
FROM base AS runner
WORKDIR /app

# 런타임 중에 익명 수집 끄기: 다음 줄의 주석 처리를 해제
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# public 디렉토리 복사 (builder에서 생성했으므로 항상 존재)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 프리렌더 캐시에 대한 올바른 권한 설정
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 이미지 크기 줄이기
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# 호스트 이름 localhost로 설정
ENV HOSTNAME "0.0.0.0"

# server.js는 standalone 출력에서 next build에 의해 생성
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]