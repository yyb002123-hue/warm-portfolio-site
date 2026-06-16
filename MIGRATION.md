# 项目迁移说明

这个压缩包用于把“影像校友会”网站迁移到另一台电脑，并继续用 Codex 开发。

## 1. 解压项目

把压缩包解压到新电脑的任意目录，例如：

```text
D:\Documents\New project website
```

建议路径里不要有太多特殊字符。

## 2. 安装需要的软件

新电脑需要：

- Node.js LTS
- Git
- Codex 桌面应用

安装完成后，打开 PowerShell，进入项目目录：

```powershell
cd "D:\Documents\New project website"
```

## 3. 本地运行网站

运行：

```powershell
npm start
```

然后打开：

```text
http://localhost:3000/
```

后台页面：

```text
http://localhost:3000/admin.html
```

如果 `npm start` 不可用，也可以运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Site.ps1
```

## 4. 用 Codex 继续开发

在 Codex 里打开这个项目文件夹：

```text
D:\Documents\New project website
```

然后可以直接对 Codex 说：

```text
继续开发这个网站项目，先阅读 README.md 和 MIGRATION.md，帮我理解当前结构。
```

如果要继续改页面样式，可以说：

```text
只改本地，不上传线上，帮我调整手机端样式。
```

如果要更新线上网站，需要明确告诉 Codex：

```text
现在可以上传线上，请同步数据并推送到 gh-pages。
```

## 5. 内容和发布说明

本地后台主要修改：

```text
data/site-data.json
```

上线静态版读取：

```text
public/data/site-data.json
```

准备上线前运行：

```powershell
npm run sync:data
```

之后再提交并推送。

## 6. 重要提醒

- 当前要求是“收到明确指令前不上传线上”，所以迁移后也建议先只本地修改。
- `_site-gh-pages/` 是发布分支的临时目录，不是日常开发主目录。
- 日常开发主要看 `public/`、`data/`、`server.js`、`Start-Site.ps1`。
