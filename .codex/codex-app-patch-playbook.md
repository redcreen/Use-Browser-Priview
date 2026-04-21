# Codex App Patch Playbook

## 目的

这份文档是给后续 Codex 自己看的，不是给最终用户看的。

目标只有一个：

- 当 `Codex.app` 更新后，能快速重新把 `Use Browser Priview` 注入到 Codex 内部文件链接右键菜单的 `Open With` 中
- 不要再从头重新学习
- 不要再走会把 `Codex.app` 弄坏的旧路径

当前这条能力的代码入口是：

- [adapters/codex-app/patch-codex-open-with.js](../adapters/codex-app/patch-codex-open-with.js)
- [adapters/codex-app/install-codex-app.sh](../adapters/codex-app/install-codex-app.sh)
- [adapters/codex-app/uninstall-codex-app.sh](../adapters/codex-app/uninstall-codex-app.sh)

## 当前正确做法

### 结论

**只能走 staged app bundle swap。**

不要再原地改写：

- `/Applications/Codex.app/Contents/Resources/app.asar`

正确流程是：

1. 从当前 clean `Codex.app` 克隆一个 staged app bundle
2. 只在 staged bundle 里 patch `app.asar`
3. 同步更新 `Contents/Info.plist` 里的 `ElectronAsarIntegrity`
4. 对 staged app 重新签名并验证
5. 通过整包原子替换把 staged app 换到 `/Applications/Codex.app`
6. 保留 clean backup app bundle，供 uninstall 回滚

### 当前 clean backup 路径

- `/Applications/Codex.use-browser-priview-backup.app`

### 当前 patch 运行时路径

- `~/Library/Application Support/Use Browser Priview/codex-app`

## 为什么以前会坏

之前已经踩过两类坑：

1. patch 锚点匹配到了错误的数组
结果是把注入代码插到无关 bundle 位置，启动直接崩。

2. 只重打了 `app.asar`，没有同步更新 `Info.plist` 的 `ElectronAsarIntegrity`
结果是 Electron 启动时命中：
`Integrity check failed for asar archive`

3. 直接在 `Resources/` 里原地覆盖或替换 `app.asar`
结果很容易把 app bundle 写坏，最糟糕时会出现 `app.asar` 缺失，Codex 完全打不开。

**以后不要再试图走原地 patch。**

## 下次 Codex 更新后怎么做

### 标准入口

先跑：

```bash
bash install.sh --codex-app
```

装完后检查：

```bash
node adapters/codex-app/patch-codex-open-with.js status
```

如果 `patched: true`，让用户：

1. 强制退出 Codex
2. 重新打开 Codex
3. 在文件链接上右键
4. 看 `Open With` 里是否出现 `Use Browser Priview`

### 如果更新后 patch 失效

先不要重学，按这个顺序查：

1. 当前 `Codex.app` 是否还能正常启动
2. 当前 bundle 里 `open-in-targets` 的注册表形态是否还在
3. `patchMainBundleSource()` 的 regex 是否还命中正确的 open-target 数组
4. `ElectronAsarIntegrity` 是否还在 `Contents/Info.plist`
5. Electron 是否还要求 header hash，而不是别的完整性字段

## 当前锚点

当前版本的正确锚点不是“任意数组 + `open-in-targets`”，而是：

- `var <targetsVar>=[...],<loggerVar>=e.<factory>(\`open-in-targets\`);`
- 后面紧跟
- `function <flattenFn>(e){return <targetsVar>.flatMap(...)}`

`patchMainBundleSource()` 当前就是靠这组结构锁定 open-target 注册表，避免再次误打到无关数组。

如果 Codex 更新后变量名变了，没关系。

如果下面这两个结构还在：

- `open-in-targets`
- `targetsVar.flatMap(t=>{let n=t.platforms[e];return n?[{id:t.id,...n}]:[]})`

那就应该优先微调 regex，而不是推翻整套方案。

## 当前注入内容

当前注入的是一个新的 open target：

- id: `useBrowserPriview`
- label: `Use Browser Priview`

darwin 平台行为：

- `detect()` 检查 runtime wrapper 是否存在
- `open()` 通过 `/bin/bash <runtime-script> <target-path>` 启动

运行时 wrapper：

- [adapters/codex-app/open-codex-preview.sh](../adapters/codex-app/open-codex-preview.sh)

它最终复用：

- [adapters/vscode/open-finder-preview.js](../adapters/vscode/open-finder-preview.js)

也就是说，Codex app patch 只是增加菜单入口，实际 preview runtime 仍然复用现有共享行为。

## Asar Integrity 规则

这是最关键的点。

`Contents/Info.plist` 里的：

- `ElectronAsarIntegrity.Resources/app.asar.hash`

**不是整个 `app.asar` 文件的 sha256。**

它是：

1. 读取 ASAR 的 raw header
2. 取出 `headerString`
3. 对 `headerString` 做 `sha256`

这套规则来自 Electron 官方做法，对应文档和 `@electron/asar` 的 `getRawHeader()` 行为。

当前脚本里已经内置了最小实现：

- `readAsarHeaderString()`
- `updateAsarIntegrity()`

下次如果又看到：

- `Integrity check failed for asar archive`

先查这里，不要先怀疑 JS patch 本身。

## 安装与回滚

### 安装

外部入口：

```bash
bash install.sh --codex-app
```

内部核心动作：

1. 安装 runtime 到 `~/Library/Application Support/Use Browser Priview/codex-app`
2. 如果当前 app 是 clean 版本，先把它移动成 clean backup app
3. 以 clean app 为 source 克隆 staged app
4. patch staged app 的 `app.asar`
5. 更新 staged app 的 `ElectronAsarIntegrity`
6. `codesign --force --deep --sign - <staged-app>`
7. `codesign --verify --deep --strict <staged-app>`
8. 原子替换 `/Applications/Codex.app`

### 回滚

```bash
bash adapters/codex-app/uninstall-codex-app.sh
```

回滚逻辑：

1. 当前 patched app 暂时挪开
2. clean backup app 换回 `/Applications/Codex.app`
3. 删除 patch state

如果用户只说“Codex 打不开了”，第一动作不是继续 patch，而是先回滚。

## 真实调试顺序

如果下次 Codex 更新后又需要重新适配，按这个顺序做：

1. 确认当前 `/Applications/Codex.app` 是 clean 且可启动
2. 提取 `app.asar`
3. 找到 `main-*.js`
4. 用本地脚本验证 `patchMainBundleSource()` 是否命中正确位置
5. 在临时 clone 的 `Codex.app` 上离线安装 patch
6. 启动临时 clone，看它是否能活过启动期
7. 只有离线 clone 通过后，才 patch `/Applications/Codex.app`

### 离线 clone 启动验证很重要

之前就是靠这个方法定位出：

- 不是 JS 语法问题
- 真正的崩溃原因是 `ElectronAsarIntegrity` header hash 不匹配

所以：

**先在临时 clone 上验证，再碰 `/Applications/Codex.app`。**

## 最常用的排查命令

### 看当前状态

```bash
node adapters/codex-app/patch-codex-open-with.js status
```

### 重新安装 patch

```bash
bash install.sh --codex-app
```

### 回滚

```bash
bash adapters/codex-app/uninstall-codex-app.sh
```

### 看 `Info.plist` 里的 integrity

```bash
plutil -p /Applications/Codex.app/Contents/Info.plist
```

### 提取当前 `app.asar` 看主 bundle

```bash
tmp=$(mktemp -d /tmp/codex-asan-XXXXXX)
npx --yes @electron/asar extract /Applications/Codex.app/Contents/Resources/app.asar "$tmp"
find "$tmp/.vite/build" -name 'main-*.js'
```

### 查当前 bundle 是否已经带 patch marker

```bash
rg -n "use-browser-priview-codex-open-target-v1|useBrowserPriview" "$tmp/.vite/build/main-*.js"
```

## 修改代码时优先改哪里

### 第一优先级

- [adapters/codex-app/patch-codex-open-with.js](../adapters/codex-app/patch-codex-open-with.js)

这一个文件决定：

- patch 锚点
- staged install
- integrity 更新
- atomic swap
- rollback
- status 检查

### 第二优先级

- [tests/validate-codex-app-patch.mjs](../tests/validate-codex-app-patch.mjs)

如果 patch 逻辑变了，测试夹具必须同步跟上。

### 第三优先级

- [README.md](../README.md)
- [README.zh-CN.md](../README.zh-CN.md)
- [docs/test-plan.md](../docs/test-plan.md)
- [docs/test-plan.zh-CN.md](../docs/test-plan.zh-CN.md)

这些文档只需要反映“用户怎么装、怎么卸载、门禁怎么验证”，不要把低层 bundle 细节塞进去。

## 什么时候需要重新学习

只有下面这些情况，才值得从头重新研究：

1. `open-in-targets` 这一套入口在 Codex 里彻底没了
2. Electron 不再使用 `ElectronAsarIntegrity`
3. Codex 改成多段 bundle 或运行时加载方式，导致当前主 bundle 不再包含目标注册表
4. Codex 官方开放了稳定插件扩展点，可以替代宿主 patch

只要还没发生这些变化，就不要重新发明方案，先从这份 playbook 和 `patch-codex-open-with.js` 继续。

## 当前结论

截至当前仓库状态，Codex app patch 的正确方法是：

- patch open-target 注册表
- 更新 `ElectronAsarIntegrity` header hash
- staged clone 验证
- clean backup + atomic swap
- rollback 走 clean backup

以后再做这件事，先看这份文档，再看实现，不要从零开始。
