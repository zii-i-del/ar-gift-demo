# Gift Lab · AR Interaction Prototype

当前版本是 T2 互动验证版，用真实摄像头验证输入、坐标、粒子碰撞和性能调度。

## 已实现

- 摄像头启停、权限错误提示、镜像预览和暂停/恢复。
- Face Landmarker + Hand Landmarker 在同一个经典 Web Worker 中初始化（`public/tracking-worker.js`），避免 RSC 开发服务器把 Worker 依赖留成浏览器不可解析的裸模块。
- `createImageBitmap` 帧采集；最多 15 FPS，始终只保留一帧推理在途，结果过期时直接丢弃。
- 场景切换：大笑烟花、指尖爱心、托举泡泡。烟花包含升空、拖尾、绽放、重力和头部反弹；泡泡使用接触受力与阻尼运动。

## 本地运行

```bash
pnpm install
pnpm run dev
```

摄像头需要 HTTPS 或 localhost，并且需要用户明确授权。模型文件和 WASM 首次运行从 MediaPipe 官方 CDN 加载；视频帧只在本地处理。

调试点仅在 URL 加 `?debug=1` 时显示；默认体验隐藏调试绘制。正式美术素材可在行为验收后替换，运行时仍使用固定对象池和 Canvas 轻量模拟。

## GitHub Pages

公开入口：https://zii-i-del.github.io/ar-gift-demo/

`npm run build:pages` 生成 `pages-dist/`。该入口复用直播主页、样式与全部特效逻辑，不包含本地 tests。
构建前 `scripts/prepare-vision.mjs` 从已安装的 MediaPipe 包复制运行文件，并下载固定版本的官方模型。生成的 `public/vision/` 不进入源码提交，随静态产物一起发布，浏览器从网站同源加载模型。

GitHub Pages 使用 `gh-pages` 分支根目录发布。更新源码后需重新构建并发布产物；仅推送 main 不会更新线上网站。
摄像头需要 HTTPS、浏览器权限及 WebGL 支持。公开链接的可用性仍受 GitHub Pages 网络覆盖和用户设备限制。
