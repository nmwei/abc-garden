# 界面交互约定

适用于阅读小花园、ABC 小花园和 123 小花园。沿用各站现有配色和组件，统一按钮优先级、文案和反馈。

## 家长入口确认弹窗（已采用）

- 标题、说明左对齐。底部动作成组靠右，左边是浅描边「取消」，右边是深绿色「按住 1 秒进入」。两个按钮同高，间距约 10px，触控高度至少 44px。
- 取消只关闭弹窗。按住时在按钮内显示进度，未满 1 秒就松手应复位。保留可见的键盘焦点，核对触摸和键盘都能取消或完成操作。
- 按钮顺序和位置参考 [Ant Design Modal.confirm](https://ant.design/components/modal/#modalmethod)、[shadcn/ui Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog)、[Material 3 Dialog](https://github.com/material-components/material-components-android/blob/master/docs/components/Dialog.md) 和 [Apple HIG Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)。长按 1 秒是小花园自己的入口规则。

## 应用更新区

- 更新区属于设置页。两个按钮在内容区左侧同排、等高，顺序始终是「检查更新」「重新加载并回首页」。窄屏空间不足时按原顺序换行。触控高度至少 44px。
- 平时「检查更新」用实底，「重新加载并回首页」用描边。新版确实准备好后，检查改回描边，重载成为唯一实底按钮，位置不互换。已经是最新版时，重载仍是次要动作。
- 检查、就绪、已是最新或失败等结果在按钮组附近用短文本反馈，可由读屏工具获知，不抢焦点。检查或启用期间避免重复触发。检查留在家长页；重载有待启用版本时先等待启用，成功后回首页，失败留在原处供重试。已保存的学习记录和设置保留。
- 主次按钮参考 [Fluent 2 Button](https://fluent2.microsoft.design/components/web/react/core/button/usage) 和 [Ant Design Button](https://ant.design/components/button/)。结果反馈参考 [WCAG 2.2 状态消息](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)。
