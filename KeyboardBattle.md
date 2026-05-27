# Keyboard Battle — Claude 지침

## 배포 버전 규칙
- **매 배포(git push)마다 `client/package.json`의 `version`을 0.1 올린다.**
- 형식: X.Y.0 → X.(Y+1).0 (예: 1.4.0 → 1.5.0)
- 버전은 `vite.config.js`의 `__APP_VERSION__`을 통해 로비 화면에 자동 표시됨.
- 별도 언급 없어도 배포 커밋 전에 반드시 버전 업.
