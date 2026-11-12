# 家长账号与云存档服务

Node.js 22+，Fastify 与 SQLite。前端通过同源 `/api/` 访问服务。数据库与密钥在发布目录外保存。

## 本地运行

在项目根目录执行 `npm ci` 与 `npm ci --prefix server`，然后 `npm run dev` 同时启动网页和账号服务。前端默认 4173，API 默认仅监听 127.0.0.1:4174。开发密钥自动保存在 Git 忽略的 `.runtime/`，真实短信需要另行配置。

将 `config.env.example` 中的字段写入本机 `server/.env.local`，以 `GARDEN_ENV_FILE=/absolute/path/to/server/.env.local npm run dev` 启动。文件权限设为 600。填写 PNVS 实际签名、模板、发送权限凭证和单条价格。每日发送预算固定为 100 分，未知投递结果保守占用预算，自动重发关闭。普通页面没有模拟验证码入口。

## 接口与职责

| 入口 | 职责 |
| --- | --- |
| `app.mjs` | HTTP 边界、请求大小、来源检查、限流与错误脱敏 |
| `accounts.mjs` | 注册、两种登录、会话、短信重设密码及当前设备退出 |
| `sms.mjs` | PNVS 发送、验证码用途与有效期、预算事务 |
| `security.mjs` | 密码 scrypt 哈希、随机会话令牌、输入校验 |
| `database.mjs` | SQLite 模式版本、约束与限流记录 |
| `archives.mjs` | 档案归属、revision 条件更新、最新进度与最多三份独立手动存档 |
| `deletions.mjs` | 删除台账先持久化，启动时与数据库核对 |
| `backup.mjs` | SQLite 一致性快照、AES-GCM 加密及恢复校验 |

页面使用用户名，不提供昵称和头像编辑。手机号和用户名均唯一，用户名为 3–24 位并区分英文大小写，密码为 8–128 位且允许纯数字。密码登录可输入用户名或手机号，短信登录独立验证手机号。注册时必须验证手机号并同意家长云存档说明；注册与重设密码都需要在前端再次输入密码，确认值不上传。密码重设撤销旧会话。不提供换绑手机号、退出所有设备、注销、个人数据下载接口。

会话使用 HttpOnly Cookie，生产启用 Secure，180 天不活跃过期，活跃访问续期，365 天达到绝对期限。服务器保存令牌哈希，可撤销单个或全部会话。号码回收后新持有人可通过短信登录，用户已接受该风险。

## 部署与备份

`npm run package:server -- /new/private/release-directory` 生成白名单服务端包，包含独立依赖锁、共享存档契约及源码版本/哈希。目标机器在包的 server 目录执行 `npm ci --omit=dev`。前端继续使用现有静态发布入口。

同级托管仓 `account-service/` 提供 Nginx 和 systemd 配置模板。正式环境需要管理员安装 Node.js 22+，准备独立 garden-api 用户、程序版本目录、持久数据目录及受保护环境文件。服务安装、切流和回退尚需在目标服务器演练，模板本身不代表已上线。程序版本回退前核对数据库 user_version，数据库不会随程序包覆盖。

备份密钥由 `GARDEN_BACKUP_KEY` 提供，独立保存。运行命令如下。

```sh
node server/backup-cli.mjs backup /private/garden.sqlite /private/new-backup.enc
node server/backup-cli.mjs restore /private/backup.enc /private/new-restored.sqlite /private/latest-deletions.jsonl
```

恢复要求新目标路径和最新删除台账，撤销备份中的所有旧会话及验证码。删除台账必须独立保存并及时复制到异机位置，旧备份自身的删除记录不足以识别后续注销。异机目标、定时执行、台账复制与告警渠道尚待落实和演练。

## 验证

`npm run test:server` 验证注册、双登录、会话、验证码预算、越权、版本冲突与备份恢复。`npm run test:account` 使用独立的内存数据库及注入短信提供者，验证手机、iPad、桌面的 Chromium/WebKit 页面流程。真实短信已在本机预览完成注册及首次保存；真实 iPad 和正式部署仍需另行验证。

## 自动同步与手动存档

`PUT /api/profiles/:profileId/abc` 通过 revision 条件写入一份最新进度。显式点击“存档”才附带 `checkpoint: true`，在同一事务中另存至 `archive_checkpoints`，仅保留最近三份。自动同步不写此表；同一 revision 的重复请求不重复创建存档。历史接口只返回手动存档，恢复历史仍走正常条件更新。

新数据库直接创建当前 v3 结构，已有 v3 直接打开；其他版本明确拒绝，不提供历史升级或降级路径，不修改原表中的数据。备份与恢复继续保留。

旧站迁移及历史格式兼容代码已删除，没有迁移打包命令。
