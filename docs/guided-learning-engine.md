# 一起学：策略配置与学习引擎

面向学前儿童的看图命名、熟悉情境用词路径。家长记录理解和表达表现，引擎安排下一步。程序模拟证明机制按定义执行，不等于证明某套参数是儿童学习的唯一最优值。

## 职责与调用链

词库 / 正在学 / 已掌握 → Course提供候选词与入口 → GuidedWords组合预设和家长偏好 → 同一个引擎执行具体策略 → 保存事实与任务。

- course.js：决定候选单词、逐词玩法、声音资源和返回列表，不决定学习步骤。
- guided-learning-policy.js：预设、具体策略、参数校验和历史策略读取。
- guided-words-core.js：纯状态转换；按策略和历史表现选词、安排教学、回想与复习。不导入词库，不读取浏览器存储。
- guided-progress.js：存储v8；旧记录迁移、策略校验、原子保存和多页面冲突保护。
- guided-words.js：播放、保存、入口切换、焦点和休息计时等浏览器协调。
- guided-words-view.js：渲染引擎投影；路径说明取自实际策略，不根据入口名称猜测流程。
- guided-activities.js / guided-learning-games.js：逐词内容和穿插游戏。

mode: learn / review只标识任务槽和界面名称。两侧共享单词记忆事实，各自保存进行中的队列；不是看到review就执行另一套教学算法。

## 预设与具体策略

GUIDED_PRESETS是局部配置集合。createGuidedPolicy(overrides, {preset})按“统一默认值 → 预设 → 显式覆盖”合成不可变的完整策略。预设名不写进教学算法，也不限制配置组合。

| 路径配置 | 一起学预设 | 复习预设 | 可选值 |
|---|---|---|---|
| selection.eligibility | all | all | all：全部候选；due-only：仅到期词 |
| selection.priority | due-first | due-first | due-first：到期优先；listed：候选列表顺序 |
| teaching.unfamiliarStart | teach | recall | 对尚无理解记录的词，先教学或先无提示回想 |

两个预设的数值配置相同。家长偏好覆盖后仍分别保留各自的入口策略。

| 数值配置 | 默认 | 范围 | 作用 |
|---|---:|---|---|
| session.maxWords | 10 | 1–10 | 一次安排的词数上限 |
| session.breakAfterMinutes | 15 | 5–30 | 休息提醒 |
| teaching.newWordsPerGroup | 2 | 1–6 | 小组词数上限，遇到困难可临时减为1 |
| teaching.maxMeaningAttempts | 2 | 1–3 | 听懂反应的尝试上限 |
| retrieval.newWordSuccesses | 2 | 2–3 | 尚未建立口语证据时需要的独立回想次数 |
| retrieval.maxAttempts | 3 | 2–4 | 单词口语尝试上限 |
| retrieval.minInterveningActivities | 1 | 1–3 | 同词回想至少穿插的活动数 |
| retrieval.preferredAfterSuccess | 2 | 1–5 | 成功后优先穿插的活动数 |
| review.retryAfterMinutes | 10 | 1–60 | 需要帮助后再次安排的基础间隔 |
| review.intervalsDays | [1,3,7] | 三个递增的1–365整数 | 不同记忆阶段的复习间隔 |

先按eligibility过滤，再按priority排序，最后截取maxWords。due-first按到期时间安排到期词，再安排无记录词和其他词；listed保留宿主提供的顺序。没有到期词时，due-only不会自行补入未到期词。

guidedInitialTask()统一决定起点：明确“重新学这组”优先教学；已有理解证据的词进入回想；没有理解证据的词使用unfamiliarStart。重新学是家长的显式操作，会忽略due-only范围限制，在提供的候选范围内重新安排。

## 如何传参

产品入口由getGuidedPolicy(mode)提供配置。它可以返回局部覆盖，也可以返回完整策略；局部覆盖由协调层叠加对应预设。GuidedLearningSettings.policy(mode)把两项家长偏好叠加到预设上，返回完整策略。

家长界面仍只开放每组新词上限2–6和休息提醒10/15/20分钟。其余是开发接口，不新增儿童学习时的开关。

    import {createGuidedPolicy} from '../app/guided-learning-policy.js';
    import {createGuidedLearning} from '../app/guided-words-core.js';
    import {freshGuided} from '../app/guided-progress.js';

    const learnPolicy = createGuidedPolicy({}, {preset: 'learn'});
    const reviewPolicy = createGuidedPolicy({}, {preset: 'review'});

    // 未来若需要“只复习到期词”：组合已有配置，不新增引擎分支。
    const duePolicy = createGuidedPolicy({
      selection: {eligibility: 'due-only'},
      session: {maxWords: 6},
    }, {preset: 'review'});

    const engine = createGuidedLearning({
      policy: duePolicy,
      now: () => clock.now(),
      random: seededRandom,
      gameIds: ['mirror', 'drawing', 'rhythm'],
    });
    let state = freshGuided();
    state = engine.transition(state, {type: 'mode', mode: 'review'}); // 只选择进度槽
    state = engine.transition(state, {type: 'start', ids: wordIds, pictureIds, contentVersion});
    const view = engine.describe(state, wordIds);

transition()不修改输入；无效或无变化事件返回原对象。当前任务使用session.policySnapshot，新安排使用最新策略。describe()区分当前policy与下次安排的planningPolicy。仅在示范播放成功后发送model事件，播放失败不前进。

不需要为了两个入口刻意设置不同的次数或复习间隔。只有实际需求和观察结果支持时才覆盖参数。

## 不可关闭的证据规则

- 播放答案、口型或开头音等提示后，不得计为无提示说出。
- 同一天反复练习不重复累计跨日成功；新策略还核对距离上次有效证据与示范的实际间隔。
- 已有跨日口语证据的词，独立成功可完成一次复习；没有该证据的词仍满足newWordSuccesses。既有听音“已掌握”不自动变成口语证据。
- 失败后补示范 / 教学并穿插回想；尝试次数是上限，不要求一直考到上限。
- 小游戏、跳过和播放示范不算口语成功，不根据游戏点击声称长期掌握。
- 图片听辨最多四个已引入且适合辨认的选项，不把抽象图标硬当图片题。
- 不放宽这些规则来提高“掌握率”。它们不是可配置的产品开关。

活动计数提供自然间隔，不引入短倒计时等待；其本身不证明离屏活动实际持续了多久。

## 内容、进度与兼容

“一起学”使用完整的正在学范围；自动听音掌握的已选词仍可练口语，家长手动标记掌握的词不在该范围。“复习一下”使用全部已掌握词。当前搜索和分类不改变上述来源。

entries保存事实，observations最多保存200条实际回答和当时完整策略，trace最多保存64条任务决策。更改参数不会补记历史成功。词义改变会归档旧证据，并使两侧相关任务失效；标点空白变化不重置。

两侧任务通过mode事件原子交换scope/session。退出、刷新、休息不会重建任务；切换期间听过同词示范，恢复时更新活动间隔，由现有调度器穿插其他词或小游戏；不把后续新回想题永久标为有提示。原题实际用过的提示保持不变。共享理解记录变为未理解时，在旧回想前补教学和理解检查；已经达到理解尝试上限则结束该词本轮任务，不重置次数。存储失败不前进，多页面冲突重新读取，未知版本保留原始数据并停止写入。

存储v8统一只保存policySnapshot作为执行策略：

- v1–v5：兼容已有学习事实与历史队列。
- v6：把reviewOnly转换为teaching.unfamiliarStart。
- v7：验证旧modeSnapshot，再把initialTask转换为具体策略。
- 迁移保留队列、提示、活动间隔和数值快照，不重排进行中的任务。
- 历史策略v1保留原日历日语义，v2保留实际经过时间语义；旧快照缺失的路径字段按历史行为补齐，缺失数值或未知字段不静默补默认值。
- 新策略v3要求完整具体配置。未知预设、选词规则、枚举或矛盾数值在构造 / 读取阶段拒绝。

## 验证入口

- tests/guided-learning-policy.test.mjs：预设组合、覆盖优先级、未知字段、严格快照读取。
- tests/guided-learning-engine.test.mjs：配置驱动而非模式驱动、到期筛选与顺序、历史快照、两侧迁移、失败分支、提示保护与默认路径。
- tests/guided-learning-settings.test.mjs：同一份家长偏好叠加两套预设，不改证据规则。
- tests/browser/guided-words.spec.js：选词入口、复习起点、刷新续学、切换保存、手机 / 平板布局。
- tests/fixtures/guided-default-path.json：历史默认路径与记忆证据基线。

改具体规则先看policy文件；排查“为什么下一步是这个”看session的policySnapshot和trace。不要从页面按钮文案反推执行策略。
