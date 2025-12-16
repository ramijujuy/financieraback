$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5005"
$adminUser = @{ email = "admin@test.com"; password = "admin" }

function Make-Request {
    param([string]$Method = "GET", [string]$Endpoint, [object]$Body, [hashtable]$Headers = @{})
    $url = "$baseUrl$Endpoint"
    try {
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-WebRequest -Uri $url -Method $Method -Body $bodyJson -ContentType "application/json" -Headers $Headers
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -ContentType "application/json" -Headers $Headers
        }
        return $response.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "ERROR en $Endpoint`: $_" -ForegroundColor Red
        return $null
    }
}

# Login
Write-Host "=== PASO 1: Login ===" -ForegroundColor Green
$loginRes = Make-Request -Method "POST" -Endpoint "/api/auth/login" -Body $adminUser
if ($loginRes.success) {
    $token = $loginRes.data.token
    Write-Host "✓ Login OK - Token: $($token.Substring(0,20))..." -ForegroundColor Green
    $headers = @{ "Authorization" = "Bearer $token" }
} else {
    Write-Host "✗ Login fallido" -ForegroundColor Red; exit 1
}

# Crear Grupo
Write-Host "`n=== PASO 2: Crear Grupo ===" -ForegroundColor Green
$newGroup = @{ name = "Grupo E2E $(Get-Random)"; description = "Prueba" }
$groupRes = Make-Request -Method "POST" -Endpoint "/api/groups" -Body $newGroup -Headers $headers
if ($groupRes.success) {
    $groupId = $groupRes.data._id
    Write-Host "✓ Grupo: $($groupRes.data.name)" -ForegroundColor Green
} else {
    Write-Host "✗ Error creando grupo" -ForegroundColor Red; exit 1
}

# Crear Personas
Write-Host "`n=== PASO 3: Crear Personas ===" -ForegroundColor Green
$personIds = @()
for ($i = 1; $i -le 2; $i++) {
    $dni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString()
    $newPerson = @{ fullName = "Persona $i"; dni = $dni; address = "Calle $i"; financialStatus = "Stable"; group = $groupId }
    $personRes = Make-Request -Method "POST" -Endpoint "/api/persons" -Body $newPerson -Headers $headers
    if ($personRes.success) {
        $personIds += $personRes.data._id
        Write-Host "✓ Persona $i creada" -ForegroundColor Green
    }
}

# Aprobar miembros
Write-Host "`n=== PASO 4: Aprobar Miembros ===" -ForegroundColor Green
foreach ($personId in $personIds) {
    $updateRes = Make-Request -Method "PUT" -Endpoint "/api/groups/members/$personId" `
        -Body @{ checks = @{ dniChecked = $true; estadoFinancieroChecked = $true; carpetaCompletaChecked = $true; verificacionChecked = $true } } -Headers $headers
    if ($updateRes.success) { Write-Host "✓ Miembro aprobado" -ForegroundColor Green }
}

# Crear Accionista
Write-Host "`n=== PASO 5: Crear Accionista ===" -ForegroundColor Green
$shareholder = @{ name = "Accionista"; dni = (Get-Random -Minimum 10000000 -Maximum 99999999).ToString(); contribution = 1000 }
$shareholderRes = Make-Request -Method "POST" -Endpoint "/api/shareholders" -Body $shareholder -Headers $headers
if ($shareholderRes.success) {
    $shareholderId = $shareholderRes.data._id
    Write-Host "✓ Accionista creado" -ForegroundColor Green
}

# Crear Préstamo
Write-Host "`n=== PASO 6: Crear Préstamo ===" -ForegroundColor Green
$loan = @{
    group = $groupId
    amount = 1000
    installments = 2
    shareholderContributions = @( @{ shareholder = $shareholderId; contribution = 1000 } )
}
$loanRes = Make-Request -Method "POST" -Endpoint "/api/loans" -Body $loan -Headers $headers
if ($loanRes.success) {
    Write-Host "✓ Préstamo: \$$($loanRes.data.amount)" -ForegroundColor Green
}

# Cuenta del Grupo
Write-Host "`n=== PASO 7: Cuenta Corriente del Grupo ===" -ForegroundColor Green
$groupAcct = Make-Request -Method "GET" -Endpoint "/api/current-accounts/group/$groupId" -Headers $headers
if ($groupAcct.success) {
    Write-Host "✓ Monto: \$$($groupAcct.data.totalAmount)" -ForegroundColor Green
    Write-Host "  Cuotas: $($groupAcct.data.installments.Count)" -ForegroundColor Cyan
    Write-Host "  Pagado: \$$($groupAcct.data.personTotals.totalPaid)" -ForegroundColor Cyan
    Write-Host "  Pendiente: \$$($groupAcct.data.personTotals.totalUnpaid)" -ForegroundColor Cyan
}

# Cuentas de Personas
Write-Host "`n=== PASO 8: Cuentas de Personas ===" -ForegroundColor Green
foreach ($personId in $personIds) {
    $personAcct = Make-Request -Method "GET" -Endpoint "/api/current-accounts/person/$personId" -Headers $headers
    if ($personAcct.success) {
        Write-Host "✓ Persona - Monto: \$$($personAcct.data.totalAmount) | Pagado: \$$($personAcct.data.totalPaid) | Pendiente: \$$($personAcct.data.totalUnpaid)" -ForegroundColor Green
    }
}

# Marcar cuota pagada
Write-Host "`n=== PASO 9: Marcar Cuota Pagada ===" -ForegroundColor Green
$personAcct = Make-Request -Method "GET" -Endpoint "/api/current-accounts/person/$($personIds[0])" -Headers $headers
if ($personAcct.success) {
    $accountId = $personAcct.data._id
    $markRes = Make-Request -Method "PUT" -Endpoint "/api/current-accounts/$accountId/installments/1" `
        -Body @{ status = "paid"; paidDate = (Get-Date).ToUniversalTime().ToString("o") } -Headers $headers
    if ($markRes.success) {
        Write-Host "✓ Cuota pagada - Nuevo pagado: \$$($markRes.data.totalPaid)" -ForegroundColor Green
    }
}

# Verificar cuenta actualizada
Write-Host "`n=== PASO 10: Cuenta Grupo Actualizada ===" -ForegroundColor Green
$groupAcct = Make-Request -Method "GET" -Endpoint "/api/current-accounts/group/$groupId" -Headers $headers
if ($groupAcct.success) {
    Write-Host "✓ Pagado (por persona): \$$($groupAcct.data.personTotals.totalPaid)" -ForegroundColor Green
    Write-Host "  Pendiente (por persona): \$$($groupAcct.data.personTotals.totalUnpaid)" -ForegroundColor Cyan
}

Write-Host "`n=== E2E EXITOSO ===" -ForegroundColor Green
