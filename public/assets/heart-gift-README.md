# 粉色玻璃爱心 · 可运行初版

实际通过 Blender 5.2.1 后台执行建模、导出和 Cycles 渲染。不是 SVG 冒充的模型。

- 源文件：heart-gift.blend（含双层模型、工作室灯光、相机与动画）
- 网页资产：heart-gift.glb，51,924 字节，2,436 三角形
- 节点：Heart_Rig、Heart_Inner、Heart_Glass
- 动画：Heart_Grow，3 秒，100 fps 导出采样
- 预览：heart-gift-preview.png，实际 Blender 渲染，透明背景
- 本地网页：http://localhost:3001/heart-preview

前 0.5 秒生长并回弹，随后漂浮与呼吸，2.35–3 秒缩小渐隐。GLB 动画承载缩放；世界移动、跟手和透明度由网页生命周期控制，透明度不是 GLB 内烘焙动画。

网页通过 GLTFLoader 加载，六个固定实例共享几何与动画数据；每实例独立的两份材质负责退场，避免一颗爱心淡出影响其他爱心。只在加载失败时回退至 Blender 渲染 PNG。摄像头画面作为 Three.js 背景采样，沿用镜像和居中裁剪。

为适配实时叠加，浏览器对外层玻璃使用透明高光、对内层保留有限透射；不等价于 Cycles 的完整玻璃折射。当前材质仍比参考照片更偏粉色软胶，后续应继续调整吸收、灯光和高光形状，不能视为参考图完全还原。

已验证：Blender 成功保存与渲染、GLB 结构、浏览器正面和侧面加载、项目构建。尚未验证：真实比心 P95 延迟、各移动端 30 FPS、20 轮 GPU 内存稳定性。桌面文件自动打开受 UI 控制问题影响；可在 Blender 打开此目录中的 .blend 文件。线上旧链接尚未更新，Sites 返回 project not found。
