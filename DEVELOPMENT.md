# 테스트 브랜치 작업

일반 수정과 테스트는 `dev` 브랜치에서 진행하고, 검증이 끝난 변경을 `main`에 반영합니다.

- 일반 수정은 이 `dev` 브랜치에 커밋하고 푸시합니다.
- 테스트 주소: https://mhsong282828221212123123123.github.io/CT-dashcam-studio-WEB/dev/
- PC와 모바일에서 Tier 옆의 작은 `DEV` 표시로 테스트판을 구분합니다.
- 확인이 끝난 변경만 `main`에 병합해 정식 주소에 반영합니다.
- `dev` 푸시 때에도 정식 주소는 `main`의 코드로 빌드됩니다.
- 각 주소의 `deployment.json`에 기록된 브랜치와 커밋으로 배포 소스를 확인할 수 있습니다.

# 내보내기 경로와 오프라인 동작 (iOS/iPadOS 개선)

- **프레임 소스**: Android가 아닌 환경은 클립을 WebCodecs `VideoDecoder`로 직접 디코딩합니다(`src/core/frameSource.ts`). H.264가 아니거나 디코더가 실패하면 그 시점부터 기존 `<video>` 탐색 방식으로 자동 전환합니다. Android는 기존 연속 재생 방식을 그대로 씁니다.
- **출력 저장**: 예상 크기가 150MB를 넘고 브라우저가 지원하면 결과 MP4를 OPFS(`ct-exports/`)에 바로 씁니다(`src/core/exportStorage.ts`). 이 파일은 다음 내보내기를 시작할 때 지워집니다.
- **iOS 저장**: 내보내기가 끝나면 공유 시트와 파일 다운로드 중 하나를 고르는 대화상자를 띄웁니다.
- **오프라인**: 빌드가 `dist/sw.js`에 프리캐시 목록과 빌드 ID를 주입합니다(`vite.config.ts`의 `precacheServiceWorker`). 개발 서버에서는 서비스 워커가 아무것도 캐시하지 않습니다.

Chrome 검증(로컬 `npm run build && npx vite preview` 실행 중에):

```bash
CLIP_DIR=/path/to/SavedClips/<이벤트 폴더> OUT_DIR=/tmp/ct-out node test/chrome_e2e_export_paths.cjs
node test/chrome_e2e_offline.cjs
```

Safari(iOS/iPadOS)의 실제 디코더, 공유 시트, OPFS 쓰기는 이 스크립트로 확인되지 않으므로 실기기에서 따로 확인해야 합니다.

# 번호판·얼굴 모자이크 (실험 기능)

- **구성**: `src/core/privacy/`에 있습니다. 차량(YOLOv8n)·얼굴(YuNet) 검출은 ONNX Runtime Web(WebAssembly, 단일 스레드)으로 돌리고, 번호판 위치 판정과 추적은 데스크톱 `core/privacy_filter.py`를 옮긴 TypeScript 코드입니다.
- **원본과 다른 점**: 데스크톱은 번호판 후보를 찾을 때 MSER도 쓰는데 이 부분은 옮기지 않았습니다. 그래서 비스듬히 찍힌 번호판이나 차체와 색이 비슷한 번호판은 데스크톱보다 덜 잡힙니다. 얼굴 모델은 640×640 고정 입력이라 데스크톱(가로 320)보다 작은 얼굴을 더 잘 잡습니다.
- **동작**: 미리보기는 백그라운드로 분석해 조금 늦게 따라오고, 내보내기는 매 프레임을 분석한 뒤 인코딩합니다(4프레임마다 검출, 사이 프레임은 템플릿 추적). 모델을 못 불러오거나 분석이 실패하면 모자이크 없이 저장하지 않고 내보내기를 중단합니다.
- **미지원**: Android 내보내기(연속 재생 방식이라 프레임별 분석을 기다릴 수 없음), 번호판 선명화.
- **파일**: 모델은 `public/models/*.onnx`에 커밋되어 있고, 런타임 wasm은 `scripts/copy-privacy-runtime.mjs`가 `public/ort/`로 복사합니다(git 제외). 둘 다 오프라인 프리캐시에는 넣지 않고 처음 쓸 때 캐시됩니다.

검증 스크립트:

```bash
# 모자이크 켠 내보내기와 끈 내보내기를 저장 (결과 영상은 눈으로 확인)
CLIP_DIR=/path/to/SavedClips/<이벤트 폴더> OUT_DIR=/tmp/ct-out node test/chrome_e2e_privacy.cjs
# 데스크톱 검출 결과(JSON)와 비교: 원시 RGBA 프레임과 기준 JSON을 직접 준비해야 합니다
npx vite-node test/privacyHarness.mts <rawDir> <modelsDir> <ref.json>
```
