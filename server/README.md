# abc-garden 服务端模块

`index.js` 是本科服务端入口，导出科目 ID 与存档校验器。学习规则与数据契约在 `../domain/`。本目录不启动 HTTP 服务，不拥有账号、短信、数据库连接或备份逻辑。

平台的 `scripts/prepare-subjects.mjs` 调用本科 `npm run build:domain` 后组装模块；最终一个 Node 服务运行三科。改本科规则在本仓修改，改登录/通用存档在 `../garden-platform` 修改。`npm run dev` 从本仓构建本站并启动统一开发服务。
