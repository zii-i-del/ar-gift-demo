# Gift Lab · AR Interaction Prototype

当前版本是 T1 追踪基线，用真实摄像头验证输入、坐标和性能调度。

## 已实现

- 摄像头启停、权限错误提示、镜像预览和暂停/恢复。
- Face Landmarker + Hand Landmarker 在同一个 Web Worker 中初始化。
- `createImageBitmap` 帧采集；最多 15 FPS，始终只保留一帧推理在途，结果过期时直接丢弃。
- 场景切换：大笑烟花、指尖爱心、托举泡泡；当前只显示追踪调试点，不伪造正式礼物素材。

## 本地运行

```bash
pnpm install
pnpm run dev
```

摄像头需要 HTTPS 或 localhost，并且需要用户明确授权。模型文件和 WASM 首次运行从 MediaPipe 官方 CDN 加载；视频帧只在本地处理。

## 下一步

T2 将在此基线上加入 landmark 平滑、表情/手势状态机、实例池和 240 实例上限；通过动作误触发测试后，再放入 SVG/GLB 正式美术资产和轻量碰撞求解。
