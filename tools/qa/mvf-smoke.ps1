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

function Set-Entity([string]$Key, [object]$Value) {
  if ([string]::IsNullOrWhiteSpace($Key)) {
    return
  }
  $script:RunEntities[$Key] = $Value
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

function Invoke-ServerNodeJson([string]$Script) {
  $serverRoot = Join-Path $RepoRoot "server"
  $encodedScript = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Script))
  Push-Location $serverRoot
  try {
    $output = & node -e "eval(Buffer.from(process.argv[1],'base64').toString('utf8'))" $encodedScript 2>&1
    if ($LASTEXITCODE -ne 0) {
      $message = ($output | Out-String).Trim()
      throw (if ([string]::IsNullOrWhiteSpace($message)) { "Node helper failed." } else { $message })
    }
    $json = ($output | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($json)) {
      return $null
    }
    return ($json | ConvertFrom-Json)
  } finally {
    Pop-Location
  }
}

function New-QaPngFile([string]$NamePrefix) {
  $pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnHCqUAAAAASUVORK5CYII="
  $bytes = [Convert]::FromBase64String($pngBase64)
  $fileName = "{0}-{1}.png" -f $NamePrefix, ([Guid]::NewGuid().ToString("N"))
  $filePath = Join-Path $ArtifactDir $fileName
  [System.IO.File]::WriteAllBytes($filePath, $bytes)
  return $filePath
}

$RepoRoot = [string](Resolve-Path (Join-Path $PSScriptRoot "..\.."))
Set-Location $RepoRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
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
$RunEntities = [ordered]@{}
$GeneratedStoreEmail = $null
$GeneratedOrderRef = $null
$GeneratedOrderId = $null
$GeneratedCatalogBuyerEmail = $null
$GeneratedSellerStoreId = $null
$GeneratedSellerStoreSlug = $null
$GeneratedCatalogProductId = $null
$GeneratedCatalogProductSlug = $null
$GeneratedCatalogReviewState = $null
$GeneratedCatalogPublishState = $null
$GeneratedCatalogOrderRef = $null
$GeneratedCatalogOrderId = $null
$GeneratedCatalogSuborderId = $null
$GeneratedCatalogCheckoutMode = $null
$GeneratedSellerPaymentPreviousProfileId = $null
$GeneratedSellerPaymentPreviousQrisUrl = $null
$GeneratedSellerPaymentPendingRequestId = $null
$GeneratedSellerPaymentPendingQrisUrl = $null
$GeneratedMultiStoreBuyerEmail = $null
$GeneratedMultiStoreStoreAId = $null
$GeneratedMultiStoreStoreASlug = $null
$GeneratedMultiStoreStoreBId = $null
$GeneratedMultiStoreStoreBSlug = $null
$GeneratedMultiStoreProductAId = $null
$GeneratedMultiStoreProductASlug = $null
$GeneratedMultiStoreProductBId = $null
$GeneratedMultiStoreProductBSlug = $null
$GeneratedMultiStoreParentOrderId = $null
$GeneratedMultiStoreParentOrderRef = $null
$GeneratedMultiStoreSuborderAId = $null
$GeneratedMultiStoreSuborderBId = $null
$GeneratedMultiStoreCheckoutMode = $null
$GeneratedMultiStorePreviewStoreCount = $null
$GeneratedMultiStoreSuborderCount = $null
$StartedDevHere = $false
$DevJob = $null
$ScriptError = $null
$AdminEmail = "superadmin@local.dev"
$AdminPass = "supersecure123"

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
  try {
    $adminLoginBody = @{ email = $AdminEmail; password = $AdminPass } | ConvertTo-Json
    $adminLoginResp = Invoke-RestMethod -Uri "$BaseApi/auth/admin/login" -Method Post -WebSession $adminSession -ContentType "application/json" -Body $adminLoginBody -TimeoutSec 20
    $ok = [bool]($adminLoginResp.user -and $adminLoginResp.user.email -eq $AdminEmail)
    Set-Result "admin_login" $ok ("email=" + $AdminEmail)
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

  $sellerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $sellerStoreId = $null
  $sellerStoreSlug = $null
  $sellerProductId = $null
  $sellerProductSlug = $null
  $sellerReviewState = $null
  $sellerPublishState = $null
  $sellerOrderRef = $null
  $sellerOrderId = $null
  $sellerSuborderId = $null
  $sellerCheckoutMode = $null
  $sellerCategoryId = $null
  $catalogRunTag = "qa-catalog-$Timestamp"

  try {
    $sellerLoginBody = @{ email = $AdminEmail; password = $AdminPass } | ConvertTo-Json
    $sellerLoginResp = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $sellerSession -ContentType "application/json" -Body $sellerLoginBody -TimeoutSec 20
    $ok = [bool]($sellerLoginResp.success -eq $true -and $sellerLoginResp.data.user.email -eq $AdminEmail)
    Set-Result "seller_workspace_login" $ok ("email=" + $AdminEmail)
  } catch {
    Set-Result "seller_workspace_login" $false $_.Exception.Message
  }

  if ($Results["seller_workspace_login"].pass) {
    try {
      $storeMineResp = Invoke-RestMethod -Uri "$BaseApi/stores/mine" -Method Get -WebSession $sellerSession -TimeoutSec 20
      $sellerStoreId = [int]($storeMineResp.data.id)
      $sellerStoreSlug = [string]$storeMineResp.data.slug
      $GeneratedSellerStoreId = $sellerStoreId
      $GeneratedSellerStoreSlug = $sellerStoreSlug
      Set-Entity "sellerStore" @{
        id = $sellerStoreId
        slug = $sellerStoreSlug
        name = [string]$storeMineResp.data.name
      }
      $ok = $sellerStoreId -gt 0 -and (-not [string]::IsNullOrWhiteSpace($sellerStoreSlug))
      Set-Result "seller_workspace_store_context" $ok ("storeId=" + $sellerStoreId + " slug=" + $sellerStoreSlug)
    } catch {
      Set-Result "seller_workspace_store_context" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_workspace_store_context" $false "Skipped: seller login failed"
  }

  if ($Results["seller_workspace_store_context"].pass) {
    try {
      $metaResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/authoring/meta" -Method Get -WebSession $sellerSession -TimeoutSec 20
      $categories = @($metaResp.data.references.categories)
      $firstCategory = @($categories | Where-Object { [int]$_.id -gt 0 }) | Select-Object -First 1
      if (-not $firstCategory) { throw "No published seller categories available." }
      $sellerCategoryId = [int]$firstCategory.id
      Set-Entity "sellerCatalogCategory" @{
        id = $sellerCategoryId
        code = [string]$firstCategory.code
        name = [string]$firstCategory.name
      }
      Set-Result "seller_authoring_meta" $true ("categoryId=" + $sellerCategoryId + " code=" + [string]$firstCategory.code)
    } catch {
      Set-Result "seller_authoring_meta" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_authoring_meta" $false "Skipped: seller store context unavailable"
  }

  if ($Results["seller_workspace_store_context"].pass -and $Results["admin_login"].pass) {
    try {
      $sellerProfileGetResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payment-profile" -Method Get -WebSession $sellerSession -TimeoutSec 20
      $sellerProfile = $sellerProfileGetResp.data
      $sellerCanEdit = [bool]$sellerProfile.governance.canEdit
      $activeSnapshotBefore = $sellerProfile.activeSnapshot
      $activeSnapshotIdBefore = if ($null -ne $activeSnapshotBefore) { [int]$activeSnapshotBefore.id } else { 0 }
      $activeSnapshotStatusBefore = if ($null -ne $activeSnapshotBefore) { [string]$activeSnapshotBefore.verificationStatus } else { "" }
      $activeSnapshotQrisBefore = if ($null -ne $activeSnapshotBefore) { [string]$activeSnapshotBefore.qrisImageUrl } else { "" }
      Set-Result "seller_payment_setup_phase2b_open" ($null -ne $sellerProfile -and $sellerCanEdit) ("storeId=" + $sellerStoreId + " canEdit=" + [string]$sellerCanEdit + " activeSnapshotId=" + [string]$activeSnapshotIdBefore)

      $qrisUploadFile = New-QaPngFile "seller-payment-qris"
      $uploadJson = & curl.exe -s -X POST -F "file=@$qrisUploadFile" "$BaseApi/upload"
      if ($LASTEXITCODE -ne 0) { throw "QRIS upload request failed." }
      $uploadResp = $uploadJson | ConvertFrom-Json
      $uploadedQrisUrl = [string]$uploadResp.data.url
      $uploadOk = (-not [string]::IsNullOrWhiteSpace($uploadedQrisUrl)) -and ($uploadedQrisUrl -ne $activeSnapshotQrisBefore)
      Set-Result "seller_payment_setup_qris_upload_request" $uploadOk ("pendingQris=" + $uploadedQrisUrl)

      $draftPayload = @{
        accountName = "MVF QA Seller"
        merchantName = "MVF QA Seller Store $Timestamp"
        merchantId = "MVF-QA-$sellerStoreId"
        qrisImageUrl = $uploadedQrisUrl
        qrisPayload = "MVF-QA-$sellerStoreSlug-DRAFT"
        instructionText = "QA smoke seller payment setup draft $Timestamp"
        sellerNote = "QA smoke seller request note $Timestamp"
      } | ConvertTo-Json
      $draftResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payment-profile/request" -Method Put -WebSession $sellerSession -ContentType "application/json" -Body $draftPayload -TimeoutSec 20
      $draftProfile = $draftResp.data
      $draftPending = $draftProfile.pendingRequest
      $draftActive = $draftProfile.activeSnapshot
      $draftOk = ($null -ne $draftPending) -and ([string]$draftProfile.requestStatus.code -eq "DRAFT") -and ([string]$draftPending.requestStatus -eq "DRAFT") -and ([int]($draftActive.id) -eq $activeSnapshotIdBefore) -and ([string]$draftPending.qrisImageUrl -eq $uploadedQrisUrl) -and ([string]$draftActive.qrisImageUrl -eq $activeSnapshotQrisBefore)
      Set-Result "seller_payment_setup_phase2b_save_draft" $draftOk ("requestState=" + [string]$draftProfile.requestStatus.code + " pendingRequestId=" + [string]$draftPending.id + " activeSnapshotId=" + [string]$draftActive.id)

      $submitResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payment-profile/request/submit" -Method Post -WebSession $sellerSession -ContentType "application/json" -Body $draftPayload -TimeoutSec 20
      $submittedProfile = $submitResp.data
      $submittedPending = $submittedProfile.pendingRequest
      $submittedActive = $submittedProfile.activeSnapshot
      $submitOk = ($null -ne $submittedPending) -and ([string]$submittedProfile.requestStatus.code -eq "SUBMITTED") -and ([string]$submittedPending.requestStatus -eq "SUBMITTED") -and ([int]($submittedActive.id) -eq $activeSnapshotIdBefore)
      Set-Result "seller_payment_setup_phase2b_submit" $submitOk ("requestState=" + [string]$submittedProfile.requestStatus.code + " pendingRequestId=" + [string]$submittedPending.id + " activeSnapshotId=" + [string]$submittedActive.id)

      $adminProfilesResp = Invoke-RestMethod -Uri "$BaseApi/admin/stores/payment-profiles" -Method Get -WebSession $adminSession -TimeoutSec 20
      $adminProfiles = @($adminProfilesResp.data)
      $adminProfile = @($adminProfiles | Where-Object { [int]$_.store.id -eq [int]$sellerStoreId }) | Select-Object -First 1
      $adminProfileSnapshot = $adminProfile.paymentProfile
      $adminPendingRequest = $adminProfile.pendingRequest
      $adminStableOk = ($null -ne $adminProfileSnapshot) -and ([int]$adminProfileSnapshot.id -eq $activeSnapshotIdBefore) -and ([string]$adminProfileSnapshot.verificationStatus -eq $activeSnapshotStatusBefore)
      Set-Result "seller_payment_setup_phase2b_active_snapshot_stable" $adminStableOk ("adminProfileId=" + [string]$adminProfileSnapshot.id + " status=" + [string]$adminProfileSnapshot.verificationStatus)
      $adminPendingQrisOk = ($null -ne $adminPendingRequest) -and ([string]$adminPendingRequest.requestStatus -eq "SUBMITTED") -and ([string]$adminPendingRequest.qrisImageUrl -eq $uploadedQrisUrl) -and ([string]$adminProfileSnapshot.qrisImageUrl -eq $activeSnapshotQrisBefore)
      Set-Result "admin_payment_setup_qris_request_visible" $adminPendingQrisOk ("requestId=" + [string]$adminPendingRequest.id + " activeQris=" + [string]$adminProfileSnapshot.qrisImageUrl + " pendingQris=" + [string]$adminPendingRequest.qrisImageUrl)

      Set-Entity "sellerPaymentProfile" @{
        id = [int]$adminProfileSnapshot.id
        storeId = [int]$sellerStoreId
        verificationStatus = [string]$adminProfileSnapshot.verificationStatus
        isActive = [bool]$adminProfileSnapshot.isActive
        requestFlow = @{
          draftState = [string]$draftProfile.requestStatus.code
          submitState = [string]$submittedProfile.requestStatus.code
          pendingRequestId = [int]$submittedPending.id
          previousActiveSnapshotId = [int]$activeSnapshotIdBefore
          activeSnapshotId = [int]$adminProfileSnapshot.id
          previousQrisImageUrl = [string]$activeSnapshotQrisBefore
          pendingQrisImageUrl = [string]$uploadedQrisUrl
        }
      }
      $GeneratedSellerPaymentPreviousProfileId = [int]$activeSnapshotIdBefore
      $GeneratedSellerPaymentPreviousQrisUrl = [string]$activeSnapshotQrisBefore
      $GeneratedSellerPaymentPendingRequestId = [int]$submittedPending.id
      $GeneratedSellerPaymentPendingQrisUrl = [string]$uploadedQrisUrl
      $ok = [bool]$adminProfileSnapshot.isActive -and ([string]$adminProfileSnapshot.verificationStatus -eq "ACTIVE")
      Set-Result "seller_store_payment_profile_ready" $ok ("profileId=" + [string]$adminProfileSnapshot.id + " status=" + [string]$adminProfileSnapshot.verificationStatus)
    } catch {
      if (-not $Results.Contains("seller_payment_setup_qris_upload_request")) { Set-Result "seller_payment_setup_qris_upload_request" $false $_.Exception.Message }
      if (-not $Results.Contains("seller_payment_setup_phase2b_open")) { Set-Result "seller_payment_setup_phase2b_open" $false $_.Exception.Message }
      if (-not $Results.Contains("seller_payment_setup_phase2b_save_draft")) { Set-Result "seller_payment_setup_phase2b_save_draft" $false $_.Exception.Message }
      if (-not $Results.Contains("seller_payment_setup_phase2b_submit")) { Set-Result "seller_payment_setup_phase2b_submit" $false $_.Exception.Message }
      if (-not $Results.Contains("seller_payment_setup_phase2b_active_snapshot_stable")) { Set-Result "seller_payment_setup_phase2b_active_snapshot_stable" $false $_.Exception.Message }
      if (-not $Results.Contains("admin_payment_setup_qris_request_visible")) { Set-Result "admin_payment_setup_qris_request_visible" $false $_.Exception.Message }
      Set-Result "seller_store_payment_profile_ready" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_payment_setup_qris_upload_request" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "seller_payment_setup_phase2b_open" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "seller_payment_setup_phase2b_save_draft" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "seller_payment_setup_phase2b_submit" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "seller_payment_setup_phase2b_active_snapshot_stable" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "admin_payment_setup_qris_request_visible" $false "Skipped: seller store context or admin login unavailable"
    Set-Result "seller_store_payment_profile_ready" $false "Skipped: seller store context or admin login unavailable"
  }

  if ($Results["seller_authoring_meta"].pass) {
    try {
      $createDraftBody = @{
        name = "QA Catalog Draft $catalogRunTag"
        description = "QA smoke seller draft create."
        sku = "QA-$catalogRunTag"
        categoryIds = @($sellerCategoryId)
        defaultCategoryId = $sellerCategoryId
        price = 150000
        salePrice = 120000
        stock = 8
        imageUrls = @("/uploads/products/demo-kacha/fruits.svg")
      } | ConvertTo-Json -Depth 6
      $draftResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/drafts" -Method Post -WebSession $sellerSession -ContentType "application/json" -Body $createDraftBody -TimeoutSec 30
      $draft = $draftResp.data
      $sellerProductId = [int]$draft.id
      $sellerProductSlug = [string]$draft.slug
      $GeneratedCatalogProductId = $sellerProductId
      $GeneratedCatalogProductSlug = $sellerProductSlug
      Set-Entity "sellerCatalogDraft" @{
        productId = $sellerProductId
        slug = $sellerProductSlug
        storeId = $sellerStoreId
        storeSlug = $sellerStoreSlug
      }
      $ok = $sellerProductId -gt 0 -and ([string]$draft.status -eq "draft") -and ([string]$draft.submission.status -eq "none")
      Set-Result "seller_catalog_create_draft" $ok ("productId=" + $sellerProductId + " slug=" + $sellerProductSlug + " reviewState=" + [string]$draft.submission.reviewState)
    } catch {
      Set-Result "seller_catalog_create_draft" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_catalog_create_draft" $false "Skipped: seller authoring meta unavailable"
  }

  if ($Results["seller_catalog_create_draft"].pass) {
    try {
      $editDraftBody = @{
        name = "QA Catalog Draft $catalogRunTag Revised"
        description = "QA smoke seller draft edit."
        sku = "QA-$catalogRunTag-REV1"
        categoryIds = @($sellerCategoryId)
        defaultCategoryId = $sellerCategoryId
        price = 155000
        salePrice = 118000
        stock = 10
        imageUrls = @("/uploads/products/demo-kacha/vegetables.svg", "/uploads/products/demo-kacha/fruits.svg")
      } | ConvertTo-Json -Depth 6
      $editResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/$sellerProductId/draft" -Method Patch -WebSession $sellerSession -ContentType "application/json" -Body $editDraftBody -TimeoutSec 30
      $edited = $editResp.data
      $sellerProductSlug = [string]$edited.slug
      $GeneratedCatalogProductSlug = $sellerProductSlug
      Set-Entity "sellerCatalogEditedDraft" @{
        productId = $sellerProductId
        slug = $sellerProductSlug
        price = [double]$edited.pricing.price
        salePrice = [double]$edited.pricing.salePrice
        stock = [int]$edited.inventory.stock
        imageCount = @($edited.media.imageUrls).Count
      }
      $ok = ([double]$edited.pricing.price -eq 155000) -and ([double]$edited.pricing.salePrice -eq 118000) -and ([int]$edited.inventory.stock -eq 10)
      Set-Result "seller_catalog_edit_draft" $ok ("slug=" + $sellerProductSlug + " price=" + [string]$edited.pricing.price + " salePrice=" + [string]$edited.pricing.salePrice + " imageCount=" + @($edited.media.imageUrls).Count)
    } catch {
      Set-Result "seller_catalog_edit_draft" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_catalog_edit_draft" $false "Skipped: seller draft create failed"
  }

  if ($Results["seller_catalog_edit_draft"].pass) {
    try {
      $submitResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/$sellerProductId/submit-review" -Method Post -WebSession $sellerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
      $submit = $submitResp.data
      $sellerReviewState = [string]$submit.submission.status
      $GeneratedCatalogReviewState = $sellerReviewState
      Set-Entity "sellerCatalogSubmissionAfterSubmit" @{
        productId = $sellerProductId
        reviewState = $sellerReviewState
        canEdit = [bool]$submit.submission.canEdit
      }
      $ok = ($sellerReviewState -eq "submitted") -and (-not [bool]$submit.submission.canEdit)
      Set-Result "seller_catalog_submit_review" $ok ("productId=" + $sellerProductId + " reviewState=" + $sellerReviewState)
    } catch {
      Set-Result "seller_catalog_submit_review" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_catalog_submit_review" $false "Skipped: seller draft edit failed"
  }

  if ($Results["seller_catalog_submit_review"].pass -and $Results["admin_login"].pass) {
    try {
      $queueResp = Invoke-RestMethod -Uri "$BaseApi/admin/products?page=1&limit=20&sellerSubmissionStatus=review_queue&q=$sellerProductSlug" -Method Get -WebSession $adminSession -TimeoutSec 30
      $queueItems = if ($queueResp.data -is [System.Array]) { @($queueResp.data) } elseif ($queueResp.data.items) { @($queueResp.data.items) } else { @() }
      $queueMatch = @($queueItems | Where-Object { [string]$_.slug -eq $sellerProductSlug })
      $detailResp = Invoke-RestMethod -Uri "$BaseApi/admin/products/$sellerProductId" -Method Get -WebSession $adminSession -TimeoutSec 30
      $detail = $detailResp.data
      $ok = ($queueMatch.Count -ge 1) -and ([string]$detail.sellerSubmission.status -eq "submitted")
      Set-Entity "sellerCatalogAdminQueueAfterSubmit" @{
        productId = $sellerProductId
        slug = $sellerProductSlug
        queueMatches = $queueMatch.Count
        reviewQueue = $queueResp.meta.reviewQueue
      }
      Set-Result "admin_review_queue_visible" $ok ("queueMatches=" + $queueMatch.Count + " queueTotal=" + [string]$queueResp.meta.reviewQueue.total + " detailState=" + [string]$detail.sellerSubmission.status)
    } catch {
      Set-Result "admin_review_queue_visible" $false $_.Exception.Message
    }
  } else {
    Set-Result "admin_review_queue_visible" $false "Skipped: seller submit review or admin login failed"
  }

  if ($Results["admin_review_queue_visible"].pass) {
    try {
      $revisionBody = @{ note = "QA smoke revision request for $catalogRunTag" } | ConvertTo-Json
      $revisionResp = Invoke-RestMethod -Uri "$BaseApi/admin/products/$sellerProductId/revision-request" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body $revisionBody -TimeoutSec 30
      $revisionData = $revisionResp.data
      $sellerDetailResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/$sellerProductId" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $sellerDetail = $sellerDetailResp.data
      $sellerReviewState = [string]$sellerDetail.submission.status
      $GeneratedCatalogReviewState = $sellerReviewState
      $ok = ([string]$revisionData.sellerSubmissionStatus -eq "needs_revision") -and ($sellerReviewState -eq "needs_revision") -and ([bool]$sellerDetail.submission.canEdit)
      Set-Entity "sellerCatalogRevision" @{
        productId = $sellerProductId
        adminState = [string]$revisionData.sellerSubmissionStatus
        sellerState = $sellerReviewState
        revisionNote = [string]$sellerDetail.submission.revisionNote
      }
      Set-Result "admin_request_revision" $ok ("adminState=" + [string]$revisionData.sellerSubmissionStatus + " sellerState=" + $sellerReviewState + " note=" + [string]$sellerDetail.submission.revisionNote)
    } catch {
      Set-Result "admin_request_revision" $false $_.Exception.Message
    }
  } else {
    Set-Result "admin_request_revision" $false "Skipped: admin review queue not validated"
  }

  if ($Results["admin_request_revision"].pass) {
    try {
      $resubmitDraftBody = @{
        name = "QA Catalog Draft $catalogRunTag Final"
        description = "QA smoke seller revision and resubmit."
        sku = "QA-$catalogRunTag-FINAL"
        categoryIds = @($sellerCategoryId)
        defaultCategoryId = $sellerCategoryId
        price = 158000
        salePrice = 112000
        stock = 14
        imageUrls = @("/uploads/products/demo-kacha/pantry.svg", "/uploads/products/demo-kacha/fruits.svg")
      } | ConvertTo-Json -Depth 6
      $revisedResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/$sellerProductId/draft" -Method Patch -WebSession $sellerSession -ContentType "application/json" -Body $resubmitDraftBody -TimeoutSec 30
      $revised = $revisedResp.data
      $sellerProductSlug = [string]$revised.slug
      $GeneratedCatalogProductSlug = $sellerProductSlug
      $resubmitResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/products/$sellerProductId/submit-review" -Method Post -WebSession $sellerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
      $resubmitted = $resubmitResp.data
      $sellerReviewState = [string]$resubmitted.submission.status
      $GeneratedCatalogReviewState = $sellerReviewState
      $queueResp = Invoke-RestMethod -Uri "$BaseApi/admin/products?page=1&limit=20&sellerSubmissionStatus=review_queue&q=$sellerProductSlug" -Method Get -WebSession $adminSession -TimeoutSec 30
      $queueItems = if ($queueResp.data -is [System.Array]) { @($queueResp.data) } elseif ($queueResp.data.items) { @($queueResp.data.items) } else { @() }
      $queueMatch = @($queueItems | Where-Object { [string]$_.slug -eq $sellerProductSlug })
      $ok = (@($revised.media.imageUrls).Count -ge 2) -and ($sellerReviewState -eq "submitted") -and ($queueMatch.Count -ge 1)
      Set-Entity "sellerCatalogResubmission" @{
        productId = $sellerProductId
        slug = $sellerProductSlug
        reviewState = $sellerReviewState
        imageCount = @($revised.media.imageUrls).Count
        queueMatches = $queueMatch.Count
      }
      Set-Result "seller_revise_and_resubmit" $ok ("slug=" + $sellerProductSlug + " reviewState=" + $sellerReviewState + " imageCount=" + @($revised.media.imageUrls).Count + " queueMatches=" + $queueMatch.Count)
    } catch {
      Set-Result "seller_revise_and_resubmit" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_revise_and_resubmit" $false "Skipped: admin revision step failed"
  }

  if ($Results["seller_revise_and_resubmit"].pass) {
    try {
      $publishBody = @{ published = $true } | ConvertTo-Json
      $publishResp = Invoke-RestMethod -Uri "$BaseApi/admin/products/$sellerProductId/published" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body $publishBody -TimeoutSec 30
      $publishData = $publishResp.data
      $sellerPublishState = if ([bool]$publishData.published) { "published" } else { "not_published" }
      $GeneratedCatalogPublishState = $sellerPublishState
      $adminDetailResp = Invoke-RestMethod -Uri "$BaseApi/admin/products/$sellerProductId" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminDetail = $adminDetailResp.data
      $ok = [bool]$publishData.published -and ([string]$publishData.status -eq "active") -and ([string]$adminDetail.sellerSubmission.status -eq "none")
      Set-Entity "sellerCatalogPublish" @{
        productId = $sellerProductId
        published = [bool]$publishData.published
        status = [string]$publishData.status
        submission = [string]$adminDetail.sellerSubmission.status
      }
      Set-Result "admin_publish_product" $ok ("published=" + [string]$publishData.published + " status=" + [string]$publishData.status + " reviewState=" + [string]$adminDetail.sellerSubmission.status)
    } catch {
      Set-Result "admin_publish_product" $false $_.Exception.Message
    }
  } else {
    Set-Result "admin_publish_product" $false "Skipped: seller resubmit failed"
  }

  if ($Results["admin_publish_product"].pass) {
    try {
      $listResp = Invoke-RestMethod -Uri "$BaseApi/store/products?storeSlug=$sellerStoreSlug&page=1&limit=100" -Method Get -TimeoutSec 30
      $listItems = @($listResp.data)
      $listMatch = @($listItems | Where-Object { [int]$_.id -eq $sellerProductId })
      $detailResp = Invoke-RestMethod -Uri "$BaseApi/store/products/$sellerProductSlug" -Method Get -TimeoutSec 30
      $detail = $detailResp.data
      $ok = ($listMatch.Count -ge 1) -and ([int]$detail.id -eq $sellerProductId) -and ([bool]$detail.published) -and ([string]$detail.status -eq "active")
      Set-Entity "sellerCatalogStorefrontVisibility" @{
        productId = $sellerProductId
        slug = $sellerProductSlug
        storefrontFound = ($listMatch.Count -ge 1)
        price = [double]$detail.price
        originalPrice = [double]$detail.originalPrice
        stock = [int]$detail.stock
        storeSlug = [string]$detail.sellerInfo.slug
      }
      Set-Result "storefront_product_visibility_valid" $ok ("listMatches=" + $listMatch.Count + " detailId=" + [string]$detail.id + " price=" + [string]$detail.price + " stock=" + [string]$detail.stock)
    } catch {
      Set-Result "storefront_product_visibility_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "storefront_product_visibility_valid" $false "Skipped: admin publish failed"
  }

  if ($Results["storefront_product_visibility_valid"].pass) {
    try {
      $sellerProfileResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/profile" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $sellerProfile = $sellerProfileResp.data
      $publicIdentityResp = Invoke-RestMethod -Uri "$BaseApi/store/customization/identity/$sellerStoreSlug" -Method Get -TimeoutSec 30
      $publicIdentity = $publicIdentityResp.data
      $publicIdentityProps = @($publicIdentity.PSObject.Properties.Name)
      $contractOk =
        ([string](Coalesce @($publicIdentity.name, "")) -eq [string](Coalesce @($sellerProfile.name, ""))) -and
        ([string](Coalesce @($publicIdentity.slug, "")) -eq [string](Coalesce @($sellerProfile.slug, ""))) -and
        ([string](Coalesce @($publicIdentity.description, "")) -eq [string](Coalesce @($sellerProfile.description, ""))) -and
        ([string](Coalesce @($publicIdentity.logoUrl, "")) -eq [string](Coalesce @($sellerProfile.logoUrl, ""))) -and
        ([string](Coalesce @($publicIdentity.bannerUrl, "")) -eq [string](Coalesce @($sellerProfile.bannerUrl, ""))) -and
        ([string](Coalesce @($publicIdentity.email, "")) -eq [string](Coalesce @($sellerProfile.email, ""))) -and
        ([string](Coalesce @($publicIdentity.phone, "")) -eq [string](Coalesce @($sellerProfile.phone, ""))) -and
        ([string](Coalesce @($publicIdentity.whatsapp, "")) -eq [string](Coalesce @($sellerProfile.whatsapp, ""))) -and
        ([string](Coalesce @($publicIdentity.websiteUrl, "")) -eq [string](Coalesce @($sellerProfile.websiteUrl, ""))) -and
        ([string](Coalesce @($publicIdentity.instagramUrl, "")) -eq [string](Coalesce @($sellerProfile.instagramUrl, ""))) -and
        ([string](Coalesce @($publicIdentity.tiktokUrl, "")) -eq [string](Coalesce @($sellerProfile.tiktokUrl, ""))) -and
        ([string](Coalesce @($publicIdentity.addressLine1, "")) -eq [string](Coalesce @($sellerProfile.addressLine1, ""))) -and
        ([string](Coalesce @($publicIdentity.addressLine2, "")) -eq [string](Coalesce @($sellerProfile.addressLine2, ""))) -and
        ([string](Coalesce @($publicIdentity.city, "")) -eq [string](Coalesce @($sellerProfile.city, ""))) -and
        ([string](Coalesce @($publicIdentity.province, "")) -eq [string](Coalesce @($sellerProfile.province, ""))) -and
        ([string](Coalesce @($publicIdentity.postalCode, "")) -eq [string](Coalesce @($sellerProfile.postalCode, ""))) -and
        ([string](Coalesce @($publicIdentity.country, "")) -eq [string](Coalesce @($sellerProfile.country, ""))) -and
        (-not ($publicIdentityProps -contains "ownerUserId")) -and
        (-not ($publicIdentityProps -contains "paymentProfile"))
      Set-Entity "sellerStorePublicIdentity" @{
        storeId = $sellerStoreId
        slug = [string]$publicIdentity.slug
        status = [string]$publicIdentity.summary.status.label
        hasBanner = -not [string]::IsNullOrWhiteSpace([string](Coalesce @($publicIdentity.bannerUrl, "")))
        hasWebsite = -not [string]::IsNullOrWhiteSpace([string](Coalesce @($publicIdentity.websiteUrl, "")))
        hasInstagram = -not [string]::IsNullOrWhiteSpace([string](Coalesce @($publicIdentity.instagramUrl, "")))
        hasTikTok = -not [string]::IsNullOrWhiteSpace([string](Coalesce @($publicIdentity.tiktokUrl, "")))
      }
      Set-Result "store_profile_public_identity_sync" $contractOk ("slug=" + [string]$publicIdentity.slug + " status=" + [string]$publicIdentity.summary.status.label)
    } catch {
      Set-Result "store_profile_public_identity_sync" $false $_.Exception.Message
    }
  } else {
    Set-Result "store_profile_public_identity_sync" $false "Skipped: storefront visibility not validated"
  }

  if ($Results["store_profile_public_identity_sync"].pass) {
    try {
      $publicIdentityResp = Invoke-RestMethod -Uri "$BaseApi/store/customization/identity/$sellerStoreSlug" -Method Get -TimeoutSec 30
      $publicIdentity = $publicIdentityResp.data
      $detailResp = Invoke-RestMethod -Uri "$BaseApi/store/products/$sellerProductSlug" -Method Get -TimeoutSec 30
      $detail = $detailResp.data
      $sellerInfoOk =
        (-not [string]::IsNullOrWhiteSpace([string](Coalesce @($detail.sellerInfo.name, "")))) -and
        ([string](Coalesce @($detail.sellerInfo.name, "")) -eq [string](Coalesce @($publicIdentity.name, ""))) -and
        ([string](Coalesce @($detail.sellerInfo.slug, "")) -eq [string]$sellerStoreSlug) -and
        ([string](Coalesce @($detail.sellerInfo.logoUrl, "")) -eq [string](Coalesce @($publicIdentity.logoUrl, ""))) -and
        ([string](Coalesce @($detail.sellerInfo.status.label, "")) -eq "Active")
      Set-Entity "storefrontSellerIdentityCard" @{
        productId = $sellerProductId
        sellerSlug = [string]$detail.sellerInfo.slug
        sellerName = [string]$detail.sellerInfo.name
        sellerStatus = [string]$detail.sellerInfo.status.label
      }
      Set-Result "storefront_seller_identity_consistent" $sellerInfoOk ("productId=" + $sellerProductId + " sellerSlug=" + [string]$detail.sellerInfo.slug + " status=" + [string]$detail.sellerInfo.status.label)
    } catch {
      Set-Result "storefront_seller_identity_consistent" $false $_.Exception.Message
    }
  } else {
    Set-Result "storefront_seller_identity_consistent" $false "Skipped: public identity sync not validated"
  }

  if ($Results["store_profile_public_identity_sync"].pass) {
    try {
      $r = Invoke-WebRequest -Uri "$BaseClient/store/$sellerStoreSlug" -UseBasicParsing -TimeoutSec 20
      Set-Result "store_microsite_slug_route" ($r.StatusCode -eq 200) ("slug=" + $sellerStoreSlug + " status=" + $r.StatusCode)
    } catch {
      Set-Result "store_microsite_slug_route" $false $_.Exception.Message
    }
  } else {
    Set-Result "store_microsite_slug_route" $false "Skipped: public identity sync not validated"
  }

  $catalogBuyerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  if ($Results["storefront_product_visibility_valid"].pass) {
    try {
      $GeneratedCatalogBuyerEmail = "mvfqa_catalog_$Timestamp@local.dev"
      $buyerPassword = "customer123"
      $registerBody = @{ name = "MVF QA Catalog Buyer"; email = $GeneratedCatalogBuyerEmail; password = $buyerPassword } | ConvertTo-Json
      $registerResp = Invoke-RestMethod -Uri "$BaseApi/auth/register" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $registerBody -TimeoutSec 20
      $loginBody = @{ email = $GeneratedCatalogBuyerEmail; password = $buyerPassword } | ConvertTo-Json
      $loginResp = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $loginBody -TimeoutSec 20
      $ok = [bool]($registerResp.success -eq $true -and $loginResp.success -eq $true)
      Set-Entity "sellerCatalogBuyer" @{
        email = $GeneratedCatalogBuyerEmail
      }
      Set-Result "catalog_buyer_auth_ready" $ok ("email=" + $GeneratedCatalogBuyerEmail)
    } catch {
      Set-Result "catalog_buyer_auth_ready" $false $_.Exception.Message
    }
  } else {
    Set-Result "catalog_buyer_auth_ready" $false "Skipped: storefront publish visibility not validated"
  }

  if ($Results["catalog_buyer_auth_ready"].pass) {
    try {
      $cartAddBody = @{ productId = $sellerProductId; quantity = 1 } | ConvertTo-Json
      $cartAddResp = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $cartAddBody -TimeoutSec 20
      $previewResp = Invoke-RestMethod -Uri "$BaseApi/checkout/preview" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
      $preview = $previewResp.data
      $previewGroup = @($preview.groups)[0]
      $previewOk = `
        [int]@($preview.invalidItems).Count -eq 0 -and `
        [int]@($preview.groups).Count -ge 1 -and `
        [bool]$previewGroup.paymentAvailable -and `
        ([string]$previewGroup.paymentMethod -eq "QRIS") -and `
        (-not [string]::IsNullOrWhiteSpace([string]$previewGroup.qrisImageUrl))
      Set-Entity "sellerCatalogCheckoutPreview" @{
        invalidItems = [int]@($preview.invalidItems).Count
        groups = [int]@($preview.groups).Count
        checkoutMode = [string]$preview.checkoutMode
        storeSlug = [string]$previewGroup.storeSlug
        qrisImageUrl = [string]$previewGroup.qrisImageUrl
        merchantName = [string]$previewGroup.merchantName
        accountName = [string]$previewGroup.accountName
      }
      Set-Result "checkout_split_preview_valid" $previewOk ("groups=" + [int]@($preview.groups).Count + " invalidItems=" + [int]@($preview.invalidItems).Count + " checkoutMode=" + [string]$preview.checkoutMode + " qris=" + [string]$previewGroup.qrisImageUrl)

      if (-not $previewOk) { throw "Checkout preview did not return a valid split-checkout-ready state." }

      $createOrderBody = @{
        customer = @{
          name = "MVF QA Catalog Buyer"
          phone = "081234567890"
          address = "QA Street 1"
        }
        shippingDetails = @{
          fullName = "MVF QA Catalog Buyer"
          phoneNumber = "081234567890"
          province = "Singapore"
          city = "Singapore"
          district = "Central"
          postalCode = "01898"
          streetName = "QA Street"
          building = "QA Tower"
          houseNumber = "1"
          otherDetails = "Level 2"
          markAs = "HOME"
        }
      } | ConvertTo-Json -Depth 8
      $prePromoteOrderResp = Invoke-RestMethod -Uri "$BaseApi/checkout/create-multi-store" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $createOrderBody -TimeoutSec 40
      $prePromoteOrder = $prePromoteOrderResp.data
      $prePromoteGroup = @($prePromoteOrder.groups | Where-Object { [int]$_.storeId -eq [int]$sellerStoreId }) | Select-Object -First 1
      $prePromotePayment = if ($null -ne $prePromoteGroup) { $prePromoteGroup.payment } else { $null }
      $oldQrisOk = ($null -ne $prePromotePayment) -and ([string]$prePromotePayment.qrImageUrl -eq $GeneratedSellerPaymentPreviousQrisUrl)
      Set-Result "checkout_payment_setup_uses_old_qris_before_promote" $oldQrisOk ("orderRef=" + [string]$prePromoteOrder.invoiceNo + " qr=" + [string]$prePromotePayment.qrImageUrl)

      $promoteResp = Invoke-RestMethod -Uri "$BaseApi/admin/stores/$sellerStoreId/payment-profile/review" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body (@{ verificationStatus = "ACTIVE" } | ConvertTo-Json) -TimeoutSec 30
      $promotedProfile = $promoteResp.data.paymentProfile
      $promotedPending = $promoteResp.data.pendingRequest
      $promoteOk = ($null -ne $promotedProfile) -and ([int]$promotedProfile.id -ne $GeneratedSellerPaymentPreviousProfileId) -and ([string]$promotedProfile.qrisImageUrl -eq $GeneratedSellerPaymentPendingQrisUrl) -and ($null -eq $promotedPending)
      Set-Result "admin_payment_setup_qris_promote" $promoteOk ("newProfileId=" + [string]$promotedProfile.id + " qris=" + [string]$promotedProfile.qrisImageUrl)

      $secondCartAddBody = @{ productId = $sellerProductId; quantity = 1 } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $secondCartAddBody -TimeoutSec 20
      $orderResp = Invoke-RestMethod -Uri "$BaseApi/checkout/create-multi-store" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $createOrderBody -TimeoutSec 40
      $order = $orderResp.data
      $postPromoteGroup = @($order.groups | Where-Object { [int]$_.storeId -eq [int]$sellerStoreId }) | Select-Object -First 1
      $postPromotePayment = if ($null -ne $postPromoteGroup) { $postPromoteGroup.payment } else { $null }
      $newQrisOk = ($null -ne $postPromotePayment) -and ([string]$postPromotePayment.qrImageUrl -eq $GeneratedSellerPaymentPendingQrisUrl)
      Set-Result "checkout_payment_setup_uses_new_qris_after_promote" $newQrisOk ("orderRef=" + [string]$order.invoiceNo + " qr=" + [string]$postPromotePayment.qrImageUrl)

      $sellerOrderRef = [string]$order.invoiceNo
      $sellerOrderId = [int]$order.orderId
      $sellerCheckoutMode = [string]$order.checkoutMode
      $GeneratedCatalogOrderRef = $sellerOrderRef
      $GeneratedCatalogOrderId = $sellerOrderId
      $GeneratedCatalogCheckoutMode = $sellerCheckoutMode
      Set-Entity "sellerCatalogCheckoutOrder" @{
        orderId = $sellerOrderId
        invoiceNo = $sellerOrderRef
        checkoutMode = $sellerCheckoutMode
        groupCount = [int]@($order.groups).Count
        paymentQrisImageUrl = [string]$postPromotePayment.qrImageUrl
      }
      $orderOk = $sellerOrderId -gt 0 -and (-not [string]::IsNullOrWhiteSpace($sellerOrderRef)) -and [int]@($order.groups).Count -ge 1
      Set-Result "checkout_create_multi_store_valid" $orderOk ("orderId=" + $sellerOrderId + " ref=" + $sellerOrderRef + " checkoutMode=" + $sellerCheckoutMode + " groups=" + [int]@($order.groups).Count)
    } catch {
      if (-not $Results.Contains("checkout_split_preview_valid")) {
        Set-Result "checkout_split_preview_valid" $false $_.Exception.Message
      }
      if (-not $Results.Contains("checkout_payment_setup_uses_old_qris_before_promote")) {
        Set-Result "checkout_payment_setup_uses_old_qris_before_promote" $false $_.Exception.Message
      }
      if (-not $Results.Contains("admin_payment_setup_qris_promote")) {
        Set-Result "admin_payment_setup_qris_promote" $false $_.Exception.Message
      }
      if (-not $Results.Contains("checkout_payment_setup_uses_new_qris_after_promote")) {
        Set-Result "checkout_payment_setup_uses_new_qris_after_promote" $false $_.Exception.Message
      }
      Set-Result "checkout_create_multi_store_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "checkout_split_preview_valid" $false "Skipped: catalog buyer auth unavailable"
    Set-Result "checkout_payment_setup_uses_old_qris_before_promote" $false "Skipped: catalog buyer auth unavailable"
    Set-Result "admin_payment_setup_qris_promote" $false "Skipped: catalog buyer auth unavailable"
    Set-Result "checkout_payment_setup_uses_new_qris_after_promote" $false "Skipped: catalog buyer auth unavailable"
    Set-Result "checkout_create_multi_store_valid" $false "Skipped: catalog buyer auth unavailable"
  }

  if ($Results["checkout_create_multi_store_valid"].pass) {
    try {
      $subordersResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/suborders?keyword=$sellerOrderRef&page=1&limit=20" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $suborderItems = @($subordersResp.data.items)
      $suborder = @($suborderItems | Where-Object { [string]$_.order.orderNumber -eq $sellerOrderRef -or [string]$_.order.orderNumber -eq $sellerOrderRef }) | Select-Object -First 1
      if (-not $suborder) { throw "Suborder was not found in seller list for order $sellerOrderRef." }
      $sellerSuborderId = [int]$suborder.suborderId
      $GeneratedCatalogSuborderId = $sellerSuborderId
      $suborderDetailResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/suborders/$sellerSuborderId" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $suborderDetail = $suborderDetailResp.data
      $ok = $sellerSuborderId -gt 0 -and [int]$subordersResp.data.pagination.total -ge 1 -and [int]$suborderDetail.items[0].productId -eq $sellerProductId
      Set-Entity "sellerCatalogSuborder" @{
        suborderId = $sellerSuborderId
        paymentStatus = [string]$suborder.paymentStatus
        fulfillmentStatus = [string]$suborder.fulfillmentStatus
        orderRef = [string]$suborderDetail.order.orderNumber
      }
      Set-Result "seller_suborder_visibility_valid" $ok ("suborderId=" + $sellerSuborderId + " listTotal=" + [int]$subordersResp.data.pagination.total + " productId=" + [int]$suborderDetail.items[0].productId + " orderRef=" + [string]$suborderDetail.order.orderNumber)
    } catch {
      Set-Result "seller_suborder_visibility_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "seller_suborder_visibility_valid" $false "Skipped: create-multi-store checkout failed"
  }

  if ($Results["checkout_create_multi_store_valid"].pass -and $Results["seller_suborder_visibility_valid"].pass -and $Results["catalog_buyer_auth_ready"].pass -and $Results["admin_login"].pass) {
    try {
      $buyerGroupedResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedCatalogOrderId)/checkout-payment" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $buyerGrouped = $buyerGroupedResp.data
      $buyerSingleGroup = @($buyerGrouped.groups | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId }) | Select-Object -First 1
      if ($null -eq $buyerSingleGroup) { throw "Single-store payment group was not found for the catalog order." }
      $singlePaymentId = [int]$buyerSingleGroup.payment.id
      if ($singlePaymentId -le 0) { throw "Single-store payment id is missing." }

      $buyerPaymentPageOk = `
        ([string]$buyerGrouped.checkoutMode -eq "SINGLE_STORE") -and `
        ([string]$buyerSingleGroup.payment.paymentChannel -eq "QRIS") -and `
        (-not [string]::IsNullOrWhiteSpace([string]$buyerSingleGroup.payment.qrImageUrl)) -and `
        (-not [string]::IsNullOrWhiteSpace([string]$buyerSingleGroup.payment.expiresAt)) -and `
        ([int]$buyerSingleGroup.payment.amount -eq [int]$buyerSingleGroup.totalAmount)
      Set-Entity "singleStoreBuyerPaymentPage" @{
        orderId = [int]$GeneratedCatalogOrderId
        suborderId = [int]$GeneratedCatalogSuborderId
        paymentId = $singlePaymentId
        amount = [int]$buyerSingleGroup.payment.amount
        qrisImageUrl = [string]$buyerSingleGroup.payment.qrImageUrl
      }
      Set-Result "buyer_single_store_payment_page_valid" $buyerPaymentPageOk ("paymentId=" + $singlePaymentId + " amount=" + [int]$buyerSingleGroup.payment.amount + " qris=" + [string]$buyerSingleGroup.payment.qrImageUrl)

      $buyerProofFile = New-QaPngFile "buyer-payment-proof"
      $buyerProofUploadJson = & curl.exe -s -X POST -F "file=@$buyerProofFile" "$BaseApi/upload"
      if (-not $buyerProofUploadJson) { throw "Buyer proof upload returned empty response." }
      $buyerProofUpload = $buyerProofUploadJson | ConvertFrom-Json
      $buyerProofUrl = [string]$buyerProofUpload.data.url
      if ([string]::IsNullOrWhiteSpace($buyerProofUrl)) { throw "Buyer proof upload did not return a URL." }

      $buyerProofPayload = @{
        proofImageUrl = $buyerProofUrl
        senderName = "MVF QA Catalog Buyer"
        senderBankOrWallet = "QA Wallet"
        transferAmount = [int]$buyerSingleGroup.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA single-store payment proof"
      } | ConvertTo-Json
      $buyerProofResp = Invoke-RestMethod -Uri "$BaseApi/payments/$singlePaymentId/proof" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $buyerProofPayload -TimeoutSec 30
      $buyerProofData = $buyerProofResp.data
      $sellerPendingResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payment-review/suborders?paymentStatus=PENDING_CONFIRMATION" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $sellerPendingItems = @($sellerPendingResp.data.items)
      $sellerPendingMatch = @($sellerPendingItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId -and [int]$_.payment.id -eq $singlePaymentId }) | Select-Object -First 1
      $proofOk = `
        ([string]$buyerProofData.status -eq "PENDING_CONFIRMATION") -and `
        ([string]$buyerProofData.proof.reviewStatus -eq "PENDING") -and `
        ($null -ne $sellerPendingMatch)
      Set-Result "buyer_single_store_payment_proof_submit_valid" $proofOk ("paymentId=" + $singlePaymentId + " status=" + [string]$buyerProofData.status + " review=" + [string]$buyerProofData.proof.reviewStatus)

      $rejectPayload = @{ action = "REJECT"; note = "QA single-store reject $Timestamp" } | ConvertTo-Json
      $rejectResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payments/$singlePaymentId/review" -Method Patch -WebSession $sellerSession -ContentType "application/json" -Body $rejectPayload -TimeoutSec 30
      $rejectData = $rejectResp.data
      $buyerGroupedRejectedResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedCatalogOrderId)/checkout-payment" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $buyerGroupedRejected = $buyerGroupedRejectedResp.data
      $buyerSingleRejected = @($buyerGroupedRejected.groups | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId }) | Select-Object -First 1
      $rejectedOk = `
        $proofOk -and `
        ([string]$rejectData.payment.status -eq "REJECTED") -and `
        ([string]$rejectData.payment.proof.reviewStatus -eq "REJECTED") -and `
        ($null -ne $buyerSingleRejected) -and `
        ([string]$buyerSingleRejected.payment.status -eq "REJECTED") -and `
        ([string]$buyerSingleRejected.paymentStatus -eq "UNPAID") -and `
        ([string]$buyerGroupedRejected.paymentStatus -eq "UNPAID")
      Set-Result "buyer_single_store_payment_rejected_visible" $rejectedOk ("paymentId=" + $singlePaymentId + " buyerPayment=" + [string]$buyerSingleRejected.payment.status + " buyerSuborder=" + [string]$buyerSingleRejected.paymentStatus)

      $buyerResubmitFile = New-QaPngFile "buyer-payment-proof-resubmit"
      $buyerResubmitUploadJson = & curl.exe -s -X POST -F "file=@$buyerResubmitFile" "$BaseApi/upload"
      if (-not $buyerResubmitUploadJson) { throw "Buyer resubmit proof upload returned empty response." }
      $buyerResubmitUpload = $buyerResubmitUploadJson | ConvertFrom-Json
      $buyerResubmitUrl = [string]$buyerResubmitUpload.data.url
      if ([string]::IsNullOrWhiteSpace($buyerResubmitUrl)) { throw "Buyer resubmit upload did not return a URL." }

      $buyerResubmitPayload = @{
        proofImageUrl = $buyerResubmitUrl
        senderName = "MVF QA Catalog Buyer Retry"
        senderBankOrWallet = "QA Wallet Retry"
        transferAmount = [int]$buyerSingleRejected.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA single-store resubmit proof"
      } | ConvertTo-Json
      $buyerResubmitResp = Invoke-RestMethod -Uri "$BaseApi/payments/$singlePaymentId/proof" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $buyerResubmitPayload -TimeoutSec 30
      $buyerResubmitData = $buyerResubmitResp.data
      $sellerPendingRetryResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payment-review/suborders?paymentStatus=PENDING_CONFIRMATION" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $sellerPendingRetryItems = @($sellerPendingRetryResp.data.items)
      $sellerPendingRetryMatch = @($sellerPendingRetryItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId -and [int]$_.payment.id -eq $singlePaymentId }) | Select-Object -First 1
      $resubmitOk = `
        $rejectedOk -and `
        ([string]$buyerResubmitData.status -eq "PENDING_CONFIRMATION") -and `
        ([string]$buyerResubmitData.proof.reviewStatus -eq "PENDING") -and `
        ([string]$buyerResubmitData.proof.proofImageUrl -eq [string]$buyerResubmitUrl) -and `
        ($null -ne $sellerPendingRetryMatch) -and `
        ([string]$sellerPendingRetryMatch.payment.proof.proofImageUrl -eq [string]$buyerResubmitUrl)
      Set-Result "buyer_single_store_payment_resubmit_valid" $resubmitOk ("paymentId=" + $singlePaymentId + " review=" + [string]$buyerResubmitData.proof.reviewStatus + " proof=" + [string]$buyerResubmitData.proof.proofImageUrl)

      $approvePayload = @{ action = "APPROVE"; note = "QA single-store approve $Timestamp" } | ConvertTo-Json
      $approveResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/payments/$singlePaymentId/review" -Method Patch -WebSession $sellerSession -ContentType "application/json" -Body $approvePayload -TimeoutSec 30
      $approveData = $approveResp.data

      $buyerGroupedAfterResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedCatalogOrderId)/checkout-payment" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $buyerGroupedAfter = $buyerGroupedAfterResp.data
      $buyerSingleAfter = @($buyerGroupedAfter.groups | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId }) | Select-Object -First 1
      $buyerOrderAfterResp = Invoke-RestMethod -Uri "$BaseApi/store/orders/my/$($GeneratedCatalogOrderId)" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $buyerOrderAfter = $buyerOrderAfterResp.data
      $sellerApprovedDetailResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$sellerStoreId/suborders/$($GeneratedCatalogSuborderId)" -Method Get -WebSession $sellerSession -TimeoutSec 30
      $sellerApprovedDetail = $sellerApprovedDetailResp.data
      $adminAuditSingleResp = Invoke-RestMethod -Uri "$BaseApi/admin/payments/audit/$($GeneratedCatalogOrderId)" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminAuditSingle = $adminAuditSingleResp.data
      $adminSingleSuborder = @($adminAuditSingle.suborders | Where-Object { [int]$_.suborderId -eq [int]$GeneratedCatalogSuborderId }) | Select-Object -First 1
      $adminSinglePayment = if ($adminSingleSuborder) { @($adminSingleSuborder.payments | Where-Object { [int]$_.id -eq $singlePaymentId }) | Select-Object -First 1 } else { $null }

      $approvedOk = `
        $resubmitOk -and `
        ([string]$approveData.payment.status -eq "PAID") -and `
        ([string]$approveData.payment.proof.reviewStatus -eq "APPROVED") -and `
        ([string]$approveData.payment.proof.proofImageUrl -eq [string]$buyerResubmitUrl) -and `
        ($null -ne $buyerSingleAfter) -and `
        ([string]$buyerSingleAfter.payment.status -eq "PAID") -and `
        ([string]$buyerSingleAfter.paymentStatus -eq "PAID") -and `
        ([string]$buyerSingleAfter.fulfillmentStatus -eq "PROCESSING") -and `
        ([string]$buyerGroupedAfter.paymentStatus -eq "PAID") -and `
        ([string]$buyerOrderAfter.paymentStatus -eq "PAID") -and `
        ([string]$buyerOrderAfter.status -eq "processing") -and `
        ([string]$sellerApprovedDetail.paymentStatus -eq "PAID") -and `
        ([string]$sellerApprovedDetail.fulfillmentStatus -eq "PROCESSING") -and `
        ($null -ne $adminSinglePayment) -and `
        ([string]$adminSinglePayment.status -eq "PAID") -and `
        ([string]$adminSingleSuborder.paymentStatus -eq "PAID")

      Set-Entity "singleStorePaymentApproval" @{
        paymentId = $singlePaymentId
        suborderId = [int]$GeneratedCatalogSuborderId
        rejectedProofUrl = [string]$buyerProofUrl
        resubmittedProofUrl = [string]$buyerResubmitUrl
        buyerPaymentStatus = if ($buyerSingleAfter) { [string]$buyerSingleAfter.payment.status } else { $null }
        buyerSuborderPaymentStatus = if ($buyerSingleAfter) { [string]$buyerSingleAfter.paymentStatus } else { $null }
        buyerSuborderFulfillmentStatus = if ($buyerSingleAfter) { [string]$buyerSingleAfter.fulfillmentStatus } else { $null }
        buyerParentPaymentStatus = [string]$buyerGroupedAfter.paymentStatus
        buyerParentOrderStatus = [string]$buyerOrderAfter.status
        sellerPaymentStatus = [string]$sellerApprovedDetail.paymentSummary.status
        sellerFulfillmentStatus = [string]$sellerApprovedDetail.fulfillmentStatus
        adminPaymentStatus = if ($adminSinglePayment) { [string]$adminSinglePayment.status } else { $null }
      }
      Set-Result "seller_single_store_payment_approve_valid" $approvedOk ("paymentId=" + $singlePaymentId + " buyerParent=" + [string]$buyerGroupedAfter.paymentStatus + " sellerPayment=" + [string]$sellerApprovedDetail.paymentSummary.status)
    } catch {
      if (-not $Results.Contains("buyer_single_store_payment_page_valid")) {
        Set-Result "buyer_single_store_payment_page_valid" $false $_.Exception.Message
      }
      if (-not $Results.Contains("buyer_single_store_payment_proof_submit_valid")) {
        Set-Result "buyer_single_store_payment_proof_submit_valid" $false $_.Exception.Message
      }
      if (-not $Results.Contains("buyer_single_store_payment_rejected_visible")) {
        Set-Result "buyer_single_store_payment_rejected_visible" $false $_.Exception.Message
      }
      if (-not $Results.Contains("buyer_single_store_payment_resubmit_valid")) {
        Set-Result "buyer_single_store_payment_resubmit_valid" $false $_.Exception.Message
      }
      Set-Result "seller_single_store_payment_approve_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "buyer_single_store_payment_page_valid" $false "Skipped: single-store checkout, seller scope, buyer auth, or admin login unavailable"
    Set-Result "buyer_single_store_payment_proof_submit_valid" $false "Skipped: single-store checkout, seller scope, buyer auth, or admin login unavailable"
    Set-Result "buyer_single_store_payment_rejected_visible" $false "Skipped: single-store checkout, seller scope, buyer auth, or admin login unavailable"
    Set-Result "buyer_single_store_payment_resubmit_valid" $false "Skipped: single-store checkout, seller scope, buyer auth, or admin login unavailable"
    Set-Result "seller_single_store_payment_approve_valid" $false "Skipped: single-store checkout, seller scope, buyer auth, or admin login unavailable"
  }

  if ($Results["catalog_buyer_auth_ready"].pass -and $Results["seller_suborder_visibility_valid"].pass) {
    try {
      $expiryCartBody = @{ productId = [int]$sellerProductId; quantity = 1 } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $expiryCartBody -TimeoutSec 20
      $expiryCheckoutResp = Invoke-RestMethod -Uri "$BaseApi/checkout/create-multi-store" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $createOrderBody -TimeoutSec 30
      $expiryOrder = $expiryCheckoutResp.data
      $expiryOrderId = [int]$expiryOrder.orderId
      $expiryGroupedResp = Invoke-RestMethod -Uri "$BaseApi/orders/$expiryOrderId/checkout-payment" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $expiryGrouped = $expiryGroupedResp.data
      $expiryGroup = @($expiryGrouped.groups | Where-Object { [int]$_.storeId -eq [int]$sellerStoreId }) | Select-Object -First 1
      if ($null -eq $expiryGroup) { throw "Expiry checkout group was not found." }
      $expiryPaymentId = [int]$expiryGroup.payment.id
      if ($expiryPaymentId -le 0) { throw "Expiry checkout payment id missing." }
      $deadlineVisibleOk = `
        ([string]$expiryGrouped.checkoutMode -eq "SINGLE_STORE") -and `
        ([string]$expiryGroup.payment.status -eq "CREATED") -and `
        (-not [string]::IsNullOrWhiteSpace([string]$expiryGroup.payment.expiresAt))
      Set-Result "buyer_single_store_payment_deadline_visible" $deadlineVisibleOk ("orderId=" + $expiryOrderId + " paymentId=" + $expiryPaymentId + " expiresAt=" + [string]$expiryGroup.payment.expiresAt)

      $expirePaymentScript = @'
const dotenv = require("dotenv");
dotenv.config({ path: './.env', quiet: true });
dotenv.config({ path: '../.env', quiet: true });
const mysql = require("mysql2/promise");

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: typeof process.env.DB_PASS === "string" ? process.env.DB_PASS : "",
    database: process.env.DB_NAME || "ecommerce_dev",
  });

  await conn.query(
    "UPDATE payments SET expires_at = '2001-01-01 00:00:00' WHERE id = ?",
    [__PAYMENT_ID__]
  );
  await conn.query(
    "UPDATE suborders SET expires_at = '2001-01-01 00:00:00' WHERE id = ?",
    [__SUBORDER_ID__]
  );
  await conn.end();
  console.log(JSON.stringify({ ok: true }));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
'@
      $expirePaymentScript = $expirePaymentScript.Replace("__PAYMENT_ID__", [string]$expiryPaymentId)
      $expirePaymentScript = $expirePaymentScript.Replace("__SUBORDER_ID__", [string]([int]$expiryGroup.suborderId))
      $null = Invoke-ServerNodeJson $expirePaymentScript

      $expiredGroupedResp = Invoke-RestMethod -Uri "$BaseApi/orders/$expiryOrderId/checkout-payment" -Method Get -WebSession $catalogBuyerSession -TimeoutSec 30
      $expiredGrouped = $expiredGroupedResp.data
      $expiredGroup = @($expiredGrouped.groups | Where-Object { [int]$_.suborderId -eq [int]$expiryGroup.suborderId }) | Select-Object -First 1
      $expiredOk = `
        $deadlineVisibleOk -and `
        ($null -ne $expiredGroup) -and `
        ([string]$expiredGroup.payment.status -eq "EXPIRED") -and `
        ([string]$expiredGroup.paymentStatus -eq "EXPIRED")

      $expiredProofFile = New-QaPngFile "buyer-payment-proof-expired"
      $expiredProofUploadJson = & curl.exe -s -X POST -F "file=@$expiredProofFile" "$BaseApi/upload"
      if (-not $expiredProofUploadJson) { throw "Expired proof upload returned empty response." }
      $expiredProofUpload = $expiredProofUploadJson | ConvertFrom-Json
      $expiredProofUrl = [string]$expiredProofUpload.data.url
      if ([string]::IsNullOrWhiteSpace($expiredProofUrl)) { throw "Expired proof upload did not return a URL." }

      $expiredProofPayload = @{
        proofImageUrl = $expiredProofUrl
        senderName = "MVF QA Catalog Buyer"
        senderBankOrWallet = "QA Wallet"
        transferAmount = [int]$expiredGroup.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA expired proof should fail"
      } | ConvertTo-Json

      $proofBlocked = $false
      $proofBlockedMessage = ""
      try {
        $null = Invoke-RestMethod -Uri "$BaseApi/payments/$expiryPaymentId/proof" -Method Post -WebSession $catalogBuyerSession -ContentType "application/json" -Body $expiredProofPayload -TimeoutSec 30
      } catch {
        $proofBlockedMessage = [string]$_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
          try {
            $proofErrorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            $proofBlockedMessage = [string]$proofErrorJson.message
          } catch {
          }
        }
        $proofBlocked = $proofBlockedMessage -match "expired"
      }

      Set-Entity "singleStorePaymentExpiry" @{
        orderId = $expiryOrderId
        suborderId = [int]$expiredGroup.suborderId
        paymentId = $expiryPaymentId
        paymentStatus = if ($expiredGroup) { [string]$expiredGroup.payment.status } else { $null }
        suborderPaymentStatus = if ($expiredGroup) { [string]$expiredGroup.paymentStatus } else { $null }
        proofBlockedMessage = $proofBlockedMessage
      }
      Set-Result "buyer_single_store_payment_expiry_valid" ($expiredOk -and $proofBlocked) ("paymentId=" + $expiryPaymentId + " payment=" + [string]$expiredGroup.payment.status + " suborder=" + [string]$expiredGroup.paymentStatus + " blocked=" + $proofBlocked)
    } catch {
      if (-not $Results.Contains("buyer_single_store_payment_deadline_visible")) {
        Set-Result "buyer_single_store_payment_deadline_visible" $false $_.Exception.Message
      }
      Set-Result "buyer_single_store_payment_expiry_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "buyer_single_store_payment_deadline_visible" $false "Skipped: single-store checkout or buyer auth unavailable"
    Set-Result "buyer_single_store_payment_expiry_valid" $false "Skipped: single-store checkout or buyer auth unavailable"
  }

  $multiStoreSeed = $null
  $multiStoreSellerPassword = "qa-seller-multi-123"
  $multiStoreStoreA = $null
  $multiStoreStoreB = $null
  $multiStoreSellerASession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $multiStoreSellerBSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $multiStoreBuyerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $multiStoreInvalidBuyerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $multiStoreSuborderA = $null
  $multiStoreSuborderB = $null
  $multiStoreInvalidProductEntity = $null

  try {
    $multiStoreSeedScript = @'
const dotenv = require("dotenv");
dotenv.config({ path: './.env', quiet: true });
dotenv.config({ path: '../.env', quiet: true });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

(async () => {
  const sellerPassword = '__SELLER_PASSWORD__';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: typeof process.env.DB_PASS === 'string' ? process.env.DB_PASS : '',
    database: process.env.DB_NAME || 'ecommerce_dev',
  });

  const [stores] = await conn.query(
    `
      SELECT
        s.id AS storeId,
        s.name AS storeName,
        s.slug AS storeSlug,
        s.owner_user_id AS ownerUserId,
        u.email AS ownerEmail,
        p.id AS productId,
        p.name AS productName,
        p.slug AS productSlug,
        p.price AS price,
        p.sale_price AS salePrice,
        p.stock AS stock
      FROM stores s
      JOIN users u ON u.id = s.owner_user_id
      JOIN store_payment_profiles spp
        ON spp.store_id = s.id
       AND spp.is_active = 1
       AND UPPER(COALESCE(spp.verification_status, '')) = 'ACTIVE'
      JOIN (
        SELECT picked.*
        FROM products picked
        JOIN (
          SELECT store_id, MIN(id) AS min_id
          FROM products
          WHERE status = 'active' AND published = 1
          GROUP BY store_id
        ) selected ON selected.min_id = picked.id
      ) p ON p.store_id = s.id
      WHERE s.status = 'ACTIVE'
        AND s.slug <> 'super-admin-1'
      ORDER BY s.id ASC
      LIMIT 2
    `
  );

  if (!Array.isArray(stores) || stores.length < 2) {
    throw new Error('Expected at least 2 active public stores with active payment profiles.');
  }

  const ownerEmails = stores.map((row) => row.ownerEmail).filter(Boolean);
  if (ownerEmails.length < 2) {
    throw new Error('Expected owner emails for multi-store seller bootstrap.');
  }

  const passwordHash = await bcrypt.hash(sellerPassword, 10);
  await conn.query(
    `UPDATE users SET password = ? WHERE email IN (${ownerEmails.map(() => '?').join(',')})`,
    [passwordHash, ...ownerEmails]
  );

  const [drafts] = await conn.query(
    `
      SELECT p.id AS productId, p.slug AS productSlug, p.store_id AS storeId, s.slug AS storeSlug
      FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE p.status = 'draft'
      ORDER BY p.id DESC
      LIMIT 1
    `
  );

  await conn.end();

  console.log(JSON.stringify({
    sellerPassword,
    stores,
    invalidProduct: Array.isArray(drafts) && drafts.length > 0 ? drafts[0] : null,
  }));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
'@
    $multiStoreSeedScript = $multiStoreSeedScript.Replace("__SELLER_PASSWORD__", $multiStoreSellerPassword)
    $multiStoreSeed = Invoke-ServerNodeJson $multiStoreSeedScript

    $multiStoreStores = @($multiStoreSeed.stores)
    if ($multiStoreStores.Count -lt 2) { throw "Expected at least 2 multi-store candidates." }
    $multiStoreStoreA = $multiStoreStores[0]
    $multiStoreStoreB = $multiStoreStores[1]
    $GeneratedMultiStoreStoreAId = [int]$multiStoreStoreA.storeId
    $GeneratedMultiStoreStoreASlug = [string]$multiStoreStoreA.storeSlug
    $GeneratedMultiStoreStoreBId = [int]$multiStoreStoreB.storeId
    $GeneratedMultiStoreStoreBSlug = [string]$multiStoreStoreB.storeSlug
    $GeneratedMultiStoreProductAId = [int]$multiStoreStoreA.productId
    $GeneratedMultiStoreProductASlug = [string]$multiStoreStoreA.productSlug
    $GeneratedMultiStoreProductBId = [int]$multiStoreStoreB.productId
    $GeneratedMultiStoreProductBSlug = [string]$multiStoreStoreB.productSlug
    if ($multiStoreSeed.invalidProduct) {
      $multiStoreInvalidProductEntity = @{
        productId = [int]$multiStoreSeed.invalidProduct.productId
        productSlug = [string]$multiStoreSeed.invalidProduct.productSlug
        storeId = [int]$multiStoreSeed.invalidProduct.storeId
        storeSlug = [string]$multiStoreSeed.invalidProduct.storeSlug
      }
    }
    Set-Entity "trueMultiStoreSeed" @{
      sellerPassword = [string]$multiStoreSeed.sellerPassword
      storeA = @{
        storeId = [int]$multiStoreStoreA.storeId
        storeSlug = [string]$multiStoreStoreA.storeSlug
        ownerEmail = [string]$multiStoreStoreA.ownerEmail
        productId = [int]$multiStoreStoreA.productId
        productSlug = [string]$multiStoreStoreA.productSlug
      }
      storeB = @{
        storeId = [int]$multiStoreStoreB.storeId
        storeSlug = [string]$multiStoreStoreB.storeSlug
        ownerEmail = [string]$multiStoreStoreB.ownerEmail
        productId = [int]$multiStoreStoreB.productId
        productSlug = [string]$multiStoreStoreB.productSlug
      }
      invalidProduct = $multiStoreInvalidProductEntity
    }
    $seedOk = `
      [int]$multiStoreStoreA.storeId -gt 0 -and `
      [int]$multiStoreStoreB.storeId -gt 0 -and `
      [int]$multiStoreStoreA.productId -gt 0 -and `
      [int]$multiStoreStoreB.productId -gt 0 -and `
      (-not [string]::IsNullOrWhiteSpace([string]$multiStoreStoreA.ownerEmail)) -and `
      (-not [string]::IsNullOrWhiteSpace([string]$multiStoreStoreB.ownerEmail))
    Set-Result "true_multi_store_seed_ready" $seedOk ("storeA=" + [string]$multiStoreStoreA.storeSlug + " productA=" + [string]$multiStoreStoreA.productId + " storeB=" + [string]$multiStoreStoreB.storeSlug + " productB=" + [string]$multiStoreStoreB.productId)
  } catch {
    Set-Result "true_multi_store_seed_ready" $false $_.Exception.Message
  }

  if ($Results["true_multi_store_seed_ready"].pass) {
    try {
      $sellerALoginBody = @{ email = [string]$multiStoreStoreA.ownerEmail; password = $multiStoreSellerPassword } | ConvertTo-Json
      $sellerBLoginBody = @{ email = [string]$multiStoreStoreB.ownerEmail; password = $multiStoreSellerPassword } | ConvertTo-Json
      $sellerALoginResp = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $multiStoreSellerASession -ContentType "application/json" -Body $sellerALoginBody -TimeoutSec 20
      $sellerBLoginResp = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $multiStoreSellerBSession -ContentType "application/json" -Body $sellerBLoginBody -TimeoutSec 20
      $sellerAStoreResp = Invoke-RestMethod -Uri "$BaseApi/stores/mine" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 20
      $sellerBStoreResp = Invoke-RestMethod -Uri "$BaseApi/stores/mine" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 20
      $sellerAOk = [int]$sellerAStoreResp.data.id -eq [int]$multiStoreStoreA.storeId -and [string]$sellerAStoreResp.data.slug -eq [string]$multiStoreStoreA.storeSlug
      $sellerBOk = [int]$sellerBStoreResp.data.id -eq [int]$multiStoreStoreB.storeId -and [string]$sellerBStoreResp.data.slug -eq [string]$multiStoreStoreB.storeSlug
      Set-Entity "trueMultiStoreSellerSessions" @{
        sellerA = @{
          email = [string]$multiStoreStoreA.ownerEmail
          storeId = [int]$sellerAStoreResp.data.id
          storeSlug = [string]$sellerAStoreResp.data.slug
        }
        sellerB = @{
          email = [string]$multiStoreStoreB.ownerEmail
          storeId = [int]$sellerBStoreResp.data.id
          storeSlug = [string]$sellerBStoreResp.data.slug
        }
      }
      Set-Result "true_multi_store_seller_sessions_ready" ($sellerAOk -and $sellerBOk) ("sellerA=" + [string]$sellerAStoreResp.data.slug + " sellerB=" + [string]$sellerBStoreResp.data.slug)
    } catch {
      Set-Result "true_multi_store_seller_sessions_ready" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_seller_sessions_ready" $false "Skipped: multi-store seed failed"
  }

  if ($Results["true_multi_store_seed_ready"].pass -and $multiStoreSeed.invalidProduct) {
    try {
      $GeneratedMultiStoreBuyerEmail = "mvfqa_multistore_invalid_$Timestamp@local.dev"
      $invalidBuyerPassword = "customer123"
      $invalidRegisterBody = @{ name = "MVF QA Invalid Buyer"; email = $GeneratedMultiStoreBuyerEmail; password = $invalidBuyerPassword } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/auth/register" -Method Post -WebSession $multiStoreInvalidBuyerSession -ContentType "application/json" -Body $invalidRegisterBody -TimeoutSec 20
      $invalidLoginBody = @{ email = $GeneratedMultiStoreBuyerEmail; password = $invalidBuyerPassword } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $multiStoreInvalidBuyerSession -ContentType "application/json" -Body $invalidLoginBody -TimeoutSec 20
      $invalidCartBody = @{ productId = [int]$multiStoreSeed.invalidProduct.productId; quantity = 1 } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $multiStoreInvalidBuyerSession -ContentType "application/json" -Body $invalidCartBody -TimeoutSec 20
      $invalidPreviewResp = Invoke-RestMethod -Uri "$BaseApi/checkout/preview" -Method Post -WebSession $multiStoreInvalidBuyerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
      $invalidPreview = $invalidPreviewResp.data
      $invalidMatches = @($invalidPreview.invalidItems | Where-Object { [int]$_.productId -eq [int]$multiStoreSeed.invalidProduct.productId })
      $invalidReason = if ($invalidMatches.Count -gt 0) { [string]$invalidMatches[0].reason } else { "none" }
      $invalidOk = $invalidMatches.Count -ge 1 -and [string]$invalidMatches[0].reason -eq "PRODUCT_NOT_PUBLIC"
      Set-Entity "trueMultiStoreInvalidPreview" @{
        buyerEmail = $GeneratedMultiStoreBuyerEmail
        invalidProductId = [int]$multiStoreSeed.invalidProduct.productId
        invalidProductSlug = [string]$multiStoreSeed.invalidProduct.productSlug
        invalidItemCount = [int]@($invalidPreview.invalidItems).Count
        reason = if ($invalidMatches.Count -gt 0) { [string]$invalidMatches[0].reason } else { $null }
      }
      Set-Result "true_multi_store_invalid_unpublished_blocked" $invalidOk ("invalidItems=" + [int]@($invalidPreview.invalidItems).Count + " productId=" + [int]$multiStoreSeed.invalidProduct.productId + " reason=" + $invalidReason)
    } catch {
      Set-Result "true_multi_store_invalid_unpublished_blocked" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_invalid_unpublished_blocked" $false "Skipped: no deterministic invalid product candidate available"
  }

  if ($Results["true_multi_store_seed_ready"].pass) {
    try {
      $GeneratedMultiStoreBuyerEmail = "mvfqa_multistore_$Timestamp@local.dev"
      $multiStoreBuyerPassword = "customer123"
      $buyerRegisterBody = @{ name = "MVF QA Multi Store Buyer"; email = $GeneratedMultiStoreBuyerEmail; password = $multiStoreBuyerPassword } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/auth/register" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $buyerRegisterBody -TimeoutSec 20
      $buyerLoginBody = @{ email = $GeneratedMultiStoreBuyerEmail; password = $multiStoreBuyerPassword } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/auth/login" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $buyerLoginBody -TimeoutSec 20
      Set-Entity "trueMultiStoreBuyer" @{ email = $GeneratedMultiStoreBuyerEmail }
      Set-Result "true_multi_store_buyer_auth_ready" $true ("email=" + $GeneratedMultiStoreBuyerEmail)
    } catch {
      Set-Result "true_multi_store_buyer_auth_ready" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_buyer_auth_ready" $false "Skipped: multi-store seed failed"
  }

  if ($Results["true_multi_store_buyer_auth_ready"].pass) {
    try {
      $addStoreABody = @{ productId = [int]$multiStoreStoreA.productId; quantity = 1 } | ConvertTo-Json
      $addStoreBBody = @{ productId = [int]$multiStoreStoreB.productId; quantity = 1 } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $addStoreABody -TimeoutSec 20
      $null = Invoke-RestMethod -Uri "$BaseApi/cart/add" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $addStoreBBody -TimeoutSec 20
      $multiCartResp = Invoke-RestMethod -Uri "$BaseApi/cart" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 20
      $multiCartItems = @($multiCartResp.Products)
      $distinctStoreIds = @($multiCartItems | ForEach-Object { [int]$_.storeId } | Sort-Object -Unique)
      $cartOk = $multiCartItems.Count -ge 2 -and $distinctStoreIds.Count -ge 2
      Set-Entity "trueMultiStoreCart" @{
        itemCount = $multiCartItems.Count
        distinctStoreIds = $distinctStoreIds
        productIds = @($multiCartItems | ForEach-Object { [int]$_.id })
      }
      Set-Result "true_multi_store_cart_contains_two_stores" $cartOk ("items=" + $multiCartItems.Count + " distinctStores=" + $distinctStoreIds.Count)
    } catch {
      Set-Result "true_multi_store_cart_contains_two_stores" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_cart_contains_two_stores" $false "Skipped: multi-store buyer auth unavailable"
  }

  if ($Results["true_multi_store_cart_contains_two_stores"].pass) {
    try {
      $previewResp = Invoke-RestMethod -Uri "$BaseApi/checkout/preview" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
      $preview = $previewResp.data
      $previewGroups = @($preview.groups)
      $GeneratedMultiStoreCheckoutMode = [string]$preview.checkoutMode
      $GeneratedMultiStorePreviewStoreCount = [int]$previewGroups.Count
      $groupSlugs = @($previewGroups | ForEach-Object { [string]$_.storeSlug })
      $qrisReadyGroups = @(
        $previewGroups | Where-Object {
          [bool]$_.paymentAvailable -and
          [string]$_.paymentMethod -eq "QRIS" -and
          (-not [string]::IsNullOrWhiteSpace([string]$_.qrisImageUrl))
        }
      )
      $previewOk = `
        ([string]$preview.checkoutMode -eq "MULTI_STORE") -and `
        ([int]@($preview.invalidItems).Count -eq 0) -and `
        ($previewGroups.Count -ge 2) -and `
        ($groupSlugs -contains [string]$multiStoreStoreA.storeSlug) -and `
        ($groupSlugs -contains [string]$multiStoreStoreB.storeSlug) -and `
        (@($previewGroups | Where-Object { [bool]$_.paymentAvailable }).Count -eq $previewGroups.Count) -and `
        ($qrisReadyGroups.Count -eq $previewGroups.Count)
      Set-Entity "trueMultiStorePreview" @{
        checkoutMode = [string]$preview.checkoutMode
        storeCount = [int]$previewGroups.Count
        invalidItemCount = [int]@($preview.invalidItems).Count
        groupStoreSlugs = $groupSlugs
        groups = @($previewGroups | ForEach-Object {
          @{
            storeSlug = [string]$_.storeSlug
            qrisImageUrl = [string]$_.qrisImageUrl
            merchantName = [string]$_.merchantName
            accountName = [string]$_.accountName
          }
        })
      }
      Set-Result "true_multi_store_preview_split_valid" $previewOk ("groups=" + [int]$previewGroups.Count + " invalidItems=" + [int]@($preview.invalidItems).Count + " checkoutMode=" + [string]$preview.checkoutMode + " qrisReady=" + [int]$qrisReadyGroups.Count)
    } catch {
      Set-Result "true_multi_store_preview_split_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_preview_split_valid" $false "Skipped: cart is not split across two stores"
  }

  if ($Results["true_multi_store_preview_split_valid"].pass -and $Results["admin_login"].pass) {
    try {
      $adminProfilesResp = Invoke-RestMethod -Uri "$BaseApi/admin/stores/payment-profiles" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminProfiles = @($adminProfilesResp.data)
      $candidateStores = @(
        $adminProfiles | Where-Object {
          (
            [int]$_.store.id -eq [int]$multiStoreStoreA.storeId -or
            [int]$_.store.id -eq [int]$multiStoreStoreB.storeId
          ) -and $null -eq $_.pendingRequest
        }
      )
      $blockedStore = $candidateStores | Select-Object -First 1
      if ($null -eq $blockedStore) {
        throw "No safe active store without pending request was available for invalid payment-profile blocker validation."
      }

      $restoreNeeded = $false
      try {
        $currentProfile = $blockedStore.paymentProfile
        if ($null -eq $currentProfile) { throw "Active payment profile was not found for blocker validation." }
        if (-not [bool]$currentProfile.isActive -or [string]$currentProfile.verificationStatus -ne "ACTIVE") {
          throw "Chosen blocker store is not using an ACTIVE payment profile."
        }

        $null = Invoke-RestMethod -Uri "$BaseApi/admin/stores/$($blockedStore.store.id)/payment-profile/review" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body (@{ verificationStatus = "INACTIVE" } | ConvertTo-Json) -TimeoutSec 30
        $restoreNeeded = $true

        $blockedPreviewResp = Invoke-RestMethod -Uri "$BaseApi/checkout/preview" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body "{}" -TimeoutSec 30
        $blockedPreview = $blockedPreviewResp.data
        $blockedGroup = @($blockedPreview.groups | Where-Object { [int]$_.storeId -eq [int]$blockedStore.store.id }) | Select-Object -First 1
        $blockedOk = `
          ($null -ne $blockedGroup) -and `
          (-not [bool]$blockedGroup.paymentAvailable) -and `
          ($null -eq $blockedGroup.paymentMethod) -and `
          ([string]$blockedGroup.paymentProfileStatus -eq "INACTIVE")

        Set-Entity "trueMultiStoreInvalidPaymentProfile" @{
          storeId = [int]$blockedStore.store.id
          storeSlug = [string]$blockedStore.store.slug
          paymentProfileStatus = if ($blockedGroup) { [string]$blockedGroup.paymentProfileStatus } else { $null }
          warning = if ($blockedGroup) { [string]$blockedGroup.warning } else { $null }
        }
        Set-Result "true_multi_store_invalid_payment_profile_blocked" $blockedOk ("store=" + [string]$blockedStore.store.slug + " status=" + [string]$blockedGroup.paymentProfileStatus + " paymentAvailable=" + [string]$blockedGroup.paymentAvailable)
      } finally {
        if ($restoreNeeded) {
          $null = Invoke-RestMethod -Uri "$BaseApi/admin/stores/$($blockedStore.store.id)/payment-profile/review" -Method Patch -WebSession $adminSession -ContentType "application/json" -Body (@{ verificationStatus = "ACTIVE" } | ConvertTo-Json) -TimeoutSec 30
        }
      }
    } catch {
      Set-Result "true_multi_store_invalid_payment_profile_blocked" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_invalid_payment_profile_blocked" $false "Skipped: multi-store preview or admin login unavailable"
  }

  if ($Results["true_multi_store_preview_split_valid"].pass) {
    try {
      $createOrderBody = @{
        customer = @{
          name = "MVF QA Multi Store Buyer"
          phone = "081234567890"
          address = "QA Multi Store Street 1"
        }
        shippingDetails = @{
          fullName = "MVF QA Multi Store Buyer"
          phoneNumber = "081234567890"
          province = "Singapore"
          city = "Singapore"
          district = "Central"
          postalCode = "01898"
          streetName = "QA Multi Street"
          building = "QA Multi Tower"
          houseNumber = "22"
          otherDetails = "Level 5"
          markAs = "HOME"
        }
      } | ConvertTo-Json -Depth 8
      $orderResp = Invoke-RestMethod -Uri "$BaseApi/checkout/create-multi-store" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $createOrderBody -TimeoutSec 40
      $order = $orderResp.data
      $orderGroups = @($order.groups)
      $GeneratedMultiStoreParentOrderId = [int]$order.orderId
      $GeneratedMultiStoreParentOrderRef = [string]$order.invoiceNo
      $GeneratedMultiStoreCheckoutMode = [string]$order.checkoutMode
      $GeneratedMultiStoreSuborderCount = [int]$orderGroups.Count
      $multiStoreSuborderA = @($orderGroups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $multiStoreSuborderB = @($orderGroups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      $paymentsReady = @(
        $orderGroups | Where-Object {
          $null -ne $_.payment -and
          [string]$_.payment.paymentChannel -eq "QRIS" -and
          (-not [string]::IsNullOrWhiteSpace([string]$_.payment.qrImageUrl))
        }
      )
      $GeneratedMultiStoreSuborderAId = if ($multiStoreSuborderA) { [int]$multiStoreSuborderA.suborderId } else { $null }
      $GeneratedMultiStoreSuborderBId = if ($multiStoreSuborderB) { [int]$multiStoreSuborderB.suborderId } else { $null }
      $createOk = `
        ([int]$order.orderId -gt 0) -and `
        (-not [string]::IsNullOrWhiteSpace([string]$order.invoiceNo)) -and `
        ([string]$order.checkoutMode -eq "MULTI_STORE") -and `
        ($orderGroups.Count -ge 2) -and `
        ($null -ne $multiStoreSuborderA) -and `
        ($null -ne $multiStoreSuborderB) -and `
        ([int]$multiStoreSuborderA.suborderId -gt 0) -and `
        ([int]$multiStoreSuborderB.suborderId -gt 0) -and `
        ($paymentsReady.Count -eq $orderGroups.Count)
      Set-Entity "trueMultiStoreOrder" @{
        orderId = [int]$order.orderId
        invoiceNo = [string]$order.invoiceNo
        checkoutMode = [string]$order.checkoutMode
        suborderCount = [int]$orderGroups.Count
        groups = @($orderGroups | ForEach-Object {
          @{
            suborderId = [int]$_.suborderId
            suborderNumber = [string]$_.suborderNumber
            storeId = [int]$_.storeId
            storeSlug = [string]$_.storeSlug
            productIds = @($_.items | ForEach-Object { [int]$_.productId })
            qrisImageUrl = if ($_.payment) { [string]$_.payment.qrImageUrl } else { $null }
            merchantName = if ($_.payment) { [string]$_.payment.merchantName } else { $null }
            accountName = if ($_.payment) { [string]$_.payment.accountName } else { $null }
          }
        })
      }
      Set-Result "true_multi_store_create_checkout_valid" $createOk ("orderId=" + [int]$order.orderId + " ref=" + [string]$order.invoiceNo + " checkoutMode=" + [string]$order.checkoutMode + " suborders=" + [int]$orderGroups.Count + " qrisPayments=" + [int]$paymentsReady.Count)
    } catch {
      Set-Result "true_multi_store_create_checkout_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_create_checkout_valid" $false "Skipped: multi-store preview failed"
  }

  if ($Results["true_multi_store_create_checkout_valid"].pass -and $Results["true_multi_store_seller_sessions_ready"].pass) {
    try {
      $sellerAListResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/suborders?keyword=$($GeneratedMultiStoreParentOrderRef)&page=1&limit=20" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerAItems = @($sellerAListResp.data.items)
      $sellerAOwn = @($sellerAItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId }) | Select-Object -First 1
      $sellerADetailResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/suborders/$($GeneratedMultiStoreSuborderAId)" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerADetail = $sellerADetailResp.data
      $sellerACrossBlocked = $false
      try {
        $null = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/suborders/$($GeneratedMultiStoreSuborderBId)" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      } catch {
        $sellerACrossBlocked = ($_.Exception.Message -like "*404*") -or ($_.Exception.Message -like "*Suborder not found*")
      }
      $sellerAOk = `
        ($sellerAItems.Count -eq 1) -and `
        ($null -ne $sellerAOwn) -and `
        ([int]$sellerADetail.scope.storeId -eq [int]$multiStoreStoreA.storeId) -and `
        (@($sellerADetail.items | Where-Object { [int]$_.productId -eq [int]$multiStoreStoreA.productId }).Count -ge 1) -and `
        (@($sellerADetail.items | Where-Object { [int]$_.productId -eq [int]$multiStoreStoreB.productId }).Count -eq 0) -and `
        $sellerACrossBlocked
      Set-Entity "trueMultiStoreSellerAScope" @{
        listCount = $sellerAItems.Count
        suborderId = [int]$GeneratedMultiStoreSuborderAId
        orderRef = [string]$sellerADetail.order.orderNumber
        blockedForeignSuborder = $sellerACrossBlocked
      }
      Set-Result "true_multi_store_seller_a_scope_valid" $sellerAOk ("listCount=" + $sellerAItems.Count + " suborderId=" + [int]$GeneratedMultiStoreSuborderAId + " blockedForeign=" + [string]$sellerACrossBlocked)
    } catch {
      Set-Result "true_multi_store_seller_a_scope_valid" $false $_.Exception.Message
    }

    try {
      $sellerBListResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/suborders?keyword=$($GeneratedMultiStoreParentOrderRef)&page=1&limit=20" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      $sellerBItems = @($sellerBListResp.data.items)
      $sellerBOwn = @($sellerBItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderBId }) | Select-Object -First 1
      $sellerBDetailResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/suborders/$($GeneratedMultiStoreSuborderBId)" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      $sellerBDetail = $sellerBDetailResp.data
      $sellerBCrossBlocked = $false
      try {
        $null = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/suborders/$($GeneratedMultiStoreSuborderAId)" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      } catch {
        $sellerBCrossBlocked = ($_.Exception.Message -like "*404*") -or ($_.Exception.Message -like "*Suborder not found*")
      }
      $sellerBOk = `
        ($sellerBItems.Count -eq 1) -and `
        ($null -ne $sellerBOwn) -and `
        ([int]$sellerBDetail.scope.storeId -eq [int]$multiStoreStoreB.storeId) -and `
        (@($sellerBDetail.items | Where-Object { [int]$_.productId -eq [int]$multiStoreStoreB.productId }).Count -ge 1) -and `
        (@($sellerBDetail.items | Where-Object { [int]$_.productId -eq [int]$multiStoreStoreA.productId }).Count -eq 0) -and `
        $sellerBCrossBlocked
      Set-Entity "trueMultiStoreSellerBScope" @{
        listCount = $sellerBItems.Count
        suborderId = [int]$GeneratedMultiStoreSuborderBId
        orderRef = [string]$sellerBDetail.order.orderNumber
        blockedForeignSuborder = $sellerBCrossBlocked
      }
      Set-Result "true_multi_store_seller_b_scope_valid" $sellerBOk ("listCount=" + $sellerBItems.Count + " suborderId=" + [int]$GeneratedMultiStoreSuborderBId + " blockedForeign=" + [string]$sellerBCrossBlocked)
    } catch {
      Set-Result "true_multi_store_seller_b_scope_valid" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_seller_a_scope_valid" $false "Skipped: multi-store checkout or seller sessions unavailable"
    Set-Result "true_multi_store_seller_b_scope_valid" $false "Skipped: multi-store checkout or seller sessions unavailable"
  }

  if ($Results["true_multi_store_create_checkout_valid"].pass -and $Results["true_multi_store_buyer_auth_ready"].pass) {
    try {
      $accountParentResp = Invoke-RestMethod -Uri "$BaseApi/store/orders/my/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $accountParent = $accountParentResp.data
      $accountGroupedResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedMultiStoreParentOrderId)/checkout-payment" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $accountGrouped = $accountGroupedResp.data
      $accountGroupA = @($accountGrouped.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $accountGroupB = @($accountGrouped.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      $accountOk = `
        ([int]$accountParent.id -eq [int]$GeneratedMultiStoreParentOrderId) -and `
        ([string]$accountParent.invoiceNo -eq [string]$GeneratedMultiStoreParentOrderRef) -and `
        ([string]$accountGrouped.invoiceNo -eq [string]$GeneratedMultiStoreParentOrderRef) -and `
        ([string]$accountGrouped.checkoutMode -eq "MULTI_STORE") -and `
        ([int]@($accountGrouped.groups).Count -eq 2) -and `
        ($null -ne $accountGroupA) -and `
        ($null -ne $accountGroupB) -and `
        ([int]$accountGroupA.suborderId -eq [int]$GeneratedMultiStoreSuborderAId) -and `
        ([int]$accountGroupB.suborderId -eq [int]$GeneratedMultiStoreSuborderBId) -and `
        (-not [string]::IsNullOrWhiteSpace([string]$accountGroupA.payment.qrImageUrl)) -and `
        (-not [string]::IsNullOrWhiteSpace([string]$accountGroupB.payment.qrImageUrl))
      Set-Entity "trueMultiStoreAccountConsistency" @{
        orderId = [int]$accountParent.id
        invoiceNo = [string]$accountGrouped.invoiceNo
        checkoutMode = [string]$accountGrouped.checkoutMode
        groupCount = [int]@($accountGrouped.groups).Count
        suborderAId = if ($accountGroupA) { [int]$accountGroupA.suborderId } else { $null }
        suborderBId = if ($accountGroupB) { [int]$accountGroupB.suborderId } else { $null }
        groupA = if ($accountGroupA) {
          @{
            qrisImageUrl = [string]$accountGroupA.payment.qrImageUrl
            merchantName = [string]$accountGroupA.payment.merchantName
            accountName = [string]$accountGroupA.payment.accountName
          }
        } else { $null }
        groupB = if ($accountGroupB) {
          @{
            qrisImageUrl = [string]$accountGroupB.payment.qrImageUrl
            merchantName = [string]$accountGroupB.payment.merchantName
            accountName = [string]$accountGroupB.payment.accountName
          }
        } else { $null }
      }
      Set-Result "true_multi_store_account_order_consistent" $accountOk ("orderId=" + [int]$accountParent.id + " ref=" + [string]$accountGrouped.invoiceNo + " groups=" + [int]@($accountGrouped.groups).Count + " qrisA=" + [string]$accountGroupA.payment.qrImageUrl + " qrisB=" + [string]$accountGroupB.payment.qrImageUrl)
    } catch {
      Set-Result "true_multi_store_account_order_consistent" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_account_order_consistent" $false "Skipped: multi-store order or buyer session unavailable"
  }

  if ($Results["true_multi_store_create_checkout_valid"].pass -and $Results["admin_login"].pass) {
    try {
      $adminOrderResp = Invoke-RestMethod -Uri "$BaseApi/admin/orders/by-invoice/$([uri]::EscapeDataString([string]$GeneratedMultiStoreParentOrderRef))" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminOrder = $adminOrderResp.data
      $adminAuditResp = Invoke-RestMethod -Uri "$BaseApi/admin/payments/audit/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminAudit = $adminAuditResp.data
      $adminAuditGroupA = @($adminAudit.split.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $adminAuditGroupB = @($adminAudit.split.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      $adminOk = `
        ([int]$adminOrder.id -eq [int]$GeneratedMultiStoreParentOrderId) -and `
        ([string]$adminOrder.invoiceNo -eq [string]$GeneratedMultiStoreParentOrderRef) -and `
        ([int]$adminAudit.parent.orderId -eq [int]$GeneratedMultiStoreParentOrderId) -and `
        ([string]$adminAudit.parent.invoiceNo -eq [string]$GeneratedMultiStoreParentOrderRef) -and `
        ([string]$adminAudit.split.checkoutMode -eq "MULTI_STORE") -and `
        ([int]@($adminAudit.suborders).Count -ge 2) -and `
        ($null -ne $adminAuditGroupA) -and `
        ($null -ne $adminAuditGroupB)
      Set-Entity "trueMultiStoreAdminConsistency" @{
        orderId = [int]$adminAudit.parent.orderId
        invoiceNo = [string]$adminAudit.parent.invoiceNo
        checkoutMode = [string]$adminAudit.split.checkoutMode
        suborderCount = [int]@($adminAudit.suborders).Count
      }
      Set-Result "true_multi_store_admin_order_payment_consistent" $adminOk ("orderId=" + [int]$adminAudit.parent.orderId + " ref=" + [string]$adminAudit.parent.invoiceNo + " suborders=" + [int]@($adminAudit.suborders).Count)
    } catch {
      Set-Result "true_multi_store_admin_order_payment_consistent" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_admin_order_payment_consistent" $false "Skipped: multi-store order or admin session unavailable"
  }

  if ($Results["true_multi_store_create_checkout_valid"].pass -and $Results["true_multi_store_buyer_auth_ready"].pass -and $Results["true_multi_store_seller_sessions_ready"].pass -and $Results["admin_login"].pass) {
    try {
      $groupedBeforeResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedMultiStoreParentOrderId)/checkout-payment" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $groupedBefore = $groupedBeforeResp.data
      $groupBeforeA = @($groupedBefore.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $groupBeforeB = @($groupedBefore.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      if ($null -eq $groupBeforeA) { throw "Store A payment group was not found in buyer checkout payment view." }
      if ($null -eq $groupBeforeB) { throw "Store B payment group was not found in buyer checkout payment view." }
      $paymentAId = [int]$groupBeforeA.payment.id
      $paymentBId = [int]$groupBeforeB.payment.id
      if ($paymentAId -le 0) { throw "Store A payment id is missing for payment review validation." }
      if ($paymentBId -le 0) { throw "Store B payment id is missing for payment review validation." }

      $proofPayloadA = @{
        proofImageUrl = "https://example.com/mvf-proof-$Timestamp.png"
        senderName = "MVF QA Multi Store Buyer"
        senderBankOrWallet = "QA Wallet"
        transferAmount = [int]$groupBeforeA.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA seller payment review consistency A"
      } | ConvertTo-Json
      $proofPayloadB = @{
        proofImageUrl = "https://example.com/mvf-proof-b-$Timestamp.png"
        senderName = "MVF QA Multi Store Buyer"
        senderBankOrWallet = "QA Wallet"
        transferAmount = [int]$groupBeforeB.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA seller payment review consistency B"
      } | ConvertTo-Json
      $proofRespA = Invoke-RestMethod -Uri "$BaseApi/payments/$paymentAId/proof" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $proofPayloadA -TimeoutSec 30
      $proofRespB = Invoke-RestMethod -Uri "$BaseApi/payments/$paymentBId/proof" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $proofPayloadB -TimeoutSec 30
      $proofDataA = $proofRespA.data
      $proofDataB = $proofRespB.data

      $sellerPendingAResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/payment-review/suborders?paymentStatus=PENDING_CONFIRMATION" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerPendingBResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/payment-review/suborders?paymentStatus=PENDING_CONFIRMATION" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      $sellerPendingAItems = @($sellerPendingAResp.data.items)
      $sellerPendingBItems = @($sellerPendingBResp.data.items)
      $sellerPendingAMatch = @($sellerPendingAItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId -and [int]$_.payment.id -eq $paymentAId }) | Select-Object -First 1
      $sellerPendingBMatch = @($sellerPendingBItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderBId -and [int]$_.payment.id -eq $paymentBId }) | Select-Object -First 1
      $sellerPendingBCrossOnA = @($sellerPendingBItems | Where-Object { [int]$_.payment.id -eq $paymentAId }) | Select-Object -First 1
      $pendingOk = `
        ([string]$proofDataA.status -eq "PENDING_CONFIRMATION") -and `
        ([string]$proofDataA.proof.reviewStatus -eq "PENDING") -and `
        ([string]$proofDataB.status -eq "PENDING_CONFIRMATION") -and `
        ([string]$proofDataB.proof.reviewStatus -eq "PENDING") -and `
        ($null -ne $sellerPendingAMatch) -and `
        ($null -ne $sellerPendingBMatch) -and `
        ($null -eq $sellerPendingBCrossOnA)

      $approvePayloadB = @{ action = "APPROVE"; note = "QA approve proof B $Timestamp" } | ConvertTo-Json
      $approveRespB = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/payments/$paymentBId/review" -Method Patch -WebSession $multiStoreSellerBSession -ContentType "application/json" -Body $approvePayloadB -TimeoutSec 30
      $approveDataB = $approveRespB.data

      $accountGroupedMidResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedMultiStoreParentOrderId)/checkout-payment" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $accountGroupedMid = $accountGroupedMidResp.data
      $accountGroupMidB = @($accountGroupedMid.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      $sellerDetailMidBResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/suborders/$($GeneratedMultiStoreSuborderBId)" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      $sellerDetailMidB = $sellerDetailMidBResp.data
      $adminAuditMidResp = Invoke-RestMethod -Uri "$BaseApi/admin/payments/audit/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminAuditMid = $adminAuditMidResp.data
      $adminSuborderMidB = @($adminAuditMid.suborders | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderBId }) | Select-Object -First 1
      $adminPaymentMidB = if ($adminSuborderMidB) { @($adminSuborderMidB.payments | Where-Object { [int]$_.id -eq $paymentBId }) | Select-Object -First 1 } else { $null }

      $approvedBOk = `
        $pendingOk -and `
        ([string]$approveDataB.payment.status -eq "PAID") -and `
        ([string]$approveDataB.payment.proof.reviewStatus -eq "APPROVED") -and `
        ($null -ne $accountGroupMidB) -and `
        ([string]$accountGroupMidB.payment.status -eq "PAID") -and `
        ([string]$accountGroupMidB.paymentStatus -eq "PAID") -and `
        ([string]$accountGroupMidB.fulfillmentStatus -eq "PROCESSING") -and `
        ([string]$accountGroupedMid.paymentStatus -eq "PARTIALLY_PAID") -and `
        ([string]$sellerDetailMidB.paymentStatus -eq "PAID") -and `
        ([string]$sellerDetailMidB.fulfillmentStatus -eq "PROCESSING") -and `
        ($null -ne $adminPaymentMidB) -and `
        ([string]$adminPaymentMidB.status -eq "PAID") -and `
        ([string]$adminSuborderMidB.paymentStatus -eq "PAID")
      Set-Entity "trueMultiStoreApprovedPayment" @{
        paymentId = $paymentBId
        suborderId = [int]$GeneratedMultiStoreSuborderBId
        buyerParentPaymentStatus = [string]$accountGroupedMid.paymentStatus
        buyerPaymentStatus = if ($accountGroupMidB) { [string]$accountGroupMidB.payment.status } else { $null }
        buyerFulfillmentStatus = if ($accountGroupMidB) { [string]$accountGroupMidB.fulfillmentStatus } else { $null }
        sellerPaymentStatus = [string]$sellerDetailMidB.paymentSummary.status
        sellerFulfillmentStatus = [string]$sellerDetailMidB.fulfillmentStatus
        adminPaymentStatus = if ($adminPaymentMidB) { [string]$adminPaymentMidB.status } else { $null }
      }
      Set-Result "true_multi_store_payment_approve_valid" $approvedBOk ("paymentId=" + $paymentBId + " parent=" + [string]$accountGroupedMid.paymentStatus + " sellerB=" + [string]$sellerDetailMidB.paymentSummary.status)

      $rejectPayload = @{ action = "REJECT"; note = "QA reject proof $Timestamp" } | ConvertTo-Json
      $rejectResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/payments/$paymentAId/review" -Method Patch -WebSession $multiStoreSellerASession -ContentType "application/json" -Body $rejectPayload -TimeoutSec 30
      $rejectData = $rejectResp.data

      $sellerRejectedAResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/payment-review/suborders?paymentStatus=REJECTED" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerRejectedBResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreB.storeId)/payment-review/suborders?paymentStatus=REJECTED" -Method Get -WebSession $multiStoreSellerBSession -TimeoutSec 30
      $sellerRejectedAItems = @($sellerRejectedAResp.data.items)
      $sellerRejectedBItems = @($sellerRejectedBResp.data.items)
      $sellerRejectedAMatch = @($sellerRejectedAItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId -and [int]$_.payment.id -eq $paymentAId }) | Select-Object -First 1
      $sellerRejectedBMatch = @($sellerRejectedBItems | Where-Object { [int]$_.payment.id -eq $paymentAId }) | Select-Object -First 1

      $sellerDetailAfterResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/suborders/$($GeneratedMultiStoreSuborderAId)" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerDetailAfter = $sellerDetailAfterResp.data
      $accountGroupedAfterResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedMultiStoreParentOrderId)/checkout-payment" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $accountGroupedAfter = $accountGroupedAfterResp.data
      $accountGroupAfterA = @($accountGroupedAfter.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $accountGroupAfterB = @($accountGroupedAfter.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreB.storeSlug }) | Select-Object -First 1
      $adminAuditAfterResp = Invoke-RestMethod -Uri "$BaseApi/admin/payments/audit/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminAuditAfter = $adminAuditAfterResp.data
      $adminSuborderAfterA = @($adminAuditAfter.suborders | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId }) | Select-Object -First 1
      $adminPaymentAfterA = if ($adminSuborderAfterA) { @($adminSuborderAfterA.payments | Where-Object { [int]$_.id -eq $paymentAId }) | Select-Object -First 1 } else { $null }

      $rejectedOk = `
        $approvedBOk -and `
        ([string]$rejectData.payment.status -eq "REJECTED") -and `
        ([string]$rejectData.payment.proof.reviewStatus -eq "REJECTED") -and `
        ($null -ne $sellerRejectedAMatch) -and `
        ($null -eq $sellerRejectedBMatch) -and `
        ([string]$sellerDetailAfter.paymentStatus -eq "UNPAID") -and `
        ([string]$sellerDetailAfter.paymentSummary.status -eq "REJECTED") -and `
        ($null -ne $accountGroupAfterA) -and `
        ([string]$accountGroupAfterA.paymentStatus -eq "UNPAID") -and `
        ([string]$accountGroupAfterA.payment.status -eq "REJECTED") -and `
        ([string]$accountGroupAfterA.payment.proof.reviewStatus -eq "REJECTED") -and `
        ($null -ne $accountGroupAfterB) -and `
        ([string]$accountGroupAfterB.payment.status -eq "PAID") -and `
        ([string]$accountGroupedAfter.paymentStatus -eq "PARTIALLY_PAID") -and `
        ($null -ne $adminPaymentAfterA) -and `
        ([string]$adminSuborderAfterA.paymentStatus -eq "UNPAID") -and `
        ([string]$adminPaymentAfterA.status -eq "REJECTED") -and `
        ([string]$adminPaymentAfterA.proof.reviewStatus -eq "REJECTED")

      Set-Entity "trueMultiStorePaymentReview" @{
        paymentId = $paymentAId
        suborderId = [int]$GeneratedMultiStoreSuborderAId
        pendingVisibleForSellerA = ($null -ne $sellerPendingAMatch)
        pendingVisibleForSellerB = ($null -ne $sellerPendingBMatch)
        rejectedVisibleForSellerA = ($null -ne $sellerRejectedAMatch)
        rejectedVisibleForSellerB = ($null -ne $sellerRejectedBMatch)
        sellerPaymentStatus = [string]$sellerDetailAfter.paymentSummary.status
        sellerSuborderPaymentStatus = [string]$sellerDetailAfter.paymentStatus
        buyerPaymentStatus = if ($accountGroupAfterA) { [string]$accountGroupAfterA.payment.status } else { $null }
        buyerSuborderPaymentStatus = if ($accountGroupAfterA) { [string]$accountGroupAfterA.paymentStatus } else { $null }
        adminPaymentStatus = if ($adminPaymentAfterA) { [string]$adminPaymentAfterA.status } else { $null }
      }
      Set-Result "true_multi_store_payment_review_consistent" $rejectedOk ("paymentId=" + $paymentAId + " sellerStatus=" + [string]$sellerDetailAfter.paymentSummary.status + " buyerSuborder=" + [string]$accountGroupAfterA.paymentStatus + " adminPayment=" + [string]$adminPaymentAfterA.status)

      $resubmitProofPayload = @{
        proofImageUrl = "https://example.com/mvf-proof-a-resubmit-$Timestamp.png"
        senderName = "MVF QA Multi Store Buyer Retry"
        senderBankOrWallet = "QA Wallet Retry"
        transferAmount = [int]$groupBeforeA.totalAmount
        transferTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note = "QA resubmit proof A"
      } | ConvertTo-Json
      $resubmitProofResp = Invoke-RestMethod -Uri "$BaseApi/payments/$paymentAId/proof" -Method Post -WebSession $multiStoreBuyerSession -ContentType "application/json" -Body $resubmitProofPayload -TimeoutSec 30
      $resubmitProofData = $resubmitProofResp.data
      $sellerPendingRetryAResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/payment-review/suborders?paymentStatus=PENDING_CONFIRMATION" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerPendingRetryAItems = @($sellerPendingRetryAResp.data.items)
      $sellerPendingRetryAMatch = @($sellerPendingRetryAItems | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId -and [int]$_.payment.id -eq $paymentAId }) | Select-Object -First 1
      $resubmitOk = `
        $rejectedOk -and `
        ([string]$resubmitProofData.status -eq "PENDING_CONFIRMATION") -and `
        ([string]$resubmitProofData.proof.reviewStatus -eq "PENDING") -and `
        ([string]$resubmitProofData.proof.proofImageUrl -eq "https://example.com/mvf-proof-a-resubmit-$Timestamp.png") -and `
        ($null -ne $sellerPendingRetryAMatch)
      Set-Result "true_multi_store_payment_resubmit_valid" $resubmitOk ("paymentId=" + $paymentAId + " review=" + [string]$resubmitProofData.proof.reviewStatus + " proof=" + [string]$resubmitProofData.proof.proofImageUrl)

      $approvePayloadA = @{ action = "APPROVE"; note = "QA approve proof A retry $Timestamp" } | ConvertTo-Json
      $approveRespA = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/payments/$paymentAId/review" -Method Patch -WebSession $multiStoreSellerASession -ContentType "application/json" -Body $approvePayloadA -TimeoutSec 30
      $approveDataA = $approveRespA.data
      $accountGroupedFinalResp = Invoke-RestMethod -Uri "$BaseApi/orders/$($GeneratedMultiStoreParentOrderId)/checkout-payment" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $accountGroupedFinal = $accountGroupedFinalResp.data
      $accountGroupFinalA = @($accountGroupedFinal.groups | Where-Object { [string]$_.storeSlug -eq [string]$multiStoreStoreA.storeSlug }) | Select-Object -First 1
      $buyerOrderFinalResp = Invoke-RestMethod -Uri "$BaseApi/store/orders/my/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $multiStoreBuyerSession -TimeoutSec 30
      $buyerOrderFinal = $buyerOrderFinalResp.data
      $adminAuditFinalResp = Invoke-RestMethod -Uri "$BaseApi/admin/payments/audit/$($GeneratedMultiStoreParentOrderId)" -Method Get -WebSession $adminSession -TimeoutSec 30
      $adminAuditFinal = $adminAuditFinalResp.data
      $adminSuborderFinalA = @($adminAuditFinal.suborders | Where-Object { [int]$_.suborderId -eq [int]$GeneratedMultiStoreSuborderAId }) | Select-Object -First 1
      $adminPaymentFinalA = if ($adminSuborderFinalA) { @($adminSuborderFinalA.payments | Where-Object { [int]$_.id -eq $paymentAId }) | Select-Object -First 1 } else { $null }
      $sellerDetailFinalAResp = Invoke-RestMethod -Uri "$BaseApi/seller/stores/$($multiStoreStoreA.storeId)/suborders/$($GeneratedMultiStoreSuborderAId)" -Method Get -WebSession $multiStoreSellerASession -TimeoutSec 30
      $sellerDetailFinalA = $sellerDetailFinalAResp.data

      $finalApproveOk = `
        $resubmitOk -and `
        ([string]$approveDataA.payment.status -eq "PAID") -and `
        ([string]$approveDataA.payment.proof.reviewStatus -eq "APPROVED") -and `
        ($null -ne $accountGroupFinalA) -and `
        ([string]$accountGroupFinalA.payment.status -eq "PAID") -and `
        ([string]$accountGroupFinalA.paymentStatus -eq "PAID") -and `
        ([string]$accountGroupFinalA.fulfillmentStatus -eq "PROCESSING") -and `
        ([string]$accountGroupedFinal.paymentStatus -eq "PAID") -and `
        ([string]$buyerOrderFinal.paymentStatus -eq "PAID") -and `
        ([string]$buyerOrderFinal.status -eq "processing") -and `
        ($null -ne $adminPaymentFinalA) -and `
        ([string]$adminPaymentFinalA.status -eq "PAID") -and `
        ([string]$adminSuborderFinalA.paymentStatus -eq "PAID") -and `
        ([string]$sellerDetailFinalA.paymentStatus -eq "PAID") -and `
        ([string]$sellerDetailFinalA.fulfillmentStatus -eq "PROCESSING")
      Set-Entity "trueMultiStoreResubmittedPayment" @{
        paymentId = $paymentAId
        suborderId = [int]$GeneratedMultiStoreSuborderAId
        buyerParentPaymentStatus = [string]$accountGroupedFinal.paymentStatus
        buyerParentOrderStatus = [string]$buyerOrderFinal.status
        buyerPaymentStatus = if ($accountGroupFinalA) { [string]$accountGroupFinalA.payment.status } else { $null }
        buyerFulfillmentStatus = if ($accountGroupFinalA) { [string]$accountGroupFinalA.fulfillmentStatus } else { $null }
        sellerPaymentStatus = [string]$sellerDetailFinalA.paymentSummary.status
        sellerFulfillmentStatus = [string]$sellerDetailFinalA.fulfillmentStatus
        adminPaymentStatus = if ($adminPaymentFinalA) { [string]$adminPaymentFinalA.status } else { $null }
      }
      Set-Result "true_multi_store_payment_resubmit_approve_valid" $finalApproveOk ("paymentId=" + $paymentAId + " parent=" + [string]$accountGroupedFinal.paymentStatus + " sellerA=" + [string]$sellerDetailFinalA.paymentSummary.status)
    } catch {
      if (-not $Results.Contains("true_multi_store_payment_approve_valid")) {
        Set-Result "true_multi_store_payment_approve_valid" $false $_.Exception.Message
      }
      if (-not $Results.Contains("true_multi_store_payment_resubmit_valid")) {
        Set-Result "true_multi_store_payment_resubmit_valid" $false $_.Exception.Message
      }
      if (-not $Results.Contains("true_multi_store_payment_resubmit_approve_valid")) {
        Set-Result "true_multi_store_payment_resubmit_approve_valid" $false $_.Exception.Message
      }
      Set-Result "true_multi_store_payment_review_consistent" $false $_.Exception.Message
    }
  } else {
    Set-Result "true_multi_store_payment_approve_valid" $false "Skipped: multi-store order, seller sessions, buyer session, or admin session unavailable"
    Set-Result "true_multi_store_payment_resubmit_valid" $false "Skipped: multi-store order, seller sessions, buyer session, or admin session unavailable"
    Set-Result "true_multi_store_payment_resubmit_approve_valid" $false "Skipped: multi-store order, seller sessions, buyer session, or admin session unavailable"
    Set-Result "true_multi_store_payment_review_consistent" $false "Skipped: multi-store order, seller sessions, buyer session, or admin session unavailable"
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
  generatedCatalogBuyerEmail = $GeneratedCatalogBuyerEmail
  generatedSellerStoreId = $GeneratedSellerStoreId
  generatedSellerStoreSlug = $GeneratedSellerStoreSlug
  generatedCatalogProductId = $GeneratedCatalogProductId
  generatedCatalogProductSlug = $GeneratedCatalogProductSlug
  generatedCatalogReviewState = $GeneratedCatalogReviewState
  generatedCatalogPublishState = $GeneratedCatalogPublishState
  generatedCatalogOrderRef = $GeneratedCatalogOrderRef
  generatedCatalogOrderId = $GeneratedCatalogOrderId
  generatedCatalogSuborderId = $GeneratedCatalogSuborderId
  generatedCatalogCheckoutMode = $GeneratedCatalogCheckoutMode
  generatedMultiStoreBuyerEmail = $GeneratedMultiStoreBuyerEmail
  generatedMultiStoreStoreAId = $GeneratedMultiStoreStoreAId
  generatedMultiStoreStoreASlug = $GeneratedMultiStoreStoreASlug
  generatedMultiStoreStoreBId = $GeneratedMultiStoreStoreBId
  generatedMultiStoreStoreBSlug = $GeneratedMultiStoreStoreBSlug
  generatedMultiStoreProductAId = $GeneratedMultiStoreProductAId
  generatedMultiStoreProductASlug = $GeneratedMultiStoreProductASlug
  generatedMultiStoreProductBId = $GeneratedMultiStoreProductBId
  generatedMultiStoreProductBSlug = $GeneratedMultiStoreProductBSlug
  generatedMultiStoreParentOrderId = $GeneratedMultiStoreParentOrderId
  generatedMultiStoreParentOrderRef = $GeneratedMultiStoreParentOrderRef
  generatedMultiStoreSuborderAId = $GeneratedMultiStoreSuborderAId
  generatedMultiStoreSuborderBId = $GeneratedMultiStoreSuborderBId
  generatedMultiStoreCheckoutMode = $GeneratedMultiStoreCheckoutMode
  generatedMultiStorePreviewStoreCount = $GeneratedMultiStorePreviewStoreCount
  generatedMultiStoreSuborderCount = $GeneratedMultiStoreSuborderCount
  total = $total
  passed = $passedCount
  failed = $failed.Count
  success = $overallPass
  scriptError = $ScriptError
  entities = $RunEntities
  checks = $Results
}

$resultObj | ConvertTo-Json -Depth 8 | Set-Content -Path $ResultPath -Encoding UTF8

$summaryLines = @()
$summaryLines += ("QA_MVF_RUN=" + $Timestamp)
$summaryLines += ("ARTIFACT_DIR=" + $ArtifactRelDir)
$summaryLines += ("RESULT_FILE=" + $ResultRelPath)
$summaryLines += ("SUMMARY=" + $passedCount + "/" + $total + " passed")
$summaryLines += ("SELLER_STORE_SLUG=" + (Coalesce @($GeneratedSellerStoreSlug, "")))
$summaryLines += ("CATALOG_PRODUCT_ID=" + (Coalesce @($GeneratedCatalogProductId, "")))
$summaryLines += ("CATALOG_PRODUCT_SLUG=" + (Coalesce @($GeneratedCatalogProductSlug, "")))
$summaryLines += ("CATALOG_REVIEW_STATE=" + (Coalesce @($GeneratedCatalogReviewState, "")))
$summaryLines += ("CATALOG_PUBLISH_STATE=" + (Coalesce @($GeneratedCatalogPublishState, "")))
$summaryLines += ("CATALOG_ORDER_REF=" + (Coalesce @($GeneratedCatalogOrderRef, "")))
$summaryLines += ("CATALOG_SUBORDER_ID=" + (Coalesce @($GeneratedCatalogSuborderId, "")))
$summaryLines += ("BUYER_EMAIL=" + (Coalesce @($GeneratedMultiStoreBuyerEmail, "")))
$summaryLines += ("STORE_A_SLUG=" + (Coalesce @($GeneratedMultiStoreStoreASlug, "")))
$summaryLines += ("STORE_B_SLUG=" + (Coalesce @($GeneratedMultiStoreStoreBSlug, "")))
$summaryLines += ("PRODUCT_A_ID=" + (Coalesce @($GeneratedMultiStoreProductAId, "")))
$summaryLines += ("PRODUCT_B_ID=" + (Coalesce @($GeneratedMultiStoreProductBId, "")))
$summaryLines += ("PRODUCT_A_SLUG=" + (Coalesce @($GeneratedMultiStoreProductASlug, "")))
$summaryLines += ("PRODUCT_B_SLUG=" + (Coalesce @($GeneratedMultiStoreProductBSlug, "")))
$summaryLines += ("PARENT_ORDER_REF=" + (Coalesce @($GeneratedMultiStoreParentOrderRef, "")))
$summaryLines += ("SUBORDER_A_ID=" + (Coalesce @($GeneratedMultiStoreSuborderAId, "")))
$summaryLines += ("SUBORDER_B_ID=" + (Coalesce @($GeneratedMultiStoreSuborderBId, "")))
$summaryLines += ("CHECKOUT_MODE=" + (Coalesce @($GeneratedMultiStoreCheckoutMode, "")))
$summaryLines += ("PREVIEW_STORE_COUNT=" + (Coalesce @($GeneratedMultiStorePreviewStoreCount, "")))
$summaryLines += ("SUBORDER_COUNT=" + (Coalesce @($GeneratedMultiStoreSuborderCount, "")))

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
