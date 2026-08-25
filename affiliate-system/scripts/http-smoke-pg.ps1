# Phase 16 - REAL HTTP smoke against PostgreSQL staging :3001 (PS 5.1 compatible)
$ErrorActionPreference = "Stop"
$base = "http://localhost:3001"
$script:pass = 0; $script:fail = 0; $script:fails = @()

function D($v, $d = 0) { if ($null -eq $v) { return [double]$d } else { return [double]$v } }
function Record($name, $ok, $detail = "") {
    if ($ok) { $script:pass++ } else { $script:fail++; $script:fails += "$name [$detail]" }
    $tag = "PASS"; if (-not $ok) { $tag = "FAIL" }
    $line = "{0}  {1}" -f $tag, $name
    if ($detail) { $line += "  [$detail]" }
    Write-Output $line
}

function Login($email, $pw) {
    $r = Invoke-WebRequest "$base/api/auth/csrf" -SessionVariable s -UseBasicParsing
    $csrf = ($r.Content | ConvertFrom-Json).csrfToken
    try {
        Invoke-WebRequest "$base/api/auth/callback/credentials" -Method POST -WebSession $s -UseBasicParsing `
            -Body @{ csrfToken = $csrf; email = $email; password = $pw; json = "true" } | Out-Null
    } catch {}
    $sessJson = (Invoke-WebRequest "$base/api/auth/session" -WebSession $s -UseBasicParsing).Content | ConvertFrom-Json
    return @{ S = $s; Role = $sessJson.user.role; Id = $sessJson.user.id; Ok = [bool]$sessJson.user.id }
}

function J($sess, $method, $path, $bodyObj) {
    try {
        $call = @{ Uri = ($base + $path); Method = $method; WebSession = $sess; UseBasicParsing = $true; TimeoutSec = 20 }
        if ($null -ne $bodyObj) { $call["ContentType"] = "application/json"; $call["Body"] = ($bodyObj | ConvertTo-Json -Depth 6 -Compress) }
        $res = Invoke-WebRequest @call
        return @{ status = [int]$res.StatusCode; json = ($res.Content | ConvertFrom-Json) }
    } catch {
        $code = 0
        try { $code = [int]$_.Exception.Response.StatusCode } catch {}
        $j = $null
        try {
            $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
            $j = ($sr.ReadToEnd()) | ConvertFrom-Json
        } catch {}
        return @{ status = $code; json = $j; loc = $loc }
    }
}

# ---------- Auth ----------
$A = Login "admin@affiliate.com" "admin123"
Record "admin login via real HTTP" (($A.Ok) -and ($A.Role -eq "ADMIN")) ("role=" + $A.Role)
$D = Login "affiliate@affiliate.com" "affiliate123"
Record "demo-affiliate login" (($D.Ok) -and ($D.Role -eq "AFFILIATE"))

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$tEmail = "smoke.$stamp@staging.local"
$tPw = "smoke-$stamp-Pg!"
$created = J $A.S "POST" "/api/admin/affiliates/create" @{ name = "SMOKE-TEST Affiliate"; email = $tEmail; phone = "01000000000"; password = $tPw; status = "ACTIVE" }
Record "create controlled staging affiliate" (($created.status -eq 200) -or ($created.status -eq 201)) ("status=" + $created.status)
$T = Login $tEmail $tPw
Record "smoke-affiliate login" ($T.Ok)

$prof0 = J $T.S "GET" "/api/profile" $null
$balance0 = D $prof0.json.balance
$earnings0 = D $prof0.json.totalEarnings
Record "smoke-affiliate profile baseline" ($prof0.status -eq 200) ("balance=" + $balance0)

# ---------- Catalog ----------
$prodList = J $T.S "GET" "/api/products" $null
# Pick a COMMISSION-BEARING product (variable-price): probe previews until one pays >= 100 EGP
$product = $null
$probeCommission = 0
foreach ($cand in @($prodList.json.products)) {
    $pv = J $T.S "POST" "/api/orders/preview" @{ items = @(@{ productId = $cand.id; quantity = 1; unitPrice = $cand.price }) }
    $pvCommission = D $pv.json.commission
    if (($pv.status -eq 200) -and ($pvCommission -ge 100) -and ([int]$cand.stock -ge 10)) { $product = $cand; $probeCommission = $pvCommission; break }
}
if ($null -eq $product) { $product = @($prodList.json.products)[0] }
Record "products list on PG" (($prodList.status -eq 200) -and ($null -ne $product)) ("picked=" + $product.id + " commission=" + $probeCommission)
$ship = J $T.S "GET" "/api/shipping" $null
$gov = "Cairo-Fallback"
if (@($ship.json).Count -gt 0) { $gov = $ship.json[0].governorate }
Record "shipping rates on PG" ($ship.status -eq 200)

# ---------- Controlled order lifecycle ----------
function CreateSmokeOrder($qty) {
    $itemsArr = @(@{ productId = $product.id; quantity = $qty; unitPrice = $product.price })
    $prev = J $T.S "POST" "/api/orders/preview" @{ items = $itemsArr; customerGovernorate = $gov }
    $ordBody = @{
        customerName = "SMOKE-TEST Customer"; customerPhone = ("01000000" + (Get-Random -Minimum 1000 -Maximum 9999));
        customerAddress = "SMOKE address"; customerCity = $gov; customerGovernorate = $gov; items = $itemsArr
    }
    $ord = J $T.S "POST" "/api/orders" $ordBody
    return @{ expectedCommission = (D $prev.json.commission); order = $ord; prevStatus = $prev.status; prevJson = $prev.json }
}

$L1 = CreateSmokeOrder 1
$o1 = $L1.order.json.order.id
Record "order created via HTTP on PG" (($L1.order.status -eq 200) -and $o1) ("id=$o1 commission=" + $L1.expectedCommission)
if (-not ($L1.order.status -eq 200 -and $o1)) {
    Write-Output ("   DBG order-create: status=" + $L1.order.status + " body=" + ($L1.order.json | ConvertTo-Json -Compress -Depth 4))
    Write-Output ("   DBG preview: status=" + $L1.prevStatus + " body=" + ($L1.prevJson | ConvertTo-Json -Compress -Depth 3))
}
Record "order createdAt valid timestamp" ([bool]($L1.order.json.order.createdAt))

$chainOk = $true
foreach ($st in @("UNDER_REVIEW","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","COLLECTED")) {
    $tr = J $A.S "PUT" "/api/admin/orders/$o1" @{ status = $st }
    if ($tr.status -ne 200) { $chainOk = $false; Write-Output ("   step " + $st + " -> " + $tr.status + " loc=" + $tr.loc + " body=" + ($tr.json | ConvertTo-Json -Compress)); break }
}
Record "full transition chain to COLLECTED" $chainOk

$balAfterCredit = D ((J $T.S "GET" "/api/profile" $null).json.balance)
$wantCredit = $balance0 + $L1.expectedCommission
Record "commission credited EXACTLY once" (([Math]::Abs($balAfterCredit - $wantCredit)) -lt 0.000001) ("bal=$balAfterCredit want=$wantCredit")

$dup = J $A.S "PUT" "/api/admin/orders/$o1" @{ status = "COLLECTED" }
$balDup = D ((J $T.S "GET" "/api/profile" $null).json.balance)
Record "repeat COLLECTED is no-op (no double credit)" (($dup.status -eq 200) -and (([Math]::Abs($balDup - $balAfterCredit)) -lt 0.000001)) ("status=" + $dup.status)

$notifsRaw = J $T.S "GET" "/api/notifications" $null
$items = $notifsRaw.json
if ($items -and $items.notifications) { $items = $items.notifications }
$earn = $items | Where-Object { ($_.type -eq "EARNINGS") -and ($_.relatedId -eq $o1) } | Select-Object -First 1
Record "EARNINGS notification received" ($null -ne $earn)

# ---------- Withdrawal lifecycle ----------
$wd = J $T.S "POST" "/api/withdrawals" @{ amount = 100; method = "VODAFONE_CASH"; accountName = "SMOKE"; accountNumber = "01000000000" }
$wdId = $wd.json.id
Record "withdrawal request created" (($wd.status -eq 200) -and $wdId) ("id=$wdId")
$balWd = D ((J $T.S "GET" "/api/profile" $null).json.balance)
Record "balance decremented at request" (([Math]::Abs($balWd - ($balAfterCredit - 100))) -lt 0.000001)

$rej = J $A.S "PUT" "/api/admin/withdrawals" @{ id = $wdId; status = "REJECTED" }
$balRej = D ((J $T.S "GET" "/api/profile" $null).json.balance)
Record "admin REJECT refunds exactly once" (($rej.status -eq 200) -and (([Math]::Abs($balRej - $balAfterCredit)) -lt 0.000001)) ("status=" + $rej.status)

$wd2 = J $T.S "POST" "/api/withdrawals" @{ amount = 100; method = "VODAFONE_CASH"; accountName = "SMOKE"; accountNumber = "01000000000" }
$apr = J $A.S "PUT" "/api/admin/withdrawals" @{ id = $wd2.json.id; status = "APPROVED" }
$balApr = D ((J $T.S "GET" "/api/profile" $null).json.balance)
Record "admin APPROVE keeps single debit" (($apr.status -eq 200) -and (([Math]::Abs($balApr - ($balAfterCredit - 100))) -lt 0.000001)) ("status=" + $apr.status)

$myWd = J $T.S "GET" "/api/withdrawals" $null
$strangers = @($myWd.json | Where-Object { $_.userId -ne $T.Id })
Record "withdrawals scoped to owner" (($myWd.status -eq 200) -and ($strangers.Count -eq 0))

# ---------- Commission reversal ----------
$L2 = CreateSmokeOrder 1
$o2 = $L2.order.json.order.id
$balPreB = D ((J $T.S "GET" "/api/profile" $null).json.balance)
foreach ($st in @("UNDER_REVIEW","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","COLLECTED")) {
    J $A.S "PUT" "/api/admin/orders/$o2" @{ status = $st } | Out-Null
}
$balPostB = D ((J $T.S "GET" "/api/profile" $null).json.balance)
$creditedB = ([Math]::Abs($balPostB - ($balPreB + $L2.expectedCommission))) -lt 0.000001
$rev = J $A.S "PUT" "/api/admin/orders/$o2" @{ status = "CANCELLED"; reason = "SMOKE reversal" }
$balRev = D ((J $T.S "GET" "/api/profile" $null).json.balance)
$condRev = ($creditedB -and ($rev.status -eq 200) -and (([Math]::Abs($balRev - $balPreB)) -lt 0.000001))
Record "commission reversed EXACTLY once" $condRev ("credited=$creditedB rev=" + $rev.status + " bal=$balRev want=$balPreB")

$term = J $A.S "PUT" "/api/admin/orders/$o2" @{ status = "PENDING" }
$balTerm = D ((J $T.S "GET" "/api/profile" $null).json.balance)
Record "terminal state blocks re-transition" (($term.status -ge 400) -and (([Math]::Abs($balTerm - $balRev)) -lt 0.000001)) ("status=" + $term.status)

# ---------- Authorization isolation ----------
$h1 = J $D.S "GET" "/api/admin/dashboard" $null
Record "affiliate blocked from admin dashboard (403)" ($h1.status -eq 403) ("got=" + $h1.status)
$h2 = J $D.S "GET" "/api/orders?id=$o1" $null
$othersOrder = $false
if ($h2.status -eq 404) { $othersOrder = $true } elseif ($null -eq $h2.json.order) { $othersOrder = $true }
Record "affiliate cannot read others' order" $othersOrder ("got=" + $h2.status)
$h3 = J $D.S "GET" "/api/admin/affiliates" $null
Record "affiliate blocked from affiliates API" ($h3.status -eq 403) ("got=" + $h3.status)

# ---------- Search / PG behaviors ----------
$arabicQuery = [string][char]0x0622 + [char]0x064A + [char]0x0641 + [char]0x0648 + [char]0x0646
$arabicPath = "/api/products?search=" + [Uri]::EscapeDataString($arabicQuery)
$arabic = J $T.S "GET" $arabicPath $null
$arHits = @($arabic.json.products).Count
Record "Arabic search hits migrated data" (($arabic.status -eq 200) -and ($arHits -ge 1)) ("hits=" + $arHits)

$upperQ = ""
if ($product.name) { $upperQ = $product.name.Split(" ")[0].ToUpperInvariant() } else { $upperQ = "IPHONE" }
$upperPath = "/api/products?search=" + [Uri]::EscapeDataString($upperQ)
$upper = J $T.S "GET" $upperPath $null
$uHits = @($upper.json.products).Count
Record "case-insensitive English search" (($upper.status -eq 200) -and ($uHits -ge 1)) ("hits=" + $uHits)

$srch = J $A.S "GET" "/api/admin/search?q=05" $null
Record "raw-SQL search endpoint on PG" (($srch.status -eq 200) -and ($null -ne $srch.json.customers))
$cust = J $A.S "GET" "/api/admin/customers?limit=5&sort=value" $null
$custTotal = $cust.json.summary.totalCustomers
Record "raw-SQL customers directory on PG" (($cust.status -eq 200) -and ($null -ne $custTotal)) ("total=" + $custTotal)
if ($cust.status -ne 200 -or $null -eq $custTotal) { Write-Output ("   DBG cust: status=" + $cust.status + " loc=" + $cust.loc + " body=" + ($cust.json | ConvertTo-Json -Compress -Depth 4)) }
$segN = J $A.S "GET" "/api/admin/customers?segment=NEW&sort=name&limit=5" $null
$segNewVal = $cust.json.segments.NEW
Record "customers NEW segment timestamps OK" (($segN.status -eq 200) -and ($null -ne $segNewVal))

$dash = J $A.S "GET" "/api/admin/dashboard" $null
Record "admin dashboard aggregates on PG" (($dash.status -eq 200) -and ($null -ne $dash.json.stats.totalRevenue)) ("revenue=" + $dash.json.stats.totalRevenue)
if ($dash.status -ne 200 -or $null -eq $dash.json.totalRevenue) { Write-Output ("   DBG dash: status=" + $dash.status + " keys=" + (($dash.json.PSObject.Properties.Name) -join ",") + " body=" + ($dash.json | ConvertTo-Json -Compress -Depth 2)) }
$wg = J $A.S "GET" "/api/admin/dashboard/widgets" $null
Record "admin widgets groupBy on PG" (($wg.status -eq 200) -and (@($wg.json.ordersByStatus).Count -gt 0))

# ---------- Webhooks (safe staging) ----------
$whc = J $A.S "POST" "/api/admin/webhooks" @{ name = "SMOKE-staging-hook"; url = "https://example.com/webhooks/smoke"; enabled = $false; events = @("order.created"); secret = "smoke-staging-secret-24chars!" }
$whl = J $A.S "GET" "/api/admin/webhooks" $null
Record "webhook endpoints on PG" ((($whc.status -eq 200) -or ($whc.status -eq 201)) -and ($whl.status -eq 200)) ("create=" + $whc.status)
if ($whc.status -ge 400) { Write-Output ("   DBG webhook: " + ($whc.json | ConvertTo-Json -Compress -Depth 3)) }

# ---------- Concurrency over real HTTP ----------
Add-Type -AssemblyName System.Net.Http
function NewLoggedInClient($email, $pw) {
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.CookieContainer = New-Object System.Net.CookieContainer
    $client = New-Object System.Net.Http.HttpClient($handler)
    $csrfRes = $client.GetAsync("$base/api/auth/csrf").Result
    $csrfJson = $csrfRes.Content.ReadAsStringAsync().Result | ConvertFrom-Json
    function Enc([string]$s) { return [System.Uri]::EscapeDataString($s) }
    $bodyStr = "csrfToken=" + (Enc $csrfJson.csrfToken) + "&email=" + (Enc $email) + "&password=" + (Enc $pw) + "&json=true&"
    $formContent = New-Object System.Net.Http.StringContent($bodyStr, [System.Text.Encoding]::UTF8, "application/x-www-form-urlencoded")
    $null = $client.PostAsync("$base/api/auth/callback/credentials", $formContent).Result
    return $client
}

# Fresh dedicated race-affiliate so rate-limit budgets (3 withdrawals/h/user)
# are consumed ONLY by the racers themselves — by-design limiter stays honest.
$rEmail = "race.$stamp@staging.local"
$rPw = "race-$stamp-Pg!"
J $A.S "POST" "/api/admin/affiliates/create" @{ name = "RACE Affiliate"; email = $rEmail; phone = "01000000000"; password = $rPw; status = "ACTIVE" } | Out-Null
$R = Login $rEmail $rPw

$itemsR = @(@{ productId = $product.id; quantity = 1; unitPrice = $product.price })
J $R.S "POST" "/api/orders" @{ customerName = "RACE Customer"; customerPhone = ("01000000" + (Get-Random -Minimum 1000 -Maximum 9999)); customerAddress = "addr"; customerCity = $gov; customerGovernorate = $gov; items = $itemsR } | Out-Null
$rOrderList = J $R.S "GET" "/api/orders?limit=1" $null
$rOrderId = $rOrderList.json.orders[0].id
foreach ($st in @("UNDER_REVIEW","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","COLLECTED")) {
    J $A.S "PUT" "/api/admin/orders/$rOrderId" @{ status = $st } | Out-Null
}
$balNow = D ((J $R.S "GET" "/api/profile" $null).json.balance)
$half = [Math]::Max(100, [int][Math]::Floor($balNow / 2))
Write-Output ("   race-user funded: bal=$balNow half=$half")

# Racer logins happen BEFORE any withdrawal attempts (budget: exactly these 2)
$rc1 = NewLoggedInClient $rEmail $rPw
$rc2 = NewLoggedInClient $rEmail $rPw
$wdBody = { param($cl) }
$jsonWd = @{ amount = $half; method = "VODAFONE_CASH"; accountName = "RACE"; accountNumber = "x" } | ConvertTo-Json -Compress
$content1 = New-Object System.Net.Http.StringContent($jsonWd, [System.Text.Encoding]::UTF8, "application/json")
$content2 = New-Object System.Net.Http.StringContent($jsonWd, [System.Text.Encoding]::UTF8, "application/json")
$t1r = $rc1.PostAsync("$base/api/withdrawals", $content1)
$t2r = $rc2.PostAsync("$base/api/withdrawals", $content2)
[void][System.Threading.Tasks.Task]::WaitAll($t1r, $t2r)
$s1 = [int]$t1r.Result.StatusCode; $s2 = [int]$t2r.Result.StatusCode
$oks = 0; if ($s1 -eq 200) { $oks++ }; if ($s2 -eq 200) { $oks++ }
$balRace = D ((J $R.S "GET" "/api/profile" $null).json.balance)
$expectedAfter = $balNow - ($oks * $half)
$consistentRace = ([Math]::Abs($balRace - $expectedAfter)) -lt 0.000001
Record "concurrent withdrawals race consistent" (($oks -ge 1) -and $consistentRace -and ($balRace -ge 0)) ("oks=$oks/2 codes=$s1,$s2 bal=$balRace want=$expectedAfter")

# refund whatever raced for clean state
$wlR = J $R.S "GET" "/api/withdrawals" $null
foreach ($pend in @($wlR.json | Where-Object { $_.status -eq "PENDING" })) {
    J $A.S "PUT" "/api/admin/withdrawals" @{ id = $pend.id; status = "REJECTED" } | Out-Null
}

# ---- concurrent duplicate COLLECTED on a fresh DELIVERED order of the same race user ----
J $R.S "POST" "/api/orders" @{ customerName = "RACE Customer2"; customerPhone = ("01000000" + (Get-Random -Minimum 1000 -Maximum 9999)); customerAddress = "addr"; customerCity = $gov; customerGovernorate = $gov; items = $itemsR } | Out-Null
$rOrder2List = J $R.S "GET" "/api/orders?limit=1" $null
$rOrder2 = $rOrder2List.json.orders[0].id
foreach ($st in @("UNDER_REVIEW","CONFIRMED","PROCESSING","SHIPPED","DELIVERED")) {
    J $A.S "PUT" "/api/admin/orders/$rOrder2" @{ status = $st } | Out-Null
}
$balPreC = D ((J $R.S "GET" "/api/profile" $null).json.balance)

$ac1 = NewLoggedInClient "admin@affiliate.com" "admin123"
$ac2 = NewLoggedInClient "admin@affiliate.com" "admin123"
$jsonC = @{ status = "COLLECTED" } | ConvertTo-Json -Compress
$contentC = New-Object System.Net.Http.StringContent($jsonC, [System.Text.Encoding]::UTF8, "application/json")
$contentD = New-Object System.Net.Http.StringContent($jsonC, [System.Text.Encoding]::UTF8, "application/json")
$p1r = $ac1.PutAsync("$base/api/admin/orders/$rOrder2", $contentC)
$p2r = $ac2.PutAsync("$base/api/admin/orders/$rOrder2", $contentD)
[void][System.Threading.Tasks.Task]::WaitAll($p1r, $p2r)
$sC = [int]$p1r.Result.StatusCode; $sD = [int]$p2r.Result.StatusCode
$balPostC = D ((J $R.S "GET" "/api/profile" $null).json.balance)
$delta = $balPostC - $balPreC
$creditOnce = (($delta -eq 0) -or (([Math]::Abs($delta - $probeCommission)) -lt 0.000001))
$finalOrd = J $A.S "GET" "/api/admin/orders/$rOrder2" $null
Record "concurrent duplicate COLLECTED: at-most-one credit" ((($sC -eq 200) -or ($sC -eq 409)) -and (($sD -eq 200) -or ($sD -eq 409)) -and $creditOnce -and ($finalOrd.json.status -eq "COLLECTED")) ("codes=$sC,$sD delta=$delta exp=$probeCommission finalStatus=$($finalOrd.json.status)")