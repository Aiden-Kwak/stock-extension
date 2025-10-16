# FocusBoard – Stocks, Coins & Tasks

## 설치 및 빌드
1. 의존성 설치
   ```bash
   npm install
   ```
2. 환경변수 설정
   - `.env` 파일을 생성하고 아래 값을 채워 넣습니다.
     ```bash
     VITE_CG_KEY=YOUR_CG_DEMO_KEY
     VITE_FMP_KEY=YOUR_FMP_KEY # 선택 사항 (SerpApi 장애 시 대체)
     # 선택 사항: 높은 호출 한도를 위해 SerpApi 키를 사용하는 경우 아래 값을 추가하세요.
     # VITE_SERP_KEY=YOUR_SERPAPI_KEY
     VITE_PROXY_URL=https://your-proxy-host
     ```
   - CoinGecko 키가 없으면 코인 차트가 비활성화되며, SerpApi는 키 없이도 작동합니다. FMP 키는 백업 데이터 소스로 활용됩니다.
3. 빌드 실행
   ```bash
   npm run build
   ```
4. Chrome 확장 프로그램 로드
   - `chrome://extensions` 접속 → 개발자 모드 활성화
   - "압축 해제된 확장 프로그램 로드" 클릭 후 `dist` 폴더 선택

> 개발 서버에서 새 탭 오버라이드는 동작하지 않으므로, 빌드 후 dist 폴더를 사용해 동작을 검증하세요.

## 프록시 서버 (공유 캐시)
다중 사용자 환경에서 API 키 제한을 완화하기 위해 `npm run proxy`로 실행할 수 있는 간단한 프록시가 포함되어 있습니다. 동일한 요청은 60초간 캐시되며, 다중 심볼 조회는 자동으로 배치 처리됩니다. 필요한 경우 `VITE_PROXY_URL` 환경 변수를 확장에 설정해 프록시를 통하도록 구성하세요.
