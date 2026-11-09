# 一起学：学习引擎与策略配置

“一起学”执行面向学前儿童的看图命名、熟悉情境用词路径。家长提供理解与表达表现，网站调度下一步；不自动判断孩子发音，也不保证当日全部掌握。

## 配置边界

默认配置集中在 `app/guided-learning-policy.js`；历史基线 `LEGACY_GUIDED_POLICY` 是迁移资料，不随日后调参修改。新配置通过局部覆盖传入。十个设置对应学习负荷、提取机会与复习安排，其他约束不做开关。

| 设置 | 默认 | 可传入值 | 用途 |
|---|---:|---|---|
| session.maxWords | 10 | 1–10 | 本次范围上限；不足时取实际词数 |
| session.breakAfterMinutes | 15 | 5–30 | 一段活动的休息提醒；家长可随时停 |
| teaching.newWordsPerGroup | 2 | 1–6（家长界面2–6） | 同时重点认识的新词数；困难后下一组降为1 |
| teaching.maxMeaningAttempts | 2 | 1–3 | 听辨仍不理解时，结束本次该词的要求，不继续逼说 |
| retrieval.newWordSuccesses | 2 | 2–3 | 新教词需要几次隔开且连续的独立回想，才记一次当日证据 |
| retrieval.maxAttempts | 3 | 2–4 | 本次每词口头回想上限；达到目标即停止，不必做满 |
| retrieval.minInterveningActivities | 1 | 1–3 | 再次回想前至少完成多少其他活动；跳过不算 |
| retrieval.preferredAfterSuccess | 2 | 1–5，且不小于最小间隔 | 成功后优先穿插更多任务；没有其他任务时不强造等待 |
| review.retryAfterMinutes | 10 | 1–60 | 本次仍需支持的词，下一次短复习的起点 |
| review.intervalsDays | [1,3,7] | 三个递增的1–365日整数 | 隔日、跨日成功和换情境运用后的日历日间隔 |

这些是产品边界与可调整默认值，不是实验确定的“最佳剂量”。默认承载既定原则：少量新词、先理解后提取、其他活动自然穿插、跨日复习、换情境验证。调参要结合孩子的参与状态与隔天独立表达，不能只看通关速度。

配置支持嵌套的局部覆盖。未知字段、非整数、越界值、成功次数高于尝试上限、非递增的复习日程等都会明确报错，不会偷偷修正输入。休息时间和新词数量的界面文字也读取同一份配置。

以下规则固定，不提供放宽开关：提示过的本次表达不能记独立；小游戏不加掌握分；跳过不计学习间隔；未理解意思不要求口头回想；同一天不能累加多个跨日成功；范围变化重排当前任务但不清历史。30秒的近期接触识别仅防止重新安排后立即回声式作答，会安排其他活动，没有倒计时门槛。

## 模块职责

- `guided-learning-policy.js`：默认策略、局部覆盖、完整快照校验。策略ID为 `preschool-speaking`，当前版本2。
- `guided-learning-settings.js`：模块内的两项偏好及独立本机存储；不读写学习证据。
- `guided-words-core.js`：状态转换、提取与复习证据、任务选择、决策原因和页面所需的投影。公共入口是 `createGuidedLearning()`。
- `guided-progress.js`：存储格式版本5、旧记录校验与迁移、可注入的同步存储接口和并发写入保护。迁移不调度任务，不改历史成功。
- `guided-activities.js` / `guided-learning-games.js`：逐词内容与小游戏素材。表达目标、玩法和声音内容不写入通用调度器。
- `guided-words.js`：浏览器协调层；把声音播放结果和家长反馈转换成引擎事件，处理存储失败、焦点和阅读位置。
- `guided-words-view.js`：展示当前任务和进度投影，不读取内部队列、次数规则或存储。
- `course.js`：当前产品的装配位置，注入“正在学”、有效词库、内容版本、逐词玩法和声音服务。

## 使用方式

应用内可通过 `new Course({ ..., guidedPolicy: { session: { breakAfterMinutes: 12 } } })` 传入覆盖；没有传入时使用统一默认值。动态宿主可用 `getGuidedPolicy()` 提供最新覆盖。“一起学 → 设置”只开放每批新词上限（2–6）和休息提醒（10/15/20分钟），保存在 `abc-garden-guided-settings-v1`；其余参数保留为开发接口。更改偏好不修改进行中的策略快照，下次新安排或明确重新学时使用。

独立引擎不需要浏览器或内置词库：

```js
import {createGuidedLearning} from '../app/guided-words-core.js';
import {freshGuided} from '../app/guided-progress.js';

const engine = createGuidedLearning({
  policy: {
    session: { maxWords: 6, breakAfterMinutes: 12 },
    teaching: { newWordsPerGroup: 1 },
  },
  now: () => clock.now(),
  random: seededRandom,
  gameIds: ['mirror', 'drawing', 'rhythm'],
});
let state = freshGuided();
state = engine.transition(state, {
  type: 'start', ids: wordIds, pictureIds, contentVersion,
});
const view = engine.describe(state, wordIds);
// view.currentTask / view.policy（当前）/ view.planningPolicy（下次安排）/ view.progress / view.decision
state = engine.transition(state, { type: 'model' }); // 播放成功之后
state = engine.transition(state, { type: 'continue' });
```

`transition()`不修改输入对象；无效或无变化的事件返回原对象。有效事件包括 start、restart、scope、content、reconcile、resume、finish、prompt、model、understood、choose、continue、recall、defer。声音失败不发送 model 事件；页面退出或休息需要取消未完成播放。

“设置”页的“重新学这组”需要确认，取消和 Escape 都不写进度。确认后发送独立的 `restart` 事件，按最新设置建立带 `relearn:true` 的新任务，让每一小组都从理解意思和听辨开始，而不是根据已有 meaning 记录直接进入回想。历史 entries 与 observations 在启动时保持原样；之后仅追加实际表现，同日不重复增加独立日期或等级。退出、刷新、休息与普通 start 都不会触发重新教学。重学状态随任务保存，后面的小组也遵守同一路径。存储失败保留原任务，并在确认框内支持重试。

存储通过 `createGuidedRepository({storage,key})` 或同契约的 `load()/save(data,expectedRaw)` 注入；保存失败不能前进，其他页面写过后不能覆盖。`restoreGuidedProgress()`返回 data 和兼容性提示。遇到无法执行的新策略版本保留原始存储并停止写入，提示更新，而非静默重新开始。

## 快照、证据与升级

每次开始保存完整 `session.policySnapshot` 和小游戏ID列表；当前任务继续采用该快照。调整默认配置只影响下一次新安排，当前词数校验、计时、恢复和文案均依据旧快照，不会因为新默认值变小而丢掉进行中的任务。结束后的新安排采用新默认值。

长期的 `entries` 是已发生的事实，不因调参重新计算或补记。`observations`保留最近200条实际口头回想记录及当时完整策略，区别独立、提示和仍需练习，也记录是否真的获得当日证据。小游戏和跳过不产生口头回想记录。每段 `trace`最多64条，记录事件和下一步选择原因，供本地排查；不上传、不记录声音。

调整参数含义或学习算法时，应增加策略版本并提供对应兼容/迁移逻辑；改变存储形状应增加存储版本。保留旧事实与提示标记。不能把修改当前页面的渲染流程当成重新规划学习的理由：刷新、查看安排和休息恢复，应保留已经显示的那道题。

## 回归重点

- `tests/fixtures/guided-default-path.json` 固定了本次重构前的默认路径与学习证据，保证默认行为未意外改变。
- 策略测试覆盖合法局部覆盖、相互约束、未知字段和完整快照。
- 引擎测试使用固定时间和随机数，覆盖自定义内容、不同参数组合、次数上限、日历日复习、当前快照与新默认值隔离、提示和存储失败。
- 浏览器检查自定义6分钟配置的真实计时和动态文案，及手机/iPad、继续、范围变化、旧队列迁移和未知版本的保护。

程序模拟与浏览器测试证明机制按定义执行，不等于已经验证某组参数对孩子的长期学习效果。

## 学习工作区的布局边界

图卡、家长提示和操作区属于同一张 `guided-stage` 卡片。操作区在正常文档流中占位，短屏通过 `position:sticky;bottom:0` 保持按钮可见；不再以独立悬浮卡片和额外页尾占位分离显示。平板和宽屏教学页铺满可用屏高，内容在中间区域自适应排布；窄屏手机教学页按内容高度排布，长说明可滚动。回想页使用可用屏高。真实操作区高度仍用于约束回想图片尺寸，避免提示换行或手机安全区变化时挤掉按钮。

按钮尺寸和连接边界在 `app/styles.css` 的 guided-stage / guided-dock 规则中调整。复核时分别检查短屏初始画面和滚动到说明末尾的画面；完整长截图不能代替真实视口截图，因为 sticky 元素在长截图中的位置可能失真。布局修改不改变提示记录、成功条件或任务调度。

新词批量与听音选图难度分开：每题最多4张已引入且适合图片辨认的图，始终包含正确目标，其余候选随机抽取；不足2张时继续采用家长观察的听懂反应任务。保留历史1词策略快照的执行能力；旧版1词偏好在新安排中按2词读取，不立即改写原始存储。困难后的临时减量仍可为1词。2–6是产品可选范围，不是研究确定的最佳剂量。

## 本次闭环修复

- 一起学独立保留自动听辨掌握的已选词；家长主动移除词条或手动标记掌握仍按原操作生效。听辨自动标记不再中断口语任务。
- 内容身份由规范词ID和经过标点/空白规范化的中文词义、词性共同确定。实质文字变动保守地当作新义项；不能自动判断所有错别字是否改变语义。新义项重新教学，旧 entry 归档在 archivedEntries，观察记录继续保留。例句修改不自动抹掉已知词义。
- 没有词义签名的旧记录，只有当前意思与宿主给出的规范 baseline 一致时继承。独立宿主应提供 getRevisions 与 baseline，内置 Course 已接入词库基线。
- 策略v2默认最多3次回想，达到目标立即停止；允许一次提示后再有两次独立机会。v1完整快照继续保持原次数和日期安排，历史默认不可修改。
- v2复习间隔按实际经过的天数计算；已有成功记录的词还需距离上次计入证据/示范至少完整24小时才能增加跨日证据。这是产品证据边界，不是研究证明的最佳时间阈值。早期成功记为实际表现，不弹倒计时；未知旧证据时间使用旧 seenAt 保守处理。
- 存储v5兼容读取v1–v4，保留旧记录；新增词义签名、归档、lastCreditAt，以及观察中的词义版本与实际示范/计分间隔。小游戏点击依旧不等同于已验证的离屏活动时间，系统不据此单独声称长期掌握。
- 本轮不移除历史低层函数接口、不引入额外框架，也不改变生成报告保存方式；重点整理 answerRecall 的表现记录、证据判定、后续安排三个阶段。
