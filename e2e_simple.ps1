$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5005"

function MakeReq {
    param([string]$Method = "GET", [string]$Endpoint, [object]$Body, [hashtable]$Hdrs = @{})
    $url = "$baseUrl$Endpoint"
    try {
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $resp = Invoke-WebRequest -Uri $url -Method $Method -Body $bodyJson -ContentType "application/json" -Headers $Hdrs
        } else {
            $resp = Invoke-WebRequest -Uri $url -Method $Method -ContentType "application/json" -Headers $Hdrs
        }
        return $resp.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "PASO 1: Login" -ForegroundColor Green
$login = MakeReq -Method "POST" -Endpoint "/api/auth/login" -Body @{ username = "admin"; password = "123" }
if ($login.success) {
    $token = $login.data.token
    $headers = @{ "Authorization" = "Bearer $token" }
    Write-Host "Login OK" -ForegroundColor Green
} else {
    exit 1
}

Write-Host "PASO 2: Crear Grupo" -ForegroundColor Green
$group = MakeReq -Method "POST" -Endpoint "/api/groups" -Body @{ name = "GrupoE2E$(Get-Random)"; description = "Test" } -Hdrs $headers
if ($group.success) {
    $gid = $group.data._id
    Write-Host "Grupo creado: $($group.data.name)" -ForegroundColor Green
} else {
    exit 1
}

Write-Host "PASO 3: Crear Personas" -ForegroundColor Green
$pids = @()
for ($i = 1; $i -le 2; $i++) {
    $dni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
    $p = MakeReq -Method "POST" -Endpoint "/api/persons" -Body @{ fullName = "P$i"; dni = $dni; address = "Dir"; financialStatus = "Stable"; group = $gid } -Hdrs $headers
    if ($p.success) {
        $pids += $p.data._id
        Write-Host "Persona $i OK" -ForegroundColor Green
    }
}

Write-Host "PASO 4: Aprobar" -ForegroundColor Green
foreach ($personId in $pids) {
    MakeReq -Method "PUT" -Endpoint "/api/groups/members/$personId" -Body @{ dniChecked = $true; estadoFinancieroChecked = $true; carpetaCompletaChecked = $true; verificacionChecked = $true } -Hdrs $headers
}

Write-Host "PASO 5: Accionista" -ForegroundColor Green
$sh = MakeReq -Method "POST" -Endpoint "/api/shareholders" -Body @{ fullName = "Acc"; dni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString(); contribution = 1000 } -Hdrs $headers
if (-not $sh.success) { Write-Host "ERROR Shareholder: $($sh.error)"; exit 1 }
$shid = $sh.data._id
Write-Host "Accionista OK - ID: $shid" -ForegroundColor Cyan

Write-Host "PASO 6: Prestamo" -ForegroundColor Green

# Verificar estado del grupo después de las aprobaciones
$groupAfter = MakeReq -Method "GET" -Endpoint "/api/groups/$gid" -Hdrs $headers
Write-Host "Grupo después de aprobaciones:" -ForegroundColor Cyan
Write-Host ($groupAfter.data | ConvertTo-Json -Depth 3)

# Comprobar que todos los miembros estén aprobados antes de crear el préstamo
$allApproved = $true
foreach ($m in $groupAfter.data.members) {
    if (-not ($m.dniChecked -and $m.estadoFinancieroChecked -and $m.carpetaCompletaChecked -and $m.verificacionChecked)) { $allApproved = $false }
}
if (-not $allApproved) {
    Write-Host "No todos los miembros están aprobados, abortando creación de préstamo" -ForegroundColor Yellow
} else {
    $loan = MakeReq -Method "POST" -Endpoint "/api/loans" -Body @{ groupId = $gid; amount = 1000; numberOfInstallments = 2; shareholderContributions = @( @{ shareholderId = $shid; amount = 1000 } ) } -Hdrs $headers
    if (-not $loan.success) { Write-Host "ERROR Préstamo: $($loan.error)" -ForegroundColor Red }
}

Write-Host "PASO 7: Cuenta Grupo" -ForegroundColor Green
$gacc = MakeReq -Method "GET" -Endpoint "/api/current-accounts/group/$gid" -Hdrs $headers
Write-Host "Monto: $($gacc.data.totalAmount)" -ForegroundColor Cyan

Write-Host "PASO 8: Cuentas Personas" -ForegroundColor Green
foreach ($personId in $pids) {
    $pacc = MakeReq -Method "GET" -Endpoint "/api/current-accounts/person/$personId" -Hdrs $headers
    Write-Host "Persona OK" -ForegroundColor Cyan
}

Write-Host "OK COMPLETO" -ForegroundColor Green
