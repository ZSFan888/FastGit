# Cloudflare Workers 详细部署教程

本文用于把 FastGit 部署到 Cloudflare Workers。所有说明均为中文，Cloudflare Dashboard 中实际显示为英文的菜单和按钮保留原名，便于逐项查找。

> 界面核对日期：2026 年 8 月 10 日。

Cloudflare 会分批更新 Dashboard，不同账号可能短时间内看到两种创建入口。本文分别写明当前主界面和仍在灰度中的界面，不需要寻找旧版入口。

## 一、部署前准备

开始前需要准备：

- 一个可以正常登录的 Cloudflare 账号
- 本仓库中的完整 [worker.js](worker.js)
- 一个未被占用的 Worker 名称，例如 `fastgit`
- 如需自定义域名，该域名必须已经添加到同一个 Cloudflare 账号并处于可用状态

FastGit 是 Worker 脚本，不是 Cloudflare Pages 项目。创建时不要选择 **Pages**、**Import a repository** 或静态站点上传。

## 二、部署前修改配置

打开 [worker.js](worker.js)，文件开头有需要关注的配置。

### 1. 提交版本来源

```js
const SOURCE_REPOSITORY = "ZhangShengFan/FastGit";
```

`/healthy` 页面会读取该仓库 `main` 分支最新提交的 7 位短 SHA，并显示为“提交版本”。

直接部署本项目时不需要修改。派生或重新发布到其他仓库时，应改成自己的 `GitHub用户名/仓库名`，例如：

```js
const SOURCE_REPOSITORY = "your-name/FastGit";
```

### 2. 网页登录开关

```js
const ALLOW_LOGIN = false;
```

默认关闭网页登录，公开实例建议保持 `false`。只有实例完全由自己控制并且只供自己使用时，才考虑改为 `true`。

启用后，GitHub 密码、验证码、Cookie 和登录会话会经过你的 Worker。Cloudflare 会终止 TLS，因此这不是浏览器到 GitHub 的端到端直连。部分登录、设备验证和风控流程仍可能跳回 GitHub 官方域名。

## 三、创建 Worker

### 当前主界面

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) 并登录。
2. 如果账号下有多个账户，先选择准备部署 Worker 的账户。
3. 在左侧导航中进入 **Workers & Pages**。
4. 在 **Overview** 页面点击 **Create application**。
5. 点击 **Create Worker**。
6. 如果页面提供名称输入框，填写 `fastgit` 或其他名称。名称会用于生成 `workers.dev` 地址，不能与同一账户内已有 Worker 重复。
7. 点击 **Deploy**，先部署 Cloudflare 自动生成的示例 Worker。

### 灰度界面

如果第 5 步没有看到 **Create Worker**，但页面中有 **Start with Hello World!**：

1. 点击 **Start with Hello World!** 下方的 **Get started**。
2. 输入 Worker 名称。
3. 点击 **Deploy**。

如果 **Workers & Pages** 首页直接显示 **Create Worker**，可以直接点击，不必再寻找 **Create application**。

首次部署示例代码是正常步骤。FastGit 代码会在下一步完整替换示例代码。

## 四、替换为 FastGit 代码

1. 回到 **Workers & Pages**。
2. 在 **Overview** 中点击刚创建的 Worker。
3. 在 Worker 页面右上角点击 **Edit code**。部分界面会同时显示 `</>` 图标。
4. 进入在线编辑器后，打开当前入口文件。它通常名为 `worker.js`、`index.js` 或 `src/index.js`。
5. 在代码编辑区按 `Ctrl+A` 全选，然后删除全部示例代码。
6. 将本仓库 [worker.js](worker.js) 的全部内容粘贴到编辑器。
7. 确认第一行是 FastGit 的 JavaScript 代码，不要把 Markdown 的三个反引号一起粘贴进去。
8. 点击编辑器右上角的 **Deploy**。
9. 等待页面提示部署完成。

**Deploy** 旁边的下拉菜单可能包含 **Save**。只点击 **Save** 会创建版本但不一定把它切换为当前线上版本，正常更新 FastGit 时应点击 **Deploy**。

## 五、检查 workers.dev 地址

部署完成后，Worker 页面会显示一个类似下面的地址：

```text
https://fastgit.你的-workers-子域.workers.dev
```

依次检查：

```text
https://fastgit.你的-workers-子域.workers.dev/
https://fastgit.你的-workers-子域.workers.dev/healthy
```

预期结果：

- 根路径显示 GitHub 页面，而不是 Hello World
- `/healthy` 显示 `OK`
- `/healthy` 的 HTTP 状态码为 `200`
- 页面中的“提交版本”显示 7 位 Git 提交 SHA

如果根路径仍显示 Hello World，说明 FastGit 代码没有成功部署。重新进入 **Edit code**，确认代码已完整替换，然后再次点击 **Deploy**。

部分网络环境无法稳定访问 `workers.dev`。这不一定表示 Worker 部署失败，可以继续绑定自定义域名后再测试。

## 六、绑定自定义域名

推荐使用 Worker 自带的 **Custom Domain**，不需要手动创建 CNAME，也不要通过多层 CNAME 或第三方中转连接 Worker。

### 前提条件

- 根域名已经添加到当前 Cloudflare 账号
- 域名状态正常
- 准备使用的主机名没有被现有网站占用，例如 `git.example.com`
- 该主机名不能存在冲突的 CNAME 记录

### 操作步骤

1. 进入 **Workers & Pages**。
2. 在 **Overview** 中选择 FastGit Worker。
3. 点击 **Settings**。
4. 找到 **Domains & Routes**。
5. 点击 **Add** 或 **+ Add**。
6. 选择 **Custom Domain**。
7. 输入完整域名，例如 `git.example.com`，不要填写 `https://`，不要在末尾添加 `/`。
8. 点击 **Add Custom Domain**。
9. 等待 Cloudflare 自动创建 DNS 记录并签发证书。

绑定后直接访问：

```text
https://git.example.com/
https://git.example.com/healthy
```

Custom Domain 会把这个主机名的所有路径交给 Worker。Cloudflare 会自动管理对应 DNS 记录和证书，不需要再去 DNS 页面添加指向 `workers.dev` 的 CNAME。

### 提示主机名已存在

如果添加时提示域名或 DNS 记录冲突：

1. 确认该子域名没有承载其他网站或服务。
2. 在域名的 **DNS** > **Records** 中检查同名的 A、AAAA 或 CNAME 记录。
3. 如果记录确实无用，删除冲突记录后重新添加 **Custom Domain**。
4. 如果记录仍在使用，换一个未占用的子域名，不要直接删除正在使用的记录。

## 七、部署后完整检查

假设镜像域名是：

```text
https://git.example.com
```

### 1. 首页和仓库页面

打开：

```text
https://git.example.com
https://git.example.com/cloudflare/workers-sdk
```

应能看到 GitHub 官方页面结构，页面内链接继续使用镜像域名。

### 2. 静态资源

按 `F12` 打开浏览器开发者工具，在 **网络** 面板刷新页面。GitHub 外部资源应改写为类似：

```text
https://git.example.com/_proxy/github.githubassets.com/assets/...
```

资源请求应返回 `200`，页面不应只有文字或缺少样式。

### 3. 原始文件

在公开仓库中打开一个文件并点击 **Raw**。地址应通过镜像访问，文件内容应正常显示或下载。

### 4. 源码压缩包和发布附件

在公开仓库中测试：

- **Code** > **Download ZIP**
- Releases 页面中的公开附件

下载不应停留在无法访问的 `codeload.github.com` 或其他 GitHub 下载域名，浏览器地址应由 FastGit 代理处理。

### 5. Git Clone 和 Fetch

克隆公开仓库：

```powershell
git clone https://git.example.com/owner/repository.git
```

测试已有仓库：

```powershell
git remote set-url origin https://git.example.com/owner/repository.git
git fetch origin
```

公开仓库的 Clone 和 Fetch 不需要开启网页登录。Push 需要 GitHub 身份验证，并可能受到 GitHub 登录、令牌策略和风控流程影响，不建议把公开镜像当作可靠的写入通道。

### 6. 健康页面

打开：

```text
https://git.example.com/healthy
```

正常时应显示：

- 状态：`OK`
- GitHub 上游：正常
- 提交版本：7 位短 SHA
- HTTP 状态码：`200`

异常时会显示“暂不可用”，HTTP 状态码为 `503`。

## 八、更新 Worker

以后更新 FastGit 不需要重新创建 Worker 或重新绑定域名：

1. 获取仓库中最新的 `worker.js`。
2. 进入 **Workers & Pages** > 你的 Worker。
3. 点击 **Edit code**。
4. 完整替换入口文件内容。
5. 点击 **Deploy**。
6. 访问 `/healthy` 和一个公开仓库页面确认结果。

不要只粘贴新增片段，也不要把新代码追加到旧代码末尾。完整替换可以避免重复常量、重复事件处理器和旧路由残留导致 Error 1101。

## 九、常见问题

### Error 1101

Error 1101 表示 Worker 执行时抛出异常。常见原因：

- 代码没有完整复制
- 新代码被追加到旧代码后面
- 粘贴时带入 Markdown 反引号
- 部署后仍在访问旧版本
- 自行修改代码后出现语法或运行错误

处理方法：重新打开 `worker.js`，全选并复制完整内容，在 **Edit code** 中完整替换，然后点击 **Deploy**。

### 首页能打开但没有样式

打开开发者工具的 **网络** 面板，检查失败资源。正常的代理资源路径应以 `/_proxy/` 开头。若线上仍出现旧的 `/_gh/` 路径，说明 Cloudflare 上部署的还是旧版本代码。

### 自定义域名无法添加

确认根域名与 Worker 位于同一个 Cloudflare 账号，并检查同名 A、AAAA 或 CNAME 记录。Custom Domain 不支持直接占用已有 CNAME 的主机名。

### 证书尚未生效

刚添加 Custom Domain 时，DNS 和证书可能需要一些时间完成。先在 **Settings** > **Domains & Routes** 中确认状态，再刷新访问。不要反复删除并重建域名。

### 返回 403 或 429

GitHub 对接口和下载请求有频率限制。公共镜像可能共享 Cloudflare 出口地址的限额。等待限额恢复，减少自动刷新和批量请求。

### 浏览器可用但 Git 提示 TLS 或 SSL 错误

确认镜像域名通过 Worker 的 **Custom Domain** 直接绑定。移除多层 CNAME、第三方中转和错误的回源配置后再测试。

### 登录后跳回 github.com

GitHub 的通行密钥、验证码、设备验证和部分风控流程依赖官方域名。FastGit 无法保证所有登录步骤都留在镜像域名内，这是代理登录的固有限制。

## 十、安全和使用限制

- 公开部署时保持 `ALLOW_LOGIN = false`
- 不要记录密码、Cookie、Authorization 请求头、令牌或请求正文
- 不要缓存 API 响应、私有页面、登录响应或下载文件
- 不要在自己无法控制的 Worker 上输入 GitHub 凭据
- 公开实例可能被滥用，并消耗 Cloudflare Worker 请求额度和 GitHub 接口限额
- 使用前请确认符合当地法律法规以及 GitHub、Cloudflare 的服务条款

完成以上步骤后，FastGit 的创建、代码部署、自定义域名和基础功能检查即全部完成。
