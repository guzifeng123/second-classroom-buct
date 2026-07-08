$ErrorActionPreference = "Stop"

$appDir = Join-Path $PSScriptRoot "erkexitong"

if (-not (Test-Path -LiteralPath (Join-Path $appDir "package.json"))) {
  Write-Host "找不到 package.json: $appDir\package.json" -ForegroundColor Red
  Read-Host "按回车退出"
  exit 1
}

Set-Location -LiteralPath $appDir

Write-Host ""
Write-Host "二课系统 H5 启动器" -ForegroundColor Cyan
Write-Host "项目目录: $appDir"
Write-Host "访问地址: http://localhost:10086"
Write-Host ""

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "找不到 npm.cmd，请确认 Node.js 已安装并加入 PATH。" -ForegroundColor Red
  Read-Host "按回车退出"
  exit 1
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "未找到 node_modules，正在安装依赖..." -ForegroundColor Yellow
  npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "依赖安装失败，请检查上面的报错。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit $LASTEXITCODE
  }
}

Write-Host "正在启动，请保持此窗口不要关闭..." -ForegroundColor Green
Write-Host ""

npm.cmd run dev:h5

$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "启动命令已退出，退出码: $exitCode" -ForegroundColor Yellow
Read-Host "按回车退出"
exit $exitCode
