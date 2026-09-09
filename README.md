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
