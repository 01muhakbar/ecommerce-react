param(
  [string]$BaseClient = "http://localhost:5173",
  [string]$BaseApi = "http://localhost:3001/api",
  [int]$BootTimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Set-Result([string]$Key, [bool]$Pass, [string]$Details) {
  $script:Results[$Key] = [ordered]@{
    pass = $Pass
    details = $Details
  }
}

function Coalesce {
  param([object[]]$Values)
  foreach ($v in $Values) {
    if ($null -ne $v -and [string]::IsNullOrWhiteSpace([string]$v) -eq $false) {
      return $v
    }
  }
  return $null
}

function Wait-ForStack([string]$ClientUrl, [string]$ApiUrl, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $clientOk = $false
    $apiOk = $false
    try {
      $res = Invoke-WebRequest -Uri $ClientUrl -UseBasicParsing -TimeoutSec 3
      $clientOk = ($res.StatusCode -eq 200)
    } catch {}
    try {
      $null = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get -TimeoutSec 3
      $apiOk = $true
    } catch {}
    if ($clientOk -and $apiOk) {
      return $true
    }
    Start-Sleep -Milliseconds 1000
  }
  return $false
}

$RepoRoot = [string](Resolve-Path (Join-Path $PSScriptRoot "..\.."))
Set-Location $RepoRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ArtifactRelDir = ".codex-artifacts/qa-mvf/$Timestamp"
$ResultRelPath = "$ArtifactRelDir/result.json"
$SummaryRelPath = "$ArtifactRelDir/summary.txt"
$DevLogRelPath = "$ArtifactRelDir/dev.log"
$ArtifactDir = Join-Path $RepoRoot $ArtifactRelDir
$null = New-Item -ItemType Directory -Path $ArtifactDir -Force
$ResultPath = Join-Path $RepoRoot $ResultRelPath
$SummaryPath = Join-Path $RepoRoot $SummaryRelPath
$DevLogPath = Join-Path $RepoRoot $DevLogRelPath

$Results = [ordered]@{}
$GeneratedStoreEmail = $null
$GeneratedOrderRef = $null
$GeneratedOrderId = $null
$StartedDevHere = $false
$DevJob = $null
$ScriptError = $null

try {
  $stackReady = Wait-ForStack -ClientUrl $BaseClient -ApiUrl $BaseApi -TimeoutSec 4
  if (-not $stackReady) {
    $StartedDevHere = $true
    $DevJob = Start-Job -ScriptBlock {
      param($Root, $LogPath)
      Set-Location $Root
      & pnpm dev *> $LogPath
    } -ArgumentList $RepoRoot, $DevLogPath

    $stackReady = Wait-ForStack -ClientUrl $BaseClient -ApiUrl $BaseApi -TimeoutSec $BootTimeoutSec
  }

  Set-Result "qa_stack_ready" $stackReady ("startedDevHere=" + $StartedDevHere)
  if (-not $stackReady) {
    throw "Stack not ready on $BaseClient and $BaseApi after ${BootTimeoutSec}s"
  }

  try { $r = Invoke-WebRequest -Uri "$BaseClient/" -UseBasicParsing -TimeoutSec 15; Set-Result "store_home_route" ($r.StatusCode -eq 200) ("status=" + $r.StatusCode) } catch { Set-Result "store_home_route" $false $_.Exception.Message }
  try { $r = Invoke-WebRequest -Uri "$BaseClient/search?q=apple" -UseBasicParsing -TimeoutSec 15; Set-Result "store_search_route_apple" ($r.StatusCode -eq 200) ("status=" + $r.StatusCode) } catch { Set-Result "store_search_route_apple" $false $_.Exception.Message }
  try { $r = Invoke-WebRequest -Uri "$BaseClient/search?q=zzzzzz" -UseBasicParsing -TimeoutSec 15; Set-Result "store_search_route_zzzzzz" ($r.StatusCode -eq 200) ("status=" + $r.StatusCode) } catch { Set-Result "store_search_route_zzzzzz" $false $_.Exception.Message }

  $productId = $null
  $productSlug = $null
  try {
    $pApple = Invoke-RestMethod -Uri "$BaseApi/store/products?search=apple&page=1&limit=12" -Method Get -TimeoutSec 20
    $appleItems = @($pApple.data)
    $appleCount = $appleItems.Count
    if ($appleCount -gt 0) {
      $first = $appleItems[0]
      $productId = [int]$first.id
      $productSlug = [string]$first.slug
    }
    Set-Result "store_search_apple_results" ($appleCount -gt 0 -and $productId -gt 0) ("items=" + $appleCount + " productId=" + $productId)
  } catch { Set-Result "store_search_apple_results" $false $_.Exception.Message }

  try {
    $pEmpty = Invoke-RestMethod -Uri "$BaseApi/store/products?search=zzzzzz&page=1&limit=12" -Method Get -TimeoutSec 20
    $emptyCount = @($pEmpty.data).Count
    Set-Result "store_search_zzzzzz_empty" ($emptyCount -eq 0) ("items=" + $emptyCount)
  } catch { Set-Result "store_search_zzzzzz_empty" $false $_.Exception.Message }

  if (-not $productId) {
    try {
      $pAny = Invoke-RestMethod -Uri "$BaseApi/store/products?page=1&limit=1" -Method Get -TimeoutSec 20
      $first = @($pAny.data)[0]
      if ($first) { $productId = [int]$first.id; $productSlug = [string]$first.slug }
    } catch {}
  }

  if ($productId) {
    try { $r = Invoke-WebRequest -Uri "$BaseClient/product/$productId" -UseBasicParsing -TimeoutSec 15; Set-Result "store_product_route" ($r.StatusCode -eq 200) ("productId=$productId status=" + $r.StatusCode) } catch { Set-Result "store_product_route" $false $_.Exception.Message }
  } else {
    Set-Result "store_product_route" $false "No product id available from /api/store/products"
  }

  $storeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $GeneratedStoreEmail = "mvfqa_$(Get-Date -Format 'yyyyMMddHHmmssfff')@local.dev"
  $password = "customer123"
  try {
    $registerBody = @{ name = "MVF QA User"; email = $GeneratedStoreEmail; password = $password } | ConvertTo-Json
    $regResp = Invoke-RestMethod -Uri "$BaseApi/auth/register" -Method Post -WebSession $storeSession -ContentType "application/json" -Body $registerBody -TimeoutSec 20
    $ok = [bool]($regResp.success -eq $true)
    Set-Result "store_register" $ok ("email=" + $GeneratedStoreEmail)
  } catch { Set-Result "store_register" $false $_.Exception.Message }

  try {
    $loginBody = @{ email = $GeneratedStoreEmail; password = $password } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $storeSession -ContentType "application/json" -Body $loginBody -TimeoutSec 20
    $ok = [bool]($loginResp.success -eq $true)
    Set-Result "store_login" $ok ("email=" + $GeneratedStoreEmail)
  } catch { Set-Result "store_login" $false $_.Exception.Message }

  if ($productId) {
    try {
      $cartAddBody = @{ productId = [int]$productId; quantity = 1 } | ConvertTo-Json
      $addResp = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $storeSession -ContentType "application/json" -Body $cartAddBody -TimeoutSec 20
      $ok = [bool]($addResp.cartItem -and [int]$addResp.cartItem.productId -eq [int]$productId)
      Set-Result "store_add_to_cart" $ok ("productId=" + $productId)
    } catch { Set-Result "store_add_to_cart" $false $_.Exception.Message }

    try {
      $cartResp = Invoke-RestMethod -Uri "$BaseApi/cart" -Method Get -WebSession $storeSession -TimeoutSec 20
      $products = @($cartResp.Products)
      $ok = $products.Count -ge 1
      Set-Result "store_cart_view" $ok ("products=" + $products.Count)
    } catch { Set-Result "store_cart_view" $false $_.Exception.Message }
  } else {
    Set-Result "store_add_to_cart" $false "Skipped: missing productId"
    Set-Result "store_cart_view" $false "Skipped: missing productId"
  }

  $orderRef = $null
  $orderId = $null
  if ($productId) {
    try {
      $orderBody = @{ customer = @{ name = "MVF QA User"; phone = "0800000000"; address = "Local Test Address" }; paymentMethod = "COD"; items = @(@{ productId = [int]$productId; qty = 1 }) } | ConvertTo-Json -Depth 5
      $orderResp = Invoke-RestMethod -Uri "$BaseApi/store/orders" -Method Post -WebSession $storeSession -ContentType "application/json" -Body $orderBody -TimeoutSec 30
      $orderData = if ($orderResp.data) { $orderResp.data } else { $orderResp }
      $orderId = [int](Coalesce @($orderData.id, $orderData.orderId))
      $orderRef = [string](Coalesce @($orderData.invoiceNo, $orderData.ref, $orderData.invoice, $orderData.id))
      $ok = (-not [string]::IsNullOrWhiteSpace($orderRef)) -and ($orderId -gt 0)
      Set-Result "store_checkout_success_ref" $ok ("ref=" + $orderRef + " orderId=" + $orderId)
    } catch { Set-Result "store_checkout_success_ref" $false $_.Exception.Message }
  } else {
    Set-Result "store_checkout_success_ref" $false "Skipped: missing productId"
  }
  $GeneratedOrderRef = $orderRef
  $GeneratedOrderId = $orderId

  if ($orderRef) {
    try {
      $trackResp = Invoke-RestMethod -Uri "$BaseApi/store/orders/$orderRef" -Method Get -TimeoutSec 20
      $trackData = if ($trackResp.data) { $trackResp.data } else { $trackResp }
      $resolvedRef = [string](Coalesce @($trackData.ref, $trackData.invoiceNo, $trackData.id))
      $ok = ($resolvedRef -eq $orderRef)
      Set-Result "store_order_tracking_api" $ok ("resolvedRef=" + $resolvedRef)
    } catch { Set-Result "store_order_tracking_api" $false $_.Exception.Message }

    try { $r = Invoke-WebRequest -Uri "$BaseClient/order/$orderRef" -UseBasicParsing -TimeoutSec 15; Set-Result "store_order_tracking_route" ($r.StatusCode -eq 200) ("status=" + $r.StatusCode) } catch { Set-Result "store_order_tracking_route" $false $_.Exception.Message }
  } else {
    Set-Result "store_order_tracking_api" $false "Skipped: missing orderRef"
    Set-Result "store_order_tracking_route" $false "Skipped: missing orderRef"
  }

  $adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $adminEmail = "superadmin@local.dev"
  $adminPass = "supersecure123"
  try {
    $adminLoginBody = @{ email = $adminEmail; password = $adminPass } | ConvertTo-Json
    $adminLoginResp = Invoke-RestMethod -Uri "$BaseApi/auth/admin/login" -Method Post -WebSession $adminSession -ContentType "application/json" -Body $adminLoginBody -TimeoutSec 20
    $ok = [bool]($adminLoginResp.user -and $adminLoginResp.user.email -eq $adminEmail)
    Set-Result "admin_login" $ok ("email=" + $adminEmail)
  } catch { Set-Result "admin_login" $false $_.Exception.Message }

  $adminOrderRef = $orderRef
  $currentStatus = $null
  $newStatus = $null
  try {
    $ordersResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders?page=1&limit=20" -Method Get -WebSession $adminSession -TimeoutSec 20
    $items = @($ordersResp.data.items)
    if (-not $adminOrderRef -and $items.Count -gt 0) { $adminOrderRef = [string](Coalesce @($items[0].ref, $items[0].invoiceNo, $items[0].id)) }
    $ok = $ordersResp.success -eq $true -and $items.Count -ge 1
    Set-Result "admin_orders_list" $ok ("items=" + $items.Count + " sampleRef=" + $adminOrderRef)
  } catch { Set-Result "admin_orders_list" $false $_.Exception.Message }

  if ($adminOrderRef) {
    try {
      $searchResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders?page=1&limit=20&q=$adminOrderRef" -Method Get -WebSession $adminSession -TimeoutSec 20
      $searchItems = @($searchResp.data.items)
      $match = @($searchItems | Where-Object { ("$($_.ref)" -eq "$adminOrderRef") -or ("$($_.invoiceNo)" -eq "$adminOrderRef") })
      $okSearch = $match.Count -ge 1

      $detailResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders/$adminOrderRef" -Method Get -WebSession $adminSession -TimeoutSec 20
      $currentStatus = [string]$detailResp.data.status
      $filterResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders?page=1&limit=20&status=$currentStatus" -Method Get -WebSession $adminSession -TimeoutSec 20
      $filterItems = @($filterResp.data.items)
      $okFilter = $filterItems.Count -ge 1

      Set-Result "admin_orders_search_filter" ($okSearch -and $okFilter) ("searchCount=" + $searchItems.Count + " filterStatus=" + $currentStatus + " filterCount=" + $filterItems.Count)
      Set-Result "admin_order_detail_get" ($detailResp.success -eq $true) ("status=" + $currentStatus)
    } catch {
      Set-Result "admin_orders_search_filter" $false $_.Exception.Message
      if (-not $Results.Contains("admin_order_detail_get")) { Set-Result "admin_order_detail_get" $false $_.Exception.Message }
    }

    try {
      if ([string]::IsNullOrWhiteSpace($currentStatus)) { throw "Current status unavailable" }
      $targetByCurrent = @{ "pending" = "processing"; "processing" = "shipping"; "shipping" = "complete"; "complete" = "cancelled"; "cancelled" = "processing" }
      $newStatus = $targetByCurrent[$currentStatus]
      if (-not $newStatus) { $newStatus = "processing" }

      $patchBody = @{ status = $newStatus } | ConvertTo-Json
      $patchResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders/$adminOrderRef/status" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body $patchBody -TimeoutSec 20
      $patchedStatus = [string]$patchResp.data.status
      $ok = ($patchedStatus -eq $newStatus)
      Set-Result "admin_update_status_badge_changed" $ok ("from=" + $currentStatus + " to=" + $patchedStatus)
    } catch { Set-Result "admin_update_status_badge_changed" $false $_.Exception.Message }

    try {
      if ([string]::IsNullOrWhiteSpace($newStatus)) { throw "New status unavailable" }
      $detailAfter = Invoke-RestMethod -Uri "$BaseApi/admin/orders/$adminOrderRef" -Method Get -WebSession $adminSession -TimeoutSec 20
      $persistStatus = [string]$detailAfter.data.status
      $ok = ($persistStatus -eq $newStatus)
      Set-Result "admin_refresh_persist" $ok ("expected=" + $newStatus + " actual=" + $persistStatus)
    } catch { Set-Result "admin_refresh_persist" $false $_.Exception.Message }

    try {
      if ([string]::IsNullOrWhiteSpace($newStatus)) { throw "New status unavailable" }
      if ([string]::IsNullOrWhiteSpace($orderRef)) { throw "Order ref unavailable" }
      $trackingAfter = Invoke-RestMethod -Uri "$BaseApi/store/orders/$orderRef" -Method Get -TimeoutSec 20
      $trackingDataAfter = if ($trackingAfter.data) { $trackingAfter.data } else { $trackingAfter }
      $trackingStatusAfter = [string](Coalesce @($trackingDataAfter.status, ""))
      $trackingResolvedRef = [string](Coalesce @($trackingDataAfter.ref, $trackingDataAfter.invoiceNo, $trackingDataAfter.id))
      $ok = ($trackingStatusAfter -eq $newStatus) -and ($trackingResolvedRef -eq $orderRef)
      Set-Result "store_tracking_status_sync" $ok ("expected=" + $newStatus + " actual=" + $trackingStatusAfter + " ref=" + $trackingResolvedRef)
    } catch { Set-Result "store_tracking_status_sync" $false $_.Exception.Message }

    try {
      if ([string]::IsNullOrWhiteSpace($newStatus)) { throw "New status unavailable" }
      $myOrdersResp = Invoke-RestMethod -Uri "$BaseApi/store/my/orders" -Method Get -WebSession $storeSession -TimeoutSec 20
      $myOrdersItems = @($myOrdersResp.data)
      $myOrder = @($myOrdersItems | Where-Object {
        ("$($_.invoiceNo)" -eq "$orderRef") -or ("$($_.ref)" -eq "$orderRef") -or ([string]$_.id -eq [string]$orderId)
      }) | Select-Object -First 1
      if (-not $myOrder) { throw "Order not found in /store/my/orders" }
      $accountStatus = [string](Coalesce @($myOrder.status, ""))
      $accountInvoice = [string](Coalesce @($myOrder.invoiceNo, $myOrder.ref, $myOrder.id))
      $ok = ($accountStatus -eq $newStatus)
      Set-Result "account_orders_status_sync" $ok ("expected=" + $newStatus + " actual=" + $accountStatus + " invoice=" + $accountInvoice)
    } catch { Set-Result "account_orders_status_sync" $false $_.Exception.Message }

    try {
      if ([string]::IsNullOrWhiteSpace($newStatus)) { throw "New status unavailable" }
      if (-not $orderId -or $orderId -le 0) { throw "Order id unavailable" }
      $myOrderDetailResp = Invoke-RestMethod -Uri "$BaseApi/store/orders/my/$orderId" -Method Get -WebSession $storeSession -TimeoutSec 20
      $myOrderDetail = if ($myOrderDetailResp.data) { $myOrderDetailResp.data } else { $myOrderDetailResp }
      $detailStatus = [string](Coalesce @($myOrderDetail.status, ""))
      $detailInvoice = [string](Coalesce @($myOrderDetail.invoiceNo, $myOrderDetail.ref, $myOrderDetail.id))
      $detailItemsCount = @($myOrderDetail.items).Count
      $ok = ($detailStatus -eq $newStatus) -and ($detailItemsCount -ge 1)
      Set-Result "account_order_detail_status_sync" $ok ("expected=" + $newStatus + " actual=" + $detailStatus + " items=" + $detailItemsCount + " invoice=" + $detailInvoice)
    } catch { Set-Result "account_order_detail_status_sync" $false $_.Exception.Message }
  } else {
    Set-Result "admin_orders_search_filter" $false "No order ref available to test search/filter"
    Set-Result "admin_order_detail_get" $false "No order ref available to test detail"
    Set-Result "admin_update_status_badge_changed" $false "No order ref available to test status update"
    Set-Result "admin_refresh_persist" $false "No order ref available to test persistence"
    Set-Result "store_tracking_status_sync" $false "No order ref available to test tracking sync"
    Set-Result "account_orders_status_sync" $false "No order ref available to test account order list sync"
    Set-Result "account_order_detail_status_sync" $false "No order id available to test account order detail sync"
  }
}
catch {
  $ScriptError = $_.Exception.Message
  Set-Result "qa_script_runtime" $false $ScriptError
}
finally {
  if ($StartedDevHere -and $null -ne $DevJob) {
    Stop-Job -Id $DevJob.Id -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Id $DevJob.Id -Force -ErrorAction SilentlyContinue | Out-Null
  }
}

$total = @($Results.GetEnumerator()).Count
$failed = @($Results.GetEnumerator() | Where-Object { -not $_.Value.pass })
$passedCount = $total - $failed.Count
$overallPass = ($failed.Count -eq 0)

$resultObj = [ordered]@{
  timestamp = (Get-Date).ToString("s")
  runId = $Timestamp
  artifactDir = $ArtifactRelDir
  resultFile = $ResultRelPath
  summaryFile = $SummaryRelPath
  devLogFile = if (Test-Path $DevLogPath) { $DevLogRelPath } else { $null }
  startedDevHere = $StartedDevHere
  client = $BaseClient
  api = $BaseApi
  generatedStoreEmail = $GeneratedStoreEmail
  generatedOrderRef = $GeneratedOrderRef
  generatedOrderId = $GeneratedOrderId
  total = $total
  passed = $passedCount
  failed = $failed.Count
  success = $overallPass
  scriptError = $ScriptError
  checks = $Results
}

$resultObj | ConvertTo-Json -Depth 8 | Set-Content -Path $ResultPath -Encoding UTF8

$summaryLines = @()
$summaryLines += ("QA_MVF_RUN=" + $Timestamp)
$summaryLines += ("ARTIFACT_DIR=" + $ArtifactRelDir)
$summaryLines += ("RESULT_FILE=" + $ResultRelPath)
$summaryLines += ("SUMMARY=" + $passedCount + "/" + $total + " passed")

foreach ($entry in $Results.GetEnumerator()) {
  $status = if ($entry.Value.pass) { "PASS" } else { "FAIL" }
  $line = "{0}={1} :: {2}" -f $entry.Key, $status, $entry.Value.details
  $summaryLines += $line
  Write-Output $line
}

$summaryLines | Set-Content -Path $SummaryPath -Encoding UTF8
Write-Output ("RESULT_FILE=" + $ResultRelPath)
Write-Output ("SUMMARY_FILE=" + $SummaryRelPath)

if ($overallPass) { exit 0 } else { exit 1 }
